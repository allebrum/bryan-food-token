export function LogoMark({ className = 'size-9' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#FF5B22" />
      <circle cx="32" cy="32" r="18" fill="none" stroke="#fff" strokeWidth="5" />
      <path d="M27 23v8a5 5 0 0 0 10 0v-8M32 23v18" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export default function Logo({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className="text-xl font-extrabold tracking-tight">Food Token</span>
    </span>
  )
}
