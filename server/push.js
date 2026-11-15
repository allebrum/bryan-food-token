// Web Push notifications. Sending is best-effort: it never throws into the
// caller, is time-boxed, and removes subscriptions the push service says are
// gone (404/410). Payloads carry no card numbers, keys or addresses.
import * as webpush from 'web-push'
import { config } from './config.js'
import { q } from './db.js'

export const pushEnabled = () => !!(config.push.publicKey && config.push.privateKey)
let configured = false
function setup() {
  if (configured) return
  webpush.setVapidDetails(config.appUrl.startsWith('https://') ? config.appUrl : 'mailto:admin@localhost', config.push.publicKey, config.push.privateKey)
  configured = true
}

async function sendTo(rows, payload) {
  if (!pushEnabled() || !rows.length) return 0
  setup()
  const body = JSON.stringify(payload)
  let sent = 0
  await Promise.allSettled(
    rows.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24, timeout: 5000, urgency: 'high' })
        sent++
        await q('UPDATE push_subscriptions SET last_sent_at = now() WHERE id = $1', [s.id])
      } catch (err) {
        // 404/410: the device unsubscribed or the subscription expired.
        if (err.statusCode === 404 || err.statusCode === 410) await q('DELETE FROM push_subscriptions WHERE id = $1', [s.id])
        else console.error('push failed', err.statusCode ?? '', err.message)
      }
    }),
  )
  return sent
}

export async function notifyUser(userId, payload) {
  try {
    if (!pushEnabled()) return 0
    const { rows } = await q('SELECT * FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [userId])
    return await sendTo(rows, payload)
  } catch (err) {
    console.error('notifyUser failed', err.message)
    return 0
  }
}

export async function notifyAdmins(payload) {
  try {
    if (!pushEnabled() || !config.adminEmails.size) return 0
    const { rows } = await q(
      `SELECT s.* FROM push_subscriptions s JOIN users u ON u.id = s.user_id WHERE u.email = ANY($1) ORDER BY s.created_at DESC LIMIT 50`,
      [[...config.adminEmails]],
    )
    return await sendTo(rows, payload)
  } catch (err) {
    console.error('notifyAdmins failed', err.message)
    return 0
  }
}

const usd = (cents) => `$${(cents / 100).toFixed(2)}`
// Message catalogue, so wording lives in one place.
export const messages = {
  depositSeen: (d) => ({ title: 'Crypto on its way', body: `We see ${d.amount} ${d.coin} on ${d.network}. Confirming now — it’ll be in your balance shortly.`, url: '/app', tag: `dep-${d.id}` }),
  depositCredited: (d) => ({ title: `${usd(d.usdCents)} added`, body: `Your ${d.amount} ${d.coin} arrived. Ready to spend on gift cards.`, url: '/app/stores', tag: `dep-${d.id}` }),
  depositHeld: (d) => ({ title: 'Deposit waiting for review', body: `${d.amount} ${d.coin} arrived but is under the minimum. It’s safe — tap to see what happens next.`, url: '/app', tag: `dep-${d.id}` }),
  depositApproved: (d) => ({ title: `${usd(d.usdCents)} added`, body: 'Your held deposit was approved and is ready to spend.', url: '/app', tag: `dep-${d.id}` }),
  adminHeld: (d) => ({
    title: 'Deposit needs review',
    body: `${d.email}: ${d.amount} ${d.coin} on ${d.network} (${d.usdCents != null ? usd(d.usdCents) : 'value unknown'}) is below the minimum.`,
    url: '/admin/deposits',
    tag: `adm-${d.id}`,
  }),
  adminHelp: (d) => ({ title: 'Customer needs help', body: `${d.email} asked about a ${d.coin} deposit.`, url: '/admin/deposits', tag: `adm-help-${d.id}` }),
}
