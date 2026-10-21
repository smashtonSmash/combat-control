import type { Character } from '../types'
import { uid } from '../types'
import { ABIL_KEYS, ABIL_NAMES, BACKGROUNDS, CLASSES, RACES, applyBonuses, bgBudget, bgDef, chooseBackground, chooseClass, chooseRace, classDef, fixedRaceBonus, raceBudget, raceDef, suggestedHp, sumBonus, type Bonus, type Feature } from '../origins'
import { TextField } from './Sheet'

const SRC_ICON: Record<Feature['source'], string> = { race: '🧬', class: '⚔️', background: '📖', custom: '✦' }

export function BonusAllocator({ label, value, budget, onChange }: { label: string; value?: Bonus; budget: { total: number; maxEach: number }; onChange: (b: Bonus) => void }) {
  const used = sumBonus(value), left = budget.total - used
  return (
    <div className="allocator">
      <div className="row between"><b className="small">{label}</b><span className={'small ' + (left ? 'gold' : 'muted')}>{left} of +{budget.total} left · max +{budget.maxEach} each</span></div>
      <div className="alloc-grid">
        {ABIL_KEYS.map((k) => {
          const v = value?.[k] ?? 0
          return (
            <div key={k} className={'alloc ' + (v ? 'on' : '')} aria-label={ABIL_NAMES[k]}>
              <span>{k.toUpperCase()}</span>
              <div className="alloc-btns">
                <button type="button" disabled={v <= 0} onClick={() => onChange({ ...value, [k]: v - 1 })} aria-label={`Lower ${k}`}>−</button>
                <b>{v ? `+${v}` : '0'}</b>
                <button type="button" disabled={left <= 0 || v >= budget.maxEach} onClick={() => onChange({ ...value, [k]: v + 1 })} aria-label={`Raise ${k}`}>＋</button>
              </div>
            </div>
          )
        })}
      </div>
      {budget.total === 3 && budget.maxEach === 2 && <div className="small muted">Standard flexible origin: +2 / +1, or +1 / +1 / +1.</div>}
    </div>
  )
}

