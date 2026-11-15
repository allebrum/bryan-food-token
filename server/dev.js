import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.js'
import { fileStore } from './store.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const PORT = 5181
createApp({ store: fileStore(path.join(here, 'data', 'db.json')) }).listen(PORT, () => console.log(`Food Token API on http://localhost:${PORT}`))
