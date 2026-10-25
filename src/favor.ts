// Merchant personalities and a per-character favor bar.
// Favor runs −100 (left) to +100 (right). 0 sits in the center.
// PLACEHOLDER math: each 5 favor removes 1% from that merchant's starting markup.
// At or below REFUSE_FAVOR the merchant will not sell.

export type MerchantStyle = 'cheerful' | 'greedy' | 'shrewd' | 'friendly'
export const MERCHANT_TRADES = ['Blacksmith', 'Baker', 'Innkeeper', 'General store', 'Alchemist', 'Jeweler', 'Stablehand', 'Herbalist', 'Custom'] as const
export type MerchantTrade = (typeof MERCHANT_TRADES)[number]

export interface Merchant {
  id: string
  name: string
  style: MerchantStyle
  personality: string
  /** Percent added to the shop price before favor. Negative is already a discount. */
  baseAdjust: number
  /** Shop type, when this merchant was added at the table. */
  trade?: string
  custom?: boolean
}

export const FAVOR_MIN = -100
export const FAVOR_MAX = 100
/** At or below this, the merchant refuses to sell. */
export const REFUSE_FAVOR = -40

export const MERCHANTS: Merchant[] = [
  { id: 'mara', name: 'Mara Quickcoin', style: 'cheerful', personality: 'Laughs at her own prices and rounds down once she likes you.', baseAdjust: -5 },
  { id: 'bram', name: 'Bram Ironthumb', style: 'greedy', personality: 'Starts high. Warmth is slow, and he remembers a haggle.', baseAdjust: 15 },
  { id: 'nessa', name: 'Nessa Vale', style: 'shrewd', personality: 'Quiet, exact, and unimpressed by flattery.', baseAdjust: 5 },
  { id: 'odo', name: 'Odo the Open', style: 'friendly', personality: 'Would rather you come back tomorrow than win today.', baseAdjust: 0 },
]

export const merchantById = (id?: string, extra: Merchant[] = []) => [...MERCHANTS, ...extra].find((m) => m.id === id)
export const allMerchants = (extra?: Merchant[]) => [...MERCHANTS, ...(extra ?? [])]

const TRADE_PRESET: Record<string, Pick<Merchant, 'style' | 'baseAdjust' | 'personality'>> = {
  Blacksmith: { style: 'greedy', baseAdjust: 10, personality: 'Hammers out a price and remembers a haggle.' },
  Baker: { style: 'friendly', baseAdjust: 0, personality: 'Flour-dusted, and happy to throw in a roll once they know you.' },
  Innkeeper: { style: 'cheerful', baseAdjust: -5, personality: 'Keeps a room and a rumor, and rounds down for regulars.' },
  'General store': { style: 'shrewd', baseAdjust: 5, personality: 'Stocks a bit of everything and counts the coins twice.' },
  Alchemist: { style: 'shrewd', baseAdjust: 10, personality: 'The vials are priced for the work, not for your smile.' },
  Jeweler: { style: 'greedy', baseAdjust: 15, personality: 'Starts high. Warmth is slow.' },
  Stablehand: { style: 'friendly', baseAdjust: 0, personality: 'Would rather the horse come back sound than win the haggle.' },
  Herbalist: { style: 'cheerful', baseAdjust: 0, personality: 'Bundles herbs and talks while they tie the string.' },
  Custom: { style: 'shrewd', baseAdjust: 5, personality: 'Sets their own prices.' },
}

export function merchantFromTrade(name: string, trade: string, id: string): Merchant {
  const key = TRADE_PRESET[trade] ? trade : 'Custom'
  const preset = TRADE_PRESET[key]
  const label = trade.trim() || 'Custom'
  return {
    id, name: name.trim(), trade: label, custom: true, style: preset.style, baseAdjust: preset.baseAdjust,
    personality: key === 'Custom' ? `A ${label.toLowerCase()} with their own prices.` : preset.personality,
  }
}

export function clampFavor(n: number): number {
  return Math.max(FAVOR_MIN, Math.min(FAVOR_MAX, Math.round(n)))
}

/** Shop adjust percent. Higher favor → smaller (better) number. */
export function favorAdjust(favor: number, merchant: { baseAdjust: number }): number {
  return merchant.baseAdjust - Math.floor(clampFavor(favor) / 5)
}

export function favorFace(favor: number): { emoji: string; label: string } {
  const f = clampFavor(favor)
  if (f <= REFUSE_FAVOR) return { emoji: '🚫', label: 'refuses' }
  if (f >= 60) return { emoji: '😄', label: 'delighted' }
  if (f >= 20) return { emoji: '🙂', label: 'pleased' }
  if (f >= -19) return { emoji: '😐', label: 'neutral' }
  return { emoji: '😠', label: 'cold' }
}

export function refusesToSell(favor: number): boolean {
  return clampFavor(favor) <= REFUSE_FAVOR
}

export function favorOf(c: { favor?: Record<string, number> }, merchantId: string): number {
  return clampFavor(c.favor?.[merchantId] ?? 0)
}
