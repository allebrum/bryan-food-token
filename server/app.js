// Food Token API (Express on Postgres).
// Runs locally via server/dev.js and on Netlify via netlify/functions/api.mjs.
// Money is integer cents; every balance change writes a ledger row in the
// same transaction. Gift card secrets are encrypted at rest (secrets.js).
import express from 'express'
import { randomBytes } from 'node:crypto'
import { config, isAdminEmail } from './config.js'
import { q, one, tx } from './db.js'
import { encrypt, decrypt, cardNumberHash, newToken, sha256 } from './secrets.js'
import { sendMagicLink, sendDepositHelpRequest } from './email.js'
import { seedBrands, demoInventory, makeCardNumber, makePin } from './seed.js'
import { allocateEvmAddress, confirmDeposits, ingestAlchemy, verifyAlchemySignature } from './deposits.js'
import { EVM_NETWORKS, enabledEvmNetworks, evmEnabled } from './chains/evm.js'
import { notifyUser, notifyAdmins, messages, pushEnabled } from './push.js'

const app = express()
app.disable('x-powered-by')

// ---------- coins (demo rates until real deposits land) ----------
const COINS = {
  USDC: { name: 'USD Coin', network: 'Ethereum (ERC-20)', usd: 1, decimals: 2 },
  USDT: { name: 'Tether', network: 'Tron (TRC-20)', usd: 1, decimals: 2 },
  BTC: { name: 'Bitcoin', network: 'Bitcoin', usd: 91250, decimals: 6 },
  ETH: { name: 'Ether', network: 'Ethereum', usd: 3180, decimals: 5 },
  SOL: { name: 'Solana', network: 'Solana', usd: 142, decimals: 3 },
}
const CONFIRM_SECONDS = 6
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const b58 = (n) => Array.from(randomBytes(n), (x) => B58[x % 58]).join('')
const BECH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const bech = (n) => Array.from(randomBytes(n), (x) => BECH[x % 32]).join('')
// DEMO SAFETY: each address contains characters its format forbids, so no
// real wallet will send to it.
function demoWallets() {
  const evm = '0xDEMO' + randomBytes(18).toString('hex')
  return { USDC: evm, ETH: evm, USDT: 'TDEMO0' + b58(28), BTC: 'bc1qdemo' + bech(34), SOL: 'DEMO0' + b58(39) }
}

// ---------- helpers ----------
class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message)
}
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const priceFor = (sellDiscount, face) => Math.round(face * (1 - Number(sellDiscount)))
const audit = (client, actor, action, detail = {}) =>
  client.query('INSERT INTO audit_log (actor, action, detail) VALUES ($1, $2, $3)', [actor, action, detail])

