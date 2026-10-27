// Two inspiration pips. The DM gives them. The ping is what plays the orb on the player view.
import type { Character } from './types'

export const INSPIRATION_SLOTS = 2

export function inspirationOf(c: { inspiration?: number }): number {
  return Math.max(0, Math.min(INSPIRATION_SLOTS, Math.floor(c.inspiration ?? 0)))
}

export function giveInspiration(c: Character, now = Date.now()): { char: Character; ok: boolean; message: string } {
  const cur = inspirationOf(c)
  if (cur >= INSPIRATION_SLOTS) {
    return { char: c, ok: false, message: `${c.name} already has ${INSPIRATION_SLOTS} inspiration.` }
  }
  const next = cur + 1
  return {
    char: { ...c, inspiration: next, inspirationPing: now },
    ok: true,
    message: `${c.name} gains inspiration (${next}/${INSPIRATION_SLOTS}).`,
  }
}

/**
 * Pings already on a character the first time we see them are persisted grants
 * (cold load, refresh, cloud rehydration). Only a later, higher ping is a new grant.
 * A global "primed" flag is wrong: the first effect often runs on an empty list,
 * then saved characters arrive and look brand new.
 */
export function observeInspiration(
  seen: ReadonlyMap<string, number>,
  characters: { id: string; name?: string; inspirationPing?: number }[],
): { seen: Map<string, number>; burst: { name: string; key: number } | null } {
  const next = new Map(seen)
  let burst: { name: string; key: number } | null = null
  for (const c of characters) {
    const ping = c.inspirationPing && c.inspirationPing > 0 ? c.inspirationPing : 0
    const prev = next.get(c.id)
    if (prev === undefined) {
      next.set(c.id, ping)
      continue
    }
    if (ping > prev) {
      next.set(c.id, ping)
      burst = { name: c.name?.trim() || 'Someone', key: ping }
    }
  }
  return { seen: next, burst }
}

/** Spend one pip. The benefit is still the table’s call — this only clears the slot. */
export function spendInspiration(c: Character): { char: Character; ok: boolean; message: string } {
  const cur = inspirationOf(c)
  if (cur <= 0) return { char: c, ok: false, message: `${c.name} has no inspiration to spend.` }
  return { char: { ...c, inspiration: cur - 1 }, ok: true, message: `${c.name} spends inspiration (${cur - 1}/${INSPIRATION_SLOTS}).` }
}
