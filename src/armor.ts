// Homebrew armor catalog + rarity tiers. Add medium/heavy armor by appending to ARMOR_CATALOG.
import type { DamageType } from './types'

export const TIERS = ['green', 'blue', 'purple', 'legendary', 'mythic'] as const
export type Tier = (typeof TIERS)[number]

/** Tier colors — change here and they update everywhere. */
export const LEGENDARY_COLOR = '#f08a2a'
export const MYTHIC_COLOR = '#e5383b'
export const TIER_COLORS: Record<Tier, string> = { green: '#4fbf63', blue: '#4a8fe7', purple: '#a35de0', legendary: LEGENDARY_COLOR, mythic: MYTHIC_COLOR }
/** Display names (ids stay green/blue/purple/legendary/mythic in saved data). */
export const TIER_LABELS: Record<Tier, string> = { green: 'Common', blue: 'Rare', purple: 'Ultra Rare', legendary: 'Legendary', mythic: 'Mythic' }
export const TIER_SHORT: Record<Tier, string> = { green: 'Common', blue: 'Rare', purple: 'Ultra Rare', legendary: 'Legendary', mythic: 'Mythic' }
/** Old display names in stored text → new ones ('Purple Padded Armor' → 'Ultra Rare Padded Armor'). Idempotent. */
const OLD_TIER_NAMES: Record<string, string> = { Green: 'Common', Blue: 'Rare', Purple: 'Ultra Rare' }
export const renameTierText = (s: string) => s.replace(/\b(Green|Blue|Purple)(?= [A-Z])/g, (m) => OLD_TIER_NAMES[m])

/** Data version: v2 = tier 'mythic' means the new red top tier. Older data's 'mythic' is now 'legendary'. */
export const TIER_VERSION = 2
export function migrateTiers<T extends ArmorFields>(x: T): T {
  if (!x || x.tierV === TIER_VERSION) return x
  const fix = (t?: Tier) => ((t as string) === 'mythic' ? 'legendary' : t)
  return { ...x, armorTier: fix(x.armorTier), underTier: fix(x.underTier), tierV: TIER_VERSION,
    ...('armor' in x && typeof (x as { armor?: unknown }).armor === 'string' ? { armor: ((x as unknown as { armor: string }).armor).replace(/^Mythic /, 'Legendary ') } : {}) }
}

export type ArmorCategory = 'light' | 'medium' | 'heavy'

