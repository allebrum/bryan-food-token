import { useEffect, useRef, useState } from 'react'
import { Search, MapPin, Navigation, X } from 'lucide-react'
import BrandMark from '../components/BrandMark'
import { api } from '../lib/api'
import { pct } from '../lib/format'
import { useAccount } from './AppRoot'

export default function ShopPage() {
  const { openBuy } = useAccount()
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [data, setData] = useState({ stores: [], categories: [] })
  const [loading, setLoading] = useState(true)
  const [loc, setLoc] = useState(null) // { lat, lng } when the browser shares it
  const [locState, setLocState] = useState('idle')
  const req = useRef(0)

  useEffect(() => {
    const id = ++req.current
    const t = setTimeout(async () => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (category) params.set('category', category)
      if (loc) params.set('lat', loc.lat.toFixed(2))
      try {
        const res = await api(`/stores?${params}`)
        if (id === req.current) setData(res)
      } finally {
        if (id === req.current) setLoading(false)
      }
    }, q ? 180 : 0)
    return () => clearTimeout(t)
  }, [q, category, loc])

  const locate = () => {
    if (!navigator.geolocation) return setLocState('denied')
    setLocState('asking')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoc({ lat: p.coords.latitude, lng: p.coords.longitude })
        setLocState('on')
      },
      () => setLocState('denied'),
      { timeout: 8000, maximumAge: 600000 },
    )
  }

  return (
    <div>
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Where are you eating?</h1>
      <p className="mt-3 text-lg text-muted">Every card is discounted. Pay less than face value, spend the full amount.</p>

      <div className="sticky top-[72px] z-20 -mx-5 mt-8 bg-canvas/90 px-5 pb-4 pt-2 backdrop-blur-xl sm:-mx-8 sm:px-8">
        <label className="relative block">
          <span className="sr-only">Search stores</span>
          <Search className="pointer-events-none absolute left-5 top-1/2 size-6 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Starbucks, burgers, coffee…"
            maxLength={60}
            className="h-16 w-full rounded-full bg-white pl-14 pr-14 text-lg font-semibold shadow-[var(--shadow-soft)] outline-none placeholder:font-normal placeholder:text-muted/70 focus:ring-2 focus:ring-ink [&::-webkit-search-cancel-button]:hidden"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              className="absolute right-4 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-canvas"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </label>

        <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <button
            onClick={locState === 'on' ? undefined : locate}
            className={`flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[15px] font-semibold ${
              locState === 'on' ? 'bg-accent-soft text-accent' : 'bg-white shadow-[var(--shadow-soft)] hover:bg-white/70'
            }`}
          >
            {locState === 'on' ? <MapPin className="size-4" /> : <Navigation className="size-4" />}
            {locState === 'on' ? 'Near you' : locState === 'asking' ? 'Finding you…' : locState === 'denied' ? 'Denver, CO' : 'Use my location'}
          </button>
          <span className="my-2 w-px shrink-0 bg-line" />
          {['', ...data.categories].map((c) => (
            <button
              key={c || 'all'}
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`h-11 shrink-0 rounded-full px-5 text-[15px] font-semibold transition ${
                category === c ? 'bg-ink text-white' : 'bg-white text-ink-2 shadow-[var(--shadow-soft)] hover:bg-white/70'
              }`}
            >
              {c || 'All'}
            </button>
          ))}
        </div>
      </div>

      {!loading && data.stores.length === 0 ? (
        <div className="mt-10 rounded-[var(--radius-pass)] bg-white p-10 text-center shadow-[var(--shadow-soft)]">
          <p className="text-xl font-bold">No stores match “{q}”</p>
          <p className="mt-2 text-muted">Try a different name, or browse a category.</p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.stores.map((s) => {
            const soldOut = s.denominations.length === 0
            return (
              <li key={s.id}>
                <button
                  onClick={() => openBuy(s)}
                  disabled={soldOut}
                  className="group flex h-full w-full flex-col rounded-[var(--radius-pass)] bg-white p-6 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pass)] disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <BrandMark brand={s} size="size-14" text="text-lg" />
                    {soldOut ? (
                      <span className="rounded-full bg-canvas px-3 py-1 text-sm font-bold text-muted">Sold out</span>
                    ) : (
                      <span className="rounded-full bg-save-soft px-3 py-1 text-sm font-bold text-save">Save {pct(s.discount)}</span>
                    )}
                  </div>
                  <p className="mt-5 text-xl font-bold">{s.name}</p>
                  <p className="mt-1 text-muted">{s.tagline}</p>
                  <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-ink-2">
                    <MapPin className="size-4 text-muted" />
                    {s.nearest} mi · {s.locations.length} nearby
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
