// Salvage broken (or marked) armor into parts or a small coin refund, and craft tiered repair kits.
// PLACEHOLDER recipes: Ashton will replace the material → armor mapping.
import type { Item } from './types'
import { uid } from './types'
import { TIER_SHORT, type Tier } from './armor'

/** Two matching materials craft one kit. */
export const MATERIALS_PER_KIT = 2

export function kitsFromCount(count: number): number {
  return Math.floor(Math.max(0, Math.floor(count)) / MATERIALS_PER_KIT)
}

export interface MaterialDef {
  key: string
  name: string
  /** Armor family this kit repairs. Omitted = any armor of `tier`. */
  armorId?: string
  tier: Tier
  /** Shown in the UI. Keep the PLACEHOLDER tag until the real recipe exists. */
  note: string
}

export const MATERIALS: MaterialDef[] = [
  // PLACEHOLDER: wolf pelts become a Common leather kit.
  { key: 'wolf_pelt', name: 'Wolf Pelt', armorId: 'leather', tier: 'green', note: 'PLACEHOLDER: 2 wolf pelts → 1 Common leather repair kit.' },
  { key: 'goblin_rag', name: 'Goblin Rag', armorId: 'padded', tier: 'green', note: 'PLACEHOLDER: 2 goblin rags → 1 Common padded repair kit.' },
  { key: 'iron_scrap', name: 'Iron Scrap', armorId: 'studded', tier: 'green', note: 'PLACEHOLDER: 2 iron scraps → 1 Common studded repair kit.' },
  { key: 'ogre_hide', name: 'Ogre Hide', armorId: 'leather', tier: 'blue', note: 'PLACEHOLDER: 2 ogre hides → 1 Rare leather repair kit.' },
  { key: 'dragon_scale', name: 'Dragon Scale', armorId: 'studded', tier: 'legendary', note: 'PLACEHOLDER: 2 dragon scales → 1 Legendary studded repair kit.' },
]

const SCRAP_NOTE = 'PLACEHOLDER generic salvage. Two matching scraps craft a kit for any armor of this tier.'

export function materialDef(key?: string): MaterialDef | undefined {
  if (!key) return
  const found = MATERIALS.find((m) => m.key === key)
  if (found) return found
  const m = /^scrap_(green|blue|purple|legendary|mythic)$/.exec(key)
  if (!m) return
  const tier = m[1] as Tier
  return { key, name: `${TIER_SHORT[tier]} Scrap`, tier, note: SCRAP_NOTE }
}

export function materialItem(key: string, qty = 1): Item {
  const def = materialDef(key) ?? { key, name: key, tier: 'green' as Tier, note: 'PLACEHOLDER material.' }
  return {
    id: uid(), name: def.name, kind: 'misc', qty, materialKey: def.key, tier: def.tier,
    description: def.note,
  }
}

/** Salvage yields enough matching parts for one kit (2). Unmapped armor becomes generic scrap of its tier. */
export function salvageBundle(armorId: string | undefined, tier: Tier): { materialKey: string; qty: number } {
  const exact = MATERIALS.find((m) => m.armorId === armorId && m.tier === tier)
  if (exact) return { materialKey: exact.key, qty: MATERIALS_PER_KIT }
  return { materialKey: `scrap_${tier}`, qty: MATERIALS_PER_KIT }
}

/** PLACEHOLDER refund, in silver. Deliberately small next to buying a new suit. */
export const SALVAGE_REFUND_SILVER: Record<Tier, number> = { green: 20, blue: 40, purple: 80, legendary: 150, mythic: 250 }
export const salvageRefundSilver = (tier: Tier) => SALVAGE_REFUND_SILVER[tier]

export function repairKitItem(def: MaterialDef): Item {
  const family = def.armorId ? `${def.armorId} ` : ''
  return {
    id: uid(),
    name: `${TIER_SHORT[def.tier]} ${family}Repair Kit`.replace('  ', ' '),
    kind: 'consumable',
    qty: 1,
    tier: def.tier,
    kitTier: def.tier,
    kitArmorId: def.armorId,
    description: def.armorId
      ? `PLACEHOLDER tiered kit: fully repairs one ${TIER_SHORT[def.tier]} ${def.armorId} armor, including Broken. Field use — the blacksmith is still an option.`
      : `PLACEHOLDER tiered kit: fully repairs one ${TIER_SHORT[def.tier]} armor of any family, including Broken.`,
  }
}

export function kitMatches(kit: Item, armor: Item): boolean {
  if (!kit.kitTier || armor.kind !== 'armor' || armor.tier !== kit.kitTier || armor.special) return false
  if (kit.kitArmorId && armor.armorId !== kit.kitArmorId) return false
  return true
}
