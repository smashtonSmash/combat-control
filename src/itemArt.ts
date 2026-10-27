// First-batch item art in public/items/. Emoji stays the fallback when nothing here matches.
import type { Tier } from './armor'
import { COMMON_WEAPONS } from './inventory'
import type { Item } from './types'
import { WEAPON_CATALOG } from './weapons'

/** Only the first-batch PNGs. Newer armor (hide, plate, shields) keeps KIND_ICON until art lands. */
const ARMOR_IDS = new Set<string>(['padded', 'leather', 'studded'])
/** Catalog ids plus untiered quick-pick names (dagger, shortsword, …). */
const WEAPON_IDS = new Set<string>([
  ...WEAPON_CATALOG.map((w) => w.id),
  ...COMMON_WEAPONS.map((w) => w.name.toLowerCase()),
])

const UPGRADED = new Set<Tier>(['legendary', 'mythic'])
/** Current tier words, plus the old Green/Blue/Purple labels still stored on some untiered weapons. */
const TIER_PREFIX = /^(?:common|rare|ultra rare|legendary|mythic|green|blue|purple)\s+/i

const up = (tier?: Tier) => (tier && UPGRADED.has(tier) ? '-up' : '')

function weaponArtId(it: { weaponId?: string; name: string }): string | null {
  if (it.weaponId) return WEAPON_IDS.has(it.weaponId) ? it.weaponId : null
  const bare = it.name.replace(TIER_PREFIX, '').trim().toLowerCase()
  return WEAPON_IDS.has(bare) ? bare : null
}

/** Public URL for this item's PNG, or null when the card should keep KIND_ICON. */
export function itemArtSrc(it: Pick<Item, 'kind' | 'name' | 'armorId' | 'weaponId' | 'tier'>): string | null {
  let file: string | null = null
  if (it.kind === 'armor' && it.armorId && ARMOR_IDS.has(it.armorId)) file = `armor-${it.armorId}${up(it.tier)}.png`
  else if (it.kind === 'weapon') {
    const id = weaponArtId(it)
    if (id) file = `weapon-${id}${up(it.tier)}.png`
  }
  return file ? `${import.meta.env.BASE_URL}items/${file}` : null
}

export const POUCH_ART_SRC = `${import.meta.env.BASE_URL}items/pouch-gold.png`
