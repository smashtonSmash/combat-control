// Item trades stay on the giver until the recipient accepts.
import type { Character, ItemTrade } from './types'
import { uid } from './types'
import { addItem, removeItem, unequip } from './inventory'

export function proposeTrade(from: Character, toId: string, toName: string, itemId: string): { ok: boolean; char: Character; message: string } {
  const it = (from.inventory ?? []).find((i) => i.id === itemId)
  if (!it) return { ok: false, char: from, message: 'That item is not in the pack.' }
  if (!toId || toId === from.id) return { ok: false, char: from, message: 'Pick someone else.' }
  const trade: ItemTrade = { id: uid(), toId, toName, itemId, itemName: it.name, at: Date.now() }
  const trades = [...(from.trades ?? []).filter((t) => t.itemId !== itemId), trade]
  return { ok: true, char: { ...from, trades }, message: `Offered ${it.name} to ${toName}. They need to accept.` }
}

export function declineTrade(from: Character, tradeId: string): Character {
  return { ...from, trades: (from.trades ?? []).filter((t) => t.id !== tradeId) }
}

/** Move the item only after accept. A missing offer or a missing item does not transfer anything. */
export function acceptTrade(from: Character, to: Character, tradeId: string): { ok: boolean; from: Character; to: Character; message: string } {
  const trade = (from.trades ?? []).find((t) => t.id === tradeId)
  if (!trade || trade.toId !== to.id) return { ok: false, from, to, message: 'That offer is not for them.' }
  const it = (from.inventory ?? []).find((i) => i.id === trade.itemId)
  if (!it) {
    return { ok: false, from: declineTrade(from, tradeId), to, message: 'That item is no longer in the pack.' }
  }
  const cleared = it.equipped ? unequip(from, it.id) : from
  const giver = removeItem(declineTrade(cleared, tradeId), it.id)
  const receiver = addItem(to, { ...it, equipped: false })
  return { ok: true, from: giver, to: receiver, message: `${to.name} accepts ${it.name}.` }
}