export function OriginsPanel({ d, setD, customBudget }: { d: Character; setD: (c: Character) => void; customBudget: number }) {
  const race = raceDef(d.origin?.raceKey), cls = classDef(d.origin?.classKey), bg = bgDef(d.origin?.bgKey)
  const rb = raceBudget(d, customBudget), bb = bgBudget(d, customBudget)
  const fixed = fixedRaceBonus(d)
  const hp = suggestedHp(d)
  const pickSkills = cls?.skillChoice
  const classSkills = (d.skills ?? []).filter((s) => pickSkills?.from.includes(s) && !bg?.skills.includes(s))
  return (
    <div className="panel origins">
      <b>🧬 Origins</b>
      <label className="field"><span>Race</span>
        <select aria-label="Race" value={d.origin?.raceKey ?? ''} onChange={(e) => setD(chooseRace(d, e.target.value))}>
          <option value="">— Choose —</option>
          <optgroup label="SRD">{RACES.filter((r) => r.srd).map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</optgroup>
          <optgroup label="Other (name only)">{RACES.filter((r) => !r.srd).map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}</optgroup>
          <option value="custom">Custom…</option>
        </select></label>
      {race?.subraces && race.subraces.length > 0 && (
        <label className="field"><span>Subrace</span>
          <select aria-label="Subrace" value={d.origin?.subraceKey ?? ''} onChange={(e) => setD(chooseRace(d, race.key, e.target.value))}>
            {race.subraces.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select></label>
      )}
      {(d.origin?.raceKey === 'custom' || (race && !race.srd)) && <TextField label={d.origin?.raceKey === 'custom' ? 'Custom race name' : 'Race name'} value={d.race} onChange={(v) => setD({ ...d, race: v })} placeholder="Half-dragon" />}
      {Object.keys(fixed).length > 0 && <div className="small">Racial bonuses: <b className="gold">{Object.entries(fixed).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(', ')}</b></div>}
      {rb && <BonusAllocator label={race?.srd ? `${race.name}: choose ${rb.total} abilities (+1 each)` : 'Race ability bonuses'} value={d.origin?.raceBonus} budget={rb}
        onChange={(b) => setD(applyBonuses({ ...d, origin: { ...d.origin, raceBonus: b } }))} />}

      <label className="field"><span>Class</span>
        <select aria-label="Class" value={d.origin?.classKey ?? ''} onChange={(e) => {
          const n = chooseClass(d, e.target.value), s = suggestedHp(n)
          setD(s && (d.maxHp === 10 || d.maxHp === suggestedHp(d)) ? { ...n, maxHp: s, currentHp: s } : n)
        }}>
          <option value="">— Choose —</option>
          <optgroup label="SRD">{CLASSES.filter((c) => c.srd).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</optgroup>
          <optgroup label="Other (name only)">{CLASSES.filter((c) => !c.srd).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</optgroup>
          <option value="custom">Custom…</option>
        </select></label>
      {d.origin?.classKey === 'custom' && (
        <div className="grid2">
          <TextField label="Custom class name" value={d.cls} onChange={(v) => setD({ ...d, cls: v })} placeholder="Gunslinger" />
          <label className="field"><span>Hit die</span>
            <select value={d.hitDie ?? 8} onChange={(e) => setD({ ...d, hitDie: +e.target.value })}>{[6, 8, 10, 12].map((n) => <option key={n} value={n}>d{n}</option>)}</select></label>
        </div>
      )}
      {d.hitDie && (
        <div className="small">Hit die <b>d{d.hitDie}</b>{d.saves?.length ? <> · Saves <b>{d.saves.map((s) => s.toUpperCase()).join(', ')}</b></> : null}
          {hp !== null && <> · Suggested HP <b>{hp}</b> {d.maxHp !== hp && <button className="link small" onClick={() => setD({ ...d, maxHp: hp, currentHp: hp })}>use {hp}</button>}</>}</div>
      )}
      {d.origin?.classKey === 'custom' && (
        <div className="chips-row wrap"><span className="small muted">Saves:</span>{ABIL_KEYS.map((k) => <button key={k} type="button" className={'chip ' + (d.saves?.includes(k) ? 'on' : '')}
          onClick={() => setD({ ...d, saves: d.saves?.includes(k) ? d.saves.filter((x) => x !== k) : [...(d.saves ?? []), k] })}>{k.toUpperCase()}</button>)}</div>
      )}
      {pickSkills && (
        <div>
          <div className="small muted">Class skills: choose {pickSkills.choose} ({classSkills.length}/{pickSkills.choose})</div>
          <div className="chips-row wrap">{pickSkills.from.map((s) => {
            const fromBg = bg?.skills.includes(s), on = (d.skills ?? []).includes(s)
            return <button key={s} type="button" disabled={fromBg || (!on && classSkills.length >= pickSkills.choose)} className={'chip ' + (on ? 'on' : '')}
              onClick={() => setD({ ...d, skills: on ? (d.skills ?? []).filter((x) => x !== s) : [...(d.skills ?? []), s] })}>{s}{fromBg ? ' 📖' : ''}</button>
          })}</div>
        </div>
      )}

      <label className="field"><span>Background</span>
        <select aria-label="Background" value={d.origin?.bgKey ?? ''} onChange={(e) => setD(chooseBackground(d, e.target.value))}>
          <option value="">— Choose —</option>
          <optgroup label="SRD">{BACKGROUNDS.filter((b) => b.srd).map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}</optgroup>
          <optgroup label="Other (name + skills only)">{BACKGROUNDS.filter((b) => !b.srd).map((b) => <option key={b.key} value={b.key}>{b.name}</option>)}</optgroup>
          <option value="custom">Custom…</option>
        </select></label>
      {d.origin?.bgKey === 'custom' && <TextField label="Custom background name" value={d.background ?? ''} onChange={(v) => setD({ ...d, background: v })} placeholder="Wandering cartographer" />}
      {bg && <div className="small">Background skills: <b>{bg.skills.join(', ')}</b></div>}
      {bb && <BonusAllocator label="Background ability bonuses" value={d.origin?.bgBonus} budget={bb} onChange={(b) => setD(applyBonuses({ ...d, origin: { ...d.origin, bgBonus: b } }))} />}
    </div>
  )
}

export function FeatureEditor({ features, onChange }: { features: Feature[]; onChange: (f: Feature[]) => void }) {
  const upd = (id: string, p: Partial<Feature>) => onChange(features.map((f) => (f.id === id ? { ...f, ...p } : f)))
  return (
    <div className="feature-edit">
      {features.length === 0 && <div className="small muted">Pick a race, class and background to fill these in, or add your own.</div>}
      {features.map((f) => (
        <details key={f.id} className="feature-row">
          <summary><span>{SRC_ICON[f.source]}</span> <b>{f.name || 'Unnamed'}</b></summary>
          <input value={f.name} aria-label="Feature name" onChange={(e) => upd(f.id, { name: e.target.value })} />
          <textarea rows={3} value={f.desc} aria-label="Feature description" placeholder="Describe what it does…" onChange={(e) => upd(f.id, { desc: e.target.value })} />
          <button className="link small danger" onClick={() => onChange(features.filter((x) => x.id !== f.id))}>Remove</button>
        </details>
      ))}
      <button className="btn ghost sm" onClick={() => onChange([...features, { id: uid(), name: '', desc: '', source: 'custom' }])}>+ Add trait / feature</button>
    </div>
  )
}
export { SRC_ICON }
