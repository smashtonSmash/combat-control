import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Sheet({ open, onClose, title, children, footer, tall }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; tall?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={'sheet' + (tall ? ' tall' : '')} onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function Stepper({ value, onChange, min = -99, max = 999, label, step = 1 }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; label?: string; step?: number
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  return (
    <div className="stepper">
      {label && <span className="stepper-label">{label}</span>}
      <button type="button" onClick={() => onChange(clamp(value - step))}>−</button>
      <input inputMode="numeric" value={String(value)}
        onChange={(e) => { const n = parseInt(e.target.value.replace(/[^\d-]/g, '')); onChange(isNaN(n) ? 0 : clamp(n)) }} />
      <button type="button" onClick={() => onChange(clamp(value + step))}>+</button>
    </div>
  )
}

export function NumField({ label, value, onChange, className }: {
  label: string; value: number; onChange: (n: number) => void; className?: string
}) {
  return (
    <label className={'field ' + (className ?? '')}>
      <span>{label}</span>
      <input inputMode="numeric" value={String(value)}
        onChange={(e) => { const n = parseInt(e.target.value.replace(/[^\d-]/g, '')); onChange(isNaN(n) ? 0 : n) }} />
    </label>
  )
}

export function TextField({ label, value, onChange, placeholder, className }: {
  label: string; value: string; onChange: (s: string) => void; placeholder?: string; className?: string
}) {
  return (
    <label className={'field ' + (className ?? '')}>
      <span>{label}</span>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button type="button" key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}
