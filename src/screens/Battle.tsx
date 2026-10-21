import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Attack, Character, Combatant, DamageType, Encounter, LogEntry, Side, Trait } from '../types'
import { CONDITIONS, DAMAGE_ICONS, DAMAGE_TYPES, uid } from '../types'
import { computeDamage, isOut, matchingTraits, sortedOrder, traitSentence } from '../combat'
import { fmtMod, rollDie, rollExpression } from '../dice'
import { characterToCombatant } from '../seed'
import { NumField, Segmented, Sheet, Stepper, TextField } from '../components/Sheet'
import { DamageTypePicker, TraitEditor } from '../components/Editors'
import { TIER_COLORS, TIER_SHORT, combinedArmor } from '../armor'
import { availableSlots, damageFor, scrollStats, spellMod } from '../spells'
import { effectiveSlots } from '../components/Spells'
import { charProf } from '../seed'

type SetEnc = (f: (e: Encounter) => Encounter) => void

interface Props { encounter: Encounter; setEncounter: SetEnc; characters: Character[]; onSpendSlot?: (charId: string, level: number) => void; onUseScroll?: (charId: string, itemId: string) => void; onRest?: (kind: 'long' | 'short') => void }

const log = (e: Encounter, text: string, kind: LogEntry['kind']): LogEntry[] =>
  [{ id: uid(), round: e.round, text, kind, time: Date.now() }, ...e.log].slice(0, 200)

