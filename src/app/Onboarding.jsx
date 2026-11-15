import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, ShieldCheck, Zap, DollarSign, Mail } from 'lucide-react'
import Logo, { LogoMark } from '../components/Logo'
import Button from '../components/Button'
import Stack from '../components/Stack'
import Modal, { SheetTitle } from '../components/Modal'
import { api } from '../lib/api'
import { useAccount } from './AppRoot'

const input =
  'h-16 w-full rounded-2xl border-2 border-line bg-white px-5 text-xl font-semibold outline-none placeholder:font-normal placeholder:text-muted/60 focus:border-ink'

// Signed-out landing: one email field, then "check your inbox".
export default function Onboarding() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const send = async () => {
    setError('')
    setBusy(true)
    try {
      await api('/auth/request', { method: 'POST', body: { email } })
      setStep('sent')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page>
      <div>
        <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl">
          Let’s set up your <span className="text-accent">food wallet.</span>
        </h1>
        <p className="mt-6 max-w-lg text-xl leading-relaxed text-muted">
          It takes about 30 seconds. No passwords and no crypto knowledge needed — we’ll walk you through each step.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => setOpen(true)}>
            Get started <ArrowRight className="size-5" />
          </Button>
          <Button size="lg" variant="ghost" onClick={() => setOpen(true)}>
            I have an account
          </Button>
        </div>
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

      <Modal
        open={open}
        step={step}
        onClose={() => {
          setOpen(false)
          setStep('email')
        }}
        onBack={step === 'sent' ? () => setStep('email') : undefined}
        label="Sign in"
      >
        {step === 'email' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <SheetTitle title="What’s your email?">We’ll email you a link to sign in — no password to remember.</SheetTitle>
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
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
            />
            {error && (
              <p role="alert" className="mt-3 font-semibold text-red-600">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" block className="mt-6" disabled={busy || !email.includes('@')}>
              {busy ? 'Sending…' : 'Email me a link'}
            </Button>
          </form>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-6 grid size-20 animate-pop place-items-center rounded-full bg-accent-soft text-accent">
              <Mail className="size-9" />
            </div>
            <SheetTitle title="Check your email">
              We sent a sign-in link to <b className="text-ink">{email}</b>. Open it on this device. It works once and expires in 15 minutes.
            </SheetTitle>
            {error && (
              <p role="alert" className="mb-3 font-semibold text-red-600">
                {error}
              </p>
            )}
            <Button size="lg" variant="soft" block onClick={send} disabled={busy} data-autofocus>
              {busy ? 'Sending…' : 'Send it again'}
            </Button>
          </div>
        )}
      </Modal>
    </Page>
  )
}

// /app/verify?token=… — POSTs the token (email scanners only GET), then
// lands on the wallet. React StrictMode runs effects twice in dev, so guard.
export function Verify() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setMe } = useAccount()
  const [error, setError] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const token = params.get('token')
    if (!token) return setError('This sign-in link is missing its code. Request a new one.')
    api('/auth/verify', { method: 'POST', body: { token } }).then(
      (me) => {
        setMe(me)
        navigate('/app', { replace: true })
      },
      (e) => setError(e.message),
    )
  }, [params, navigate, setMe])

  return (
    <Page>
      <div className="max-w-lg" role="status">
        {error ? (
          <>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">That link didn’t work</h1>
            <p className="mt-5 text-xl leading-relaxed text-muted">{error}</p>
            <Button as={Link} to="/app" size="lg" className="mt-10" replace>
              Get a new link
            </Button>
          </>
        ) : (
          <>
            <div className="mb-8 size-16 animate-spin rounded-full border-[6px] border-line border-t-accent" />
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Signing you in…</h1>
          </>
        )}
      </div>
    </Page>
  )
}

// First visit after sign-in: ask for a name, then say the wallet is ready.
export function WelcomeSheet() {
  const { me, setMe, openDeposit } = useAccount()
  const [step, setStep] = useState(me.name ? null : 'name')
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  if (!step) return null
  const save = async () => {
    setError('')
    try {
      setMe(await api('/me', { method: 'POST', body: { name } }))
      setStep('ready')
    } catch (e) {
      setError(e.message)
    }
  }
  return (
    <Modal open step={step} onClose={step === 'ready' ? () => setStep(null) : undefined} label="Welcome">
      {step === 'name' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) save()
          }}
        >
          <SheetTitle title="You’re in! What should we call you?" />
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
            className={input}
          />
          {error && (
            <p role="alert" className="mt-3 font-semibold text-red-600">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" block className="mt-6" disabled={!name.trim()}>
            Continue
          </Button>
        </form>
      ) : (
        <div className="text-center">
          <div className="mx-auto mb-6 grid size-20 animate-pop place-items-center rounded-full bg-save text-white">
            <Check className="size-10" strokeWidth={3} />
          </div>
          <SheetTitle title={`Your wallet is ready, ${me.name}`}>
            Next, add some crypto. We’ll turn it into dollars you can spend at your favorite places.
          </SheetTitle>
          <div className="mb-8 rounded-[var(--radius-pass)] bg-ink p-6 text-left text-white">
            <p className="text-sm font-semibold uppercase tracking-wider text-white/50">{me.name}’s wallet</p>
            <p className="tabular mt-2 text-5xl font-extrabold">$0.00</p>
          </div>
          <Button
            size="lg"
            variant="accent"
            block
            data-autofocus
            onClick={() => {
              setStep(null)
              openDeposit()
            }}
          >
            Add crypto
          </Button>
          <Button size="lg" variant="ghost" block className="mt-2" onClick={() => setStep(null)}>
            Look around first
          </Button>
        </div>
      )}
    </Modal>
  )
}

function Page({ children }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="mx-auto flex h-20 w-full max-w-6xl items-center px-6 sm:px-10">
        <Link to="/" aria-label="Food Token home">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-6 pb-16 sm:px-10 lg:grid-cols-2">
        {children}
        <WalletPreview />
      </main>
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
    <div className="relative mx-auto hidden w-full max-w-md lg:block" aria-hidden="true">
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
