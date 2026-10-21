import { describe, expect, it } from 'vitest'
import { scrollStats, fromSrd, type SrdSpell } from './spells'
import { addItem, scrollItem, useItem } from './inventory'
import spells from './data/spells.json'
import type { Character } from './types'

const fireball = fromSrd((spells as SrdSpell[]).find((s) => s.i === 'fireball')!, 'fb')
const fighter = (): Character => ({ id: 't', name: 'Thorin', cls: 'Fighter', level: 3, race: '', abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
  ac: 12, armor: '', maxHp: 30, initMod: 1, traits: [], attacks: [], notes: '' })

describe('spell scrolls', () => {
  it('uses the standard scroll table', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => scrollStats(l).dc)).toEqual([13, 13, 13, 15, 15, 17, 17, 18, 18, 19])
    expect(scrollStats(3).attack).toBe(7); expect(scrollStats(9).attack).toBe(11)
  })
  it('creates stackable scroll items carrying the spell', () => {
    const it = scrollItem(fireball)
    expect(it).toMatchObject({ name: 'Scroll of Fireball', kind: 'scroll', scroll: { kind: 'spell', spell: { name: 'Fireball', level: 3, damageType: 'fire' } } })
    expect(it.description).toMatch(/DC 15/)
    const c = addItem(addItem(fighter(), it), scrollItem(fireball))
    expect(c.inventory).toHaveLength(1); expect(c.inventory![0].qty).toBe(2)
  })
  it('anyone can use it: rolls 8d6 at printed level and consumes it', () => {
    let c = addItem(fighter(), scrollItem(fireball))
    const r = useItem(c, c.inventory![0].id); c = r.char
    expect(r.message).toMatch(/Scroll of Fireball .*DC 15.*8d6/)
    expect(c.inventory).toHaveLength(0)
  })
})