export default function Battle({ encounter, setEncounter, characters, onSpendSlot, onUseScroll, onRest }: Props) {
  const { combatants, round, turnId } = encounter
  const party = combatants.filter((c) => c.side === 'party')
  const monsters = combatants.filter((c) => c.side === 'monster')
  const order = useMemo(() => sortedOrder(combatants), [combatants])

  const [selected, setSelected] = useState<string | null>(null)
  const [attack, setAttack] = useState<{ a: string; t: string } | null>(null)
  const [hpFor, setHpFor] = useState<string | null>(null)
  const [editFor, setEditFor] = useState<string | null>(null)
  const [addSide, setAddSide] = useState<Side | null>(null)
  const [initOpen, setInitOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(true)
  const [flash, setFlash] = useState<{ id: string; text: string; kind: string; key: number } | null>(null)

  const byId = (id: string | null) => combatants.find((c) => c.id === id)
  const update = (id: string, p: Partial<Combatant>) =>
    setEncounter((e) => ({ ...e, combatants: e.combatants.map((c) => (c.id === id ? { ...c, ...p } : c)) }))

  // ---------- drag to attack (pointer events: mouse + touch) ----------
  const drag = useRef<{ id: string; x0: number; y0: number; active: boolean; timer?: number; pt: string } | null>(null)
  const suppressClick = useRef(false)
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number; over: string | null } | null>(null)

  useEffect(() => {
    const block = (ev: TouchEvent) => { if (drag.current?.active) ev.preventDefault() }
    document.addEventListener('touchmove', block, { passive: false })
    return () => document.removeEventListener('touchmove', block)
  }, [])

  const endDrag = useCallback(() => {
    if (drag.current?.timer) clearTimeout(drag.current.timer)
    drag.current = null
    setGhost(null)
    document.body.classList.remove('dragging')
  }, [])

  const startDrag = (e: React.PointerEvent, id: string, immediate: boolean) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (isOut(byId(id)!) && byId(id)!.side === 'monster') return
    const d = { id, x0: e.clientX, y0: e.clientY, active: false, pt: e.pointerType } as NonNullable<typeof drag.current>
    drag.current = d
    const activate = (x: number, y: number) => {
      if (drag.current !== d) return
      d.active = true
      suppressClick.current = true
      document.body.classList.add('dragging')
      navigator.vibrate?.(15)
      setGhost({ id, x, y, over: null })
    }
    if (immediate) { e.preventDefault(); activate(e.clientX, e.clientY) }
    else if (e.pointerType !== 'mouse') d.timer = window.setTimeout(() => activate(d.x0, d.y0), 280)

    const move = (ev: PointerEvent) => {
      if (drag.current !== d) return
      const dist = Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0)
      if (!d.active) {
        if (d.pt === 'mouse' && dist > 6) activate(ev.clientX, ev.clientY)
        else if (d.pt !== 'mouse' && dist > 10) { clearTimeout(d.timer); drag.current = null; cleanup() }
        return
      }
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-cid]') as HTMLElement | null
      const over = el?.dataset.cid && el.dataset.cid !== id ? el.dataset.cid : null
      setGhost({ id, x: ev.clientX, y: ev.clientY, over })
    }
    const up = (ev: PointerEvent) => {
      if (drag.current === d && d.active) {
        const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-cid]') as HTMLElement | null
        const over = el?.dataset.cid
        if (over && over !== id) { setAttack({ a: id, t: over }); setSelected(null) }
        setTimeout(() => { suppressClick.current = false }, 50)
      }
      if (drag.current === d) endDrag()
      cleanup()
    }
    const cancel = () => { if (drag.current === d) { endDrag(); suppressClick.current = false } cleanup() }
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  const tapCard = (id: string) => {
    if (suppressClick.current) return
    if (!selected) { setSelected(id); return }
    if (selected === id) { setSelected(null); return }
    setAttack({ a: selected, t: id })
    setSelected(null)
  }

  // ---------- initiative / turns ----------
  const nextTurn = () => {
    setEncounter((e) => {
      const ord = sortedOrder(e.combatants)
      if (!ord.length) return e
      const alive = (c: Combatant) => !(c.side === 'monster' && isOut(c))
      let idx = ord.findIndex((c) => c.id === e.turnId)
      let r = e.round
      for (let i = 0; i < ord.length; i++) {
        idx++
        if (idx >= ord.length) { idx = 0; r++ }
        if (alive(ord[idx])) break
      }
      const next = { ...e, turnId: ord[idx].id, round: r }
      return { ...next, log: log(next, r !== e.round ? `— Round ${r} begins — ${ord[idx].name}'s turn` : `${ord[idx].name}'s turn`, 'info') }
    })
  }

  const resetCombat = () => {
    if (!confirm('End combat? Clears initiative, round and log (HP stays).')) return
    setEncounter((e) => ({ ...e, round: 1, turnId: null, log: [], combatants: e.combatants.map((c) => ({ ...c, initiative: null, tempTraits: [] })) }))
  }

  const longRest = () => {
    if (!confirm('Long rest / new day? Restores all spell slots and resets once-per-day armor abilities (Shrug Off).')) return
    onRest?.('long')
    setEncounter((e) => ({ ...e, combatants: e.combatants.map((c) => ({ ...c, shrugUsed: false })), log: log(e, '🌙 Long rest — spell slots restored, daily armor abilities reset.', 'info') }))
  }
  const shortRest = () => {
    onRest?.('short')
    setEncounter((e) => ({ ...e, log: log(e, '🌗 Short rest — warlock pact slots restored.', 'info') }))
  }

  const applyAttack = (res: AttackResult) => {
    const a = byId(res.attackerId)!, t = byId(res.targetId)!
    setEncounter((e) => {
      let entries = e.log
      let cs = e.combatants
      const push = (text: string, kind: LogEntry['kind']) => {
        entries = [{ id: uid(), round: e.round, text, kind, time: Date.now() }, ...entries].slice(0, 200)
      }
      if (res.grant) {
        cs = cs.map((c) => (c.id === t.id ? { ...c, tempTraits: [...(c.tempTraits ?? []).filter((x) => x.name !== res.grant!.name), res.grant!] } : c))
        push(`${a.name} casts ${res.weapon} on ${t.name}: ${res.grant.note}`, 'info')
      } else if (res.heal) {
        const newHp = Math.min(t.maxHp, t.hp + res.final)
        cs = cs.map((c) => (c.id === t.id ? { ...c, hp: newHp } : c))
        push(`${a.name} heals ${t.name} for ${res.final}${res.weapon ? ` (${res.weapon})` : ''}. HP ${t.hp}→${newHp}`, 'heal')
      } else if (!res.hit) {
        push(`${a.name} → ${t.name}: ${res.weapon || 'attack'} MISSES${res.rollText ? ` (${res.rollText})` : ''}`, 'miss')
      } else {
        const newHp = Math.max(0, t.hp - res.final)
        cs = cs.map((c) => (c.id === t.id ? { ...c, hp: newHp, shrugUsed: c.shrugUsed || !!res.shrug } : c))
        const extra = res.steps.length ? ` [${res.steps.join('; ')}]` : ''
        push(`${a.name} → ${t.name}: ${res.weapon || 'attack'} ${res.crit ? 'CRITS' : 'hits'} for ${res.final} ${res.type}${extra}${res.rollText ? ` (${res.rollText})` : ''}. HP ${t.hp}→${newHp}`, 'hit')
        if (newHp === 0 && t.hp > 0) push(t.side === 'party' ? `${t.name} is DOWN! Start death saves.` : `${t.name} is defeated!`, 'down')
      }
      return { ...e, combatants: cs, log: entries }
    })
    if (res.spell && res.spell.slotLevel > 0) onSpendSlot?.(res.spell.charId, res.spell.slotLevel)
    if (res.scroll) onUseScroll?.(res.scroll.charId, res.scroll.itemId)
    if (res.grant) { setAttack(null); setFlash({ id: t.id, text: '🛡', kind: 'heal', key: Date.now() }); return }
    setFlash(res.heal ? { id: t.id, text: `+${res.final}`, kind: 'heal', key: Date.now() }
      : { id: t.id, text: res.hit ? `−${res.final}` : 'MISS', kind: res.hit ? 'hit' : 'miss', key: Date.now() })
    setAttack(null)
  }

  const turnC = byId(turnId)
  const selC = byId(selected)

  const card = (c: Combatant) => (
    <CombatantCard key={c.id} c={c}
      isTurn={c.id === turnId} isSelected={c.id === selected}
      isOver={ghost?.over === c.id} isDragging={ghost?.id === c.id}
      flash={flash?.id === c.id ? flash : null}
      onPointerDown={(e) => startDrag(e, c.id, false)}
      onHandleDown={(e) => { e.stopPropagation(); startDrag(e, c.id, true) }}
      onTap={() => tapCard(c.id)}
      onHp={() => setHpFor(c.id)}
      onMenu={() => setEditFor(c.id)} />
  )

  return (
    <div className="battle">
      <div className="turn-bar">
        <div className="round-pill"><small>Round</small><b>{round}</b></div>
        <div className="turn-strip">
          {order.length === 0 && <span className="muted small">No initiative yet — tap <b>Roll</b></span>}
          {order.map((c) => (
            <button key={c.id} className={`turn-chip ${c.side} ${c.id === turnId ? 'now' : ''} ${isOut(c) ? 'out' : ''}`} onClick={() => setEditFor(c.id)}>
              <b>{c.initiative}</b><span>{c.name}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="battle-actions">
        <button className="btn" onClick={() => setInitOpen(true)}>🎲 Roll Initiative</button>
        <button className="btn primary" disabled={!order.length} onClick={nextTurn}>{turnId ? 'Next Turn ▶' : 'Start ▶'}</button>
        <button className="icon-btn" title="End combat" onClick={resetCombat}>⟲</button>
        <button className="icon-btn" title="Long rest / new day" aria-label="Long rest / new day" onClick={longRest}>🌙</button>
        <button className="icon-btn" title="Short rest" aria-label="Short rest" onClick={shortRest}>🌗</button>
      </div>

      <div className={'hint ' + (selC ? 'active' : '')}>
        {selC
          ? <>⚔ <b>{selC.name}</b> is attacking — tap a target <button className="link" onClick={() => setSelected(null)}>cancel</button></>
          : turnC ? <>It’s <b>{turnC.name}</b>’s turn. Drag their ⚔ onto a target, or tap attacker → tap target.</>
            : <>Drag a card’s ⚔ onto a target (or tap attacker, then target).</>}
      </div>

      <div className="columns">
        <section className="col">
          <header className="col-head party"><span>🛡 Party</span><button className="icon-btn sm" onClick={() => setAddSide('party')} aria-label="Add party member">＋</button></header>
          {party.map(card)}
          {!party.length && <div className="empty">Add characters from your <b>Characters</b> tab</div>}
        </section>
        <section className="col">
          <header className="col-head monster"><span>👹 Monsters</span><button className="icon-btn sm" onClick={() => setAddSide('monster')} aria-label="Add monster">＋</button></header>
          {monsters.map(card)}
          {!monsters.length && <div className="empty">Tap ＋ to add monsters</div>}
        </section>
      </div>

      <section className="log">
        <header onClick={() => setLogOpen(!logOpen)}>
          <span>📜 Combat log ({encounter.log.length})</span><span>{logOpen ? '▾' : '▸'}</span>
        </header>
        {logOpen && (
          <ul>
            {encounter.log.length === 0 && <li className="muted">Attacks and turns will show up here.</li>}
            {encounter.log.map((l) => <li key={l.id} className={'log-' + l.kind}><small>R{l.round}</small> {l.text}</li>)}
          </ul>
        )}
      </section>

      {ghost && (() => {
        const c = byId(ghost.id)!
        const o = byId(ghost.over)
        return (
          <div className="drag-ghost" style={{ left: ghost.x, top: ghost.y }}>
            ⚔ {c.name}{o ? <> → <b>{o.name}</b></> : ''}
          </div>
        )
      })()}

      {attack && byId(attack.a) && byId(attack.t) && (
        <AttackSheet caster={characters.find((c) => c.id === byId(attack.a)!.characterId)} attacker={byId(attack.a)!} target={byId(attack.t)!} onClose={() => setAttack(null)} onApply={applyAttack} />
      )}
      {hpFor && byId(hpFor) && (
        <HpSheet c={byId(hpFor)!} onClose={() => setHpFor(null)} onApply={(hp, text, kind) => {
          const c = byId(hpFor)!
          setEncounter((e) => ({ ...e, combatants: e.combatants.map((x) => (x.id === c.id ? { ...x, hp } : x)), log: log(e, text, kind) }))
          setFlash({ id: c.id, text: hp >= c.hp ? `+${hp - c.hp}` : `−${c.hp - hp}`, kind: hp >= c.hp ? 'heal' : 'hit', key: Date.now() })
          setHpFor(null)
        }} />
      )}
      {editFor && byId(editFor) && (
        <EditCombatantSheet c={byId(editFor)!} onClose={() => setEditFor(null)}
          onSave={(p) => { update(editFor, p); setEditFor(null) }}
          onRemove={() => {
            setEncounter((e) => ({ ...e, combatants: e.combatants.filter((x) => x.id !== editFor), turnId: e.turnId === editFor ? null : e.turnId }))
            setEditFor(null)
          }}
          onDuplicate={() => {
            const c = byId(editFor)!
            setEncounter((e) => ({ ...e, combatants: [...e.combatants, { ...c, id: uid(), name: nextName(e.combatants, baseName(c.name)), hp: c.maxHp, initiative: null, conditions: [] }] }))
            setEditFor(null)
          }} />
      )}
      {addSide === 'party' && (
        <AddPartySheet characters={characters} combatants={combatants} onClose={() => setAddSide(null)}
          onAdd={(chars) => { setEncounter((e) => ({ ...e, combatants: [...e.combatants, ...chars.map(characterToCombatant)] })); setAddSide(null) }} />
      )}
      {addSide === 'monster' && (
        <AddMonsterSheet onClose={() => setAddSide(null)} onAdd={(tpl, copies) => {
          setEncounter((e) => {
            const add: Combatant[] = []
            const all = [...e.combatants]
            const base = tpl.name.trim() || 'Monster'
            for (let i = 0; i < copies; i++) {
              const name = copies === 1 && !all.some((c) => baseName(c.name) === base) ? base : nextName(all, base)
              const c: Combatant = { ...tpl, id: uid(), name, traits: tpl.traits.map((t) => ({ ...t, id: uid() })) }
              add.push(c); all.push(c)
            }
            return { ...e, combatants: [...e.combatants, ...add] }
          })
          setAddSide(null)
        }} />
      )}
      {initOpen && (
        <InitiativeSheet combatants={combatants} onClose={() => setInitOpen(false)} onSave={(map) => {
          setEncounter((e) => {
            const cs = e.combatants.map((c) => (c.id in map ? { ...c, initiative: map[c.id] } : c))
            const ord = sortedOrder(cs)
            const next = { ...e, combatants: cs, round: 1, turnId: ord[0]?.id ?? null }
            return { ...next, log: log(next, `Initiative rolled! Order: ${ord.map((c) => `${c.name} (${c.initiative})`).join(', ')}`, 'info') }
          })
          setInitOpen(false)
        }} />
      )}
    </div>
  )
}

const SHORT: Record<string, string> = { resistance: 'RES', vulnerability: 'VULN', immunity: 'IMM', advantage: 'ADV', disadvantage: 'DIS', custom: 'NOTE' }
const baseName = (n: string) => n.replace(/\s+\d+$/, '')
function nextName(all: Combatant[], base: string) {
  const nums = all.filter((c) => baseName(c.name) === base).map((c) => parseInt(c.name.slice(base.length)) || 1)
  return `${base} ${nums.length ? Math.max(...nums) + 1 : 1}`
}

// ---------------- Card ----------------
function CombatantCard({ c, isTurn, isSelected, isOver, isDragging, flash, onPointerDown, onHandleDown, onTap, onHp, onMenu }: {
  c: Combatant; isTurn: boolean; isSelected: boolean; isOver: boolean; isDragging: boolean
  flash: { text: string; kind: string; key: number } | null
  onPointerDown: (e: React.PointerEvent) => void; onHandleDown: (e: React.PointerEvent) => void
  onTap: () => void; onHp: () => void; onMenu: () => void
}) {
  const pct = c.maxHp ? Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100)) : 0
  const out = isOut(c)
  const hpClass = pct > 50 ? 'good' : pct > 25 ? 'mid' : 'low'
  const dmgTraits = [...c.traits, ...(c.tempTraits ?? [])].filter((t) => t.damageTypes.length)
  return (
    <div data-cid={c.id}
      className={`ccard ${c.side} ${isTurn ? 'turn' : ''} ${isSelected ? 'selected' : ''} ${isOver ? 'over' : ''} ${isDragging ? 'lifted' : ''} ${out ? (c.side === 'party' ? 'down' : 'dead') : ''}`}
      onPointerDown={onPointerDown} onClick={onTap} onContextMenu={(e) => e.preventDefault()}>
      {isTurn && <div className="turn-flag">TURN</div>}
      {c.sample && <div className="sample-tag">SAMPLE</div>}
      <div className="ccard-top">
        <div className="ac-wrap">
          <div className="ac-shield" title="Armor Class" style={c.armorTier ? { filter: `drop-shadow(0 0 5px ${TIER_COLORS[c.armorTier]})` } : undefined}><small>AC</small><b>{c.ac}</b></div>
          {c.armorTier && <span className="ac-tier-dot" style={{ color: TIER_COLORS[c.armorTier] }}>◆{TIER_SHORT[c.armorTier]}</span>}
        </div>
        <div className="ccard-name">
          <b>{c.name}</b>
          <span className="armor">{c.armor || '—'}</span>
        </div>
      </div>
      <button className="hp" onClick={(e) => { e.stopPropagation(); onHp() }} onPointerDown={(e) => e.stopPropagation()}>
        <div className={'hp-bar ' + hpClass}><i style={{ width: pct + '%' }} /></div>
        <span><b>{c.hp}</b>/{c.maxHp} HP</span>
      </button>
      {(dmgTraits.length > 0 || c.conditions.length > 0 || out) && (
        <div className="badges">
          {out && <span className="badge out">{c.side === 'party' ? '💔 DOWN' : '💀 DEFEATED'}</span>}
          {dmgTraits.map((t) => (
            <span key={t.id} className={'badge trait effect-' + t.effect + ((c.tempTraits ?? []).includes(t) ? ' temp' : '')} title={t.note}>
              {SHORT[t.effect]} {t.damageTypes.map((d) => DAMAGE_ICONS[d]).join('')}
            </span>
          ))}
          {c.conditions.map((x) => <span key={x} className="badge cond">{x}</span>)}
        </div>
      )}
      <div className="ccard-foot">
        <span className="init">Init {c.initiative ?? '—'} <small>({fmtMod(c.initMod)})</small></span>
        <button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); onMenu() }} onPointerDown={(e) => e.stopPropagation()} aria-label="Edit">⋯</button>
        <button className="drag-handle" onPointerDown={onHandleDown} onClick={(e) => e.stopPropagation()} aria-label="Drag to attack">⚔</button>
      </div>
      {flash && <div key={flash.key} className={'float-num ' + flash.kind}>{flash.text}</div>}
    </div>
  )
}

