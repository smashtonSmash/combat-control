import { armorDamagedFlag, isBroken } from './durability'
import { catalogItem, catalogToItem } from './catalog'
import { useCatalogItem } from './effects'
import type { Character, DamageType, Item } from './types'
import { uid } from './types'
import { TIER_SHORT, armorAc, armorById, armorLabel, type Tier } from './armor'
import { abilityMod, rollExpression } from './dice'
import { charProf } from './seed'
import { damageFor, scrollStats, type CharSpell } from './spells'

export const KIND_ICON: Record<Item['kind'], string> = { armor: '🛡', weapon: '⚔️', consumable: '🧪', scroll: '📜', misc: '📦' }

/** A spell scroll anyone can use (house rule: no class/ability check). */
export function scrollItem(spell: CharSpell): Item {
  const st = scrollStats(spell.level)
  return { id: uid(), name: `Scroll of ${spell.name}`, kind: 'scroll', qty: 1,
    description: `${spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`} spell scroll · save DC ${st.dc} · spell attack +${st.attack}${spell.save ? ` · ${spell.save} save` : ''}\n\n${spell.description}`,
    scroll: { kind: 'spell', spell: { ...spell, id: uid(), prepared: false } } }
}

/** Cast a spell scroll (no slot): rolls damage at the printed level. */
export function scrollCastText(who: string, spell: CharSpell) {
  const st = scrollStats(spell.level)
  const dice = damageFor(spell, Math.max(1, spell.level), 1)
  let t = `${who} reads a Scroll of ${spell.name} (level ${spell.level}, DC ${st.dc}, +${st.attack} to hit).`
  if (dice) { const r = rollExpression(dice); t += ` Damage ${dice}: ${r.detail} = ${r.total} ${spell.damageType ?? ''}.` }
  if (spell.save) t += ` Targets save: ${spell.save} vs DC ${st.dc}.`
  if (spell.effect === 'resistance') t += ` Grants resistance to ${spell.effectType}${spell.effectRounds ? ` for ${spell.effectRounds} rounds` : ''}.`
  if (spell.effectNote && spell.effect === 'buff') t += ` ${spell.effectNote}.`
  return t + ' The scroll crumbles to dust.'
}

/** Green Healing Potion (replaces the old Potion of Healing 2d4+2). */
export const potionOfHealing = (): Item => catalogToItem(catalogItem('heal-green')!)
export const armorItem = (armorId: string, tier: Tier): Item => {
  const a = armorById(armorId)!
  return { id: uid(), name: `${TIER_SHORT[tier]} ${a.name} Armor`, kind: 'armor', qty: 1, armorId, tier, description: `${a.category} armor · ${a.focus}` }
}
export const COMMON_WEAPONS: { name: string; damage: string; damageType: DamageType }[] = [
  { name: 'Dagger', damage: '1d4', damageType: 'piercing' },
  { name: 'Shortsword', damage: '1d6', damageType: 'piercing' },
  { name: 'Rapier', damage: '1d8', damageType: 'piercing' },
  { name: 'Longsword', damage: '1d8', damageType: 'slashing' },
  { name: 'Handaxe', damage: '1d6', damageType: 'slashing' },
  { name: 'Greataxe', damage: '1d12', damageType: 'slashing' },
  { name: 'Mace', damage: '1d6', damageType: 'bludgeoning' },
  { name: 'Warhammer', damage: '1d8', damageType: 'bludgeoning' },
  { name: 'Shortbow', damage: '1d6', damageType: 'piercing' },
  { name: 'Longbow', damage: '1d8', damageType: 'piercing' },
]
export const weaponItem = (w: (typeof COMMON_WEAPONS)[number]): Item => ({ id: uid(), name: w.name, kind: 'weapon', qty: 1, damage: w.damage, damageType: w.damageType, description: `${w.damage} ${w.damageType}` })

/** Re-derive armor label + AC (unless AC is manual). */
export function recalcArmor(c0: Character): Character {
  const c = { ...c0, armorDamaged: armorDamagedFlag(c0) || undefined }
  const ac = armorAc(c, abilityMod(c.abilities.dex))
  return { ...c, tierV: 2, ...(ac !== null && !c.acManual ? { ac } : {}), ...(c.armorId ? { armor: armorLabel(c) } : {}) }
}

const weaponAttackId = (it: Item) => 'item-' + it.id

export function equip(c: Character, itemId: string): Character {
  const inv = c.inventory ?? []
  const it = inv.find((x) => x.id === itemId)
  if (!it) return c
  if (it.kind === 'armor') {
    if (it.atForge || isBroken(it)) return c // at the blacksmith / Broken until repaired
    // one armor at a time
    const next = { ...c, armorId: it.armorId, armorTier: it.tier, inventory: inv.map((x) => (x.kind === 'armor' ? { ...x, equipped: x.id === itemId } : x)) }
    return recalcArmor(next)
  }
  if (it.kind === 'weapon') {
    const mod = Math.max(abilityMod(c.abilities.str), abilityMod(c.abilities.dex))
    const atk = { id: weaponAttackId(it), name: it.name + (it.coating ? ` (${it.coating.source})` : ''), toHit: charProf(c) + mod, damage: `${it.damage ?? '1d4'}${mod ? (mod > 0 ? '+' : '') + mod : ''}`,
      damageType: it.coating?.type ?? it.damageType ?? 'bludgeoning' as DamageType, ...(it.coating?.bonus ? { bonus: it.coating.bonus } : {}) }
    return { ...c, attacks: [...c.attacks.filter((a) => a.id !== atk.id), atk], inventory: inv.map((x) => (x.id === itemId ? { ...x, equipped: true } : x)) }
  }
  return c
}

export function unequip(c: Character, itemId: string): Character {
  const inv = c.inventory ?? []
  const it = inv.find((x) => x.id === itemId)
  if (!it) return c
  const base = { ...c, inventory: inv.map((x) => (x.id === itemId ? { ...x, equipped: false } : x)) }
  if (it.kind === 'armor') return { ...base, armorId: undefined, armorTier: undefined, armorDamaged: undefined, armor: 'No armor', ...(c.acManual ? {} : { ac: 10 + abilityMod(c.abilities.dex) }) }
  if (it.kind === 'weapon') return { ...base, attacks: c.attacks.filter((a) => a.id !== weaponAttackId(it)) }
  return base
}

export function removeItem(c: Character, itemId: string, qty = Infinity): Character {
  const it = (c.inventory ?? []).find((x) => x.id === itemId)
  if (!it) return c
  const cc = it.equipped ? unequip(c, itemId) : c
  const inv = (cc.inventory ?? []).flatMap((x) => (x.id !== itemId ? [x] : x.qty - qty > 0 ? [{ ...x, qty: x.qty - qty }] : []))
  return { ...cc, inventory: inv }
}

export function addItem(c: Character, item: Item): Character {
  const inv = c.inventory ?? []
  // stack identical unequipped consumables/misc
  const same = (item.kind === 'consumable' || item.kind === 'misc' || item.kind === 'scroll') && inv.find((x) => x.kind === item.kind && x.name === item.name && x.heal === item.heal && x.catalogKey === item.catalogKey && x.tier === item.tier)
  if (same) return { ...c, inventory: inv.map((x) => (x === same ? { ...x, qty: x.qty + item.qty } : x)) }
  return { ...c, inventory: [...inv, { ...item, equipped: false }] }
}

export function useItem(c: Character, itemId: string, opts: { targetId?: string } = {}): { char: Character; message: string } {
  const it = (c.inventory ?? []).find((x) => x.id === itemId)
  if (!it) return { char: c, message: '' }
  const cat = catalogItem(it.catalogKey)
  if (cat) { const r = useCatalogItem(c, it, cat, opts); return { char: r.char, message: r.message } }
  let char = removeItem(c, itemId, 1)
  if (it.kind === 'scroll' && it.scroll?.kind === 'spell') return { char, message: scrollCastText(c.name, it.scroll.spell) }
  if (it.heal) {
    const r = rollExpression(it.heal)
    const cur = c.currentHp ?? c.maxHp
    const hp = Math.min(c.maxHp, cur + Math.max(0, r.total))
    char = { ...char, currentHp: hp }
    return { char, message: `${c.name} drinks ${it.name}: ${r.detail || r.total} → heals ${r.total} (HP ${cur}→${hp})` }
  }
  return { char, message: `${c.name} used ${it.name}.` }
}
