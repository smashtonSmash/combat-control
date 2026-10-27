import { describe, expect, it } from 'vitest'
import { accessoryItem } from './accessories'
import { catalogItem, catalogToItem } from './catalog'
import { armorItem, COMMON_WEAPONS, potionOfHealing, weaponItem } from './inventory'
import { itemArtSrc, POUCH_ART_SRC } from './itemArt'
import { materialItem, repairKitItem } from './salvage'
import { shieldItem } from './shields'
import { pinkCoin, pinkLantern, whisperfang } from './specialGear'
import type { Item } from './types'
import { tieredWeapon } from './weapons'

const file = (src: string | null) => src?.split('/').pop()

const named = (base: Item, name: string, extra: Partial<Item> = {}): Item => ({ ...base, name, ...extra })
const cat = (key: string) => catalogToItem(catalogItem(key)!)

describe('item art', () => {
  it('uses armor-{id}.png, and -up only for legendary and mythic', () => {
    expect(file(itemArtSrc(armorItem('padded', 'green')))).toBe('armor-padded.png')
    expect(file(itemArtSrc(armorItem('leather', 'blue')))).toBe('armor-leather.png')
    expect(file(itemArtSrc(armorItem('studded', 'purple')))).toBe('armor-studded.png')
    expect(file(itemArtSrc(armorItem('padded', 'legendary')))).toBe('armor-padded-up.png')
    expect(file(itemArtSrc(armorItem('leather', 'mythic')))).toBe('armor-leather-up.png')
    expect(file(itemArtSrc(armorItem('studded', 'legendary')))).toBe('armor-studded-up.png')

    expect(file(itemArtSrc(armorItem('hide', 'green')))).toBe('armor-hide.png')
    expect(file(itemArtSrc(armorItem('chain-shirt', 'blue')))).toBe('armor-chain-shirt.png')
    expect(file(itemArtSrc(armorItem('scale-mail', 'purple')))).toBe('armor-scale-mail.png')
    expect(file(itemArtSrc(armorItem('breastplate', 'legendary')))).toBe('armor-breastplate-up.png')
    expect(file(itemArtSrc(armorItem('half-plate', 'mythic')))).toBe('armor-half-plate-up.png')
    expect(file(itemArtSrc(armorItem('ring-mail', 'green')))).toBe('armor-ring-mail.png')
    expect(file(itemArtSrc(armorItem('chain-mail', 'blue')))).toBe('armor-chain-mail.png')
    expect(file(itemArtSrc(armorItem('splint', 'legendary')))).toBe('armor-splint-up.png')
    expect(file(itemArtSrc(armorItem('plate', 'green')))).toBe('armor-plate.png')
    expect(file(itemArtSrc(armorItem('plate', 'mythic')))).toBe('armor-plate-up.png')
  })

  it('prefers weaponId, otherwise maps known names after stripping a tier prefix', () => {
    expect(file(itemArtSrc(tieredWeapon('longsword', 'green')))).toBe('weapon-longsword.png')
    expect(file(itemArtSrc(tieredWeapon('greatsword', 'blue')))).toBe('weapon-greatsword.png')
    expect(file(itemArtSrc(tieredWeapon('dagger', 'legendary')))).toBe('weapon-dagger-up.png')
    expect(file(itemArtSrc(tieredWeapon('shortbow', 'mythic')))).toBe('weapon-shortbow-up.png')
    expect(file(itemArtSrc({ ...tieredWeapon('dagger', 'green'), name: 'Notched Blade' }))).toBe('weapon-dagger.png')

    const dagger = weaponItem(COMMON_WEAPONS.find((w) => w.name === 'Dagger')!)
    expect(file(itemArtSrc(dagger))).toBe('weapon-dagger.png')
    expect(file(itemArtSrc(weaponItem(COMMON_WEAPONS.find((w) => w.name === 'Longbow')!)))).toBe('weapon-longbow.png')
    expect(file(itemArtSrc(named(dagger, 'Ultra Rare Longsword')))).toBe('weapon-longsword.png')
    expect(file(itemArtSrc(named(dagger, 'Legendary Greataxe', { tier: 'legendary' })))).toBe('weapon-greataxe-up.png')
    expect(file(itemArtSrc(named(dagger, 'Blue Dagger')))).toBe('weapon-dagger.png')
    expect(file(itemArtSrc(named(dagger, 'Mythic Warhammer', { tier: 'mythic' })))).toBe('weapon-warhammer-up.png')
  })

  it('maps shields from shieldId, and from the name when the id is missing', () => {
    expect(file(itemArtSrc(shieldItem('shield-small', 'green')))).toBe('shield-small.png')
    expect(file(itemArtSrc(shieldItem('shield-medium', 'purple')))).toBe('shield-medium.png')
    expect(file(itemArtSrc(shieldItem('shield-heavy', 'blue')))).toBe('shield-heavy.png')
    expect(file(itemArtSrc(shieldItem('shield-small', 'legendary')))).toBe('shield-small-up.png')
    expect(file(itemArtSrc(shieldItem('shield-medium', 'mythic')))).toBe('shield-medium-up.png')
    expect(file(itemArtSrc(shieldItem('shield-heavy', 'legendary')))).toBe('shield-heavy-up.png')
    expect(file(itemArtSrc({ name: 'Rare Medium Shield', kind: 'shield', tier: 'blue' }))).toBe('shield-medium.png')
    expect(itemArtSrc({ name: 'Small Shield', kind: 'shield', shieldId: 'shield-tower', tier: 'green' })).toBeNull()
  })

  it('maps accessories by name, with -up only at legendary and mythic', () => {
    expect(file(itemArtSrc(accessoryItem('iron-cap')))).toBe('accessory-iron-cap.png')
    expect(file(itemArtSrc(accessoryItem('archer-gauntlets')))).toBe('accessory-archer-gauntlets.png')
    expect(file(itemArtSrc(accessoryItem('softstep-boots')))).toBe('accessory-softstep-boots.png')
    expect(file(itemArtSrc({ ...accessoryItem('iron-cap'), tier: 'legendary' }))).toBe('accessory-iron-cap-up.png')
    expect(file(itemArtSrc({ ...accessoryItem('softstep-boots'), tier: 'mythic' }))).toBe('accessory-softstep-boots-up.png')
    expect(file(itemArtSrc({ ...accessoryItem('archer-gauntlets'), name: 'Rare Archer’s Gauntlets' }))).toBe('accessory-archer-gauntlets.png')
  })

  it('maps generic mats, legacy monster parts, and scrap', () => {
    expect(file(itemArtSrc(materialItem('gray')))).toBe('material-gray.png')
    expect(file(itemArtSrc(materialItem('green', 2)))).toBe('material-green.png')
    expect(file(itemArtSrc(materialItem('blue')))).toBe('material-blue.png')
    expect(file(itemArtSrc(materialItem('purple')))).toBe('material-purple.png')
    expect(file(itemArtSrc(materialItem('orange')))).toBe('material-orange.png')
    expect(file(itemArtSrc(materialItem('red')))).toBe('material-red.png')
    for (const key of ['wolf_pelt', 'goblin_rag', 'iron_scrap', 'ogre_hide', 'dragon_scale'] as const) {
      expect(file(itemArtSrc({ name: key, kind: 'misc', materialKey: key }))).toBe(`material-${key}.png`)
    }
    expect(file(itemArtSrc({ name: 'Scrap', kind: 'misc', materialKey: 'scrap' }))).toBe('material-scrap.png')
    expect(file(itemArtSrc({ name: 'Scrap', kind: 'misc', materialKey: 'scrap_mythic' }))).toBe('material-scrap.png')
  })

  it('maps pink uniques and Whisperfang ahead of the weapon table', () => {
    expect(file(itemArtSrc(pinkLantern()))).toBe('special-pink-lantern.png')
    expect(file(itemArtSrc(pinkCoin()))).toBe('special-pink-coin.png')
    expect(file(itemArtSrc(whisperfang()))).toBe('special-whisperfang.png')
    expect(file(itemArtSrc({ ...whisperfang(), weaponId: 'dagger' }))).toBe('special-whisperfang.png')
  })

  it('maps heal tiers, other potions, oils, scrolls, and repair kits', () => {
    expect(file(itemArtSrc(potionOfHealing()))).toBe('potion-heal-green.png')
    expect(file(itemArtSrc(cat('heal-blue')))).toBe('potion-heal-blue.png')
    expect(file(itemArtSrc(cat('heal-purple')))).toBe('potion-heal-purple.png')
    expect(file(itemArtSrc(cat('heal-legendary')))).toBe('potion-heal-legendary.png')
    expect(file(itemArtSrc({ name: 'Potion of Healing', kind: 'consumable', heal: '2d4+2' }))).toBe('potion-heal.png')
    expect(file(itemArtSrc({ name: 'Mythic Healing Potion', kind: 'consumable', tier: 'mythic', heal: '1d12' }))).toBe('potion-heal.png')

    expect(file(itemArtSrc(cat('oil-piercing')))).toBe('oil-vial.png')
    expect(file(itemArtSrc(cat('whetstone')))).toBe('oil-vial.png')
    expect(file(itemArtSrc(cat('mirror-long')))).toBe('oil-vial.png')
    expect(file(itemArtSrc(cat('liquid-courage')))).toBe('potion-generic.png')
    expect(file(itemArtSrc(cat('ember-flask')))).toBe('potion-generic.png')
    expect(file(itemArtSrc(cat('field-repair')))).toBe('kit-repair.png')
    expect(file(itemArtSrc(repairKitItem('blue')))).toBe('kit-repair.png')
    expect(file(itemArtSrc(cat('borrowed-skill')))).toBe('scroll-generic.png')
    expect(file(itemArtSrc({ name: 'Scroll of Fireball', kind: 'scroll' }))).toBe('scroll-generic.png')
  })

  it('does not invent art for unknown ids or misc gear with no picture', () => {
    expect(itemArtSrc({ name: 'Stick', kind: 'weapon' })).toBeNull()
    expect(itemArtSrc({ name: 'Dagger', kind: 'weapon', weaponId: 'unknown-shiv' })).toBeNull()
    expect(itemArtSrc({ name: 'Plate', kind: 'armor', armorId: 'mythril', tier: 'green' })).toBeNull()
    expect(itemArtSrc({ name: 'Rope', kind: 'misc' })).toBeNull()
  })

  it('points the loot pouch at pouch-gold.png', () => {
    expect(file(POUCH_ART_SRC)).toBe('pouch-gold.png')
  })
})