// ---------------- Attack sheet ----------------
interface AttackResult {
  attackerId: string; targetId: string; weapon: string; hit: boolean; crit: boolean
  type: DamageType; final: number; steps: string[]; rollText: string; heal?: boolean; shrug?: boolean
  spell?: { charId: string; slotLevel: number }; scroll?: { charId: string; itemId: string }; grant?: Trait
}

const MODE_KEY = 'cc.attackEntryMode'
const loadEntryMode = (): 'quick' | 'full' => { try { return localStorage.getItem(MODE_KEY) === 'full' ? 'full' : 'quick' } catch { return 'quick' } }

function AttackSheet({ attacker, target, onClose, onApply, caster }: {
  attacker: Combatant; target: Combatant; onClose: () => void; onApply: (r: AttackResult) => void; caster?: Character
}) {
  const first: Attack | undefined = attacker.attacks[0]
  const [weapon, setWeapon] = useState(first?.name ?? '')
  const [toHit, setToHit] = useState(first?.toHit ?? 0)
  const [expr, setExpr] = useState(first?.damage ?? '1d6')
  const [dmg, setDmg] = useState<number>(0)
  const [dmgText, setDmgText] = useState('')
  const [type, setType] = useState<DamageType>(first?.damageType ?? 'slashing')
  const [hit, setHit] = useState(true)
  const [crit, setCrit] = useState(false)
  const [mode, setMode] = useState<'normal' | 'adv' | 'dis'>('normal')
  const [atk, setAtk] = useState<{ d20: number[]; kept: number; total: number } | null>(null)
  const [entry, setEntryState] = useState<'quick' | 'full'>(loadEntryMode)
  const setEntry = (m: 'quick' | 'full') => { setEntryState(m); try { localStorage.setItem(MODE_KEY, m) } catch { /* ignore */ } }
  const [qAction, setQAction] = useState<'damage' | 'heal'>('damage')
  const [qText, setQText] = useState('')
  const qNum = parseInt(qText || '0') || 0
  const quick = entry === 'quick'
  const healing = quick && qAction === 'heal'

  const traits = matchingTraits(target, type)
  const general = target.traits.filter((t) => !t.damageTypes.length)
  const arm = combinedArmor(target)
  const acBonus = arm.acVs[type] ?? 0
  const effAc = target.ac + acBonus
  const [zeroBy, setZeroBy] = useState<null | 'shrug' | 'deflect'>(null)
  const [d6, setD6] = useState<number | null>(null)
  const canDeflect = arm.deflectD6 && type === 'piercing'
  useEffect(() => { setD6(null); setZeroBy(null) }, [type])
  const outcome = (() => {
    const o = computeDamage(quick ? qNum : dmg, traits)
    const red = arm.reduce[type] ?? 0
    if (red && o.final > 0) { const n = Math.max(0, o.final - red); o.steps.push(`Armor (${target.armor}): −${red} ${type}: ${o.final} → ${n}`); o.final = n }
    if (acBonus) o.steps.unshift(`Armor: ${fmtMod(acBonus)} AC vs ${type} (AC ${effAc})`)
    if (zeroBy === 'deflect') { o.steps.push(`Deflect d6 = 6: arrows/bolts snap, or a thick weapon (spear) is deflected and ${target.name} is pushed back 5 ft. No damage.`); o.final = 0 }
    if (zeroBy === 'shrug') { o.steps.push(`Shrug Off (Legendary Leather, 1/day): ${target.name} shrugs off the hit. No damage.`); o.final = 0 }
    return o
  })()
  const setDeflect = (n: number) => { setD6(n); setZeroBy(n === 6 ? 'deflect' : zeroBy === 'deflect' ? null : zeroBy) }
  const press = (k: string) => setQText((t) => k === '⌫' ? t.slice(0, -1) : k === 'C' ? '' : (t + k).replace(/^0+(?=\d)/, '').slice(0, 3))

  // ---- spells ----
  // scrolls in the caster's pack are castable by anyone (house rule), no slot
  const scrollSpells = (caster?.inventory ?? []).flatMap((it) => (it.scroll?.kind === 'spell' ? [{ ...it.scroll.spell, id: 'scroll:' + it.id, name: it.name }] : []))
  const castable = [...(caster?.spells ?? []), ...scrollSpells].filter((sp) => sp.effect === 'resistance' || damageFor(sp, Math.max(1, sp.level), caster!.level))
  const cSlots = caster ? effectiveSlots(caster) : undefined
  const [spellId, setSpellId] = useState<string | null>(null)
  const [slotLv, setSlotLv] = useState(1)
  const spell = castable.find((x) => x.id === spellId)
  const [resType, setResType] = useState<DamageType>('fire')
  const isScroll = (id?: string | null) => !!id && id.startsWith('scroll:')
  const pickSpell = (sp: typeof castable[number], lv = Math.max(1, sp.level)) => {
    if (isScroll(sp.id)) {
      const st = scrollStats(sp.level)
      setSpellId(sp.id); setSlotLv(sp.level); setWeapon(sp.name); setDmgText('')
      if (sp.damageType) setType(sp.damageType)
      if (sp.effectType) setResType(sp.effectType)
      const dice = damageFor(sp, Math.max(1, sp.level), 1); if (dice) setExpr(dice)
      setToHit(st.attack)
      return
    }
    const ok = availableSlots(cSlots, sp.level)
    const L = sp.level === 0 ? 0 : (ok.some((o) => o.level === lv) ? lv : ok[0]?.level ?? lv)
    setSpellId(sp.id); setSlotLv(L); setWeapon(sp.name); setDmgText('')
    if (sp.damageType) setType(sp.damageType)
    if (sp.effectType) setResType(sp.effectType)
    const dice = damageFor(sp, L, caster!.level); if (dice) setExpr(dice)
    if (sp.attack) setToHit(charProf(caster!) + spellMod(caster!))
  }
  const scrollMode = isScroll(spell?.id)
  const spellExtra = spell && caster ? (scrollMode ? { scroll: { charId: caster.id, itemId: spell.id.slice(7) } } : { spell: { charId: caster.id, slotLevel: spell.level === 0 ? 0 : slotLv } }) : {}
  const noSlot = !!spell && !scrollMode && spell.level > 0 && !availableSlots(cSlots, spell.level).some((o) => o.level === slotLv)

  const pick = (a: Attack) => { setSpellId(null); setWeapon(a.name); setToHit(a.toHit); setExpr(a.damage); setType(a.damageType); setDmgText('') }
  const rollAttack = () => {
    const d = mode === 'normal' ? [rollDie(20)] : [rollDie(20), rollDie(20)]
    const kept = mode === 'adv' ? Math.max(...d) : mode === 'dis' ? Math.min(...d) : d[0]
    const total = kept + toHit
    setAtk({ d20: d, kept, total })
    const isCrit = kept === 20
    setCrit(isCrit)
    setHit(kept !== 1 && (isCrit || total >= effAc))
  }
  const rollDamage = (critical = crit) => {
    const r = rollExpression(expr, critical)
    if (r.valid) { setDmg(Math.max(0, r.total)); setDmgText(r.detail + (critical ? ' (crit: dice doubled)' : '')) }
    else setDmgText('Could not read that dice — try like 1d8+3')
  }

  const rollText = atk ? `d20 ${atk.d20.join('/')}${fmtMod(toHit)} = ${atk.total} vs AC ${effAc}${acBonus ? ` (${fmtMod(acBonus)} vs ${type})` : ''}` : ''

  return (
    <Sheet open onClose={onClose} tall
      title={<span className="atk-title"><b>{attacker.name}</b> <span className="swords">⚔</span> <b>{target.name}</b></span>}
      footer={spell?.effect === 'resistance' ? (
        <button className="btn big heal-fill" disabled={noSlot} onClick={() => onApply({
          attackerId: attacker.id, targetId: target.id, weapon: spell.name, hit: true, crit: false, type: resType, final: 0, steps: [], rollText: '', ...spellExtra,
          grant: { id: uid(), name: `${spell.name} (temp)`, damageTypes: [resType], effect: 'resistance', note: `Resistance to ${resType}${spell.effectRounds ? ` for ${spell.effectRounds} rounds` : ''}${spell.concentration ? ' (concentration)' : ''}` },
        })}>🛡 Grant {resType} resistance → {target.name}</button>
      ) : quick ? (
        healing ? (
          <button className="btn big heal-fill" disabled={qNum <= 0} onClick={() => onApply({
            attackerId: attacker.id, targetId: target.id, weapon, hit: true, crit: false, type, heal: true,
            final: qNum, steps: [], rollText: '', ...spellExtra,
          })}>
            {`Heal ${qNum} → ${target.name} (${target.hp}→${Math.min(target.maxHp, target.hp + qNum)} HP)`}
          </button>
        ) : (
          <button className="btn big danger-fill" disabled={(qNum <= 0 && !outcome.steps.length) || noSlot} onClick={() => onApply({
            attackerId: attacker.id, targetId: target.id, weapon, hit: true, crit: false, type,
            final: outcome.final, steps: outcome.steps, rollText: '', shrug: zeroBy === 'shrug', ...spellExtra,
          })}>
            {`Apply ${outcome.final} ${type} → ${target.name} (${target.hp}→${Math.max(0, target.hp - outcome.final)} HP)`}
          </button>
        )
      ) : (
        <button className={'btn big ' + (hit ? 'danger-fill' : '')} onClick={() => onApply({
          attackerId: attacker.id, targetId: target.id, weapon, hit, crit, type,
          final: outcome.final, steps: outcome.steps, rollText, shrug: hit && zeroBy === 'shrug', ...spellExtra,
        })}>
          {hit ? `Apply ${outcome.final} ${type} damage → ${target.name} (${target.hp}→${Math.max(0, target.hp - outcome.final)} HP)` : 'Log miss'}
        </button>
      )}>
      <div className="target-summary">
        <div className="ac-shield lg" style={target.armorTier ? { filter: `drop-shadow(0 0 6px ${TIER_COLORS[target.armorTier]})` } : undefined}><small>AC</small><b>{effAc}</b></div>
        <div><b>{target.name}</b><div className="muted small">{target.armor || 'no armor listed'} · {target.hp}/{target.maxHp} HP</div></div>
      </div>

      <div className="entry-toggle">
        <Segmented value={entry} onChange={setEntry} options={[{ value: 'quick', label: '✋ Quick (table dice)' }, { value: 'full', label: '🎲 Roll in app' }]} />
      </div>

      {castable.length > 0 && (
        <div className="spell-cast">
          <div className="mini-label">✨ {caster!.name}’s spells</div>
          <div className="chips-row wrap">
            {castable.map((sp) => (
              <button key={sp.id} className={'chip ' + (spellId === sp.id ? 'on' : '')} onClick={() => (spellId === sp.id ? setSpellId(null) : pickSpell(sp))}>
                {isScroll(sp.id) ? '📜' : sp.damageType ? DAMAGE_ICONS[sp.damageType] : '🛡'} {sp.name} <small>{sp.level === 0 ? 'cantrip' : `lv ${sp.level}`}</small>
              </button>
            ))}
          </div>
          {spell && !scrollMode && spell.level > 0 && (
            <div className="chips-row wrap">
              {cSlots!.max.map((m, i) => i + 1 >= spell.level && m > 0 && (
                <button key={i} className={'chip ' + (slotLv === i + 1 ? 'on' : '')} disabled={m - cSlots!.used[i] <= 0} onClick={() => pickSpell(spell, i + 1)}>
                  Slot {i + 1} ({m - cSlots!.used[i]} left)
                </button>
              ))}
            </div>
          )}
          {spell && (
            <div className="reminder-item small">
              {damageFor(spell, Math.max(1, slotLv), scrollMode ? 1 : caster!.level) && <>💥 <b>{damageFor(spell, Math.max(1, slotLv), scrollMode ? 1 : caster!.level)}</b> {spell.damageType}. </>}
              {spell.save && <>🎯 Target saves: <b>{spell.save}</b>. </>}
              {spell.attack && !scrollMode && <>Spell attack {fmtMod(charProf(caster!) + spellMod(caster!))} to hit. </>}
              {spell.concentration && <>Concentration. </>}
              {scrollMode && <>📜 Scroll: DC <b>{scrollStats(spell.level).dc}</b>, attack <b>+{scrollStats(spell.level).attack}</b>. Used up when applied (no slot). </>}
              {!scrollMode && spell.level > 0 && <>Uses a level-{slotLv} slot when applied.</>}
              {noSlot && <b style={{ color: '#f08a78' }}> No slot of that level left!</b>}
            </div>
          )}
          {spell?.effect === 'resistance' && (
            <div className="row"><span className="small">Resistance to</span>
              <select value={resType} onChange={(e) => setResType(e.target.value as DamageType)}>{DAMAGE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          )}
        </div>
      )}

      {quick && spell?.effect !== 'resistance' && (
        <div className="entry-toggle">
          <Segmented value={qAction} onChange={setQAction} options={[{ value: 'damage', label: '🗡 Damage' }, { value: 'heal', label: '💚 Heal' }]} />
        </div>
      )}

      {!healing && (acBonus !== 0 || target.armorTier) && (
        <div className="small">🛡 <b>AC {effAc}</b>{acBonus ? ` (${target.ac} ${acBonus > 0 ? '+' : '−'}${Math.abs(acBonus)} vs ${type})` : ` vs ${type}`}</div>
      )}
      {!healing && (acBonus !== 0 || (arm.reduce[type] ?? 0) > 0 || canDeflect || arm.shrugOff) && (
        <div className="reminder">
          <div className="reminder-head" style={target.armorTier ? { color: TIER_COLORS[target.armorTier] } : undefined}>🛡 {target.armor}</div>
          {acBonus !== 0 && <div className="reminder-item">{fmtMod(acBonus)} AC vs {DAMAGE_ICONS[type]} {type} → hits need <b>{effAc}</b></div>}
          {(arm.reduce[type] ?? 0) > 0 && <div className="reminder-item">Reduces {DAMAGE_ICONS[type]} {type} damage by <b>{arm.reduce[type]}</b> (after resistance, min 0)</div>}
          {canDeflect && (
            <div className="reminder-item">
              Piercing hit: roll a d6, on a <b>6</b> arrows/bolts snap (spears deflect, push 5 ft) — no damage.
              <div className="row">
                <button className="btn sm" onClick={() => setDeflect(rollDie(6))}>🎲 Roll d6 deflect</button>
                {[1, 2, 3, 4, 5, 6].map((n) => <button key={n} className={'chip ' + (d6 === n ? 'on' : '')} onClick={() => setDeflect(n)}>{n}</button>)}
              </div>
              {d6 !== null && <div className={'atk-result ' + (d6 === 6 ? 'nat20' : 'miss')}>d6 = <b>{d6}</b> {d6 === 6 ? '— DEFLECTED! No damage.' : '— no deflect, damage applies.'}</div>}
            </div>
          )}
          {arm.shrugOff && (
            <div className="reminder-item">
              Shrug Off (1/day): {target.shrugUsed ? <b>already used today</b> : (
                <button className={'btn sm ' + (zeroBy === 'shrug' ? 'primary' : '')} onClick={() => setZeroBy(zeroBy === 'shrug' ? null : 'shrug')}>
                  {zeroBy === 'shrug' ? '✓ Shrug Off (tap to undo)' : 'Use Shrug Off'}</button>
              )}
            </div>
          )}
        </div>
      )}
      {!healing && traits.length > 0 && (
        <div className="reminder">
          <div className="reminder-head">⚠️ Reminder</div>
          {traits.map((t) => (
            <div key={t.id} className="reminder-item">
              Hitting <b>{target.name}</b> (<b>{t.name}</b>) with <b>{DAMAGE_ICONS[type]} {type}</b>:{' '}
              <span className={'effect-text effect-' + t.effect}>{traitSentence(target, t, type)}</span>
              {t.note && <div className="note">“{t.note}”</div>}
            </div>
          ))}
        </div>
      )}
      {!healing && arm.notes.length > 0 && <div className="general-notes">{arm.notes.map((n) => <div key={n}>📝 {n}</div>)}</div>}
      {general.length > 0 && (
        <div className="general-notes">{general.map((t) => <div key={t.id}>📝 <b>{t.name}:</b> {t.note}</div>)}</div>
      )}

      {quick && (
        <div className={'quick-pad ' + (healing ? 'heal' : '')}>
          <div className="quick-display">
            <small>{healing ? 'Healing' : 'Damage dealt'}</small>
            <b>{qText || '0'}</b>
            {!healing && outcome.steps.length > 0 && <span className="quick-final">→ {outcome.final}</span>}
          </div>
          <div className="keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
              <button key={k} className={'key ' + (k === 'C' || k === '⌫' ? 'fn' : '')} onClick={() => press(k)}>{k}</button>
            ))}
          </div>
        </div>
      )}

      {!healing && (<>
      <div className="mini-label">Damage type</div>
      <DamageTypePicker value={[type]} onChange={(v) => setType(v[0])} />
      {quick && outcome.steps.length > 0 && (
        <div className="calc">
          {outcome.steps.map((x) => <div key={x}>⚖️ {x}</div>)}
          <div>Final damage: <b>{outcome.final}</b></div>
        </div>
      )}
      </>)}

      {quick && !healing && attacker.attacks.length > 0 && (
        <div className="chips-row">
          {attacker.attacks.map((a) => (
            <button key={a.id} className={'chip ' + (weapon === a.name ? 'on' : '')} onClick={() => { setWeapon(a.name); setType(a.damageType) }}>
              {DAMAGE_ICONS[a.damageType]} {a.name}
            </button>
          ))}
        </div>
      )}

      {!quick && (<>
      {attacker.attacks.length > 0 && (
        <>
          <div className="mini-label">{attacker.name}’s attacks</div>
          <div className="chips-row">
            {attacker.attacks.map((a) => (
              <button key={a.id} className={'chip ' + (weapon === a.name ? 'on' : '')} onClick={() => pick(a)}>
                {DAMAGE_ICONS[a.damageType]} {a.name} <small>{fmtMod(a.toHit)} · {a.damage}</small>
              </button>
            ))}
          </div>
        </>
      )}
      <TextField label="Weapon / attack" value={weapon} onChange={setWeapon} placeholder="e.g. Warhammer" />

      <div className="panel">
        <div className="row between">
          <b>Attack roll</b>
          <Segmented value={mode} onChange={setMode} options={[{ value: 'dis', label: 'Dis' }, { value: 'normal', label: 'Normal' }, { value: 'adv', label: 'Adv' }]} />
        </div>
        <div className="row">
          <Stepper label="To hit" value={toHit} onChange={setToHit} min={-10} max={30} />
          <button className="btn" onClick={rollAttack}>🎲 Roll d20</button>
        </div>
        {atk && (
          <div className={'atk-result ' + (atk.kept === 20 ? 'nat20' : atk.kept === 1 ? 'nat1' : hit ? 'hit' : 'miss')} key={atk.total + '-' + atk.d20.join()}>
            d20 [{atk.d20.join(', ')}] {mode !== 'normal' && `→ ${atk.kept}`} {fmtMod(toHit)} = <b>{atk.total}</b> vs AC {effAc}
            {' '}{atk.kept === 20 ? '— NAT 20! CRIT!' : atk.kept === 1 ? '— Nat 1, miss' : atk.total >= effAc ? '— HIT' : '— MISS'}
          </div>
        )}
        <div className="row">
          <Segmented value={hit ? 'hit' : 'miss'} onChange={(v) => setHit(v === 'hit')} options={[{ value: 'hit', label: '✅ Hit' }, { value: 'miss', label: '❌ Miss' }]} />
          <label className="check"><input type="checkbox" checked={crit} onChange={(e) => setCrit(e.target.checked)} /> Crit</label>
        </div>
      </div>

      {hit && (
        <div className="panel">
          <b>Damage</b>
          <div className="row">
            <label className="field grow"><span>Dice</span><input value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="1d8+3" /></label>
            <button className="btn" onClick={() => rollDamage()}>🎲 Roll</button>
          </div>
          {dmgText && <div className="muted small">{dmgText}</div>}
          <Stepper label="Amount" value={dmg} onChange={(n) => { setDmg(n); setDmgText('') }} min={0} max={999} />
          {outcome.steps.length > 0 && (
            <div className="calc">
              {outcome.steps.map((s) => <div key={s}>⚖️ {s}</div>)}
              <div>Final damage: <b>{outcome.final}</b></div>
            </div>
          )}
        </div>
      )}
      </>)}
    </Sheet>
  )
}

