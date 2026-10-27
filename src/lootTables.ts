// Monster rarity pies. Pink and black named gear are not on these tables.
// A gear hit is the weapon they are holding, or fitting armor.
// Light armor (and anything we can't name) splits evenly across padded / leather / studded.
import type { Item } from './types'
import type { Tier } from './armor'
import { armorById } from './armor'
import { armorItem } from './inventory'
import { type MatTier, materialItem } from './salvage'
import { WEAPON_CATALOG, tieredWeapon, weaponById } from './weapons'

export interface MonsterLoadout {
  weaponId?: string
  /** A specific medium or heavy suit. Light suits use lightSplit instead. */
  armorId?: string
  lightSplit: boolean
}

type Slice = { weight: number; kind: 'mat'; mat: MatTier } | { weight: number; kind: 'gear'; tier: Tier }

export interface MonsterPie {
  drop: number
  slices: Slice[]
}

export const MONSTER_PIES: Record<Tier, MonsterPie> = {
  green: {
    drop: 0.2,
    slices: [
      { weight: 70, kind: 'mat', mat: 'gray' },
      { weight: 5, kind: 'mat', mat: 'green' },
      { weight: 25, kind: 'gear', tier: 'green' },
    ],
  },
  blue: {
    drop: 0.3,
    slices: [
      { weight: 35, kind: 'mat', mat: 'gray' },
      { weight: 15, kind: 'mat', mat: 'green' },
      { weight: 15, kind: 'mat', mat: 'blue' },
      { weight: 20, kind: 'gear', tier: 'green' },
      { weight: 15, kind: 'gear', tier: 'blue' },
    ],
  },
  purple: {
    drop: 0.4,
    slices: [
      { weight: 15, kind: 'mat', mat: 'green' },
      { weight: 20, kind: 'mat', mat: 'blue' },
      { weight: 20, kind: 'mat', mat: 'purple' },
      { weight: 10, kind: 'gear', tier: 'green' },
      { weight: 15, kind: 'gear', tier: 'blue' },
      { weight: 20, kind: 'gear', tier: 'purple' },
    ],
  },
  legendary: {
    drop: 0.6,
    slices: [
      { weight: 10, kind: 'gear', tier: 'green' },
      { weight: 30, kind: 'gear', tier: 'blue' },
      { weight: 30, kind: 'gear', tier: 'purple' },
      { weight: 30, kind: 'gear', tier: 'legendary' },
    ],
  },
  // Mythic is not a pie: always one legendary piece, plus a 50% extra mythic piece.
  mythic: { drop: 1, slices: [] },
}

const LIGHT = ['padded', 'leather', 'studded']

const ARMOR_MATCH: { id: string; re: RegExp }[] = [
  { id: 'studded', re: /studded/i },
  { id: 'half-plate', re: /half[\s-]*plate/i },
  { id: 'breastplate', re: /breastplate/i },
  { id: 'chain-shirt', re: /chain[\s-]*shirt/i },
  { id: 'chain-mail', re: /chain[\s-]*mail|chainmail/i },
  { id: 'scale-mail', re: /scale/i },
  { id: 'ring-mail', re: /ring[\s-]*mail/i },
  { id: 'splint', re: /splint/i },
  { id: 'plate', re: /\bplate\b/i },
  { id: 'leather', re: /leather/i },
  { id: 'padded', re: /padded/i },
  { id: 'hide', re: /\bhide\b/i },
]

export function suggestMonsterTier(name: string): Tier {
  const n = name.toLowerCase()
  if (/ancient|tarrasque|titan|lich|greatwyrm/.test(n)) return 'mythic'
  if (/dragon|beholder|vampire|demon|devil|lich/.test(n)) return 'legendary'
  if (/ogre|troll|giant|wyvern|owlbear/.test(n)) return 'purple'
  if (/orc|hobgoblin|gnoll|bugbear|ogre/.test(n)) return 'blue'
  return 'green'
}

export function inferLoadout(c: { armor?: string; attacks?: { name: string }[]; lootWeaponId?: string; lootArmorId?: string }): MonsterLoadout {
  const weapons = [...WEAPON_CATALOG].sort((a, b) => b.name.length - a.name.length)
  let weaponId = c.lootWeaponId && weaponById(c.lootWeaponId) ? c.lootWeaponId : undefined
  if (!weaponId) {
    for (const atk of c.attacks ?? []) {
      const n = atk.name.toLowerCase()
      const hit = weapons.find((w) => n.includes(w.name.toLowerCase()))
      if (hit) { weaponId = hit.id; break }
    }
  }
  let armorId = c.lootArmorId && armorById(c.lootArmorId) ? c.lootArmorId : undefined
  if (!armorId && c.armor) {
    const hit = ARMOR_MATCH.find((a) => a.re.test(c.armor!))
    if (hit) armorId = hit.id
  }
  const cat = armorId ? armorById(armorId)?.category : undefined
  const lightSplit = !armorId || cat === 'light'
  if (lightSplit) armorId = undefined
  return { weaponId, armorId, lightSplit }
}

function pickWeighted<T extends { weight: number }>(rows: T[], rng: () => number): T {
  const total = rows.reduce((s, r) => s + r.weight, 0)
  let x = rng() * total
  for (const r of rows) {
    x -= r.weight
    if (x <= 0) return r
  }
  return rows[rows.length - 1]
}

function rollGear(tier: Tier, load: MonsterLoadout, rng: () => number): Item {
  const weapon = load.weaponId && weaponById(load.weaponId) ? load.weaponId : undefined
  const specific = load.armorId && armorById(load.armorId) ? load.armorId : undefined
  const canWeapon = !!weapon
  const canArmor = !!(specific || load.lightSplit)
  if (canWeapon && (!canArmor || rng() < 0.5)) return tieredWeapon(weapon!, tier)
  if (specific) return armorItem(specific, tier)
  return armorItem(LIGHT[Math.floor(rng() * LIGHT.length)] ?? 'padded', tier)
}

/** One kill. Mythic always drops legendary gear and has a 50% chance of an extra mythic piece. */
export function rollMonsterLoot(tier: Tier, load: MonsterLoadout, rng: () => number = Math.random): Item[] {
  if (tier === 'mythic') {
    const out = [rollGear('legendary', load, rng)]
    if (rng() < 0.5) out.push(rollGear('mythic', load, rng))
    return out
  }
  const pie = MONSTER_PIES[tier]
  if (!pie.slices.length || rng() >= pie.drop) return []
  const slice = pickWeighted(pie.slices, rng)
  if (slice.kind === 'mat') return [materialItem(slice.mat, 1)]
  return [rollGear(slice.tier, load, rng)]
}
