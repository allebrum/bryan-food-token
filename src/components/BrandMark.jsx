import { initials, onColor } from '../lib/format'

export default function BrandMark({ brand, size = 'size-12', text = 'text-base', ring = false }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-2xl font-extrabold tracking-tight ${size} ${text} ${ring ? 'ring-2 ring-white/40' : ''}`}
      style={{ background: brand.color, color: onColor(brand.color) }}
      aria-hidden="true"
    >
      {initials(brand.name)}
    </span>
  )
}
