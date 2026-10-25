import { describe, expect, it } from 'vitest'
import { ARMOR_PRICES, ARMOR_PRICE_MULTIPLIER, armorPrice, catalogItem, catalogToItem, migrateInventory, shopPriceSilver, CONSUMABLES } from './catalog'
import { applySecondWind, buy, clearEffects, fuse, useCatalogItem } from './effects'
import { armorItem, equip, weaponItem, COMMON_WEAPONS, useItem } from './inventory'
import { canRaise, dropLowest, pointBuyCost, pointsLeft, roll4d6, rollSet, validPointBuy } from './abilityGen'
import type { Character } from './types'

const hero = (p: Partial<Character> = {}): Character => ({ id: 'h', name: 'Hero', cls: 'Fighter', level: 3, race: '', abilities: { str: 14, dex: 14, con: 12, int: 10, wis: 10, cha: 10 }, ac: 12, armor: '', maxHp: 30, currentHp: 20, initMod: 2, traits: [], attacks: [], notes: '', purse: { gold: 100, silver: 0 }, ...p })
const withItem = (c: Character, key: string) => { const it = catalogToItem(catalogItem(key)!); return { c: { ...c, inventory: [...(c.inventory ?? []), it] }, it } }

describe('pricing', () => {
  it('light armor by tier, medium/heavy multiplier field', () => {
    expect(ARMOR_PRICES).toEqual({ green: 10, blue: 35, purple: 90, legendary: 300, mythic: 1000 })
    expect(armorPrice('leather', 'purple')).toBe(90)
    expect(ARMOR_PRICE_MULTIPLIER.medium).toBeTypeOf('number')
  })
  it('catalog has all 28 items with prices', () => {
    expect(CONSUMABLES).toHaveLength(28)
    expect(catalogItem('mirror-long')!.price).toBe(400); expect(catalogItem('oil-piercing')!.price).toBe(8)
  })
  it('shop adjust % and buying deducts gold (makes change)', () => {
    expect(shopPriceSilver(35, 10)).toBe(385)
    const r = buy(hero({ purse: { gold: 40, silver: 0 } }), catalogToItem(catalogItem('heal-blue')!), shopPriceSilver(35, 10))
    expect(r.ok).toBe(true); expect(r.char.purse).toEqual({ gold: 1, silver: 5 }); expect(r.char.inventory![0].name).toBe('Rare Healing Potion')
    expect(buy(hero({ purse: { gold: 5, silver: 0 } }), catalogToItem(catalogItem('heal-blue')!), 350).ok).toBe(false)
  })
  it('migrates old common healing potions to 2d6+2', () => {
    const old = migrateInventory(hero({ inventory: [{ id: 'p', name: 'Potion of Healing', kind: 'consumable', qty: 2, heal: '2d4+2', description: '' }] }))
    expect(old.inventory![0]).toMatchObject({ name: 'Common Healing Potion', heal: '2d6+2', catalogKey: 'heal-green', qty: 2, tier: 'green' })
    const eight = migrateInventory(hero({ inventory: [{ id: 'g', name: 'Common Healing Potion', kind: 'consumable', qty: 1, heal: '2d8+2', tier: 'green', description: '' }] }))
    expect(eight.inventory![0].heal).toBe('2d6+2')
    const greater = hero({ inventory: [{ id: 'b', name: 'Rare Healing Potion', kind: 'consumable', qty: 1, heal: '4d4+4', tier: 'blue', description: '' }] })
    expect(migrateInventory(greater)).toBe(greater)
    expect(catalogItem('heal-green')!.effect).toMatchObject({ kind: 'heal', dice: '2d6+2' })
  })
})

