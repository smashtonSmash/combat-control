/**
 * HOMEBREW SHOP CATALOG — edit prices, fees and items here.
 * Everything the Shop, Blacksmith, item picker and item effects use comes from this file.
 */
import type { DamageType, Item } from './types'
import { uid } from './types'
import { TIERS, TIER_SHORT, armorById, renameTierText, type ArmorCategory, type Tier } from './armor'

// ---------- A) Armor prices ----------
/** Light armor price by tier (gold). */
export const ARMOR_PRICES: Record<Tier, number> = { green: 10, blue: 35, purple: 90, legendary: 300, mythic: 1000 }
/** Medium / heavy armor = light price × multiplier. TBD — set these when decided. */
export const ARMOR_PRICE_MULTIPLIER: Record<ArmorCategory, number> = { light: 1, medium: 1, heavy: 1 }
export function armorPrice(armorId: string | undefined, tier: Tier): number {
  const def = armorById(armorId)
  const mult = def?.priceMultiplier ?? ARMOR_PRICE_MULTIPLIER[def?.category ?? 'light']
  return Math.round(ARMOR_PRICES[tier] * mult)
}

// ---------- B) Blacksmith fusing ----------
/** Fee (gold) to fuse two armors of the same type + tier into one of the next tier. Key = the tier you start from. */
export const FUSE_FEES: Partial<Record<Tier, number>> = { green: 15, blue: 20, purple: 120, legendary: 400 }
export const FUSE_NOTE = 'Fusing takes a few days at the forge.'
export const nextTier = (t: Tier): Tier | null => TIERS[TIERS.indexOf(t) + 1] ?? null

// ---------- C) Potions & scrolls ----------
/** What happens when the item is used. Mechanical where practical, otherwise a badge / reminder. */
export type EffectSpec =
  | { kind: 'heal'; dice: string }
  | { kind: 'fullHeal' }
  | { kind: 'weaponType'; type: DamageType }          // oils: equipped weapon's damage type until long rest
  | { kind: 'weaponBonus'; dice: string; type: DamageType } // Ember Flask (poured): +dice of type until long rest
  | { kind: 'acBonus'; amount: number; speed?: number }   // Ironhide: fight-long
  | { kind: 'stoneskin' }                                 // ignore Mythic −1 AC penalties until long rest
  | { kind: 'frostbite' }                                 // melee attackers who hit take 1d4 cold
  | { kind: 'mirror'; until: 'combat' | 'long' }          // attacks against you deal your weapon's damage type
  | { kind: 'secondWind' }                                // next drop to 0 → 1 HP
  | { kind: 'mending' }                                   // armor +1 tier until end of combat
  | { kind: 'whetstone' }                                 // next hit that day is a crit
  | { kind: 'badge'; duration: string; until?: 'combat' | 'long' }          // reminder badge
  | { kind: 'reminder' }                                  // one-shot effect, just logged

