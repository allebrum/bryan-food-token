import { useEffect, useState } from 'react'
import { Check, MapPin, ArrowDown } from 'lucide-react'
import Modal, { SheetTitle, StepDots } from '../components/Modal'
import Button from '../components/Button'
import BrandMark from '../components/BrandMark'
import GiftCardPass from '../components/GiftCardPass'
import { api } from '../lib/api'
import { money, pct } from '../lib/format'
import { useAccount } from './AppRoot'

// 1 choose amount → 2 review → 3 it's in your wallet
export default function BuyFlow({ store, onClose }) {
  const { me, setMe, openDeposit, openCard } = useAccount()
  const [step, setStep] = useState(0)
  const [denom, setDenom] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [card, setCard] = useState(null)

  useEffect(() => {
    if (store) {
      setStep(0)
      setDenom(null)
      setError('')
      setCard(null)
    }
  }, [store])

  if (!store) return null
  const short = denom ? Math.max(0, denom.price - me.balance) : 0

  const buy = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api('/purchase', { method: 'POST', body: { storeId: store.id, faceValue: denom.faceValue } })
      setCard(res.card)
      setMe(res.me)
      setStep(2)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open step={step} onClose={onClose} onBack={step === 1 ? () => setStep(0) : undefined} label={`Buy a ${store.name} gift card`}>
      {step < 2 && (
        <div className="mb-6">
          <StepDots step={step} total={2} />
        </div>
      )}

      {step === 0 && (
        <>
          <div className="mb-6 flex items-center gap-4">
            <BrandMark brand={store} size="size-16" text="text-xl" />
            <div>
              <p className="text-2xl font-extrabold tracking-tight">{store.name}</p>
              <p className="font-semibold text-save">Save {pct(store.discount)} on every card</p>
            </div>
          </div>
          <SheetTitle title="How much would you like?" />
          <div className="grid grid-cols-2 gap-3">
            {store.denominations.map((d, i) => (
              <button
                key={d.faceValue}
                data-autofocus={i === 0 ? true : undefined}
                onClick={() => {
                  setDenom(d)
                  setStep(1)
                }}
                className="rounded-2xl border-2 border-line p-4 text-left transition hover:border-ink"
              >
                <span className="tabular block text-3xl font-extrabold">{money(d.faceValue, { whole: true })}</span>
                <span className="mt-1 block text-[15px] text-muted">
                  You pay <b className="text-ink">{money(d.price)}</b>
                </span>
                {d.inStock <= 2 && <span className="mt-2 block text-xs font-bold text-accent">Only {d.inStock} left</span>}
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-2xl bg-canvas p-4">
            <p className="mb-2 text-sm font-bold text-muted">Nearest locations</p>
            <ul className="grid gap-1.5">
              {store.locations.slice(0, 3).map((l) => (
                <li key={l.address} className="flex items-center justify-between text-[15px]">
                  <span className="flex items-center gap-2">
                    <MapPin className="size-4 text-muted" /> {l.address}
                  </span>
                  <span className="text-muted">{l.miles} mi</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {step === 1 && denom && (
        <>
          <SheetTitle title="Review your card" />
          <div className="rounded-3xl bg-canvas p-6">
            <Row label="You pay" value={money(denom.price)} big />
            <div className="my-3 flex justify-center text-muted">
              <ArrowDown className="size-5" />
            </div>
            <Row label={`${store.name} gift card`} value={money(denom.faceValue)} big />
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-save-soft px-4 py-3 font-bold text-save">
              <span>You save</span>
              <span className="tabular">{money(denom.faceValue - denom.price)}</span>
            </div>
          </div>
          <div className="mt-5 flex justify-between px-1 text-[15px] text-muted">
            <span>Wallet balance</span>
            <span className="tabular">
              {money(me.balance)} → <b className={short ? 'text-red-600' : 'text-ink'}>{short ? 'not enough' : money(me.balance - denom.price)}</b>
            </span>
          </div>
          {error && (
            <p role="alert" className="mt-4 font-semibold text-red-600">
              {error}
            </p>
          )}
          {short > 0 ? (
            <>
              <p className="mt-6 text-center font-semibold">You need {money(short)} more.</p>
              <Button size="lg" variant="accent" block className="mt-3" onClick={openDeposit}>
                Add crypto
              </Button>
            </>
          ) : (
            <Button size="lg" block className="mt-7" onClick={buy} disabled={busy} data-autofocus>
              {busy ? 'Buying…' : `Buy for ${money(denom.price)}`}
            </Button>
          )}
        </>
      )}

      {step === 2 && card && (
        <div className="text-center">
          <div className="mx-auto mb-6 grid size-16 animate-pop place-items-center rounded-full bg-save text-white">
            <Check className="size-8" strokeWidth={3} />
          </div>
          <SheetTitle title="It’s in your wallet">Show the barcode at the register. Update the balance after you use it.</SheetTitle>
          <div className="animate-sheet">
            <GiftCardPass card={card} />
          </div>
          <Button size="lg" block className="mt-8" onClick={() => openCard(card.id)} data-autofocus>
            Show card
          </Button>
          <Button size="lg" variant="ghost" block className="mt-2" onClick={onClose}>
            Done
          </Button>
        </div>
      )}
    </Modal>
  )
}

function Row({ label, value, big }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="font-semibold text-ink-2">{label}</span>
      <span className={`tabular font-extrabold ${big ? 'text-3xl' : ''}`}>{value}</span>
    </div>
  )
}