describe('fusing', () => {
  const two = (tier: 'green' | 'legendary' | 'mythic', gold = 100) => hero({ purse: { gold, silver: 0 }, inventory: [armorItem('leather', tier), armorItem('leather', tier), armorItem('padded', tier)] })
  it('two same type+tier + fee → next tier', () => {
    const r = fuse(two('green'), 'leather', 'green', { atForge: true })
    expect(r.ok).toBe(true); expect(r.char.purse!.gold).toBe(85)
    const leathers = r.char.inventory!.filter((i) => i.armorId === 'leather')
    expect(leathers).toHaveLength(1); expect(leathers[0]).toMatchObject({ tier: 'blue', atForge: true })
    expect(equip(r.char, leathers[0].id).armorId).toBeUndefined() // at the forge: can't equip yet
  })
  it('needs a pair, the fee, and a next tier', () => {
    expect(fuse(two('green'), 'padded', 'green').ok).toBe(false)
    expect(fuse(two('legendary', 399), 'leather', 'legendary').ok).toBe(false)
    expect(fuse(two('legendary', 400), 'leather', 'legendary').char.inventory!.some((i) => i.tier === 'mythic')).toBe(true)
    expect(fuse(two('mythic', 9999), 'leather', 'mythic').ok).toBe(false)
  })
})

describe('effects', () => {
  it('healing potions heal; legendary full-heals', () => {
    const { c, it } = withItem(hero(), 'heal-green')
    const r = useItem(c, it.id); expect(r.char.currentHp!).toBeGreaterThanOrEqual(24); expect(r.char.inventory).toHaveLength(0)
    const f = withItem(hero({ currentHp: 3 }), 'heal-legendary'); expect(useItem(f.c, f.it.id).char.currentHp).toBe(30)
  })
  it('oil changes the equipped weapon damage type until long rest; Ember adds +1d4 fire', () => {
    let c = hero({ inventory: [weaponItem(COMMON_WEAPONS.find((w) => w.name === 'Longsword')!)] }); c = equip(c, c.inventory![0].id)
    const o = withItem(c, 'oil-piercing'); let r = useCatalogItem(o.c, o.it); expect(r.ok).toBe(true)
    expect(r.char.attacks[0].damageType).toBe('piercing')
    const e = withItem(r.char, 'ember-flask'); r = useCatalogItem(e.c, e.it)
    expect(r.char.attacks[0].bonus).toEqual({ dice: '1d4', type: 'fire' }); expect(r.char.attacks[0].damageType).toBe('piercing')
    const rested = clearEffects(r.char, 'long'); expect(rested.attacks[0].damageType).toBe('slashing'); expect(rested.attacks[0].bonus).toBeUndefined()
  })
  it('oil without a weapon is not used up', () => { const o = withItem(hero(), 'oil-slashing'); const r = useCatalogItem(o.c, o.it); expect(r.ok).toBe(false); expect(r.char.inventory).toHaveLength(1) })
  it('Ironhide and 1-min Mirror end at End combat; legendary Mirror at long rest', () => {
    let c = withItem(hero(), 'ironhide'); let r = useCatalogItem(c.c, c.it)
    c = withItem(r.char, 'mirror-1min'); r = useCatalogItem(c.c, c.it)
    c = withItem(r.char, 'frostbite'); r = useCatalogItem(c.c, c.it)
    expect(r.char.effects!.map((e) => e.kind).sort()).toEqual(['acBonus', 'frostbite', 'mirror'])
    expect(clearEffects(r.char, 'combat').effects!.map((e) => e.kind)).toEqual(['frostbite'])
    const m = withItem(hero(), 'mirror-long'); const ml = useCatalogItem(m.c, m.it).char
    expect(clearEffects(ml, 'combat').effects).toHaveLength(1); expect(clearEffects(ml, 'long').effects).toHaveLength(0)
  })
  it('Mending Steel raises armor a tier until End combat', () => {
    let c = hero({ inventory: [armorItem('leather', 'blue')] }); c = equip(c, c.inventory![0].id)
    const m = withItem(c, 'mending-steel'); const r = useCatalogItem(m.c, m.it)
    expect(r.char.armorTier).toBe('purple'); expect(r.char.armor).toMatch(/Ultra Rare/)
    expect(clearEffects(r.char, 'combat').armorTier).toBe('blue')
  })
  it('Second Wind: drop to 1 instead of 0, once', () => {
    const s = withItem(hero(), 'second-wind'); const c = useCatalogItem(s.c, s.it).char
    const a = applySecondWind(c, 0); expect(a.hp).toBe(1); expect(a.char!.effects).toHaveLength(0)
    expect(applySecondWind(a.char!, 0).hp).toBe(0); expect(applySecondWind(c, 5).hp).toBe(5)
  })
  it('Stoneskin needs Mythic armor', () => {
    const s = withItem(hero(), 'stoneskin'); expect(useCatalogItem(s.c, s.it).ok).toBe(false)
    const m = withItem(hero({ armorTier: 'mythic', armorId: 'leather' }), 'stoneskin'); expect(useCatalogItem(m.c, m.it).char.effects![0].kind).toBe('stoneskin')
  })
})

