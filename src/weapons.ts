// Tiered weapons share the Common → Mythic ladder and the 3→1 blacksmith upgrade with armor.
// Pink / black pieces are not in this catalog. Durability numbers live in catalog.ts.
import type { DamageType, Item, WeaponStyle } from './types'
import { uid } from './types'
import { TIER_SHORT, type Tier } from './armor'
import type { WeaponSize } from './catalog'
import { maxDur } from './durability'

export interface WeaponDef {
  id: string
  name: string
  damage: string
  damageType: DamageType
  style: WeaponStyle
  /** Light / one-hand / two-hand. Drives the durability table. */
  size: WeaponSize
  /** Shadowdark slots. Great weapons and the longbow are 2. */
  slots: number
}

export const WEAPON_CATALOG: WeaponDef[] = [
  { id: 'dagger', name: 'Dagger', damage: '1d4', damageType: 'piercing', style: 'melee', size: 'light', slots: 1 },
  { id: 'handaxe', name: 'Handaxe', damage: '1d6', damageType: 'slashing', style: 'melee', size: 'light', slots: 1 },
  { id: 'shortsword', name: 'Shortsword', damage: '1d6', damageType: 'piercing', style: 'melee', size: 'light', slots: 1 },
  { id: 'longsword', name: 'Longsword', damage: '1d8', damageType: 'slashing', style: 'melee', size: 'standard', slots: 1 },
  { id: 'rapier', name: 'Rapier', damage: '1d8', damageType: 'piercing', style: 'melee', size: 'standard', slots: 1 },
  { id: 'mace', name: 'Mace', damage: '1d6', damageType: 'bludgeoning', style: 'melee', size: 'standard', slots: 1 },
  { id: 'warhammer', name: 'Warhammer', damage: '1d8', damageType: 'bludgeoning', style: 'melee', size: 'standard', slots: 1 },
  { id: 'shortbow', name: 'Shortbow', damage: '1d6', damageType: 'piercing', style: 'ranged', size: 'standard', slots: 1 },
  { id: 'longbow', name: 'Longbow', damage: '1d8', damageType: 'piercing', style: 'ranged', size: 'heavy', slots: 2 },
  { id: 'greataxe', name: 'Greataxe', damage: '1d12', damageType: 'slashing', style: 'melee', size: 'heavy', slots: 2 },
  { id: 'greatsword', name: 'Greatsword', damage: '2d6', damageType: 'slashing', style: 'melee', size: 'heavy', slots: 2 },
]

export const weaponById = (id?: string) => WEAPON_CATALOG.find((w) => w.id === id)
export const weaponByName = (name: string) => WEAPON_CATALOG.find((w) => w.name.toLowerCase() === name.toLowerCase())

/** PLACEHOLDER prices (gold), same shape as light armor until Ashton sets them. */
export const WEAPON_PRICES: Record<Tier, number> = { green: 8, blue: 25, purple: 70, legendary: 220, mythic: 800 }
export const weaponPrice = (tier: Tier) => WEAPON_PRICES[tier]

/**
 * PLACEHOLDER flat damage added on top of the base dice.
 * Mythic is the top of this ladder. Pink and black are not in it.
 */
export const WEAPON_TIER_FLAT: Record<Tier, number> = { green: 0, blue: 1, purple: 1, legendary: 2, mythic: 3 }

export function weaponDamage(def: WeaponDef, tier: Tier): string {
  const flat = WEAPON_TIER_FLAT[tier]
  return flat ? `${def.damage}+${flat}` : def.damage
}

export function tieredWeapon(id: string, tier: Tier): Item {
  const def = weaponById(id) ?? WEAPON_CATALOG[0]
  const flat = WEAPON_TIER_FLAT[tier]
  return {
    id: uid(),
    name: `${TIER_SHORT[tier]} ${def.name}`,
    kind: 'weapon',
    qty: 1,
    weaponId: def.id,
    weaponStyle: def.style,
    tier,
    damage: weaponDamage(def, tier),
    damageType: def.damageType,
    slotCost: def.slots,
    price: weaponPrice(tier),
    description: `${TIER_SHORT[tier]} ${def.style} weapon · ${def.size} · ${def.slots === 2 ? 'large (2 slots)' : '1 slot'}. Durability drops on a miss, not on a hit. Upgrade three of these at the blacksmith for the next tier.${flat ? ` PLACEHOLDER +${flat} damage.` : ''}`,
  }
}

export function weaponStyle(it: { weaponStyle?: WeaponStyle; weaponId?: string; name: string }): WeaponStyle {
  if (it.weaponStyle) return it.weaponStyle
  const def = (it.weaponId ? weaponById(it.weaponId) : undefined) ?? weaponByName(it.name.replace(/^(Common|Rare|Ultra Rare|Legendary|Mythic) /, ''))
  if (def) return def.style
  if (/bow|crossbow|sling|dart/i.test(it.name)) return 'ranged'
  return 'melee'
}

/** Equipped tiered weapon whose name matches this attack. Coatings append " (source)". */
export function findSwungWeapon(c: { inventory?: Item[] } | undefined, attackName: string): Item | undefined {
  if (!c || !attackName) return
  const equipped = (c.inventory ?? []).filter((i) => i.kind === 'weapon' && i.equipped && maxDur(i) > 0)
  return equipped.find((w) => attackName === w.name || attackName.startsWith(w.name + ' ') || attackName.startsWith(w.name + ' ('))
}
