import { useEffect, useState } from 'react'
import { Clock, Check, MessageCircle, AlertCircle } from 'lucide-react'
import Modal, { SheetTitle } from '../components/Modal'
import Button from '../components/Button'
import { api } from '../lib/api'
import { money } from '../lib/format'
import { useAccount } from './AppRoot'

// Explains a deposit that arrived but isn't in the balance (held below the
// minimum, unsupported coin, failed), and lets the customer message the admins.
// info → message → sent
export function DepositHelp({ depositId, onDone }) {
  const { me, refresh } = useAccount()
  const [step, setStep] = useState('info')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const a = me.activity.find((x) => x.id === depositId)
  const held = me.held.find((x) => x.id === depositId)
  if (!a) return null
  const asked = a.supportRequested || step === 'sent'

  const send = async () => {
    setBusy(true)
    setError('')
    try {
      await api(`/deposits/${depositId}/help`, { method: 'POST', body: { message } })
      setStep('sent')
      refresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (step === 'message') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <SheetTitle title="Send us a message">We’ll get your account and transfer details automatically. Add anything else you’d like us to know.</SheetTitle>
        <label className="sr-only" htmlFor="help-msg">
          Message (optional)
        </label>
        <textarea
          id="help-msg"
          data-autofocus
          autoFocus
          rows={4}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Optional — e.g. I sent 20 USDT from Binance"
          className="w-full rounded-2xl border-2 border-line p-4 text-lg outline-none focus:border-ink"
        />
        {error && (
          <p role="alert" className="mt-3 font-semibold text-red-600">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" block className="mt-6" disabled={busy}>
          {busy ? 'Sending…' : 'Send message'}
        </Button>
      </form>
    )
  }

  if (step === 'sent') {
    return (
      <div className="text-center">
        <div className="mx-auto mb-6 grid size-20 animate-pop place-items-center rounded-full bg-save text-white">
          <Check className="size-10" strokeWidth={3} />
        </div>
        <SheetTitle title="Message sent">We’ll email you at {me.email} once it’s sorted. Your money is safe in the meantime.</SheetTitle>
        <Button size="lg" block onClick={onDone} data-autofocus>
          Done
        </Button>
      </div>
    )
  }

  const value = held?.usdCents != null ? money(held.usdCents) : null
  const copy =
    a.status === 'held'
      ? {
          icon: <Clock className="size-9" />,
          tint: 'bg-amber-50 text-amber-600',
          title: 'It arrived — it’s waiting for review',
          body: (
            <>
              {held ? `${held.amount} ${held.coin} on ${held.network}` : 'Your deposit'}
              {value ? ` (about ${value})` : ''} is under the {held?.minUsd ? money(held.minUsd * 100, { whole: true }) : ''} minimum, so it wasn’t added
              automatically. It’s safe, and we can add it to your balance for you.
            </>
          ),
        }
      : a.status === 'ignored'
        ? {
            icon: <AlertCircle className="size-9" />,
            tint: 'bg-red-50 text-red-600',
            title: 'We received a coin we don’t support',
            body: 'It reached your address, but it isn’t one of the coins we accept, so we can’t add it to your balance automatically. Send us a message and we’ll help.',
          }
        : {
            icon: <AlertCircle className="size-9" />,
            tint: 'bg-red-50 text-red-600',
            title: 'This transfer didn’t go through',
            body: 'The network didn’t complete it, so nothing was added. Check your exchange or wallet — the funds usually return there. Send us a message if you need help.',
          }

  return (
    <div className="text-center">
      <div className={`mx-auto mb-6 grid size-20 place-items-center rounded-full ${copy.tint}`}>{copy.icon}</div>
      <SheetTitle title={copy.title}>{copy.body}</SheetTitle>
      {asked ? (
        <p className="mb-4 flex items-center justify-center gap-2 rounded-2xl bg-save-soft py-3 font-semibold text-save" role="status">
          <Check className="size-5" /> We’ve got your message — we’ll email you
        </p>
      ) : (
        <Button size="lg" block onClick={() => setStep('message')} data-autofocus>
          <MessageCircle className="size-5" /> Send us a message
        </Button>
      )}
      <Button size="lg" variant="ghost" block className="mt-2" onClick={onDone}>
        Close
      </Button>
    </div>
  )
}

export default function DepositHelpSheet({ depositId, onClose }) {
  const [step, setStep] = useState(0)
  useEffect(() => setStep((s) => s + 1), [depositId])
  if (!depositId) return null
  return (
    <Modal open step={step} onClose={onClose} label="Deposit help">
      <DepositHelp depositId={depositId} onDone={onClose} />
    </Modal>
  )
}
