import { useCallback, useEffect, useMemo, useState } from 'react'
import { Routes, Route, NavLink, Link, Navigate } from 'react-router-dom'
import { LayoutDashboard, Package, Store, Users, Plus, Trash2, RotateCcw, ArrowUpRight, Coins, ExternalLink, Clock } from 'lucide-react'
import Logo from '../components/Logo'
import Button from '../components/Button'
import Modal, { SheetTitle } from '../components/Modal'
import BrandMark from '../components/BrandMark'
import { api } from '../lib/api'
import { useConfig } from '../lib/config'
import { money, pct, ago } from '../lib/format'

// Client-side gate is for UX only; every /api/admin route checks ADMIN_EMAILS.
export default function AdminRoot() {
  const [state, setState] = useState('loading') // loading | signed-out | forbidden | ok
  useEffect(() => {
    api('/me').then(
      (me) => setState(me.isAdmin ? 'ok' : 'forbidden'),
      (e) => setState(e.status === 401 ? 'signed-out' : 'forbidden'),
    )
  }, [])
  if (state === 'loading') return <div className="min-h-dvh bg-canvas" />
  if (state !== 'ok') {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-6">
        <div className="max-w-md text-center">
          <Logo className="justify-center" />
          <h1 className="mt-10 text-3xl font-extrabold tracking-tight">{state === 'signed-out' ? 'Sign in to continue' : 'Admins only'}</h1>
          <p className="mt-3 text-lg text-muted">
            {state === 'signed-out' ? 'Sign in with an admin email, then come back here.' : 'This account isn’t on the admin list.'}
          </p>
          <Button as={Link} to="/app" size="lg" className="mt-8">
            {state === 'signed-out' ? 'Sign in' : 'Back to the app'}
          </Button>
        </div>
      </div>
    )
  }
  return <AdminShell />
}