export type ArmorEffect =
  | { kind: 'reduce'; type: DamageType; amount: number | 'prof'; replaces?: boolean }
  | { kind: 'acVs'; types: DamageType[]; amount: number; notUnder?: boolean } // notUnder: ignored when worn as an under-layer
  | { kind: 'deflectD6' }      // piercing hit: d6, on 6 no damage
  | { kind: 'shrugOff' }       // once per day: ignore one hit
  | { kind: 'underLayer'; ac: number; vs?: Partial<Record<DamageType, number>>; onlyAc?: boolean } // worn under medium/heavy: +ac to that armor (+ extra per type); onlyAc = no other effects underneath; later tiers replace earlier
  | { kind: 'resetAc' }         // flat AC tier: drop all earlier tiers' AC-vs-type bonuses
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
  /** optional per-armor price multiplier (overrides ARMOR_PRICE_MULTIPLIER in catalog.ts) */
  priceMultiplier?: number
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
      legendary: [{ kind: 'underLayer', ac: 1 }],
      // Mythic AC is flat (replaces lower tiers' AC bonuses). Underneath: +2 vs bludgeoning, +1 vs everything else, AC only.
      mythic: [{ kind: 'resetAc' }, { kind: 'acVs', types: ['bludgeoning'], amount: 3, notUnder: true }, { kind: 'acVs', types: ['slashing', 'piercing'], amount: -1, notUnder: true },
        { kind: 'underLayer', ac: 1, vs: { bludgeoning: 1 }, onlyAc: true }],
    },
  },
  {
    id: 'leather', name: 'Leather', category: 'light', baseAc: 11, dexCap: null, stealthDisadvantage: false,
    focus: 'slashing armor', allTiers: ['No stealth disadvantage', 'Cannot be worn under other armor'],
    tiers: {
      green: [{ kind: 'reduce', type: 'slashing', amount: 1 }],
      blue: [{ kind: 'reduce', type: 'slashing', amount: 'prof', replaces: true }],
      purple: [{ kind: 'acVs', types: ['slashing'], amount: 1 }],
      legendary: [{ kind: 'shrugOff' }],
      mythic: [{ kind: 'resetAc' }, { kind: 'acVs', types: ['slashing'], amount: 3 }, { kind: 'acVs', types: ['piercing', 'bludgeoning'], amount: -1 }],
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
      // DM ruling: Legendary does NOT keep Purple's d6 deflect. Blue +1 piercing + this = +2 vs piercing total.
      legendary: [{ kind: 'acVs', types: ['slashing', 'piercing', 'bludgeoning'], amount: 1 }, { kind: 'dropDeflect' }],
      mythic: [{ kind: 'resetAc' }, { kind: 'acVs', types: ['piercing'], amount: 3 }, { kind: 'acVs', types: ['slashing', 'bludgeoning'], amount: -1 }],
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
  underVs: Partial<Record<DamageType, number>>
  underOnlyAc: boolean
  lines: string[] // human-readable list of active effects
  notes: string[]
}

export function resolveArmor(def: ArmorDef | undefined, tier: Tier | undefined, prof: number, asUnder = false): ResolvedArmor {
  const r: ResolvedArmor = { reduce: {}, acVs: {}, deflectD6: false, shrugOff: false, underLayerAc: 0, underVs: {}, underOnlyAc: false, lines: [], notes: [] }
  if (!def || !tier) return r
  r.notes = [...def.allTiers]
  for (const t of TIERS.slice(0, TIERS.indexOf(tier) + 1)) {
    for (const e of def.tiers[t]) {
      if (e.kind === 'reduce') {
        const n = e.amount === 'prof' ? prof : e.amount
        r.reduce[e.type] = e.replaces ? n : (r.reduce[e.type] ?? 0) + n
      } else if (e.kind === 'acVs') { if (!(asUnder && e.notUnder)) for (const ty of e.types) r.acVs[ty] = (r.acVs[ty] ?? 0) + e.amount }
      else if (e.kind === 'deflectD6') r.deflectD6 = true
      else if (e.kind === 'dropDeflect') r.deflectD6 = false
      else if (e.kind === 'shrugOff') r.shrugOff = true
      else if (e.kind === 'underLayer') { r.underLayerAc = e.ac; r.underVs = e.vs ?? {}; r.underOnlyAc = !!e.onlyAc }
      else if (e.kind === 'resetAc') r.acVs = {}
      else r.notes.push(e.text)
    }
  }
  for (const [ty, n] of Object.entries(r.reduce)) r.lines.push(`−${n} ${ty} damage taken`)
  for (const [ty, n] of Object.entries(r.acVs)) if (n) r.lines.push(`${n > 0 ? '+' : '−'}${Math.abs(n)} AC vs ${ty}`)
  if (r.deflectD6) r.lines.push('d6 deflect on piercing hits (6 = no damage)')
  if (r.shrugOff) r.lines.push('Shrug Off: ignore one hit per day (resets on long rest)')
  if (r.underLayerAc) r.lines.push(`Can be worn under medium/heavy armor (+${r.underLayerAc} AC${Object.entries(r.underVs).map(([t, n]) => `, +${r.underLayerAc + n!} vs ${t}`).join('')}${r.underOnlyAc ? '; AC only' : ''})`)
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
  /** tier data version (see TIER_VERSION) */
  tierV?: number
  /** equipped armor is Damaged (durability ≤ half): −1 AC */
  armorDamaged?: boolean
}

/** Combined effects of main armor + optional under-layer. */
export function combinedArmor(f: ArmorFields): ResolvedArmor {
  const prof = f.prof ?? 2
  const main = resolveArmor(armorById(f.armorId), f.armorTier, prof)
  const mainDef = armorById(f.armorId)
  if (!mainDef || mainDef.category === 'light' || !canBeUnderLayer(f.underId, f.underTier)) return main
  const under = resolveArmor(armorById(f.underId), f.underTier, prof, true)
  const out: ResolvedArmor = { ...main, reduce: { ...main.reduce }, acVs: { ...main.acVs }, lines: [...main.lines], notes: [...main.notes] }
  if (!under.underOnlyAc) {
    for (const [ty, n] of Object.entries(under.reduce)) out.reduce[ty as DamageType] = Math.max(out.reduce[ty as DamageType] ?? 0, n!)
    for (const [ty, n] of Object.entries(under.acVs)) out.acVs[ty as DamageType] = (out.acVs[ty as DamageType] ?? 0) + n!
    out.lines.push(...under.lines.filter((l) => !l.startsWith('Can be worn')).map((l) => `Under-layer: ${l}`))
  }
  for (const [ty, n] of Object.entries(under.underVs)) out.acVs[ty as DamageType] = (out.acVs[ty as DamageType] ?? 0) + n!
  out.lines.push(`Under-layer: +${under.underLayerAc} AC${Object.entries(under.underVs).map(([t, n]) => ` (+${under.underLayerAc + n!} vs ${t})`).join('')}`)
  return out
}

export function armorAc(f: ArmorFields, dexMod: number): number | null {
  const def = armorById(f.armorId)
  if (!def) return null
  const dex = def.dexCap === null ? dexMod : Math.min(dexMod, def.dexCap)
  let ac = def.baseAc + dex
  if (f.armorDamaged) ac -= 1
  if (def.category !== 'light' && canBeUnderLayer(f.underId, f.underTier)) ac += resolveArmor(armorById(f.underId), f.underTier, 2).underLayerAc
  return ac
}

export const armorLabel = (f: ArmorFields) => {
  const def = armorById(f.armorId)
  if (!def) return ''
  const u = def.category !== 'light' && canBeUnderLayer(f.underId, f.underTier) ? ` + ${TIER_SHORT[f.underTier!]} ${armorById(f.underId)!.name} under-layer` : ''
  return `${f.armorTier ? TIER_SHORT[f.armorTier] + ' ' : ''}${def.name} Armor${u}`
}
