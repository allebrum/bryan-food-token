// Installable app + push notification helpers.
import { useEffect, useState } from 'react'
import { api } from './api'

export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
// iPhone only allows push for apps added to the Home Screen (iOS 16.4+).
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('service worker registration failed', err))
  })
}

// Chrome/Android fire `beforeinstallprompt`; keep it so a button can show it later.
let deferredPrompt = null
const installListeners = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    installListeners.forEach((fn) => fn())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installListeners.forEach((fn) => fn())
  })
}

export function useInstall() {
  const [, bump] = useState(0)
  useEffect(() => {
    const fn = () => bump((n) => n + 1)
    installListeners.add(fn)
    return () => installListeners.delete(fn)
  }, [])
  return {
    installed: isStandalone(),
    canPrompt: !!deferredPrompt,
    ios: isIOS(),
    prompt: async () => {
      if (!deferredPrompt) return false
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      deferredPrompt = null
      installListeners.forEach((fn) => fn())
      return outcome === 'accepted'
    },
  }
}

const b64ToBytes = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration('/')) || null
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null
  const reg = await registration()
  return reg ? reg.pushManager.getSubscription() : null
}

// Must run from a tap: browsers only show the permission prompt for a user gesture.
export async function enablePush(publicKey) {
  if (!pushSupported()) throw new Error('This browser can’t show notifications.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications are blocked. Turn them on in your phone’s settings for Food Token.')
  const reg = (await registration()) || (await navigator.serviceWorker.register('/sw.js'))
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) }))
  await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } })
  return sub
}

export async function disablePush() {
  const sub = await currentPushSubscription()
  if (!sub) return
  await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {})
  await sub.unsubscribe()
}
