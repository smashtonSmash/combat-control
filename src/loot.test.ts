import { describe, expect, it } from 'vitest'
import { splitEvenly, takeFrom } from './loot'

describe('loot coins', () => {
  it('takes pouches out of the pile', () => {
    expect(takeFrom({ gold: 50, silver: 0 }, 10, 0)).toEqual({ gold: 40, silver: 0 })
    expect(takeFrom({ gold: 5, silver: 2 }, 0, 7)).toEqual({ gold: 4, silver: 5 })
    expect(takeFrom({ gold: 5, silver: 0 }, 6, 0)).toBeNull()
    expect(takeFrom({ gold: 0, silver: 9 }, 1, 0)).toBeNull()
  })
  it('splits evenly with leftovers', () => {
    expect(splitEvenly(25, 0, 4, 'chest')).toEqual({ shares: Array(4).fill({ gold: 6, silver: 2 }), leftover: 2, chest: { gold: 0, silver: 2 } })
    const f = splitEvenly(25, 0, 4, 'first')
    expect(f.shares[0]).toEqual({ gold: 6, silver: 4 }); expect(f.shares[1]).toEqual({ gold: 6, silver: 2 }); expect(f.chest).toEqual({ gold: 0, silver: 0 })
    expect(splitEvenly(10, 0, 3, 'chest').shares[0]).toEqual({ gold: 3, silver: 3 })
  })
})
