// Email via Resend's HTTP API: sign-in links and admin alerts.
import { config } from './config.js'

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

async function send({ to, subject, text, html, replyTo }) {
  if (!config.resendApiKey || !config.emailFrom) {
    if (config.production) throw Object.assign(new Error('Email isn’t set up yet.'), { status: 503, expose: true })
    // Local development only: print instead of sending.
    console.log(`\n[dev] email to ${to.join(', ')} — ${subject}\n${text}\n`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.resendApiKey}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ from: config.emailFrom, to, subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  })
  if (!res.ok) {
    console.error('Resend error', res.status, (await res.text()).slice(0, 300))
    throw Object.assign(new Error('We couldn’t send the email. Please try again.'), { status: 502, expose: true })
  }
}

const shell = (inner) => `<div style="font-family:'Open Sans',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0b0b0f">${inner}</div>`
const button = (href, label) =>
  `<a href="${esc(href)}" style="display:inline-block;background:#0b0b0f;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:999px">${esc(label)}</a>`

export function sendMagicLink(email, link) {
  return send({
    to: [email],
    subject: 'Your Food Token sign-in link',
    text: `Tap to sign in to Food Token:\n\n${link}\n\nThis link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`,
    html: shell(`<h1 style="font-size:26px;margin:0 0 12px">Sign in to Food Token</h1>
  <p style="font-size:16px;line-height:1.5;color:#3a3a44;margin:0 0 28px">Tap the button to sign in. This link works once and expires in 15 minutes.</p>
  ${button(link, 'Sign in')}
  <p style="font-size:13px;color:#6e6e78;margin:32px 0 0">If you didn't ask for this, you can ignore this email.</p>`),
  })
}

// To every ADMIN_EMAILS address; replies go straight to the customer.
export function sendDepositHelpRequest({ user, deposit, reason, message, adminUrl, explorerUrl }) {
  if (!config.adminEmails.size) throw Object.assign(new Error('Support isn’t set up yet.'), { status: 503, expose: true })
  const rows = [
    ['Customer', `${user.name || 'No name yet'} <${user.email}>`],
    ['Deposit', `${deposit.amount} ${deposit.coin} on ${deposit.networkLabel}`],
    ['Value', deposit.usdCents != null ? `$${(deposit.usdCents / 100).toFixed(2)}` : 'unknown'],
    ['Status', reason],
    ['Transaction', explorerUrl || deposit.txRef],
    ['Received', new Date(deposit.createdAt).toUTCString()],
  ]
  return send({
    to: [...config.adminEmails],
    replyTo: user.email,
    subject: `Food Token: ${user.email} needs help with a ${deposit.coin} deposit`,
    text: `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nTheir message:\n${message || '(none)'}\n\nReview it: ${adminUrl}\nReply to this email to reach them.`,
    html: shell(`<h1 style="font-size:22px;margin:0 0 16px">A customer needs help with a deposit</h1>
  <table style="font-size:15px;border-collapse:collapse;margin:0 0 20px">${rows
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#6e6e78;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;word-break:break-all">${esc(v)}</td></tr>`)
    .join('')}</table>
  <p style="font-size:15px;margin:0 0 6px;color:#6e6e78">Their message</p>
  <p style="font-size:16px;line-height:1.5;margin:0 0 28px;white-space:pre-wrap">${esc(message || '(none)')}</p>
  ${button(adminUrl, 'Review in admin')}
  <p style="font-size:13px;color:#6e6e78;margin:28px 0 0">Reply to this email to reach the customer directly.</p>`),
  })
}
