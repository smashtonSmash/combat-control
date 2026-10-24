// Pink uniques and one named black mythic.
// Pink is NOT a step above Mythic. Black must be synced to its owner or it cannot be used.
import type { Character, Item } from './types'
import { uid } from './types'

export function pinkLantern(): Item {
  return {
    id: uid(), name: 'Lantern of the Last Road', kind: 'misc', qty: 1, special: 'pink', price: 0,
    description: 'Pink unique. Not part of the Common → Mythic ladder, and not stronger than Mythic.',
    abilityNote: 'PLACEHOLDER unique: once per long rest, the lantern shows one hidden path. No combat bonus. TBD.',
  }
}

export function pinkCoin(): Item {
  return {
    id: uid(), name: "Gambler's Pink Coin", kind: 'misc', qty: 1, special: 'pink', price: 0,
    description: 'Pink unique. Not part of the Common → Mythic ladder, and not stronger than Mythic.',
    abilityNote: 'PLACEHOLDER unique: once per day, reroll one haggle. No stat bonus. TBD.',
  }
}

export function whisperfang(): Item {
  return {
    id: uid(), name: 'Whisperfang', kind: 'weapon', qty: 1, special: 'black', synced: false,
    weaponStyle: 'melee', damage: '1d8', damageType: 'slashing', slotCost: 1,
    description: 'PLACEHOLDER named black mythic. It has a mind of its own. Sync with its owner or it will not be drawn. It is not a step above Mythic — the bond is the feature, and the rest is TBD.',
    abilityNote: 'PLACEHOLDER: while synced, Whisperfang may refuse a dishonorable strike. The DM decides. TBD.',
  }
}

/** Why this character cannot wield the item, or null if they can. */
export function wieldBlock(it: Item, ownerId: string): string | null {
  if (it.special !== 'black') return null
  if (!it.synced) return `${it.name} is not synced. A black mythic will not serve until its owner chooses to sync.`
  if (it.bondedTo && it.bondedTo !== ownerId) return `${it.name} is bonded to someone else.`
  return null
}

export function syncBlackMythic(c: Character, itemId: string): { char: Character; ok: boolean; message: string } {
  const it = (c.inventory ?? []).find((i) => i.id === itemId)
  if (!it || it.special !== 'black') return { char: c, ok: false, message: 'That is not a black mythic.' }
  const char: Character = {
    ...c,
    inventory: (c.inventory ?? []).map((i) => (i.id === itemId ? { ...i, synced: true, bondedTo: c.id } : i)),
  }
  return { char, ok: true, message: `${c.name} syncs with ${it.name}. It answers to them now.` }
}

export function unsyncBlackMythic(c: Character, itemId: string): Character {
  return {
    ...c,
    inventory: (c.inventory ?? []).map((i) => (i.id === itemId ? { ...i, synced: false, bondedTo: undefined, equipped: false } : i)),
  }
}
