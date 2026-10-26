import { armorDamagedFlag, isBroken } from './durability'
import { catalogItem, catalogToItem } from './catalog'
import { applyTierKit, useCatalogItem } from './effects'
import type { Character, DamageType, Item } from './types'
import { uid } from './types'
import { TIER_SHORT, armorAc, armorById, armorLabel, type Tier } from './armor'
import { abilityMod, rollExpression } from './dice'
import { charProf } from './seed'
import { accessoryAc, rangedToHitBonus } from './accessories'
import { weaponStyle } from './weapons'
import { shieldAcBonus, shieldById } from './shields'
import { wieldBlock } from './specialGear'
import type { ShieldMode } from './types'
import { damageFor, scrollStats, type CharSpell } from './spells'

export const KIND_ICON: Record<Item['kind'], string> = { armor: '🛡', weapon: '⚔️', shield: '🛡️', consumable: '🧪', scroll: '📜', misc: '📦' }

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

/** Common Healing Potion. Heals 2d6+2. Older 2d4+2 and 2d8+2 copies migrate to this. */
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

/** Re-derive armor label + AC (unless AC is manual). Helmet AC is a flat bonus, not an armor layer. */
export function recalcArmor(c0: Character): Character {
  const c = { ...c0, armorDamaged: armorDamagedFlag(c0) || undefined }
  const dex = abilityMod(c.abilities.dex)
  const arm = armorAc(c, dex)
  const bonus = accessoryAc(c) + shieldAcBonus(c)
  if (c.acManual) return { ...c, tierV: 2, ...(c.armorId ? { armor: armorLabel(c) } : {}) }
  const shield = shieldAcBonus(c)
  if (arm === null && !shield) return { ...c, tierV: 2, ...(c.armorId ? { armor: armorLabel(c) } : {}) }
  const ac = (arm ?? 10 + dex) + bonus
  return { ...c, tierV: 2, ac, ...(c.armorId ? { armor: armorLabel(c) } : {}) }
}

function refreshRanged(c: Character): Character {
  let n = c
  for (const w of (c.inventory ?? []).filter((i) => i.kind === 'weapon' && i.equipped && weaponStyle(i) === 'ranged')) n = equip(n, w.id)
  return n
}

const weaponAttackId = (it: Item) => 'item-' + it.id
const shieldAttackId = (it: Item) => 'shield-' + it.id

/** Heavy shield mode, or the mode a small/medium shield is sitting in. Wielded is the default. */
export function setShieldMode(c: Character, itemId: string, mode: ShieldMode): Character {
  const it = (c.inventory ?? []).find((i) => i.id === itemId)
  if (!it || it.kind !== 'shield') return c
  let n: Character = {
    ...c,
    inventory: (c.inventory ?? []).map((i) => (i.kind === 'shield' ? { ...i, equipped: i.id === itemId, ...(i.id === itemId ? { shieldMode: mode } : {}) } : i)),
    attacks: c.attacks.filter((a) => a.id !== shieldAttackId(it)),
  }
  const def = shieldById(it.shieldId)
  if (def?.occupiesHand && mode === 'wielded') {
    for (const w of (n.inventory ?? []).filter((i) => i.kind === 'weapon' && i.equipped)) {
      n = { ...n, attacks: n.attacks.filter((a) => a.id !== weaponAttackId(w)), inventory: (n.inventory ?? []).map((i) => (i.id === w.id ? { ...i, equipped: false } : i)) }
    }
  }
  if (def?.bash && it.tier && mode === 'wielded') {
    const str = abilityMod(n.abilities.str)
    n = { ...n, attacks: [...n.attacks, { id: shieldAttackId(it), name: `${it.name} Bash`, toHit: charProf(n) + str, damage: `${def.bash[it.tier]}${str ? (str > 0 ? '+' : '') + str : ''}`, damageType: 'bludgeoning' }] }
  }
  return recalcArmor(n)
}

