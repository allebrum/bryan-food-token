export const money = (cents, { whole = false } = {}) =>
  (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole && cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: whole && cents % 100 === 0 ? 0 : 2,
  })

export const pct = (n) => `${Math.round(n * 100)}%`

export function ago(iso) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  const d = Math.floor(s / 86400)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const groupCard = (n = '') => n.replace(/(.{4})/g, '$1 ').trim()
export const initials = (name = '') =>
  name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

// Pick readable text on a brand colour.
export function onColor(hex) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#0b0b0f' : '#ffffff'
}
