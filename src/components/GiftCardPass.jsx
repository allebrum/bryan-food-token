import { onColor, money, initials } from '../lib/format'

// Apple Wallet–style pass face. `peek` renders the compact stacked version.
export default function GiftCardPass({ card, peek = false, className = '', style, onClick, as: Tag = onClick ? 'button' : 'div' }) {
  const fg = onColor(card.brand.color)
  const used = card.balance === 0
  return (
    <Tag
      onClick={onClick}
      style={{ background: card.brand.color, color: fg, ...style }}
      className={`relative block w-full overflow-hidden rounded-[var(--radius-pass)] text-left shadow-[var(--shadow-pass)] ${
        onClick ? 'transition duration-300 hover:-translate-y-1.5 focus-visible:-translate-y-1.5' : ''
      } ${used ? 'grayscale-[0.7]' : ''} ${className}`}
      aria-label={onClick ? `${card.brand.name} gift card, ${money(card.balance)} left` : undefined}
    >
      {/* sheen */}
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgba(255,255,255,0.22),transparent_55%)]" />
      <span className="pointer-events-none absolute -bottom-16 -right-10 size-48 rounded-full border-[18px] border-current opacity-[0.07]" />
      <span className="relative flex aspect-[1.586] flex-col justify-between p-5 sm:p-6">
        <span className="flex items-start justify-between gap-3">
          <span className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-current/15 text-sm font-extrabold" style={{ backgroundColor: fg === '#ffffff' ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.08)' }}>
              {initials(card.brand.name)}
            </span>
            <span className="text-lg font-bold leading-tight">{card.brand.name}</span>
          </span>
          <span className="text-right">
            <span className="block text-[11px] font-bold uppercase tracking-widest opacity-70">{used ? 'Used up' : 'Balance'}</span>
            <span className="tabular block text-2xl font-extrabold leading-tight">{money(card.balance)}</span>
          </span>
        </span>
        {!peek && (
          <span className="flex items-end justify-between">
            <span>
              <span className="block text-[11px] font-bold uppercase tracking-widest opacity-70">Gift card</span>
              <span className="tabular block font-semibold">{money(card.faceValue, { whole: true })} · •••• {card.last4}</span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest opacity-70">Food Token</span>
          </span>
        )}
      </span>
    </Tag>
  )
}
