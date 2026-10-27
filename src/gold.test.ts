import { describe, expect, it } from 'vitest'
import { manualGold, receiveGold } from './gold'

describe('gold permissions', () => {
  const purse = { gold: 4, silver: 3 }

  it('lets only the DM add gold', () => {
    const player = manualGold(purse, 'add', 'gold', 2, false)
    expect(player.ok).toBe(false)
    expect(player.purse).toEqual(purse)
    const dm = manualGold(purse, 'add', 'gold', 2, true)
    expect(dm.ok).toBe(true)
    expect(dm.purse).toEqual({ gold: 6, silver: 3 })
  })
  it('lets a player spend, and still receive loot or a sale', () => {
    const spent = manualGold(purse, 'spend', 'gold', 1, false)
    expect(spent.ok).toBe(true)
    expect(spent.purse).toEqual({ gold: 3, silver: 3 })
    expect(receiveGold(purse, 5, 2)).toEqual({ gold: 9, silver: 5 })
  })
})
