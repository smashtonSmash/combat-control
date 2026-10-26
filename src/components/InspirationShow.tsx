import { useEffect, useRef, useState } from 'react'
import type { Character } from '../types'

/** White orb + firework when a character's inspirationPing moves forward. Old pings do not replay on load. */
export function InspirationShow({ characters }: { characters: Character[] }) {
  const seen = useRef<Map<string, number>>(new Map())
  const primed = useRef(false)
  const [burst, setBurst] = useState<{ name: string; key: number } | null>(null)

  useEffect(() => {
    if (!primed.current) {
      for (const c of characters) if (c.inspirationPing) seen.current.set(c.id, c.inspirationPing)
      primed.current = true
      return
    }
    for (const c of characters) {
      const ping = c.inspirationPing
      if (!ping) continue
      const prev = seen.current.get(c.id) ?? 0
      if (ping > prev) {
        seen.current.set(c.id, ping)
        setBurst({ name: c.name || 'Someone', key: ping })
      }
    }
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
