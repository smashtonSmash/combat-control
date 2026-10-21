import { useEffect, useRef, useState } from 'react'
import type { Character, Chest, Item } from '../types'
import { uid } from '../types'
import { ItemCard, ItemPicker } from '../components/Items'
import { Sheet, Stepper } from '../components/Sheet'
import { fmtCoins, purseTotal } from '../casino/money'

type Payload = { kind: 'item'; id: string } | { kind: 'coins' }

export default function Loot({ chests, saveChest, deleteChest, characters, onGiveItem, onGiveCoins, readOnly }: {
  chests: Chest[]; saveChest: (k: Chest) => void; deleteChest: (id: string) => void
  characters: Character[]
  onGiveItem: (charId: string, item: Item) => void
  onGiveCoins: (charId: string, gold: number, silver: number) => void
  readOnly?: boolean
}) {
  const [openId, setOpenId] = useState<string | null>(() => localStorage.getItem('dnd.lootChest'))
  useEffect(() => { if (openId) localStorage.setItem('dnd.lootChest', openId) }, [openId])
  const chest = chests.find((k) => k.id === openId) ?? chests[0]
  const [armed, setArmed] = useState<Payload | null>(null)
  const [adding, setAdding] = useState(false)
  const [coinFor, setCoinFor] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  // ---- drag (same pointer-event style as Battle) ----
  const drag = useRef<{ p: Payload; x0: number; y0: number; active: boolean } | null>(null)
  const [ghost, setGhost] = useState<{ label: string; x: number; y: number; over: string | null } | null>(null)
  useEffect(() => {
    const block = (ev: TouchEvent) => { if (drag.current?.active) ev.preventDefault() }
    document.addEventListener('touchmove', block, { passive: false })
    return () => document.removeEventListener('touchmove', block)
  }, [])
  const labelOf = (p: Payload) => (p.kind === 'coins' ? `💰 ${chest?.gold ?? 0}g ${chest?.silver ?? 0}s` : chest?.items.find((i) => i.id === p.id)?.name ?? '')
  const targetAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-charid]') as HTMLElement | null)?.dataset.charid ?? null
  const startDrag = (e: React.PointerEvent, p: Payload) => {
    if (readOnly || (e.pointerType === 'mouse' && e.button !== 0)) return
    drag.current = { p, x0: e.clientX, y0: e.clientY, active: false }
    const move = (ev: PointerEvent) => {
      const d = drag.current; if (!d) return
      if (!d.active && Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) > 8) { d.active = true; document.body.classList.add('dragging') }
      if (d.active) setGhost({ label: labelOf(d.p), x: ev.clientX, y: ev.clientY, over: targetAt(ev.clientX, ev.clientY) })
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
      const d = drag.current; drag.current = null; setGhost(null); document.body.classList.remove('dragging')
      if (d?.active) { const t = targetAt(ev.clientX, ev.clientY); if (t) drop(d.p, t) }
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }
  const tapPayload = (p: Payload) => {
    if (readOnly) return
    if (drag.current?.active) return
    setArmed((a) => (a && a.kind === p.kind && (a.kind === 'coins' || (p.kind === 'item' && a.id === p.id)) ? null : p))
  }

  const drop = (p: Payload, charId: string) => {
    if (!chest) return
    setArmed(null)
    const who = characters.find((c) => c.id === charId)?.name ?? 'them'
    if (p.kind === 'coins') { setCoinFor(charId); return }
    const it = chest.items.find((i) => i.id === p.id)
    if (!it) return
    onGiveItem(charId, it)
    saveChest({ ...chest, items: chest.items.filter((i) => i.id !== it.id), updated: Date.now() })
    setMsg(`✨ ${it.name}${it.qty > 1 ? ` ×${it.qty}` : ''} → ${who}`)
  }

  const newChest = () => {
    const k: Chest = { id: uid(), name: `Chest ${chests.length + 1}`, items: [], gold: 0, silver: 0, updated: Date.now() }
    saveChest(k); setOpenId(k.id); setAdding(true)
  }

  return (
    <div className="screen">
      <div className="screen-head"><h1>💎 Loot</h1>{!readOnly && <button className="btn primary" onClick={newChest}>＋ Chest</button>}</div>
      {readOnly && <div className="small muted">Your DM hands out loot here. Items they give you appear in your Characters → Inventory.</div>}
      {chests.length === 0 && <div className="empty">{readOnly ? 'No loot yet.' : <>No chests yet. Tap <b>＋ Chest</b> to fill one with treasure.</>}</div>}
      {chests.length > 1 && (
        <div className="chips-row wrap">{chests.map((k) => <button key={k.id} className={'chip ' + (k.id === chest?.id ? 'on' : '')} onClick={() => setOpenId(k.id)}>🧰 {k.name} <small>{k.items.length}</small></button>)}</div>
      )}
      {chest && (
        <div className="loot-chest">
          <div className="chest-head">
            <span className="chest-icon">🧰</span>
            {readOnly ? <b>{chest.name}</b> : <input className="grow" value={chest.name} onChange={(e) => saveChest({ ...chest, name: e.target.value })} />}
            {!readOnly && <button className="icon-btn danger" aria-label="Delete chest" onClick={() => { if (confirm(`Delete ${chest.name}?`)) deleteChest(chest.id) }}>🗑</button>}
          </div>
          {chest.items.length === 0 && <div className="small muted">Empty chest.</div>}
          <div className="item-grid">
            {chest.items.map((it) => (
              <ItemCard key={it.id} it={it} selected={armed?.kind === 'item' && armed.id === it.id} dragging={ghost !== null && drag.current?.p.kind === 'item' && (drag.current.p as { id: string }).id === it.id}
                onPointerDown={(e) => startDrag(e, { kind: 'item', id: it.id })} onClick={() => tapPayload({ kind: 'item', id: it.id })} />
            ))}
          </div>
          <div className={'coin-pile ' + (armed?.kind === 'coins' ? 'selected' : '')} onPointerDown={(e) => (chest.gold || chest.silver) && startDrag(e, { kind: 'coins' })} onClick={() => (chest.gold || chest.silver) && tapPayload({ kind: 'coins' })}>
            <span style={{ fontSize: 26 }}>💰</span>
            <span className="coin-pill gold">{chest.gold} g</span><span className="coin-pill silver">{chest.silver} s</span>
            {!readOnly && <span className="small muted" style={{ marginLeft: 'auto' }}>drag to a hero</span>}
          </div>
          {!readOnly && (
            <div className="row" style={{ marginTop: 8 }}>
              <Stepper label="Gold" value={chest.gold} onChange={(v) => saveChest({ ...chest, gold: Math.max(0, v) })} min={0} max={99999} />
              <Stepper label="Silver" value={chest.silver} onChange={(v) => saveChest({ ...chest, silver: Math.max(0, v) })} min={0} max={99999} />
            </div>
          )}
          {!readOnly && <button className="btn ghost sm" onClick={() => setAdding(!adding)}>{adding ? 'Done adding' : '+ Add items'}</button>}
          {!readOnly && adding && <ItemPicker onAdd={(it) => saveChest({ ...chest, items: [...chest.items, it], updated: Date.now() })} />}
        </div>
      )}

      {msg && <div className="inv-msg">{msg}</div>}
      {chest && !readOnly && (
        <>
          <div className="mini-label">{armed ? `Tap a hero to give ${labelOf(armed)}` : 'Party — drag loot onto a hero (or tap loot, then a hero)'}</div>
          <div className="drop-targets">
            {characters.map((c) => (
              <button key={c.id} data-charid={c.id} className={'drop-target ' + (ghost?.over === c.id ? 'over' : '') + (armed ? ' armed' : '')}
                onClick={() => armed && drop(armed, c.id)}>
                <b>{c.name}</b>
                <small>🛡 {c.armor || '—'} · AC {c.ac}</small>
                <small>💰 {fmtCoins(purseTotal(c.purse))} · 🎒 {(c.inventory ?? []).length}</small>
              </button>
            ))}
          </div>
        </>
      )}
      {ghost && <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>{ghost.label}{ghost.over ? <> → <b>{characters.find((c) => c.id === ghost.over)?.name}</b></> : ''}</div>}
      {coinFor && chest && (
        <CoinSheet chest={chest} name={characters.find((c) => c.id === coinFor)?.name ?? ''} onClose={() => setCoinFor(null)} onGive={(g, s) => {
          onGiveCoins(coinFor, g, s)
          saveChest({ ...chest, gold: chest.gold - g, silver: chest.silver - s, updated: Date.now() })
          setMsg(`💰 ${g}g ${s}s → ${characters.find((c) => c.id === coinFor)?.name}`); setCoinFor(null)
        }} />
      )}
    </div>
  )
}

function CoinSheet({ chest, name, onClose, onGive }: { chest: Chest; name: string; onClose: () => void; onGive: (g: number, s: number) => void }) {
  const [g, setG] = useState(chest.gold)
  const [s, setS] = useState(chest.silver)
  return (
    <Sheet open onClose={onClose} title={`💰 Coins → ${name}`}
      footer={<button className="btn big primary" disabled={!g && !s} onClick={() => onGive(g, s)}>Give {g}g {s}s</button>}>
      <div className="small muted">Chest has {chest.gold}g {chest.silver}s.</div>
      <div className="row"><Stepper label="Gold" value={g} onChange={setG} min={0} max={chest.gold} /><button className="chip" onClick={() => setG(chest.gold)}>all</button></div>
      <div className="row"><Stepper label="Silver" value={s} onChange={setS} min={0} max={chest.silver} /><button className="chip" onClick={() => setS(chest.silver)}>all</button></div>
    </Sheet>
  )
}
