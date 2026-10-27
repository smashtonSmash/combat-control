import { describe, expect, it } from 'vitest'
import { ARMOR_CATALOG, armorById, resolveArmor } from './armor'
import { craftGear, craftRepairKit, mergeMats, salvageItem, upgradeGear } from './blacksmith'
import { ARMOR_HP, CRAFT_GOLD, KIT_PRICES, UPGRADE_FEES, WEAPON_HP, WEAPON_SIZE_BY_ID } from './catalog'
import { blacksmithRepair } from './effects'
import { allMerchants } from './favor'
import { giveInspiration, inspirationOf, spendInspiration } from './inspiration'
import { armorItem, equip } from './inventory'
import { kitDiceFor, matQty, salvageYield } from './salvage'
import { SHIELD_CATALOG, shieldAcBonus, shieldItem, shieldPrice } from './shields'
import type { Character, Item } from './types'
import { WEAPON_CATALOG, tieredWeapon } from './weapons'

const hero = (p: Partial<Character> = {}): Character => ({
  id: 'h', name: 'Hero', cls: 'Fighter', level: 3, race: '',
  abilities: { str: 14, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
  ac: 12, armor: '', maxHp: 30, currentHp: 20, initMod: 2, traits: [], attacks: [], notes: '',
  purse: { gold: 100, silver: 0 }, ...p,
})

const three = (it: Item, gold = 100) => hero({
  purse: { gold, silver: 0 },
  inventory: [{ ...it, id: 'a' }, { ...it, id: 'b' }, { ...it, id: 'c' }],
})

describe('salvage bands', () => {
  it('broken is 1, up through 65% is 2, above 65% adds the tier below', () => {
    expect(salvageYield(0, 15, 'green')).toEqual([{ tier: 'green', qty: 1 }])
    expect(salvageYield(9, 15, 'green')).toEqual([{ tier: 'green', qty: 2 }])
    expect(salvageYield(10, 15, 'green')).toEqual([{ tier: 'green', qty: 2 }, { tier: 'gray', qty: 2 }])
    expect(salvageYield(40, 40, 'legendary')).toEqual([{ tier: 'orange', qty: 2 }, { tier: 'purple', qty: 2 }])
    const full = { ...armorItem('leather', 'green'), dur: 15 }
    const rich = salvageItem(hero({ inventory: [full] }), full.id)
    expect(matQty(rich.char, 'green')).toBe(2)
    expect(matQty(rich.char, 'gray')).toBe(2)
  })
})

describe('upgrade 3 to 1', () => {
  it('charges the light fee and grants the next tier', () => {
    const leather = armorItem('leather', 'green')
    const r = upgradeGear(three(leather), ['a', 'b', 'c'])
    expect(r.ok).toBe(true)
    expect(r.char.purse!.gold).toBe(100 - UPGRADE_FEES.green!)
    expect(r.char.inventory!.filter((i) => i.armorId === 'leather')).toEqual([expect.objectContaining({ tier: 'blue' })])
  })
  it('medium is ×2, heavy is ×5, mythic stops, and a pair is not enough', () => {
    const hide = upgradeGear(three(armorItem('hide', 'green')), ['a', 'b', 'c'])
    expect(hide.char.purse!.gold).toBe(100 - 10)
    const plate = upgradeGear(three(armorItem('plate', 'green')), ['a', 'b', 'c'])
    expect(plate.char.purse!.gold).toBe(100 - 25)
    expect(upgradeGear(three(armorItem('leather', 'mythic'), 9999), ['a', 'b', 'c']).ok).toBe(false)
    expect(upgradeGear(hero({ inventory: [armorItem('leather', 'green'), armorItem('leather', 'green')] }), ['x', 'y', 'z']).ok).toBe(false)
  })
})

describe('craft and merge', () => {
  it('green costs 1g and four mats; gray cannot craft', () => {
    const mats = hero({ purse: { gold: 5, silver: 0 }, inventory: [{ ...armorItem('leather', 'green'), id: 'keep' }] })
    const pack = { ...mats, inventory: [...mats.inventory!, ...Array.from({ length: 4 }, (_, i) => ({ ...requireMat('green'), id: 'm' + i }))] }
    const r = craftGear(pack, 'green', { kind: 'armor', id: 'hide' })
    expect(r.ok).toBe(true)
    expect(r.char.purse!.gold).toBe(5 - CRAFT_GOLD.green)
    expect(r.char.inventory!.some((i) => i.armorId === 'hide' && i.tier === 'green')).toBe(true)
    expect(matQty(r.char, 'green')).toBe(0)
    expect(craftGear(pack, 'gray', { kind: 'armor', id: 'hide' }).ok).toBe(false)
  })
  it('merges three gray into one green for 1 silver', () => {
    const c = hero({ purse: { gold: 0, silver: 1 }, inventory: Array.from({ length: 3 }, (_, i) => ({ ...requireMat('gray'), id: 'g' + i })) })
    const r = mergeMats(c, 'gray')
    expect(r.ok).toBe(true)
    expect(matQty(r.char, 'gray')).toBe(0)
    expect(matQty(r.char, 'green')).toBe(1)
    expect(r.char.purse).toEqual({ gold: 0, silver: 0 })
    expect(mergeMats(r.char, 'gray').ok).toBe(false)
  })
})

describe('repair pricing and kits', () => {
  it('broken gold repair is double', () => {
    const a = { ...armorItem('leather', 'mythic'), dur: 0 }
    const c = equip(hero({ inventory: [a] }), a.id)
    expect(blacksmithRepair(c, a.id, 1).char.purse!.gold).toBe(100 - 50)
  })
  it('a higher kit steps the die up and a lower kit is refused', () => {
    expect(kitDiceFor('green', 'green')).toBe('1d6+2')
    expect(kitDiceFor('blue', 'green')).toBe('1d8+4')
    expect(kitDiceFor('green', 'blue')).toBeNull()
    expect(KIT_PRICES).toEqual({ green: 12, blue: 25, purple: 50, legendary: 120, mythic: 280 })
    const made = craftRepairKit(hero({ inventory: Array.from({ length: 2 }, (_, i) => ({ ...requireMat('blue'), id: 'b' + i })) }), 'blue')
    expect(made.ok).toBe(true)
    expect(made.item?.kitTier).toBe('blue')
    expect(craftRepairKit(hero({ inventory: [requireMat('gray'), requireMat('gray')] }), 'gray').ok).toBe(false)
  })
})

describe('catalogs', () => {
  it('lists medium and heavy armor and the shield ladder', () => {
    expect(ARMOR_CATALOG.map((a) => a.id)).toEqual([
      'padded', 'leather', 'studded',
      'hide', 'chain-shirt', 'scale-mail', 'breastplate', 'half-plate',
      'ring-mail', 'chain-mail', 'splint', 'plate',
    ])
    expect(ARMOR_HP.medium.green).toBe(22)
    expect(ARMOR_HP.heavy.mythic).toBe(96)
    expect(armorById('plate')!.baseAc).toBe(18)
    const sworn = resolveArmor(armorById('plate'), 'mythic', 2, false, 'slashing')
    expect(sworn.acVs.slashing).toBe(3)
    expect(sworn.acVs.piercing).toBe(-1)
    expect(SHIELD_CATALOG.map((s) => s.id)).toEqual(['shield-small', 'shield-medium', 'shield-heavy'])
    const med = shieldItem('shield-medium', 'green')
    const worn = equip(hero({ inventory: [med] }), med.id)
    expect(shieldAcBonus(worn)).toBe(2)
    const heavy = { ...shieldItem('shield-heavy', 'mythic'), shieldMode: 'planted' as const }
    expect(shieldAcBonus(hero({ inventory: [{ ...heavy, equipped: true }] }))).toBe(0)
    expect(shieldPrice('shield-heavy', 'green')).toBe(50)
  })
  it('keeps weapon sizes aligned with the durability table', () => {
    for (const w of WEAPON_CATALOG) expect(WEAPON_SIZE_BY_ID[w.id]).toBe(w.size)
    expect(WEAPON_HP.light.green).toBe(8)
    expect(WEAPON_HP.standard.green).toBe(12)
    expect(WEAPON_HP.heavy.green).toBe(16)
    const sword = tieredWeapon('longsword', 'green')
    expect(sword.weaponId).toBe('longsword')
  })
})

describe('inspiration and merchants', () => {
  it('caps inspiration at two and spends without a new ping', () => {
    let c = hero()
    c = giveInspiration(c, 10).char
    c = giveInspiration(c, 20).char
    expect(inspirationOf(c)).toBe(2)
    expect(c.inspirationPing).toBe(20)
    expect(giveInspiration(c, 30).ok).toBe(false)
    const spent = spendInspiration(c)
    expect(spent.char.inspiration).toBe(1)
    expect(spent.char.inspirationPing).toBe(20)
  })
  it('hides a built-in merchant the DM removed', () => {
    expect(allMerchants([], ['bram', 'mara']).map((m) => m.id)).toEqual(['nessa', 'odo'])
    const custom = { id: 'x', name: 'X', style: 'friendly' as const, personality: '', baseAdjust: 0, custom: true }
    expect(allMerchants([custom], []).some((m) => m.id === 'x')).toBe(true)
    expect(allMerchants([], []).some((m) => m.id === 'x')).toBe(false)
  })
})

function requireMat(tier: 'gray' | 'green' | 'blue'): Item {
  return { id: 'mat', name: tier, kind: 'misc', qty: 1, materialKey: `mat_${tier}`, description: '' }
}
