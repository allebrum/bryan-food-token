import pg from 'pg'
import { config } from './config.js'

if (!config.databaseUrl) throw new Error('No database: set DATABASE_URL, or add a Netlify Database (NETLIFY_DB_URL)')

const local = /@(localhost|127\.0\.0\.1)[:/]/.test(config.databaseUrl)

// Small pool: serverless instances each hold their own.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 8_000,
  statement_timeout: 10_000,
  ssl: local ? false : { rejectUnauthorized: true },
})

export const q = (text, params) => pool.query(text, params)
export const one = async (text, params) => (await pool.query(text, params)).rows[0] ?? null

// Runs fn(client) in a transaction; rolls back on any throw.
export async function tx(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const out = await fn(client)
    await client.query('COMMIT')
    return out
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
