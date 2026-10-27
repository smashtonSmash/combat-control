import { useState } from 'react'
import { createPortal } from 'react-dom'
import { rollDie } from '../dice'
import { applyLevelUp, hitDieAverage, hpGain, levelChecklist } from '../level'
import type { Character } from '../types'
import { WhoName } from './PlayerName'
import { Sheet } from './Sheet'

type Method = 'roll' | 'typed' | 'average'

interface Row {
  id: string
  method: Method
  typed: string
  rolled: number | null
  die: number
}

function startRows(chars: Character[]): Row[] {
  return chars.filter((c) => (c.level || 1) < 20).map((c) => ({
    id: c.id, method: 'roll', typed: '', rolled: null, die: c.hitDie || 8,
  }))
}

export function LevelUpSheet({ characters, pick, focusId, onClose, onSave }: {
  characters: Character[]
  /** DM opens the picker. A character button skips it. */
  pick: boolean
  focusId?: string
  onClose: () => void
  onSave: (c: Character) => void
}) {
  const [target, setTarget] = useState<'all' | string>(focusId && !pick ? focusId : pick ? '' : (focusId || characters[0]?.id || ''))
  const [step, setStep] = useState<'who' | 'die' | 'check'>(pick && !focusId ? 'who' : 'die')
  const [rows, setRows] = useState<Row[]>(() => startRows(focusId ? characters.filter((c) => c.id === focusId) : []))
  const [burst, setBurst] = useState<string | null>(null)
  const [done, setDone] = useState<Character[]>([])

  const chosen = target === 'all' ? characters : characters.filter((c) => c.id === target)
  const setRow = (id: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)))

  const begin = () => {
    const list = chosen.filter((c) => (c.level || 1) < 20)
    if (!list.length) return
    setRows(startRows(list))
    setStep('die')
  }

  const resolved = (r: Row): number | null => {
    if (r.method === 'average') return hitDieAverage(r.die)
    if (r.method === 'roll') return r.rolled
    const n = parseInt(r.typed, 10)
    if (!Number.isFinite(n) || n < 1 || n > r.die) return null
    return n
  }

  const ready = rows.length > 0 && rows.every((r) => resolved(r) != null)

  const confirm = () => {
    if (!ready) return
    const next = rows.map((r) => {
      const c = characters.find((x) => x.id === r.id)!
      const die = resolved(r)!
      const leveled = applyLevelUp({ ...c, hitDie: c.hitDie || r.die }, die)
      return leveled
    })
    next.forEach(onSave)
    setDone(next)
    const label = next.length === 1 ? `${next[0].name || 'Character'} · level ${next[0].level}` : `${next.length} characters`
    setBurst(label)
    window.setTimeout(() => { setBurst(null); setStep('check') }, 1500)
  }

  return (
    <Sheet open onClose={onClose} tall title="Level up">
      {step === 'who' && (
        <>
          <p className="small muted">Level one character, or the whole party. Each one still rolls their own hit die.</p>
          <div className="chips-row wrap">
            <button type="button" className={'chip ' + (target === 'all' ? 'on' : '')} onClick={() => setTarget('all')}>All</button>
            {characters.map((c) => (
              <button key={c.id} type="button" className={'chip ' + (target === c.id ? 'on' : '')} onClick={() => setTarget(c.id)}>
                <WhoName id={c.id} name={c.name || 'Unnamed'} /> <small>Lv {c.level}</small>
              </button>
            ))}
          </div>
          <button className="btn primary" disabled={!target || chosen.every((c) => (c.level || 1) >= 20)} onClick={begin}>Next</button>
        </>
      )}
      {step === 'die' && (
        <>
          {rows.map((r) => {
            const c = characters.find((x) => x.id === r.id)
            if (!c) return null
            const face = resolved(r)
            const gain = face == null ? null : hpGain(face, c.abilities.con)
            return (
              <div key={r.id} className="panel">
                <div className="row between">
                  <b><WhoName id={c.id} name={c.name || 'Unnamed'} /></b>
                  <span className="small">Level <b>{c.level}</b> → <b>{c.level + 1}</b></span>
                </div>
                {!c.hitDie && (
                  <label className="field"><span>Hit die</span>
                    <select aria-label="Hit die" value={r.die} onChange={(e) => setRow(r.id, { die: +e.target.value, rolled: null })}>
                      {[6, 8, 10, 12].map((n) => <option key={n} value={n}>d{n}</option>)}
                    </select>
                  </label>
                )}
                <div className="small muted">Hit die d{r.die}. The result, plus Constitution, is added to max HP and current HP.</div>
                <div className="segmented">
                  <button type="button" className={r.method === 'roll' ? 'on' : ''} onClick={() => setRow(r.id, { method: 'roll' })}>Roll here</button>
                  <button type="button" className={r.method === 'typed' ? 'on' : ''} onClick={() => setRow(r.id, { method: 'typed' })}>Rolled at the table</button>
                  <button type="button" className={r.method === 'average' ? 'on' : ''} onClick={() => setRow(r.id, { method: 'average' })}>Fixed average</button>
                </div>
                {r.method === 'roll' && (
                  <div className="row">
                    <button type="button" className="btn sm" onClick={() => setRow(r.id, { rolled: rollDie(r.die) })}>Roll d{r.die}</button>
                    {r.rolled != null && <b className="gold">d{r.die} → {r.rolled}</b>}
                  </div>
                )}
                {r.method === 'typed' && (
                  <label className="field"><span>Die result (onto max HP)</span>
                    <input inputMode="numeric" aria-label="Typed hit die" value={r.typed} placeholder={`1–${r.die}`}
                      onChange={(e) => setRow(r.id, { typed: e.target.value.replace(/[^\d]/g, '') })} />
                  </label>
                )}
                {r.method === 'average' && <div className="small">Fixed average: d{r.die} → <b>{hitDieAverage(r.die)}</b></div>}
                {gain != null && <div className="small">Max HP {c.maxHp} → <b>{c.maxHp + gain}</b> <span className="muted">({face} + CON)</span></div>}
              </div>
            )
          })}
          <button className="btn big primary" disabled={!ready} onClick={confirm}>Level up</button>
        </>
      )}
      {step === 'check' && (
        <>
          <p className="small">Hit points are on the sheet. Tick what you still need to choose.</p>
          {done.map((c) => {
            const checks = levelChecklist(c, c.level)
            const tasks = c.levelTasks
            const toggle = (key: 'asi' | 'feat' | 'spells') => {
              const n = { ...c, levelTasks: { ...tasks, level: c.level, [key]: !tasks?.[key] } }
              setDone((ds) => ds.map((x) => (x.id === c.id ? n : x)))
              onSave(n)
            }
            return (
              <div key={c.id} className="panel">
                <b><WhoName id={c.id} name={c.name || 'Unnamed'} /></b> <span className="small muted">level {c.level}</span>
                {!checks.asi && !checks.spells && <div className="small muted">No ASI or new spells at this level. Features are the table’s call.</div>}
                {checks.asi && (
                  <label className="row small"><input type="checkbox" checked={!!tasks?.asi} onChange={() => toggle('asi')} /> Ability Score Improvement</label>
                )}
                {checks.feat && (
                  <label className="row small"><input type="checkbox" checked={!!tasks?.feat} onChange={() => toggle('feat')} /> Feat, if you take one instead of the ASI</label>
                )}
                {checks.spells && (
                  <label className="row small"><input type="checkbox" checked={!!tasks?.spells} onChange={() => toggle('spells')} /> New spells or cantrips</label>
                )}
              </div>
            )
          })}
          <button className="btn primary" onClick={onClose}>Done</button>
        </>
      )}
      {burst && createPortal(
        <div className="level-burst" role="status"><b>{burst}</b></div>,
        document.body,
      )}
    </Sheet>
  )
}
