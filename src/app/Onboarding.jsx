import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, ShieldCheck, Zap, DollarSign } from 'lucide-react'
import Logo, { LogoMark } from '../components/Logo'
import Button from '../components/Button'
import Stack from '../components/Stack'
import Modal, { StepDots, SheetTitle } from '../components/Modal'
import { api, session } from '../lib/api'
import { useAccount } from './AppRoot'

const STEPS = ['name', 'email', 'creating', 'ready']

export default function Onboarding() {
  const { setMe, openDeposit } = useAccount()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)

  const create = async () => {
    setError('')
    setStep(2)
    try {
      const [me] = await Promise.all([api('/users', { method: 'POST', body: { name, email } }), new Promise((r) => setTimeout(r, 1400))])
      session.set(me.id)
      setCreated(me)
      setStep(3)
    } catch (e) {
      setError(e.message)
      setStep(1)
    }
  }

  const finish = (thenDeposit) => {
    setMe(created)
    if (thenDeposit) setTimeout(openDeposit, 50)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center px-6 sm:px-10">
        <Link to="/" aria-label="Food Token home">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-6 pb-16 sm:px-10 lg:grid-cols-2">
        <div>
          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl">
            Let’s set up your <span className="text-accent">food wallet.</span>
          </h1>
          <p className="mt-6 max-w-lg text-xl leading-relaxed text-muted">
            It takes about 30 seconds. No crypto knowledge needed — we’ll walk you through each step.
          </p>
          <Button size="lg" className="mt-10" onClick={() => setOpen(true)}>
            Get started <ArrowRight className="size-5" />
          </Button>
          <ul className="mt-12 grid max-w-lg gap-5 text-lg">
            {[
              [Zap, 'Your own deposit address, ready instantly'],
              [DollarSign, 'Crypto becomes dollars the moment it lands'],
              [ShieldCheck, 'Gift cards live safely in your account'],
            ].map(([Icon, t]) => (
              <li key={t} className="flex items-center gap-4">
                <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent">
                  <Icon className="size-5" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <WalletPreview />
      </main>

      <Modal
        step={step}
        open={open}
        onClose={step === 2 ? undefined : () => (step === 3 ? finish(false) : setOpen(false))}
        onBack={step === 1 ? () => setStep(0) : undefined}
        label="Create your account"
      >
        {step < 2 && (
          <div className="mb-6">
            <StepDots step={step} total={2} />
          </div>
        )}

        {STEPS[step] === 'name' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) setStep(1)
            }}
          >
            <SheetTitle title="First, what should we call you?" />
            <label className="sr-only" htmlFor="ob-name">
              First name
            </label>
            <input
              id="ob-name"
              data-autofocus
              autoComplete="given-name"
              placeholder="First name"
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-16 w-full rounded-2xl border-2 border-line bg-white px-5 text-xl font-semibold outline-none placeholder:font-normal placeholder:text-muted/60 focus:border-ink"
            />
            <Button type="submit" size="lg" block className="mt-6" disabled={!name.trim()}>
              Continue
            </Button>
          </form>
        )}

        {STEPS[step] === 'email' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              create()
            }}
          >
            <SheetTitle title={`Nice to meet you, ${name.trim()}. What’s your email?`}>
              We’ll send receipts here, and it’s how you get back into your wallet.
            </SheetTitle>
            <label className="sr-only" htmlFor="ob-email">
              Email
            </label>
            <input
              id="ob-email"
              data-autofocus
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              maxLength={120}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-16 w-full rounded-2xl border-2 border-line bg-white px-5 text-xl font-semibold outline-none placeholder:font-normal placeholder:text-muted/60 focus:border-ink"
            />
            {error && (
              <p role="alert" className="mt-3 font-semibold text-red-600">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" block className="mt-6" disabled={!email.includes('@')}>
              Create my wallet
            </Button>
          </form>
        )}

        {STEPS[step] === 'creating' && <Creating />}

        {STEPS[step] === 'ready' && created && (
          <div className="text-center">
            <div className="mx-auto mb-6 grid size-20 animate-pop place-items-center rounded-full bg-save text-white">
              <Check className="size-10" strokeWidth={3} />
            </div>
            <SheetTitle title="Your wallet is ready">
              Next, add some crypto. We’ll turn it into dollars you can spend at your favorite places.
            </SheetTitle>
            <div className="mb-8 rounded-[var(--radius-pass)] bg-ink p-6 text-left text-white">
              <p className="text-sm font-semibold uppercase tracking-wider text-white/50">{created.name}’s wallet</p>
              <p className="tabular mt-2 text-5xl font-extrabold">$0.00</p>
            </div>
            <Button size="lg" variant="accent" block onClick={() => finish(true)}>
              Add crypto
            </Button>
            <Button size="lg" variant="ghost" block className="mt-2" onClick={() => finish(false)}>
              Look around first
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Creating() {
  const [i, setI] = useState(0)
  const lines = ['Creating your wallet', 'Generating your deposit addresses', 'Almost there']
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, lines.length - 1)), 500)
    return () => clearInterval(t)
  }, [lines.length])
  return (
    <div className="py-10 text-center" role="status">
      <div className="mx-auto mb-8 size-20 animate-spin rounded-full border-[6px] border-line border-t-accent" />
      <p className="text-2xl font-bold">{lines[i]}…</p>
    </div>
  )
}

function WalletPreview() {
  const cards = [
    { name: 'Starbucks', color: '#00704A', bal: '$25.00' },
    { name: 'Smashburger', color: '#D6222A', bal: '$50.00' },
    { name: 'Chipotle', color: '#441500', bal: '$18.40' },
  ]
  return (
    <div className="relative mx-auto w-full max-w-md" aria-hidden="true">
      <div className="rounded-[var(--radius-pass)] bg-ink p-7 text-white shadow-[var(--shadow-pass)]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-wider text-white/50">Balance</span>
          <LogoMark className="size-8" />
        </div>
        <p className="tabular mt-3 text-6xl font-extrabold">$142.50</p>
        <p className="mt-2 text-white/60">Ready to spend</p>
      </div>
      <Stack step={72} className="mt-6">
        {cards.map((c) => (
          <div
            key={c.name}
            className="flex aspect-[1.586] items-start justify-between rounded-[var(--radius-pass)] p-6 text-white shadow-[var(--shadow-pass)]"
            style={{ background: c.color }}
          >
            <span className="text-lg font-bold">{c.name}</span>
            <span className="text-right">
              <span className="block text-[11px] font-bold uppercase tracking-widest opacity-70">Balance</span>
              <span className="block text-2xl font-extrabold">{c.bal}</span>
            </span>
          </div>
        ))}
      </Stack>
    </div>
  )
}
