import { useEffect, useRef, useState } from 'react'
import type { Abilities, Character } from '../types'
import { ABIL_KEYS, ABIL_NAMES, totalBonus, type AbilKey } from '../origins'
import { PB_MAX, PB_MIN, POINT_BUY_BUDGET, POINT_COST, canLower, canRaise, pointsLeft, rollSet, type Roll4d6 } from '../abilityGen'
import { abilityMod, fmtMod } from '../dice'

type Method = 'manual' | 'roll' | 'physical' | 'pointbuy'
export interface GenState { method: Method; rolls?: Roll4d6[]; physical?: number[]; assign?: Partial<Record<AbilKey, number>>; locked?: boolean }

/** Method picker for base ability scores. Bonuses are shown separately on top. */
export function AbilityGenerator({ d, setBase, allowReroll = true }: { d: Character; setBase: (base: Abilities, gen: GenState) => void; allowReroll?: boolean }) {
  const gen: GenState = d.abilityGen ?? { method: 'manual' }
  const base = d.baseAbilities ?? d.abilities
  const bonus = totalBonus(d)
  const [rolling, setRolling] = useState(false)
  const [sel, setSel] = useState<number | null>(null)
  const drag = useRef<{ i: number; el: HTMLElement | null } | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number; v: number } | null>(null)
  const setGen = (g: Partial<GenState>, b: Abilities = base) => setBase(b, { ...gen, ...g })
  const pool: number[] = gen.method === 'roll' ? (gen.rolls ?? []).map((r) => r.total) : gen.method === 'physical' ? (gen.physical ?? []) : []
  const assign = gen.assign ?? {}
  const used = new Set(Object.values(assign))
  const put = (k: AbilKey, i: number) => {
    const a: Partial<Record<AbilKey, number>> = { ...assign }
    for (const kk of ABIL_KEYS) if (a[kk] === i) delete a[kk]
    a[k] = i
    const b = { ...base }; for (const kk of ABIL_KEYS) if (a[kk] !== undefined) b[kk] = pool[a[kk]!]
    const all = ABIL_KEYS.every((kk) => a[kk] !== undefined)
    setGen({ assign: a, locked: gen.method === 'roll' ? all || gen.locked : false }, b); setSel(null)
  }
  const doRoll = () => { setRolling(true); setTimeout(() => setRolling(false), 900); setGen({ rolls: rollSet(), assign: {}, locked: false }) }
  const canReroll = gen.method === 'roll' && (gen.rolls?.length ?? 0) > 0 && allowReroll && !gen.locked
  useEffect(() => {
    const up = (e: PointerEvent) => {
      const dd = drag.current; drag.current = null; setGhost(null)
      if (!dd) return
      const t = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('[data-stat]') as HTMLElement | null
      if (t) put(t.dataset.stat as AbilKey, dd.i)
    }
    const mv = (e: PointerEvent) => { if (drag.current) setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g)) }
    window.addEventListener('pointerup', up); window.addEventListener('pointermove', mv)
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointermove', mv) }
  })
  const pbScores = ABIL_KEYS.map((k) => base[k])
  const pbOk = pbScores.every((v) => v >= PB_MIN && v <= PB_MAX)
  return (
    <div className="panel abil-gen">
      <div className="segmented four">
        {([['manual', '✍ Manual'], ['roll', '🎲 Roll 4d6'], ['physical', '🎯 Physical dice'], ['pointbuy', '🧮 Point buy']] as [Method, string][]).map(([m, l]) => (
          <button key={m} type="button" className={gen.method === m ? 'on' : ''} onClick={() => {
            if (m === 'pointbuy') setGen({ method: m, assign: {} }, { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })
            else setGen({ method: m, assign: {} })
          }}>{l}</button>
        ))}
      </div>
      {gen.method === 'roll' && (
        <>
          {!(gen.rolls?.length) ? <button className="btn primary" onClick={doRoll}>🎲 Roll 4d6 × 6 (drop lowest)</button> : (
            <div className="roll-sets">
              {gen.rolls!.map((r, i) => (
                <button key={i} type="button" className={`roll-set ${rolling ? 'rolling' : ''} ${sel === i ? 'sel' : ''} ${used.has(i) ? 'used' : ''}`} style={{ ['--i' as string]: i }}
                  onClick={() => setSel(sel === i ? null : i)} onPointerDown={(e) => { drag.current = { i, el: e.currentTarget }; setGhost({ x: e.clientX, y: e.clientY, v: r.total }) }} aria-label={`Roll ${i + 1}: ${r.total}`}>
                  <span className="dice-row">{r.dice.map((v, j) => <i key={j} className={'die ' + (j === r.drop ? 'dropped' : '')} style={{ ['--j' as string]: j }}>{v}</i>)}</span>
                  <b>{r.total}</b>
                </button>
              ))}
            </div>
          )}
          {(gen.rolls?.length ?? 0) > 0 && (
            <div className="row between small">
              <span className="muted">Tap a result, then tap a stat (or drag it onto the stat).</span>
              {canReroll ? <button className="btn sm" onClick={doRoll}>↻ Reroll all</button> : <span className="muted">{!allowReroll ? 'Rerolls off (DM)' : 'Assigned — rerolls locked'}</span>}
            </div>
          )}
        </>
      )}
      {gen.method === 'physical' && (
        <>
          <div className="small muted">Roll 4d6 at the table, drop the lowest, and type each total (3–18).</div>
          <div className="phys-grid">{Array.from({ length: 6 }, (_, i) => (
            <input key={i} aria-label={`Physical roll ${i + 1}`} inputMode="numeric" value={gen.physical?.[i] ?? ''} placeholder="—"
              onChange={(e) => { const p = [...(gen.physical ?? Array(6).fill(0))]; p[i] = Math.max(0, Math.min(18, parseInt(e.target.value) || 0)); setGen({ physical: p }) }} />
          ))}</div>
          {(gen.physical ?? []).filter((v) => v >= 3).length === 6 && (
            <div className="roll-sets">{gen.physical!.map((v, i) => (
              <button key={i} type="button" className={`roll-set ${sel === i ? 'sel' : ''} ${used.has(i) ? 'used' : ''}`} onClick={() => setSel(sel === i ? null : i)}
                onPointerDown={(e) => { drag.current = { i, el: e.currentTarget }; setGhost({ x: e.clientX, y: e.clientY, v }) }}><b>{v}</b></button>
            ))}</div>
          )}
        </>
      )}
      {gen.method === 'pointbuy' && (
        <div className="row between"><span className="small">Point buy: scores {PB_MIN}–{PB_MAX}, costs {Object.entries(POINT_COST).map(([s, c]) => `${s}=${c}`).join(' ')}</span>
          <b className={'pb-left ' + (pointsLeft(pbScores) < 0 || !pbOk ? 'bad' : '')}>{pbOk ? pointsLeft(pbScores) : '?'} / {POINT_BUY_BUDGET} left</b></div>
      )}
      <div className="gen-stats">
        {ABIL_KEYS.map((k, i) => {
          const b = bonus[k] ?? 0
          return (
            <div key={k} data-stat={k} className={'gen-stat ' + (sel !== null && pool.length ? 'target' : '')} onClick={() => sel !== null && put(k, sel)} title={ABIL_NAMES[k]}>
              <span>{k.toUpperCase()}</span>
              {gen.method === 'pointbuy' ? (
                <div className="alloc-btns">
                  <button type="button" aria-label={`Lower ${k}`} disabled={!pbOk || !canLower(pbScores, i)} onClick={() => setGen({}, { ...base, [k]: base[k] - 1 })}>−</button>
                  <b>{base[k]}</b>
                  <button type="button" aria-label={`Raise ${k}`} disabled={!pbOk || !canRaise(pbScores, i)} onClick={() => setGen({}, { ...base, [k]: base[k] + 1 })}>＋</button>
                </div>
              ) : gen.method === 'manual' ? (
                <input inputMode="numeric" aria-label={`${k} base score`} value={String(base[k])} onChange={(e) => setGen({}, { ...base, [k]: parseInt(e.target.value) || 0 })} />
              ) : <b className={assign[k] === undefined ? 'muted' : ''}>{assign[k] === undefined ? '—' : base[k]}</b>}
              <small className="gen-bonus">{b ? <span className="gold">+{b} → {base[k] + b}</span> : <span className="muted">no bonus</span>}</small>
              <em>{fmtMod(abilityMod(base[k] + b))}</em>
            </div>
          )
        })}
      </div>
      {ghost && <div className="roll-ghost" style={{ left: ghost.x, top: ghost.y }}>{ghost.v}</div>}
    </div>
  )
}