// ---------- one-time seed ----------
let seeded
function ensureSeed() {
  seeded ??= (async () => {
    const { n } = await one('SELECT count(*)::int AS n FROM brands')
    if (n > 0) return
    await tx(async (c) => {
      const brands = seedBrands()
      for (const b of brands) {
        await c.query(
          `INSERT INTO brands (id, name, category, color, tagline, buy_discount, sell_discount, locations)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
          [b.id, b.name, b.category, b.color, b.tagline, b.buyDiscount, b.sellDiscount, JSON.stringify(b.locations)],
        )
      }
      if (config.demoMode) await insertDemoInventory(c, brands)
    })
  })().catch((err) => {
    seeded = undefined
    throw err
  })
  return seeded
}
async function insertDemoInventory(c, brands) {
  for (const card of demoInventory(brands)) {
    await c.query(
      `INSERT INTO gift_cards (brand_id, face_cents, cost_cents, number_enc, number_hash, last4, pin_enc, added_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'demo-seed') ON CONFLICT DO NOTHING`,
      [card.brand.id, card.face, Math.round(card.face * (1 - card.brand.buyDiscount)), encrypt(card.number), cardNumberHash(card.number), card.number.slice(-4), encrypt(card.pin)],
    )
  }
}

// ---------- middleware ----------
// If a request arrives under the function's internal URL, put /api back.
app.use((req, _res, next) => {
  if (req.url.startsWith('/.netlify/functions/api')) req.url = '/api' + req.url.slice('/.netlify/functions/api'.length)
  next()
})
// Keep the raw body: webhook signatures are computed over the exact bytes.
app.use(express.json({ limit: '512kb', verify: (req, _res, buf) => (req.rawBody = buf) }))

// CSRF: state-changing requests must be JSON. Browsers can't send a
// cross-site JSON POST with cookies without a CORS preflight we never allow.
app.use('/api', (req, _res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.is('application/json')) return next(new HttpError(415, 'Send JSON.'))
  next()
})
app.use('/api', (_req, res, next) => {
  res.set('cache-control', 'no-store')
  ensureSeed().then(() => next(), next)
})

// ---------- sessions ----------
const COOKIE = 'ft_session'
const SESSION_DAYS = 30
const secureCookies = config.appUrl.startsWith('https://')

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}
function setSessionCookie(res, value, maxAgeSeconds) {
  res.append('set-cookie', `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureCookies ? '; Secure' : ''}`)
}

async function loadUser(req) {
  if (req.user !== undefined) return req.user
  const token = readCookie(req, COOKIE)
  req.user = token
    ? await one(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id_hash = $1 AND s.expires_at > now()`,
        [sha256(token)],
      )
    : null
  return req.user
}
async function requireUser(req) {
  const user = await loadUser(req)
  if (!user) fail(401, 'Please sign in.')
  return user
}
async function requireAdmin(req) {
  const user = await requireUser(req)
  if (!isAdminEmail(user.email)) fail(403, 'Admins only.')
  return user
}

// ---------- public config ----------
app.get('/api/config', (_req, res) => res.json({ demoMode: config.demoMode, pushPublicKey: pushEnabled() ? config.push.publicKey : null }))

// ---------- push notifications ----------
// Subscriptions are URLs our server will POST to, so only real browser push
// services are accepted (no server-side request forgery via a fake endpoint).
const PUSH_HOSTS = ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com']
function validPushEndpoint(raw) {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))
  } catch {
    return false
  }
}

app.post('/api/push/subscribe', async (req, res) => {
  const user = await requireUser(req)
  if (!pushEnabled()) fail(503, 'Notifications aren’t set up yet.')
  const sub = req.body?.subscription
  const endpoint = str(sub?.endpoint, 1000)
  const p256dh = str(sub?.keys?.p256dh, 200)
  const auth = str(sub?.keys?.auth, 100)
  if (!validPushEndpoint(endpoint) || !p256dh || !auth) fail(400, 'That notification subscription isn’t valid.')
  // Keep at most 10 devices per account: drop the oldest.
  const { n } = await one('SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id = $1', [user.id])
  if (n >= 10) await q('DELETE FROM push_subscriptions WHERE id IN (SELECT id FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at LIMIT 1)', [user.id])
  // A device that signs into another account moves to that account.
  await q(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent`,
    [user.id, endpoint, p256dh, auth, str(req.get('user-agent'), 300)],
  )
  res.json({ ok: true })
})

app.post('/api/push/unsubscribe', async (req, res) => {
  const user = await requireUser(req)
  await q('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [user.id, str(req.body?.endpoint, 1000)])
  res.json({ ok: true })
})

app.post('/api/push/test', async (req, res) => {
  const user = await requireUser(req)
  const sent = await notifyUser(user.id, { title: 'Notifications are on', body: 'We’ll let you know when your crypto arrives.', url: '/app', tag: 'test' })
  if (!sent) fail(409, 'No device to notify yet. Turn notifications on first.')
  res.json({ ok: true, sent })
})

// ---------- chain webhooks ----------
// Alchemy Address Activity. Unsigned or mis-signed calls are rejected; a
// 500 makes Alchemy retry, so only answer 200 once the rows are saved.
app.post('/api/webhooks/alchemy', async (req, res) => {
  const network = verifyAlchemySignature(req.rawBody, req.get('x-alchemy-signature'), req.body?.webhookId)
  if (!network) fail(401, 'Bad signature.')
  const { recorded } = await ingestAlchemy(network, req.body)
  res.json({ ok: true, recorded })
})

// ---------- auth: magic links ----------
app.post('/api/auth/request', async (req, res) => {
  const email = str(req.body?.email, 254).toLowerCase()
  if (!EMAIL_RE.test(email)) fail(400, 'That email doesn’t look right.')
  const ip = String(req.headers['x-nf-client-connection-ip'] || req.ip || '').slice(0, 64)
  const { by_email, by_ip } = await one(
    `SELECT count(*) FILTER (WHERE email = $1)::int AS by_email, count(*) FILTER (WHERE ip = $2)::int AS by_ip
     FROM login_tokens WHERE created_at > now() - interval '15 minutes' AND (email = $1 OR ip = $2)`,
    [email, ip],
  )
  if (by_email >= 3 || by_ip >= 10) fail(429, 'Too many sign-in emails. Please wait a few minutes and try again.')
  const token = newToken()
  await q(`INSERT INTO login_tokens (token_hash, email, ip, expires_at) VALUES ($1, $2, $3, now() + interval '15 minutes')`, [sha256(token), email, ip])
  await sendMagicLink(email, `${config.appUrl}/app/verify?token=${encodeURIComponent(token)}`)
  res.json({ ok: true })
})

// The emailed link opens a page that POSTs the token here, so link scanners
// that only GET the URL can't burn the single-use token.
app.post('/api/auth/verify', async (req, res) => {
  const token = str(req.body?.token, 200)
  if (!token) fail(400, 'Missing sign-in token.')
  const session = newToken()
  const user = await tx(async (c) => {
    const claimed = (
      await c.query(
        `UPDATE login_tokens SET used_at = now()
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING email`,
        [sha256(token)],
      )
    ).rows[0]
    if (!claimed) fail(400, 'This sign-in link has expired or was already used. Request a new one.')
    const u = (
      await c.query(
        `INSERT INTO users (email, demo_wallets) VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING *`,
        [claimed.email, config.demoMode ? demoWallets() : null],
      )
    ).rows[0]
    await c.query(`INSERT INTO sessions (id_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`, [sha256(session), u.id, SESSION_DAYS])
    return u
  })
  setSessionCookie(res, session, SESSION_DAYS * 86400)
  res.json(await meView(user))
})

app.post('/api/auth/logout', async (req, res) => {
  const token = readCookie(req, COOKIE)
  if (token) await q('DELETE FROM sessions WHERE id_hash = $1', [sha256(token)])
  setSessionCookie(res, '', 0)
  res.json({ ok: true })
})

// ---------- account ----------
async function settleDemoDeposits(userId) {
  // Atomic: mark matured deposits complete, write their ledger rows, credit the balance.
  await q(
    `WITH done AS (
       UPDATE deposits SET status = 'complete', completed_at = now()
       WHERE user_id = $1 AND status = 'confirming' AND block_number IS NULL AND tx_ref LIKE 'demo-%'
         AND created_at < now() - make_interval(secs => $2)
       RETURNING id, user_id, usd_cents
     ), led AS (
       INSERT INTO ledger (user_id, amount_cents, kind, ref)
       SELECT user_id, usd_cents, 'deposit', id::text FROM done RETURNING amount_cents
     )
     UPDATE users SET balance_cents = balance_cents + COALESCE((SELECT sum(amount_cents) FROM led), 0) WHERE id = $1`,
    [userId, CONFIRM_SECONDS],
  )
}

function cardView(c) {
  return {
    id: c.id,
    brand: { id: c.brand_id, name: c.brand_name, color: c.brand_color, category: c.brand_category },
    faceValue: c.face_cents,
    paid: c.sale_cents,
    balance: c.balance_cents,
    last4: c.last4,
    barcodeFormat: c.barcode_format,
    hasPin: !!c.pin_enc,
    hasEgiftUrl: !!c.egift_url_enc,
    expiresOn: c.expires_on,
    purchasedAt: c.sold_at,
  }
}

const NETWORK_LABEL = Object.fromEntries(Object.entries(EVM_NETWORKS).map(([k, v]) => [k, v.label]))
const COIN_NAMES = { USDC: 'USD Coin', USDT: 'Tether', ETH: 'Ether', BNB: 'BNB', BTC: 'Bitcoin', SOL: 'Solana' }

// Deposit options for the user: real EVM addresses when configured,
// otherwise demo addresses in DEMO_MODE, otherwise none yet.
async function walletsFor(u) {
  if (evmEnabled()) {
    const address = await allocateEvmAddress(u.id)
    const byCoin = new Map()
    for (const key of enabledEvmNetworks()) {
      const net = EVM_NETWORKS[key]
      for (const coin of [net.native.coin, ...Object.values(net.tokens).map((t) => t.coin)]) {
        if (!byCoin.has(coin)) byCoin.set(coin, { coin, name: COIN_NAMES[coin] ?? coin, networks: [] })
        const minUsd = config.evm.minUsd[key] ?? 0
        byCoin.get(coin).networks.push({ key, label: net.label, address, minUsd, suggestUsd: minUsd ? minUsd + net.sendBufferUsd : 0, confirmations: net.confirmations })
      }
    }
    const order = ['USDC', 'USDT', 'ETH', 'BNB']
    return [...byCoin.values()].sort((a, b) => order.indexOf(a.coin) - order.indexOf(b.coin))
  }
  if (u.demo_wallets) {
    return Object.entries(u.demo_wallets).map(([coin, address]) => ({
      coin,
      name: COINS[coin].name,
      demo: true,
      networks: [{ key: 'demo', label: COINS[coin].network, address, minUsd: 0, confirmations: 0 }],
    }))
  }
  return []
}

// Plain-language status for a deposit that isn't (yet) in the balance.
function depositStatusText(d) {
  const on = NETWORK_LABEL[d.network] ? ` on ${NETWORK_LABEL[d.network]}` : ''
  if (d.status === 'confirming') return 'Confirming…'
  if (d.status === 'held') return `Pending review — below the${d.note?.match(/\$\d+/) ? ` ${d.note.match(/\$\d+/)[0]}` : ''} minimum${on}`
  if (d.status === 'reverted') return 'Didn’t go through'
  if (d.status === 'ignored') return 'Unsupported coin — tap for help'
  return ''
}
const NEEDS_HELP = new Set(['held', 'ignored', 'reverted'])
const explorerUrl = (d) => (EVM_NETWORKS[d.network] ? EVM_NETWORKS[d.network].explorer + d.tx_ref.split(':')[0] : null)

async function meView(user) {
  if (config.demoMode) await settleDemoDeposits(user.id)
  // While a user waits on a real deposit, check its confirmations now rather
  // than waiting for the scheduled sync.
  const waiting = await one(`SELECT 1 FROM deposits WHERE user_id = $1 AND status = 'confirming' AND block_number IS NOT NULL LIMIT 1`, [user.id])
  if (waiting) await confirmDeposits({ userId: user.id })
  const [u, deposits, cards] = await Promise.all([
    one('SELECT * FROM users WHERE id = $1', [user.id]),
    q('SELECT * FROM deposits WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30', [user.id]),
    q(
      `SELECT g.*, b.name AS brand_name, b.color AS brand_color, b.category AS brand_category
       FROM gift_cards g JOIN brands b ON b.id = g.brand_id
       WHERE g.sold_to = $1 ORDER BY g.sold_at DESC LIMIT 200`,
      [user.id],
    ),
  ])
  const histories = cards.rows.length
    ? (
        await q(
          `SELECT card_id, balance_cents, note, created_at FROM card_balance_events
           WHERE card_id = ANY($1) ORDER BY created_at`,
          [cards.rows.map((c) => c.id)],
        )
      ).rows
    : []
  const activity = [
    ...deposits.rows.map((d) => ({
      id: d.id,
      type: 'deposit',
      status: d.status,
      at: d.created_at,
      // An unsupported token's symbol is whatever its contract claims; don't echo it.
      title: d.status === 'ignored' ? 'Unsupported token received' : `Added ${d.coin}`,
      detail: d.status === 'complete' ? `${Number(d.amount)} ${d.coin}${NETWORK_LABEL[d.network] ? ` on ${NETWORK_LABEL[d.network]}` : ''}` : depositStatusText(d),
      needsHelp: NEEDS_HELP.has(d.status),
      supportRequested: !!d.support_requested_at,
      cents: d.status === 'complete' ? Number(d.usd_cents) : 0,
    })),
    ...cards.rows.map((c) => ({
      id: c.id,
      type: 'purchase',
      status: 'complete',
      at: c.sold_at,
      title: `${c.brand_name} gift card`,
      detail: `$${(c.face_cents / 100).toFixed(0)} card · saved $${((c.face_cents - c.sale_cents) / 100).toFixed(2)}`,
      cents: -c.sale_cents,
    })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 30)

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    isAdmin: isAdminEmail(u.email),
    balance: Number(u.balance_cents),
    // Received but not credited: shown on the balance card so a customer
    // never sees $0 with no explanation after sending money.
    held: deposits.rows
      .filter((d) => d.status === 'held')
      .map((d) => ({
        id: d.id,
        coin: d.coin,
        amount: Number(d.amount),
        network: NETWORK_LABEL[d.network] ?? d.network,
        usdCents: d.usd_cents == null ? null : Number(d.usd_cents),
        minUsd: config.evm.minUsd[d.network] ?? null,
        supportRequested: !!d.support_requested_at,
        createdAt: d.created_at,
      })),
    pending: deposits.rows
      .filter((d) => d.status === 'confirming')
      .map((d) => ({
        id: d.id,
        coin: d.coin,
        amount: Number(d.amount),
        network: NETWORK_LABEL[d.network] ?? null,
        usdCents: d.usd_cents == null ? null : Number(d.usd_cents),
        createdAt: d.created_at,
        // Real deposits report block confirmations; demo ones a timer.
        confirmations: d.confirmations,
        required: d.required_confirmations,
        confirmMs: d.required_confirmations ? null : CONFIRM_SECONDS * 1000,
      })),
    wallets: await walletsFor(u),
    cards: cards.rows.map((c) => ({
      ...cardView(c),
      balanceHistory: histories.filter((h) => h.card_id === c.id).map((h) => ({ at: h.created_at, balance: h.balance_cents, note: h.note })),
    })),
    saved: cards.rows.reduce((s, c) => s + (c.face_cents - c.sale_cents), 0),
    activity,
  }
}

app.get('/api/me', async (req, res) => {
  res.json(await meView(await requireUser(req)))
})

app.post('/api/me', async (req, res) => {
  const user = await requireUser(req)
  const name = str(req.body?.name, 40)
  if (!name) fail(400, 'Tell us your name.')
  await q('UPDATE users SET name = $2 WHERE id = $1', [user.id, name])
  res.json(await meView(user))
})

// Simulated deposits (DEMO_MODE only). Real deposits will arrive via chain webhooks.
app.post('/api/deposits/simulate', async (req, res) => {
  if (!config.demoMode) fail(404, 'Not found.')
  const user = await requireUser(req)
  const coin = str(req.body?.coin, 8)
  const usd = Number(req.body?.usd)
  if (!COINS[coin]) fail(400, 'Unknown coin.')
  if (!Number.isFinite(usd) || usd < 5 || usd > 5000) fail(400, 'Pick an amount between $5 and $5,000.')
  const { usd: rate, decimals, network } = COINS[coin]
  const amount = +(usd / rate).toFixed(decimals)
  await q(
    `INSERT INTO deposits (user_id, coin, network, amount, rate_usd, usd_cents, tx_ref)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [user.id, coin, network, amount, rate, Math.round(amount * rate * 100), `demo-${newToken()}`],
  )
  res.json(await meView(user))
})

// A customer asks for help with a held / unsupported / failed deposit.
// One email per deposit: the request is claimed atomically before sending,
// and released again if the email fails.
app.post('/api/deposits/:id/help', async (req, res) => {
  const user = await requireUser(req)
  const message = str(req.body?.message, 1000)
  const id = str(req.params.id, 40)
  const d = await one(`SELECT * FROM deposits WHERE id = $1 AND user_id = $2`, [id, user.id])
  if (!d || !NEEDS_HELP.has(d.status)) fail(404, 'Deposit not found.')
  if (d.support_requested_at) return res.json({ ok: true, already: true })
  const claimed = await q(
    `UPDATE deposits SET support_requested_at = now(), support_message = $3 WHERE id = $1 AND user_id = $2 AND support_requested_at IS NULL`,
    [id, user.id, message || null],
  )
  if (!claimed.rowCount) return res.json({ ok: true, already: true })
  try {
    await sendDepositHelpRequest({
      user,
      deposit: {
        coin: d.coin,
        amount: Number(d.amount),
        networkLabel: NETWORK_LABEL[d.network] ?? d.network,
        usdCents: d.usd_cents == null ? null : Number(d.usd_cents),
        txRef: d.tx_ref,
        createdAt: d.created_at,
      },
      reason: depositStatusText(d),
      message,
      explorerUrl: explorerUrl(d),
      adminUrl: `${config.appUrl}/admin/deposits`,
    })
  } catch (err) {
    await q(`UPDATE deposits SET support_requested_at = NULL, support_message = NULL WHERE id = $1`, [id])
    throw err
  }
  await notifyAdmins(messages.adminHelp({ id, email: user.email, coin: d.coin }))
  res.json({ ok: true })
})

// ---------- stores ----------
app.get('/api/stores', async (req, res) => {
  const qs = str(req.query.q, 60).toLowerCase().replace(/[%_\\]/g, '')
  const category = str(req.query.category, 40)
  const lat = Number(req.query.lat)
  const { rows } = await q(
    `SELECT b.*, s.face_cents, s.n
     FROM brands b
     LEFT JOIN (
       SELECT brand_id, face_cents, count(*)::int AS n FROM gift_cards
       WHERE status = 'available' AND (expires_on IS NULL OR expires_on > current_date)
       GROUP BY brand_id, face_cents
     ) s ON s.brand_id = b.id
     WHERE b.active
       AND ($1 = '' OR b.category = $1)
       AND ($2 = '' OR lower(b.name || ' ' || b.category || ' ' || b.tagline) LIKE '%' || $2 || '%')
     ORDER BY b.name, s.face_cents`,
    [category, qs],
  )
  const byBrand = new Map()
  for (const r of rows) {
    if (!byBrand.has(r.id)) {
      // Store locations are demo data; production shows none until real ones exist.
      const locations = config.demoMode
        ? r.locations
            .map((l) => ({
              address: l.address,
              miles: +Math.hypot(l.dLat * 69, l.dLng * 69 * Math.cos(((Number.isFinite(lat) ? lat : 39.74) * Math.PI) / 180)).toFixed(1),
            }))
            .sort((a, z) => a.miles - z.miles)
        : []
      byBrand.set(r.id, {
        id: r.id,
        name: r.name,
        category: r.category,
        color: r.color,
        tagline: r.tagline,
        discount: Number(r.sell_discount),
        denominations: [],
        nearest: locations[0]?.miles ?? null,
        locations,
      })
    }
    if (r.face_cents) byBrand.get(r.id).denominations.push({ faceValue: r.face_cents, price: priceFor(r.sell_discount, r.face_cents), inStock: r.n })
  }
  const stores = [...byBrand.values()]
  if (config.demoMode) stores.sort((a, z) => (a.nearest ?? 99) - (z.nearest ?? 99))
  const categories = (await q('SELECT DISTINCT category FROM brands WHERE active ORDER BY category')).rows.map((r) => r.category)
  res.json({ stores, categories })
})

app.post('/api/purchase', async (req, res) => {
  const user = await requireUser(req)
  if (config.demoMode) await settleDemoDeposits(user.id)
  const storeId = str(req.body?.storeId, 60)
  const faceValue = Number(req.body?.faceValue)
  if (!Number.isInteger(faceValue)) fail(400, 'Pick an amount.')
  const card = await tx(async (c) => {
    const brand = (await c.query('SELECT * FROM brands WHERE id = $1 AND active FOR SHARE', [storeId])).rows[0]
    if (!brand) fail(404, 'Store not found.')
    const price = priceFor(brand.sell_discount, faceValue)
    // Claim one card; SKIP LOCKED lets parallel buyers take different cards.
    const picked = (
      await c.query(
        `SELECT id FROM gift_cards
         WHERE brand_id = $1 AND face_cents = $2 AND status = 'available'
           AND (expires_on IS NULL OR expires_on > current_date)
         ORDER BY expires_on NULLS LAST, added_at LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [brand.id, faceValue],
      )
    ).rows[0]
    if (!picked) fail(409, 'That card just sold out. Try another amount.')
    // Guarded debit: never goes below zero, even with concurrent purchases.
    const debited = await c.query('UPDATE users SET balance_cents = balance_cents - $2 WHERE id = $1 AND balance_cents >= $2', [user.id, price])
    if (!debited.rowCount) fail(402, 'Not enough in your wallet yet.')
    const sold = (
      await c.query(
        `UPDATE gift_cards SET status = 'sold', sold_to = $2, sold_at = now(), sale_cents = $3, balance_cents = face_cents
         WHERE id = $1 RETURNING *`,
        [picked.id, user.id, price],
      )
    ).rows[0]
    await c.query('INSERT INTO ledger (user_id, amount_cents, kind, ref) VALUES ($1, $2, $3, $4)', [user.id, -price, 'purchase', sold.id])
    await c.query(`INSERT INTO card_balance_events (card_id, balance_cents, note) VALUES ($1, $2, 'Purchased')`, [sold.id, sold.face_cents])
    return { ...sold, brand_name: brand.name, brand_color: brand.color, brand_category: brand.category }
  })
  res.json({ card: cardView(card), me: await meView(user) })
})

// ---------- owned cards ----------
// Secrets only leave the server one card at a time, to its owner.
app.get('/api/cards/:id/secret', async (req, res) => {
  const user = await requireUser(req)
  const c = await one('SELECT number_enc, pin_enc, egift_url_enc, barcode_format FROM gift_cards WHERE id = $1 AND sold_to = $2', [str(req.params.id, 40), user.id])
  if (!c) fail(404, 'Card not found.')
  res.json({ number: decrypt(c.number_enc), pin: decrypt(c.pin_enc), egiftUrl: decrypt(c.egift_url_enc), barcodeFormat: c.barcode_format })
})

app.post('/api/cards/:id/balance', async (req, res) => {
  const user = await requireUser(req)
  const id = str(req.params.id, 40)
  const cents = Math.round(Number(req.body?.balance) * 100)
  await tx(async (c) => {
    const card = (await c.query('SELECT face_cents FROM gift_cards WHERE id = $1 AND sold_to = $2 FOR UPDATE', [id, user.id])).rows[0]
    if (!card) fail(404, 'Card not found.')
    if (!Number.isFinite(cents) || cents < 0 || cents > card.face_cents) fail(400, `Enter an amount from $0 to $${(card.face_cents / 100).toFixed(2)}.`)
    await c.query('UPDATE gift_cards SET balance_cents = $2 WHERE id = $1', [id, cents])
    await c.query(`INSERT INTO card_balance_events (card_id, balance_cents, note) VALUES ($1, $2, 'Updated by you')`, [id, cents])
  })
  res.json(await meView(user))
})

// ---------- admin (every route below requires an ADMIN_EMAILS account) ----------
app.use('/api/admin', (req, _res, next) => {
  requireAdmin(req).then((admin) => {
    req.admin = admin
    next()
  }, next)
})

app.get('/api/admin/overview', async (_req, res) => {
  const [inv, sales, customers, deposits, low, recent] = await Promise.all([
    one(`SELECT count(*)::int AS count, COALESCE(sum(face_cents),0)::bigint AS face, COALESCE(sum(cost_cents),0)::bigint AS cost FROM gift_cards WHERE status = 'available'`),
    one(`SELECT count(*)::int AS count, COALESCE(sum(sale_cents),0)::bigint AS revenue, COALESCE(sum(cost_cents),0)::bigint AS cost, COALESCE(sum(face_cents),0)::bigint AS face FROM gift_cards WHERE status = 'sold'`),
    one('SELECT count(*)::int AS count, COALESCE(sum(balance_cents),0)::bigint AS balances FROM users'),
    one(`SELECT count(*)::int AS count, COALESCE(sum(usd_cents) FILTER (WHERE status = 'complete'),0)::bigint AS usd, count(*) FILTER (WHERE status IN ('held', 'ignored'))::int AS review FROM deposits`),
    q(`SELECT b.id, b.name, b.color, count(g.id)::int AS count FROM brands b
       LEFT JOIN gift_cards g ON g.brand_id = b.id AND g.status = 'available'
       WHERE b.active GROUP BY b.id HAVING count(g.id) < 6 ORDER BY count(g.id), b.name`),
    q(`SELECT g.id, g.face_cents, g.cost_cents, g.sale_cents, g.sold_at, b.name AS brand_name, b.color AS brand_color, u.email, u.name
       FROM gift_cards g JOIN brands b ON b.id = g.brand_id JOIN users u ON u.id = g.sold_to
       WHERE g.status = 'sold' ORDER BY g.sold_at DESC LIMIT 8`),
  ])
  const n = Number
  res.json({
    inventory: { count: inv.count, faceValue: n(inv.face), cost: n(inv.cost) },
    sales: { count: sales.count, revenue: n(sales.revenue), cost: n(sales.cost), profit: n(sales.revenue) - n(sales.cost), faceValue: n(sales.face) },
    customers: { count: customers.count, balances: n(customers.balances) },
    deposits: { count: deposits.count, usd: n(deposits.usd), needsReview: deposits.review },
    lowStock: low.rows,
    recentSales: recent.rows.map((r) => ({
      id: r.id,
      brandName: r.brand_name,
      brandColor: r.brand_color,
      faceValue: r.face_cents,
      cost: r.cost_cents,
      salePrice: r.sale_cents,
      soldAt: r.sold_at,
      soldToName: `${r.name || 'No name'} (${r.email})`,
    })),
  })
})

// Inventory list never includes card numbers, PINs or links — only last 4.
app.get('/api/admin/inventory', async (req, res) => {
  const status = str(req.query.status, 20)
  const brandId = str(req.query.brandId, 60)
  const { rows } = await q(
    `SELECT g.id, g.face_cents, g.cost_cents, g.sale_cents, g.last4, g.barcode_format, g.expires_on,
            g.status, g.added_at, g.sold_at, b.name AS brand_name, b.color AS brand_color, b.sell_discount, u.email AS sold_to_email
     FROM gift_cards g JOIN brands b ON b.id = g.brand_id LEFT JOIN users u ON u.id = g.sold_to
     WHERE ($1 = '' OR g.status = $1) AND ($2 = '' OR g.brand_id = $2) AND ($1 <> '' OR g.status <> 'void')
     ORDER BY g.added_at DESC LIMIT 500`,
    [status, brandId],
  )
  res.json(
    rows.map((r) => ({
      id: r.id,
      brandName: r.brand_name,
      brandColor: r.brand_color,
      faceValue: r.face_cents,
      cost: r.cost_cents,
      salePrice: r.sale_cents,
      listPrice: priceFor(r.sell_discount, r.face_cents),
      last4: r.last4,
      barcodeFormat: r.barcode_format,
      expiresOn: r.expires_on,
      status: r.status,
      addedAt: r.added_at,
      soldAt: r.sold_at,
      soldToName: r.sold_to_email,
    })),
  )
})

const FORMATS = ['CODE128', 'CODE39', 'EAN13', 'UPC', 'QR', 'NONE']
// Add a batch of real cards. One line per card: number, PIN, e-gift URL
// (PIN and URL optional). All-or-nothing: a duplicate aborts the batch.
app.post('/api/admin/inventory', async (req, res) => {
  const brandId = str(req.body?.brandId, 60)
  const face = Math.round(Number(req.body?.faceValue) * 100)
  const cost = Math.round(Number(req.body?.cost) * 100)
  const format = FORMATS.includes(req.body?.barcodeFormat) ? req.body.barcodeFormat : 'CODE128'
  const expiresOn = str(req.body?.expiresOn, 10) || null
  if (expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) fail(400, 'Expiry must be a date.')
  if (!Number.isFinite(face) || face < 100 || face > 100000) fail(400, 'Face value must be $1–$1,000.')
  if (!Number.isFinite(cost) || cost <= 0 || cost > face) fail(400, 'Cost must be above $0 and no more than face value.')
  let lines = str(req.body?.cards, 40000)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length && config.demoMode && req.body?.generate) lines = [`${makeCardNumber()}, ${makePin()}`]
  if (!lines.length) fail(400, 'Add at least one card.')
  if (lines.length > 200) fail(400, 'Up to 200 cards at a time.')

  const parsed = lines.map((line) => {
    const [num = '', pin = '', url = ''] = line.split(/\s*[,\t;]\s*/)
    const number = num.replace(/\s+/g, '')
    if (!/^[0-9A-Za-z-]{6,40}$/.test(number)) fail(400, `Card number looks wrong: “${line.slice(0, 40)}”`)
    if (pin && !/^[0-9A-Za-z-]{1,16}$/.test(pin)) fail(400, `PIN looks wrong on: “${line.slice(0, 40)}”`)
    if (url && !/^https:\/\/\S{4,500}$/.test(url)) fail(400, `E-gift links must start with https:// (“${line.slice(0, 40)}”)`)
    return { number, pin, url }
  })
  const added = await tx(async (c) => {
    const brand = (await c.query('SELECT id FROM brands WHERE id = $1', [brandId])).rows[0]
    if (!brand) fail(400, 'Choose a brand.')
    for (const p of parsed) {
      const r = await c.query(
        `INSERT INTO gift_cards (brand_id, face_cents, cost_cents, number_enc, number_hash, last4, pin_enc, egift_url_enc, barcode_format, expires_on, added_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (brand_id, number_hash) DO NOTHING`,
        [brandId, face, cost, encrypt(p.number), cardNumberHash(p.number), p.number.slice(-4), encrypt(p.pin), encrypt(p.url), format, expiresOn, req.admin.email],
      )
      if (!r.rowCount) fail(409, `Already in inventory: card ending ${p.number.slice(-4)}. Nothing was added.`)
    }
    await audit(c, req.admin.email, 'inventory.add', { brandId, face, cost, count: parsed.length })
    return parsed.length
  })
  res.json({ added })
})

app.delete('/api/admin/inventory/:id', async (req, res) => {
  await tx(async (c) => {
    const r = await c.query(`UPDATE gift_cards SET status = 'void' WHERE id = $1 AND status = 'available' RETURNING id, last4`, [str(req.params.id, 40)])
    if (!r.rowCount) fail(409, 'Only unsold cards can be removed.')
    await audit(c, req.admin.email, 'inventory.void', { id: r.rows[0].id, last4: r.rows[0].last4 })
  })
  res.json({ ok: true })
})

app.get('/api/admin/brands', async (_req, res) => {
  const { rows } = await q(
    `SELECT b.*, count(g.id) FILTER (WHERE g.status = 'available')::int AS available,
            count(g.id) FILTER (WHERE g.status = 'sold')::int AS sold
     FROM brands b LEFT JOIN gift_cards g ON g.brand_id = b.id GROUP BY b.id ORDER BY b.name`,
  )
  res.json(
    rows.map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      color: b.color,
      tagline: b.tagline,
      active: b.active,
      buyDiscount: Number(b.buy_discount),
      sellDiscount: Number(b.sell_discount),
      available: b.available,
      sold: b.sold,
    })),
  )
})

app.post('/api/admin/brands', async (req, res) => {
  const name = str(req.body?.name, 60)
  if (!name) fail(400, 'Name is required.')
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  if (!id) fail(400, 'Use letters or numbers in the name.')
  const color = /^#[0-9a-fA-F]{6}$/.test(req.body?.color) ? req.body.color : '#111111'
  await tx(async (c) => {
    const r = await c.query(`INSERT INTO brands (id, name, category, color, tagline) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`, [
      id,
      name,
      str(req.body?.category, 40) || 'Restaurants',
      color,
      str(req.body?.tagline, 80),
    ])
    if (!r.rowCount) fail(409, 'That brand already exists.')
    await audit(c, req.admin.email, 'brand.create', { id })
  })
  res.json({ id })
})

app.put('/api/admin/brands/:id', async (req, res) => {
  const pct = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) < 90 ? Number(v) / 100 : null)
  await tx(async (c) => {
    const b = (await c.query('SELECT * FROM brands WHERE id = $1 FOR UPDATE', [str(req.params.id, 60)])).rows[0]
    if (!b) fail(404, 'Not found.')
    const buy = req.body?.buyDiscount !== undefined ? pct(req.body.buyDiscount) : Number(b.buy_discount)
    const sell = req.body?.sellDiscount !== undefined ? pct(req.body.sellDiscount) : Number(b.sell_discount)
    if (buy === null || sell === null) fail(400, 'Discounts must be 0–90%.')
    if (sell > buy) fail(400, 'Customer discount can’t be bigger than what we buy at — we’d lose money.')
    const active = typeof req.body?.active === 'boolean' ? req.body.active : b.active
    await c.query('UPDATE brands SET buy_discount = $2, sell_discount = $3, active = $4 WHERE id = $1', [b.id, buy, sell, active])
    await audit(c, req.admin.email, 'brand.update', { id: b.id, buy, sell, active })
  })
  res.json({ ok: true })
})