// ---------------- HP sheet ----------------
function HpSheet({ c, onClose, onApply }: { c: Combatant; onClose: () => void; onApply: (hp: number, text: string, kind: LogEntry['kind']) => void }) {
  const [n, setN] = useState(0)
  return (
    <Sheet open onClose={onClose} title={`${c.name} — Hit Points`}>
      <div className="hp-big"><b>{c.hp}</b><span>/ {c.maxHp}</span></div>
      <Stepper value={n} onChange={setN} min={0} max={999} label="Amount" />
      <div className="quick-row">
        {[1, 2, 5, 10].map((q) => <button key={q} className="chip" onClick={() => setN(n + q)}>+{q}</button>)}
        <button className="chip" onClick={() => setN(0)}>clear</button>
      </div>
      <div className="row">
        <button className="btn big danger-fill grow" onClick={() => onApply(Math.max(0, c.hp - n), `${c.name} takes ${n} damage (HP ${c.hp}→${Math.max(0, c.hp - n)})`, 'hit')}>− Damage</button>
        <button className="btn big heal-fill grow" onClick={() => onApply(Math.min(c.maxHp, c.hp + n), `${c.name} heals ${n} (HP ${c.hp}→${Math.min(c.maxHp, c.hp + n)})`, 'heal')}>+ Heal</button>
      </div>
      <div className="row">
        <button className="btn ghost grow" onClick={() => onApply(n, `${c.name} HP set to ${n}`, 'info')}>Set to {n}</button>
        <button className="btn ghost grow" onClick={() => onApply(c.maxHp, `${c.name} restored to full HP`, 'heal')}>Full HP</button>
      </div>
    </Sheet>
  )
}

