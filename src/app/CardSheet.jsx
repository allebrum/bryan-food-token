import { useEffect, useState } from 'react'
import Barcode from 'react-barcode'
import { QRCodeSVG } from 'qrcode.react'
import { Eye, EyeOff, Sun, Pencil, Check, ExternalLink } from 'lucide-react'
import Modal, { SheetTitle } from '../components/Modal'
import Button from '../components/Button'
import { api } from '../lib/api'
import { money, onColor, groupCard, ago, initials } from '../lib/format'
import { useAccount } from './AppRoot'

export default function CardSheet({ cardId, onClose }) {
  const { me, setMe } = useAccount()
  const [view, setView] = useState('pass')
  const [showPin, setShowPin] = useState(false)
  const [toast, setToast] = useState('')
  const [secret, setSecret] = useState(null) // { number, pin, egiftUrl, barcodeFormat }
  const [secretError, setSecretError] = useState('')

  useEffect(() => {
    setView('pass')
    setShowPin(false)
    setToast('')
    setSecret(null)
    setSecretError('')
    if (!cardId) return
    let live = true
    api(`/cards/${cardId}/secret`).then(
      (s) => live && setSecret(s),
      (e) => live && setSecretError(e.message),
    )
    return () => {
      live = false
    }
  }, [cardId])

  const card = cardId && me.cards.find((c) => c.id === cardId)
  if (!card) return null
  const fg = onColor(card.brand.color)
  const subtle = fg === '#ffffff' ? 'rgba(255,255,255,.65)' : 'rgba(0,0,0,.55)'

  return (
    <Modal
      open
      step={view}
      onClose={onClose}
      onBack={view === 'balance' ? () => setView('pass') : undefined}
      label={`${card.brand.name} gift card`}
    >
      {view === 'pass' && (
        <>
          {/* The pass */}
          <div
            className="overflow-hidden rounded-[var(--radius-pass)] shadow-[var(--shadow-pass)]"
            style={{ background: card.brand.color, color: fg }}
          >
            <div className="flex items-center justify-between gap-3 p-5 pb-0">
              <span className="flex items-center gap-3">
                <span
                  className="grid size-10 place-items-center rounded-xl text-sm font-extrabold"
                  style={{ background: fg === '#ffffff' ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.08)' }}
                >
                  {initials(card.brand.name)}
                </span>
                <span className="text-lg font-bold">{card.brand.name}</span>
              </span>
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: subtle }}>
                Gift card
              </span>
            </div>
            <div className="p-5">
              <span className="block text-[11px] font-bold uppercase tracking-widest" style={{ color: subtle }}>
                Balance
              </span>
              <span className="tabular block text-5xl font-extrabold tracking-tight">{money(card.balance)}</span>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <Field label="Card value" value={money(card.faceValue)} subtle={subtle} />
                {card.hasPin ? (
                  <Field label="PIN" subtle={subtle}>
                    <button onClick={() => setShowPin((s) => !s)} className="tabular flex items-center gap-2 font-bold" aria-label={showPin ? 'Hide PIN' : 'Show PIN'}>
                      {showPin ? secret?.pin ?? '…' : '••••'}
                      {showPin ? <EyeOff className="size-4 opacity-70" /> : <Eye className="size-4 opacity-70" />}
                    </button>
                  </Field>
                ) : card.expiresOn ? (
                  <Field label="Expires" value={fmtDate(card.expiresOn)} subtle={subtle} />
                ) : null}
              </div>
            </div>
            <div className="mx-4 mb-4 rounded-2xl bg-white p-4 text-ink">
              <div className="flex min-h-[150px] items-center justify-center">
                {secret ? (
                  <CardCode secret={secret} />
                ) : secretError ? (
                  <p className="text-center font-semibold text-red-600">{secretError}</p>
                ) : (
                  <span className="size-8 animate-spin rounded-full border-4 border-line border-t-ink" aria-label="Loading card" />
                )}
              </div>
              <p className="tabular mt-3 text-center font-mono text-[15px] tracking-wider text-ink-2">
                {secret ? groupCard(secret.number) : `•••• ${card.last4}`}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            {secret?.egiftUrl ? (
              <a
                href={secret.egiftUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-canvas px-4 text-sm font-semibold hover:bg-line"
              >
                <ExternalLink className="size-4" /> Open e-gift card
              </a>
            ) : (
              <span />
            )}
            {card.hasPin && card.expiresOn && <span className="text-sm text-muted">Expires {fmtDate(card.expiresOn)}</span>}
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <Sun className="size-4" /> Turn brightness up
            </span>
          </div>

          {toast && (
            <p role="status" className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-save-soft py-3 font-semibold text-save">
              <Check className="size-5" /> {toast}
            </p>
          )}

          <Button size="lg" block className="mt-5" onClick={() => setView('balance')}>
            <Pencil className="size-5" /> Update balance
          </Button>

          <details className="group mt-6">
            <summary className="cursor-pointer list-none font-semibold text-muted hover:text-ink">
              Balance history ({card.balanceHistory.length})
            </summary>
            <ul className="mt-3 divide-y divide-line">
              {[...card.balanceHistory].reverse().map((h, i) => (
                <li key={i} className="flex justify-between py-3 text-[15px]">
                  <span>
                    {h.note} <span className="text-muted">· {ago(h.at)}</span>
                  </span>
                  <span className="tabular font-semibold">{money(h.balance)}</span>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}

      {view === 'balance' && (
        <BalanceStep
          card={card}
          onSaved={(next, cents) => {
            setMe(next)
            setView('pass')
            setToast(cents === 0 ? 'All used up — moved to used cards' : `Balance updated to ${money(cents)}`)
          }}
        />
      )}
    </Modal>
  )
}

const fmtDate = (d) => new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// Render the code the card actually uses at the register. Invalid EAN/UPC
// data falls back to Code 128 rather than crashing the sheet.
function CardCode({ secret }) {
  const { number, barcodeFormat: f } = secret
  if (f === 'NONE') return <p className="text-center text-muted">Give the cashier the card number below.</p>
  if (f === 'QR') return <QRCodeSVG value={number} size={150} level="M" marginSize={0} />
  const valid = { EAN13: /^\d{12,13}$/, UPC: /^\d{11,12}$/, CODE39: /^[0-9A-Z \-.$/+%]+$/ }[f]
  const format = valid && !valid.test(number) ? 'CODE128' : f
  return <Barcode value={number} format={format} height={92} width={number.length > 18 ? 1.5 : 2} margin={0} displayValue={false} background="#ffffff" />
}

function Field({ label, value, subtle, children }) {
  return (
    <div>
      <span className="block text-[11px] font-bold uppercase tracking-widest" style={{ color: subtle }}>
        {label}
      </span>
      {children ?? <span className="tabular block font-bold">{value}</span>}
    </div>
  )
}

function BalanceStep({ card, onSaved }) {
  const [value, setValue] = useState((card.balance / 100).toFixed(2))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async (raw) => {
    const n = Number(String(raw).replace(/[$,\s]/g, ''))
    if (!Number.isFinite(n) || n < 0) return setError('Enter an amount like 12.50')
    setBusy(true)
    setError('')
    try {
      const next = await api(`/cards/${card.id}/balance`, { method: 'POST', body: { balance: n } })
      onSaved(next, Math.round(n * 100))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save(value)
      }}
    >
      <SheetTitle title={`What’s left on your ${card.brand.name} card?`}>
        Check your receipt — it usually prints the remaining balance.
      </SheetTitle>
      <label className="sr-only" htmlFor="bal">
        Remaining balance in dollars
      </label>
      <div className="flex items-center rounded-3xl border-2 border-line px-6 focus-within:border-ink">
        <span className="text-4xl font-extrabold text-muted">$</span>
        <input
          id="bal"
          data-autofocus
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="tabular h-24 w-full bg-transparent pl-2 text-5xl font-extrabold outline-none"
        />
      </div>
      <p className="mt-3 text-[15px] text-muted">Was {money(card.balance)} · card value {money(card.faceValue)}</p>
      {error && (
        <p role="alert" className="mt-3 font-semibold text-red-600">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" block className="mt-7" disabled={busy}>
        Save balance
      </Button>
      <Button size="lg" variant="soft" block className="mt-3" onClick={() => save(0)} disabled={busy}>
        I used it all
      </Button>
    </form>
  )
}
