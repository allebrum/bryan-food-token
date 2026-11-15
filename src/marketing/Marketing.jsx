import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Copy, Search, Plus, DollarSign, Smartphone, Wallet, Receipt, ChevronDown, Sparkles } from 'lucide-react'
import Logo, { LogoMark } from '../components/Logo'
import Button from '../components/Button'
import DemoBanner from '../components/DemoBanner'
import Stack from '../components/Stack'

const BRANDS = ['Starbucks', 'Smashburger', 'Chipotle', 'Panera Bread', 'Shake Shack', "Dunkin'", 'Sweetgreen', "Domino's", 'Whole Foods', 'Subway', 'Taco Bell', 'Chick-fil-A']
const DISCOUNT = 0.15

export default function Marketing() {
  return (
    <div className="bg-white">
      <DemoBanner />
      <Nav />
      <Hero />
      <BrandStrip />
      <HowItWorks />
      <Savings />
      <NewToCrypto />
      <TrackBalance />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  )
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 sm:px-10">
        <Link to="/" aria-label="Food Token home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-9 text-[15px] font-semibold text-ink-2 md:flex" aria-label="Sections">
          <a href="#how" className="hover:text-ink">
            How it works
          </a>
          <a href="#savings" className="hover:text-ink">
            Savings
          </a>
          <a href="#faq" className="hover:text-ink">
            FAQ
          </a>
        </nav>
        <Button as={Link} to="/app" size="sm" className="!h-11 !px-5">
          Open app
        </Button>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-40 -top-40 size-[640px] rounded-full bg-accent/10 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 pb-24 pt-14 sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:pb-36 lg:pt-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2 text-sm font-bold text-accent">
            <Sparkles className="size-4" /> Crypto in. Food out.
          </p>
          <h1 className="mt-7 text-[56px] font-extrabold leading-[0.98] tracking-[-0.035em] sm:text-[88px] lg:text-[104px]">
            Your crypto,
            <br />
            now <span className="text-accent">lunch.</span>
          </h1>
          <p className="mt-8 max-w-xl text-xl leading-relaxed text-muted sm:text-2xl">
            Turn crypto into gift cards for the places you already eat — and save up to 15% every time you do.
          </p>
          <div className="mt-11 flex flex-wrap items-center gap-4">
            <Button as={Link} to="/app" size="lg">
              Get started — it’s free <ArrowRight className="size-5" />
            </Button>
            <Button as="a" href="#how" size="lg" variant="ghost">
              See how it works
            </Button>
          </div>
          <ul className="mt-11 flex flex-wrap gap-x-8 gap-y-3 text-[15px] font-semibold text-ink-2">
            {['No crypto experience needed', 'Cards in your phone', 'Set up in 30 seconds'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="size-5 text-save" strokeWidth={3} /> {t}
              </li>
            ))}
          </ul>
        </div>
        <PhoneMock />
      </div>
    </section>
  )
}

