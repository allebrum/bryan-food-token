// Real (on-chain) deposits for EVM networks.
//
//   1. allocateEvmAddress  — one HD address per user, saved before anything else
//   2. registerAddresses   — add new addresses to every Alchemy webhook (retried)
//   3. ingestAlchemy       — webhook → deposit rows in 'confirming' (idempotent)
//   4. confirmDeposits     — after N blocks, re-check the receipt, price it,
//                            and credit the balance + ledger in one statement
//
// Steps 2 and 4 run on a schedule (netlify/functions/deposits-sync.mjs) and
// also opportunistically while a user is watching their deposit.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from './config.js'
import { q, one } from './db.js'
import { EVM_NETWORKS, enabledEvmNetworks, evmEnabled, deriveEvmAddress, rpc, formatUnits } from './chains/evm.js'

const STABLE = new Set(['USDC', 'USDT'])

// ---------- addresses ----------
export async function allocateEvmAddress(userId) {
  if (!evmEnabled()) return null
  const existing = await one(`SELECT address FROM deposit_addresses WHERE user_id = $1 AND family = 'evm'`, [userId])
  if (existing) return existing.address
  const { idx } = await one(`SELECT nextval('evm_derivation_index')::int AS idx`)
  const address = deriveEvmAddress(idx)
  // A concurrent request may have won; its row stands and this index is skipped.
  await q(
    `INSERT INTO deposit_addresses (user_id, family, derivation_index, address)
     VALUES ($1, 'evm', $2, $3) ON CONFLICT (user_id, family) DO NOTHING`,
    [userId, idx, address],
  )
  const row = await one(`SELECT address FROM deposit_addresses WHERE user_id = $1 AND family = 'evm'`, [userId])
  registerAddresses().catch((err) => console.error('address registration failed (will retry)', err.message))
  return row.address
}

// Adds unregistered addresses to every enabled network's webhook. An address
// is only marked registered when every network accepted it.
export async function registerAddresses() {
  if (!evmEnabled() || !config.alchemy.authToken) return 0
  const { rows } = await q(`SELECT id, address FROM deposit_addresses WHERE registered_at IS NULL ORDER BY created_at LIMIT 500`)
  if (!rows.length) return 0
  for (const network of enabledEvmNetworks()) {
    const res = await fetch('https://dashboard.alchemy.com/api/update-webhook-addresses', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'x-alchemy-token': config.alchemy.authToken },
      body: JSON.stringify({ webhook_id: config.evm.webhooks[network].id, addresses_to_add: rows.map((r) => r.address), addresses_to_remove: [] }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`Alchemy rejected addresses for ${network}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
  }
  await q(`UPDATE deposit_addresses SET registered_at = now() WHERE id = ANY($1)`, [rows.map((r) => r.id)])
  return rows.length
}

// ---------- webhook ----------
// Returns the network key whose signing key matches, or null.
export function verifyAlchemySignature(rawBody, signature, webhookId) {
  if (!rawBody || !signature) return null
  for (const network of enabledEvmNetworks()) {
    const hook = config.evm.webhooks[network]
    if (hook.id !== webhookId) continue
    const expected = createHmac('sha256', hook.signingKey).update(rawBody).digest()
    const given = Buffer.from(String(signature), 'hex')
    if (given.length === expected.length && timingSafeEqual(given, expected)) return network
  }
  return null
}

export async function ingestAlchemy(network, payload) {
  const net = EVM_NETWORKS[network]
  const activity = Array.isArray(payload?.event?.activity) ? payload.event.activity.slice(0, 1000) : []
  if (!activity.length) return { recorded: 0 }
  const to = [...new Set(activity.map((a) => String(a.toAddress || '').toLowerCase()).filter(Boolean))]
  const owners = new Map((await q(`SELECT address, user_id FROM deposit_addresses WHERE family = 'evm' AND address = ANY($1)`, [to])).rows.map((r) => [r.address, r.user_id]))
  let recorded = 0
  for (const a of activity) {
    const toAddr = String(a.toAddress || '').toLowerCase()
    const userId = owners.get(toAddr)
    if (!userId) continue
    const from = String(a.fromAddress || '').toLowerCase()
    if (config.treasuryAddresses.has(from)) continue // our own gas top-ups / sweeps
    const hash = String(a.hash || '').toLowerCase()
    if (!/^0x[0-9a-f]{64}$/.test(hash)) continue
    const blockNumber = Number.parseInt(a.blockNum, 16)
    const category = String(a.category || '')
    const contract = String(a.rawContract?.address || '').toLowerCase()

    let coin, decimals, asset, txRef
    if (category === 'external' || category === 'internal') {
      ;({ coin, decimals } = net.native)
      asset = 'native'
      txRef = category === 'external' ? `${hash}:native` : `${hash}:internal:${toAddr}:${a.rawContract?.rawValue}`
    } else if (category === 'erc20' || category === 'token') {
      const token = net.tokens[contract]
      txRef = `${hash}:${Number.parseInt(a.log?.logIndex ?? '0x0', 16)}`
      if (a.log?.removed) {
        await q(`UPDATE deposits SET status = 'reverted', note = 'chain reorganisation' WHERE network = $1 AND tx_ref = $2 AND status = 'confirming'`, [network, txRef])
        continue
      }
      if (!token) {
        // Unsupported token: keep a record for support, never credit it.
        await q(
          `INSERT INTO deposits (user_id, coin, network, amount, tx_ref, status, address, from_address, asset, block_number, note)
           VALUES ($1, $2, $3, 1, $4, 'ignored', $5, $6, $7, $8, 'unsupported token') ON CONFLICT (network, tx_ref) DO NOTHING`,
          [userId, String(a.asset || 'TOKEN').slice(0, 12), network, txRef, toAddr, from, contract, blockNumber],
        )
        continue
      }
      ;({ coin, decimals } = token)
      asset = contract
    } else continue // NFTs etc.

    let raw
    try {
      raw = BigInt(a.rawContract?.rawValue ?? '0x0')
    } catch {
      continue
    }
    if (raw <= 0n) continue
    const r = await q(
      `INSERT INTO deposits (user_id, coin, network, amount, tx_ref, status, address, from_address, asset, block_number, block_hash, required_confirmations)
       VALUES ($1, $2, $3, $4, $5, 'confirming', $6, $7, $8, $9, $10, $11) ON CONFLICT (network, tx_ref) DO NOTHING`,
      [userId, coin, network, formatUnits(raw, decimals), txRef, toAddr, from, asset, blockNumber, a.log?.blockHash || null, net.confirmations],
    )
    recorded += r.rowCount
  }
  return { recorded }
}

// ---------- prices ----------
let priceCache = { at: 0, prices: {} }
export async function usdPrice(coin) {
  if (STABLE.has(coin)) return 1
  if (Date.now() - priceCache.at > 60_000) {
    if (!config.alchemy.apiKey) throw new Error('ALCHEMY_API_KEY is not set')
    const res = await fetch(`https://api.g.alchemy.com/prices/v1/${config.alchemy.apiKey}/tokens/by-symbol?symbols=ETH&symbols=BNB`, {
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) throw new Error(`Prices API: HTTP ${res.status}`)
    const body = await res.json()
    const prices = {}
    for (const t of body.data ?? []) {
      const usd = (t.prices ?? []).find((p) => String(p.currency).toLowerCase() === 'usd')
      if (usd && Number(usd.value) > 0) prices[t.symbol] = Number(usd.value)
    }
    priceCache = { at: Date.now(), prices }
  }
  const p = priceCache.prices[coin]
  if (!p) throw new Error(`No USD price for ${coin}`)
  return p
}

