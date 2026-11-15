// Friendly copy for people new to crypto. Addresses and networks come from the API.
export const COIN_COPY = {
  USDC: { blurb: 'A digital dollar. 1 USDC is always about $1.', badge: 'Easiest', tint: '#2775CA' },
  USDT: { blurb: 'Another digital dollar, popular on exchanges.', tint: '#26A17B' },
  ETH: { blurb: 'The coin of the Ethereum network.', tint: '#627EEA' },
  BNB: { blurb: 'The coin of BNB Smart Chain.', tint: '#F0B90B' },
  BTC: { blurb: 'The original cryptocurrency.', tint: '#F7931A' },
  SOL: { blurb: 'Fast and cheap to send.', tint: '#9945FF' },
}

// Plain-language hints for picking a network.
export const NETWORK_HINT = {
  base: 'Cheapest to send. Coinbase supports it.',
  ethereum: 'Most common, but sending costs more.',
  bsc: 'Common on Binance. Shown as BEP-20.',
}