function PhoneMock() {
  const passes = [
    { name: 'Starbucks', color: '#00704A', bal: '$25.00' },
    { name: 'Smashburger', color: '#D6222A', bal: '$50.00' },
    { name: 'Chipotle', color: '#441500', bal: '$18.40', last: '4821' },
  ]
  return (
    <div className="relative mx-auto w-full max-w-[400px]" aria-hidden="true">
      <div className="rounded-[52px] bg-ink p-3 shadow-[0_40px_80px_-24px_rgba(0,0,0,0.45)]">
        <div className="overflow-hidden rounded-[42px] bg-canvas px-5 pb-8 pt-12">
          <p className="text-sm font-semibold text-muted">Good afternoon, Sam</p>
          <div className="mt-3 rounded-[22px] bg-ink p-5 text-white">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-white/50">Available to spend</span>
              <LogoMark className="size-7" />
            </div>
            <p className="mt-2 text-[44px] font-extrabold leading-none tracking-tight">$142.50</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <span className="grid h-10 place-items-center rounded-full bg-white text-sm font-bold text-ink">Add crypto</span>
              <span className="grid h-10 place-items-center rounded-full bg-accent text-sm font-bold">Buy a card</span>
            </div>
          </div>
          <p className="mb-3 mt-6 text-lg font-extrabold">Your gift cards</p>
          <Stack step={52}>
            {passes.map((p) => (
              <div key={p.name} className="flex aspect-[1.586] flex-col justify-between rounded-[18px] p-4 text-white shadow-[var(--shadow-pass)]" style={{ background: p.color }}>
                <div className="flex items-start justify-between">
                  <span className="font-bold">{p.name}</span>
                  <span className="text-right">
                    <span className="block text-[9px] font-bold uppercase tracking-widest opacity-70">Balance</span>
                    <span className="block text-lg font-extrabold leading-tight">{p.bal}</span>
                  </span>
                </div>
                {p.last && <span className="text-sm font-semibold opacity-80">$25 · •••• {p.last}</span>}
              </div>
            ))}
          </Stack>
        </div>
      </div>
      {/* floating chips */}
      <div className="absolute -left-6 top-[46%] flex animate-sheet items-center gap-3 rounded-2xl bg-white p-3 pr-5 shadow-[var(--shadow-pass)] sm:-left-16">
        <span className="grid size-10 place-items-center rounded-full bg-save-soft text-save">
          <Plus className="size-5" />
        </span>
        <span>
          <span className="block text-sm font-bold">+$50.00 arrived</span>
          <span className="block text-xs text-muted">50 USDC · just now</span>
        </span>
      </div>
      <div className="absolute -right-4 bottom-28 animate-sheet rounded-2xl bg-white p-3 px-5 shadow-[var(--shadow-pass)] [animation-delay:200ms] sm:-right-12">
        <span className="block text-xs font-semibold text-muted">You saved</span>
        <span className="block text-2xl font-extrabold text-save">$7.50</span>
      </div>
    </div>
  )
}

function BrandStrip() {
  const row = [...BRANDS, ...BRANDS]
  return (
    <section className="border-y border-line py-10" aria-label="Places you can spend">
      <p className="mb-6 text-center text-sm font-bold uppercase tracking-widest text-muted">Spend it at places like</p>
      <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
        <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-14 motion-reduce:animate-none">
          {row.map((b, i) => (
            <span key={i} className="whitespace-nowrap text-2xl font-extrabold tracking-tight text-ink/25">
              {b}
            </span>
          ))}
        </div>
      </div>
      <style>{`@keyframes marquee { to { transform: translateX(-50%); } }`}</style>
    </section>
  )
}

function SectionHead({ eyebrow, title, children, center }) {
  return (
    <div className={`max-w-3xl ${center ? 'mx-auto text-center' : ''}`}>
      <p className="text-sm font-bold uppercase tracking-widest text-accent">{eyebrow}</p>
      <h2 className="mt-4 text-5xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-7xl">{title}</h2>
      {children && <p className="mt-6 text-xl leading-relaxed text-muted sm:text-2xl">{children}</p>}
    </div>
  )
}

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-7xl scroll-mt-20 px-6 py-28 sm:px-10 sm:py-40">
      <SectionHead eyebrow="How it works" title="Three steps. No jargon.">
        If you can copy and paste, you can use Food Token.
      </SectionHead>
      <div className="mt-20 grid gap-6 lg:grid-cols-3">
        <Step n="1" title="Send crypto to your wallet" body="We give you your own address. Send from Coinbase, Cash App, or any wallet. It becomes dollars the second it lands.">
          <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-soft)]">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Your USDC address</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="flex-1 truncate font-mono text-sm">0x8f3a…c21e9b4d</span>
              <span className="grid size-9 place-items-center rounded-full bg-canvas">
                <Copy className="size-4" />
              </span>
            </div>
          </div>
        </Step>
        <Step n="2" title="Pick a place to eat" body="Search by name or see what’s near you. Choose a card amount and pay less than it’s worth.">
          <div className="rounded-full bg-white p-2 pl-4 shadow-[var(--shadow-soft)]">
            <span className="flex items-center gap-3 font-semibold">
              <Search className="size-5 text-muted" /> Smashburger
              <span className="ml-auto rounded-full bg-save-soft px-3 py-1.5 text-sm font-bold text-save">Save 15%</span>
            </span>
          </div>
        </Step>
        <Step n="3" title="Scan at the register" body="Your card lives in the app, Apple Wallet–style. Show the barcode, pay, and log what’s left.">
          <div className="rounded-2xl bg-white p-4 shadow-[var(--shadow-soft)]">
            <FakeBarcode />
          </div>
        </Step>
      </div>
    </section>
  )
}