// Deposits needing attention first (held, unsupported), newest first.
app.get('/api/admin/deposits', async (req, res) => {
  const status = str(req.query.status, 20)
  const { rows } = await q(
    `SELECT d.*, u.email, u.name FROM deposits d JOIN users u ON u.id = d.user_id
     WHERE ($1 = '' OR d.status = $1) AND ($1 <> '' OR d.tx_ref NOT LIKE 'demo-%')
     ORDER BY (d.status IN ('held', 'ignored')) DESC, d.created_at DESC LIMIT 300`,
    [status],
  )
  res.json(
    rows.map((d) => ({
      id: d.id,
      status: d.status,
      // An unsupported token's symbol and our placeholder amount mean nothing;
      // show its contract instead.
      coin: d.status === 'ignored' ? 'Unknown token' : d.coin,
      amount: d.status === 'ignored' ? null : Number(d.amount),
      contract: d.status === 'ignored' ? d.asset : null,
      network: NETWORK_LABEL[d.network] ?? d.network,
      usdCents: d.usd_cents == null ? null : Number(d.usd_cents),
      note: d.note,
      customer: `${d.name || 'No name yet'} (${d.email})`,
      createdAt: d.created_at,
      completedAt: d.completed_at,
      creditedBy: d.credited_by,
      supportRequestedAt: d.support_requested_at,
      supportMessage: d.support_message,
      explorerUrl: explorerUrl(d),
    })),
  )
})

