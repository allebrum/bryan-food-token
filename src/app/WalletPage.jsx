import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ShoppingBag, ArrowDownLeft, CreditCard, Info, Search } from 'lucide-react'
import Button from '../components/Button'
import GiftCardPass from '../components/GiftCardPass'
import Stack from '../components/Stack'
import { LogoMark } from '../components/Logo'
import { money, ago } from '../lib/format'
import { useAccount } from './AppRoot'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function WalletPage() {
  const { me, openDeposit, openCard } = useAccount()
  const [showUsed, setShowUsed] = useState(false)
  const active = me.cards.filter((c) => c.balance > 0)
  const used = me.cards.filter((c) => c.balance === 0)
  const cardTotal = active.reduce((s, c) => s + c.balance, 0)
  const pendingCents = me.pending.reduce((s, d) => s + d.usdCents, 0)

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14">
      <div className="min-w-0">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          {greeting()}, {me.name}
        </h1>

        {/* Balance pass */}
        <section
          aria-label="Wallet balance"
          className="relative mt-6 overflow-hidden rounded-[var(--radius-pass)] bg-ink p-7 text-white shadow-[var(--shadow-pass)] sm:p-9"
        >
          <span className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-accent/25 blur-3xl" />
          <div className="relative flex items-start justify-between">
            <p className="text-sm font-semibold uppercase tracking-wider text-white/55">Available to spend</p>
            <LogoMark className="size-9" />
          </div>
          <p className="tabular relative mt-3 text-6xl font-extrabold tracking-tight sm:text-7xl">{money(me.balance)}</p>
          <p className="relative mt-2 flex items-center gap-1.5 text-white/60">
            In US dollars — your balance doesn’t move with crypto prices.
          </p>

          {me.pending.map((d) => (
            <PendingRow key={d.id} d={d} />
          ))}

          <div className="relative mt-8 grid grid-cols-2 gap-3">
            <Button variant="soft" size="lg" className="!bg-white !px-4 !text-ink hover:!bg-white/85 sm:!px-8" onClick={openDeposit}>
              <Plus className="size-5" /> Add crypto
            </Button>
            <Button as={Link} to="/app/stores" variant="accent" size="lg" className="!px-4 sm:!px-8">
              <ShoppingBag className="size-5" /> Buy a card
            </Button>
          </div>
        </section>

        {/* quick stats */}
        <div className="mt-5 grid grid-cols-2 gap-4">
          <Stat label="On your gift cards" value={money(cardTotal)} />
          <Stat label="You’ve saved" value={money(me.saved)} tone="save" />
        </div>

        {/* Cards */}
        <section className="mt-12" aria-labelledby="cards-h">
          <div className="mb-5 flex items-end justify-between">
            <h2 id="cards-h" className="text-2xl font-extrabold tracking-tight">
              Your gift cards
            </h2>
            {active.length > 0 && <span className="font-semibold text-muted">{active.length} active</span>}
          </div>

          {active.length === 0 ? (
            <EmptyCards hasBalance={me.balance > 0} onDeposit={openDeposit} />
          ) : (
            <div className="max-w-xl">
              <Stack step={active.length > 4 ? 60 : 76}>
                {active.map((c) => (
                  <GiftCardPass key={c.id} card={c} onClick={() => openCard(c.id)} />
                ))}
              </Stack>
              <p className="mt-4 text-center text-sm text-muted">Tap a card to show its barcode at the register.</p>
            </div>
          )}

          {used.length > 0 && (
            <div className="mt-8">
              <button onClick={() => setShowUsed((s) => !s)} className="font-semibold text-muted underline-offset-4 hover:underline" aria-expanded={showUsed}>
                {showUsed ? 'Hide' : 'Show'} used cards ({used.length})
              </button>
              {showUsed && (
                <div className="mt-4 grid max-w-xl gap-3">
                  {used.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => openCard(c.id)}
                      className="flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-left shadow-[var(--shadow-soft)]"
                    >
                      <span className="flex items-center gap-3">
                        <span className="size-3 rounded-full" style={{ background: c.brand.color }} />
                        <span className="font-semibold">{c.brand.name}</span>
                        <span className="text-muted">•••• {c.last4}</span>
                      </span>
                      <span className="text-muted">Used up</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Activity */}
      <aside aria-labelledby="act-h" className="lg:pt-[68px]">
        <h2 id="act-h" className="mb-5 text-2xl font-extrabold tracking-tight">
          Activity
        </h2>
        {me.activity.length === 0 ? (
          <div className="rounded-[var(--radius-pass)] bg-white p-7 text-muted shadow-[var(--shadow-soft)]">
            <p className="text-lg font-semibold text-ink">Nothing here yet</p>
            <p className="mt-1">Crypto you add and cards you buy will show up here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-pass)] bg-white shadow-[var(--shadow-soft)]">
            {me.activity.map((a) => (
              <li key={a.id} className="flex items-center gap-4 px-5 py-4">
                <span
                  className={`grid size-11 shrink-0 place-items-center rounded-full ${a.type === 'deposit' ? 'bg-save-soft text-save' : 'bg-canvas text-ink'}`}
                >
                  {a.type === 'deposit' ? <ArrowDownLeft className="size-5" /> : <CreditCard className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{a.title}</span>
                  <span className="block truncate text-sm text-muted">
                    {a.status === 'confirming' ? 'Confirming…' : a.detail} · {ago(a.at)}
                  </span>
                </span>
                <span className={`tabular font-bold ${a.cents > 0 ? 'text-save' : ''} ${a.status === 'confirming' ? 'opacity-50' : ''}`}>
                  {a.cents > 0 ? '+' : '−'}
                  {money(Math.abs(a.cents))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}

function Stat({ label, value, tone }) {
  return (
    <div className="rounded-[var(--radius-pass)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className={`tabular mt-1 text-2xl font-extrabold sm:text-3xl ${tone === 'save' ? 'text-save' : ''}`}>{value}</p>
    </div>
  )
}

function PendingRow({ d }) {
  const elapsed = Date.now() - new Date(d.createdAt).getTime()
  const pct = Math.min(100, Math.round((elapsed / d.confirmMs) * 100))
  return (
    <div className="relative mt-5 rounded-2xl bg-white/10 p-4" role="status">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">
          +{money(d.usdCents)} arriving <span className="font-normal text-white/60">· {d.amount} {d.coin}</span>
        </span>
        <span className="text-sm text-white/60">Confirming</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-accent transition-all duration-1000" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function EmptyCards({ hasBalance, onDeposit }) {
  return (
    <div className="grid aspect-[1.586] max-w-xl place-items-center rounded-[var(--radius-pass)] border-2 border-dashed border-line bg-white/60 p-8 text-center">
      <div>
        <p className="text-xl font-bold">No gift cards yet</p>
        <p className="mx-auto mt-2 max-w-xs text-muted">
          {hasBalance ? 'Pick a store and your first card lands right here.' : 'Add crypto, then pick a store. Your cards will live here.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {hasBalance ? (
            <Button as={Link} to="/app/stores">
              <Search className="size-4" /> Find a store
            </Button>
          ) : (
            <Button onClick={onDeposit}>
              <Plus className="size-4" /> Add crypto
            </Button>
          )}
        </div>
        {!hasBalance && (
          <p className="mt-5 flex items-center justify-center gap-1.5 text-sm text-muted">
            <Info className="size-4" /> Takes about a minute
          </p>
        )}
      </div>
    </div>
  )
}
