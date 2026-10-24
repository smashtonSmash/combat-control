import { ShopForge } from '../components/ShopForge'
import { ChestArt } from '../components/ChestArt'
import { useEffect, useRef, useState } from 'react'
import type { Character, Chest, Item } from '../types'
import { uid } from '../types'
import { ItemCard, ItemPicker } from '../components/Items'
import { Sheet, Stepper } from '../components/Sheet'
import { fmtCoins, purseTotal } from '../casino/money'
import { coinsToSilver, splitEvenly, takeFrom } from '../loot'
import { LOOT_TABLES, rollLoot, tableById } from '../lootTables'
import type { RecapKind } from '../recap'
import { WhoName, usePlayerDirectory } from '../components/PlayerName'
import { withPlayer } from '../playerLabel'

type Payload = { kind: 'item'; id: string } | { kind: 'pouch'; id: string }

export default function Loot({ chests, saveChest, deleteChest, characters, onGiveItem, onGiveCoins, readOnly, online, onOpenReveal, onSaveChar, pendingLoot = [], onPendingLoot, onRecap }: {
  chests: Chest[]; saveChest: (k: Chest) => void; deleteChest: (id: string) => void
  characters: Character[]
  onGiveItem: (charId: string, item: Item) => void
  onGiveCoins: (charId: string, gold: number, silver: number) => void
  readOnly?: boolean
  onSaveChar?: (c: Character) => void
  online?: boolean
  onOpenReveal?: () => void
  pendingLoot?: Item[]
  onPendingLoot?: (items: Item[]) => void
  onRecap?: (kind: RecapKind, text: string) => void
}) {
  const [openId, setOpenId] = useState<string | null>(() => localStorage.getItem('dnd.lootChest'))
  useEffect(() => { if (openId) localStorage.setItem('dnd.lootChest', openId) }, [openId])
  const chest = chests.find((k) => k.id === openId) ?? chests[0]
  const [armed, setArmed] = useState<Payload | null>(null)
  const [adding, setAdding] = useState(false)
  const [pouchOpen, setPouchOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [tableId, setTableId] = useState(LOOT_TABLES[0].id)
  const dir = usePlayerDirectory()

  // ---- drag (same pointer-event style as Battle) ----
  const drag = useRef<{ p: Payload; x0: number; y0: number; active: boolean } | null>(null)
  const [ghost, setGhost] = useState<{ label: string; x: number; y: number; over: string | null } | null>(null)
  useEffect(() => {
    const block = (ev: TouchEvent) => { if (drag.current?.active) ev.preventDefault() }
    document.addEventListener('touchmove', block, { passive: false })
    return () => document.removeEventListener('touchmove', block)
  }, [])
  const pouchLabel = (g: number, s: number) => `💰 ${g ? g + 'g' : ''}${g && s ? ' ' : ''}${s || !g ? s + 's' : ''}`
  const labelOf = (p: Payload) => {
    if (p.kind === 'pouch') { const q = chest?.pouches?.find((x) => x.id === p.id); return q ? pouchLabel(q.gold, q.silver) + ' pouch' : '' }
    return chest?.items.find((i) => i.id === p.id)?.name ?? ''
  }
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
    setArmed((a) => (a && a.kind === p.kind && a.id === p.id ? null : p))
  }

  const drop = (p: Payload, charId: string) => {
    if (!chest) return
    setArmed(null)
    const hero = characters.find((c) => c.id === charId)
    const who = hero ? withPlayer(hero.name, dir.label[hero.id]) : 'them'
    if (p.kind === 'pouch') {
      const q = chest.pouches?.find((x) => x.id === p.id)
      if (!q) return
      onGiveCoins(charId, q.gold, q.silver)
      saveChest({ ...chest, pouches: (chest.pouches ?? []).filter((x) => x.id !== q.id), updated: Date.now(), lastGiven: { text: `${who} got ${pouchLabel(q.gold, q.silver)}`, at: Date.now() } })
      setMsg(`${pouchLabel(q.gold, q.silver)} → ${who}`)
      return
    }
    const it = chest.items.find((i) => i.id === p.id)
    if (!it) return
    onGiveItem(charId, it)
    saveChest({ ...chest, items: chest.items.filter((i) => i.id !== it.id), updated: Date.now(), lastGiven: { text: `${who} got ${it.name}${it.qty > 1 ? ` ×${it.qty}` : ''}`, at: Date.now() } })
    setMsg(`✨ ${it.name}${it.qty > 1 ? ` ×${it.qty}` : ''} → ${who}`)
  }

  const newChest = () => {
    const k: Chest = { id: uid(), name: `Chest ${chests.length + 1}`, items: [], gold: 0, silver: 0, pouches: [], updated: Date.now() }
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
            <span className="chest-icon"><ChestArt phase={chest.revealedAt ? 'open' : 'closed'} small /></span>
            {readOnly ? <b>{chest.name}</b> : <input className="grow" style={{ minWidth: 100 }} value={chest.name} onChange={(e) => saveChest({ ...chest, name: e.target.value })} />}
            {!readOnly && online && (chest.revealedAt
              ? <button className="btn sm danger" onClick={() => saveChest({ ...chest, revealedAt: null })}>🔒 Close chest</button>
              : <button className="btn sm primary" onClick={() => saveChest({ ...chest, revealedAt: Date.now(), lastGiven: undefined })}>✨ Reveal to party</button>)}
            {!readOnly && online && <label className="take-toggle small"><input type="checkbox" checked={chest.allowTake !== false} onChange={(e) => saveChest({ ...chest, allowTake: e.target.checked })} /> Allow players to take</label>}
            {readOnly && chest.revealedAt && <button className="btn sm primary" onClick={onOpenReveal}>👀 View</button>}
            {!readOnly && <button className="icon-btn danger" aria-label="Delete chest" onClick={() => { if (confirm(`Delete ${chest.name}?`)) deleteChest(chest.id) }}>🗑</button>}
          </div>
          {chest.items.length === 0 && !(chest.pouches ?? []).length && <div className="small muted">Empty chest.</div>}
          <div className="item-grid">
            {chest.items.map((it) => (
              <ItemCard key={it.id} it={it} selected={armed?.kind === 'item' && armed.id === it.id} dragging={ghost !== null && drag.current?.p.kind === 'item' && (drag.current.p as { id: string }).id === it.id}
                onPointerDown={(e) => startDrag(e, { kind: 'item', id: it.id })} onClick={() => tapPayload({ kind: 'item', id: it.id })} />
            ))}
            {(chest.pouches ?? []).map((q) => (
              <button key={q.id} type="button" className={'item-card pouch ' + (armed?.kind === 'pouch' && armed.id === q.id ? 'selected' : '')}
                onPointerDown={(e) => startDrag(e, { kind: 'pouch', id: q.id })} onClick={() => tapPayload({ kind: 'pouch', id: q.id })} onContextMenu={(e) => e.preventDefault()}>
                {!readOnly && <span className="pouch-x" role="button" aria-label="Delete pouch (coins go back)" onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); saveChest({ ...chest, gold: chest.gold + q.gold, silver: chest.silver + q.silver, pouches: (chest.pouches ?? []).filter((x) => x.id !== q.id), updated: Date.now() }); setArmed(null) }}>✕</span>}
                <span className="item-icon">👝</span>
                <span className="item-name">Coin pouch</span>
                <small className="item-sub pouch-amt">{q.gold ? <b className="g">{q.gold}g</b> : null} {q.silver ? <b className="s">{q.silver}s</b> : null}</small>
              </button>
            ))}
          </div>
          <div className="coin-pile">
            <span style={{ fontSize: 26 }}>💰</span>
            <div><div className="mini-label" style={{ margin: 0 }}>Left in chest</div>
              <span className="coin-pill gold">{chest.gold} g</span> <span className="coin-pill silver">{chest.silver} s</span></div>
          </div>
          {!readOnly && (
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn grow" disabled={!chest.gold && !chest.silver} onClick={() => setPouchOpen(true)}>👝 New pouch</button>
              <button className="btn grow" disabled={!chest.gold && !chest.silver} onClick={() => setSplitOpen(true)}>⚖ Split evenly</button>
            </div>
          )}
          {!readOnly && (
            <div className="row" style={{ marginTop: 8 }}>
              <Stepper label="Chest gold" value={chest.gold} onChange={(v) => saveChest({ ...chest, gold: Math.max(0, v) })} min={0} max={99999} />
              <Stepper label="Silver" value={chest.silver} onChange={(v) => saveChest({ ...chest, silver: Math.max(0, v) })} min={0} max={99999} />
            </div>
          )}
          {!readOnly && <button className="btn ghost sm" onClick={() => setAdding(!adding)}>{adding ? 'Done adding' : '+ Add items'}</button>}
          {!readOnly && adding && <ItemPicker customSpells={characters.flatMap((c) => (c.spells ?? []).filter((s) => !s.srd))} onAdd={(it) => saveChest({ ...chest, items: [...chest.items, it], updated: Date.now() })} />}
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
                <b><WhoName id={c.id} name={c.name} /></b>
                <small>🛡 {c.armor || '—'} · AC {c.ac}</small>
                <small>💰 {fmtCoins(purseTotal(c.purse))} · 🎒 {(c.inventory ?? []).length}</small>
              </button>
            ))}
          </div>
        </>
      )}
      {ghost && <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>{ghost.label}{ghost.over ? <> → <b>{(() => { const h = characters.find((c) => c.id === ghost.over); return h ? <WhoName id={h.id} name={h.name} /> : null })()}</b></> : ''}</div>}
      {pouchOpen && chest && (
        <PouchSheet chest={chest} onClose={() => setPouchOpen(false)} onCreate={(g, sv) => {
          const left = takeFrom(chest, g, sv)
          if (!left) return
          saveChest({ ...chest, ...left, pouches: [...(chest.pouches ?? []), { id: uid(), gold: g, silver: sv }], updated: Date.now() })
          setPouchOpen(false)
        }} />
      )}
      {splitOpen && chest && (
        <SplitSheet chest={chest} characters={characters} onClose={() => setSplitOpen(false)} onConfirm={(ids, leftoverTo) => {
          const r = splitEvenly(chest.gold, chest.silver, ids.length, leftoverTo)
          ids.forEach((id, i) => onGiveCoins(id, r.shares[i].gold, r.shares[i].silver))
          saveChest({ ...chest, ...r.chest, updated: Date.now(), lastGiven: { text: `Coins split among ${ids.length}`, at: Date.now() } })
          setMsg(`⚖ Split ${chest.gold}g ${chest.silver}s among ${ids.length}${r.leftover ? ` (${r.leftover}s leftover → ${leftoverTo === 'chest' ? 'chest' : (() => { const h = characters.find((c) => c.id === ids[0]); return h ? withPlayer(h.name, dir.label[h.id]) : 'first' })()})` : ''}`)
          setSplitOpen(false)
        }} />
      )}
      {!readOnly && pendingLoot.length > 0 && (
        <div className="panel">
          <div className="row between"><b>Battle drops</b><button className="link small" onClick={() => onPendingLoot?.([])}>Clear</button></div>
          <div className="small muted">Rolled when a monster with a loot table hit 0 HP. Not every kill drops something.</div>
          {pendingLoot.map((it) => (
            <div key={it.id} className="fuse-row"><span>{it.name}</span>
              {chest && <button className="btn sm" onClick={() => { saveChest({ ...chest, items: [...chest.items, it], updated: Date.now() }); onPendingLoot?.(pendingLoot.filter((x) => x.id !== it.id)) }}>Into {chest.name}</button>}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <div className="panel">
          <b>Loot tables</b>
          <div className="small muted">PLACEHOLDER odds. Easier rows are mostly Common. Harder rows are where Legendary shows up.</div>
          <div className="chips-row wrap">{LOOT_TABLES.map((t) => (
            <button key={t.id} className={'chip ' + (tableId === t.id ? 'on' : '')} onClick={() => setTableId(t.id)}>{t.name} <small>{t.kind} · {Math.round(t.gearChance * 100)}%</small></button>
          ))}</div>
          <button className="btn sm" disabled={!chest} onClick={() => {
            const table = tableById(tableId)
            if (!table || !chest) return
            const found = rollLoot(table)
            if (!found.length) { setMsg(`${table.name}: nothing this time.`); onRecap?.('drop', `${table.name}: nothing this time.`); return }
            saveChest({ ...chest, items: [...chest.items, ...found], updated: Date.now() })
            const text = `${table.name}: ${found.map((i) => i.name).join(', ')}.`
            setMsg(text); onRecap?.('drop', text)
          }}>Roll into {chest?.name ?? 'a chest'}</button>
        </div>
      )}
      {!readOnly && onSaveChar && <ShopForge characters={characters} onSave={onSaveChar} onRecap={onRecap} />}
    </div>
  )
}

function PouchSheet({ chest, onClose, onCreate }: { chest: Chest; onClose: () => void; onCreate: (g: number, s: number) => void }) {
  const [g, setG] = useState(0)
  const [s, setS] = useState(0)
  const ok = (g || s) && takeFrom(chest, g, s)
  const total = coinsToSilver(chest.gold, chest.silver)
  const set = (t: number) => { setG(Math.min(chest.gold, Math.floor(t / 10))); setS(t - Math.min(chest.gold, Math.floor(t / 10)) * 10) }
  return (
    <Sheet open onClose={onClose} title="👝 New coin pouch"
      footer={<button className="btn big primary" disabled={!ok} onClick={() => onCreate(g, s)}>Make pouch: {g}g {s}s</button>}>
      <div className="small muted">Chest has <b>{chest.gold}g {chest.silver}s</b> left.</div>
      <div className="row"><Stepper label="Gold" value={g} onChange={(v) => setG(Math.max(0, Math.min(chest.gold, v)))} min={0} max={chest.gold} /></div>
      <div className="row"><Stepper label="Silver" value={s} onChange={(v) => setS(Math.max(0, v))} min={0} max={total} /></div>
      <div className="chips-row wrap">
        <button className="chip" onClick={() => { setG(chest.gold); setS(chest.silver) }}>Rest of it</button>
        <button className="chip" onClick={() => set(Math.floor(total / 2))}>Half</button>
        {[1, 5, 10, 25].filter((n) => n <= chest.gold).map((n) => <button key={n} className="chip" onClick={() => { setG(n); setS(0) }}>{n}g</button>)}
      </div>
      {!ok && (g > 0 || s > 0) && <div className="small" style={{ color: '#f08a78' }}>That’s more than the chest has left.</div>}
      {s > chest.silver && ok && <div className="small muted">Will break {Math.ceil((s - chest.silver) / 10)} gold into silver.</div>}
    </Sheet>
  )
}

function SplitSheet({ chest, characters, onClose, onConfirm }: {
  chest: Chest; characters: Character[]; onClose: () => void; onConfirm: (ids: string[], leftoverTo: 'chest' | 'first') => void
}) {
  const [ids, setIds] = useState(characters.map((c) => c.id))
  const [to, setTo] = useState<'chest' | 'first'>('chest')
  const chosen = characters.filter((c) => ids.includes(c.id))
  const r = splitEvenly(chest.gold, chest.silver, chosen.length, to)
  return (
    <Sheet open onClose={onClose} title="⚖ Split coins evenly"
      footer={<button className="btn big primary" disabled={!chosen.length} onClick={() => onConfirm(chosen.map((c) => c.id), to)}>Give {chosen.length} share{chosen.length === 1 ? '' : 's'}</button>}>
      <div className="small muted">Splitting <b>{chest.gold}g {chest.silver}s</b> ({coinsToSilver(chest.gold, chest.silver)}s). Shares are paid in gold + silver.</div>
      <div className="mini-label">Who gets a share?</div>
      <div className="chips-row wrap">
        {characters.map((c) => <button key={c.id} className={'chip ' + (ids.includes(c.id) ? 'on' : '')} onClick={() => setIds(ids.includes(c.id) ? ids.filter((x) => x !== c.id) : [...ids, c.id])}>{ids.includes(c.id) ? '✓ ' : ''}<WhoName id={c.id} name={c.name} /></button>)}
      </div>
      {r.leftover > 0 && (
        <>
          <div className="mini-label">{r.leftover}s doesn’t split evenly — give it to…</div>
          <div className="segmented">
            <button type="button" className={to === 'chest' ? 'on' : ''} onClick={() => setTo('chest')}>Keep in chest</button>
            <button type="button" className={to === 'first' ? 'on' : ''} onClick={() => setTo('first')}>{chosen[0] ? <WhoName id={chosen[0].id} name={chosen[0].name} /> : 'First'}</button>
          </div>
        </>
      )}
      <div className="panel">
        {chosen.map((c, i) => <div key={c.id} className="row between"><span><WhoName id={c.id} name={c.name} /></span><b>{fmtCoins(r.shares[i].gold * 10 + r.shares[i].silver)}</b></div>)}
        {to === 'chest' && r.leftover > 0 && <div className="row between muted"><span>Back to chest</span><span>{r.leftover}s</span></div>}
      </div>
    </Sheet>
  )
}