// Credit a held deposit at the USD value it was priced at when confirmed.
// Status-guarded, so a deposit can only ever be credited once.
app.post('/api/admin/deposits/:id/credit', async (req, res) => {
  const id = str(req.params.id, 40)
  const credited = await tx(async (c) => {
    const r = await c.query(
      `UPDATE deposits SET status = 'complete', completed_at = now(), credited_by = $2
       WHERE id = $1 AND status = 'held' AND usd_cents > 0 RETURNING id, user_id, usd_cents`,
      [id, req.admin.email],
    )
    if (!r.rowCount) fail(409, 'Only held deposits with a dollar value can be credited.')
    const d = r.rows[0]
    await c.query(`INSERT INTO ledger (user_id, amount_cents, kind, ref) VALUES ($1, $2, 'deposit', $3)`, [d.user_id, d.usd_cents, d.id])
    await c.query(`UPDATE users SET balance_cents = balance_cents + $2 WHERE id = $1`, [d.user_id, d.usd_cents])
    await audit(c, req.admin.email, 'deposit.credit_held', { id: d.id, usdCents: Number(d.usd_cents) })
    return { cents: Number(d.usd_cents), userId: d.user_id }
  })
  await notifyUser(credited.userId, messages.depositApproved({ id, usdCents: credited.cents }))
  res.json({ ok: true, credited: credited.cents })
})

