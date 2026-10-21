import { SILVER_PER_GOLD } from './casino/money'

export interface Pouch { id: string; gold: number; silver: number }
export const coinsToSilver = (g: number, s: number) => g * SILVER_PER_GOLD + s
export const silverToCoins = (t: number) => ({ gold: Math.floor(t / SILVER_PER_GOLD), silver: t % SILVER_PER_GOLD })

/** Take g/s out of a pile, making change from gold if silver runs short. Returns null if it can't. */
export function takeFrom(pile: { gold: number; silver: number }, g: number, s: number) {
  if (g < 0 || s < 0 || coinsToSilver(g, s) > coinsToSilver(pile.gold, pile.silver) || g > pile.gold) return null
  let gold = pile.gold - g, silver = pile.silver - s
  if (silver < 0) { const brk = Math.ceil(-silver / SILVER_PER_GOLD); if (brk > gold) return null; gold -= brk; silver += brk * SILVER_PER_GOLD }
  return { gold, silver }
}

/**
 * Split a pile evenly among n characters. Everything is converted to silver; each share is paid as gold + silver.
 * Leftover silver (total % n) goes back to the chest or to the first character.
 */
export function splitEvenly(gold: number, silver: number, n: number, leftoverTo: 'chest' | 'first') {
  const total = coinsToSilver(gold, silver)
  if (n <= 0) return { shares: [], leftover: total, chest: { gold, silver } }
  const each = Math.floor(total / n)
  const leftover = total - each * n
  const shares = Array.from({ length: n }, (_, i) => silverToCoins(each + (leftoverTo === 'first' && i === 0 ? leftover : 0)))
  return { shares, leftover, chest: leftoverTo === 'chest' ? { gold: 0, silver: leftover } : { gold: 0, silver: 0 } }
}
