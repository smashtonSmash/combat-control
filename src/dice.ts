export const rollDie = (sides: number) => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const a = new Uint32Array(1)
    crypto.getRandomValues(a)
    return (a[0] % sides) + 1
  }
  return Math.floor(Math.random() * sides) + 1
}

export interface RollResult {
  total: number
  detail: string
  valid: boolean
  dice: { sides: number; value: number }[]
}

/** Parse & roll expressions like "2d6+3", "1d8 + 1d4 - 1", "d20", "7". critical doubles the dice count. */
export function rollExpression(expr: string, critical = false): RollResult {
  const clean = expr.replace(/\s+/g, '').toLowerCase()
  if (!clean) return { total: 0, detail: '', valid: false, dice: [] }
  const terms = clean.match(/[+-]?[^+-]+/g)
  if (!terms) return { total: 0, detail: '', valid: false, dice: [] }
  let total = 0
  const parts: string[] = []
  const dice: { sides: number; value: number }[] = []
  for (const t of terms) {
    const sign = t.startsWith('-') ? -1 : 1
    const body = t.replace(/^[+-]/, '')
    const m = body.match(/^(\d*)d(\d+)$/)
    if (m) {
      let n = m[1] ? parseInt(m[1]) : 1
      const s = parseInt(m[2])
      if (!s || n > 100) return { total: 0, detail: '', valid: false, dice: [] }
      if (critical) n *= 2
      const vals = Array.from({ length: n }, () => rollDie(s))
      vals.forEach((v) => dice.push({ sides: s, value: v }))
      const sum = vals.reduce((a, b) => a + b, 0)
      total += sign * sum
      parts.push(`${sign < 0 ? '−' : parts.length ? '+' : ''}${n}d${s}[${vals.join(',')}]`)
    } else if (/^\d+$/.test(body)) {
      total += sign * parseInt(body)
      parts.push(`${sign < 0 ? '−' : parts.length ? '+' : ''}${body}`)
    } else {
      return { total: 0, detail: '', valid: false, dice: [] }
    }
  }
  return { total, detail: parts.join(' '), valid: true, dice }
}

export const fmtMod = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
export const abilityMod = (score: number) => Math.floor((score - 10) / 2)
