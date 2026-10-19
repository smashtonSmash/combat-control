import type { Attack, DamageType, Trait, TraitEffect } from '../types'
import { DAMAGE_ICONS, DAMAGE_TYPES, TRAIT_EFFECTS, uid } from '../types'
import { EFFECT_LABEL } from '../combat'

export function DamageTypePicker({ value, onChange, multi }: {
  value: DamageType[]; onChange: (v: DamageType[]) => void; multi?: boolean
}) {
  return (
    <div className="dtype-grid">
      {DAMAGE_TYPES.map((t) => {
        const on = value.includes(t)
        return (
          <button type="button" key={t} className={'dtype' + (on ? ' on' : '')}
            onClick={() => onChange(multi ? (on ? value.filter((x) => x !== t) : [...value, t]) : [t])}>
            <span>{DAMAGE_ICONS[t]}</span>{t}
          </button>
        )
      })}
    </div>
  )
}

export function TraitEditor({ traits, onChange }: { traits: Trait[]; onChange: (t: Trait[]) => void }) {
  const upd = (id: string, p: Partial<Trait>) => onChange(traits.map((t) => (t.id === id ? { ...t, ...p } : t)))
  return (
    <div className="editor-list">
      {traits.map((t) => (
        <div className="editor-item" key={t.id}>
          <div className="row">
            <input className="grow" placeholder="Trait name (e.g. Homebrew Padded Armor)" value={t.name} onChange={(e) => upd(t.id, { name: e.target.value })} />
            <button type="button" className="icon-btn danger" onClick={() => onChange(traits.filter((x) => x.id !== t.id))} aria-label="Remove trait">🗑</button>
          </div>
          <div className="effect-row">
            {TRAIT_EFFECTS.map((e) => (
              <button type="button" key={e} className={'chip effect-' + e + (t.effect === e ? ' on' : '')}
                onClick={() => upd(t.id, { effect: e as TraitEffect })}>{EFFECT_LABEL[e]}</button>
            ))}
          </div>
          <div className="mini-label">Applies vs damage types (tap to toggle)</div>
          <DamageTypePicker multi value={t.damageTypes} onChange={(v) => upd(t.id, { damageTypes: v })} />
          <textarea rows={2} placeholder="Reminder note shown during attacks" value={t.note} onChange={(e) => upd(t.id, { note: e.target.value })} />
        </div>
      ))}
      <button type="button" className="btn ghost" onClick={() => onChange([...traits, { id: uid(), name: '', damageTypes: [], effect: 'advantage', note: '' }])}>
        + Add trait
      </button>
    </div>
  )
}

export function AttackEditor({ attacks, onChange }: { attacks: Attack[]; onChange: (a: Attack[]) => void }) {
  const upd = (id: string, p: Partial<Attack>) => onChange(attacks.map((a) => (a.id === id ? { ...a, ...p } : a)))
  return (
    <div className="editor-list">
      {attacks.map((a) => (
        <div className="editor-item" key={a.id}>
          <div className="row">
            <input className="grow" placeholder="Attack name" value={a.name} onChange={(e) => upd(a.id, { name: e.target.value })} />
            <button type="button" className="icon-btn danger" onClick={() => onChange(attacks.filter((x) => x.id !== a.id))} aria-label="Remove attack">🗑</button>
          </div>
          <div className="row">
            <label className="field small"><span>To hit</span>
              <input inputMode="numeric" value={String(a.toHit)} onChange={(e) => upd(a.id, { toHit: parseInt(e.target.value) || 0 })} /></label>
            <label className="field grow"><span>Damage</span>
              <input value={a.damage} placeholder="1d8+3" onChange={(e) => upd(a.id, { damage: e.target.value })} /></label>
            <label className="field"><span>Type</span>
              <select value={a.damageType} onChange={(e) => upd(a.id, { damageType: e.target.value as DamageType })}>
                {DAMAGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></label>
          </div>
        </div>
      ))}
      <button type="button" className="btn ghost" onClick={() => onChange([...attacks, { id: uid(), name: '', toHit: 0, damage: '1d6', damageType: 'slashing' }])}>
        + Add attack
      </button>
    </div>
  )
}