// ---------------- Edit combatant ----------------
function EditCombatantSheet({ c, onClose, onSave, onRemove, onDuplicate }: {
  c: Combatant; onClose: () => void; onSave: (p: Partial<Combatant>) => void; onRemove: () => void; onDuplicate: () => void
}) {
  const [d, setD] = useState<Combatant>(c)
  const set = (p: Partial<Combatant>) => setD({ ...d, ...p })
  return (
    <Sheet open onClose={onClose} tall title={`Edit ${c.name}`}
      footer={<button className="btn big primary" onClick={() => onSave(d)}>Save</button>}>
      <TextField label="Name" value={d.name} onChange={(v) => set({ name: v })} />
      <div className="grid3">
        <NumField label="AC" value={d.ac} onChange={(v) => set({ ac: v })} />
        <NumField label="HP" value={d.hp} onChange={(v) => set({ hp: v })} />
        <NumField label="Max HP" value={d.maxHp} onChange={(v) => set({ maxHp: v })} />
        <NumField label="Init mod" value={d.initMod} onChange={(v) => set({ initMod: v })} />
        <label className="field"><span>Initiative</span>
          <input inputMode="numeric" value={d.initiative ?? ''} placeholder="—"
            onChange={(e) => { const n = parseInt(e.target.value); set({ initiative: isNaN(n) ? null : n }) }} /></label>
      </div>
      <TextField label="Armor" value={d.armor} onChange={(v) => set({ armor: v })} />
      <div className="mini-label">Conditions</div>
      <div className="chips-row wrap">
        {CONDITIONS.map((x) => (
          <button key={x} className={'chip ' + (d.conditions.includes(x) ? 'on' : '')}
            onClick={() => set({ conditions: d.conditions.includes(x) ? d.conditions.filter((y) => y !== x) : [...d.conditions, x] })}>{x}</button>
        ))}
      </div>
      <div className="mini-label">Traits {c.characterId && <span className="muted">(edit permanently in Characters tab)</span>}</div>
      <TraitEditor traits={d.traits} onChange={(t: Trait[]) => set({ traits: t })} />
      <div className="row">
        <button className="btn ghost grow" onClick={onDuplicate}>⧉ Duplicate</button>
        <button className="btn ghost danger grow" onClick={() => confirm(`Remove ${c.name} from battle?`) && onRemove()}>🗑 Remove</button>
      </div>
    </Sheet>
  )
}

