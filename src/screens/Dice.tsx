import { useState } from 'react'
import type { DiceRoll } from '../types'
import { uid } from '../types'
import { fmtMod, rollDie, rollExpression } from '../dice'
import { Segmented, Stepper } from '../components/Sheet'

const DICE = [4, 6, 8, 10, 12, 20, 100]
type Mode = 'normal' | 'adv' | 'dis'
interface Shown { sides: number; value: number; dropped?: boolean }

export default function Dice({ history, setHistory }: { history: DiceRoll[]; setHistory: (f: (h: DiceRoll[]) => DiceRoll[]) => void }) {
  const [pool, setPool] = useState<Record<number, number>>({ 20: 1 })
  const [mod, setMod] = useState(0)
  const [mode, setMode] = useState<Mode>('normal')
  const [expr, setExpr] = useState('')
  const [shown, setShown] = useState<Shown[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [crit, setCrit] = useState<DiceRoll['crit']>()
  const [rollKey, setRollKey] = useState(0)
  const [rolling, setRolling] = useState(false)

  const poolLabel = () => {
    const parts = DICE.filter((d) => pool[d]).map((d) => `${pool[d]}d${d}`)
    return parts.join(' + ') + (mod ? ` ${mod > 0 ? '+' : '−'} ${Math.abs(mod)}` : '')
  }
  const add = (d: number) => setPool((p) => ({ ...p, [d]: Math.min(20, (p[d] ?? 0) + 1) }))
  const remove = (d: number) => setPool((p) => { const n = { ...p }; n[d] = (n[d] ?? 0) - 1; if (n[d] <= 0) delete n[d]; return n })

  const finish = (dice: Shown[], tot: number, label: string, detail: string) => {
    setRolling(true); setShown(dice); setRollKey((k) => k + 1); setTotal(null)
    navigator.vibrate?.([10, 30, 10])
    const kept20 = dice.filter((x) => x.sides === 20 && !x.dropped)
    const c: DiceRoll['crit'] = kept20.length === 1 && dice.every((x) => x.sides === 20) ? (kept20[0].value === 20 ? 'nat20' : kept20[0].value === 1 ? 'nat1' : undefined) : undefined
    setTimeout(() => {
      setTotal(tot); setCrit(c); setRolling(false)
      setHistory((h) => [{ id: uid(), label, total: tot, detail, time: Date.now(), crit: c }, ...h].slice(0, 50))
    }, 650)
  }

  const rollPool = () => {
    const dice: Shown[] = []
    let sum = 0
    const parts: string[] = []
    DICE.forEach((s) => {
      const n = pool[s] ?? 0
      const vals: string[] = []
      for (let i = 0; i < n; i++) {
        if (s === 20 && mode !== 'normal') {
          const a = rollDie(20), b = rollDie(20)
          const keep = mode === 'adv' ? Math.max(a, b) : Math.min(a, b)
          const drop = keep === a ? b : a
          dice.push({ sides: 20, value: keep }, { sides: 20, value: drop, dropped: true })
          sum += keep; vals.push(`${keep}(${drop})`)
        } else {
          const v = rollDie(s); dice.push({ sides: s, value: v }); sum += v; vals.push(String(v))
        }
      }
      if (n) parts.push(`${n}d${s}[${vals.join(',')}]`)
    })
    if (!dice.length) return
    sum += mod
    const label = poolLabel() + (mode === 'adv' && pool[20] ? ' (adv)' : mode === 'dis' && pool[20] ? ' (dis)' : '')
    finish(dice, sum, label, parts.join(' + ') + (mod ? ` ${fmtMod(mod)}` : ''))
  }

  const rollExpr = () => {
    const r = rollExpression(expr)
    if (!r.valid) { alert('Try something like 2d6+3 or 1d20+5'); return }
    finish(r.dice, r.total, expr, r.detail)
  }

  return (
    <div className="screen dice-screen">
      <div className="screen-head"><h1>Dice</h1></div>
      <div className={'dice-stage ' + (crit && !rolling ? crit : '')}>
        <div className="dice-tray" key={rollKey}>
          {shown.length === 0 && <div className="muted">Pick dice below and tap ROLL</div>}
          {shown.slice(0, 24).map((d, i) => (
            <div key={i} className={`die d${d.sides} ${d.dropped ? 'dropped' : ''} ${rolling ? 'tumble' : 'land'}`} style={{ animationDelay: `${i * 35}ms` }}>
              <span>{rolling ? '?' : d.value}</span><small>d{d.sides}</small>
            </div>
          ))}
        </div>
        <div className="dice-total">
          {total !== null && !rolling && <b key={rollKey} className="pop">{total}</b>}
          {crit === 'nat20' && !rolling && <div className="crit-text">NATURAL 20!</div>}
          {crit === 'nat1' && !rolling && <div className="crit-text bad">Natural 1…</div>}
        </div>
      </div>

      <div className="dice-grid">
        {DICE.map((d) => (
          <button key={d} className={'die-btn d' + d} onClick={() => add(d)}>
            <span className="die-shape">d{d}</span>
            {pool[d] ? <i className="count" onClick={(e) => { e.stopPropagation(); remove(d) }}>{pool[d]}</i> : null}
          </button>
        ))}
        <button className="die-btn clear" onClick={() => { setPool({}); setMod(0) }}><span className="die-shape">clear</span></button>
      </div>
      <div className="pool-line">{poolLabel() || <span className="muted">No dice selected</span>} <small className="muted">(tap a count bubble to remove one)</small></div>
      <div className="row">
        <Stepper label="Mod" value={mod} onChange={setMod} min={-20} max={30} />
        <Segmented value={mode} onChange={setMode} options={[{ value: 'dis', label: 'Dis' }, { value: 'normal', label: '—' }, { value: 'adv', label: 'Adv' }]} />
      </div>
      <button className="btn big primary roll-btn" disabled={!Object.keys(pool).length || rolling} onClick={rollPool}>ROLL {poolLabel()}</button>
      <div className="row">
        <input className="grow search" placeholder="Or type: 2d6+1d4+3" value={expr} onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rollExpr()} />
        <button className="btn" onClick={rollExpr} disabled={!expr.trim()}>Roll</button>
      </div>

      <div className="history">
        <div className="row between"><b>History</b>{history.length > 0 && <button className="link" onClick={() => setHistory(() => [])}>clear</button>}</div>
        {history.length === 0 && <div className="muted small">Your rolls will appear here.</div>}
        {history.map((h) => (
          <div key={h.id} className={'hist-row ' + (h.crit ?? '')}>
            <b>{h.total}</b>
            <div><div>{h.label}</div><small className="muted">{h.detail}</small></div>
            <small className="muted">{new Date(h.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
