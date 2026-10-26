// Generic crafting materials (gray → red) and the salvage / repair-kit rules.
// Typed monster parts are gone. Old keys still count as a generic tier so saved stacks aren't junk.
import type { Item } from './types'
import { uid } from './types'
import { TIERS, TIER_SHORT, type Tier } from './armor'
import { CRAFT_GOLD, KIT_DICE, KIT_PRICES, SALVAGE_RICH_ABOVE } from './catalog'

export const MAT_TIERS = ['gray', 'green', 'blue', 'purple', 'orange', 'red'] as const
export type MatTier = (typeof MAT_TIERS)[number]

export const MAT_COLORS: Record<MatTier, string> = {
  gray: '#9aa0a8', green: '#4fbf63', blue: '#4a8fe7', purple: '#a35de0', orange: '#f08a2a', red: '#e5383b',
}
export const MAT_LABELS: Record<MatTier, string> = {
  gray: 'Gray', green: 'Green', blue: 'Blue', purple: 'Purple', orange: 'Orange', red: 'Red',
}

/** Gear rarity → the mat you salvage and craft with. Legendary is orange, mythic is red. */
export const GEAR_TO_MAT: Record<Tier, MatTier> = {
  green: 'green', blue: 'blue', purple: 'purple', legendary: 'orange', mythic: 'red',
}
export const MAT_TO_GEAR: Partial<Record<MatTier, Tier>> = {
  green: 'green', blue: 'blue', purple: 'purple', orange: 'legendary', red: 'mythic',
}

const OLD_KEYS: Record<string, MatTier> = {
  wolf_pelt: 'green', goblin_rag: 'green', iron_scrap: 'green',
  ogre_hide: 'blue', dragon_scale: 'orange',
  scrap_green: 'green', scrap_blue: 'blue', scrap_purple: 'purple', scrap_legendary: 'orange', scrap_mythic: 'red',
}

export const matKey = (tier: MatTier) => `mat_${tier}`

export function materialTier(key?: string): MatTier | undefined {
  if (!key) return
  const m = /^mat_(gray|green|blue|purple|orange|red)$/.exec(key)
  if (m) return m[1] as MatTier
  return OLD_KEYS[key]
}

export function nextMatTier(tier: MatTier): MatTier | null {
  return MAT_TIERS[MAT_TIERS.indexOf(tier) + 1] ?? null
}
export function prevMatTier(tier: MatTier): MatTier | null {
  return MAT_TIERS[MAT_TIERS.indexOf(tier) - 1] ?? null
}

export interface MatStack { tier: MatTier; qty: number }

/**
 * Salvage by remaining durability.
 * Broken (0): 1 mat of the item’s tier.
 * 1%–65%: 2 mats of that tier.
 * Above 65%: those 2, plus 2 of the tier below (green’s below is gray).
 */
export function salvageYield(current: number, max: number, gearTier: Tier): MatStack[] {
  if (max <= 0) return []
  const mat = GEAR_TO_MAT[gearTier]
  const cur = Math.max(0, Math.min(max, current))
  if (cur <= 0) return [{ tier: mat, qty: 1 }]
  if (cur / max <= SALVAGE_RICH_ABOVE) return [{ tier: mat, qty: 2 }]
  const below = prevMatTier(mat)
  return below ? [{ tier: mat, qty: 2 }, { tier: below, qty: 2 }] : [{ tier: mat, qty: 2 }]
}

export function materialItem(tier: MatTier, qty = 1): Item {
  const gear = MAT_TO_GEAR[tier]
  const note = tier === 'gray'
    ? 'Gray material. Merge three into one Green at the blacksmith. Merge-only — it does not craft gear.'
    : `${MAT_LABELS[tier]} material. Four of these plus ${gear ? CRAFT_GOLD[gear] : 0}g craft gear of this tier. Three merge into the next tier. Two craft a repair kit.`
  return {
    id: uid(), name: `${MAT_LABELS[tier]} Material`, kind: 'misc', qty, materialKey: matKey(tier),
    description: note,
  }
}

export function matQty(c: { inventory?: Item[] }, tier: MatTier): number {
  return (c.inventory ?? []).filter((i) => materialTier(i.materialKey) === tier).reduce((n, i) => n + i.qty, 0)
}

/** Two matching materials craft one kit. */
export const MATERIALS_PER_KIT = 2
export function kitsFromCount(count: number): number {
  return Math.floor(Math.max(0, Math.floor(count)) / MATERIALS_PER_KIT)
}

const DIE_STEPS = [4, 6, 8, 10, 12]
/** PLACEHOLDER: one die step (d6→d8→d10→d12), not +2 flat. Ashton can swap the feel later. */
export function bumpDie(expr: string): string {
  return expr.replace(/d(\d+)/, (_, n) => {
    const i = DIE_STEPS.indexOf(Number(n))
    const next = i < 0 ? Number(n) : DIE_STEPS[Math.min(DIE_STEPS.length - 1, i + 1)]
    return `d${next}`
  })
}

/** Dice a kit rolls on this gear. Null when the kit is below the gear’s tier. */
export function kitDiceFor(kit: Tier, gear: Tier): string | null {
  if (TIERS.indexOf(kit) < TIERS.indexOf(gear)) return null
  const base = KIT_DICE[kit]
  return kit === gear ? base : bumpDie(base)
}

export function repairKitItem(tier: Tier): Item {
  return {
    id: uid(),
    name: `${TIER_SHORT[tier]} Repair Kit`,
    kind: 'consumable',
    qty: 1,
    tier,
    kitTier: tier,
    price: KIT_PRICES[tier],
    description: `Restores ${KIT_DICE[tier]} durability to ${TIER_SHORT[tier]} gear. On a lower tier, the die steps up once. Cannot repair Broken gear — the blacksmith (or Scroll of Mending Steel) has to do that.`,
  }
}

/** Same tier or higher, any armor / weapon / shield. Not Broken. Family no longer matters. */
export function kitMatches(kit: Item, gear: Item): boolean {
  if (!kit.kitTier || !gear.tier || gear.special) return false
  if (gear.kind !== 'armor' && gear.kind !== 'weapon' && gear.kind !== 'shield') return false
  return TIERS.indexOf(kit.kitTier) >= TIERS.indexOf(gear.tier)
}
