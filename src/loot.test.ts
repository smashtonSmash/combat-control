import { describe, expect, it } from 'vitest'
import { isStubDropName, splitEvenly, takeFrom, withoutStubDrops } from './loot'
import { MONSTER_PIES, inferLoadout, rollMonsterLoot, suggestMonsterTier } from './lootTables'

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

describe('monster loot pies', () => {
  const load = { lightSplit: true }
  const scripted = (values: number[]) => { let i = 0; return () => values[i++] ?? 0.99 }
  it('a miss is empty and a hit on the first slice is a gray mat', () => {
    expect(MONSTER_PIES.green.drop).toBe(0.2)
    expect(rollMonsterLoot('green', load, () => 0.99)).toEqual([])
    const hit = rollMonsterLoot('green', load, scripted([0, 0]))
    expect(hit).toHaveLength(1)
    expect(hit[0].materialKey).toBe('mat_gray')
  })
  it('mythic always drops legendary gear and sometimes a second mythic piece', () => {
    const one = rollMonsterLoot('mythic', { weaponId: 'longsword', lightSplit: true }, scripted([0, 0.9]))
    expect(one).toHaveLength(1)
    expect(one[0].tier).toBe('legendary')
    expect(one[0].weaponId).toBe('longsword')
    const two = rollMonsterLoot('mythic', { weaponId: 'dagger', lightSplit: false, armorId: 'plate' }, scripted([0, 0, 0]))
    expect(two.map((i) => i.tier)).toEqual(['legendary', 'mythic'])
  })
  it('names a goblin as green and an ogre as purple', () => {
    expect(suggestMonsterTier('Goblin')).toBe('green')
    expect(suggestMonsterTier('Ogre')).toBe('purple')
    const loadout = inferLoadout({ armor: 'Chain mail', attacks: [{ name: 'Greataxe' }] })
    expect(loadout.weaponId).toBe('greataxe')
    expect(loadout.armorId).toBe('chain-mail')
    expect(loadout.lightSplit).toBe(false)
  })
})

describe('stub drop names', () => {
  it('drops only the example labels, not a real goblin or a named item', () => {
    expect(isStubDropName('goblin')).toBe(true)
    expect(isStubDropName('Goblin Something')).toBe(true)
    expect(isStubDropName('Common Dagger')).toBe(false)
    expect(isStubDropName('Goblin 1')).toBe(false)
    const kept = withoutStubDrops([
      { name: 'goblin something' },
      { name: 'Common Dagger' },
      { name: 'Goblin 1' },
    ])
    expect(kept.map((i) => i.name)).toEqual(['Common Dagger', 'Goblin 1'])
  })
})