describe('ability generation', () => {
  it('point buy costs and limits', () => {
    expect(pointBuyCost([8, 8, 8, 8, 8, 8])).toBe(0)
    expect(pointBuyCost([15, 15, 15, 8, 8, 8])).toBe(27); expect(validPointBuy([15, 15, 15, 8, 8, 8])).toBe(true)
    expect(pointBuyCost([15, 14, 13, 12, 10, 8])).toBe(27)
    expect(validPointBuy([16, 8, 8, 8, 8, 8])).toBe(false); expect(validPointBuy([15, 15, 15, 9, 8, 8])).toBe(false)
    expect(pointsLeft([13, 13, 13, 12, 12, 12])).toBe(0)
    expect(canRaise([14, 14, 14, 8, 8, 8], 0)).toBe(true)   // 14→15 costs 2, 6 left
    expect(canRaise([15, 15, 14, 8, 8, 8], 2)).toBe(true)   // 25 used, 2 left, 14→15 costs 2
    expect(canRaise([15, 15, 15, 8, 8, 8], 3)).toBe(false)  // 0 left
    expect(canRaise([15, 15, 15, 8, 8, 8], 0)).toBe(false)  // max 15
  })
  it('4d6 drop lowest', () => {
    expect(dropLowest([3, 1, 6, 4])).toEqual({ dice: [3, 1, 6, 4], drop: 1, total: 13 })
    expect(dropLowest([2, 2, 5, 5]).total).toBe(12)
    const seq = [0, 0.99, 0.5, 0.2]; let i = 0
    const r = roll4d6(() => seq[i++]); expect(r.dice).toEqual([1, 6, 4, 2]); expect(r.total).toBe(12); expect(r.drop).toBe(0)
    for (const s of rollSet()) { expect(s.dice).toHaveLength(4); expect(s.total).toBeGreaterThanOrEqual(3); expect(s.total).toBeLessThanOrEqual(18) }
  })
})

describe('tier display names', () => {
  it('migrates stored names, keeps ids', () => {
    const c = migrateInventory(hero({ armor: 'Purple Padded Armor + Green Padded under-layer', armorTier: 'purple',
      inventory: [{ ...armorItem('leather', 'blue'), name: 'Blue Leather Armor' }, { id: 'g', name: 'Green Healing Potion', kind: 'consumable', qty: 1, tier: 'green', catalogKey: 'heal-green', description: '' }, { id: 'd', name: 'Blue Dagger', kind: 'weapon', qty: 1, description: '' }] }))
    expect(c.armor).toBe('Ultra Rare Padded Armor + Common Padded under-layer'); expect(c.armorTier).toBe('purple')
    expect(c.inventory!.map((i) => i.name)).toEqual(['Rare Leather Armor', 'Common Healing Potion', 'Blue Dagger'])
    expect(migrateInventory(c)).toBe(c)
    expect(armorItem('padded', 'purple').name).toBe('Ultra Rare Padded Armor')
  })
})
