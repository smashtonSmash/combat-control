// Town wishing fountain. The accepting threshold is rolled from a short list and kept off the main UI.
import type { Merchant } from './favor'
import type { Item } from './types'
import { uid } from './types'

export const FOUNTAIN_THRESHOLDS = [10, 50, 100, 200] as const
export type FountainThreshold = (typeof FOUNTAIN_THRESHOLDS)[number]

export interface FountainState {
  /** Silver offered since the last reward. 10 silver = 1 gold. */
  contributedSilver: number
  /** Secret gold target. Null until the first coin of this pool is offered. */
  thresholdGold: number | null
}

export interface TownPlace { id: string; name: string; hasFountain: boolean }
export interface TownState {
  places: TownPlace[]
  currentId: string
  fountain: FountainState
  /** Merchants added at the table. */
  merchants?: Merchant[]
  /** Built-in example merchant ids the DM removed. Custom merchants are dropped from `merchants` instead. */
  removedMerchantIds?: string[]
}

export function defaultTown(): TownState {
  return {
    places: [{ id: 'crossroads', name: 'Crossroads', hasFountain: true }],
    currentId: 'crossroads',
    fountain: { contributedSilver: 0, thresholdGold: null },
  }
}

export function currentPlace(t: TownState): TownPlace | undefined {
  return t.places.find((p) => p.id === t.currentId) ?? t.places[0]
}

export function pickThreshold(rng: () => number = Math.random): FountainThreshold {
  const i = Math.min(FOUNTAIN_THRESHOLDS.length - 1, Math.max(0, Math.floor(rng() * FOUNTAIN_THRESHOLDS.length)))
  return FOUNTAIN_THRESHOLDS[i]
}

export interface OfferResult {
  state: FountainState
  granted: boolean
  rewardNote?: string
}

/**
 * Add silver (gold × 10 + silver) to the pool.
 * The whole offering is kept. One placeholder reward when the secret gold threshold is met, then the pool and the secret both reset.
 */
export function offerToFountain(state: FountainState, silver: number, rng: () => number = Math.random): OfferResult {
  const add = Math.max(0, Math.floor(silver))
  if (add <= 0) return { state, granted: false }
  const threshold = state.thresholdGold ?? pickThreshold(rng)
  const next = state.contributedSilver + add
  if (next >= threshold * 10) {
    return {
      granted: true,
      rewardNote: 'PLACEHOLDER reward (TBD): the fountain accepts the offering. Ashton will replace this token with the real prize.',
      state: { contributedSilver: 0, thresholdGold: pickThreshold(rng) },
    }
  }
  return { granted: false, state: { contributedSilver: next, thresholdGold: threshold } }
}

export function fountainReward(): Item {
  return {
    id: uid(),
    name: 'Fountain Gift (TBD)',
    kind: 'misc',
    qty: 1,
    description: 'PLACEHOLDER reward. The real prize is not designed yet. This token only marks that the secret threshold was met.',
  }
}

export function goldLabelFromSilver(silver: number): string {
  const g = Math.floor(silver / 10)
  const s = silver % 10
  return s ? `${g}g ${s}s` : `${g}g`
}
