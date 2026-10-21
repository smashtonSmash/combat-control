// European single-zero roulette.
import { payOdds } from './money'

export const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])
export const colorOf = (n: number) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black')

export type BetKey =
  | `n${number}` | 'red' | 'black' | 'odd' | 'even' | 'low' | 'high'
  | 'dozen1' | 'dozen2' | 'dozen3' | 'col1' | 'col2' | 'col3'

export const BET_LABEL: Record<string, string> = {
  red: 'Red', black: 'Black', odd: 'Odd', even: 'Even', low: '1–18', high: '19–36',
  dozen1: '1st 12', dozen2: '2nd 12', dozen3: '3rd 12', col1: 'Col 1', col2: 'Col 2', col3: 'Col 3',
}
export const betLabel = (k: BetKey) => (k.startsWith('n') ? `#${k.slice(1)}` : BET_LABEL[k])

/** x:1 odds for a bet */
export const oddsOf = (k: BetKey) => (k.startsWith('n') ? 35 : k.startsWith('dozen') || k.startsWith('col') ? 2 : 1)

export function wins(k: BetKey, n: number): boolean {
  if (k.startsWith('n')) return Number(k.slice(1)) === n
  if (n === 0) return false
  switch (k) {
    case 'red': return RED.has(n)
    case 'black': return !RED.has(n)
    case 'odd': return n % 2 === 1
    case 'even': return n % 2 === 0
    case 'low': return n <= 18
    case 'high': return n >= 19
    case 'dozen1': return n <= 12
    case 'dozen2': return n >= 13 && n <= 24
    case 'dozen3': return n >= 25
    case 'col1': return n % 3 === 1
    case 'col2': return n % 3 === 2
    case 'col3': return n % 3 === 0
  }
  return false
}

/** Silver returned for a set of bets (stakes already taken). */
export function settle(bets: Partial<Record<BetKey, number>>, n: number) {
  let returned = 0
  const lines: { key: BetKey; stake: number; won: boolean; back: number }[] = []
  for (const [k, stake] of Object.entries(bets) as [BetKey, number][]) {
    const won = wins(k, n)
    const back = won ? payOdds(stake, oddsOf(k)) : 0
    returned += back
    lines.push({ key: k, stake, won, back })
  }
  return { returned, lines }
}

export const spinNumber = (rand: () => number = Math.random) => Math.floor(rand() * 37)
