// All casino math is done in silver. 1 gold = 10 silver.
import type { Purse } from '../types'

export const SILVER_PER_GOLD = 10
export const purseTotal = (p?: Purse) => (p?.gold ?? 0) * SILVER_PER_GOLD + (p?.silver ?? 0)
export const toSilver = (amount: number, unit: 'gold' | 'silver') => Math.max(0, Math.floor(amount)) * (unit === 'gold' ? SILVER_PER_GOLD : 1)

/** "2g 5s" style label for a silver amount. */
export function fmtCoins(silver: number): string {
  const neg = silver < 0, s = Math.abs(silver)
  const g = Math.floor(s / SILVER_PER_GOLD), r = s % SILVER_PER_GOLD
  const txt = [g ? `${g}g` : '', r || !g ? `${r}s` : ''].filter(Boolean).join(' ')
  return (neg ? '−' : '') + txt
}

/**
 * Apply a win (+) or loss (−) in silver to a purse.
 * Wins are paid as gold + leftover silver. Losses are paid with silver first, then by breaking gold (change given in silver).
 * Returns null if the purse can't cover the loss.
 */
export function applyDelta(p: Purse | undefined, delta: number): Purse | null {
  let gold = p?.gold ?? 0, silver = p?.silver ?? 0
  delta = Math.trunc(delta)
  if (delta >= 0) return { gold: gold + Math.floor(delta / SILVER_PER_GOLD), silver: silver + (delta % SILVER_PER_GOLD) }
  let need = -delta
  if (need > gold * SILVER_PER_GOLD + silver) return null
  const fromSilver = Math.min(silver, need)
  silver -= fromSilver; need -= fromSilver
  if (need > 0) {
    const breakGold = Math.ceil(need / SILVER_PER_GOLD)
    gold -= breakGold
    silver += breakGold * SILVER_PER_GOLD - need
  }
  return { gold, silver }
}

// ---- payouts (amount RETURNED to the player for a stake already taken; whole silver, rounded down) ----
export const payEvenMoney = (stake: number) => stake * 2
export const payBlackjack = (stake: number) => stake + Math.floor((stake * 3) / 2) // 3:2, odd amounts round down to the silver
export const insuranceCost = (stake: number) => Math.floor(stake / 2)
export const payInsurance = (ins: number) => ins * 3 // 2:1 plus the insurance stake back
export const payOdds = (stake: number, toOne: number) => stake * (toOne + 1)
