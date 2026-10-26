import { describe, expect, it } from 'vitest'
import { accessoryItem } from './accessories'
import { armorItem, COMMON_WEAPONS, potionOfHealing, weaponItem } from './inventory'
import { itemArtSrc, POUCH_ART_SRC } from './itemArt'
import { materialItem } from './salvage'
import { pinkLantern, whisperfang } from './specialGear'
import type { Item } from './types'
import { tieredWeapon } from './weapons'

const file = (src: string | null) => src?.split('/').pop()

const named = (base: Item, name: string, extra: Partial<Item> = {}): Item => ({ ...base, name, ...extra })

describe('item art', () => {
  it('uses armor-{id}.png, and -up only for legendary and mythic', () => {
    expect(file(itemArtSrc(armorItem('padded', 'green')))).toBe('armor-padded.png')
    expect(file(itemArtSrc(armorItem('leather', 'blue')))).toBe('armor-leather.png')
    expect(file(itemArtSrc(armorItem('studded', 'purple')))).toBe('armor-studded.png')
    expect(file(itemArtSrc(armorItem('padded', 'legendary')))).toBe('armor-padded-up.png')
    expect(file(itemArtSrc(armorItem('leather', 'mythic')))).toBe('armor-leather-up.png')
    expect(file(itemArtSrc(armorItem('studded', 'legendary')))).toBe('armor-studded-up.png')
  })

  it('prefers weaponId, otherwise maps known names after stripping a tier prefix', () => {
    expect(file(itemArtSrc(tieredWeapon('longsword', 'green')))).toBe('weapon-longsword.png')
    expect(file(itemArtSrc(tieredWeapon('greatsword', 'blue')))).toBe('weapon-greatsword.png')
    expect(file(itemArtSrc(tieredWeapon('dagger', 'legendary')))).toBe('weapon-dagger-up.png')
    expect(file(itemArtSrc(tieredWeapon('shortbow', 'mythic')))).toBe('weapon-shortbow-up.png')
    expect(file(itemArtSrc({ ...tieredWeapon('dagger', 'green'), name: 'Goblin Shiv' }))).toBe('weapon-dagger.png')

    const dagger = weaponItem(COMMON_WEAPONS.find((w) => w.name === 'Dagger')!)
    expect(file(itemArtSrc(dagger))).toBe('weapon-dagger.png')
    expect(file(itemArtSrc(weaponItem(COMMON_WEAPONS.find((w) => w.name === 'Longbow')!)))).toBe('weapon-longbow.png')
    expect(file(itemArtSrc(named(dagger, 'Ultra Rare Longsword')))).toBe('weapon-longsword.png')
    expect(file(itemArtSrc(named(dagger, 'Legendary Greataxe', { tier: 'legendary' })))).toBe('weapon-greataxe-up.png')
    expect(file(itemArtSrc(named(dagger, 'Blue Dagger')))).toBe('weapon-dagger.png')
    expect(file(itemArtSrc(named(dagger, 'Mythic Warhammer', { tier: 'mythic' })))).toBe('weapon-warhammer-up.png')
  })

  it('does not invent art for other kinds, unknown ids, or a weaponId that misses', () => {
    expect(itemArtSrc(potionOfHealing())).toBeNull()
    expect(itemArtSrc(whisperfang())).toBeNull()
    expect(itemArtSrc(pinkLantern())).toBeNull()
    expect(itemArtSrc(accessoryItem('iron-cap'))).toBeNull()
    expect(itemArtSrc(materialItem('wolf_pelt', 2))).toBeNull()
    expect(itemArtSrc({ name: 'Stick', kind: 'weapon' })).toBeNull()
    expect(itemArtSrc({ name: 'Plate', kind: 'armor', armorId: 'plate', tier: 'green' })).toBeNull()
    expect(itemArtSrc({ name: 'Dagger', kind: 'weapon', weaponId: 'goblin-shiv' })).toBeNull()
    expect(itemArtSrc({ name: 'Scroll of Fireball', kind: 'scroll' })).toBeNull()
  })

  it('points the loot pouch at pouch-gold.png', () => {
    expect(file(POUCH_ART_SRC)).toBe('pouch-gold.png')
  })
})
