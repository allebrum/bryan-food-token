import { Link } from 'react-router-dom'
import { LogOut, Shield } from 'lucide-react'
import Modal from '../components/Modal'
import Button from '../components/Button'
import { initials } from '../lib/format'
import { CoinBadge } from './DepositFlow'
import { NotificationSettings } from '../components/AppPrompts'
import { useAccount } from './AppRoot'

export default function AccountSheet({ open, onClose }) {
  const { me, signOut } = useAccount()
  return (
    <Modal open={open} onClose={onClose} label="Your account">
      <div className="flex items-center gap-4">
        <span className="grid size-16 place-items-center rounded-full bg-accent text-xl font-bold text-white">{initials(me.name) || '•'}</span>
        <div>
          <p className="text-2xl font-extrabold">{me.name || 'Your account'}</p>
          <p className="text-muted">{me.email}</p>
        </div>
      </div>

      {me.wallets.length > 0 && <h3 className="mb-3 mt-8 font-bold">Your deposit addresses</h3>}
      <ul className="grid gap-2">
        {me.wallets.map((w) => (
          <li key={w.coin} className="flex items-center gap-3 rounded-2xl bg-canvas p-3">
            <CoinBadge coin={w.coin} size="size-10" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">
                {w.name} <span className="font-normal text-muted">· {w.networks.map((n) => n.label).join(', ')}</span>
              </span>
              <span className="block truncate font-mono text-[13px] text-muted">{w.networks[0].address}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <NotificationSettings />
      </div>

      <div className="mt-8 grid gap-2">
        {me.isAdmin && (
          <Button as={Link} to="/admin" variant="outline" block onClick={onClose}>
            <Shield className="size-4" /> Open admin
          </Button>
        )}
        <Button variant="danger" block onClick={signOut}>
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>
    </Modal>
  )
}