export interface CatalogItem {
  key: string; name: string; tier: Tier; type: 'potion' | 'scroll'; price: number; desc: string; effect: EffectSpec
}
export const CONSUMABLES: CatalogItem[] = [
  // Green
  { key: 'heal-green', name: 'Healing Potion', tier: 'green', type: 'potion', price: 10, desc: 'Regain 2d8+2 HP.', effect: { kind: 'heal', dice: '2d8+2' } },
  { key: 'oil-slashing', name: 'Oil of Slashing', tier: 'green', type: 'potion', price: 8, desc: 'Pour on one weapon: it deals slashing damage until the next long rest.', effect: { kind: 'weaponType', type: 'slashing' } },
  { key: 'oil-piercing', name: 'Oil of Piercing', tier: 'green', type: 'potion', price: 8, desc: 'Pour on one weapon: it deals piercing damage until the next long rest.', effect: { kind: 'weaponType', type: 'piercing' } },
  { key: 'oil-bludgeoning', name: 'Oil of Bludgeoning', tier: 'green', type: 'potion', price: 8, desc: 'Pour on one weapon: it deals bludgeoning damage until the next long rest.', effect: { kind: 'weaponType', type: 'bludgeoning' } },
  { key: 'liquid-courage', name: 'Liquid Courage', tier: 'green', type: 'potion', price: 5, desc: 'Advantage on saves vs frightened, disadvantage on WIS checks. 1 hour.', effect: { kind: 'badge', duration: '1 hour' } },
  { key: 'featherfoot', name: 'Featherfoot Tonic', tier: 'green', type: 'potion', price: 10, desc: 'No fall damage and silent steps. 1 hour.', effect: { kind: 'badge', duration: '1 hour' } },
  { key: 'ember-flask', name: 'Ember Flask', tier: 'green', type: 'potion', price: 10, desc: 'Throw for a 10 ft fire area, or pour on a weapon for +1d4 fire (until the next long rest).', effect: { kind: 'weaponBonus', dice: '1d4', type: 'fire' } },
  { key: 'beastblood', name: 'Beastblood Brew', tier: 'green', type: 'potion', price: 12, desc: 'Speak with one kind of animal. 1 hour.', effect: { kind: 'badge', duration: '1 hour' } },
  { key: 'clear-eyes', name: 'Potion of Clear Eyes', tier: 'green', type: 'potion', price: 12, desc: 'Darkvision and see invisible outlines. 10 minutes.', effect: { kind: 'badge', duration: '10 minutes' } },
  { key: 'borrowed-skill', name: 'Scroll of Borrowed Skill', tier: 'green', type: 'scroll', price: 15, desc: 'Proficiency in one skill or tool. 1 hour.', effect: { kind: 'badge', duration: '1 hour' } },
  // Blue
  { key: 'heal-blue', name: 'Healing Potion', tier: 'blue', type: 'potion', price: 35, desc: 'Regain 4d8+4 HP.', effect: { kind: 'heal', dice: '4d8+4' } },
  { key: 'frostbite', name: 'Frostbite Salve', tier: 'blue', type: 'potion', price: 30, desc: 'Rub on armor: melee attackers who hit you take 1d4 cold.', effect: { kind: 'frostbite' } },
  { key: 'thunderclap', name: 'Scroll of Thunderclap', tier: 'blue', type: 'scroll', price: 30, desc: 'Knock all creatures within 10 ft back 15 ft.', effect: { kind: 'reminder' } },
  { key: 'ironhide', name: 'Ironhide Draught', tier: 'blue', type: 'potion', price: 35, desc: '+2 AC and −10 ft speed. 1 minute.', effect: { kind: 'acBonus', amount: 2, speed: -10 } },
  { key: 'marked-prey', name: 'Scroll of Marked Prey', tier: 'blue', type: 'scroll', price: 35, desc: "Know the marked creature's location. 1 day.", effect: { kind: 'badge', duration: '1 day', until: 'long' } },
  { key: 'stoneskin', name: 'Stoneskin Mud', tier: 'blue', type: 'potion', price: 40, desc: "Removes Mythic armor's −1 AC penalties until the next long rest.", effect: { kind: 'stoneskin' } },
  { key: 'safe-haven', name: 'Scroll of Safe Haven', tier: 'blue', type: 'scroll', price: 45, desc: "A hidden hut for one long rest that enemies can't find.", effect: { kind: 'badge', duration: 'one long rest', until: 'long' } },
  // Purple
  { key: 'heal-purple', name: 'Healing Potion', tier: 'purple', type: 'potion', price: 100, desc: 'Regain 8d8+8 HP.', effect: { kind: 'heal', dice: '8d8+8' } },
  { key: 'last-word', name: 'Scroll of the Last Word', tier: 'purple', type: 'scroll', price: 75, desc: 'A dying creature answers 3 questions.', effect: { kind: 'reminder' } },
  { key: 'whetstone', name: 'Whetstone Oil', tier: 'purple', type: 'potion', price: 80, desc: "The weapon's next hit that day is a crit.", effect: { kind: 'whetstone' } },
  { key: 'swap', name: 'Scroll of Swap', tier: 'purple', type: 'scroll', price: 90, desc: 'Trade places with a creature within 30 ft. Unwilling targets make a DC 13 CHA save.', effect: { kind: 'reminder' } },
  { key: 'mirror-1min', name: 'Mirror Oil (1 min)', tier: 'purple', type: 'potion', price: 100, desc: "On armor: every attack against you deals your weapon's damage type. 1 minute.", effect: { kind: 'mirror', until: 'combat' } },
  { key: 'mending-steel', name: 'Scroll of Mending Steel', tier: 'purple', type: 'scroll', price: 120, desc: 'Repairs armor and raises it one tier for one fight.', effect: { kind: 'mending' } },
  // Legendary
  { key: 'heal-legendary', name: 'Healing Potion', tier: 'legendary', type: 'potion', price: 300, desc: 'Full heal.', effect: { kind: 'fullHeal' } },
  { key: 'second-wind', name: 'Second Wind Elixir', tier: 'legendary', type: 'potion', price: 300, desc: "The next time you'd drop to 0 HP, drop to 1 instead. Once.", effect: { kind: 'secondWind' } },
  { key: 'rewind', name: 'Scroll of Rewind', tier: 'legendary', type: 'scroll', price: 350, desc: 'Reroll one attack, save or check after seeing the result.', effect: { kind: 'badge', duration: 'until used' } },
  { key: 'mirror-long', name: 'Mirror Oil', tier: 'legendary', type: 'potion', price: 400, desc: "On armor: every attack against you deals your weapon's damage type, until the next long rest.", effect: { kind: 'mirror', until: 'long' } },
  // Mythic: none yet
]
export const catalogItem = (key?: string) => CONSUMABLES.find((c) => c.key === key)
export const displayName = (c: CatalogItem) => (c.name === 'Healing Potion' ? `${TIER_SHORT[c.tier]} Healing Potion` : c.name)

