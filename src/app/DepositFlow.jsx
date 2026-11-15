import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check, AlertTriangle, ChevronRight, Sparkles } from 'lucide-react'
import Modal, { SheetTitle, StepDots } from '../components/Modal'
import Button from '../components/Button'
import { api } from '../lib/api'
import { COIN_COPY } from '../lib/coins'
import { money } from '../lib/format'
import { useAccount } from './AppRoot'

// 1 pick coin → 2 your address → 3 waiting / arrived
export default function DepositFlow({ open, onClose }) {
  const { me, setMe } = useAccount()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [coin, setCoin] = useState(null)
  const [depositId, setDepositId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setStep(0)
      setCoin(null)
      setDepositId(null)
      setError('')
    }
  }, [open])

  const wallet = coin && me.wallets.find((w) => w.coin === coin)
  const deposit = depositId && me.activity.find((a) => a.id === depositId)
  const arrived = deposit?.status === 'complete'

  const simulate = async (usd) => {
    setError('')
    try {
      const before = new Set(me.pending.map((p) => p.id))
      const next = await api('/deposits/simulate', { method: 'POST', body: { coin, usd } })
      setMe(next)
      const d = next.pending.find((p) => !before.has(p.id))
      setDepositId(d?.id ?? null)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Modal open={open} step={`${step}${depositId ? 'd' : ''}`} onClose={onClose} onBack={step === 1 ? () => setStep(0) : undefined} label="Add crypto">
      <div className="mb-6">
        <StepDots step={step} total={3} />
      </div>

      {step === 0 && (
        <>
          <SheetTitle title="Which crypto do you have?">Not sure? Choose USDC — it’s a digital dollar.</SheetTitle>
          <ul className="grid gap-3">
            {me.wallets
              .slice()
              .sort((a, b) => (a.coin === 'USDC' ? -1 : b.coin === 'USDC' ? 1 : 0))
              .map((w, i) => (
                <li key={w.coin}>
                  <button
                    data-autofocus={i === 0 ? true : undefined}
                    onClick={() => {
                      setCoin(w.coin)
                      setStep(1)
                    }}
                    className="flex w-full items-center gap-4 rounded-2xl border-2 border-line p-4 text-left transition hover:border-ink/40"
                  >
                    <CoinBadge coin={w.coin} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-lg font-bold">
                        {w.name}
                        {COIN_COPY[w.coin]?.badge && (
                          <span className="rounded-full bg-save-soft px-2 py-0.5 text-xs font-bold text-save">{COIN_COPY[w.coin].badge}</span>
                        )}
                      </span>
                      <span className="block text-[15px] text-muted">{COIN_COPY[w.coin]?.blurb}</span>
                    </span>
                    <ChevronRight className="size-5 text-muted" />
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}

      {step === 1 && wallet && (
        <>
          <SheetTitle title={`Send ${wallet.coin} to your address`}>
            Copy this address into the app where your crypto is (like Coinbase), or scan the code.
          </SheetTitle>
          <div className="flex flex-col items-center">
            <div className="rounded-3xl border-2 border-line p-4">
              <QRCodeSVG value={wallet.address} size={184} level="M" marginSize={0} />
            </div>
            <AddressCopy address={wallet.address} />
          </div>
          <p className="mt-5 rounded-2xl bg-red-50 p-4 text-[15px] font-semibold text-red-800">
            Demo address — not a real wallet. Don’t send real crypto. Use the demo buttons on the next step instead.
          </p>
          <div className="mt-3 flex gap-3 rounded-2xl bg-amber-50 p-4 text-[15px] text-amber-900">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <p>
              Only send <b>{wallet.coin}</b> on the <b>{wallet.network}</b> network. Anything else may be lost.
            </p>
          </div>
          <p className="mt-4 text-center text-[15px] text-muted">
            1 {wallet.coin} ≈ {money(wallet.usd * 100)} · converted to dollars when it arrives
          </p>
          <Button size="lg" block className="mt-6" onClick={() => setStep(2)}>
            I’ve sent it
          </Button>
        </>
      )}

      {step === 2 && (
        <div className="text-center">
          {!deposit && (
            <>
              <div className="relative mx-auto mb-6 grid size-20 place-items-center">
                <span className="absolute size-20 animate-ping rounded-full bg-accent/20" />
                <span className="relative size-5 rounded-full bg-accent" />
              </div>
              <SheetTitle title="Watching for your crypto">
                Most transfers show up in a few minutes. You can close this — we’ll add it to your balance automatically.
              </SheetTitle>
              <div className="rounded-2xl border-2 border-dashed border-line p-5 text-left">
                <p className="mb-3 flex items-center gap-2 font-bold">
                  <Sparkles className="size-4 text-accent" /> Demo: pretend you sent
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[25, 50, 100, 250].map((v) => (
                    <button key={v} onClick={() => simulate(v)} className="h-12 rounded-xl bg-canvas font-bold hover:bg-line">
                      ${v}
                    </button>
                  ))}
                </div>
                {error && (
                  <p role="alert" className="mt-3 font-semibold text-red-600">
                    {error}
                  </p>
                )}
              </div>
              <Button size="lg" variant="ghost" block className="mt-4" onClick={onClose}>
                Close
              </Button>
            </>
          )}

          {deposit && !arrived && (
            <div role="status">
              <div className="mx-auto mb-8 size-20 animate-spin rounded-full border-[6px] border-line border-t-accent" />
              <SheetTitle title="Found it! Confirming…">
                {deposit.detail} is on its way. Networks double-check every transfer — this usually takes a moment.
              </SheetTitle>
            </div>
          )}

          {arrived && (
            <>
              <div className="mx-auto mb-6 grid size-20 animate-pop place-items-center rounded-full bg-save text-white">
                <Check className="size-10" strokeWidth={3} />
              </div>
              <SheetTitle title={`${money(deposit.cents)} added`}>Your wallet now has {money(me.balance)} to spend.</SheetTitle>
              <Button
                size="lg"
                variant="accent"
                block
                onClick={() => {
                  onClose()
                  navigate('/app/stores')
                }}
              >
                Buy a gift card
              </Button>
              <Button size="lg" variant="ghost" block className="mt-2" onClick={onClose}>
                Done
              </Button>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

export function CoinBadge({ coin, size = 'size-12' }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-white ${size}`}
      style={{ background: COIN_COPY[coin]?.tint ?? '#111' }}
      aria-hidden="true"
    >
      {coin}
    </span>
  )
}

function AddressCopy({ address }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked: the address is selectable */
    }
  }
  return (
    <div className="mt-5 w-full">
      <p className="mb-2 text-center text-sm font-semibold text-muted">Your deposit address (demo)</p>
      <button
        onClick={copy}
        className="flex w-full items-center gap-3 rounded-2xl bg-canvas p-4 text-left hover:bg-line"
        aria-label={copied ? 'Address copied' : 'Copy address'}
      >
        <span className="min-w-0 flex-1 break-all font-mono text-[15px] leading-snug select-all">{address}</span>
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${copied ? 'bg-save text-white' : 'bg-white'}`}>
          {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
        </span>
      </button>
      <p aria-live="polite" className="mt-2 h-5 text-center text-sm font-semibold text-save">
        {copied ? 'Copied!' : ''}
      </p>
    </div>
  )
}
