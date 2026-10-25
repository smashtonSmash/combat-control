// Spellcasting: SRD slot tables + helpers. Spell data (src/data/spells.json) is loaded lazily so the main bundle stays small.
import type { Character, DamageType } from './types'
import { abilityMod } from './dice'

export interface SrdSpell {
  i: string; n: string; l: number; s: string; ct: string; r: string; c: string; d: string; conc: boolean; rit?: boolean
  desc: string; hl: string; cls: string[]; dt?: DamageType; dsl?: Record<string, string>; dcl?: Record<string, string>
  save?: string; atk?: string; heal?: Record<string, string>
}
let cache: SrdSpell[] | null = null
export async function loadSpells(): Promise<SrdSpell[]> {
  if (!cache) cache = (await import('./data/spells.json')).default as SrdSpell[]
  return cache
}

export type SpellEffect = 'none' | 'resistance' | 'buff'
/** A spell on a character sheet. SRD spells copy their data in so sheets work offline and sync as-is. */
export interface CharSpell {
  id: string
  srd?: string // SRD index, absent for custom spells
  name: string
  level: number
  school?: string
  castingTime?: string; range?: string; components?: string; duration?: string
  concentration: boolean
  description: string
  damage?: string // base dice at the spell's level (or cantrip at level 1)
  damageType?: DamageType
  slotDamage?: Record<string, string> // damage by slot level (SRD)
  charDamage?: Record<string, string> // cantrip damage by character level (SRD)
  save?: string
  attack?: boolean // spell attack roll
  effect?: SpellEffect
  effectType?: DamageType // resistance to …
  effectRounds?: number
  effectNote?: string
  prepared?: boolean
}

export interface Slots { max: number[]; used: number[]; pact?: boolean } // index 0 = 1st level … 8 = 9th

export const CASTER_CLASSES: Record<string, { kind: 'full' | 'half' | 'pact'; ability: 'int' | 'wis' | 'cha' }> = {
  wizard: { kind: 'full', ability: 'int' }, sorcerer: { kind: 'full', ability: 'cha' }, cleric: { kind: 'full', ability: 'wis' },
  druid: { kind: 'full', ability: 'wis' }, bard: { kind: 'full', ability: 'cha' }, warlock: { kind: 'pact', ability: 'cha' },
  paladin: { kind: 'half', ability: 'cha' }, ranger: { kind: 'half', ability: 'wis' },
  artificer: { kind: 'half', ability: 'int' },
}
export const casterInfo = (cls: string) => {
  const k = Object.keys(CASTER_CLASSES).find((x) => cls.toLowerCase().includes(x))
  return k ? { cls: k, ...CASTER_CLASSES[k] } : null
}

// SRD Spellcasting tables
const FULL: number[][] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
]
const HALF: number[][] = [
  [], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1],
  [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
]
// Warlock pact magic: [slots, slot level]
const PACT: [number, number][] = [
  [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5],
]
const pad = (a: number[]) => Array.from({ length: 9 }, (_, i) => a[i] ?? 0)
/** Artificer is a half caster that rounds up, so 1st level already has two 1st-level slots. */
const ARTIFICER: number[][] = [
  [2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
  [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
]

export function slotsFor(cls: string, level: number): Slots {
  const info = casterInfo(cls)
  const L = Math.min(20, Math.max(1, level)) - 1
  if (!info) return { max: pad([]), used: pad([]) }
  if (info.kind === 'pact') { const [n, lv] = PACT[L]; const m = pad([]); m[lv - 1] = n; return { max: m, used: pad([]), pact: true } }
  if (info.cls === 'artificer') return { max: pad(ARTIFICER[L]), used: pad([]) }
  return { max: pad((info.kind === 'full' ? FULL : HALF)[L]), used: pad([]) }
}

export const spellMod = (c: Character) => { const i = casterInfo(c.cls); return i ? abilityMod(c.abilities[i.ability]) : 0 }

/** Damage dice when cast with a given slot (or at the character's level for cantrips). */
export function damageFor(sp: CharSpell, slotLevel: number, charLevel: number): string | undefined {
  if (sp.level === 0 && sp.charDamage) {
    const keys = Object.keys(sp.charDamage).map(Number).sort((a, b) => a - b)
    const k = keys.filter((x) => x <= charLevel).pop() ?? keys[0]
    return sp.charDamage[String(k)]
  }
  if (sp.slotDamage) return sp.slotDamage[String(slotLevel)] ?? sp.slotDamage[String(sp.level)] ?? Object.values(sp.slotDamage)[0]
  return sp.damage
}

export function fromSrd(s: SrdSpell, id: string): CharSpell {
  const sp: CharSpell = {
    id, srd: s.i, name: s.n, level: s.l, school: s.s, castingTime: s.ct, range: s.r, components: s.c, duration: s.d,
    concentration: s.conc, description: s.desc + (s.hl ? '\n\nAt higher levels: ' + s.hl : ''),
    damageType: s.dt, slotDamage: s.dsl, charDamage: s.dcl, save: s.save, attack: !!s.atk,
  }
  // SRD spells that grant resistance
  if (s.i === 'protection-from-energy') Object.assign(sp, { effect: 'resistance', effectType: 'fire', effectRounds: 600, effectNote: 'Choose acid, cold, fire, lightning or thunder (concentration, up to 1 hour)' })
  if (s.i === 'stoneskin') Object.assign(sp, { effect: 'resistance', effectType: 'bludgeoning', effectRounds: 600, effectNote: 'Resistance to nonmagical bludgeoning, piercing and slashing' })
  return sp
}

/** Highest slot level available ≥ spell level. */
export const availableSlots = (slots: Slots | undefined, minLevel: number) =>
  slots ? slots.max.map((m, i) => ({ level: i + 1, left: m - (slots.used[i] ?? 0) })).filter((x) => x.level >= Math.max(1, minLevel) && x.left > 0) : []

export function spendSlot(slots: Slots, level: number): Slots | null {
  const i = level - 1
  if ((slots.max[i] ?? 0) - (slots.used[i] ?? 0) <= 0) return null
  const used = [...slots.used]; used[i] = (used[i] ?? 0) + 1
  return { ...slots, used }
}
/** Standard spell-scroll table: save DC and attack bonus by spell level (cantrips use the 1st-level row). */
export function scrollStats(level: number): { dc: number; attack: number } {
  if (level <= 2) return { dc: 13, attack: 5 }
  if (level <= 4) return { dc: 15, attack: 7 }
  if (level <= 6) return { dc: 17, attack: 9 }
  if (level <= 8) return { dc: 18, attack: 10 }
  return { dc: 19, attack: 11 }
}

export const restoreAll = (slots: Slots): Slots => ({ ...slots, used: pad([]) })
