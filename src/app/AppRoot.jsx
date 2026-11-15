import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Routes, Route, NavLink, Link, Navigate, useLocation } from 'react-router-dom'
import { Wallet as WalletIcon, Store, Plus, Shield } from 'lucide-react'
import Logo from '../components/Logo'
import DemoBanner from '../components/DemoBanner'
import { api } from '../lib/api'
import { initials } from '../lib/format'
import Onboarding, { Verify, WelcomeSheet } from './Onboarding'
import WalletPage from './WalletPage'
import ShopPage from './ShopPage'
import DepositFlow from './DepositFlow'
import BuyFlow from './BuyFlow'
import CardSheet from './CardSheet'
import AccountSheet from './AccountSheet'
import DepositHelpSheet from './DepositHelp'

const Ctx = createContext(null)
export const useAccount = () => useContext(Ctx)

export default function AppRoot() {
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [flow, setFlow] = useState(null) // { kind: 'deposit' | 'buy' | 'card' | 'account', ... }
  const { pathname } = useLocation()

  const refresh = useCallback(async () => {
    try {
      const data = await api('/me')
      setMe(data)
      return data
    } catch (e) {
      if (e.status === 401) setMe(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // On the magic-link page, Verify sets the user; a parallel /me (still
  // signed out) could otherwise land last and sign them back out.
  const verifying = pathname === '/app/verify'
  // Home-screen shortcut "Add crypto" opens /app?add=1.
  const [wantsDeposit] = useState(() => new URLSearchParams(window.location.search).get('add') === '1')
  useEffect(() => {
    if (wantsDeposit && me) {
      setFlow({ kind: 'deposit' })
      window.history.replaceState(null, '', '/app')
    }
  }, [wantsDeposit, me])
  useEffect(() => {
    if (verifying) setLoading(false)
    else refresh()
  }, [refresh, verifying])

  // Keep the balance live while a deposit is confirming.
  // Demo deposits settle in seconds; real ones advance once per block or so.
  const realPending = !!me?.pending?.some((p) => p.required)
  useEffect(() => {
    if (!me?.pending?.length) return
    const t = setInterval(refresh, realPending ? 5000 : 1200)
    return () => clearInterval(t)
  }, [me?.pending?.length, realPending, refresh])

  const value = useMemo(
    () => ({
      me,
      setMe,
      refresh,
      openDeposit: () => setFlow({ kind: 'deposit' }),
      openBuy: (store) => setFlow({ kind: 'buy', store }),
      openCard: (cardId) => setFlow({ kind: 'card', cardId }),
      openAccount: () => setFlow({ kind: 'account' }),
      openDepositHelp: (depositId) => setFlow({ kind: 'deposit-help', depositId }),
      closeFlow: () => setFlow(null),
      signOut: async () => {
        await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {})
        setMe(null)
        setFlow(null)
      },
    }),
    [me, refresh],
  )

  if (pathname === '/app/verify') {
    return (
      <Ctx.Provider value={value}>
        <DemoBanner />
        <Verify />
      </Ctx.Provider>
    )
  }
  if (loading) return <div className="min-h-dvh bg-canvas" />

  return (
    <Ctx.Provider value={value}>
      <DemoBanner />
      {!me ? (
        <Onboarding />
      ) : (
        <Shell>
          <Routes>
            <Route index element={<WalletPage />} />
            <Route path="stores" element={<ShopPage />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </Shell>
      )}
      {me && (
        <>
          <DepositFlow open={flow?.kind === 'deposit'} onClose={value.closeFlow} />
          <BuyFlow store={flow?.kind === 'buy' ? flow.store : null} onClose={value.closeFlow} />
          <CardSheet cardId={flow?.kind === 'card' ? flow.cardId : null} onClose={value.closeFlow} />
          <AccountSheet open={flow?.kind === 'account'} onClose={value.closeFlow} />
          <DepositHelpSheet depositId={flow?.kind === 'deposit-help' ? flow.depositId : null} onClose={value.closeFlow} />
          <WelcomeSheet />
        </>
      )}
    </Ctx.Provider>
  )
}

function Shell({ children }) {
  const { me, openDeposit, openAccount } = useAccount()
  const tab = ({ isActive }) =>
    `flex items-center gap-2 rounded-full px-5 h-11 text-[15px] font-semibold transition ${isActive ? 'bg-ink text-white' : 'text-ink-2 hover:bg-canvas'}`
  const mtab = ({ isActive }) => `flex flex-1 flex-col items-center gap-1 py-2 text-xs font-semibold ${isActive ? 'text-ink' : 'text-muted'}`

  return (
    <div className="min-h-dvh bg-canvas pb-28 sm:pb-16">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-5xl items-center justify-between px-5 sm:px-8">
          <Link to="/app" aria-label="Food Token home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
            <NavLink end to="/app" className={tab}>
              <WalletIcon className="size-[18px]" /> Wallet
            </NavLink>
            <NavLink to="/app/stores" className={tab}>
              <Store className="size-[18px]" /> Stores
            </NavLink>
          </nav>
          <div className="flex items-center gap-2">
            {me.isAdmin && (
              <Link
                to="/admin"
                className="hidden h-11 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold text-ink-2 hover:bg-white md:flex"
              >
                <Shield className="size-4" /> Admin
              </Link>
            )}
            <button
              onClick={openDeposit}
              className="hidden h-11 items-center gap-1.5 rounded-full bg-white px-4 text-[15px] font-semibold shadow-[var(--shadow-soft)] hover:bg-white/70 md:flex"
            >
              <Plus className="size-4" /> Add crypto
            </button>
            <button
              onClick={openAccount}
              className="grid size-11 place-items-center rounded-full bg-accent text-sm font-bold text-white"
              aria-label="Your account"
            >
              {initials(me.name) || '•'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pt-6 sm:px-8 sm:pt-10">{children}</main>

      {/* mobile tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white/90 px-6 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl sm:hidden"
        aria-label="Main"
      >
        <NavLink end to="/app" className={mtab}>
          <WalletIcon className="size-6" /> Wallet
        </NavLink>
        <button onClick={openDeposit} className="flex flex-1 flex-col items-center gap-1 py-2 text-xs font-semibold text-muted">
          <span className="-mt-6 grid size-14 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/30">
            <Plus className="size-7" />
          </span>
          Add crypto
        </button>
        <NavLink to="/app/stores" className={mtab}>
          <Store className="size-6" /> Stores
        </NavLink>
      </nav>
    </div>
  )
}