// ---------------- Add party ----------------
function AddPartySheet({ characters, combatants, onClose, onAdd }: {
  characters: Character[]; combatants: Combatant[]; onClose: () => void; onAdd: (c: Character[]) => void
}) {
  const inBattle = new Set(combatants.map((c) => c.characterId))
  const missing = characters.filter((c) => !inBattle.has(c.id))
  return (
    <Sheet open onClose={onClose} title="Add party members">
      {characters.length === 0 && <div className="empty">No characters yet. Create them in the <b>Characters</b> tab.</div>}
      {characters.map((ch) => (
        <div key={ch.id} className="list-row">
          <div><b>{ch.name}</b><div className="muted small">{ch.race} {ch.cls} {ch.level} · AC {ch.ac} · {ch.maxHp} HP</div></div>
          {inBattle.has(ch.id) ? <span className="muted small">in battle</span>
            : <button className="btn sm" onClick={() => onAdd([ch])}>Add</button>}
        </div>
      ))}
      {missing.length > 1 && <button className="btn big primary" onClick={() => onAdd(missing)}>Add all ({missing.length})</button>}
    </Sheet>
  )
}

// ---------------- Add monster (custom + SRD) ----------------
const API = 'https://www.dnd5eapi.co'
interface SrdMonster {
  name: string; armor_class: { value: number; type: string; armor?: { name: string }[] }[]; hit_points: number; dexterity: number
  damage_resistances: string[]; damage_vulnerabilities: string[]; damage_immunities: string[]
  actions?: { name: string; attack_bonus?: number; damage?: { damage_dice?: string; damage_type?: { index: string } }[] }[]
  special_abilities?: { name: string; desc: string }[]
}

