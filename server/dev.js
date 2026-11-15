// Local API on :5181 (Vite proxies /api here). Env comes from .env.
import { createApp } from './app.js'

const PORT = 5181
createApp().listen(PORT, () => console.log(`Food Token API on http://localhost:${PORT}`))
