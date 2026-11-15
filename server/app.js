// Food Token demo API.
// A small Express app shared by the customer app and the admin. Storage is
// pluggable: a JSON file locally (server/dev.js), Netlify Blobs when deployed
// (netlify/functions/api.mjs). Everything here is demo-grade: no auth, fake
// wallet addresses, simulated deposits. Money is stored in integer cents.
import express from 'express'
import { randomUUID, randomBytes } from 'node:crypto'
import { seed, makeCardNumber, makePin } from './seed.js'

// ---------- store ----------
// Each request loads the whole document, and persists it before responding
// if anything changed. Requests are serialized within a process; separate
// serverless instances can still race (last write wins) — fine for a demo,
// not for real money.
let store
let db
let dirty = false
const save = () => {
  dirty = true
}
let queue = Promise.resolve()

// ---------- coins ----------
// Demo rates (USD). A real build would quote live and lock the rate on arrival.
const COINS = {
  USDC: { name: 'USD Coin', network: 'Ethereum (ERC-20)', usd: 1, decimals: 2, confirmations: 12 },
  USDT: { name: 'Tether', network: 'Tron (TRC-20)', usd: 1, decimals: 2, confirmations: 20 },
  BTC: { name: 'Bitcoin', network: 'Bitcoin', usd: 91250, decimals: 6, confirmations: 2 },
  ETH: { name: 'Ether', network: 'Ethereum', usd: 3180, decimals: 5, confirmations: 12 },
  SOL: { name: 'Solana', network: 'Solana', usd: 142, decimals: 3, confirmations: 32 },
}
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const b58 = (n) => Array.from(randomBytes(n), (x) => B58[x % 58]).join('')
const BECH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const bech = (n) => Array.from(randomBytes(n), (x) => BECH[x % 32]).join('')
// DEMO SAFETY: every address contains characters its format forbids
// ("O"/"M" aren't hex, "0"/"O" aren't base58, "o" isn't bech32), so no real
// wallet will accept it and nobody can lose funds sending to a demo address.
// Replace with real custody-provider addresses before taking real deposits.
function makeWallets() {
  const evm = '0xDEMO' + randomBytes(18).toString('hex')
  return {
    USDC: evm,
    ETH: evm,
    USDT: 'TDEMO0' + b58(28),
    BTC: 'bc1qdemo' + bech(34),
    SOL: 'DEMO0' + b58(39),
  }
}

// ---------- helpers ----------
const now = () => new Date().toISOString()
const brandById = (id) => db.brands.find((b) => b.id === id)
const priceFor = (brand, faceValue) => Math.round(faceValue * (1 - brand.sellDiscount))
const CONFIRM_MS = 6000

function settleDeposits(user) {
  let changed = false
  for (const d of db.deposits) {
    if (d.userId !== user.id || d.status !== 'confirming') continue
    if (Date.now() - new Date(d.createdAt).getTime() >= CONFIRM_MS) {
      d.status = 'complete'
      d.completedAt = now()
      user.balance += d.usdCents
      changed = true
    }
  }
  if (changed) save()
}

function publicCard(c) {
  const brand = brandById(c.brandId)
  return {
    id: c.id,
    brand: brand && { id: brand.id, name: brand.name, color: brand.color, category: brand.category },
    faceValue: c.faceValue,
    paid: c.salePrice,
    balance: c.balance,
    balanceHistory: c.balanceHistory,
    cardNumber: c.cardNumber,
    pin: c.pin,
    purchasedAt: c.soldAt,
    archived: !!c.archived,
  }
}

