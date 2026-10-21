import type { Chest, Item } from './types'

export const TIER_RANK: Record<string, number> = { green: 1, blue: 2, purple: 3, legendary: 4, mythic: 5 }
export type RevealEntry =
  | { type: 'item'; key: string; item: Item; rank: number; delay: number }
  | { type: 'pouch'; key: string; gold: number; silver: number; rank: 0; delay: number }
  | { type: 'coins'; key: string; gold: number; silver: number; rank: 0; delay: number }

/** Highest drama level in the chest: 0 normal, 4 legendary, 5 mythic. */
export function chestDrama(chest: Chest): 0 | 4 | 5 {
  const top = Math.max(0, ...chest.items.map((i) => TIER_RANK[i.tier ?? ''] ?? 0))
  return top >= 5 ? 5 : top >= 4 ? 4 : 0
}

/** Items lowest→highest tier (untiered + coins first, stable), with staggered delays and a dramatic pause before legendary/mythic. */
export function revealOrder(chest: Chest, step = 0.16, pause = 0.7): RevealEntry[] {
  const items = chest.items.map((item, i) => ({ item, i, rank: TIER_RANK[item.tier ?? ''] ?? 0 }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
  const out: RevealEntry[] = []
  for (const x of items.filter((x) => x.rank === 0)) out.push({ type: 'item', key: x.item.id, item: x.item, rank: 0, delay: 0 })
  for (const q of chest.pouches ?? []) out.push({ type: 'pouch', key: q.id, gold: q.gold, silver: q.silver, rank: 0, delay: 0 })
  if (chest.gold > 0 || chest.silver > 0) out.push({ type: 'coins', key: 'coins', gold: chest.gold, silver: chest.silver, rank: 0, delay: 0 })
  for (const x of items.filter((x) => x.rank > 0)) out.push({ type: 'item', key: x.item.id, item: x.item, rank: x.rank, delay: 0 })
  let t = 0, prev = 0
  for (const e of out) {
    if (e.rank >= 4 && e.rank > prev) t += pause * (e.rank === 5 ? 1.5 : 1)
    e.delay = +t.toFixed(2); t += step; prev = Math.max(prev, e.rank)
  }
  return out
}
