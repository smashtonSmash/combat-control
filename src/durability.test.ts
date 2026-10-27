import { describe, expect, it } from 'vitest'
import { applyWear, blacksmithRepair, undoWear, useCatalogItem } from './effects'
import { armorItem, equip } from './inventory'
import { catalogItem, catalogToItem } from './catalog'
import { durOf, durState, isBroken, maxDur, repairCost, wearFor } from './durability'
import type { Character } from './types'
import type { Tier } from './armor'

const hero = (p: Partial<Character> = {}): Character => ({ id: 'h', name: 'Hero', cls: 'Fighter', level: 3, race: '', abilities: { str: 14, dex: 14, con: 12, int: 10, wis: 10, cha: 10 }, ac: 12, armor: '', maxHp: 30, currentHp: 20, initMod: 2, traits: [], attacks: [], notes: '', purse: { gold: 100, silver: 0 }, ...p })
const armored = (tier: Tier, dur?: number) => { const a = { ...armorItem('leather', tier), dur }; return { c: equip(hero({ inventory: [a] }), a.id), a } }
const inv = (c: Character, id: string) => c.inventory!.find((x) => x.id === id)!

describe('wear', () => {
  it('amounts', () => {
    expect(wearFor({ crit: false, weak: false }).amount).toBe(1)
    expect(wearFor({ crit: true, weak: false }).amount).toBe(3)
    expect(wearFor({ crit: false, weak: true }).amount).toBe(2)
    expect(wearFor({ crit: true, weak: true }).amount).toBe(3)
  })
  it('max by tier, missing dur = full', () => {
    expect((['green', 'blue', 'purple', 'legendary', 'mythic'] as Tier[]).map((t) => maxDur({ ...armored(t).a }))).toEqual([15, 20, 26, 36, 48])
    expect(durOf(armored('blue').a)).toBe(20)
  })
  it('damaged at half: -1 AC; broken at 0 unequips; undo restores', () => {
    const { c, a } = armored('green', 8)
    const ac0 = c.ac
    const w = applyWear(c, 1)
    expect(durState(inv(w.char, a.id))).toBe('damaged'); expect(w.char.ac).toBe(ac0 - 1); expect(w.char.armorDamaged).toBe(true)
    const b = applyWear(w.char, 7)
    expect(isBroken(inv(b.char, a.id))).toBe(true); expect(inv(b.char, a.id).equipped).toBeFalsy(); expect(b.char.armorId).toBeUndefined()
    expect(equip(b.char, a.id)).toBe(b.char) // can't equip Broken
    const u = undoWear(b.char, a.id, b.prev!)
    expect(inv(u, a.id).equipped).toBe(true); expect(durOf(inv(u, a.id))).toBe(7)
  })
})

describe('repair', () => {
  it('costs per point by tier, broken double', () => {
    expect(repairCost({ ...armored('green', 3).a }, 4)).toBe(4)
    expect(repairCost({ ...armored('purple', 3).a }, 4)).toBe(12)
    expect(repairCost({ ...armored('legendary', 3).a }, 1)).toBe(10)
    expect(repairCost({ ...armored('mythic', 3).a }, 1)).toBe(25)
    expect(repairCost({ ...armored('mythic', 0).a }, 1)).toBe(50)
  })
  it('blacksmith full repair deducts gold and caps at max', () => {
    const { c, a } = armored('purple', 5)
    const r = blacksmithRepair(c, a.id, 'full')
    expect(r.ok).toBe(true); expect(durOf(inv(r.char, a.id))).toBe(26); expect(r.char.purse!.gold).toBe(100 - 63)
    expect(blacksmithRepair(r.char, a.id, 3).ok).toBe(false)
    expect(blacksmithRepair({ ...c, purse: { gold: 1, silver: 0 } }, a.id, 1).ok).toBe(false)
  })
  it('field repair kit: +1d6+2 capped, refuses Broken, consumed', () => {
    const { c, a } = armored('blue', 4)
    const kit = catalogToItem(catalogItem('field-repair')!)
    const c2 = { ...c, inventory: [...c.inventory!, kit] }
    const r = useCatalogItem(c2, kit, undefined, { targetId: a.id })
    const d = durOf(inv(r.char, a.id)); expect(d).toBeGreaterThanOrEqual(7); expect(d).toBeLessThanOrEqual(12)
    expect(r.char.inventory!.some((x) => x.id === kit.id)).toBe(false)
    const br = { ...c2, inventory: c2.inventory!.map((x) => (x.id === a.id ? { ...x, dur: 0, equipped: false } : x)) }
    expect(useCatalogItem(br, kit, undefined, { targetId: a.id }).ok).toBe(false)
  })
})