export function equip(c: Character, itemId: string): Character {
  const inv = c.inventory ?? []
  const it = inv.find((x) => x.id === itemId)
  if (!it) return c
  if (it.kind === 'armor') {
    if (it.atForge || isBroken(it) || it.salvaged) return c // at the blacksmith / Broken / waiting to be salvaged
    // one armor at a time
    const next = { ...c, armorId: it.armorId, armorTier: it.tier, swornType: it.swornType, inventory: inv.map((x) => (x.kind === 'armor' ? { ...x, equipped: x.id === itemId } : x)) }
    return recalcArmor(next)
  }
  if (it.kind === 'shield') {
    if (it.atForge || isBroken(it)) return c
    return setShieldMode(c, itemId, it.shieldMode ?? 'wielded')
  }
  if (it.equipSlot) {
    const next = recalcArmor({ ...c, inventory: inv.map((x) => (x.equipSlot === it.equipSlot ? { ...x, equipped: x.id === itemId } : x)) })
    return refreshRanged(next)
  }
  if (it.kind === 'weapon') {
    if (it.atForge || isBroken(it) || wieldBlock(it, c.id)) return c
    const style = weaponStyle(it)
    let attacks = c.attacks
    let nextInv = inv
    const heavy = inv.find((x) => x.kind === 'shield' && x.equipped && shieldById(x.shieldId)?.occupiesHand && (x.shieldMode ?? 'wielded') === 'wielded')
    if (heavy) {
      attacks = attacks.filter((a) => a.id !== shieldAttackId(heavy))
      nextInv = nextInv.map((x) => (x.id === heavy.id ? { ...x, equipped: false } : x))
    }
    for (const other of nextInv.filter((x) => x.kind === 'weapon' && x.equipped && x.id !== it.id && weaponStyle(x) === style)) {
      attacks = attacks.filter((a) => a.id !== weaponAttackId(other))
      nextInv = nextInv.map((x) => (x.id === other.id ? { ...x, equipped: false } : x))
    }
    nextInv = nextInv.map((x) => (x.id === itemId ? { ...x, equipped: true } : x))
    const ability = Math.max(abilityMod(c.abilities.str), abilityMod(c.abilities.dex))
    const mod = ability + (style === 'ranged' ? rangedToHitBonus({ ...c, inventory: nextInv }) : 0)
    const atk = { id: weaponAttackId(it), name: it.name + (it.coating ? ` (${it.coating.source})` : ''), toHit: charProf(c) + mod, damage: `${it.damage ?? '1d4'}${ability ? (ability > 0 ? '+' : '') + ability : ''}`,
      damageType: it.coating?.type ?? it.damageType ?? 'bludgeoning' as DamageType, ...(it.coating?.bonus ? { bonus: it.coating.bonus } : {}) }
    return recalcArmor({ ...c, attacks: [...attacks.filter((a) => a.id !== atk.id), atk], inventory: nextInv })
  }
  return c
}

export function unequip(c: Character, itemId: string): Character {
  const inv = c.inventory ?? []
  const it = inv.find((x) => x.id === itemId)
  if (!it) return c
  const base = { ...c, inventory: inv.map((x) => (x.id === itemId ? { ...x, equipped: false } : x)) }
  if (it.kind === 'armor') {
    const cleared = { ...base, armorId: undefined, armorTier: undefined, swornType: undefined, armorDamaged: undefined, armor: 'No armor' }
    return c.acManual ? cleared : recalcArmor(cleared)
  }
  if (it.kind === 'shield') {
    const cleared = { ...base, attacks: c.attacks.filter((a) => a.id !== shieldAttackId(it)) }
    return c.acManual ? cleared : recalcArmor(cleared)
  }
  if (it.kind === 'weapon') return recalcArmor({ ...base, attacks: c.attacks.filter((a) => a.id !== weaponAttackId(it)) })
  if (it.equipSlot) return refreshRanged(recalcArmor(base))
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
  const same = (item.kind === 'consumable' || item.kind === 'misc' || item.kind === 'scroll') && !item.special && !item.equipSlot
    && inv.find((x) => !x.equipped && !x.special && !x.equipSlot && x.kind === item.kind && x.name === item.name && x.heal === item.heal && x.catalogKey === item.catalogKey && x.tier === item.tier && x.materialKey === item.materialKey && x.kitTier === item.kitTier && x.kitArmorId === item.kitArmorId)
  if (same) return { ...c, inventory: inv.map((x) => (x === same ? { ...x, qty: x.qty + item.qty } : x)) }
  return { ...c, inventory: [...inv, { ...item, equipped: false }] }
}

export function useItem(c: Character, itemId: string, opts: { targetId?: string } = {}): { char: Character; message: string } {
  const it = (c.inventory ?? []).find((x) => x.id === itemId)
  if (!it) return { char: c, message: '' }
  if (it.kitTier) {
    if (!opts.targetId) return { char: c, message: 'Choose which armor this kit repairs.' }
    const r = applyTierKit(c, it.id, opts.targetId)
    return { char: r.char, message: r.message }
  }
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