function AdminShell() {
  const config = useConfig()
  const link = ({ isActive }) =>
    `flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-4 h-11 font-semibold transition ${isActive ? 'bg-ink text-white' : 'text-ink-2 hover:bg-white'}`
  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-line bg-canvas p-5 lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r lg:p-6">
        <div className="flex items-center justify-between lg:block">
          <Link to="/admin">
            <Logo />
          </Link>
          <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent lg:mt-3 lg:inline-block">
            Admin
          </span>
        </div>
        <nav className="no-scrollbar mt-5 flex gap-1 overflow-x-auto lg:mt-10 lg:flex-col" aria-label="Admin">
          <NavLink end to="/admin" className={link}>
            <LayoutDashboard className="size-5" /> Overview
          </NavLink>
          <NavLink to="/admin/inventory" className={link}>
            <Package className="size-5" /> Inventory
          </NavLink>
          <NavLink to="/admin/deposits" className={link}>
            <Coins className="size-5" /> Deposits
          </NavLink>
          <NavLink to="/admin/brands" className={link}>
            <Store className="size-5" /> Brands & margins
          </NavLink>
          <NavLink to="/admin/customers" className={link}>
            <Users className="size-5" /> Customers
          </NavLink>
        </nav>
        <div className="mt-10 hidden gap-2 lg:grid">
          <Link to="/app" className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
            <ArrowUpRight className="size-4" /> Customer app
          </Link>
          {config?.demoMode && <ResetButton />}
        </div>
      </aside>
      <main className="min-w-0 px-5 py-8 sm:px-10 sm:py-12">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="deposits" element={<Deposits />} />
          <Route path="brands" element={<Brands />} />
          <Route path="customers" element={<Customers />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function useLoad(path) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const reload = useCallback(() => {
    api(path)
      .then((d) => {
        setData(d)
        setError('')
      })
      .catch((e) => setError(e.message))
  }, [path])
  useEffect(reload, [reload])
  return { data, error, reload }
}

function PageHead({ title, sub, children }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">{title}</h1>
        {sub && <p className="mt-2 text-lg text-muted">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

const Panel = ({ className = '', children }) => <div className={`rounded-[var(--radius-pass)] bg-white shadow-[var(--shadow-soft)] ${className}`}>{children}</div>

function Kpi({ label, value, sub, tone }) {
  return (
    <Panel className="p-6">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={`tabular mt-2 text-3xl font-extrabold tracking-tight ${tone === 'save' ? 'text-save' : ''}`}>{value}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </Panel>
  )
}

// ---------------- Overview ----------------
function Overview() {
  const { data: o, error } = useLoad('/admin/overview')
  if (error) return <p className="text-red-600">{error}</p>
  if (!o) return null
  const margin = o.sales.faceValue ? o.sales.profit / o.sales.faceValue : 0
  return (
    <>
      <PageHead title="Overview" sub="How the gift card book is doing." />
      {o.deposits.needsReview > 0 && (
        <Link
          to="/admin/deposits"
          className="mb-6 flex items-center gap-3 rounded-[var(--radius-pass)] bg-amber-50 p-5 font-semibold text-amber-900 hover:bg-amber-100"
        >
          <Clock className="size-5 shrink-0" />
          {o.deposits.needsReview} deposit{o.deposits.needsReview === 1 ? '' : 's'} waiting for review
          <ArrowUpRight className="ml-auto size-5" />
        </Link>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Profit" value={money(o.sales.profit)} sub={`${pct(margin)} of card value sold`} tone="save" />
        <Kpi label="Sales" value={money(o.sales.revenue)} sub={`${o.sales.count} cards sold`} />
        <Kpi label="Inventory on hand" value={money(o.inventory.faceValue)} sub={`${o.inventory.count} cards · cost ${money(o.inventory.cost)}`} />
        <Kpi label="Customer balances" value={money(o.customers.balances)} sub={`${o.customers.count} customers · ${money(o.deposits.usd)} deposited`} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]">
        <Panel className="p-6">
          <h2 className="mb-4 text-xl font-bold">Recent sales</h2>
          {o.recentSales.length === 0 ? (
            <p className="text-muted">No sales yet. Buy a card in the customer app to see it here.</p>
          ) : (
            <ul className="divide-y divide-line">
              {o.recentSales.map((s) => (
                <li key={s.id} className="flex items-center gap-4 py-3">
                  <span className="size-3 rounded-full" style={{ background: s.brandColor }} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {s.brandName} {money(s.faceValue, { whole: true })}
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {s.soldToName} · {ago(s.soldAt)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="tabular block font-bold">{money(s.salePrice)}</span>
                    <span className="tabular block text-sm font-semibold text-save">+{money(s.salePrice - s.cost)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="p-6">
          <h2 className="mb-4 text-xl font-bold">Running low</h2>
          {o.lowStock.length === 0 ? (
            <p className="text-muted">Every brand has 6+ cards in stock.</p>
          ) : (
            <ul className="grid gap-3">
              {o.lowStock.map((b) => (
                <li key={b.id} className="flex items-center justify-between">
                  <span className="flex items-center gap-3 font-semibold">
                    <span className="size-3 rounded-full" style={{ background: b.color }} /> {b.name}
                  </span>
                  <span className={`font-bold ${b.count === 0 ? 'text-red-600' : 'text-accent'}`}>{b.count} left</span>
                </li>
              ))}
            </ul>
          )}
          <Button as={Link} to="/admin/inventory" variant="soft" block className="mt-6">
            Restock inventory
          </Button>
        </Panel>
      </div>
    </>
  )
}

// ---------------- Inventory ----------------
function Inventory() {
  const [status, setStatus] = useState('')
  const [brandId, setBrandId] = useState('')
  const [adding, setAdding] = useState(false)
  const qs = new URLSearchParams({ ...(status && { status }), ...(brandId && { brandId }) }).toString()
  const { data: rows, reload } = useLoad(`/admin/inventory?${qs}`)
  const { data: brands } = useLoad('/admin/brands')

  const remove = async (id) => {
    if (!confirm('Remove this card from inventory?')) return
    try {
      await api(`/admin/inventory/${id}`, { method: 'DELETE' })
      reload()
    } catch (e) {
      alert(e.message)
    }
  }

  const sel = 'h-11 rounded-full bg-white px-4 font-semibold shadow-[var(--shadow-soft)] outline-none'
  return (
    <>
      <PageHead title="Inventory" sub="Gift cards we’ve bought and can sell.">
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-5" /> Add gift cards
        </Button>
      </PageHead>
      <div className="mb-5 flex flex-wrap gap-3">
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="sold">Sold</option>
        </select>
        <select aria-label="Filter by brand" value={brandId} onChange={(e) => setBrandId(e.target.value)} className={sel}>
          <option value="">All brands</option>
          {brands?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {rows && <span className="self-center text-muted">{rows.length} cards</span>}
      </div>
      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead className="border-b border-line text-sm text-muted">
            <tr>
              {['Brand', 'Card', 'Face value', 'We paid', 'Sells for', 'Margin', 'Expires', 'Status', ''].map((h) => (
                <th key={h} className="px-5 py-4 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows?.map((r) => {
              const sale = r.salePrice ?? r.listPrice
              return (
                <tr key={r.id} className="hover:bg-canvas/60">
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-3 font-semibold">
                      <span className="size-3 rounded-full" style={{ background: r.brandColor }} />
                      {r.brandName}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-sm text-muted">•••• {r.last4}</td>
                  <td className="tabular px-5 py-3.5 font-semibold">{money(r.faceValue)}</td>
                  <td className="tabular px-5 py-3.5">{money(r.cost)}</td>
                  <td className="tabular px-5 py-3.5">{money(sale)}</td>
                  <td className="tabular px-5 py-3.5 font-semibold text-save">+{money(sale - r.cost)}</td>
                  <td className="px-5 py-3.5 text-sm text-muted">{r.expiresOn ? String(r.expiresOn).slice(0, 10) : '—'}</td>
                  <td className="px-5 py-3.5">
                    {r.status === 'sold' ? (
                      <span className="rounded-full bg-canvas px-3 py-1 text-sm font-semibold" title={r.soldToName}>
                        Sold {ago(r.soldAt)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-save-soft px-3 py-1 text-sm font-semibold text-save">Available</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {r.status === 'available' && (
                      <button onClick={() => remove(r.id)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-red-50 hover:text-red-600" aria-label="Remove card">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>
      {brands && <AddCards open={adding} brands={brands} onClose={() => setAdding(false)} onAdded={reload} />}
    </>
  )
}

function AddCards({ open, brands, onClose, onAdded }) {
  const [brandId, setBrandId] = useState('')
  const [face, setFace] = useState('50')
  const [cost, setCost] = useState('')
  const [cards, setCards] = useState('')
  const [format, setFormat] = useState('CODE128')
  const [expiresOn, setExpiresOn] = useState('')
  const [error, setError] = useState('')
  const demo = useConfig()?.demoMode
  const [done, setDone] = useState(0)
  const brand = brands.find((b) => b.id === brandId)
  const suggested = brand && face ? (Number(face) * (1 - brand.buyDiscount)).toFixed(2) : ''
  const costN = Number(cost || suggested)
  const faceN = Number(face)
  const sell = brand ? faceN * (1 - brand.sellDiscount) : 0
  const lines = cards.split('\n').filter((l) => l.trim()).length

  useEffect(() => {
    if (open) {
      setError('')
      setDone(0)
    }
  }, [open])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const res = await api('/admin/inventory', {
        method: 'POST',
        body: { brandId, faceValue: faceN, cost: costN, cards, barcodeFormat: format, expiresOn, generate: !lines && demo },
      })
      setDone(res.added)
      setCards('')
      onAdded()
    } catch (err) {
      setError(err.message)
    }
  }

  const input = 'h-14 w-full rounded-2xl border-2 border-line bg-white px-4 text-lg font-semibold outline-none focus:border-ink'
  return (
    <Modal open={open} onClose={onClose} label="Add gift cards" wide step={done ? 'done' : 'form'}>
      {done ? (
        <div className="text-center">
          <SheetTitle title={`Added ${done} card${done === 1 ? '' : 's'}`}>They’re live in the store right away.</SheetTitle>
          <div className="flex justify-center gap-3">
            <Button variant="soft" onClick={() => setDone(0)} data-autofocus>
              Add more
            </Button>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <SheetTitle title="Add gift cards">Enter the batch you bought. Same brand, value and barcode type per batch.</SheetTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="sm:col-span-3">
              <span className="mb-1.5 block text-sm font-bold">Brand</span>
              <select data-autofocus required value={brandId} onChange={(e) => setBrandId(e.target.value)} className={input}>
                <option value="">Choose…</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-bold">Face value ($)</span>
              <input required inputMode="decimal" value={face} onChange={(e) => setFace(e.target.value)} className={input} />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-bold">We paid, each ($)</span>
              <input inputMode="decimal" placeholder={suggested} value={cost} onChange={(e) => setCost(e.target.value)} className={input} />
            </label>
            <div className="rounded-2xl bg-save-soft p-3">
              <span className="block text-sm font-bold text-save">Profit each</span>
              <span className="tabular block text-2xl font-extrabold text-save">{brand && faceN ? money(Math.round((sell - costN) * 100)) : '—'}</span>
              {brand && <span className="block text-xs text-save/80">sells at {money(Math.round(sell * 100))}</span>}
            </div>
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-bold">Barcode at the register</span>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className={input}>
                <option value="CODE128">Barcode (Code 128 — most cards)</option>
                <option value="CODE39">Barcode (Code 39)</option>
                <option value="EAN13">Barcode (EAN-13)</option>
                <option value="UPC">Barcode (UPC)</option>
                <option value="QR">QR code</option>
                <option value="NONE">No barcode — type the number</option>
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-bold">Expires (optional)</span>
              <input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className={input} />
            </label>
            <label className="sm:col-span-3">
              <span className="mb-1.5 block text-sm font-bold">Card numbers</span>
              <textarea
                rows={5}
                value={cards}
                onChange={(e) => setCards(e.target.value)}
                placeholder={'One per line:  card number, PIN, e-gift link\n6006491234567890, 4821\n6006491234567891, 1937, https://…'}
                className="w-full rounded-2xl border-2 border-line p-4 font-mono text-[15px] outline-none focus:border-ink"
              />
              <span className="mt-1.5 block text-sm text-muted">
                {lines
                  ? `${lines} card${lines === 1 ? '' : 's'} · numbers and PINs are encrypted when saved`
                  : demo
                    ? 'Leave empty to add one demo card with a generated number.'
                    : 'PIN and e-gift link are optional. Numbers and PINs are encrypted when saved.'}
              </span>
            </label>
          </div>
          {error && (
            <p role="alert" className="mt-4 font-semibold text-red-600">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" block className="mt-6" disabled={!brandId || (!lines && !demo)}>
            Add {lines || 1} card{lines > 1 ? 's' : ''}
          </Button>
        </form>
      )}
    </Modal>
  )
}

// ---------------- Deposits ----------------
const DEPOSIT_TABS = [
  ['', 'Needs review first'],
  ['held', 'Held'],
  ['ignored', 'Unsupported'],
  ['complete', 'Credited'],
  ['confirming', 'Confirming'],
  ['reverted', 'Failed'],
]
const STATUS_STYLE = {
  held: 'bg-amber-50 text-amber-800',
  ignored: 'bg-red-50 text-red-700',
  reverted: 'bg-red-50 text-red-700',
  confirming: 'bg-canvas text-ink-2',
  complete: 'bg-save-soft text-save',
}
const STATUS_LABEL = { held: 'Held', ignored: 'Unsupported', reverted: 'Failed', confirming: 'Confirming', complete: 'Credited' }

function Deposits() {
  const [status, setStatus] = useState('')
  const { data: rows, error, reload } = useLoad(`/admin/deposits?status=${status}`)
  const [busy, setBusy] = useState(null)

  const credit = async (d) => {
    if (!confirm(`Add ${money(d.usdCents)} to ${d.customer}'s balance?`)) return
    setBusy(d.id)
    try {
      await api(`/admin/deposits/${d.id}/credit`, { method: 'POST', body: {} })
      reload()
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHead title="Deposits" sub="Crypto that arrived. Held deposits were under the minimum and wait for you to credit them." />
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto">
        {DEPOSIT_TABS.map(([k, l]) => (
          <button
            key={k || 'all'}
            onClick={() => setStatus(k)}
            aria-pressed={status === k}
            className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${status === k ? 'bg-ink text-white' : 'bg-white shadow-[var(--shadow-soft)]'}`}
          >
            {l}
          </button>
        ))}
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {rows && rows.length === 0 && <Panel className="p-8 text-muted">Nothing here.</Panel>}
      <div className="grid gap-3">
        {rows?.map((d) => (
          <Panel key={d.id} className="p-5">
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold">
                    {d.amount != null ? `${d.amount} ` : ''}
                    {d.coin}
                  </span>
                  <span className="text-muted">on {d.network}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[d.status] ?? ''}`}>{STATUS_LABEL[d.status] ?? d.status}</span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {d.customer} · {ago(d.createdAt)}
                  {d.note ? ` · ${d.note}` : ''}
                  {d.creditedBy ? ` · credited by ${d.creditedBy}` : ''}
                </p>
                {d.contract && <p className="mt-1 break-all font-mono text-xs text-muted">Contract {d.contract}</p>}
                {d.supportRequestedAt && (
                  <p className="mt-3 rounded-xl bg-canvas p-3 text-[15px]">
                    <span className="font-semibold">Customer asked for help {ago(d.supportRequestedAt)}</span>
                    {d.supportMessage ? <span className="mt-1 block whitespace-pre-wrap text-ink-2">“{d.supportMessage}”</span> : null}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="tabular text-xl font-extrabold">{d.usdCents != null ? money(d.usdCents) : '—'}</span>
                {d.explorerUrl && (
                  <a href={d.explorerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
                    View transaction <ExternalLink className="size-3.5" />
                  </a>
                )}
                {d.status === 'held' && d.usdCents > 0 && (
                  <Button size="sm" onClick={() => credit(d)} disabled={busy === d.id}>
                    {busy === d.id ? 'Crediting…' : `Credit ${money(d.usdCents)}`}
                  </Button>
                )}
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </>
  )
}

// ---------------- Brands ----------------
function Brands() {
  const { data: brands, reload } = useLoad('/admin/brands')
  const [adding, setAdding] = useState(false)
  return (
    <>
      <PageHead title="Brands & margins" sub="What we buy at vs. what customers save. The gap is our margin.">
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-5" /> New brand
        </Button>
      </PageHead>
      <div className="grid gap-4 xl:grid-cols-2">
        {brands?.map((b) => (
          <BrandRow key={b.id + b.buyDiscount + b.sellDiscount + b.active} brand={b} onSaved={reload} />
        ))}
      </div>
      <NewBrand open={adding} onClose={() => setAdding(false)} onSaved={reload} />
    </>
  )
}

function BrandRow({ brand, onSaved }) {
  const [buy, setBuy] = useState(Math.round(brand.buyDiscount * 100))
  const [sell, setSell] = useState(Math.round(brand.sellDiscount * 100))
  const [msg, setMsg] = useState('')
  const dirty = buy !== Math.round(brand.buyDiscount * 100) || sell !== Math.round(brand.sellDiscount * 100)

  const save = async (patch) => {
    setMsg('')
    try {
      await api(`/admin/brands/${brand.id}`, { method: 'PUT', body: patch })
      onSaved()
    } catch (e) {
      setMsg(e.message)
    }
  }
  const num = 'tabular h-11 w-20 rounded-xl border-2 border-line text-center text-lg font-bold outline-none focus:border-ink'
  return (
    <Panel className={`p-5 ${brand.active ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center gap-4">
        <BrandMark brand={brand} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold">{brand.name}</p>
          <p className="text-sm text-muted">
            {brand.category} · {brand.available} in stock · {brand.sold} sold
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={brand.active} onChange={(e) => save({ active: e.target.checked })} className="size-5 accent-ink" />
          Listed
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">We buy at</span>
          <span className="flex items-center gap-1.5">
            <input type="number" min={0} max={89} value={buy} onChange={(e) => setBuy(Number(e.target.value))} className={num} />% off
          </span>
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Customer saves</span>
          <span className="flex items-center gap-1.5">
            <input type="number" min={0} max={89} value={sell} onChange={(e) => setSell(Number(e.target.value))} className={num} />% off
          </span>
        </label>
        <div className="pb-2">
          <span className="block text-xs font-bold uppercase tracking-wider text-muted">Our margin</span>
          <span className={`text-lg font-extrabold ${buy - sell > 0 ? 'text-save' : 'text-red-600'}`}>{buy - sell}%</span>
        </div>
        {dirty && (
          <Button size="sm" className="ml-auto" onClick={() => save({ buyDiscount: buy, sellDiscount: sell })}>
            Save
          </Button>
        )}
      </div>
      {msg && <p className="mt-3 text-sm font-semibold text-red-600">{msg}</p>}
    </Panel>
  )
}

function NewBrand({ open, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', category: '', tagline: '', color: '#1f2937' })
  const [error, setError] = useState('')
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const submit = async (e) => {
    e.preventDefault()
    try {
      await api('/admin/brands', { method: 'POST', body: f })
      onSaved()
      onClose()
      setF({ name: '', category: '', tagline: '', color: '#1f2937' })
    } catch (err) {
      setError(err.message)
    }
  }
  const input = 'h-14 w-full rounded-2xl border-2 border-line bg-white px-4 text-lg font-semibold outline-none focus:border-ink'
  return (
    <Modal open={open} onClose={onClose} label="New brand">
      <form onSubmit={submit} className="grid gap-4">
        <SheetTitle title="New brand">Starts at 20% buy / 15% sell — change it after.</SheetTitle>
        <label>
          <span className="mb-1.5 block text-sm font-bold">Name</span>
          <input data-autofocus required maxLength={60} value={f.name} onChange={set('name')} className={input} />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-bold">Category</span>
          <input maxLength={40} placeholder="e.g. Pizza" value={f.category} onChange={set('category')} className={input} />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-bold">Short description</span>
          <input maxLength={80} value={f.tagline} onChange={set('tagline')} className={input} />
        </label>
        <label className="flex items-center justify-between rounded-2xl border-2 border-line px-4 py-3">
          <span className="font-bold">Card color</span>
          <input type="color" value={f.color} onChange={set('color')} className="h-10 w-16 cursor-pointer rounded-lg" />
        </label>
        {error && <p className="font-semibold text-red-600">{error}</p>}
        <Button type="submit" size="lg" block>
          Add brand
        </Button>
      </form>
    </Modal>
  )
}

// ---------------- Customers ----------------
function Customers() {
  const { data } = useLoad('/admin/customers')
  const rows = useMemo(() => [...(data ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [data])
  return (
    <>
      <PageHead title="Customers" sub="Who’s holding a balance and what they’ve bought." />
      {rows.length === 0 ? (
        <Panel className="p-8 text-muted">No customers yet. Sign up in the customer app.</Panel>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-b border-line text-sm text-muted">
              <tr>
                {['Customer', 'Joined', 'Deposited', 'Spent', 'Cards', 'Balance'].map((h) => (
                  <th key={h} className="px-5 py-4 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3.5">
                    <span className="block font-semibold">{u.name || 'No name yet'}</span>
                    <span className="block text-sm text-muted">{u.email}</span>
                  </td>
                  <td className="px-5 py-3.5 text-muted">{ago(u.createdAt)}</td>
                  <td className="tabular px-5 py-3.5">{money(u.deposited)}</td>
                  <td className="tabular px-5 py-3.5">{money(u.spent)}</td>
                  <td className="tabular px-5 py-3.5">{u.cards}</td>
                  <td className="tabular px-5 py-3.5 font-bold">{money(u.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  )
}

function ResetButton() {
  return (
    <button
      onClick={async () => {
        if (!confirm('Reset all demo data? Customers, sales and inventory go back to the seed.')) return
        await api('/admin/reset', { method: 'POST' })
        location.reload()
      }}
      className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-red-600"
    >
      <RotateCcw className="size-4" /> Reset demo data
    </button>
  )
}
