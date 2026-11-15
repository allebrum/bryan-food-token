import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check, AlertTriangle, ChevronRight, Sparkles } from 'lucide-react'
import Modal, { SheetTitle, StepDots } from '../components/Modal'
import Button from '../components/Button'
import { api } from '../lib/api'
import { COIN_COPY, NETWORK_HINT } from '../lib/coins'
import { money } from '../lib/format'
import { useAccount } from './AppRoot'
import { DepositHelp } from './DepositHelp'

// coin → network (only if there's a choice) → address → watching/arrived
export default function DepositFlow({ open, onClose }) {
  const { me, setMe, refresh } = useAccount()
  const navigate = useNavigate()
  const [step, setStep] = useState('coin')
  const [coin, setCoin] = useState(null)
  const [network, setNetwork] = useState(null)
  const [error, setError] = useState('')
  const known = useRef(new Set())

  useEffect(() => {
    if (!open) return
    setStep('coin')
    setCoin(null)
    setNetwork(null)
    setError('')
    known.current = new Set(me.activity.filter((a) => a.type === 'deposit').map((a) => a.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const wallet = coin && me.wallets.find((w) => w.coin === coin)
  const net = wallet && wallet.networks.find((n) => n.key === network)
  // The first deposit that wasn't there when the sheet opened.
  const deposit = me.activity.find((a) => a.type === 'deposit' && !known.current.has(a.id))
  const pending = deposit && me.pending.find((p) => p.id === deposit.id)

  // Poll while watching for a real deposit to show up on-chain.
  useEffect(() => {
    if (!open || step !== 'watch' || wallet?.demo || (deposit && deposit.status !== 'confirming')) return
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [open, step, wallet?.demo, deposit, refresh])

  const pickCoin = (w) => {
    setCoin(w.coin)
    if (w.networks.length === 1) {
      setNetwork(w.networks[0].key)
      setStep('address')
    } else setStep('network')
  }

  const simulate = async (usd) => {
    setError('')
    try {
      setMe(await api('/deposits/simulate', { method: 'POST', body: { coin, usd } }))
    } catch (e) {
      setError(e.message)
    }
  }

  const steps = ['coin', ...(wallet && wallet.networks.length > 1 ? ['network'] : []), 'address', 'watch']
  const back = { network: 'coin', address: wallet?.networks.length > 1 ? 'network' : 'coin' }[step]

  return (
    <Modal open={open} step={`${step}${deposit ? ':' + deposit.status : ''}`} onClose={onClose} onBack={back ? () => setStep(back) : undefined} label="Add crypto">
      {me.wallets.length > 0 && (
        <div className="mb-6">
          <StepDots step={steps.indexOf(step)} total={steps.length} />
        </div>
      )}

      {step === 'coin' && me.wallets.length === 0 && (
        <div className="text-center">
          <SheetTitle title="Crypto deposits open soon">
            We’re finishing your personal deposit addresses. We’ll email you the moment you can add crypto.
          </SheetTitle>
          <Button size="lg" block onClick={onClose} data-autofocus>
            Got it
          </Button>
        </div>
      )}

      {step === 'coin' && me.wallets.length > 0 && (
        <>
          <SheetTitle title="Which crypto do you have?">Not sure? Choose USDC — it’s a digital dollar.</SheetTitle>
          <ul className="grid gap-3">
            {me.wallets.map((w, i) => (
              <li key={w.coin}>
                <button
                  data-autofocus={i === 0 ? true : undefined}
                  onClick={() => pickCoin(w)}
                  className="flex w-full items-center gap-4 rounded-2xl border-2 border-line p-4 text-left transition hover:border-ink/40"
                >
                  <CoinBadge coin={w.coin} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-lg font-bold">
                      {w.name}
                      {COIN_COPY[w.coin]?.badge && <span className="rounded-full bg-save-soft px-2 py-0.5 text-xs font-bold text-save">{COIN_COPY[w.coin].badge}</span>}
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

      {step === 'network' && wallet && (
        <>
          <SheetTitle title={`Which network are you sending ${wallet.coin} on?`}>
            Your exchange or wallet asks you to pick one when you send. Choose the same one here.
          </SheetTitle>
          <ul className="grid gap-3">
            {wallet.networks.map((n, i) => (
              <li key={n.key}>
                <button
                  data-autofocus={i === 0 ? true : undefined}
                  onClick={() => {
                    setNetwork(n.key)
                    setStep('address')
                  }}
                  className="flex w-full items-center gap-4 rounded-2xl border-2 border-line p-4 text-left transition hover:border-ink/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold">{n.label}</span>
                    <span className="block text-[15px] text-muted">{NETWORK_HINT[n.key] ?? ''}</span>
                  </span>
                  {n.minUsd > 0 && <span className="shrink-0 rounded-full bg-canvas px-3 py-1 text-sm font-semibold text-ink-2">Min {money(n.minUsd * 100, { whole: true })}</span>}
                  <ChevronRight className="size-5 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {step === 'address' && net && (
        <>
          <SheetTitle title={`Send ${wallet.coin} to your address`}>
            Copy this address into the app where your crypto is (like Coinbase), or scan the code.
          </SheetTitle>
          <div className="flex flex-col items-center">
            <div className="rounded-3xl border-2 border-line p-4">
              <QRCodeSVG value={net.address} size={184} level="M" marginSize={0} />
            </div>
            <AddressCopy address={net.address} demo={wallet.demo} />
          </div>
          {wallet.demo && (
            <p className="mt-5 rounded-2xl bg-red-50 p-4 text-[15px] font-semibold text-red-800">
              Demo address — not a real wallet. Don’t send real crypto. Use the demo buttons on the next step instead.
            </p>
          )}
          <div className="mt-3 flex gap-3 rounded-2xl bg-amber-50 p-4 text-[15px] text-amber-900">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <p>
              Only send <b>{wallet.coin}</b> on <b>{net.label}</b>. Other coins or networks may be lost.
            </p>
          </div>
          {net.minUsd > 0 && (
            <div className="mt-3 rounded-2xl bg-canvas p-4 text-[15px]">
              <p className="font-bold">
                Minimum {money(net.minUsd * 100, { whole: true })} on {net.label} — we suggest sending at least {money(net.suggestUsd * 100, { whole: true })}
              </p>
              <p className="mt-1 text-muted">
                Exchanges like Binance and Coinbase take their fee out of what you send, so less arrives than you enter. Anything that lands under the
                minimum waits for a manual review instead of going straight into your balance.
              </p>
            </div>
          )}
          <Button size="lg" block className="mt-6" onClick={() => setStep('watch')}>
            I’ve sent it
          </Button>
        </>
      )}

      {step === 'watch' && (
        <div className="text-center">
          {!deposit && (
            <>
              <div className="relative mx-auto mb-6 grid size-20 place-items-center">
                <span className="absolute size-20 animate-ping rounded-full bg-accent/20" />
                <span className="relative size-5 rounded-full bg-accent" />
              </div>
              <SheetTitle title="Watching for your crypto">
                Most transfers show up within a few minutes. You can close this — we’ll add it to your balance automatically.
              </SheetTitle>
              {wallet?.demo && (
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
              )}
              <Button size="lg" variant="ghost" block className="mt-4" onClick={onClose}>
                Close
              </Button>
            </>
          )}

          {deposit?.status === 'confirming' && (
            <div role="status">
              <div className="mx-auto mb-8 size-20 animate-spin rounded-full border-[6px] border-line border-t-accent" />
              <SheetTitle title="Found it! Confirming…">
                {pending?.amount} {pending?.coin}
                {pending?.network ? ` on ${pending.network}` : ''} is on its way. The network double-checks every transfer
                {pending?.required ? ` — ${Math.min(pending.confirmations, pending.required)} of ${pending.required} checks done.` : '.'}
              </SheetTitle>
              <Button size="lg" variant="ghost" block onClick={onClose}>
                Close — we’ll keep going
              </Button>
            </div>
          )}

          {deposit?.status === 'complete' && (
            <>
              <div className="mx-auto mb-6 grid size-20 animate-pop place-items-center rounded-full bg-save text-white">
                <Check className="size-10" strokeWidth={3} />
              </div>
              <SheetTitle title={`${money(deposit.cents)} added`}>Your wallet now has {money(me.balance)} to spend.</SheetTitle>
              <Button
                size="lg"
                variant="accent"
                block
                data-autofocus
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

          {deposit && !['confirming', 'complete'].includes(deposit.status) && <DepositHelp depositId={deposit.id} onDone={onClose} />}
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

function AddressCopy({ address, demo }) {
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
      <p className="mb-2 text-center text-sm font-semibold text-muted">Your deposit address{demo ? ' (demo)' : ''}</p>
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