function Step({ n, title, body, children }) {
  return (
    <div className="flex flex-col rounded-[32px] bg-canvas p-8 sm:p-10">
      <span className="text-7xl font-extrabold leading-none tracking-tighter text-accent">{n}</span>
      <h3 className="mt-8 text-3xl font-extrabold leading-tight tracking-tight">{title}</h3>
      <p className="mt-4 flex-1 text-lg leading-relaxed text-muted">{body}</p>
      <div className="mt-10">{children}</div>
    </div>
  )
}

function FakeBarcode() {
  const bars = '3121142113212131112321131221214111312131'.split('').map(Number)
  return (
    <div className="flex h-16 items-stretch justify-center gap-[2px]">
      {bars.map((w, i) => (
        <span key={i} className={i % 2 ? 'bg-transparent' : 'bg-ink'} style={{ width: w * 2 }} />
      ))}
    </div>
  )
}

function Savings() {
  const [spend, setSpend] = useState(300)
  const yearly = Math.round(spend * 12 * DISCOUNT)
  return (
    <section id="savings" className="scroll-mt-20 bg-ink text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 py-28 sm:px-10 sm:py-40 lg:grid-cols-2">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-accent">Savings</p>
          <h2 className="mt-4 text-5xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-7xl">Every meal, a little cheaper.</h2>
          <p className="mt-6 max-w-lg text-xl leading-relaxed text-white/60 sm:text-2xl">
            A $50 card costs you $42.50. Spend the full fifty. That’s it — that’s the trick.
          </p>
        </div>
        <div className="rounded-[32px] bg-white/[0.06] p-8 ring-1 ring-white/10 sm:p-12">
          <label htmlFor="spend" className="text-lg font-semibold text-white/70">
            I spend about <span className="tabular font-extrabold text-white">${spend}</span> a month eating out
          </label>
          <input
            id="spend"
            type="range"
            min={50}
            max={1500}
            step={25}
            value={spend}
            onChange={(e) => setSpend(Number(e.target.value))}
            className="mt-6 w-full accent-[#ff5b22]"
          />
          <p className="mt-12 text-lg font-semibold text-white/70">You’d save about</p>
          <p className="tabular mt-1 text-7xl font-extrabold tracking-tight text-accent sm:text-8xl">${yearly.toLocaleString()}</p>
          <p className="mt-2 text-lg text-white/60">a year, at 15% off</p>
        </div>
      </div>
    </section>
  )
}