/** Make an inventory item from a catalog entry. */
export function catalogToItem(c: CatalogItem, qty = 1): Item {
  return { id: uid(), name: displayName(c), kind: c.type === 'scroll' ? 'scroll' : 'consumable', qty, tier: c.tier, catalogKey: c.key, price: c.price, description: c.desc,
    ...(c.effect.kind === 'heal' ? { heal: c.effect.dice } : {}) }
}

/** Old "Potion of Healing (2d4+2)" → Green Healing Potion. Idempotent. */
export function migrateItem(it: Item): Item {
  if (it.kind === 'consumable' && !it.catalogKey && (it.name === 'Potion of Healing' || it.heal === '2d4+2')) {
    const g = catalogItem('heal-green')!
    return { ...it, name: displayName(g), heal: '2d8+2', tier: 'green', catalogKey: g.key, price: g.price, description: g.desc }
  }
  return it
}
const OLD_NAME = /\b(Green|Blue|Purple) [A-Z]/
const needsItem = (i: Item) => (i.kind === 'consumable' && !i.catalogKey && (i.name === 'Potion of Healing' || i.heal === '2d4+2')) || (!!i.tier && OLD_NAME.test(i.name))
const fixItem = (i: Item): Item => { const m = migrateItem(i); return m.tier && OLD_NAME.test(m.name) ? { ...m, name: renameTierText(m.name) } : m }
/** Migrations for stored characters: old potions, old tier display names (Green/Blue/Purple → Common/Rare/Ultra Rare). */
export function migrateInventory<T extends { inventory?: Item[]; armor?: string }>(c: T): T {
  const armorOld = typeof c.armor === 'string' && OLD_NAME.test(c.armor)
  if (!armorOld && !c.inventory?.some(needsItem)) return c
  return { ...c, ...(armorOld ? { armor: renameTierText(c.armor!) } : {}), ...(c.inventory ? { inventory: c.inventory.map((i) => (needsItem(i) ? fixItem(i) : i)) } : {}) }
}
export function migrateChestItems<T extends { items: Item[] }>(k: T): T {
  if (!k.items.some(needsItem)) return k
  return { ...k, items: k.items.map((i) => (needsItem(i) ? fixItem(i) : i)) }
}

/** Gold price of any item (catalog consumable, armor by tier, or stored price). */
export function itemPrice(it: Item): number | null {
  if (it.price != null) return it.price
  if (it.kind === 'armor' && it.tier) return armorPrice(it.armorId, it.tier)
  return catalogItem(it.catalogKey)?.price ?? null
}
/** Shop price after the DM's adjust %. Rounded to whole silver. Returns silver. */
export function shopPriceSilver(gold: number, adjustPct = 0) { return Math.max(0, Math.round(gold * 10 * (1 + adjustPct / 100))) }
