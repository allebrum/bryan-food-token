// Magic-link email via Resend's HTTP API.
import { config } from './config.js'

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export async function sendMagicLink(email, link) {
  if (!config.resendApiKey || !config.emailFrom) {
    if (config.production) throw Object.assign(new Error('Email sign-in isn’t set up yet.'), { status: 503, expose: true })
    // Local development only: print the link instead of sending.
    console.log(`\n[dev] magic link for ${email}:\n${link}\n`)
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.resendApiKey}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({
      from: config.emailFrom,
      to: [email],
      subject: 'Your Food Token sign-in link',
      text: `Tap to sign in to Food Token:\n\n${link}\n\nThis link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`,
      html: `<div style="font-family:'Open Sans',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0b0b0f">
  <h1 style="font-size:26px;margin:0 0 12px">Sign in to Food Token</h1>
  <p style="font-size:16px;line-height:1.5;color:#3a3a44;margin:0 0 28px">Tap the button to sign in. This link works once and expires in 15 minutes.</p>
  <a href="${esc(link)}" style="display:inline-block;background:#0b0b0f;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:999px">Sign in</a>
  <p style="font-size:13px;color:#6e6e78;margin:32px 0 0">If you didn't ask for this, you can ignore this email.</p>
</div>`,
    }),
  })
  if (!res.ok) {
    console.error('Resend error', res.status, (await res.text()).slice(0, 300))
    throw Object.assign(new Error('We couldn’t send the email. Please try again.'), { status: 502, expose: true })
  }
}