function meView(user) {
  settleDeposits(user)
  const deposits = db.deposits.filter((d) => d.userId === user.id)
  const cards = db.inventory.filter((c) => c.soldTo === user.id)
  const activity = [
    ...deposits.map((d) => ({
      id: d.id,
      type: 'deposit',
      status: d.status,
      at: d.createdAt,
      title: `Added ${d.coin}`,
      detail: `${d.amount} ${d.coin}`,
      cents: d.usdCents,
    })),
    ...cards.map((c) => ({
      id: c.id,
      type: 'purchase',
      status: 'complete',
      at: c.soldAt,
      title: `${brandById(c.brandId)?.name} gift card`,
      detail: `$${(c.faceValue / 100).toFixed(0)} card · saved $${((c.faceValue - c.salePrice) / 100).toFixed(2)}`,
      cents: -c.salePrice,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1))

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    balance: user.balance,
    pending: deposits.filter((d) => d.status === 'confirming').map((d) => ({ ...d, confirmMs: CONFIRM_MS })),
    wallets: Object.entries(user.wallets).map(([coin, address]) => ({ coin, address, ...COINS[coin] })),
    cards: cards.map(publicCard).sort((a, b) => (a.purchasedAt < b.purchasedAt ? 1 : -1)),
    saved: cards.reduce((s, c) => s + (c.faceValue - c.salePrice), 0),
    activity: activity.slice(0, 30),
  }
}

// ---------- app ----------
const app = express()

// Netlify routes /api/* to /.netlify/functions/api/*; put the prefix back.
app.use((req, _res, next) => {
  if (req.url.startsWith('/.netlify/functions/api')) req.url = '/api' + req.url.slice('/.netlify/functions/api'.length)
  next()
})
app.use(express.json({ limit: '100kb' }))

app.use('/api', (req, res, next) => {
  // Release the turn as soon as the response is sent (serverless-http's mock
  // response doesn't reliably emit 'close', so don't depend on it alone).
  let unlock
  const turn = new Promise((r) => (unlock = r))
  let released = false
  const release = () => {
    if (!released) (released = true), unlock()
  }
  const prev = queue
  queue = queue.then(() => turn)
  res.on('finish', release)
  res.on('close', release)
  prev
    .then(async () => {
      db = (await store.load()) ?? seed()
      dirty = false
      const send = res.json.bind(res)
      res.json = (body) => {
        if (!dirty) {
          send(body)
          release()
          return res
        }
        store
          .save(db)
          .then(
            () => send(body),
            (err) => {
              console.error('save failed', err)
              res.status(500)
              send({ error: 'Couldn’t save. Please try again.' })
            },
          )
          .finally(release)
        return res
      }
      next()
    })
    .catch((err) => {
      release()
      next(err)
    })
})

const bad = (res, status, message) => res.status(status).json({ error: message })
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

function currentUser(req, res) {
  const id = req.get('x-user-id')
  const user = id && db.users.find((u) => u.id === id)
  if (!user) {
    bad(res, 401, 'Please sign up first.')
    return null
  }
  return user
}

app.get('/api/coins', (_req, res) => res.json(COINS))

// --- account ---
app.post('/api/users', (req, res) => {
  const name = str(req.body?.name, 40)
  const email = str(req.body?.email, 120).toLowerCase()
  if (!name) return bad(res, 400, 'Tell us your name.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(res, 400, 'That email doesn’t look right.')
  let user = db.users.find((u) => u.email === email)
  if (!user) {
    user = { id: randomUUID(), name, email, balance: 0, wallets: makeWallets(), createdAt: now() }
    db.users.push(user)
    save()
  }
  res.json(meView(user))
})

app.get('/api/me', (req, res) => {
  const user = currentUser(req, res)
  if (user) res.json(meView(user))
})

// Simulates crypto landing on the user's address. In production this is a
// chain watcher / custody webhook, and the USD amount is locked at arrival.
app.post('/api/deposits/simulate', (req, res) => {
  const user = currentUser(req, res)
  if (!user) return
  const coin = str(req.body?.coin, 8)
  const usd = Number(req.body?.usd)
  if (!COINS[coin]) return bad(res, 400, 'Unknown coin.')
  if (!Number.isFinite(usd) || usd < 5 || usd > 5000) return bad(res, 400, 'Pick an amount between $5 and $5,000.')
  const rate = COINS[coin].usd
  const amount = +(usd / rate).toFixed(COINS[coin].decimals)
  const d = {
    id: randomUUID(),
    userId: user.id,
    coin,
    amount,
    rate,
    usdCents: Math.round(amount * rate * 100),
    status: 'confirming',
    createdAt: now(),
  }
  db.deposits.push(d)
  save()
  res.json(meView(user))
})

// --- stores ---
function storeView(b, { lat, lng } = {}) {
  const avail = db.inventory.filter((c) => c.brandId === b.id && c.status === 'available')
  const denoms = [...new Set(avail.map((c) => c.faceValue))].sort((a, z) => a - z)
  const locations = b.locations
    .map((l) => {
      const miles = Math.hypot(l.dLat * 69, l.dLng * 69 * Math.cos(((lat ?? 39.74) * Math.PI) / 180))
      return { address: l.address, miles: +miles.toFixed(1) }
    })
    .sort((a, z) => a.miles - z.miles)
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    color: b.color,
    tagline: b.tagline,
    discount: b.sellDiscount,
    denominations: denoms.map((v) => ({ faceValue: v, price: priceFor(b, v), inStock: avail.filter((c) => c.faceValue === v).length })),
    nearest: locations[0]?.miles ?? null,
    locations,
  }
}

app.get('/api/stores', (req, res) => {
  const q = str(req.query.q, 60).toLowerCase()
  const category = str(req.query.category, 40)
  const lat = req.query.lat ? Number(req.query.lat) : undefined
  let list = db.brands.filter((b) => b.active)
  if (category) list = list.filter((b) => b.category === category)
  if (q) list = list.filter((b) => (b.name + ' ' + b.category + ' ' + b.tagline).toLowerCase().includes(q))
  const stores = list.map((b) => storeView(b, { lat })).sort((a, z) => (a.nearest ?? 99) - (z.nearest ?? 99))
  const categories = [...new Set(db.brands.filter((b) => b.active).map((b) => b.category))].sort()
  res.json({ stores, categories })
})

app.post('/api/purchase', (req, res) => {
  const user = currentUser(req, res)
  if (!user) return
  settleDeposits(user)
  const brand = brandById(str(req.body?.storeId, 60))
  const faceValue = Number(req.body?.faceValue)
  if (!brand || !brand.active) return bad(res, 404, 'Store not found.')
  const card = db.inventory.find((c) => c.brandId === brand.id && c.faceValue === faceValue && c.status === 'available')
  if (!card) return bad(res, 409, 'That card just sold out. Try another amount.')
  const price = priceFor(brand, faceValue)
  if (user.balance < price) return bad(res, 402, 'Not enough in your wallet yet.')
  // Single-threaded + synchronous: the claim and the debit happen together.
  user.balance -= price
  Object.assign(card, {
    status: 'sold',
    soldTo: user.id,
    soldAt: now(),
    salePrice: price,
    balance: faceValue,
    balanceHistory: [{ at: now(), balance: faceValue, note: 'Purchased' }],
  })
  save()
  res.json({ card: publicCard(card), me: meView(user) })
})

app.post('/api/cards/:id/balance', (req, res) => {
  const user = currentUser(req, res)
  if (!user) return
  const card = db.inventory.find((c) => c.id === req.params.id && c.soldTo === user.id)
  if (!card) return bad(res, 404, 'Card not found.')
  const cents = Math.round(Number(req.body?.balance) * 100)
  if (!Number.isFinite(cents) || cents < 0 || cents > card.faceValue) {
    return bad(res, 400, `Enter an amount from $0 to $${(card.faceValue / 100).toFixed(2)}.`)
  }
  card.balance = cents
  card.balanceHistory = [...(card.balanceHistory || []), { at: now(), balance: cents, note: 'Updated by you' }].slice(-50)
  card.archived = cents === 0
  save()
  res.json(meView(user))
})

// --- admin (no auth in the demo) ---
function adminInventoryRow(c) {
  const b = brandById(c.brandId)
  const user = c.soldTo && db.users.find((u) => u.id === c.soldTo)
  return {
    ...c,
    brandName: b?.name,
    brandColor: b?.color,
    listPrice: b ? priceFor(b, c.faceValue) : null,
    soldToName: user ? `${user.name} (${user.email})` : null,
  }
}

app.get('/api/admin/overview', (_req, res) => {
  const sold = db.inventory.filter((c) => c.status === 'sold')
  const avail = db.inventory.filter((c) => c.status === 'available')
  const revenue = sold.reduce((s, c) => s + c.salePrice, 0)
  const costSold = sold.reduce((s, c) => s + c.cost, 0)
  const lowStock = db.brands
    .filter((b) => b.active)
    .map((b) => ({ id: b.id, name: b.name, color: b.color, count: avail.filter((c) => c.brandId === b.id).length }))
    .filter((b) => b.count < 6)
    .sort((a, z) => a.count - z.count)
  res.json({
    inventory: { count: avail.length, faceValue: avail.reduce((s, c) => s + c.faceValue, 0), cost: avail.reduce((s, c) => s + c.cost, 0) },
    sales: { count: sold.length, revenue, cost: costSold, profit: revenue - costSold, faceValue: sold.reduce((s, c) => s + c.faceValue, 0) },
    customers: { count: db.users.length, balances: db.users.reduce((s, u) => s + u.balance, 0) },
    deposits: { count: db.deposits.length, usd: db.deposits.filter((d) => d.status === 'complete').reduce((s, d) => s + d.usdCents, 0) },
    lowStock,
    recentSales: sold
      .sort((a, z) => (a.soldAt < z.soldAt ? 1 : -1))
      .slice(0, 8)
      .map(adminInventoryRow),
  })
})

app.get('/api/admin/inventory', (req, res) => {
  const status = str(req.query.status, 20)
  const brandId = str(req.query.brandId, 60)
  let rows = db.inventory
  if (status) rows = rows.filter((c) => c.status === status)
  if (brandId) rows = rows.filter((c) => c.brandId === brandId)
  rows = [...rows].sort((a, z) => (a.addedAt < z.addedAt ? 1 : -1)).slice(0, 500)
  res.json(rows.map(adminInventoryRow))
})

// Add one or many cards: lines of "cardNumber, pin". Leave lines empty to
// generate demo numbers.
app.post('/api/admin/inventory', (req, res) => {
  const brand = brandById(str(req.body?.brandId, 60))
  const faceValue = Math.round(Number(req.body?.faceValue) * 100)
  const cost = Math.round(Number(req.body?.cost) * 100)
  if (!brand) return bad(res, 400, 'Choose a brand.')
  if (!Number.isFinite(faceValue) || faceValue < 100 || faceValue > 100000) return bad(res, 400, 'Face value must be $1–$1,000.')
  if (!Number.isFinite(cost) || cost <= 0 || cost > faceValue) return bad(res, 400, 'Cost must be above $0 and no more than face value.')
  let lines = str(req.body?.cards, 20000)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const generate = Math.min(Math.max(Number(req.body?.generate) || 0, 0), 50)
  if (!lines.length && generate) lines = Array.from({ length: generate }, () => `${makeCardNumber()}, ${makePin()}`)
  if (!lines.length) return bad(res, 400, 'Add at least one card.')
  if (lines.length > 200) return bad(res, 400, 'Up to 200 cards at a time.')
  const added = []
  for (const line of lines) {
    const [num, pin = ''] = line.split(/[,\t;]/).map((s) => s.trim())
    if (!/^[0-9A-Za-z-]{6,30}$/.test(num || '')) return bad(res, 400, `Card number looks wrong: “${line.slice(0, 40)}”`)
    if (db.inventory.some((c) => c.brandId === brand.id && c.cardNumber === num)) return bad(res, 409, `Already in inventory: ${num}`)
    added.push({
      id: randomUUID(),
      brandId: brand.id,
      faceValue,
      cost,
      cardNumber: num,
      pin: pin.slice(0, 12),
      status: 'available',
      addedAt: now(),
    })
  }
  db.inventory.push(...added)
  save()
  res.json({ added: added.length })
})

app.delete('/api/admin/inventory/:id', (req, res) => {
  const i = db.inventory.findIndex((c) => c.id === req.params.id)
  if (i < 0) return bad(res, 404, 'Not found.')
  if (db.inventory[i].status !== 'available') return bad(res, 409, 'Sold cards can’t be removed.')
  db.inventory.splice(i, 1)
  save()
  res.json({ ok: true })
})

app.get('/api/admin/brands', (_req, res) => {
  res.json(
    db.brands.map((b) => {
      const mine = db.inventory.filter((c) => c.brandId === b.id)
      return {
        ...b,
        available: mine.filter((c) => c.status === 'available').length,
        sold: mine.filter((c) => c.status === 'sold').length,
      }
    }),
  )
})

app.post('/api/admin/brands', (req, res) => {
  const name = str(req.body?.name, 60)
  if (!name) return bad(res, 400, 'Name is required.')
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  if (brandById(id)) return bad(res, 409, 'That brand already exists.')
  const brand = {
    id,
    name,
    category: str(req.body?.category, 40) || 'Restaurants',
    color: /^#[0-9a-fA-F]{6}$/.test(req.body?.color) ? req.body.color : '#111111',
    tagline: str(req.body?.tagline, 80),
    buyDiscount: 0.2,
    sellDiscount: 0.15,
    active: true,
    locations: [{ address: 'Main St', dLat: 0.02, dLng: -0.03 }],
  }
  db.brands.push(brand)
  save()
  res.json(brand)
})

app.put('/api/admin/brands/:id', (req, res) => {
  const b = brandById(req.params.id)
  if (!b) return bad(res, 404, 'Not found.')
  const pct = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) < 90 ? Number(v) / 100 : null)
  const buy = req.body?.buyDiscount !== undefined ? pct(req.body.buyDiscount) : b.buyDiscount
  const sell = req.body?.sellDiscount !== undefined ? pct(req.body.sellDiscount) : b.sellDiscount
  if (buy === null || sell === null) return bad(res, 400, 'Discounts must be 0–90%.')
  if (sell > buy) return bad(res, 400, 'Customer discount can’t be bigger than what we buy at — we’d lose money.')
  b.buyDiscount = buy
  b.sellDiscount = sell
  if (typeof req.body?.active === 'boolean') b.active = req.body.active
  save()
  res.json(b)
})

app.get('/api/admin/customers', (_req, res) => {
  res.json(
    db.users.map((u) => {
      settleDeposits(u)
      const cards = db.inventory.filter((c) => c.soldTo === u.id)
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        balance: u.balance,
        createdAt: u.createdAt,
        cards: cards.length,
        spent: cards.reduce((s, c) => s + c.salePrice, 0),
        deposited: db.deposits.filter((d) => d.userId === u.id && d.status === 'complete').reduce((s, d) => s + d.usdCents, 0),
      }
    }),
  )
})

app.post('/api/admin/reset', (_req, res) => {
  db = seed()
  save()
  res.json({ ok: true })
})

export function createApp(options) {
  store = options.store
  return app
}
