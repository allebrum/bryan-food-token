const VARIANTS = {
  primary: 'bg-ink text-white hover:bg-black active:scale-[0.98] disabled:bg-ink/30',
  accent: 'bg-accent text-white hover:bg-accent-dark active:scale-[0.98] disabled:bg-accent/40',
  soft: 'bg-canvas text-ink hover:bg-line active:scale-[0.98]',
  ghost: 'text-ink hover:bg-canvas',
  outline: 'border-2 border-line text-ink hover:border-ink/40 bg-white',
  danger: 'bg-red-50 text-red-700 hover:bg-red-100',
}
const SIZES = {
  sm: 'h-10 px-4 text-sm rounded-full',
  md: 'h-12 px-6 text-base rounded-full',
  lg: 'h-14 px-8 text-lg rounded-full',
}

export default function Button({ as: Tag = 'button', variant = 'primary', size = 'md', block, className = '', children, ...props }) {
  return (
    <Tag
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition [&_svg]:shrink-0 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
      {...(Tag === 'button' && !props.type ? { type: 'button' } : {})}
      {...props}
    >
      {children}
    </Tag>
  )
}
