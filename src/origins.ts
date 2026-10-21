import srd from './data/srd.json'
import type { Abilities, Character } from './types'
import { uid } from './types'

export type AbilKey = keyof Abilities
export const ABIL_KEYS: AbilKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']
export const ABIL_NAMES: Record<AbilKey, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
export type Bonus = Partial<Record<AbilKey, number>>
export interface Feature { id: string; name: string; desc: string; source: 'race' | 'class' | 'background' | 'custom' }

export interface RaceDef { key: string; name: string; srd: boolean; speed?: number; bonuses?: Bonus; bonusChoice?: { choose: number; amount: number }; languages?: string[]; traits: { name: string; desc: string }[]; subraces?: { key: string; name: string; bonuses: Bonus; traits: { name: string; desc: string }[] }[] }
export interface ClassDef { key: string; name: string; srd: boolean; hitDie: number; saves: AbilKey[]; proficiencies: string[]; skillChoice?: { choose: number; from: string[] }; features: { name: string; desc: string }[]; spellcasting?: string }
export interface BgDef { key: string; name: string; srd: boolean; skills: string[]; feature?: { name: string; desc: string } }

/* SRD data (bundled). Non-SRD entries are names + game facts only (no book text); their traits are left for the player to fill in. */
const NON_SRD_RACES = ['Aarakocra', 'Aasimar', 'Bugbear', 'Centaur', 'Changeling', 'Firbolg', 'Genasi', 'Gith', 'Goblin', 'Goliath', 'Hobgoblin', 'Kenku', 'Kobold', 'Lizardfolk', 'Minotaur', 'Orc', 'Satyr', 'Shifter', 'Tabaxi', 'Tortle', 'Triton', 'Warforged', 'Yuan-ti']
const NON_SRD_CLASSES: Omit<ClassDef, 'srd' | 'features' | 'proficiencies'>[] = [{ key: 'artificer', name: 'Artificer', hitDie: 8, saves: ['con', 'int'] }]
const NON_SRD_BGS: [string, string[]][] = [
  ['Charlatan', ['Deception', 'Sleight of Hand']], ['Criminal', ['Deception', 'Stealth']], ['Entertainer', ['Acrobatics', 'Performance']],
  ['Folk Hero', ['Animal Handling', 'Survival']], ['Guild Artisan', ['Insight', 'Persuasion']], ['Hermit', ['Medicine', 'Religion']],
  ['Noble', ['History', 'Persuasion']], ['Outlander', ['Athletics', 'Survival']], ['Sage', ['Arcana', 'History']], ['Sailor', ['Athletics', 'Perception']],
  ['Soldier', ['Athletics', 'Intimidation']], ['Urchin', ['Sleight of Hand', 'Stealth']], ['Far Traveler', ['Insight', 'Perception']],
  ['Haunted One', ['Investigation', 'Survival']], ['City Watch', ['Athletics', 'Insight']], ['Clan Crafter', ['History', 'Insight']],
]
const slug = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '-')

export const RACES: RaceDef[] = [
  ...srd.races.map((r) => ({ ...r, srd: true, bonuses: r.bonuses as Bonus, subraces: r.subraces.map((s) => ({ ...s, bonuses: s.bonuses as Bonus })) })),
  ...NON_SRD_RACES.map((n) => ({ key: slug(n), name: n, srd: false, traits: [] })),
].sort((a, b) => a.name.localeCompare(b.name))
export const CLASSES: ClassDef[] = [
  ...srd.classes.map((c) => ({ ...c, srd: true, saves: c.saves as AbilKey[] })),
  ...NON_SRD_CLASSES.map((c) => ({ ...c, srd: false, features: [], proficiencies: [] })),
].sort((a, b) => a.name.localeCompare(b.name))
export const BACKGROUNDS: BgDef[] = [
  ...srd.backgrounds.map((b) => ({ ...b, srd: true })),
  ...NON_SRD_BGS.map(([n, skills]) => ({ key: slug(n), name: n, srd: false, skills })),
].sort((a, b) => a.name.localeCompare(b.name))

export const SKILLS: [string, AbilKey][] = [
  ['Acrobatics', 'dex'], ['Animal Handling', 'wis'], ['Arcana', 'int'], ['Athletics', 'str'], ['Deception', 'cha'], ['History', 'int'],
  ['Insight', 'wis'], ['Intimidation', 'cha'], ['Investigation', 'int'], ['Medicine', 'wis'], ['Nature', 'int'], ['Perception', 'wis'],
  ['Performance', 'cha'], ['Persuasion', 'cha'], ['Religion', 'int'], ['Sleight of Hand', 'dex'], ['Stealth', 'dex'], ['Survival', 'wis'],
]

export const raceDef = (k?: string) => RACES.find((r) => r.key === k)
export const classDef = (k?: string) => CLASSES.find((c) => c.key === k)
export const bgDef = (k?: string) => BACKGROUNDS.find((b) => b.key === k)

