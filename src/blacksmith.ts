// Town blacksmith: upgrade (3→1), craft, merge, and salvage.
// Gold repair stays in effects.ts (blacksmithRepair).
import type { Character, DamageType, Item } from './types'
import type { Tier } from './armor'
import { TIER_SHORT, armorById } from './armor'
import { CRAFT_GOLD, MERGE_FEE_SILVER, nextTier, upgradeFeeGold } from './catalog'
import { durOf, maxDur } from './durability'
import { addItem, armorItem, removeItem, unequip } from './inventory'
import { fromSilver, purseSilver } from './party'
import {
  MATERIALS_PER_KIT, MAT_LABELS, MAT_TO_GEAR, type MatTier, materialItem, materialTier, matQty,
  nextMatTier, repairKitItem, salvageYield,
} from './salvage'
import { shieldById, shieldItem } from './shields'
import { tieredWeapon, weaponById } from './weapons'

export interface SmithResult { char: Character; ok: boolean; message: string; item?: Item }

function paySilver(c: Character, silver: number): Character | null {
  if (purseSilver(c.purse) < silver) return null
  return { ...c, purse: fromSilver(purseSilver(c.purse) - silver) }
}

/** Pull qty of a mat tier off the pack, counting legacy keys that map to the same tier. */
export function takeMats(c: Character, tier: MatTier, qty: number): Character | null {
  if (matQty(c, tier) < qty) return null
  const rows = (c.inventory ?? []).filter((i) => materialTier(i.materialKey) === tier)
  let n = c
  let left = qty
  for (const it of rows) {
    if (left <= 0) break
    const take = Math.min(left, it.qty)
    n = removeItem(n, it.id, take)
    left -= take
  }
  return n
}

export function gearKey(it: Item): string | null {
  if (it.special || !it.tier) return null
  if (it.kind === 'armor' && it.armorId) return `armor:${it.armorId}:${it.tier}`
  if (it.kind === 'weapon' && it.weaponId) return `weapon:${it.weaponId}:${it.tier}`
  if (it.kind === 'shield' && it.shieldId) return `shield:${it.shieldId}:${it.tier}`
  return null
}

function feeCategory(it: Item): 'weapon' | 'light' | 'medium' | 'heavy' {
  if (it.kind === 'weapon') return 'weapon'
  if (it.kind === 'shield') return shieldById(it.shieldId)?.category ?? 'light'
  return armorById(it.armorId)?.category ?? 'light'
}

export function upgradeFeeFor(it: Item): number | null {
  if (!it.tier) return null
  return upgradeFeeGold(it.tier, feeCategory(it))
}

function makeUpgraded(it: Item, tier: Tier, swornType?: DamageType): Item {
  if (it.kind === 'armor' && it.armorId) {
    const made = armorItem(it.armorId, tier)
    return swornType && (it.armorId === 'plate' || it.armorId === 'half-plate') ? { ...made, swornType } : made
  }
  if (it.kind === 'weapon' && it.weaponId) return tieredWeapon(it.weaponId, tier)
  if (it.kind === 'shield' && it.shieldId) return shieldItem(it.shieldId, tier)
  return it
}

/** Three of the same type and tier → one of the next tier, plus the fee. */
export function upgradeGear(c: Character, itemIds: string[], swornType?: DamageType): SmithResult {
  if (itemIds.length !== 3) return { char: c, ok: false, message: 'Upgrade takes three of the same piece.' }
  const uses = new Map<string, number>()
  for (const id of itemIds) uses.set(id, (uses.get(id) ?? 0) + 1)
  const rows: Item[] = []
  for (const [id, n] of uses) {
    const it = (c.inventory ?? []).find((i) => i.id === id)
    if (!it || it.qty < n) return { char: c, ok: false, message: 'Those three pieces are not all in the pack.' }
    rows.push(it)
  }
  const key = gearKey(rows[0])
  if (!key || rows.some((i) => gearKey(i) !== key)) {
    return { char: c, ok: false, message: 'All three must be the same type and tier. Pink and black are not on this ladder.' }
  }
  const from = rows[0].tier!
  const next = nextTier(from)
  if (!next) return { char: c, ok: false, message: `${rows[0].name} is already Mythic.` }
  const fee = upgradeFeeFor(rows[0])
  if (fee == null) return { char: c, ok: false, message: 'That piece cannot be upgraded.' }
  const paid = paySilver(c, fee * 10)
  if (!paid) return { char: c, ok: false, message: `${c.name} needs ${fee}g for the upgrade.` }
  let n = paid
  for (const [id, count] of uses) n = removeItem(n, id, count)
  const made = makeUpgraded(rows[0], next, swornType)
  n = addItem(n, made)
  const cat = feeCategory(rows[0])
  const note = cat === 'medium' ? ' Medium fee ×2.' : cat === 'heavy' ? ' Heavy fee ×5.' : ''
  return { char: n, ok: true, item: made, message: `${c.name} pays ${fee}g: three ${TIER_SHORT[from]} → ${made.name}.${note}` }
}

