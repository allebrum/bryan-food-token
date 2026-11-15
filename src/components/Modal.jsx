import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft } from 'lucide-react'

// Several sheets can hand off to each other; count locks so scroll comes back.
let locks = 0

// One step per screen: a bottom sheet on phones, a centred card on desktop.
export default function Modal({ open, onClose, onBack, label, children, wide = false, dark = false, step }) {
  const panel = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Lock scroll, wire Escape, restore focus on close.
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.()
    document.addEventListener('keydown', onKey)
    if (locks++ === 0) document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      if (--locks === 0) document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open])

  // Move focus to the step's main control each time the step changes.
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      const el = panel.current?.querySelector('[data-autofocus]') || panel.current
      el?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(id)
  }, [open, step])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`relative max-h-[92dvh] w-full animate-sheet overflow-y-auto rounded-t-[28px] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl outline-none focus-visible:outline-none sm:rounded-[28px] sm:px-10 sm:pb-10 sm:pt-7 ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        } ${dark ? 'bg-ink text-white' : 'bg-white'}`}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/10 sm:hidden" />
        <div className="mb-2 flex h-10 items-center justify-between">
          {onBack ? (
            <button onClick={onBack} className={`-ml-2 grid size-10 place-items-center rounded-full ${dark ? 'hover:bg-white/10' : 'hover:bg-canvas'}`} aria-label="Back">
              <ChevronLeft className="size-6" />
            </button>
          ) : (
            <span />
          )}
          {onClose && (
            <button onClick={onClose} className={`-mr-2 grid size-10 place-items-center rounded-full ${dark ? 'bg-white/10 hover:bg-white/20' : 'bg-canvas hover:bg-line'}`} aria-label="Close">
              <X className="size-5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function StepDots({ step, total, dark }) {
  return (
    <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-accent' : `w-1.5 ${dark ? 'bg-white/25' : 'bg-line'}`}`}
        />
      ))}
    </div>
  )
}

export function SheetTitle({ eyebrow, title, children }) {
  return (
    <div className="mb-7">
      {eyebrow && <p className="mb-2 text-sm font-bold uppercase tracking-wider text-accent">{eyebrow}</p>}
      <h2 className="text-[28px] font-extrabold leading-tight tracking-tight sm:text-3xl">{title}</h2>
      {children && <p className="mt-3 text-lg leading-relaxed text-muted">{children}</p>}
    </div>
  )
}
