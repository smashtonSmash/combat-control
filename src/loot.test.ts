import { describe, expect, it } from 'vitest'
import { splitEvenly, takeFrom } from './loot'
import { LOOT_TABLES, rollLoot } from './lootTables'

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

describe('monster loot rolls', () => {
  const goblin = LOOT_TABLES.find((t) => t.id === 'goblin')!
  const scripted = (values: number[]) => { let i = 0; return () => values[i++] ?? 0.99 }
  it('a high roll misses and a zero roll hits both chances', () => {
    expect(rollLoot(goblin, () => 0.99)).toEqual([])
    const hit = rollLoot(goblin, () => 0)
    expect(hit).toHaveLength(2)
    expect(hit.some((i) => i.materialKey)).toBe(true)
  })
  it('part and gear chances land near 20%', () => {
    const seq: number[] = []
    let partHits = 0
    let gearHits = 0
    for (let i = 0; i < 100; i++) {
      const p = i / 100
      const g = ((i * 7) % 100) / 100
      seq.push(p)
      if (p < goblin.partChance) { partHits++; seq.push(0) }
      seq.push(g)
      if (g < goblin.gearChance) { gearHits++; seq.push(0) }
    }
    const rng = scripted(seq)
    let gotP = 0
    let gotG = 0
    for (let i = 0; i < 100; i++) {
      const items = rollLoot(goblin, rng)
      if (items.some((x) => x.materialKey)) gotP++
      if (items.some((x) => !x.materialKey)) gotG++
    }
    expect(goblin.partChance).toBe(0.2)
    expect(goblin.gearChance).toBe(0.2)
    expect(gotP).toBe(partHits)
    expect(gotG).toBe(gearHits)
    expect(partHits).toBe(20)
  })
})
