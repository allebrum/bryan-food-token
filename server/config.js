// All configuration comes from environment variables (see .env.example).
const env = process.env

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d)
const bool = (v) => ['1', 'true', 'yes', 'on'].includes(String(v ?? '').toLowerCase())

export const config = {
  production: env.CONTEXT === 'production' || env.NODE_ENV === 'production',
  appUrl: (env.APP_URL || env.URL || 'http://localhost:5180').replace(/\/$/, ''),
  // NETLIFY_DB_URL: Netlify Database (set automatically in builds and functions).
  // NETLIFY_DATABASE_URL: the older Netlify DB / Neon extension.
  databaseUrl: env.DATABASE_URL || env.NETLIFY_DB_URL || env.NETLIFY_DATABASE_URL || '',
  adminEmails: new Set(
    String(env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  ),
  resendApiKey: env.RESEND_API_KEY || '',
  emailFrom: env.EMAIL_FROM || '',
  cardKey: env.CARD_ENCRYPTION_KEY || '',
  // Simulated deposits, fake addresses, demo inventory and the demo banner.
  demoMode: bool(env.DEMO_MODE),
  alchemy: {
    apiKey: env.ALCHEMY_API_KEY || '',
    authToken: env.ALCHEMY_AUTH_TOKEN || '', // Notify API token (adds addresses to webhooks)
  },
  evm: {
    xpub: env.EVM_XPUB || '',
    // One Alchemy Address Activity webhook per network.
    webhooks: Object.fromEntries(
      ['ethereum', 'base', 'bsc'].map((n) => [
        n,
        { id: env[`ALCHEMY_${n.toUpperCase()}_WEBHOOK_ID`] || '', signingKey: env[`ALCHEMY_${n.toUpperCase()}_SIGNING_KEY`] || '' },
      ]),
    ),
    // Smallest deposit we credit, in USD, per network. Smaller ones are held
    // (sweeping them would cost more in fees than they're worth).
    minUsd: { ethereum: num(env.MIN_DEPOSIT_USD_ETHEREUM, 20), base: num(env.MIN_DEPOSIT_USD_BASE, 2), bsc: num(env.MIN_DEPOSIT_USD_BSC, 2) },
  },
  // Company wallets (gas top-ups, sweeps). Transfers FROM these are never
  // credited to a customer.
  treasuryAddresses: new Set(
    String(env.TREASURY_ADDRESSES || '')
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean),
  ),
}

export const isAdminEmail = (email) => !!email && config.adminEmails.has(email.toLowerCase())
