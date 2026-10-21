import { useEffect, useRef, useState } from 'react'
import type { Chest } from '../types'
import { KIND_ICON } from '../inventory'
import { TIER_COLORS } from '../armor'

/** Full-screen treasure reveal shown to players while the DM has a chest revealed. Updates live. */
export function RevealOverlay({ chest, onClose }: { chest: Chest; onClose: () => void }) {
  const [open, setOpen] = useState(false)
  const [toasts, setToasts] = useState<{ text: string; at: number }[]>([])
  const seen = useRef(chest.lastGiven?.at ?? 0)
  useEffect(() => { const t = setTimeout(() => setOpen(true), 900); return () => clearTimeout(t) }, [chest.revealedAt])
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
    <div className="reveal-overlay" role="dialog" aria-label="Treasure revealed">
      <button className="reveal-close icon-btn" aria-label="Close" onClick={onClose}>✕</button>
      <div className="reveal-title">{chest.name}</div>
      <div className={'big-chest ' + (open ? 'open' : '')}>
        <div className="chest-glow" />
        <div className="chest-lid"><span>✦</span></div>
        <div className="chest-base"><span className="lock">🔒</span></div>
      </div>
      {open && (
        <div className="reveal-loot">
          {chest.items.map((it, i) => (
            <div key={it.id} className="reveal-item" style={{ animationDelay: `${i * 0.08}s`, ...(it.tier ? { borderColor: TIER_COLORS[it.tier], boxShadow: `0 0 12px ${TIER_COLORS[it.tier]}66` } : {}) }}>
              <span className="ri-icon">{KIND_ICON[it.kind]}</span><b>{it.name}</b>{it.qty > 1 && <small>×{it.qty}</small>}
            </div>
          ))}
          {pouches.map((q, i) => (
            <div key={q.id} className="reveal-item coin" style={{ animationDelay: `${(chest.items.length + i) * 0.08}s` }}>
              <span className="ri-icon">👝</span><b>Coin pouch</b><small>{q.gold ? `${q.gold}g ` : ''}{q.silver ? `${q.silver}s` : ''}</small>
            </div>
          ))}
          {(chest.gold > 0 || chest.silver > 0) && (
            <div className="reveal-item coin" style={{ animationDelay: `${(chest.items.length + pouches.length) * 0.08}s` }}>
              <span className="ri-icon">💰</span><b>Loose coins</b><small>{chest.gold}g {chest.silver}s</small>
            </div>
          )}
          {empty && <div className="small muted center">The chest is empty — everything has been claimed!</div>}
        </div>
      )}
      <div className="reveal-toasts">{toasts.map((t) => <div key={t.at} className="reveal-toast">✨ {t.text}</div>)}</div>
      <div className="small muted center" style={{ marginTop: 'auto' }}>Your DM is handing out the loot…</div>
    </div>
  )
}
