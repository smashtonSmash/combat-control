// Homebrew armor catalog + rarity tiers. Add medium/heavy armor by appending to ARMOR_CATALOG.
import type { DamageType } from './types'

export const TIERS = ['green', 'blue', 'purple', 'mythic'] as const
export type Tier = (typeof TIERS)[number]

/** Mythic color is TBD — change it here and it updates everywhere. */
export const MYTHIC_COLOR = '#f08a2a'
export const TIER_COLORS: Record<Tier, string> = { green: '#4fbf63', blue: '#4a8fe7', purple: '#a35de0', mythic: MYTHIC_COLOR }
export const TIER_LABELS: Record<Tier, string> = { green: 'Green · Standard', blue: 'Blue · Rare', purple: 'Purple · Ultra rare', mythic: 'Mythic' }
export const TIER_SHORT: Record<Tier, string> = { green: 'Green', blue: 'Blue', purple: 'Purple', mythic: 'Mythic' }

export type ArmorCategory = 'light' | 'medium' | 'heavy'

export type ArmorEffect =
  | { kind: 'reduce'; type: DamageType; amount: number | 'prof'; replaces?: boolean }
  | { kind: 'acVs'; types: DamageType[]; amount: number }
  | { kind: 'deflectD6' }      // piercing hit: d6, on 6 no damage
  | { kind: 'shrugOff' }       // once per day: ignore one hit
  | { kind: 'underLayer'; ac: number } // may be worn under medium/heavy armor, +AC to that armor
  | { kind: 'note'; text: string }
  | { kind: 'dropDeflect' }     // removes an earlier tier's d6 deflect

export interface ArmorDef {
  id: string
  name: string
  category: ArmorCategory
  /** AC formula: base + Dex (light: full Dex; medium: Dex max 2; heavy: no Dex) */
  baseAc: number
  dexCap: number | null // null = unlimited, 0 = no Dex
  stealthDisadvantage: boolean
  focus: string // e.g. 'bludgeoning armor'
  allTiers: string[] // notes that apply at every tier
  tiers: Record<Tier, ArmorEffect[]> // each tier stacks on top of earlier tiers
}

export const ARMOR_CATALOG: ArmorDef[] = [
  {
    id: 'padded', name: 'Padded', category: 'light', baseAc: 11, dexCap: null, stealthDisadvantage: false,
    focus: 'bludgeoning armor',
    allTiers: ['No stealth disadvantage', 'Can be slept in with no penalty', 'Protects against cold'],
    tiers: {
      green: [{ kind: 'reduce', type: 'bludgeoning', amount: 1 }],
      blue: [{ kind: 'reduce', type: 'bludgeoning', amount: 'prof', replaces: true }],
      purple: [{ kind: 'acVs', types: ['bludgeoning'], amount: 1 }],
      mythic: [{ kind: 'underLayer', ac: 1 }],
    },
  },
  {
    id: 'leather', name: 'Leather', category: 'light', baseAc: 11, dexCap: null, stealthDisadvantage: false,
    focus: 'slashing armor', allTiers: ['No stealth disadvantage', 'Cannot be worn under other armor'],
    tiers: {
      green: [{ kind: 'reduce', type: 'slashing', amount: 1 }],
      blue: [{ kind: 'reduce', type: 'slashing', amount: 'prof', replaces: true }],
      purple: [{ kind: 'acVs', types: ['slashing'], amount: 1 }],
      mythic: [{ kind: 'shrugOff' }],
    },
  },
  {
    id: 'studded', name: 'Studded Leather', category: 'light', baseAc: 11, dexCap: null, stealthDisadvantage: false,
    focus: 'piercing armor', allTiers: ['No stealth disadvantage'],
    tiers: {
      green: [{ kind: 'reduce', type: 'piercing', amount: 1 }],
      blue: [{ kind: 'acVs', types: ['piercing'], amount: 1 }],
      // Rule text says "+1 AC vs piercing" again at Purple; read as the same +1 restated (not stacking to +2) — see Mythic "+2 total".
      purple: [{ kind: 'deflectD6' }],
      // DM ruling: Mythic does NOT keep Purple's d6 deflect. Blue +1 piercing + this = +2 vs piercing total.
      mythic: [{ kind: 'acVs', types: ['slashing', 'piercing', 'bludgeoning'], amount: 1 }, { kind: 'dropDeflect' }],
    },
  },
]

export const armorById = (id?: string | null) => ARMOR_CATALOG.find((a) => a.id === id)

export const profFromLevel = (lvl: number) => Math.min(6, Math.max(2, 2 + Math.floor((Math.max(1, lvl) - 1) / 4)))

