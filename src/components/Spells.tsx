import { useEffect, useMemo, useState } from 'react'
import type { Character, DamageType } from '../types'
import { DAMAGE_TYPES, DAMAGE_ICONS, uid } from '../types'
import { rollExpression } from '../dice'
import { availableSlots, casterInfo, damageFor, fromSrd, loadSpells, restoreAll, slotsFor, spendSlot, type CharSpell, type Slots, type SrdSpell } from '../spells'

const ORD = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']
const zeros = () => Array(9).fill(0)

/** Effective slots: auto from class/level unless edited by hand. */
export function effectiveSlots(c: Character): Slots {
  if (c.slotsManual && c.slots) return c.slots
  const auto = slotsFor(c.cls, c.level)
  const used = (c.slots?.used ?? zeros()).map((u, i) => Math.min(u, auto.max[i]))
  return { ...auto, used }
}
export const isCaster = (c: Character) => !!casterInfo(c.cls) || !!c.spellcasting

export function SpellsSection({ d, commit }: { d: Character; commit: (c: Character) => void }) {
  const [sel, setSel] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editSlots, setEditSlots] = useState(false)
  const [msg, setMsg] = useState('')
  const [castLevel, setCastLevel] = useState(1)
  if (!isCaster(d)) {
    return <button className="btn ghost sm" onClick={() => commit({ ...d, spellcasting: true })}>✨ Enable spellcasting for this character</button>
  }
  const slots = effectiveSlots(d)
  const setSlots = (s: Slots, manual = d.slotsManual) => commit({ ...d, slots: s, slotsManual: manual })
  const spells = [...(d.spells ?? [])].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  const sp = spells.find((x) => x.id === sel)
  const avail = sp ? availableSlots(slots, sp.level) : []
  const info = casterInfo(d.cls)

  const cast = (s: CharSpell, lvl: number) => {
    let next = d
    if (s.level > 0) {
      const ns = spendSlot(slots, lvl)
      if (!ns) return setMsg(`No ${ORD[lvl]}-level slots left.`)
      next = { ...d, slots: ns }
    }
    const dice = damageFor(s, lvl, d.level)
    let text = `${d.name} casts ${s.name}${s.level > 0 ? ` (${ORD[lvl]}-level slot)` : ''}.`
    if (dice) { const r = rollExpression(dice); text += ` Damage ${dice}: ${r.detail} = ${r.total} ${s.damageType ?? ''}.` }
    if (s.save) text += ` Save: ${s.save}.`
    if (s.effect === 'resistance') text += ` Grants resistance to ${s.effectType}${s.effectRounds ? ` for ${s.effectRounds} rounds` : ''}.`
    if (s.concentration) text += ' (Concentration)'
    commit(next); setMsg(text)
  }

  return (
    <div className="panel spells">
      <div className="row between">
        <b>✨ Spell slots {slots.pact ? <small className="muted">(pact magic)</small> : null}</b>
        <span className="row" style={{ gap: 6 }}>
          <button className="btn sm" onClick={() => { setSlots(restoreAll(slots)); setMsg('Long rest: all slots restored.') }}>🌙 Long rest</button>
          {slots.pact && <button className="btn sm" onClick={() => { setSlots(restoreAll(slots)); setMsg('Short rest: pact slots restored.') }}>🌗 Short</button>}
          <button className="icon-btn sm" aria-label="Edit slots" onClick={() => setEditSlots(!editSlots)}>✎</button>
        </span>
      </div>
      {slots.max.every((m) => !m) && !editSlots && <div className="small muted">No slots at this level{info ? '' : ' — tap ✎ to set them'}.</div>}
      {slots.max.map((m, i) => (m > 0 || editSlots) && (
        <div key={i} className="slot-row">
          <span className="slot-lv">{ORD[i + 1]}</span>
          {editSlots ? (
            <span className="row" style={{ gap: 4 }}>
              <button className="icon-btn sm" onClick={() => { const max = [...slots.max]; max[i] = Math.max(0, max[i] - 1); setSlots({ ...slots, max }, true) }}>−</button>
              <b>{m}</b>
              <button className="icon-btn sm" onClick={() => { const max = [...slots.max]; max[i] = max[i] + 1; setSlots({ ...slots, max }, true) }}>+</button>
            </span>
          ) : Array.from({ length: m }, (_, j) => {
            const left = m - (slots.used[i] ?? 0)
            const on = j < left
            return <button key={j} className={'pip ' + (on ? 'on' : '')} aria-label={on ? 'Spend slot' : 'Restore slot'}
              onClick={() => { const used = [...slots.used]; used[i] = Math.max(0, Math.min(m, used[i] + (on ? 1 : -1))); setSlots({ ...slots, used }) }} />
          })}
          {!editSlots && <small className="muted">{m - (slots.used[i] ?? 0)}/{m}</small>}
        </div>
      ))}
      {editSlots && <button className="link small" onClick={() => { commit({ ...d, slotsManual: false }); setEditSlots(false) }}>Auto-fill from class & level</button>}

      <div className="mini-label">Spells {info ? `· ${info.cls} (${info.ability.toUpperCase()})` : ''}</div>
      {spells.length === 0 && <div className="small muted">No spells yet.</div>}
      <div className="spell-list">
        {spells.map((s, i) => (
          <div key={s.id}>
            {(i === 0 || spells[i - 1].level !== s.level) && <div className="spell-lv-head">{s.level === 0 ? 'Cantrips' : `${ORD[s.level]} level`}</div>}
            <button className={'spell-card ' + (sel === s.id ? 'selected' : '')} onClick={() => { setSel(sel === s.id ? null : s.id); setCastLevel(Math.max(1, s.level)); setMsg('') }}>
              <span className="sc-name">{s.prepared ? '★ ' : ''}{s.name}</span>
              <span className="sc-tags">
                {s.damageType && <span className="badge">{DAMAGE_ICONS[s.damageType]} {s.damageType}</span>}
                {s.effect === 'resistance' && <span className="badge">🛡 res {s.effectType}</span>}
                {s.concentration && <span className="badge">C</span>}
                {!s.srd && <span className="badge">custom</span>}
              </span>
            </button>
            {sel === s.id && (
              <div className="spell-detail">
                <div className="small muted">{[s.school, s.castingTime, s.range, s.duration].filter(Boolean).join(' · ')}{s.components ? ` · ${s.components}` : ''}</div>
                {s.save && <div className="small">🎯 Save: <b>{s.save}</b></div>}
                {(damageFor(s, castLevel, d.level)) && <div className="small">💥 {damageFor(s, castLevel, d.level)} {s.damageType}</div>}
                {s.effectNote && <div className="small">✦ {s.effectNote}</div>}
                <div className="spell-desc">{s.description}</div>
                {s.level > 0 && (
                  <div className="chips-row wrap">
                    {Array.from({ length: 10 - s.level }, (_, k) => s.level + k).filter((l) => slots.max[l - 1] > 0).map((l) => (
                      <button key={l} className={'chip ' + (castLevel === l ? 'on' : '')} disabled={!avail.some((a) => a.level === l)} onClick={() => setCastLevel(l)}>
                        {ORD[l]} ({slots.max[l - 1] - slots.used[l - 1]})
                      </button>
                    ))}
                  </div>
                )}
                <div className="row">
                  <button className="btn sm primary" disabled={s.level > 0 && !avail.some((a) => a.level === castLevel)} onClick={() => cast(s, castLevel)}>✨ Cast{s.level > 0 ? ` (${ORD[castLevel]})` : ''}</button>
                  <button className="btn sm" onClick={() => commit({ ...d, spells: (d.spells ?? []).map((x) => (x.id === s.id ? { ...x, prepared: !x.prepared } : x)) })}>{s.prepared ? '☆ Unprepare' : '★ Prepare'}</button>
                  <button className="btn sm danger" onClick={() => { commit({ ...d, spells: (d.spells ?? []).filter((x) => x.id !== s.id) }); setSel(null) }}>Remove</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {msg && <div className="inv-msg">{msg}</div>}
      <button className="btn ghost sm" onClick={() => setAdding(!adding)}>{adding ? 'Done adding' : '+ Add spell'}</button>
      {adding && <SpellPicker cls={info?.cls} have={new Set((d.spells ?? []).map((x) => x.srd ?? ''))}
        onAdd={(s) => { commit({ ...d, spells: [...(d.spells ?? []), s] }); setMsg(`Added ${s.name}.`) }} />}
    </div>
  )
}

function SpellPicker({ cls, have, onAdd }: { cls?: string; have: Set<string>; onAdd: (s: CharSpell) => void }) {
  const [all, setAll] = useState<SrdSpell[] | null>(null)
  const [lvl, setLvl] = useState(0)
  const [q, setQ] = useState('')
  const [allClasses, setAllClasses] = useState(!cls)
  useEffect(() => { loadSpells().then(setAll) }, [])
  const list = useMemo(() => (all ?? []).filter((s) => s.l === lvl && (allClasses || !cls || s.cls.includes(cls)) && s.n.toLowerCase().includes(q.toLowerCase())), [all, lvl, q, cls, allClasses])
  return (
    <div className="spell-picker">
      <div className="chips-row lv-tabs">{ORD.map((o, i) => <button key={o} className={'chip ' + (lvl === i ? 'on' : '')} onClick={() => setLvl(i)}>{i === 0 ? 'Cantrips' : i}</button>)}</div>
      <div className="row">
        <input className="grow" placeholder={`Search ${lvl === 0 ? 'cantrips' : ORD[lvl] + '-level spells'}…`} value={q} onChange={(e) => setQ(e.target.value)} />
        {cls && <label className="check small"><input type="checkbox" checked={allClasses} onChange={(e) => setAllClasses(e.target.checked)} /> all classes</label>}
      </div>
      <div className="picker-list">
        {!all && <div className="small muted">Loading spells…</div>}
        {list.map((s) => (
          <button key={s.i} className="picker-row" disabled={have.has(s.i)} onClick={() => onAdd(fromSrd(s, uid()))}>
            <b>{s.n}</b> <small className="muted">{s.s}{s.dt ? ` · ${DAMAGE_ICONS[s.dt]} ${s.dt}` : ''}{s.conc ? ' · C' : ''}</small>
            <span className="add">{have.has(s.i) ? '✓' : '+'}</span>
          </button>
        ))}
        {all && list.length === 0 && <div className="small muted">No matches.</div>}
        <CustomSpell level={lvl} onAdd={onAdd} />
      </div>
    </div>
  )
}

export function CustomSpell({ level, onAdd, label = '✎ Custom spell' }: { level: number; onAdd: (s: CharSpell) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  const blank = () => ({ name: '', description: '', damage: '', damageType: '' as DamageType | '', save: '', effect: 'none' as CharSpell['effect'], effectType: 'fire' as DamageType, effectRounds: 10, effectNote: '', concentration: false })
  const [f, setF] = useState(blank)
  const [lv, setLv] = useState(level)
  useEffect(() => setLv(level), [level])
  if (!open) return <button className="picker-row custom" onClick={() => setOpen(true)}><b>{label}</b><span className="add">+</span></button>
  return (
    <div className="panel custom-spell">
      <b>{label}</b>
      <div className="row"><input className="grow" placeholder="Spell name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <select value={lv} onChange={(e) => setLv(Number(e.target.value))}>{ORD.map((o, i) => <option key={o} value={i}>{o}</option>)}</select></div>
      <textarea rows={3} placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <div className="row">
        <input style={{ width: 90 }} placeholder="Dice 3d6" value={f.damage} onChange={(e) => setF({ ...f, damage: e.target.value })} />
        <select value={f.damageType} onChange={(e) => setF({ ...f, damageType: e.target.value as DamageType })}><option value="">no damage</option>{DAMAGE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <select value={f.save} onChange={(e) => setF({ ...f, save: e.target.value })}><option value="">no save</option>{['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map((s) => <option key={s}>{s}</option>)}</select>
      </div>
      <div className="segmented">
        {(['none', 'resistance', 'buff'] as const).map((e) => <button key={e} type="button" className={f.effect === e ? 'on' : ''} onClick={() => setF({ ...f, effect: e })}>{e === 'none' ? 'No effect' : e === 'resistance' ? 'Grants resistance' : 'Buff / other'}</button>)}
      </div>
      {f.effect === 'resistance' && (
        <div className="row"><span className="small">Resist</span>
          <select value={f.effectType} onChange={(e) => setF({ ...f, effectType: e.target.value as DamageType })}>{DAMAGE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          <span className="small">for</span><input style={{ width: 56 }} inputMode="numeric" value={String(f.effectRounds)} onChange={(e) => setF({ ...f, effectRounds: parseInt(e.target.value) || 0 })} /><span className="small">rounds</span></div>
      )}
      {f.effect === 'buff' && <input placeholder="Effect, e.g. +2 AC for 10 rounds" value={f.effectNote} onChange={(e) => setF({ ...f, effectNote: e.target.value })} />}
      <label className="check small"><input type="checkbox" checked={f.concentration} onChange={(e) => setF({ ...f, concentration: e.target.checked })} /> Concentration</label>
      <div className="row">
        <button className="btn sm primary" disabled={!f.name.trim()} onClick={() => {
          onAdd({ id: uid(), name: f.name.trim(), level: lv, description: f.description, concentration: f.concentration,
            ...(f.damage.trim() && f.damageType ? { damage: f.damage.trim(), damageType: f.damageType as DamageType } : {}),
            ...(f.save ? { save: f.save } : {}),
            ...(f.effect !== 'none' ? { effect: f.effect, effectNote: f.effect === 'buff' ? f.effectNote : `Resistance to ${f.effectType} for ${f.effectRounds} rounds`, ...(f.effect === 'resistance' ? { effectType: f.effectType, effectRounds: f.effectRounds } : {}) } : {}) })
          setF(blank()); setOpen(false)
        }}>Add custom spell</button>
        <button className="btn sm ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}
