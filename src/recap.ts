// Per-session notes for the next-session recap. The DM clears the list when the session ends.
import { uid } from './types'

export type RecapKind = 'loot' | 'spend' | 'broken' | 'salvage' | 'fountain' | 'craft' | 'drop' | 'transfer' | 'repair'

export interface RecapEvent {
  id: string
  at: number
  kind: RecapKind
  text: string
}

export const RECAP_LABEL: Record<RecapKind, string> = {
  loot: 'Loot',
  spend: 'Spent',
  broken: 'Broken',
  salvage: 'Salvage',
  fountain: 'Fountain',
  craft: 'Craft',
  drop: 'Drop',
  transfer: 'Coins',
  repair: 'Repair',
}

export function makeRecap(kind: RecapKind, text: string, at = Date.now()): RecapEvent {
  return { id: uid(), at, kind, text }
}