app.get('/api/admin/customers', async (_req, res) => {
  const { rows } = await q(
    `SELECT u.id, u.name, u.email, u.balance_cents, u.created_at,
            (SELECT count(*)::int FROM gift_cards g WHERE g.sold_to = u.id) AS cards,
            (SELECT COALESCE(sum(sale_cents),0)::bigint FROM gift_cards g WHERE g.sold_to = u.id) AS spent,
            (SELECT COALESCE(sum(usd_cents),0)::bigint FROM deposits d WHERE d.user_id = u.id AND d.status = 'complete') AS deposited
     FROM users u ORDER BY u.created_at DESC LIMIT 500`,
  )
  res.json(
    rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      balance: Number(u.balance_cents),
      createdAt: u.created_at,
      cards: u.cards,
      spent: Number(u.spent),
      deposited: Number(u.deposited),
    })),
  )
})

// Demo only: wipe sales, deposits and inventory (keeps accounts).
app.post('/api/admin/reset', async (req, res) => {
  if (!config.demoMode) fail(404, 'Not found.')
  await tx(async (c) => {
    await c.query('TRUNCATE card_balance_events, ledger, deposits, gift_cards')
    await c.query('UPDATE users SET balance_cents = 0')
    const brands = (await c.query('SELECT * FROM brands')).rows.map((b) => ({ ...b, buyDiscount: Number(b.buy_discount) }))
    await insertDemoInventory(c, brands)
    await audit(c, req.admin.email, 'demo.reset')
  })
  res.json({ ok: true })
})

// ---------- errors ----------
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')))
// Never send stack traces or internal messages to the browser.
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError || err.expose) {
    if ((err.status ?? 500) >= 500) console.error(err)
    const message = err.type === 'entity.parse.failed' ? 'Bad request.' : err.type === 'entity.too.large' ? 'Request too large.' : err.message
    return res.status(err.status ?? 500).json({ error: message })
  }
  console.error(err)
  res.status(500).json({ error: 'Something went wrong. Please try again.' })
})

export function createApp() {
  return app
}