function NewToCrypto() {
  const items = [
    [DollarSign, 'Dollars, not volatility', 'Crypto converts to US dollars the moment it arrives. Your balance won’t drop overnight.'],
    [Wallet, 'One address per coin', 'We create it for you. Copy, paste, send. We show you exactly which network to use.'],
    [Smartphone, 'Cards live in your phone', 'No plastic, no printing. Pull up the barcode at the counter, just like Apple Wallet.'],
    [Receipt, 'Always know what’s left', 'After you eat, type in the remaining balance. Your wallet adds it all up for you.'],
  ]
  return (
    <section className="mx-auto max-w-7xl px-6 py-28 sm:px-10 sm:py-40">
      <SectionHead eyebrow="Built for beginners" title="New to crypto? Perfect.">
        We kept every step to one screen and one decision.
      </SectionHead>
      <div className="mt-20 grid gap-x-12 gap-y-14 sm:grid-cols-2">
        {items.map(([Icon, title, body]) => (
          <div key={title} className="flex gap-6">
            <span className="grid size-16 shrink-0 place-items-center rounded-3xl bg-accent-soft text-accent">
              <Icon className="size-7" />
            </span>
            <div>
              <h3 className="text-2xl font-extrabold tracking-tight">{title}</h3>
              <p className="mt-2 text-lg leading-relaxed text-muted">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function TrackBalance() {
  return (
    <section className="px-6 sm:px-10">
      <div className="mx-auto grid max-w-7xl items-center gap-14 rounded-[40px] bg-canvas p-8 sm:p-16 lg:grid-cols-2">
        <div className="mx-auto w-full max-w-sm" aria-hidden="true">
          <div className="flex aspect-[1.586] flex-col justify-between rounded-[22px] p-6 text-white shadow-[var(--shadow-pass)]" style={{ background: '#441500' }}>
            <div className="flex items-start justify-between">
              <span className="text-lg font-bold">Chipotle</span>
              <span className="text-right">
                <span className="block text-[11px] font-bold uppercase tracking-widest opacity-70">Balance</span>
                <span className="block text-2xl font-extrabold">$18.40</span>
              </span>
            </div>
            <span className="font-semibold opacity-80">$50 · •••• 4821</span>
          </div>
          <div className="relative -mt-8 ml-8 rounded-3xl bg-white p-6 shadow-[var(--shadow-pass)]">
            <p className="font-bold">What’s left on your card?</p>
            <p className="mt-3 rounded-2xl border-2 border-ink px-4 py-3 text-4xl font-extrabold">$18.40</p>
            <span className="mt-4 grid h-12 place-items-center rounded-full bg-ink font-bold text-white">Save balance</span>
          </div>
        </div>
        <div>
          <SectionHead eyebrow="After you eat" title="Know exactly what’s left.">
            Paid $31.60 of a $50 card? Type in what’s left and you’re done. Used it all? One tap moves it out of the way.
          </SectionHead>
        </div>
      </div>
    </section>
  )
}

function Faq() {
  const qs = [
    ['What crypto can I send?', 'USDC, USDT, Bitcoin, Ether and Solana. If you’re not sure, use USDC — it’s a digital dollar, so what you send is what you get.'],
    ['Are these real gift cards?', 'Yes. Every card is a real gift card from the brand, bought in bulk. That’s how we can sell them to you below face value.'],
    ['What if crypto prices drop after I deposit?', 'Your balance doesn’t change. We convert to US dollars the moment your deposit arrives.'],
    ['How do I use a card in the store?', 'Open the app, tap the card, and show the barcode or QR code at the register. Some places may also ask for the card number or PIN — both are right there.'],
    ['What happens if I send the wrong coin or network?', 'Crypto sent on the wrong network can be lost, so we show the exact network next to every address. When in doubt, send a small test amount first.'],
    ['Can I get my crypto back out?', 'Food Token is for spending. Once crypto becomes dollars in your wallet, it’s used for gift cards.'],
  ]
  return (
    <section id="faq" className="mx-auto max-w-4xl scroll-mt-20 px-6 py-28 sm:px-10 sm:py-40">
      <SectionHead eyebrow="FAQ" title="Questions, answered." center />
      <div className="mt-16 divide-y divide-line border-y border-line">
        {qs.map(([q, a]) => (
          <details key={q} className="group py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-xl font-bold sm:text-2xl [&::-webkit-details-marker]:hidden">
              {q}
              <ChevronDown className="size-6 shrink-0 text-muted transition group-open:rotate-180" />
            </summary>
            <p className="pb-6 pr-12 text-lg leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="px-6 pb-24 sm:px-10">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[40px] bg-accent px-8 py-24 text-center text-white sm:py-32">
        <div className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full border-[48px] border-white/10" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 size-[28rem] rounded-full border-[56px] border-white/10" />
        <h2 className="relative text-5xl font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-8xl">
          Lunch is on
          <br />
          your crypto.
        </h2>
        <p className="relative mx-auto mt-6 max-w-xl text-xl text-white/85 sm:text-2xl">Set up your food wallet in about 30 seconds.</p>
        <Button as={Link} to="/app" size="lg" className="relative mt-11 !bg-white !text-ink hover:!bg-white/90">
          Get started <ArrowRight className="size-5" />
        </Button>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-12 text-muted sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <Logo />
        <p className="text-sm">Demo build. Brand names belong to their owners; no affiliation implied.</p>
        <Link to="/admin" className="text-sm font-semibold hover:text-ink">
          Admin
        </Link>
      </div>
    </footer>
  )
}
