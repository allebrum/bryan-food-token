// Encryption for gift card numbers, PINs and e-gift links (AES-256-GCM),
// plus token hashing for sessions and magic links.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'
import { config } from './config.js'

let key
function cardKey() {
  if (key) return key
  const raw = Buffer.from(config.cardKey, 'base64')
  if (raw.length !== 32) throw new Error('CARD_ENCRYPTION_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)')
  key = raw
  return key
}

// Format: v1.<iv>.<tag>.<ciphertext>, all base64url.
export function encrypt(plain) {
  if (plain == null || plain === '') return null
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', cardKey(), iv)
  const body = Buffer.concat([c.update(String(plain), 'utf8'), c.final()])
  return ['v1', iv, c.getAuthTag(), body].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.')
}

export function decrypt(blob) {
  if (!blob) return null
  const [v, iv, tag, body] = blob.split('.')
  if (v !== 'v1') throw new Error('Unknown ciphertext version')
  const d = createDecipheriv('aes-256-gcm', cardKey(), Buffer.from(iv, 'base64url'))
  d.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([d.update(Buffer.from(body, 'base64url')), d.final()]).toString('utf8')
}

// Keyed hash of a card number: detects duplicates without storing it in clear.
export const cardNumberHash = (n) => createHmac('sha256', cardKey()).update(String(n).replace(/[\s-]/g, '')).digest('hex')

export const newToken = () => randomBytes(32).toString('base64url')
export const sha256 = (s) => createHash('sha256').update(s).digest('hex')
