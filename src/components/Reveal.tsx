import { useEffect, useRef, useState } from 'react'
import type { Chest } from '../types'
import { revealOrder, chestDrama } from '../reveal'
import { ChestArt, ItemIcon, type ChestPhase } from './ChestArt'
import { TIER_COLORS } from '../armor'

/** Full-screen treasure reveal shown to players while the DM has a chest revealed. Updates live. */
export function RevealOverlay({ chest, onClose }: { chest: Chest; onClose: () => void }) {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const drama = chestDrama(chest)
  const [phase, setPhase] = useState<ChestPhase>(reduce ? 'open' : 'closed')
  const open = phase === 'open'
  const [toasts, setToasts] = useState<{ text: string; at: number }[]>([])
  const seen = useRef(chest.lastGiven?.at ?? 0)
  useEffect(() => {
    if (reduce) { setPhase('open'); return }
    setPhase('closed')
    const a = setTimeout(() => setPhase('opening'), 500), b = setTimeout(() => setPhase('open'), 1700 + (drama === 5 ? 1100 : drama === 4 ? 700 : 0))
    return () => { clearTimeout(a); clearTimeout(b) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chest.revealedAt, reduce])
  useEffect(() => {
    const g = chest.lastGiven
    if (g && g.at > seen.current) {
      seen.current = g.at
      setToasts((ts) => [...ts, g])
      setTimeout(() => setToasts((ts) => ts.filter((x) => x !== g)), 3500)
    }
  }, [chest.lastGiven])
  const pouches = chest.pouches ?? []
  const empty = !chest.items.length && !pouches.length && !chest.gold && !chest.silver
  return (
    <div className="reveal-overlay"><div className="reveal-vignette" /><div className="reveal-content" role="dialog" aria-label="Treasure revealed">
      <button className="reveal-close icon-btn" aria-label="Close" onClick={onClose}>✕</button>
      <div className="reveal-title">{chest.name}</div>
      <ChestArt phase={phase} drama={drama} />
      {open && (
        <div className="reveal-loot">
          {revealOrder(chest).map((e) => e.type === 'item' ? (
            <div key={e.key} className={'reveal-item' + (e.item.tier ? ' rare r' + e.rank : '')} style={{ animationDelay: `${e.delay}s`, ...(e.item.tier ? { ['--rar' as string]: TIER_COLORS[e.item.tier] } : {}) }}>
              <span className="ri-icon"><ItemIcon kind={e.item.kind} /></span><b>{e.item.name}{e.item.tier && <em className="ri-tier" style={{ color: TIER_COLORS[e.item.tier] }}>{e.item.tier}</em>}</b>{e.item.qty > 1 && <small>×{e.item.qty}</small>}
            </div>
          ) : (
            <div key={e.key} className="reveal-item rcoin" style={{ animationDelay: `${e.delay}s` }}>
              <span className="ri-icon"><ItemIcon kind={e.type} /></span><b>{e.type === 'pouch' ? 'Coin pouch' : 'Loose coins'}</b><small>{e.gold ? `${e.gold}g ` : ''}{e.silver ? `${e.silver}s` : ''}</small>
            </div>
          ))}
          {empty && <div className="small muted center">The chest is empty — everything has been claimed!</div>}
        </div>
      )}
      <div className="reveal-toasts">{toasts.map((t) => <div key={t.at} className="reveal-toast">✨ {t.text}</div>)}</div>
      <div className="small muted center" style={{ marginTop: 'auto' }}>Your DM is handing out the loot…</div>
    </div></div>
  )
}
