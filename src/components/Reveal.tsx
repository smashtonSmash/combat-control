import { useEffect, useRef, useState } from 'react'
import type { Chest, Character } from '../types'
import type { RevealEntry } from '../reveal'
import { revealOrder, chestDrama } from '../reveal'
import { ChestArt, ItemIcon, type ChestPhase } from './ChestArt'
import { TIER_COLORS } from '../armor'
import { WhoName, usePlayerDirectory } from './PlayerName'
import { withPlayer } from '../playerLabel'

/** Full-screen treasure reveal shown to players while the DM has a chest revealed. Updates live. */
type TakeFn = (what: 'item' | 'pouch' | 'coins', ref: string | null, charId: string, gold: number, silver: number) => Promise<string | null>
export function RevealOverlay({ chest, onClose, myChars = [], onTake }: { chest: Chest; onClose: () => void; myChars?: Character[]; onTake?: TakeFn }) {
  const [taking, setTaking] = useState<RevealEntry | null>(null)
  const canTake = !!onTake && chest.allowTake !== false && myChars.length > 0
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
              {canTake && <button className="btn sm take-btn" onClick={() => setTaking(e)}>Take</button>}
            </div>
          ) : (
            <div key={e.key} className="reveal-item rcoin" style={{ animationDelay: `${e.delay}s` }}>
              <span className="ri-icon"><ItemIcon kind={e.type} /></span><b>{e.type === 'pouch' ? 'Coin pouch' : 'Loose coins'}</b><small>{e.gold ? `${e.gold}g ` : ''}{e.silver ? `${e.silver}s` : ''}</small>
              {canTake && <button className="btn sm take-btn" onClick={() => setTaking(e)}>Take</button>}
            </div>
          ))}
          {empty && <div className="small muted center">The chest is empty — everything has been claimed!</div>}
        </div>
      )}
      {open && onTake && chest.allowTake === false && <div className="small muted center">🔒 The DM is handing out this loot — taking is turned off.</div>}
      {taking && onTake && <TakeSheet entry={taking} chest={chest} chars={myChars} onTake={onTake} onClose={() => setTaking(null)} />}
      <div className="reveal-toasts">{toasts.map((t) => <div key={t.at} className="reveal-toast">✨ {t.text}</div>)}</div>
      <div className="small muted center" style={{ marginTop: 'auto' }}>Your DM is handing out the loot…</div>
    </div></div>
  )
}

function TakeSheet({ entry, chest, chars, onTake, onClose }: { entry: RevealEntry; chest: Chest; chars: Character[]; onTake: TakeFn; onClose: () => void }) {
  const [charId, setCharId] = useState(chars[0]?.id ?? '')
  const [gold, setGold] = useState(entry.type === 'coins' ? chest.gold : 0)
  const [silver, setSilver] = useState(entry.type === 'coins' ? chest.silver : 0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const dir = usePlayerDirectory()
  const name = entry.type === 'item' ? entry.item.name : entry.type === 'pouch' ? `Coin pouch (${entry.gold}g ${entry.silver}s)` : 'Loose coins'
  const go = async () => {
    setBusy(true); setErr(null)
    const ref = entry.type === 'coins' ? null : entry.key
    const e = await onTake(entry.type, ref, charId, gold, silver)
    setBusy(false)
    if (e) setErr(e); else onClose()
  }
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.floor(v || 0)))
  return (
    <div className="take-backdrop" onClick={onClose}>
      <div className="take-sheet" role="dialog" aria-label="Take loot" onClick={(e) => e.stopPropagation()}>
        <div className="take-title">Take {name}?</div>
        {chars.length > 1 && (
          <label className="small">Give to
            <select value={charId} onChange={(e) => setCharId(e.target.value)}>{chars.map((c) => <option key={c.id} value={c.id}>{withPlayer(c.name, dir.label[c.id])}</option>)}</select>
          </label>
        )}
        {chars.length === 1 && <div className="small muted">Goes to <WhoName id={chars[0].id} name={chars[0].name} />{entry.type === 'item' ? "'s inventory" : "'s purse"}</div>}
        {entry.type === 'coins' && (
          <div className="take-coins">
            <label>Gold <input type="number" inputMode="numeric" min={0} max={chest.gold} value={gold} onChange={(e) => setGold(clamp(+e.target.value, chest.gold))} /> <small>of {chest.gold}</small></label>
            <label>Silver <input type="number" inputMode="numeric" min={0} max={chest.silver} value={silver} onChange={(e) => setSilver(clamp(+e.target.value, chest.silver))} /> <small>of {chest.silver}</small></label>
          </div>
        )}
        {err && <div className="take-err">⚠ {err}</div>}
        <div className="take-actions">
          <button className="btn" onClick={onClose}>{err ? 'Close' : 'Cancel'}</button>
          {!err && <button className="btn primary" disabled={busy || !charId || (entry.type === 'coins' && !gold && !silver)} onClick={go}>{busy ? 'Taking…' : 'Take it'}</button>}
        </div>
      </div>
    </div>
  )
}
