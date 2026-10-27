import type { Character } from '../types'
import { uid } from '../types'
import { ABIL_KEYS, ABIL_NAMES, BACKGROUNDS, CLASSES, CLASS_PRIMARY, RACES, SKILLS, applyBonuses, applySavedOrigin, backgroundOptionHint, backgroundTools, bgBudget, bgDef, bonusText, captureOrigin, chooseBackground, chooseClass, chooseRace, classDef, classOptionHint, classSkillPicks, fixedRaceBonus, raceBudget, raceDef, raceOptionHint, skillChoiceOf, suggestedHp, sumBonus, toggleSkill, type Bonus, type Feature, type SavedOrigin } from '../origins'
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

function savedHint(r: SavedOrigin): string {
  if (r.kind === 'class' && r.hitDie) return `d${r.hitDie}`
  if (r.kind === 'background' && r.skills?.length) return r.skills.join(', ')
  if (r.kind === 'race') return bonusText(r.bonuses)
  return ''
}

function OriginSelect({ label, value, srd, other, saved, hint, onChange }: {
  label: string; value: string; srd: { key: string; name: string }[]; other: { key: string; name: string }[]
  saved: SavedOrigin[]; hint?: (key: string) => string; onChange: (v: string) => void
}) {
  const text = (key: string, name: string) => {
    const h = hint?.(key)
    return h ? `${name} — ${h}` : name
  }
  return (
    <label className="field"><span>{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Choose —</option>
        <optgroup label="SRD">{srd.map((r) => <option key={r.key} value={r.key}>{text(r.key, r.name)}</option>)}</optgroup>
        <optgroup label="Other">{other.map((r) => <option key={r.key} value={r.key}>{text(r.key, r.name)}</option>)}</optgroup>
        {saved.length > 0 && <optgroup label="Saved">{saved.map((r) => {
          const h = savedHint(r)
          return <option key={r.id} value={'lib:' + r.id}>{h ? `${r.name} — ${h}` : r.name}</option>
        })}</optgroup>}
        <option value="custom">Custom…</option>
      </select></label>
  )
}

export function OriginsPanel({ d, setD, customBudget, library = [], onSaveOrigin }: {
  d: Character; setD: (c: Character) => void; customBudget: number
  library?: SavedOrigin[]; onSaveOrigin?: (e: SavedOrigin) => void
}) {
  const race = raceDef(d.origin?.raceKey), cls = classDef(d.origin?.classKey), bg = bgDef(d.origin?.bgKey)
  const rb = raceBudget(d, customBudget), bb = bgBudget(d, customBudget)
  const fixed = fixedRaceBonus(d)
  const hp = suggestedHp(d)
  const pickSkills = skillChoiceOf(d)
  const classSkills = classSkillPicks(d)
  const saved = (kind: SavedOrigin['kind']) => library.filter((e) => e.kind === kind)
  const pickSaved = (kind: SavedOrigin['kind'], v: string, choose: (key: string) => Character) => {
    if (v.startsWith('lib:')) {
      const entry = library.find((e) => e.kind === kind && e.id === v.slice(4))
      if (entry) setD(applySavedOrigin(d, entry))
      return
    }
    setD(choose(v))
  }
  const saveKind = (kind: SavedOrigin['kind']) => {
    const entry = captureOrigin(d, kind)
    if (entry) onSaveOrigin?.(entry)
  }
  return (
    <div className="panel origins">
      <b>🧬 Origins</b>
      <p className="small muted">SRD means System Reference Document — the free official options. Other is the rest of the common book list, with the usual bonuses and traits.</p>
      <OriginSelect label="Race" value={d.origin?.raceKey ?? ''} srd={RACES.filter((r) => r.srd)} other={RACES.filter((r) => !r.srd)} saved={saved('race')}
        hint={(key) => { const r = raceDef(key); return r ? raceOptionHint(r) : '' }}
        onChange={(v) => pickSaved('race', v, (key) => chooseRace(d, key))} />
      {race && raceOptionHint(race) && <div className="small muted">Racial ASI: {raceOptionHint(race)}</div>}
      {race?.subraces && race.subraces.length > 0 && (
        <label className="field"><span>Subrace</span>
          <select aria-label="Subrace" value={d.origin?.subraceKey ?? ''} onChange={(e) => setD(chooseRace(d, race.key, e.target.value))}>
            {race.subraces.map((s) => {
              const extra = bonusText(s.bonuses)
              return <option key={s.key} value={s.key}>{extra ? `${s.name} — ${extra}` : s.name}</option>
            })}
          </select></label>
      )}
      {(d.origin?.raceKey === 'custom' || d.origin?.raceKey?.startsWith('lib:')) && <TextField label="Custom race name" value={d.race} onChange={(v) => setD({ ...d, race: v })} placeholder="Half-dragon" />}
      {d.origin?.raceKey && (
        <label className="row small">
          <input type="checkbox" checked={!!d.origin?.noStandardBonus} onChange={(e) => setD(applyBonuses({ ...d, origin: { ...d.origin, noStandardBonus: e.target.checked, raceBonus: {} } }))} />
          Opt out of standard racial trait bonuses and assign my own
        </label>
      )}
      {Object.keys(fixed).length > 0 && <div className="small">Racial bonuses: <b className="gold">{Object.entries(fixed).map(([k, v]) => `${k.toUpperCase()} ${v > 0 ? '+' : ''}${v}`).join(', ')}</b></div>}
      {rb && <BonusAllocator label={d.origin?.noStandardBonus ? 'Custom racial bonuses' : race?.srd ? `${race.name}: choose ${rb.total} ${rb.total === 1 ? 'ability' : 'abilities'} (+1 each)` : 'Race ability bonuses'} value={d.origin?.raceBonus} budget={rb}
        onChange={(b) => setD(applyBonuses({ ...d, origin: { ...d.origin, raceBonus: b } }))} />}
      {onSaveOrigin && (d.origin?.raceKey === 'custom' || d.origin?.raceKey?.startsWith('lib:')) && d.race.trim() && (
        <button type="button" className="btn ghost sm" onClick={() => saveKind('race')}>Save this race to the library</button>
      )}

      <OriginSelect label="Class" value={d.origin?.classKey ?? ''} srd={CLASSES.filter((c) => c.srd)} other={CLASSES.filter((c) => !c.srd)} saved={saved('class')}
        hint={(key) => { const c = classDef(key); return c ? classOptionHint(c) : '' }}
        onChange={(v) => {
          if (v.startsWith('lib:')) { pickSaved('class', v, (key) => chooseClass(d, key)); return }
          const n = chooseClass(d, v), s = suggestedHp(n)
          setD(s && (d.maxHp === 10 || d.maxHp === suggestedHp(d)) ? { ...n, maxHp: s, currentHp: s } : n)
        }} />
      {d.origin?.classKey === 'custom' && (
        <div className="grid2">
          <TextField label="Custom class name" value={d.cls} onChange={(v) => setD({ ...d, cls: v })} placeholder="Gunslinger" />
          <label className="field"><span>Hit die</span>
            <select value={d.hitDie ?? 8} onChange={(e) => setD({ ...d, hitDie: +e.target.value })}>{[6, 8, 10, 12].map((n) => <option key={n} value={n}>d{n}</option>)}</select></label>
        </div>
      )}
      {d.hitDie && (
        <div className="small">Hit die <b>d{d.hitDie}</b>
          {cls && CLASS_PRIMARY[cls.key] && <> · Primary <b>{CLASS_PRIMARY[cls.key]}</b></>}
          {d.saves?.length ? <> · Saves <b>{d.saves.map((s) => s.toUpperCase()).join(', ')}</b></> : null}
          {hp !== null && <> · Suggested HP <b>{hp}</b> {d.maxHp !== hp && <button className="link small" onClick={() => setD({ ...d, maxHp: hp, currentHp: hp })}>use {hp}</button>}</>}</div>
      )}
      {d.saves && d.saves.length > 0 && d.origin?.classKey !== 'custom' && (
        <div className="chips-row wrap" aria-label="Saving throws"><span className="small muted">Saves (automatic):</span>{d.saves.map((k) => <span key={k} className="chip on">{k.toUpperCase()}</span>)}</div>
      )}
      {d.origin?.classKey === 'custom' && (
        <div className="chips-row wrap"><span className="small muted">Saves:</span>{ABIL_KEYS.map((k) => <button key={k} type="button" className={'chip ' + (d.saves?.includes(k) ? 'on' : '')}
          onClick={() => setD({ ...d, saves: d.saves?.includes(k) ? d.saves.filter((x) => x !== k) : [...(d.saves ?? []), k] })}>{k.toUpperCase()}</button>)}</div>
      )}
      {onSaveOrigin && (d.origin?.classKey === 'custom' || d.origin?.classKey?.startsWith('lib:')) && d.cls.trim() && (
        <button type="button" className="btn ghost sm" onClick={() => saveKind('class')}>Save this class to the library</button>
      )}
      {pickSkills && (
        <div className="skill-pick">
          <div className="row between"><b>Class skills</b><span className={'small ' + (classSkills.length === pickSkills.choose ? 'gold' : '')}>{classSkills.length}/{pickSkills.choose} chosen</span></div>
          <p className="small">Choose {pickSkills.choose} from the {cls?.name || d.cls || 'class'} list. Background skills are already filled in and do not use these picks. You can change this list any time.</p>
          <div className="chips-row wrap">{pickSkills.from.map((s) => {
            const fromBg = bg?.skills.includes(s) && (d.skills ?? []).includes(s)
            const on = (d.skills ?? []).includes(s)
            return <button key={s} type="button" disabled={!!fromBg || (!on && classSkills.length >= pickSkills.choose)} className={'chip skill-chip ' + (on ? 'on' : '')}
              onClick={() => setD(toggleSkill(d, s))}>{on ? '● ' : '○ '}{s}{fromBg ? ' · background' : ''}</button>
          })}</div>
        </div>
      )}
      <details className="skill-all" open={!pickSkills}>
        <summary>Edit the full skill list</summary>
        <p className="small muted">Any skill can be turned on or off later. Class picks above still stop at {pickSkills ? pickSkills.choose : 'the class number'}.</p>
        <div className="chips-row wrap">{SKILLS.map(([s]) => {
          const on = (d.skills ?? []).includes(s)
          return <button key={s} type="button" className={'chip skill-chip ' + (on ? 'on' : '')} onClick={() => setD(toggleSkill(d, s))}>{on ? '●' : '○'} {s}</button>
        })}</div>
      </details>

      <OriginSelect label="Background" value={d.origin?.bgKey ?? ''} srd={BACKGROUNDS.filter((b) => b.srd)} other={BACKGROUNDS.filter((b) => !b.srd)} saved={saved('background')}
        hint={(key) => { const b = bgDef(key); return b ? backgroundOptionHint(b) : '' }}
        onChange={(v) => pickSaved('background', v, (key) => chooseBackground(d, key))} />
      {(d.origin?.bgKey === 'custom' || d.origin?.bgKey?.startsWith('lib:')) && <TextField label="Custom background name" value={d.background ?? ''} onChange={(v) => setD({ ...d, background: v })} placeholder="Wandering cartographer" />}
      {onSaveOrigin && (d.origin?.bgKey === 'custom' || d.origin?.bgKey?.startsWith('lib:')) && (d.background ?? '').trim() && (
        <button type="button" className="btn ghost sm" onClick={() => saveKind('background')}>Save this background to the library</button>
      )}
      {bg && <div className="small">Background skills (automatic): <b>{bg.skills.join(', ')}</b>{backgroundTools(bg).length > 0 && <> · Tools <b>{backgroundTools(bg).join(', ')}</b></>}{bg.feature ? <> · {bg.feature.name}</> : null}</div>}
      {!bg && d.origin?.bgKey?.startsWith('lib:') && d.background && <div className="small">Background: <b>{d.background}</b></div>}
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
