import { describe, expect, it } from 'vitest'
import { applyBonuses, bgBudget, chooseBackground, chooseClass, chooseRace, raceBudget, suggestedHp, validBonus } from './origins'
import type { Character } from './types'
const blank = (): Character => ({ id: 'x', name: 'T', cls: '', level: 1, race: '', abilities: { str: 10, dex: 14, con: 12, int: 15, wis: 10, cha: 8 }, ac: 10, armor: '', maxHp: 10, initMod: 0, traits: [], attacks: [], notes: '' })

describe('origins', () => {
  it('SRD Elf (High Elf) Wizard Sage', () => {
    let c = chooseRace(blank(), 'elf')
    expect(c.race).toBe('High Elf'); expect(c.abilities.dex).toBe(16); expect(c.abilities.int).toBe(16); expect(c.speed).toBe(30)
    expect(c.features!.some((f) => f.name === 'Darkvision' && f.source === 'race')).toBe(true)
    c = chooseClass(c, 'wizard'); expect(c.cls).toBe('Wizard'); expect(c.hitDie).toBe(6); expect(c.saves).toEqual(['int', 'wis'])
    expect(c.features!.some((f) => f.name === 'Arcane Recovery')).toBe(true)
    expect(suggestedHp(c)).toBe(7) // d6 + CON(+1)
    c = chooseBackground(c, 'sage'); expect(c.background).toBe('Sage'); expect(c.skills).toEqual(['Arcana', 'History'])
    // switching race removes old bonuses
    c = chooseRace(c, 'dwarf'); expect(c.abilities.dex).toBe(14); expect(c.abilities.con).toBe(14); expect(c.features!.some((f) => f.name === 'Darkvision')).toBe(true)
    expect(c.features!.some((f) => f.source === 'class')).toBe(true)
  })
  it('Custom race with +2/+1 budget', () => {
    let c = chooseRace(blank(), 'custom')
    const b = raceBudget(c, 3)!; expect(b).toEqual({ total: 3, maxEach: 2 })
    expect(validBonus({ str: 2, con: 1 }, b)).toBe(true); expect(validBonus({ str: 3 }, b)).toBe(false); expect(validBonus({ str: 2, con: 2 }, b)).toBe(false)
    c = applyBonuses({ ...c, origin: { ...c.origin, raceBonus: { str: 2, con: 1 } } }); expect(c.abilities.str).toBe(12); expect(c.abilities.con).toBe(13)
    expect(raceBudget(c, 4)!.total).toBe(4)
    expect(bgBudget(chooseBackground(c, 'custom'), 3)).toEqual({ total: 3, maxEach: 2 })
  })
  it('old characters keep their scores', () => { const c = applyBonuses(blank()); expect(c.abilities).toEqual(blank().abilities) })
})
