// Shared party stash and purse transfers. The shared pool is optional (DM toggle).
import type { Character, Item, Purse } from './types'
import { addItem, removeItem, unequip } from './inventory'

export interface PartyStash {
  shared: boolean
  gold: number
  silver: number
  items: Item[]
}

export const emptyParty = (): PartyStash => ({ shared: false, gold: 0, silver: 0, items: [] })

export const purseSilver = (p?: Purse | null) => (p?.gold ?? 0) * 10 + (p?.silver ?? 0)
export function fromSilver(silver: number): Purse {
  const n = Math.max(0, Math.floor(silver))
  return { gold: Math.floor(n / 10), silver: n % 10 }
}

export function transferPurse(from: Purse | undefined, to: Purse | undefined, gold: number, silver: number):
  { ok: boolean; from: Purse; to: Purse; message: string } {
  const cost = Math.max(0, Math.floor(gold)) * 10 + Math.max(0, Math.floor(silver))
  const src = from ?? { gold: 0, silver: 0 }
  const dst = to ?? { gold: 0, silver: 0 }
  if (cost <= 0) return { ok: false, from: src, to: dst, message: 'Enter an amount.' }
  if (purseSilver(src) < cost) return { ok: false, from: src, to: dst, message: 'Not enough coin.' }
  return {
    ok: true,
    from: fromSilver(purseSilver(src) - cost),
    to: fromSilver(purseSilver(dst) + cost),
    message: `Sent ${Math.floor(cost / 10)}g ${cost % 10}s.`,
  }
}

export function depositItem(c: Character, stash: PartyStash, itemId: string): { char: Character; stash: PartyStash; ok: boolean; message: string } {
  const it = (c.inventory ?? []).find((i) => i.id === itemId)
  if (!it) return { char: c, stash, ok: false, message: 'That item is not in the pack.' }
  if (!stash.shared) return { char: c, stash, ok: false, message: 'The party stash is off.' }
  const cleared = it.equipped ? unequip(c, itemId) : c
  return {
    char: removeItem(cleared, itemId),
    stash: { ...stash, items: [...stash.items, { ...it, equipped: false }] },
    ok: true,
    message: `${it.name} goes into the party stash.`,
  }
}

export function withdrawItem(c: Character, stash: PartyStash, itemId: string): { char: Character; stash: PartyStash; ok: boolean; message: string } {
  const it = stash.items.find((i) => i.id === itemId)
  if (!it) return { char: c, stash, ok: false, message: 'That item is not in the stash.' }
  return {
    char: addItem(c, { ...it, equipped: false }),
    stash: { ...stash, items: stash.items.filter((i) => i.id !== itemId) },
    ok: true,
    message: `${c.name} takes ${it.name} from the stash.`,
  }
}
