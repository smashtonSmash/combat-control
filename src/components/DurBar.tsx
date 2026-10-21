import type { Item } from '../types'
import { durOf, durState, maxDur } from '../durability'

/** Small durability bar for an armor item. */
export function DurBar({ it, small }: { it: Item; small?: boolean }) {
  const m = maxDur(it)
  if (!m) return null
  const d = durOf(it), st = durState(it)
  return (
    <span className={`dur-bar ${st} ${small ? 'small' : ''}`} title={`Durability ${d}/${m}${st === 'damaged' ? ' — Damaged (−1 AC)' : st === 'broken' ? ' — Broken' : ''}`} aria-label={`Durability ${d} of ${m}`}>
      <i style={{ width: `${(d / m) * 100}%` }} /><em>{st === 'broken' ? 'BROKEN' : `${d}/${m}`}</em>
    </span>
  )
}
