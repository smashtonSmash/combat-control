import { useEffect, useRef, useState } from 'react'
import { observeInspiration } from '../inspiration'
import type { Character } from '../types'

/** White orb + firework when inspiration is newly granted. Saved pings do not replay on load. */
export function InspirationShow({ characters }: { characters: Character[] }) {
  const seen = useRef<Map<string, number>>(new Map())
  const [burst, setBurst] = useState<{ name: string; key: number } | null>(null)

  useEffect(() => {
    const next = observeInspiration(seen.current, characters)
    seen.current = next.seen
    if (next.burst) setBurst(next.burst)
  }, [characters])

  useEffect(() => {
    if (!burst) return
    const t = setTimeout(() => setBurst(null), 2600)
    return () => clearTimeout(t)
  }, [burst])

  if (!burst) return null
  return (
    <div className="inspo-overlay" key={burst.key} role="status" aria-live="polite">
      <div className="inspo-orb" />
      <div className="inspo-pop" />
      <div className="inspo-label">+1 Inspiration · {burst.name}</div>
    </div>
  )
}
