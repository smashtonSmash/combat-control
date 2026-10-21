// Ability score generation: 4d6 drop lowest, point buy (27), physical dice entry.
export const POINT_BUY_BUDGET = 27
export const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
export const PB_MIN = 8, PB_MAX = 15
export const pointBuyCost = (scores: number[]) => scores.reduce((s, v) => s + (POINT_COST[v] ?? Infinity), 0)
export const pointsLeft = (scores: number[]) => POINT_BUY_BUDGET - pointBuyCost(scores)
export const canRaise = (scores: number[], i: number) => scores[i] < PB_MAX && POINT_COST[scores[i] + 1] - POINT_COST[scores[i]] <= pointsLeft(scores)
export const canLower = (scores: number[], i: number) => scores[i] > PB_MIN
export const validPointBuy = (scores: number[]) => scores.length === 6 && scores.every((v) => v >= PB_MIN && v <= PB_MAX) && pointBuyCost(scores) <= POINT_BUY_BUDGET

export interface Roll4d6 { dice: number[]; drop: number; total: number }
/** Roll 4d6 and drop the lowest. `drop` is the index of the dropped die. */
export function roll4d6(rng: () => number = Math.random): Roll4d6 {
  const dice = Array.from({ length: 4 }, () => 1 + Math.floor(rng() * 6))
  return dropLowest(dice)
}
export function dropLowest(dice: number[]): Roll4d6 {
  let drop = 0
  dice.forEach((d, i) => { if (d < dice[drop]) drop = i })
  return { dice, drop, total: dice.reduce((s, d, i) => s + (i === drop ? 0 : d), 0) }
}
export const rollSet = (rng?: () => number) => Array.from({ length: 6 }, () => roll4d6(rng))