export type CraftChoice = { kind: 'armor'; id: string } | { kind: 'weapon'; id: string } | { kind: 'shield'; id: string }

export function craftGear(c: Character, mat: MatTier, choice: CraftChoice, swornType?: DamageType): SmithResult {
  const gearTier = MAT_TO_GEAR[mat]
  if (!gearTier) return { char: c, ok: false, message: 'Gray material is merge-only. It does not craft gear.' }
  if (choice.kind === 'armor' && !armorById(choice.id)) return { char: c, ok: false, message: 'Unknown armor.' }
  if (choice.kind === 'weapon' && !weaponById(choice.id)) return { char: c, ok: false, message: 'Unknown weapon.' }
  if (choice.kind === 'shield' && !shieldById(choice.id)) return { char: c, ok: false, message: 'Unknown shield.' }
  const gold = CRAFT_GOLD[gearTier]
  if (matQty(c, mat) < 4) return { char: c, ok: false, message: `Need 4 ${MAT_LABELS[mat]} material.` }
  const paid = paySilver(c, gold * 10)
  if (!paid) return { char: c, ok: false, message: `${c.name} needs ${gold}g to craft that.` }
  const taken = takeMats(paid, mat, 4)
  if (!taken) return { char: c, ok: false, message: `Need 4 ${MAT_LABELS[mat]} material.` }
  let made: Item
  if (choice.kind === 'armor') {
    made = armorItem(choice.id, gearTier)
    if (swornType && (choice.id === 'plate' || choice.id === 'half-plate') && gearTier === 'mythic') made = { ...made, swornType }
  } else if (choice.kind === 'weapon') made = tieredWeapon(choice.id, gearTier)
  else made = shieldItem(choice.id, gearTier)
  return { char: addItem(taken, made), ok: true, item: made, message: `${c.name} crafts ${made.name} from 4 ${MAT_LABELS[mat]} material and ${gold}g.` }
}

/** Two mats of a gear tier → one repair kit. Gray has no kit. No gold. */
export function craftRepairKit(c: Character, tier: MatTier): SmithResult {
  const gear = MAT_TO_GEAR[tier]
  if (!gear) return { char: c, ok: false, message: 'Gray material does not make a repair kit. Merge it first.' }
  if (matQty(c, tier) < MATERIALS_PER_KIT) return { char: c, ok: false, message: `Need ${MATERIALS_PER_KIT} ${MAT_LABELS[tier]} material.` }
  const taken = takeMats(c, tier, MATERIALS_PER_KIT)
  if (!taken) return { char: c, ok: false, message: `Need ${MATERIALS_PER_KIT} ${MAT_LABELS[tier]} material.` }
  const kit = repairKitItem(gear)
  return { char: addItem(taken, kit), ok: true, item: kit, message: `Crafted ${kit.name} from ${MATERIALS_PER_KIT} ${MAT_LABELS[tier]} material.` }
}

/** Three mats of tier N → one of tier N+1. Red does not merge. PLACEHOLDER fee is 1 silver. */
export function mergeMats(c: Character, tier: MatTier): SmithResult {
  const next = nextMatTier(tier)
  if (!next) return { char: c, ok: false, message: 'Red material does not merge any higher.' }
  if (matQty(c, tier) < 3) return { char: c, ok: false, message: `Need 3 ${MAT_LABELS[tier]} material.` }
  const paid = paySilver(c, MERGE_FEE_SILVER)
  if (!paid) return { char: c, ok: false, message: `${c.name} needs ${MERGE_FEE_SILVER} silver for the merge.` }
  const taken = takeMats(paid, tier, 3)
  if (!taken) return { char: c, ok: false, message: `Need 3 ${MAT_LABELS[tier]} material.` }
  const made = materialItem(next, 1)
  return { char: addItem(taken, made), ok: true, item: made, message: `Merged 3 ${MAT_LABELS[tier]} into 1 ${MAT_LABELS[next]} (${MERGE_FEE_SILVER} silver).` }
}

/** Armor, weapons, and shields. Yield follows the durability bands. The piece is consumed. */
export function salvageItem(c: Character, itemId: string): SmithResult {
  const it = (c.inventory ?? []).find((i) => i.id === itemId)
  if (!it || !it.tier || it.special) return { char: c, ok: false, message: 'Salvage a tiered armor, weapon, or shield. Pink and black stay whole.' }
  if (it.kind !== 'armor' && it.kind !== 'weapon' && it.kind !== 'shield') return { char: c, ok: false, message: 'That is not gear the blacksmith can break down.' }
  const max = maxDur(it)
  if (max <= 0) return { char: c, ok: false, message: `${it.name} has no durability to salvage.` }
  const stacks = salvageYield(durOf(it), max, it.tier)
  let n = it.equipped ? unequip(c, itemId) : c
  n = removeItem(n, itemId, 1)
  for (const s of stacks) n = addItem(n, materialItem(s.tier, s.qty))
  const list = stacks.map((s) => `${s.qty}× ${MAT_LABELS[s.tier]}`).join(' and ')
  return { char: n, ok: true, message: `Salvaged ${it.name} into ${list}.` }
}
