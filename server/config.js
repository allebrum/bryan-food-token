// All configuration comes from environment variables (see .env.example).
const env = process.env

const bool = (v) => ['1', 'true', 'yes', 'on'].includes(String(v ?? '').toLowerCase())

export const config = {
  production: env.CONTEXT === 'production' || env.NODE_ENV === 'production',
  appUrl: (env.APP_URL || env.URL || 'http://localhost:5180').replace(/\/$/, ''),
  databaseUrl: env.DATABASE_URL || env.NETLIFY_DATABASE_URL || '',
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
}

export const isAdminEmail = (email) => !!email && config.adminEmails.has(email.toLowerCase())
