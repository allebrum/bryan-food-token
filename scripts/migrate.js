// LOCAL DEVELOPMENT ONLY. Applies netlify/database/migrations/*.sql in name
// order, each in its own transaction, to the docker-compose database.
// On Netlify, Netlify Database applies the same files itself right before
// a deploy is published (and blocks the publish if one fails).
// Usage: npm run migrate   (reads DATABASE_URL)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from '../server/db.js'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'netlify', 'database', 'migrations')
const client = await pool.connect()
try {
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())')
  // One migrator at a time (two deploys building at once).
  await client.query('SELECT pg_advisory_lock(7357001)')
  const done = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name))
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue
    process.stdout.write(`migrating ${file} … `)
    await client.query('BEGIN')
    try {
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'))
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log('ok')
    } catch (err) {
      await client.query('ROLLBACK')
      console.log('FAILED')
      throw err
    }
  }
  console.log('migrations up to date')
} finally {
  client.release()
  await pool.end()
}
