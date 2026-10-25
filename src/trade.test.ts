import { describe, expect, it } from 'vitest'
import { acceptTrade, declineTrade, proposeTrade } from './trade'
import type { Character, Item } from './types'

const hero = (id: string, name: string, inventory: Item[] = []): Character => ({
  id, name, cls: '', level: 1, race: '', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  ac: 10, armor: '', maxHp: 10, initMod: 0, traits: [], attacks: [], notes: '', inventory,
})
const blade: Item = { id: 'blade', name: 'Dagger', kind: 'weapon', qty: 1, description: '' }

describe('item trades', () => {
  it('holds the item until the recipient accepts', () => {
    const from = hero('a', 'Ada', [blade])
    const to = hero('b', 'Bo')
    const offered = proposeTrade(from, to.id, to.name, blade.id)
    expect(offered.ok).toBe(true)
    expect(offered.char.inventory!.map((i) => i.id)).toEqual(['blade'])
    expect(offered.char.trades).toHaveLength(1)
    expect(offered.char.trades![0].toId).toBe('b')
    const early = acceptTrade(from, to, offered.char.trades![0].id)
    expect(early.ok).toBe(false)
    const moved = acceptTrade(offered.char, to, offered.char.trades![0].id)
    expect(moved.ok).toBe(true)
    expect(moved.from.inventory ?? []).toEqual([])
    expect(moved.from.trades ?? []).toEqual([])
    expect(moved.to.inventory!.map((i) => i.name)).toEqual(['Dagger'])
  })
  it('decline leaves the item with the giver', () => {
    const from = hero('a', 'Ada', [blade])
    const offered = proposeTrade(from, 'b', 'Bo', blade.id)
    const next = declineTrade(offered.char, offered.char.trades![0].id)
    expect(next.trades ?? []).toEqual([])
    expect(next.inventory!.map((i) => i.id)).toEqual(['blade'])
    expect(acceptTrade(next, hero('b', 'Bo'), 'missing').ok).toBe(false)
  })
})