// ---------- confirmations + credit ----------
export async function confirmDeposits({ userId } = {}) {
  const { rows } = await q(
    `SELECT * FROM deposits WHERE status = 'confirming' AND block_number IS NOT NULL
       AND ($1::uuid IS NULL OR user_id = $1) ORDER BY created_at LIMIT 200`,
    [userId ?? null],
  )
  if (!rows.length) return { credited: 0 }
  let credited = 0
  const heads = {}
  for (const d of rows) {
    if (!EVM_NETWORKS[d.network]) continue
    try {
      heads[d.network] ??= Number.parseInt(await rpc(d.network, 'eth_blockNumber'), 16)
      const confirmations = Math.max(0, heads[d.network] - Number(d.block_number) + 1)
      if (confirmations < d.required_confirmations) {
        if (confirmations !== d.confirmations) await q(`UPDATE deposits SET confirmations = $2 WHERE id = $1 AND status = 'confirming'`, [d.id, confirmations])
        continue
      }
      // Re-check the transaction is still in the canonical chain and succeeded.
      const hash = d.tx_ref.split(':')[0]
      const receipt = await rpc(d.network, 'eth_getTransactionReceipt', [hash])
      if (!receipt || receipt.status !== '0x1') {
        await q(`UPDATE deposits SET status = 'reverted', note = $2 WHERE id = $1 AND status = 'confirming'`, [d.id, receipt ? 'transaction failed' : 'transaction dropped'])
        continue
      }
      const minedAt = Number.parseInt(receipt.blockNumber, 16)
      if (minedAt !== Number(d.block_number)) {
        // Re-mined in a different block: start counting again from there.
        await q(`UPDATE deposits SET block_number = $2, block_hash = $3, confirmations = 0 WHERE id = $1`, [d.id, minedAt, receipt.blockHash])
        continue
      }
      const rate = await usdPrice(d.coin)
      const usdCents = Math.floor(Number(d.amount) * rate * 100)
      const min = config.evm.minUsd[d.network] ?? 0
      if (usdCents < min * 100) {
        await q(
          `UPDATE deposits SET status = 'held', rate_usd = $2, usd_cents = $3, confirmations = $4, note = $5 WHERE id = $1 AND status = 'confirming'`,
          [d.id, rate, usdCents, confirmations, `below $${min} minimum`],
        )
        continue
      }
      // Atomic: complete the deposit, write its ledger row, credit the user.
      // The status guard means a deposit can only ever be credited once.
      const r = await q(
        `WITH done AS (
           UPDATE deposits SET status = 'complete', completed_at = now(), rate_usd = $2, usd_cents = $3, confirmations = $4, block_hash = $5
           WHERE id = $1 AND status = 'confirming' RETURNING id, user_id, usd_cents
         ), led AS (
           INSERT INTO ledger (user_id, amount_cents, kind, ref) SELECT user_id, usd_cents, 'deposit', id::text FROM done
           RETURNING user_id, amount_cents
         )
         UPDATE users u SET balance_cents = u.balance_cents + led.amount_cents FROM led WHERE u.id = led.user_id`,
        [d.id, rate, usdCents, confirmations, receipt.blockHash],
      )
      credited += r.rowCount
    } catch (err) {
      console.error(`confirm deposit ${d.id} failed (will retry)`, err.message)
    }
  }
  return { credited }
}

export async function syncDeposits() {
  const registered = await registerAddresses().catch((err) => (console.error(err.message), 0))
  const { credited } = await confirmDeposits()
  return { registered, credited }
}