const findTypes = (s: string) => (['bludgeoning', 'piercing', 'slashing', 'fire', 'cold', 'lightning', 'thunder', 'acid', 'poison', 'necrotic', 'radiant', 'force', 'psychic'] as DamageType[]).filter((t) => s.toLowerCase().includes(t))

function srdToTemplate(m: SrdMonster): Combatant {
  const traits: Trait[] = []
  const map = (list: string[], effect: Trait['effect'], label: string) => list.forEach((s) => {
    const types = findTypes(s)
    if (types.length) traits.push({ id: uid(), name: `${label}`, damageTypes: types, effect, note: `${label}: ${s}` })
  })
  map(m.damage_resistances ?? [], 'resistance', 'Damage resistance')
  map(m.damage_vulnerabilities ?? [], 'vulnerability', 'Damage vulnerability')
  map(m.damage_immunities ?? [], 'immunity', 'Damage immunity')
  const ac = m.armor_class?.[0]
  const attacks: Attack[] = (m.actions ?? []).filter((a) => a.attack_bonus !== undefined && a.damage?.[0]?.damage_dice).map((a) => ({
    id: uid(), name: a.name, toHit: a.attack_bonus ?? 0, damage: (a.damage![0].damage_dice ?? '1d6').replace(/\s/g, ''),
    damageType: (findTypes(a.damage![0].damage_type?.index ?? '')[0] ?? 'slashing'),
  }))
  return {
    id: '', side: 'monster', name: m.name, ac: ac?.value ?? 10,
    armor: ac?.armor?.map((x) => x.name).join(', ') || (ac?.type === 'natural' ? 'Natural armor' : ac?.type === 'dex' ? 'No armor' : ac?.type ?? ''),
    maxHp: m.hit_points, hp: m.hit_points, initMod: Math.floor(((m.dexterity ?? 10) - 10) / 2),
    initiative: null, traits, attacks, conditions: [],
  }
}