export interface ResolvedArmor {
  reduce: Partial<Record<DamageType, number>>
  acVs: Partial<Record<DamageType, number>>
  deflectD6: boolean
  shrugOff: boolean
  underLayerAc: number
  lines: string[] // human-readable list of active effects
  notes: string[]
}

export function resolveArmor(def: ArmorDef | undefined, tier: Tier | undefined, prof: number): ResolvedArmor {
  const r: ResolvedArmor = { reduce: {}, acVs: {}, deflectD6: false, shrugOff: false, underLayerAc: 0, lines: [], notes: [] }
  if (!def || !tier) return r
  r.notes = [...def.allTiers]
  for (const t of TIERS.slice(0, TIERS.indexOf(tier) + 1)) {
    for (const e of def.tiers[t]) {
      if (e.kind === 'reduce') {
        const n = e.amount === 'prof' ? prof : e.amount
        r.reduce[e.type] = e.replaces ? n : (r.reduce[e.type] ?? 0) + n
      } else if (e.kind === 'acVs') for (const ty of e.types) r.acVs[ty] = (r.acVs[ty] ?? 0) + e.amount
      else if (e.kind === 'deflectD6') r.deflectD6 = true
      else if (e.kind === 'dropDeflect') r.deflectD6 = false
      else if (e.kind === 'shrugOff') r.shrugOff = true
      else if (e.kind === 'underLayer') r.underLayerAc += e.ac
      else r.notes.push(e.text)
    }
  }
  for (const [ty, n] of Object.entries(r.reduce)) r.lines.push(`−${n} ${ty} damage taken`)
  for (const [ty, n] of Object.entries(r.acVs)) r.lines.push(`+${n} AC vs ${ty}`)
  if (r.deflectD6) r.lines.push('d6 deflect on piercing hits (6 = no damage)')
  if (r.shrugOff) r.lines.push('Shrug Off: ignore one hit per day (resets on long rest)')
  if (r.underLayerAc) r.lines.push(`Can be worn under medium/heavy armor (+${r.underLayerAc} AC)`)
  return r
}

export function canBeUnderLayer(id?: string, tier?: Tier) {
  return !!armorById(id) && !!tier && resolveArmor(armorById(id), tier, 2).underLayerAc > 0
}

/** Equipped armor as stored on a character / combatant (all optional so old saves still load). */
export interface ArmorFields {
  armorId?: string
  armorTier?: Tier
  underId?: string
  underTier?: Tier
  prof?: number
}

/** Combined effects of main armor + optional under-layer. */
export function combinedArmor(f: ArmorFields): ResolvedArmor {
  const prof = f.prof ?? 2
  const main = resolveArmor(armorById(f.armorId), f.armorTier, prof)
  const mainDef = armorById(f.armorId)
  if (!mainDef || mainDef.category === 'light' || !canBeUnderLayer(f.underId, f.underTier)) return main
  const under = resolveArmor(armorById(f.underId), f.underTier, prof)
  const out: ResolvedArmor = { ...main, reduce: { ...main.reduce }, acVs: { ...main.acVs }, lines: [...main.lines], notes: [...main.notes] }
  for (const [ty, n] of Object.entries(under.reduce)) out.reduce[ty as DamageType] = Math.max(out.reduce[ty as DamageType] ?? 0, n!)
  for (const [ty, n] of Object.entries(under.acVs)) out.acVs[ty as DamageType] = (out.acVs[ty as DamageType] ?? 0) + n!
  out.lines.push(...under.lines.filter((l) => !l.startsWith('Can be worn')).map((l) => `Under-layer: ${l}`), `Under-layer: +${under.underLayerAc} AC`)
  return out
}

export function armorAc(f: ArmorFields, dexMod: number): number | null {
  const def = armorById(f.armorId)
  if (!def) return null
  const dex = def.dexCap === null ? dexMod : Math.min(dexMod, def.dexCap)
  let ac = def.baseAc + dex
  if (def.category !== 'light' && canBeUnderLayer(f.underId, f.underTier)) ac += resolveArmor(armorById(f.underId), f.underTier, 2).underLayerAc
  return ac
}

export const armorLabel = (f: ArmorFields) => {
  const def = armorById(f.armorId)
  if (!def) return ''
  const u = def.category !== 'light' && canBeUnderLayer(f.underId, f.underTier) ? ` + ${TIER_SHORT[f.underTier!]} ${armorById(f.underId)!.name} under-layer` : ''
  return `${f.armorTier ? TIER_SHORT[f.armorTier] + ' ' : ''}${def.name} Armor${u}`
}
