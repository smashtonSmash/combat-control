import { describe, expect, it } from 'vitest'
import { availableSlots, damageFor, fromSrd, slotsFor, spendSlot, restoreAll } from './spells'
import spells from './data/spells.json'
import type { SrdSpell } from './spells'
const S = spells as SrdSpell[]
const get = (i: string) => fromSrd(S.find((s) => s.i === i)!, i)

describe('slot tables', () => {
  it('full casters', () => {
    expect(slotsFor('Wizard', 5).max.slice(0, 3)).toEqual([4, 3, 2])
    expect(slotsFor('cleric', 1).max[0]).toBe(2)
    expect(slotsFor('Bard', 20).max).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1])
  })
  it('half casters and warlock pact', () => {
    expect(slotsFor('Paladin', 1).max.every((x) => x === 0)).toBe(true)
    expect(slotsFor('Ranger', 5).max.slice(0, 2)).toEqual([4, 2])
    const w = slotsFor('Warlock', 5); expect(w.pact).toBe(true); expect(w.max[2]).toBe(2); expect(w.max.reduce((a, b) => a + b)).toBe(2)
    expect(slotsFor('Fighter', 5).max.every((x) => x === 0)).toBe(true)
  })
  it('spend / restore / available', () => {
    let s = slotsFor('wizard', 5)
    s = spendSlot(s, 3)!; s = spendSlot(s, 3)!
    expect(spendSlot(s, 3)).toBeNull()
    expect(availableSlots(s, 3)).toEqual([])
    expect(availableSlots(s, 2).map((x) => x.level)).toEqual([2])
    expect(restoreAll(s).used.every((u) => u === 0)).toBe(true)
  })
})
describe('SRD data', () => {
  it('has damage by slot and cantrip scaling', () => {
    expect(S.length).toBeGreaterThan(300)
    expect(damageFor(get('fireball'), 3, 5)).toBe('8d6'); expect(damageFor(get('fireball'), 4, 5)).toBe('9d6')
    expect(damageFor(get('fire-bolt'), 0, 5)).toBe('2d10'); expect(damageFor(get('fire-bolt'), 0, 4)).toBe('1d10')
    expect(damageFor(get('magic-missile'), 1, 5)).toBe('3d4 + 3')
    expect(get('fireball').save).toMatch(/DEX/)
  })
})
