// Level-up math. The hit die is resolved three ways; ASI, feats, and new spells are a checklist, not an auto-pick.
import type { Character } from './types'
import { casterInfo, slotsFor } from './spells'

/** Fixed average: d6 → 4, d8 → 5, d10 → 6, d12 → 7. */
export function hitDieAverage(sides: number): number {
  const n = Math.max(2, Math.floor(sides))
  return Math.floor(n / 2) + 1
}

/** Die result plus Constitution, at least 1. */
export function hpGain(die: number, conScore: number): number {
  const con = Math.floor((conScore - 10) / 2)
  return Math.max(1, Math.floor(die) + con)
}

export function asiAt(cls: string, level: number): boolean {
  const n = cls.toLowerCase()
  const extra = n.includes('fighter') ? [6, 14] : n.includes('rogue') ? [10] : []
  return [4, 8, 12, 16, 19, ...extra].includes(level)
}

export function levelChecklist(c: Pick<Character, 'cls'>, level: number): { asi: boolean; feat: boolean; spells: boolean } {
  const asi = asiAt(c.cls, level)
  return { asi, feat: asi, spells: !!casterInfo(c.cls) }
}

export function applyLevelUp(c: Character, die: number): Character {
  if ((c.level || 1) >= 20) return c
  const gain = hpGain(die, c.abilities.con)
  const level = (c.level || 1) + 1
  const checks = levelChecklist(c, level)
  let next: Character = {
    ...c,
    level,
    maxHp: c.maxHp + gain,
    currentHp: (c.currentHp ?? c.maxHp) + gain,
    levelTasks: {
      level,
      ...(checks.asi ? { asi: false, feat: false } : {}),
      ...(checks.spells ? { spells: false } : {}),
    },
  }
  if (!c.slotsManual && casterInfo(c.cls)) {
    const fresh = slotsFor(c.cls, level)
    const used = fresh.max.map((m, i) => Math.min(m, c.slots?.used[i] ?? 0))
    next = { ...next, slots: { ...fresh, used } }
  }
  return next
}
