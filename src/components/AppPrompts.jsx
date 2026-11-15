import { useEffect, useState } from 'react'
import { Bell, BellOff, Download, Share, SquarePlus, X, Check } from 'lucide-react'
import Button from './Button'
import Modal, { SheetTitle } from './Modal'
import { api } from '../lib/api'
import { useConfig } from '../lib/config'
import { useInstall, pushSupported, currentPushSubscription, enablePush, disablePush, isStandalone, isIOS } from '../lib/pwa'

const dismissedKey = (k) => `foodtoken.dismissed.${k}`
function useDismissed(key) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(dismissedKey(key)) === '1'
    } catch {
      return false
    }
  })
  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(dismissedKey(key), '1')
    } catch {
      /* private mode */
    }
  }
  return [dismissed, dismiss]
}

export function usePushState() {
  const config = useConfig()
  const [subscribed, setSubscribed] = useState(null)
  useEffect(() => {
    currentPushSubscription().then((s) => setSubscribed(!!s), () => setSubscribed(false))
  }, [])
  return {
    available: !!config?.pushPublicKey && pushSupported(),
    // iPhone in a Safari tab: push exists only after Add to Home Screen.
    needsInstall: !!config?.pushPublicKey && isIOS() && !isStandalone(),
    publicKey: config?.pushPublicKey,
    subscribed,
    setSubscribed,
  }
}

// Wallet-page cards: install the app, then turn on notifications.
export function AppPrompts() {
  const install = useInstall()
  const push = usePushState()
  const [installDismissed, dismissInstall] = useDismissed('install')
  const [pushDismissed, dismissPush] = useDismissed('push')
  const [iosHelp, setIosHelp] = useState(false)
  const [error, setError] = useState('')

  const showInstall = !install.installed && !installDismissed && (install.canPrompt || install.ios)
  const showPush = !showInstall && push.available && push.subscribed === false && !pushDismissed

  if (!showInstall && !showPush) return <IosInstallSheet open={iosHelp} onClose={() => setIosHelp(false)} />

  return (
    <>
      {showInstall && (
        <Card
          icon={<Download className="size-5" />}
          title="Get the Food Token app"
          body={install.ios ? 'Add it to your Home Screen for one-tap access and deposit alerts.' : 'Install it for one-tap access and deposit alerts.'}
          action={
            <Button size="sm" onClick={() => (install.canPrompt ? install.prompt() : setIosHelp(true))}>
              {install.canPrompt ? 'Install' : 'Show me how'}
            </Button>
          }
          onDismiss={dismissInstall}
        />
      )}
      {showPush && (
        <Card
          icon={<Bell className="size-5" />}
          title="Know the moment your crypto lands"
          body={error || 'We’ll notify you when a deposit arrives and when it’s ready to spend.'}
          error={!!error}
          action={
            <Button
              size="sm"
              onClick={async () => {
                setError('')
                try {
                  await enablePush(push.publicKey)
                  push.setSubscribed(true)
                } catch (e) {
                  setError(e.message)
                }
              }}
            >
              Turn on
            </Button>
          }
          onDismiss={dismissPush}
        />
      )}
      <IosInstallSheet open={iosHelp} onClose={() => setIosHelp(false)} />
    </>
  )
}

function Card({ icon, title, body, action, onDismiss, error }) {
  return (
    <div className="mt-5 flex items-center gap-4 rounded-[var(--radius-pass)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{title}</p>
        <p className={`text-[15px] ${error ? 'font-semibold text-red-600' : 'text-muted'}`}>{body}</p>
      </div>
      {action}
      <button onClick={onDismiss} className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-canvas" aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  )
}

export function IosInstallSheet({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} label="Add to Home Screen">
      <SheetTitle title="Add Food Token to your Home Screen">It works like an app, and on iPhone it’s the only way to get notifications.</SheetTitle>
      <ol className="grid gap-4 text-lg">
        {[
          [<Share key="s" className="size-5" />, <>Tap <b>Share</b> at the bottom of Safari</>],
          [<SquarePlus key="a" className="size-5" />, <>Choose <b>Add to Home Screen</b></>],
          [<Check key="c" className="size-5" />, <>Tap <b>Add</b>, then open Food Token from your Home Screen</>],
        ].map(([icon, text], i) => (
          <li key={i} className="flex items-center gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-canvas">{icon}</span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
      <Button size="lg" block className="mt-8" onClick={onClose} data-autofocus>
        Got it
      </Button>
    </Modal>
  )
}

// Account-sheet switch: on/off plus a test notification.
export function NotificationSettings() {
  const push = usePushState()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [iosHelp, setIosHelp] = useState(false)

  if (push.needsInstall) {
    return (
      <>
        <Row icon={<BellOff className="size-5" />} title="Notifications" body="On iPhone, add Food Token to your Home Screen first.">
          <Button size="sm" variant="soft" onClick={() => setIosHelp(true)}>
            How
          </Button>
        </Row>
        <IosInstallSheet open={iosHelp} onClose={() => setIosHelp(false)} />
      </>
    )
  }
  if (!push.available) return null

  const toggle = async () => {
    setBusy(true)
    setMsg('')
    try {
      if (push.subscribed) {
        await disablePush()
        push.setSubscribed(false)
      } else {
        await enablePush(push.publicKey)
        push.setSubscribed(true)
      }
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }
  const test = async () => {
    setMsg('')
    try {
      await api('/push/test', { method: 'POST', body: {} })
      setMsg('Sent — check your notifications.')
    } catch (e) {
      setMsg(e.message)
    }
  }

  return (
    <div>
      <Row
        icon={push.subscribed ? <Bell className="size-5" /> : <BellOff className="size-5" />}
        title="Notifications"
        body={push.subscribed ? 'On for this device' : 'Off on this device'}
      >
        <button
          role="switch"
          aria-checked={!!push.subscribed}
          aria-label="Notifications"
          onClick={toggle}
          disabled={busy || push.subscribed === null}
          className={`relative h-8 w-14 shrink-0 rounded-full transition ${push.subscribed ? 'bg-save' : 'bg-line'}`}
        >
          <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${push.subscribed ? 'left-7' : 'left-1'}`} />
        </button>
      </Row>
      {push.subscribed && (
        <button onClick={test} className="mt-2 text-sm font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">
          Send a test notification
        </button>
      )}
      {msg && (
        <p role="status" className="mt-2 text-sm font-semibold text-ink-2">
          {msg}
        </p>
      )}
    </div>
  )
}

function Row({ icon, title, body, children }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-canvas p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{body}</span>
      </span>
      {children}
    </div>
  )
}
