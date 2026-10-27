import { describe, expect, it } from 'vitest'
import { defaultTown } from './fountain'
import type { Character } from './types'
import { buyVaultSlots, vaultBlockPrice } from './vault'

const hero = (gold: number): Character => ({
  id: 'h', name: 'Hero', cls: 'Fighter', level: 1, race: '',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  ac: 10, armor: '', maxHp: 10, currentHp: 10, initMod: 0, traits: [], attacks: [], notes: '',
  purse: { gold, silver: 0 },
})

describe('vault slot pricing', () => {
  it('doubles for each +5 block: 1, 2, 4, 8, 16, then 32', () => {
    expect([0, 1, 2, 3, 4].map(vaultBlockPrice)).toEqual([1, 2, 4, 8, 16])
    expect(vaultBlockPrice(5)).toBe(32)
  })
  it('buys five slots, charges that gold, and bumps the vault revision', () => {
    const town = defaultTown()
    const r = buyVaultSlots(hero(10), town)
    expect(r.ok).toBe(true)
    expect(r.town.vault?.slots).toBe(15)
    expect(r.town.vault?.blocks).toBe(1)
    expect(r.char.purse).toEqual({ gold: 9, silver: 0 })
    expect(r.town.vaultRev).toBe(1)
    const again = buyVaultSlots(r.char, r.town)
    expect(again.ok).toBe(true)
    expect(again.town.vault?.slots).toBe(20)
    expect(again.char.purse).toEqual({ gold: 7, silver: 0 })
    expect(again.town.vaultRev).toBe(2)
    expect(buyVaultSlots(hero(0), town).ok).toBe(false)
  })
})
