// Accessories are not armor layers. A helmet's AC is a flat bonus, not an under-layer.
import type { Character, EquipSlot, Item } from './types'
import { uid } from './types'
import { TIER_SHORT, type Tier } from './armor'

export interface AccessoryDef {
  id: string
  name: string
  slot: EquipSlot
  tier: Tier
  price: number
  perkAc?: number
  perkRanged?: number
  perkSpell?: number
  note: string
}

/** PLACEHOLDER gear. Found or bought; not fused on the armor ladder. */
export const ACCESSORIES: AccessoryDef[] = [
  { id: 'iron-cap', name: 'Iron Cap', slot: 'head', tier: 'green', price: 12, perkAc: 1, note: 'PLACEHOLDER helmet: +1 AC. This does not layer with body armor and is not an under-layer.' },
  { id: 'archer-gauntlets', name: "Archer's Gauntlets", slot: 'hands', tier: 'blue', price: 40, perkRanged: 1, perkSpell: 1, note: 'PLACEHOLDER gauntlets: +1 to hit with ranged weapons and +1 spell attack.' },
  { id: 'softstep-boots', name: 'Softstep Boots', slot: 'feet', tier: 'green', price: 18, note: 'PLACEHOLDER boots: quiet steps. No AC.' },
]

export const accessoryById = (id?: string) => ACCESSORIES.find((a) => a.id === id)

export function accessoryItem(id: string): Item {
  const a = accessoryById(id) ?? ACCESSORIES[0]
  return {
    id: uid(), name: `${TIER_SHORT[a.tier]} ${a.name}`, kind: 'misc', qty: 1, tier: a.tier, price: a.price,
    equipSlot: a.slot, perkAc: a.perkAc, perkRanged: a.perkRanged, perkSpell: a.perkSpell,
    description: a.note,
  }
}

export const equippedIn = (c: { inventory?: Item[] }, slot: EquipSlot) =>
  (c.inventory ?? []).find((i) => i.equipped && i.equipSlot === slot)

export function accessoryAc(c: { inventory?: Item[] }): number {
  return (c.inventory ?? []).reduce((n, i) => n + (i.equipped && i.equipSlot ? i.perkAc ?? 0 : 0), 0)
}
export function rangedToHitBonus(c: { inventory?: Item[] }): number {
  return (c.inventory ?? []).reduce((n, i) => n + (i.equipped && i.equipSlot ? i.perkRanged ?? 0 : 0), 0)
}
export function spellToHitBonus(c: { inventory?: Item[] }): number {
  return (c.inventory ?? []).reduce((n, i) => n + (i.equipped && i.equipSlot ? i.perkSpell ?? 0 : 0), 0)
}

export const slotLabel: Record<EquipSlot, string> = { head: 'Head', hands: 'Hands', feet: 'Feet' }

export function accessorySummary(c: Character): string[] {
  return (['head', 'hands', 'feet'] as EquipSlot[]).flatMap((s) => {
    const it = equippedIn(c, s)
    return it ? [`${slotLabel[s]}: ${it.name}`] : []
  })
}
