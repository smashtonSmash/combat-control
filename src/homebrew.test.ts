import { describe, expect, it } from 'vitest'
import type { Character } from './types'
import { shopPriceSilver } from './catalog'
import { applyTierKit, applyWeaponWear, craftRepairKit, salvageArmor } from './effects'
import { carryCapacity, itemSlots, slotsUsed } from './encumbrance'
import { favorAdjust, favorFace, MERCHANTS } from './favor'
import { FOUNTAIN_THRESHOLDS, offerToFountain, pickThreshold } from './fountain'
import { addItem, armorItem, equip, potionOfHealing } from './inventory'
import { catalogItem, catalogToItem } from './catalog'
import { durOf, isBroken, maxDur } from './durability'
import { kitsFromCount, materialDef, materialItem, repairKitItem } from './salvage'
import { syncBlackMythic, whisperfang } from './specialGear'
import { tieredWeapon } from './weapons'

const hero = (p: Partial<Character> = {}): Character => ({
  id: 'h', name: 'Hero', cls: 'Fighter', level: 3, race: '',
  abilities: { str: 14, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
  ac: 12, armor: '', maxHp: 30, currentHp: 20, initMod: 2, traits: [], attacks: [], notes: '',
  purse: { gold: 20, silver: 0 }, ...p,
})
const row = (c: Character, id: string) => c.inventory!.find((x) => x.id === id)!

describe('weapon miss-wear', () => {
  it('loses durability on a miss and not on a hit', () => {
    const w = tieredWeapon('longsword', 'green')
    const c = equip(hero({ inventory: [w] }), w.id)
    expect(maxDur(row(c, w.id))).toBe(10)
    const miss = applyWeaponWear(c, w.id, 'miss')
    expect(miss.amount).toBe(1)
    expect(durOf(row(miss.char, w.id))).toBe(9)
    const hit = applyWeaponWear(miss.char, w.id, 'hit')
    expect(hit.amount).toBe(0)
    expect(hit.char).toBe(miss.char)
    expect(durOf(row(hit.char, w.id))).toBe(9)
  })
  it('breaks and unequips when a miss spends the last point', () => {
    const w = { ...tieredWeapon('dagger', 'green'), dur: 1 }
    const c = equip(hero({ inventory: [w] }), w.id)
    expect(c.attacks).toHaveLength(1)
    const miss = applyWeaponWear(c, w.id, 'miss')
    expect(isBroken(row(miss.char, w.id))).toBe(true)
    expect(row(miss.char, w.id).equipped).toBeFalsy()
    expect(miss.char.attacks).toHaveLength(0)
    expect(miss.message).toMatch(/BROKEN/)
  })
})

describe('kit crafting', () => {
  it('counts one kit per two matching materials', () => {
    expect(kitsFromCount(0)).toBe(0)
    expect(kitsFromCount(1)).toBe(0)
    expect(kitsFromCount(2)).toBe(1)
    expect(kitsFromCount(5)).toBe(2)
  })
  it('turns two wolf pelts into a Common leather kit and can fix Broken armor', () => {
    const made = craftRepairKit(hero({ inventory: [materialItem('wolf_pelt', 5)] }), 'wolf_pelt')
    expect(made.ok).toBe(true)
    expect(made.char.inventory!.find((i) => i.materialKey === 'wolf_pelt')!.qty).toBe(3)
    const kit = made.char.inventory!.find((i) => i.kitTier === 'green' && i.kitArmorId === 'leather')!
    expect(kit.name).toMatch(/Common/)
    expect(craftRepairKit(made.char, 'wolf_pelt').ok).toBe(true)
    expect(craftRepairKit(craftRepairKit(made.char, 'wolf_pelt').char, 'wolf_pelt').ok).toBe(false)

    const broken = { ...armorItem('leather', 'green'), dur: 0 }
    const padded = armorItem('padded', 'green')
    const withKit = { ...made.char, inventory: [...made.char.inventory!, broken, padded] }
    const wrong = applyTierKit(withKit, kit.id, padded.id)
    expect(wrong.ok).toBe(false)
    expect(wrong.char.inventory!.some((i) => i.id === kit.id)).toBe(true)
    const fixed = applyTierKit(withKit, kit.id, broken.id)
    expect(fixed.ok).toBe(true)
    expect(durOf(row(fixed.char, broken.id))).toBe(maxDur(broken))
    expect(fixed.char.inventory!.some((i) => i.id === kit.id)).toBe(false)
  })
  it('salvages broken leather into two wolf pelts, or a small refund', () => {
    const a = { ...armorItem('leather', 'green'), dur: 0 }
    const parts = salvageArmor(hero({ inventory: [a] }), a.id, 'materials')
    expect(parts.ok).toBe(true)
    expect(parts.char.inventory!.find((i) => i.materialKey === 'wolf_pelt')!.qty).toBe(2)
    expect(parts.message).toMatch(/PLACEHOLDER/)
    const coins = salvageArmor(hero({ inventory: [a], purse: { gold: 1, silver: 0 } }), a.id, 'coins')
    expect(coins.char.purse).toEqual({ gold: 3, silver: 0 })
    expect(repairKitItem(materialDef('wolf_pelt')!).kitArmorId).toBe('leather')
  })
})

describe('encumbrance', () => {
  it('stacks identical potions into one slot, armor is 1, a greatsword is 2', () => {
    const stacked = addItem(addItem(hero(), potionOfHealing()), potionOfHealing())
    expect(stacked.inventory).toHaveLength(1)
    expect(slotsUsed(stacked.inventory)).toBe(1)
    const mixed = addItem(stacked, catalogToItem(catalogItem('heal-blue')!))
    expect(slotsUsed(mixed.inventory)).toBe(2)
    const armor = armorItem('leather', 'blue')
    expect(itemSlots(armor)).toBe(1)
    const great = tieredWeapon('greatsword', 'green')
    expect(itemSlots(great)).toBe(2)
    const pack = addItem(addItem(mixed, armor), great)
    expect(slotsUsed(pack.inventory)).toBe(5)
    expect(carryCapacity(hero())).toBe(14)
    expect(carryCapacity(hero({ abilities: { str: 8, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } }))).toBe(8)
  })
})

describe('fountain threshold', () => {
  it('picks from the secret list and pays out only when the offering reaches it', () => {
    expect(FOUNTAIN_THRESHOLDS).toEqual([10, 50, 100, 200])
    let i = 0
    const seq = [0, 0.99]
    const rng = () => seq[Math.min(i++, seq.length - 1)]
    expect(pickThreshold(() => 0)).toBe(10)
    expect(pickThreshold(() => 0.99)).toBe(200)
    const low = offerToFountain({ contributedSilver: 0, thresholdGold: null }, 90, rng)
    expect(low.granted).toBe(false)
    expect(low.state.thresholdGold).toBe(10)
    expect(low.state.contributedSilver).toBe(90)
    const hit = offerToFountain(low.state, 10, rng)
    expect(hit.granted).toBe(true)
    expect(hit.state.contributedSilver).toBe(0)
    expect(hit.state.thresholdGold).toBe(200)
    expect(hit.rewardNote).toMatch(/TBD/)
  })
})

describe('favor discount', () => {
  it('higher favor is a happier face and a lower price', () => {
    const bram = MERCHANTS.find((m) => m.id === 'bram')!
    expect(favorAdjust(0, bram)).toBe(bram.baseAdjust)
    expect(favorAdjust(100, bram)).toBe(bram.baseAdjust - 20)
    expect(favorAdjust(100, bram)).toBeLessThan(favorAdjust(0, bram))
    expect(favorFace(0).label).toBe('sour')
    expect(favorFace(100).label).toBe('delighted')
    expect(shopPriceSilver(10, favorAdjust(100, bram))).toBeLessThan(shopPriceSilver(10, favorAdjust(0, bram)))
  })
})

describe('black mythic', () => {
  it('cannot be equipped until the owner syncs', () => {
    const blade = whisperfang()
    const c = hero({ inventory: [blade] })
    expect(equip(c, blade.id)).toBe(c)
    const synced = syncBlackMythic(c, blade.id)
    expect(synced.ok).toBe(true)
    const drawn = equip(synced.char, blade.id)
    expect(drawn.attacks).toHaveLength(1)
    expect(drawn.inventory!.find((i) => i.id === blade.id)!.equipped).toBe(true)
  })
})
