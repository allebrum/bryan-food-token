import pg from 'pg'
import { getConnectionString } from '@netlify/database'
import { config } from './config.js'

// DATABASE_URL locally; on Netlify, Netlify Database's NETLIFY_DB_URL or,
// failing that, its own lookup.
function connectionString() {
  if (config.databaseUrl) return config.databaseUrl
  try {
    return getConnectionString()
  } catch {
    throw new Error('No database: set DATABASE_URL, or add a Netlify Database (Data & storage → Database)')
  }
}
const url = connectionString()
const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url)

// Small pool: serverless instances each hold their own.
export const pool = new pg.Pool({
  connectionString: url,
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