function AddMonsterSheet({ onClose, onAdd }: { onClose: () => void; onAdd: (tpl: Combatant, copies: number) => void }) {
  const [tab, setTab] = useState<'custom' | 'srd'>('srd')
  const [d, setD] = useState<Combatant>({ id: '', side: 'monster', name: '', ac: 12, armor: '', maxHp: 10, hp: 10, initMod: 0, initiative: null, traits: [], attacks: [], conditions: [] })
  const [copies, setCopies] = useState(1)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ index: string; name: string }[]>([])
  const [status, setStatus] = useState('')
  const [fromSrd, setFromSrd] = useState(false)
  const set = (p: Partial<Combatant>) => setD({ ...d, ...p })

  useEffect(() => {
    if (tab !== 'srd') return
    const term = q.trim()
    if (term.length < 2) { setResults([]); setStatus(''); return }
    const ctl = new AbortController()
    const t = setTimeout(async () => {
      setStatus('Searching…')
      try {
        const r = await fetch(`${API}/api/2014/monsters?name=${encodeURIComponent(term)}`, { signal: ctl.signal })
        const j = await r.json()
        setResults(j.results ?? [])
        setStatus(j.results?.length ? '' : 'No SRD monsters match. Try the Custom tab.')
      } catch (e) { if ((e as Error).name !== 'AbortError') setStatus('Could not reach the SRD API (offline?). Use Custom.') }
    }, 300)
    return () => { clearTimeout(t); ctl.abort() }
  }, [q, tab])

  const choose = async (index: string) => {
    setStatus('Loading…')
    try {
      const r = await fetch(`${API}/api/2014/monsters/${index}`)
      const m = (await r.json()) as SrdMonster
      setD(srdToTemplate(m)); setFromSrd(true); setTab('custom'); setStatus('')
    } catch { setStatus('Could not load monster.') }
  }

  return (
    <Sheet open onClose={onClose} tall title="Add monsters"
      footer={tab === 'custom' && (
        <div className="row">
          <Stepper label="Copies" value={copies} onChange={setCopies} min={1} max={20} />
          <button className="btn big primary grow" disabled={!d.name.trim()} onClick={() => onAdd({ ...d, hp: d.maxHp }, copies)}>Add {copies > 1 ? `${copies}×` : ''}</button>
        </div>
      )}>
      <Segmented value={tab} onChange={setTab} options={[{ value: 'srd', label: '📖 Search SRD' }, { value: 'custom', label: '✍️ Custom' }]} />
      {tab === 'srd' ? (
        <>
          <input className="search" autoFocus placeholder="Search monsters (goblin, zombie, owlbear…)" value={q} onChange={(e) => setQ(e.target.value)} />
          {status && <div className="muted small pad">{status}</div>}
          <div className="results">
            {results.slice(0, 40).map((r) => <button key={r.index} className="list-row btnlike" onClick={() => choose(r.index)}><b>{r.name}</b><span>›</span></button>)}
          </div>
          <div className="muted small pad">Free 5e SRD data from dnd5eapi.co. Resistances/immunities become traits automatically.</div>
        </>
      ) : (
        <>
          {fromSrd && <div className="muted small pad">Prefilled from the SRD — tweak anything before adding.</div>}
          <TextField label="Name" value={d.name} onChange={(v) => set({ name: v })} placeholder="Goblin" />
          <div className="grid3">
            <NumField label="AC" value={d.ac} onChange={(v) => set({ ac: v })} />
            <NumField label="Max HP" value={d.maxHp} onChange={(v) => set({ maxHp: v, hp: v })} />
            <NumField label="Init mod" value={d.initMod} onChange={(v) => set({ initMod: v })} />
          </div>
          <TextField label="Armor" value={d.armor} onChange={(v) => set({ armor: v })} placeholder="Leather armor, shield" />
          {d.attacks.length > 0 && <div className="muted small pad">Attacks: {d.attacks.map((a) => `${a.name} (${fmtMod(a.toHit)}, ${a.damage} ${a.damageType})`).join(' · ')}</div>}
          <div className="mini-label">Traits</div>
          <TraitEditor traits={d.traits} onChange={(t) => set({ traits: t })} />
        </>
      )}
    </Sheet>
  )
}

// ---------------- Initiative ----------------
function InitiativeSheet({ combatants, onClose, onSave }: {
  combatants: Combatant[]; onClose: () => void; onSave: (m: Record<string, number>) => void
}) {
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(combatants.map((c) => [c.id, c.initiative?.toString() ?? ''])))
  const [rolled, setRolled] = useState<Record<string, number>>({})
  const roll = (side?: Side) => {
    const v = { ...vals }, r = { ...rolled }
    combatants.forEach((c) => { if (!side || c.side === side) { const d = rollDie(20); r[c.id] = d; v[c.id] = String(d + c.initMod) } })
    setVals(v); setRolled(r)
  }
  const save = () => {
    const m: Record<string, number> = {}
    combatants.forEach((c) => { const n = parseInt(vals[c.id]); m[c.id] = isNaN(n) ? rollDie(20) + c.initMod : n })
    onSave(m)
  }
  return (
    <Sheet open onClose={onClose} tall title="Roll Initiative"
      footer={<button className="btn big primary" onClick={save}>Start combat ▶</button>}>
      <div className="row">
        <button className="btn grow" onClick={() => roll()}>🎲 Roll everyone</button>
        <button className="btn grow" onClick={() => roll('monster')}>👹 Monsters only</button>
      </div>
      <div className="muted small pad">Players rolling their own? Type their totals. Blank boxes get auto-rolled.</div>
      {combatants.map((c) => (
        <div key={c.id} className={'list-row init-row ' + c.side}>
          <div><b>{c.name}</b><div className="muted small">d20 {fmtMod(c.initMod)}{rolled[c.id] ? ` · rolled ${rolled[c.id]}` : ''}</div></div>
          <input inputMode="numeric" className="init-input" value={vals[c.id]} placeholder="—" onChange={(e) => setVals({ ...vals, [c.id]: e.target.value.replace(/[^\d-]/g, '') })} />
        </div>
      ))}
    </Sheet>
  )
}