/** Bonuses granted by an SRD race (+ subrace). Flexible picks (e.g. Half-Elf, non-SRD, Custom) come from origin.raceBonus. */
export function fixedRaceBonus(c: Character): Bonus {
  const r = raceDef(c.origin?.raceKey)
  if (!r?.srd) return {}
  const sub = r.subraces?.find((s) => s.key === c.origin?.subraceKey)
  const out: Bonus = { ...r.bonuses }
  for (const [k, v] of Object.entries(sub?.bonuses ?? {})) out[k as AbilKey] = (out[k as AbilKey] ?? 0) + (v ?? 0)
  return out
}
/** How many free points the race/background allocator gives. */
export function raceBudget(c: Character, customBudget: number): { total: number; maxEach: number; amount?: number } | null {
  const k = c.origin?.raceKey
  if (!k) return null
  const r = raceDef(k)
  if (r?.srd) return r.bonusChoice ? { total: r.bonusChoice.choose, maxEach: 1 } : null
  return { total: customBudget, maxEach: 2 } // custom or non-SRD: flexible origin
}
export function bgBudget(c: Character, customBudget: number) {
  return c.origin?.bgKey === 'custom' ? { total: customBudget, maxEach: 2 } : null
}
export const sumBonus = (b?: Bonus) => Object.values(b ?? {}).reduce((s: number, v) => s + (v ?? 0), 0)
export function validBonus(b: Bonus | undefined, budget: { total: number; maxEach: number }) {
  return sumBonus(b) <= budget.total && Object.values(b ?? {}).every((v) => (v ?? 0) >= 0 && (v ?? 0) <= budget.maxEach)
}
/** All ability bonuses on the character. */
export function totalBonus(c: Character): Bonus {
  const out: Bonus = {}
  for (const b of [fixedRaceBonus(c), c.origin?.raceBonus ?? {}, c.origin?.bgBonus ?? {}])
    for (const [k, v] of Object.entries(b)) out[k as AbilKey] = (out[k as AbilKey] ?? 0) + (v ?? 0)
  return out
}
/** Base (pre-bonus) scores. Old characters have no base → their scores are treated as base with no bonuses. */
export const baseAbilities = (c: Character): Abilities => c.baseAbilities ?? c.abilities
/** Recompute final ability scores from base + bonuses. */
export function applyBonuses(c: Character): Character {
  const base = baseAbilities(c), b = totalBonus(c)
  const abilities = Object.fromEntries(ABIL_KEYS.map((k) => [k, base[k] + (b[k] ?? 0)])) as unknown as Abilities
  return { ...c, baseAbilities: base, abilities }
}
const feat = (f: { name: string; desc: string }, source: Feature['source']): Feature => ({ id: uid(), name: f.name, desc: f.desc, source })
/** Replace features from one source with a new list (keeps the player's custom ones). */
const swapFeatures = (c: Character, source: Feature['source'], list: Feature[]) => [...(c.features ?? []).filter((f) => f.source !== source), ...list]

export function chooseRace(c: Character, key: string, subKey?: string): Character {
  const r = raceDef(key)
  const sub = r?.subraces?.find((s) => s.key === (subKey ?? r.subraces?.[0]?.key))
  const n: Character = { ...c, race: key === 'custom' ? c.origin?.raceKey === 'custom' ? c.race : '' : sub ? sub.name : r?.name ?? c.race,
    origin: { ...c.origin, raceKey: key, subraceKey: sub?.key, raceBonus: c.origin?.raceKey === key ? c.origin?.raceBonus : {} },
    speed: r?.speed ?? c.speed ?? 30,
    features: swapFeatures(c, 'race', key === 'custom' ? (c.features ?? []).filter((f) => f.source === 'race') : [...(r?.traits ?? []), ...(sub?.traits ?? [])].map((t) => feat(t, 'race'))) }
  return applyBonuses(n)
}
export function chooseClass(c: Character, key: string): Character {
  const k = classDef(key)
  if (!k) return { ...c, origin: { ...c.origin, classKey: key }, cls: key === 'custom' ? (c.origin?.classKey === 'custom' ? c.cls : '') : c.cls }
  return { ...c, cls: k.name, origin: { ...c.origin, classKey: key }, hitDie: k.hitDie, saves: k.saves, proficiencies: k.proficiencies,
    skills: (c.skills ?? []).filter((s) => !k.skillChoice || k.skillChoice.from.includes(s) || bgDef(c.origin?.bgKey)?.skills.includes(s)),
    features: swapFeatures(c, 'class', k.features.map((f) => feat(f, 'class'))) }
}
export function chooseBackground(c: Character, key: string): Character {
  const b = bgDef(key), old = bgDef(c.origin?.bgKey)
  const skills = [...new Set([...(c.skills ?? []).filter((s) => !old?.skills.includes(s)), ...(b?.skills ?? [])])]
  const n: Character = { ...c, background: key === 'custom' ? (c.origin?.bgKey === 'custom' ? c.background : '') : b?.name ?? '', skills,
    origin: { ...c.origin, bgKey: key, bgBonus: key === 'custom' ? c.origin?.bgBonus ?? {} : {} },
    features: swapFeatures(c, 'background', b ? [feat(b.feature ?? { name: `${b.name} feature`, desc: '' }, 'background')] : (c.features ?? []).filter((f) => f.source === 'background')) }
  return applyBonuses(n)
}
export const conMod = (c: Character) => Math.floor((c.abilities.con - 10) / 2)
/** Level-1 HP: max hit die + CON; later levels use the average (die/2+1) + CON. */
export function suggestedHp(c: Character): number | null {
  if (!c.hitDie) return null
  const lv = Math.max(1, c.level || 1)
  return Math.max(1, c.hitDie + conMod(c) + (lv - 1) * (c.hitDie / 2 + 1 + conMod(c)))
}
export const skillMod = (c: Character, skill: string, prof: number) => {
  const ab = SKILLS.find((s) => s[0] === skill)?.[1] ?? 'str'
  return Math.floor((c.abilities[ab] - 10) / 2) + ((c.skills ?? []).includes(skill) ? prof : 0)
}
export const saveMod = (c: Character, k: AbilKey, prof: number) => Math.floor((c.abilities[k] - 10) / 2) + ((c.saves ?? []).includes(k) ? prof : 0)
