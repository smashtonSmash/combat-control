// Item art in public/items/. Emoji KIND_ICON stays the fallback when nothing here matches.
import { ACCESSORIES } from './accessories'
import { ARMOR_CATALOG, type Tier } from './armor'
import { catalogItem } from './catalog'
import { COMMON_WEAPONS } from './inventory'
import { matKey, materialTier } from './salvage'
import { SHIELD_CATALOG } from './shields'
import type { Item } from './types'
import { WEAPON_CATALOG } from './weapons'

/** Catalog armor ids. Each one has armor-{id}.png and armor-{id}-up.png. */
const ARMOR_IDS = new Set(ARMOR_CATALOG.map((a) => a.id))
/** Catalog ids plus untiered quick-pick names (dagger, shortsword, …). */
const WEAPON_IDS = new Set<string>([
  ...WEAPON_CATALOG.map((w) => w.id),
  ...COMMON_WEAPONS.map((w) => w.name.toLowerCase()),
])
/** Shield catalog ids are the file stem (shield-small.png, not shield-shield-small.png). */
const SHIELD_IDS = new Set(SHIELD_CATALOG.map((s) => s.id))
/** Legacy monster-part keys from salvage.ts that have their own PNG. scrap_* shares material-scrap.png. */
const PART_MATS = new Set(['wolf_pelt', 'goblin_rag', 'iron_scrap', 'ogre_hide', 'dragon_scale'])
/** Heal bottles that exist. Mythic (and any heal with no tier) uses potion-heal.png. */
const HEAL_BOTTLE: Partial<Record<Tier, string>> = {
  green: 'potion-heal-green.png',
  blue: 'potion-heal-blue.png',
  purple: 'potion-heal-purple.png',
  legendary: 'potion-heal-legendary.png',
}
const SPECIAL_FILES: Record<string, string> = {
  whisperfang: 'special-whisperfang.png',
  'lantern of the last road': 'special-pink-lantern.png',
  'gamblers pink coin': 'special-pink-coin.png',
}

const UPGRADED = new Set<Tier>(['legendary', 'mythic'])
/** Current tier words, plus the old Green/Blue/Purple labels still stored on some untiered weapons. */
const TIER_PREFIX = /^(?:common|rare|ultra rare|legendary|mythic|green|blue|purple)\s+/i

const up = (tier?: Tier) => (tier && UPGRADED.has(tier) ? '-up' : '')
const artSrc = (file: string) => `${import.meta.env.BASE_URL}items/${file}`

function bareName(name: string): string {
  return name.replace(TIER_PREFIX, '').replace(/['’]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

const ACCESSORY_BY_NAME = new Map(ACCESSORIES.map((a) => [bareName(a.name), a.id]))
const SHIELD_BY_NAME = new Map(SHIELD_CATALOG.map((s) => [bareName(s.name), s.id]))

type ArtItem = Pick<Item, 'kind' | 'name' | 'armorId' | 'weaponId' | 'tier' | 'shieldId' | 'materialKey' | 'catalogKey' | 'heal' | 'kitTier'>

function weaponArtId(it: { weaponId?: string; name: string }): string | null {
  if (it.weaponId) return WEAPON_IDS.has(it.weaponId) ? it.weaponId : null
  const bare = it.name.replace(TIER_PREFIX, '').trim().toLowerCase()
  return WEAPON_IDS.has(bare) ? bare : null
}

function shieldArtId(it: { shieldId?: string; name: string }): string | null {
  if (it.shieldId) return SHIELD_IDS.has(it.shieldId) ? it.shieldId : null
  return SHIELD_BY_NAME.get(bareName(it.name)) ?? null
}

/** Unique pink / black pieces, matched on the name specialGear.ts stores. */
function specialFile(name: string): string | null {
  const key = name.trim().toLowerCase().replace(/['’]/g, '').replace(/\s+/g, ' ')
  return SPECIAL_FILES[key] ?? null
}

function materialFile(key: string): string | null {
  if (PART_MATS.has(key)) return `material-${key}.png`
  if (key === 'scrap' || key.startsWith('scrap_')) return 'material-scrap.png'
  const tier = materialTier(key)
  if (tier && key === matKey(tier)) return `material-${tier}.png`
  return null
}

function isHeal(it: ArtItem): boolean {
  const cat = it.catalogKey ? catalogItem(it.catalogKey) : undefined
  if (it.heal) return true
  if (cat?.effect.kind === 'heal' || cat?.effect.kind === 'fullHeal') return true
  if (/^heal-/.test(it.catalogKey ?? '')) return true
  return /\bhealing potion\b/i.test(it.name) || /\bpotion of healing\b/i.test(it.name)
}

function isOil(it: ArtItem): boolean {
  const cat = it.catalogKey ? catalogItem(it.catalogKey) : undefined
  if (cat?.effect.kind === 'weaponType' || cat?.effect.kind === 'whetstone' || cat?.effect.kind === 'mirror') return true
  return /\boil\b/i.test(it.name)
}

function consumableFile(it: ArtItem): string {
  const cat = it.catalogKey ? catalogItem(it.catalogKey) : undefined
  if (it.kitTier || cat?.effect.kind === 'repairKit') return 'kit-repair.png'
  if (isHeal(it)) {
    const tier = it.tier ?? cat?.tier
    return (tier && HEAL_BOTTLE[tier]) || 'potion-heal.png'
  }
  if (isOil(it)) return 'oil-vial.png'
  return 'potion-generic.png'
}

/** Public URL for this item's PNG, or null when the card should keep KIND_ICON. */
export function itemArtSrc(it: ArtItem): string | null {
  const special = specialFile(it.name)
  if (special) return artSrc(special)

  let file: string | null = null
  if (it.kind === 'armor' && it.armorId && ARMOR_IDS.has(it.armorId)) file = `armor-${it.armorId}${up(it.tier)}.png`
  else if (it.kind === 'weapon') {
    const id = weaponArtId(it)
    if (id) file = `weapon-${id}${up(it.tier)}.png`
  } else if (it.kind === 'shield') {
    const id = shieldArtId(it)
    if (id) file = `${id}${up(it.tier)}.png`
  } else if (it.kind === 'scroll') file = 'scroll-generic.png'
  else if (it.kind === 'consumable') file = consumableFile(it)
  else if (it.kind === 'misc') {
    const mat = it.materialKey ? materialFile(it.materialKey) : null
    if (mat) file = mat
    else {
      const id = ACCESSORY_BY_NAME.get(bareName(it.name))
      if (id) file = `accessory-${id}${up(it.tier)}.png`
    }
  }
  return file ? artSrc(file) : null
}

export const POUCH_ART_SRC = `${import.meta.env.BASE_URL}items/pouch-gold.png`
