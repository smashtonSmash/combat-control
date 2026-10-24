// Merchant personalities and a per-character favor bar.
// PLACEHOLDER math: each 5 favor removes 1% from that merchant's starting markup.

export type MerchantStyle = 'cheerful' | 'greedy' | 'shrewd' | 'friendly'

export interface Merchant {
  id: string
  name: string
  style: MerchantStyle
  personality: string
  /** Percent added to the shop price before favor. Negative is already a discount. */
  baseAdjust: number
}

export const MERCHANTS: Merchant[] = [
  { id: 'mara', name: 'Mara Quickcoin', style: 'cheerful', personality: 'Laughs at her own prices and rounds down once she likes you.', baseAdjust: -5 },
  { id: 'bram', name: 'Bram Ironthumb', style: 'greedy', personality: 'Starts high. Warmth is slow, and he remembers a haggle.', baseAdjust: 15 },
  { id: 'nessa', name: 'Nessa Vale', style: 'shrewd', personality: 'Quiet, exact, and unimpressed by flattery.', baseAdjust: 5 },
  { id: 'odo', name: 'Odo the Open', style: 'friendly', personality: 'Would rather you come back tomorrow than win today.', baseAdjust: 0 },
]

export const merchantById = (id?: string) => MERCHANTS.find((m) => m.id === id)

export function clampFavor(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** Shop adjust percent. Higher favor → smaller (better) number. */
export function favorAdjust(favor: number, merchant: { baseAdjust: number }): number {
  return merchant.baseAdjust - Math.floor(clampFavor(favor) / 5)
}

export function favorFace(favor: number): { emoji: string; label: string } {
  const f = clampFavor(favor)
  if (f >= 75) return { emoji: '😄', label: 'delighted' }
  if (f >= 50) return { emoji: '🙂', label: 'pleased' }
  if (f >= 25) return { emoji: '😐', label: 'neutral' }
  return { emoji: '😠', label: 'sour' }
}

export function favorOf(c: { favor?: Record<string, number> }, merchantId: string): number {
  return clampFavor(c.favor?.[merchantId] ?? 0)
}
