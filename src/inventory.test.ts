import { describe, expect, it } from 'vitest'
import { addItem, armorItem, equip, potionOfHealing, removeItem, unequip, useItem, weaponItem, COMMON_WEAPONS } from './inventory'
import { combinedArmor } from './armor'
import type { Character } from './types'

const base = (): Character => ({ id: 'x', name: 'Lyra', cls: '', level: 3, race: '', abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
  ac: 12, armor: 'none', maxHp: 20, currentHp: 10, initMod: 2, traits: [], attacks: [], notes: '' })

describe('inventory', () => {
  it('equips armor: sets armor+tier, AC and reductions; only one armor equipped', () => {
    const a = armorItem('padded', 'purple'), b = armorItem('leather', 'green')
    let c = addItem(addItem(base(), a), b)
    c = equip(c, a.id)
    expect(c.armorId).toBe('padded'); expect(c.armorTier).toBe('purple'); expect(c.ac).toBe(13); expect(c.armor).toBe('Purple Padded Armor')
    const r = combinedArmor({ ...c, prof: 2 }); expect(r.reduce.bludgeoning).toBe(2); expect(r.acVs.bludgeoning).toBe(1)
    c = equip(c, b.id)
    expect(c.inventory!.filter((i) => i.equipped).map((i) => i.id)).toEqual([b.id]); expect(c.armorId).toBe('leather')
    c = unequip(c, b.id); expect(c.armorId).toBeUndefined(); expect(c.ac).toBe(12)
  })
  it('equips weapons as attacks', () => {
    const w = weaponItem(COMMON_WEAPONS[0]); let c = equip(addItem(base(), w), w.id)
    expect(c.attacks[0]).toMatchObject({ name: 'Dagger', toHit: 4, damage: '1d4+2', damageType: 'piercing' })
    c = removeItem(c, w.id); expect(c.attacks).toHaveLength(0); expect(c.inventory).toHaveLength(0)
  })
  it('potion heals 2d4+2 (capped) and decrements; stacks', () => {
    let c = addItem(addItem(base(), potionOfHealing()), potionOfHealing())
    expect(c.inventory).toHaveLength(1); expect(c.inventory![0].qty).toBe(2)
    const r = useItem(c, c.inventory![0].id); c = r.char
    expect(c.currentHp).toBeGreaterThanOrEqual(14); expect(c.currentHp).toBeLessThanOrEqual(20); expect(c.inventory![0].qty).toBe(1)
    c = useItem(c, c.inventory![0].id).char; expect(c.inventory).toHaveLength(0)
  })
})
