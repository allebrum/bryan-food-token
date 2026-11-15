import fs from 'node:fs'
import path from 'node:path'

// Local dev: one JSON file.
export function fileStore(file) {
  return {
    async load() {
      return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
    },
    async save(db) {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      const tmp = file + '.tmp'
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2))
      fs.renameSync(tmp, file)
    },
  }
}

// Netlify: one JSON blob in a site-scoped store.
export async function blobStore() {
  const { getStore } = await import('@netlify/blobs')
  const blobs = getStore({ name: 'foodtoken', consistency: 'strong' })
  return {
    load: () => blobs.get('db', { type: 'json' }),
    save: (db) => blobs.setJSON('db', db),
  }
}
