// Shadowdark-style slots. Identical potions already stack into one inventory row, so they cost one slot.
import type { Character, Item } from './types'
import { weaponById } from './weapons'

/** PLACEHOLDER: carrying capacity equals Strength score (a common Shadowdark reading). */
export function carryCapacity(c: { abilities?: { str?: number } }): number {
  return Math.max(1, c.abilities?.str ?? 10)
}

export function itemSlots(it: Item): number {
  if (typeof it.slotCost === 'number') return Math.max(0, it.slotCost)
  if (it.kind === 'armor') return 1
  if (it.kind === 'weapon') {
    const def = it.weaponId ? weaponById(it.weaponId) : undefined
    if (def) return def.slots
    if (/great|maul|pike|halberd/i.test(it.name)) return 2
    return 1
  }
  // Potions, scrolls, materials, kits: one row = one slot, whatever the qty.
  return 1
}

export function slotsUsed(items: Item[] | undefined): number {
  return (items ?? []).reduce((n, it) => n + itemSlots(it), 0)
}

export function encumbrance(c: Character): { used: number; cap: number; over: boolean } {
  const used = slotsUsed(c.inventory)
  const cap = carryCapacity(c)
  return { used, cap, over: used > cap }
}
