// Armor durability: wear on hits, Damaged / Broken states, repairs. Numbers live in catalog.ts.
import type { Character, DamageType, Item } from './types'
import { ARMOR_HP, BROKEN_REPAIR_MULT, DAMAGED_AT, REPAIR_COST_PER_POINT, WEAPON_HP, WEAPON_SIZE_BY_ID, WEAR, type WeaponSize } from './catalog'
import { TIER_SHORT, armorById } from './armor'
import { shieldMaxHp } from './shields'

function weaponSize(it: Item): WeaponSize {
  return (it.weaponId && WEAPON_SIZE_BY_ID[it.weaponId]) || 'standard'
}

/**
 * Armor and shields use category × tier. Weapons use size × tier.
 * Named black mythics use the mythic cap of their size (standard if untyped). Pink is not durability gear.
 * PLACEHOLDER: shield bars, repair, and salvage are live. Automatic hit-wear stays on body armor until shields are told to soak hits.
 */
export const maxDur = (it: Item) => {
  if (it.kind === 'weapon' && it.special === 'black') return WEAPON_HP[weaponSize(it)].mythic
  if (it.special) return 0
  if (it.kind === 'shield' && it.tier) return shieldMaxHp(it.shieldId, it.tier)
  if (it.kind === 'armor' && it.tier) return ARMOR_HP[armorById(it.armorId)?.category ?? 'light'][it.tier]
  if (it.kind === 'weapon' && it.tier) return WEAPON_HP[weaponSize(it)][it.tier]
  return 0
}
export const durOf = (it: Item) => Math.max(0, Math.min(maxDur(it), it.dur ?? maxDur(it)))
export const isBroken = (it: Item) => maxDur(it) > 0 && durOf(it) <= 0
/** Combat Damaged (−1 AC) is armor and shields. Half plate at legendary or mythic uses ¼ instead of ½. Weapons don't take the AC penalty. */
export function damagedFraction(it: Item): number {
  if (it.kind === 'armor' && it.armorId === 'half-plate' && (it.tier === 'legendary' || it.tier === 'mythic')) return 0.25
  return DAMAGED_AT
}
export const isDamaged = (it: Item) => (it.kind === 'armor' || it.kind === 'shield') && !!it.tier && !it.special && !isBroken(it) && durOf(it) <= maxDur(it) * damagedFraction(it)
export const durState = (it: Item): 'ok' | 'damaged' | 'broken' => (isBroken(it) ? 'broken' : isDamaged(it) ? 'damaged' : 'ok')
export const equippedArmor = (c?: Character) => (c?.inventory ?? []).find((i) => i.kind === 'armor' && i.equipped)

/** Wear for one hit. Weak = the armor has a negative AC modifier vs that type (not suppressed by Stoneskin). */
export function wearFor(o: { crit: boolean; weak: boolean }): { amount: number; reason: string } {
  if (o.crit && o.weak) return { amount: WEAR.weakCrit, reason: 'critical, weak type' }
  if (o.crit) return { amount: WEAR.crit, reason: 'critical' }
  if (o.weak) return { amount: WEAR.weakType, reason: 'weak type' }
  return { amount: WEAR.hit, reason: 'hit' }
}

/** Keep armorDamaged in sync with the equipped armor (−1 AC handled in armorAc). */
export function armorDamagedFlag(c: Character) { const a = equippedArmor(c); return !!a && isDamaged(a) }

export function setDur(c: Character, itemId: string, dur: number): Character {
  return { ...c, inventory: (c.inventory ?? []).map((i) => (i.id === itemId ? { ...i, dur: Math.max(0, Math.min(maxDur(i), dur)) } : i)) }
}

export function repairCost(it: Item, points: number) {
  if (!it.tier) return 0
  return points * REPAIR_COST_PER_POINT[it.tier] * (isBroken(it) ? BROKEN_REPAIR_MULT : 1)
}
export const missing = (it: Item) => maxDur(it) - durOf(it)
export const durLabel = (it: Item) => `${durOf(it)}/${maxDur(it)}`
export const stateText = (it: Item) => (isBroken(it) ? 'Broken' : isDamaged(it) ? 'Damaged −1 AC' : '')
export const armorName = (it: Item) => it.name || `${TIER_SHORT[it.tier!]} armor`
export type { DamageType }
