// PLACEHOLDER loot tables. Easier monsters lean Common. Harder tables are where Legendary shows up.
// Not every kill drops gear: each table has its own chance, defaulting near 20%.
import type { Item } from './types'
import { uid } from './types'
import type { Tier } from './armor'
import { armorItem } from './inventory'
import { materialItem } from './salvage'
import { tieredWeapon } from './weapons'

type GearMake = 'weapon' | 'armor' | 'named'

interface GearRow {
  weight: number
  make: GearMake
  tier: Tier
  weaponId?: string
  armorId?: string
  /** Overrides the generated name (the "goblin something" case). */
  name?: string
}
interface PartRow { weight: number; materialKey: string }

export interface LootTable {
  id: string
  name: string
  kind: 'monster' | 'location'
  /** Chance a part drops. PLACEHOLDER scarce default ~0.2. */
  partChance: number
  /** Chance a piece of gear drops. Independent of the part roll. */
  gearChance: number
  parts: PartRow[]
  gear: GearRow[]
}

export const LOOT_TABLES: LootTable[] = [
  {
    id: 'goblin', name: 'Goblin', kind: 'monster', partChance: 0.2, gearChance: 0.2,
    parts: [{ weight: 1, materialKey: 'goblin_rag' }],
    gear: [
      { weight: 5, make: 'weapon', weaponId: 'dagger', tier: 'green', name: 'Goblin Shiv' },
      { weight: 3, make: 'named', tier: 'green', name: 'Goblin Something' },
      { weight: 1, make: 'weapon', weaponId: 'shortbow', tier: 'blue' },
    ],
  },
  {
    id: 'wolf', name: 'Wolf', kind: 'monster', partChance: 0.2, gearChance: 0.05,
    parts: [{ weight: 1, materialKey: 'wolf_pelt' }],
    gear: [{ weight: 1, make: 'armor', armorId: 'leather', tier: 'green' }],
  },
  {
    id: 'ogre', name: 'Ogre', kind: 'monster', partChance: 0.2, gearChance: 0.35,
    parts: [{ weight: 1, materialKey: 'ogre_hide' }],
    gear: [
      { weight: 4, make: 'weapon', weaponId: 'greatsword', tier: 'green' },
      { weight: 2, make: 'weapon', weaponId: 'greatsword', tier: 'blue' },
      { weight: 1, make: 'weapon', weaponId: 'greatsword', tier: 'purple' },
    ],
  },
  {
    id: 'dragon', name: 'Dragon', kind: 'monster', partChance: 0.25, gearChance: 0.5,
    parts: [{ weight: 1, materialKey: 'dragon_scale' }],
    gear: [
      { weight: 4, make: 'armor', armorId: 'studded', tier: 'legendary' },
      { weight: 1, make: 'armor', armorId: 'studded', tier: 'mythic' },
    ],
  },
  {
    id: 'road', name: 'Open Road', kind: 'location', partChance: 0.1, gearChance: 0.15,
    parts: [{ weight: 1, materialKey: 'wolf_pelt' }],
    gear: [
      { weight: 4, make: 'weapon', weaponId: 'dagger', tier: 'green' },
      { weight: 1, make: 'armor', armorId: 'padded', tier: 'green' },
    ],
  },
  {
    id: 'vault', name: 'Ancient Vault', kind: 'location', partChance: 0.15, gearChance: 0.4,
    parts: [{ weight: 1, materialKey: 'dragon_scale' }],
    gear: [
      { weight: 3, make: 'weapon', weaponId: 'longsword', tier: 'purple' },
      { weight: 2, make: 'armor', armorId: 'leather', tier: 'legendary' },
      { weight: 1, make: 'weapon', weaponId: 'longsword', tier: 'mythic' },
    ],
  },
]

export const tableById = (id?: string) => LOOT_TABLES.find((t) => t.id === id)

export function tableForMonster(name: string): LootTable | undefined {
  const n = name.toLowerCase()
  return LOOT_TABLES.find((t) => t.kind === 'monster' && (n.includes(t.id) || n.includes(t.name.toLowerCase())))
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

function gearItem(g: GearRow): Item {
  if (g.make === 'weapon' && g.weaponId) {
    const it = tieredWeapon(g.weaponId, g.tier)
    return g.name ? { ...it, name: g.name } : it
  }
  if (g.make === 'armor' && g.armorId) return armorItem(g.armorId, g.tier)
  return {
    id: uid(), name: g.name ?? 'Goblin Something', kind: 'misc', qty: 1, tier: g.tier,
    description: 'PLACEHOLDER loot-table find. Not every monster drops one of these.',
  }
}

/** Independent part roll and gear roll. Either, both, or neither. */
export function rollLoot(table: LootTable, rng: () => number = Math.random): Item[] {
  const out: Item[] = []
  if (table.parts.length && rng() < table.partChance) out.push(materialItem(pickWeighted(table.parts, rng).materialKey, 1))
  if (table.gear.length && rng() < table.gearChance) out.push(gearItem(pickWeighted(table.gear, rng)))
  return out
}
