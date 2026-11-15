// EVM networks, tokens, address derivation and JSON-RPC.
import { HDNodeWallet } from 'ethers'
import { config } from '../config.js'

// Token contracts are the canonical ones for each chain. Never trust a
// webhook's own symbol/decimals: an unknown contract is not credited.
export const EVM_NETWORKS = {
  ethereum: {
    explorer: 'https://etherscan.io/tx/',
    // Extra we suggest on top of the minimum: exchanges take their
    // withdrawal fee out of the amount sent.
    sendBufferUsd: 5,
    label: 'Ethereum',
    alchemy: 'eth-mainnet',
    confirmations: 12,
    native: { coin: 'ETH', decimals: 18 },
    tokens: {
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { coin: 'USDC', decimals: 6 },
      '0xdac17f958d2ee523a2206206994597c13d831ec7': { coin: 'USDT', decimals: 6 },
    },
  },
  base: {
    explorer: 'https://basescan.org/tx/',
    // Extra we suggest on top of the minimum: exchanges take their
    // withdrawal fee out of the amount sent.
    sendBufferUsd: 1,
    label: 'Base',
    alchemy: 'base-mainnet',
    confirmations: 10,
    native: { coin: 'ETH', decimals: 18 },
    tokens: {
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { coin: 'USDC', decimals: 6 },
    },
  },
  bsc: {
    explorer: 'https://bscscan.com/tx/',
    // Extra we suggest on top of the minimum: exchanges take their
    // withdrawal fee out of the amount sent.
    sendBufferUsd: 1,
    label: 'BNB Smart Chain (BEP-20)',
    alchemy: 'bnb-mainnet',
    confirmations: 15,
    native: { coin: 'BNB', decimals: 18 },
    tokens: {
      '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': { coin: 'USDC', decimals: 18 },
      '0x55d398326f99059ff775485246999027b3197955': { coin: 'USDT', decimals: 18 },
    },
  },
}

// A network is live once its Alchemy webhook is configured.
export const enabledEvmNetworks = () => Object.keys(EVM_NETWORKS).filter((k) => config.evm.webhooks[k]?.id && config.evm.webhooks[k]?.signingKey)
export const evmEnabled = () => !!config.evm.xpub && enabledEvmNetworks().length > 0

// Addresses come from the account-level xpub (m/44'/60'/0'), child 0/<index>:
// the same path MetaMask and hardware wallets use, so the mnemonic recovers them.
let root
export function deriveEvmAddress(index) {
  root ??= HDNodeWallet.fromExtendedKey(config.evm.xpub)
  if (!('deriveChild' in root)) throw new Error('EVM_XPUB is not an extended key')
  return root.deriveChild(0).deriveChild(index).address.toLowerCase()
}

export function rpcUrl(network) {
  const override = process.env[`EVM_RPC_URL_${network.toUpperCase()}`]
  if (override) return override
  if (!config.alchemy.apiKey) throw new Error('ALCHEMY_API_KEY is not set')
  return `https://${EVM_NETWORKS[network].alchemy}.g.alchemy.com/v2/${config.alchemy.apiKey}`
}

export async function rpc(network, method, params = []) {
  const res = await fetch(rpcUrl(network), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`RPC ${network} ${method}: HTTP ${res.status}`)
  const body = await res.json()
  if (body.error) throw new Error(`RPC ${network} ${method}: ${body.error.message}`)
  return body.result
}

// Exact decimal string from an integer amount (no floating point).
export function formatUnits(raw, decimals) {
  const v = BigInt(raw)
  const base = 10n ** BigInt(decimals)
  const whole = v / base
  const frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : `${whole}`
}
