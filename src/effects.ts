// Using homebrew potions & scrolls, active effects, fusing and shop purchases.
import type { ActiveEffect, Character, Item } from './types'
import { uid } from './types'
import { TIER_SHORT, armorById } from './armor'
import { catalogItem, FUSE_FEES, FUSE_NOTE, nextTier, WEAPON_MISS_WEAR, type CatalogItem } from './catalog'
import { addItem, armorItem, equip, recalcArmor, removeItem, unequip } from './inventory'
import { durOf, isBroken, maxDur, missing, repairCost, setDur } from './durability'
import { kitMatches, materialDef, materialItem, MATERIALS_PER_KIT, repairKitItem, salvageBundle, salvageRefundSilver } from './salvage'
import { tieredWeapon, weaponById } from './weapons'
import { fromSilver, purseSilver } from './party'
import { rollExpression } from './dice'
import type { Tier } from './armor'

export interface UseResult { char: Character; message: string; ok: boolean }
const addEffect = (c: Character, e: Omit<ActiveEffect, 'id'>): Character => ({ ...c, effects: [...(c.effects ?? []).filter((x) => x.key !== e.key), { ...e, id: uid() }] })
export const hasEffect = (c: Character | undefined, kind: ActiveEffect['kind']) => !!c?.effects?.some((e) => e.kind === kind)
export const effectOf = (c: Character | undefined, kind: ActiveEffect['kind']) => c?.effects?.find((e) => e.kind === kind)
export const equippedWeapon = (c: Character) => (c.inventory ?? []).find((i) => i.kind === 'weapon' && i.equipped)
export const equippedArmorItem = (c: Character) => (c.inventory ?? []).find((i) => i.kind === 'armor' && i.equipped)

/** Re-derive weapon attacks (picks up coatings). */
export function refreshWeapons(c: Character): Character {
  let n = c
  for (const w of (c.inventory ?? []).filter((i) => i.kind === 'weapon' && i.equipped)) n = equip(n, w.id)
  return n
}

/** Use a catalog potion/scroll. ok=false → not used (item kept). */
export function useCatalogItem(c: Character, it: Item, cat: CatalogItem = catalogItem(it.catalogKey)!, opts: { targetId?: string } = {}): UseResult {
  const who = c.name || 'Someone'
  const spent = removeItem(c, it.id, 1)
  const fail = (message: string): UseResult => ({ char: c, message, ok: false })
  const e = cat.effect
  switch (e.kind) {
    case 'heal': {
      const r = rollExpression(e.dice), cur = c.currentHp ?? c.maxHp, hp = Math.min(c.maxHp, cur + Math.max(0, r.total))
      return { char: { ...spent, currentHp: hp }, message: `${who} drinks ${it.name}: ${r.detail || r.total} → heals ${r.total} (HP ${cur}→${hp})`, ok: true }
    }
    case 'fullHeal': {
      const cur = c.currentHp ?? c.maxHp
      return { char: { ...spent, currentHp: c.maxHp }, message: `${who} drinks ${it.name}: fully healed (HP ${cur}→${c.maxHp})`, ok: true }
    }
    case 'weaponType': case 'weaponBonus': {
      const w = equippedWeapon(spent)
      if (!w) return fail(`Equip a weapon first, then use ${it.name}.`)
      const coating = e.kind === 'weaponType' ? { ...w.coating, type: e.type, source: it.name } : { ...w.coating, bonus: { dice: e.dice, type: e.type }, source: it.name }
      const n = refreshWeapons({ ...spent, inventory: (spent.inventory ?? []).map((x) => (x.id === w.id ? { ...x, coating } : x)) })
      return { char: n, ok: true, message: e.kind === 'weaponType' ? `${who} coats ${w.name} with ${it.name}: it deals ${e.type} damage until the next long rest.` : `${who} pours ${it.name} on ${w.name}: +${e.dice} ${e.type} until the next long rest. (Or throw it: 10 ft fire area.)` }
    }
    case 'acBonus':
      return { char: addEffect(spent, { key: cat.key, kind: 'acBonus', name: cat.name, amount: e.amount, until: 'combat', note: `+${e.amount} AC${e.speed ? `, ${e.speed} ft speed` : ''} (1 minute — ends at End combat)` }), ok: true, message: `${who} drinks ${it.name}: +${e.amount} AC, ${e.speed} ft speed for 1 minute.` }
    case 'stoneskin':
      if (spent.armorTier !== 'mythic' && spent.underTier !== 'mythic') return fail('Stoneskin Mud only matters on Mythic armor — equip it first.')
      return { char: addEffect(spent, { key: cat.key, kind: 'stoneskin', name: cat.name, until: 'long', note: "Mythic armor's −1 AC penalties removed until the next long rest" }), ok: true, message: `${who} smears ${it.name} on their armor: Mythic −1 AC penalties are gone until the next long rest.` }
    case 'frostbite':
      return { char: addEffect(spent, { key: cat.key, kind: 'frostbite', name: cat.name, until: 'long', note: 'Melee attackers who hit take 1d4 cold (until the next long rest)' }), ok: true, message: `${who} rubs ${it.name} on their armor: melee attackers who hit take 1d4 cold.` }
    case 'mirror':
      return { char: addEffect(spent, { key: 'mirror', kind: 'mirror', name: cat.name, until: e.until, note: `Attacks against you deal your weapon's damage type${e.until === 'combat' ? ' (1 minute — ends at End combat)' : ' (until the next long rest)'}` }), ok: true, message: `${who} coats their armor with ${it.name}.` }
    case 'secondWind':
      return { char: addEffect(spent, { key: cat.key, kind: 'secondWind', name: cat.name, until: 'long', note: "Next time you'd drop to 0 HP, drop to 1 instead" }), ok: true, message: `${who} drinks ${it.name}: the next drop to 0 HP becomes 1.` }
    case 'mending': {
      const a = equippedArmorItem(spent)
      if (!a || !spent.armorTier) return fail('Equip armor first, then read Scroll of Mending Steel.')
      const up = nextTier(spent.armorTier)
      if (!up) return fail('Mythic armor is already the highest tier.')
      const n = recalcArmor({ ...setDur(addEffect(spent, { key: cat.key, kind: 'mending', name: cat.name, until: 'combat', restoreTier: spent.armorTier, note: `Armor raised ${TIER_SHORT[spent.armorTier]} → ${TIER_SHORT[up]} for this fight` }), a.id, maxDur(a)), armorTier: up })
      return { char: n, ok: true, message: `${who} reads ${it.name}: ${a.name} is fully repaired (${maxDur(a)}/${maxDur(a)}) and fights as ${TIER_SHORT[up]} until End combat.` }
    }
    case 'whetstone':
      return { char: addEffect(spent, { key: cat.key, kind: 'whetstone', name: cat.name, until: 'long', note: 'Next weapon hit today is a critical hit' }), ok: true, message: `${who} hones their weapon with ${it.name}: the next hit today is a crit.` }
    case 'badge':
      return { char: addEffect(spent, { key: cat.key, kind: 'badge', name: cat.name, until: e.until ?? 'long', note: `${cat.desc}` }), ok: true, message: `${who} uses ${it.name}: ${cat.desc}` }
    case 'reminder':
      return { char: spent, ok: true, message: `${who} uses ${it.name}: ${cat.desc}` }
    case 'repairKit': {
      const a = (spent.inventory ?? []).find((x) => x.id === opts.targetId && x.kind === 'armor')
      if (!a) return fail('Choose which armor to repair.')
      if (isBroken(a)) return fail(`${a.name} is Broken — only a blacksmith can repair it.`)
      if (!missing(a)) return fail(`${a.name} is already at full durability.`)
      const r = rollExpression(e.dice), before = durOf(a)
      const n = recalcArmor(setDur(spent, a.id, before + Math.max(0, r.total)))
      const after = durOf(n.inventory!.find((x) => x.id === a.id)!)
      return { char: n, ok: true, message: `${who} uses ${it.name} on ${a.name} (short rest): ${r.detail || r.total} → durability ${before}→${after}/${maxDur(a)}.` }
    }
  }
}

/** Matching-tier kit. PLACEHOLDER: restores the armor to full, including Broken. Does not spend gold. */
export function applyTierKit(c: Character, kitId: string, armorItemId: string): UseResult {
  const kit = (c.inventory ?? []).find((i) => i.id === kitId)
  const armor = (c.inventory ?? []).find((i) => i.id === armorItemId)
  if (!kit?.kitTier || !armor || armor.kind !== 'armor') return { char: c, ok: false, message: 'Choose a repair kit and an armor.' }
  if (!kitMatches(kit, armor)) {
    const who = kit.kitArmorId ? `${kit.kitArmorId} ` : ''
    return { char: c, ok: false, message: `${kit.name} only repairs ${who}${TIER_SHORT[kit.kitTier]} armor.` }
  }
  if (!missing(armor)) return { char: c, ok: false, message: `${armor.name} is already at full durability.` }
  const before = durOf(armor)
  const n = recalcArmor(setDur(removeItem(c, kit.id, 1), armor.id, maxDur(armor)))
  return { char: n, ok: true, message: `${c.name} uses ${kit.name} on ${armor.name}: durability ${before}→${maxDur(armor)}/${maxDur(armor)}. No blacksmith visit.` }
}

/** Craft one kit from two of the same material. Leaves leftover materials in the pack. */
export function craftRepairKit(c: Character, materialKey: string): { char: Character; ok: boolean; message: string } {
  const def = materialDef(materialKey)
  if (!def) return { char: c, ok: false, message: 'Unknown material.' }
  const rows = (c.inventory ?? []).filter((i) => i.materialKey === materialKey)
  const have = rows.reduce((n, i) => n + i.qty, 0)
  if (have < MATERIALS_PER_KIT) return { char: c, ok: false, message: `Need ${MATERIALS_PER_KIT} ${def.name} (have ${have}).` }
  let n = c
  let left = MATERIALS_PER_KIT
  for (const it of rows) {
    if (left <= 0) break
    const take = Math.min(left, it.qty)
    n = removeItem(n, it.id, take)
    left -= take
  }
  const kit = repairKitItem(def)
  return { char: addItem(n, kit), ok: true, message: `Crafted ${kit.name} from ${MATERIALS_PER_KIT} ${def.name}. PLACEHOLDER recipe.` }
}

export function markForSalvage(c: Character, itemId: string): Character {
  const it = (c.inventory ?? []).find((i) => i.id === itemId)
  if (!it || it.kind !== 'armor') return c
  const base = it.equipped ? unequip(c, itemId) : c
  return { ...base, inventory: (base.inventory ?? []).map((i) => (i.id === itemId ? { ...i, salvaged: true, equipped: false } : i)) }
}

/** Broken or marked armor → parts (enough for one kit) or a small coin refund. The armor is consumed. */
export function salvageArmor(c: Character, itemId: string, mode: 'materials' | 'coins'): { char: Character; ok: boolean; message: string } {
  const it = (c.inventory ?? []).find((i) => i.id === itemId)
  if (!it || it.kind !== 'armor' || !it.tier) return { char: c, ok: false, message: 'Choose armor to salvage.' }
  if (!isBroken(it) && !it.salvaged) return { char: c, ok: false, message: `${it.name} has to be Broken, or marked for salvage, before the blacksmith will break it down.` }
  const base = it.equipped ? unequip(c, itemId) : c
  let n = removeItem(base, itemId, 1)
  if (mode === 'coins') {
    const silver = salvageRefundSilver(it.tier)
    n = { ...n, purse: fromSilver(purseSilver(n.purse) + silver) }
    const g = Math.floor(silver / 10), s = silver % 10
    return { char: n, ok: true, message: `Salvaged ${it.name} for ${g}g${s ? ` ${s}s` : ''}. PLACEHOLDER refund.` }
  }
  const bundle = salvageBundle(it.armorId, it.tier)
  const mat = materialItem(bundle.materialKey, bundle.qty)
  n = addItem(n, mat)
  return { char: n, ok: true, message: `Salvaged ${it.name} into ${bundle.qty}× ${mat.name}. PLACEHOLDER mapping.` }
}

/** End combat clears fight effects; long rest clears long-rest effects (and fight ones) and weapon coatings. */
export function clearEffects(c: Character, at: 'combat' | 'long'): Character {
  const effects = c.effects ?? []
  const coated = at === 'long' && (c.inventory ?? []).some((i) => i.coating)
  const drop = effects.filter((e) => at === 'long' || e.until === 'combat')
  if (!drop.length && !coated) return c
  let n: Character = { ...c, effects: effects.filter((e) => !drop.includes(e)) }
  const mend = drop.find((e) => e.kind === 'mending')
  if (mend?.restoreTier) n = recalcArmor({ ...n, armorTier: mend.restoreTier })
  if (coated) n = refreshWeapons({ ...n, inventory: (n.inventory ?? []).map(({ coating: _c, ...i }) => i) })
  return n
}

/** Second Wind: if damage would drop to 0, go to 1 instead and use it up. */
export function applySecondWind(c: Character | undefined, newHp: number): { hp: number; char?: Character } {
  if (newHp > 0 || !c || !hasEffect(c, 'secondWind')) return { hp: newHp }
  return { hp: 1, char: { ...c, currentHp: 1, effects: (c.effects ?? []).filter((e) => e.kind !== 'secondWind') } }
}

// ---------- Shop ----------
export const totalSilver = (c: Character) => (c.purse?.gold ?? 0) * 10 + (c.purse?.silver ?? 0)
export function buy(c: Character, item: Item, priceSilver: number): { char: Character; ok: boolean; message: string } {
  if (totalSilver(c) < priceSilver) return { char: c, ok: false, message: `${c.name} can't afford ${item.name} (${fmtCost(priceSilver)}).` }
  const left = totalSilver(c) - priceSilver
  return { char: addItem({ ...c, purse: { gold: Math.floor(left / 10), silver: left % 10 } }, item), ok: true, message: `${c.name} bought ${item.name} for ${fmtCost(priceSilver)}.` }
}
export const fmtCost = (s: number) => `${Math.floor(s / 10)}g${s % 10 ? ` ${s % 10}s` : ''}`

// ---------- Blacksmith ----------
export interface FuseGroup { armorId: string; tier: Tier; items: Item[]; next: Tier | null; fee: number | null }
export function fuseGroups(c: Character): FuseGroup[] {
  const m = new Map<string, FuseGroup>()
  for (const it of c.inventory ?? []) {
    if (it.kind !== 'armor' || !it.armorId || !it.tier || it.atForge) continue
    const k = it.armorId + ':' + it.tier
    const g = m.get(k) ?? { armorId: it.armorId, tier: it.tier, items: [], next: nextTier(it.tier), fee: FUSE_FEES[it.tier] ?? null }
    for (let i = 0; i < it.qty; i++) g.items.push(it)
    m.set(k, g)
  }
  return [...m.values()]
}
export function fuse(c: Character, armorId: string, tier: Tier, opts: { atForge?: boolean } = {}): { char: Character; ok: boolean; message: string; item?: Item } {
  const g = fuseGroups(c).find((x) => x.armorId === armorId && x.tier === tier)
  const name = `${TIER_SHORT[tier]} ${armorById(armorId)?.name ?? ''} Armor`
  if (!g || g.items.length < 2) return { char: c, ok: false, message: `Need two ${name}s to fuse.` }
  if (!g.next || g.fee == null) return { char: c, ok: false, message: `${name} can't be fused any higher.` }
  const fee = g.fee * 10
  if (totalSilver(c) < fee) return { char: c, ok: false, message: `${c.name} needs ${g.fee}g for the blacksmith's fee.` }
  let n = c
  const [a, b] = g.items
  n = removeItem(n, a.id, 1); n = removeItem(n, b.id, 1)
  const left = totalSilver(n) - fee
  const made = { ...armorItem(armorId, g.next), ...(opts.atForge ? { atForge: true } : {}) }
  n = addItem({ ...n, purse: { gold: Math.floor(left / 10), silver: left % 10 } }, made)
  return { char: n, ok: true, item: made, message: `${c.name} pays ${g.fee}g: two ${name}s → ${made.name}. ${FUSE_NOTE}${opts.atForge ? ' Marked “at the forge” until the DM taps Ready.' : ''}` }
}
export const forgeReady = (c: Character, itemId: string): Character => ({ ...c, inventory: (c.inventory ?? []).map((i) => (i.id === itemId ? { ...i, atForge: undefined } : i)) })

export interface WeaponFuseGroup { weaponId: string; tier: Tier; items: Item[]; next: Tier | null; fee: number | null }
export function weaponFuseGroups(c: Character): WeaponFuseGroup[] {
  const m = new Map<string, WeaponFuseGroup>()
  for (const it of c.inventory ?? []) {
    if (it.kind !== 'weapon' || !it.weaponId || !it.tier || it.special || it.atForge) continue
    const k = it.weaponId + ':' + it.tier
    const g = m.get(k) ?? { weaponId: it.weaponId, tier: it.tier, items: [], next: nextTier(it.tier), fee: FUSE_FEES[it.tier] ?? null }
    for (let i = 0; i < it.qty; i++) g.items.push(it)
    m.set(k, g)
  }
  return [...m.values()]
}
/** Two weapons of the same catalog id and tier, plus the same fee scale as armor, become the next tier. */
export function fuseWeapon(c: Character, weaponId: string, tier: Tier, opts: { atForge?: boolean } = {}): { char: Character; ok: boolean; message: string; item?: Item } {
  const g = weaponFuseGroups(c).find((x) => x.weaponId === weaponId && x.tier === tier)
  const name = `${TIER_SHORT[tier]} ${weaponById(weaponId)?.name ?? 'weapon'}`
  if (!g || g.items.length < 2) return { char: c, ok: false, message: `Need two ${name}s to fuse.` }
  if (!g.next || g.fee == null) return { char: c, ok: false, message: `${name} can't be fused any higher. Mythic is the top of this ladder.` }
  const fee = g.fee * 10
  if (totalSilver(c) < fee) return { char: c, ok: false, message: `${c.name} needs ${g.fee}g for the blacksmith's fee.` }
  let n = c
  const [a, b] = g.items
  n = removeItem(n, a.id, 1); n = removeItem(n, b.id, 1)
  const left = totalSilver(n) - fee
  const made = { ...tieredWeapon(weaponId, g.next), ...(opts.atForge ? { atForge: true } : {}) }
  n = addItem({ ...n, purse: { gold: Math.floor(left / 10), silver: left % 10 } }, made)
  return { char: n, ok: true, item: made, message: `${c.name} pays ${g.fee}g: two ${name}s → ${made.name}. ${FUSE_NOTE}${opts.atForge ? ' Marked “at the forge” until the DM taps Ready.' : ''}` }
}

// ---------- Durability ----------
/** Wear the equipped (outer) armor. At 0 it breaks and is unequipped. */
export function applyWear(c: Character, amount: number): { char: Character; message: string; itemId?: string; prev?: number } {
  const a = equippedArmorItem(c)
  if (!a || !a.tier || amount <= 0) return { char: c, message: '' }
  const prev = durOf(a), now = Math.max(0, prev - amount)
  let n = setDur(c, a.id, now)
  if (now === 0) { n = unequip(n, a.id); return { char: n, itemId: a.id, prev, message: `${a.name} is BROKEN (0/${maxDur(a)}) and falls away — unequipped until a blacksmith repairs it.` } }
  n = recalcArmor(n)
  const dmg = now <= maxDur(a) / 2 && prev > maxDur(a) / 2
  return { char: n, itemId: a.id, prev, message: `${a.name} durability ${prev}→${now}/${maxDur(a)}${dmg ? ' — now Damaged (−1 AC)' : ''}` }
}
/** Undo a wear: restore the previous durability (re-equip if it broke). */
export function undoWear(c: Character, itemId: string, prev: number): Character {
  const it = (c.inventory ?? []).find((x) => x.id === itemId)
  if (!it) return c
  const n = setDur(c, itemId, prev)
  return durOf(it) === 0 && !it.equipped ? equip(n, itemId) : recalcArmor(n)
}
/**
 * Wear a tiered weapon when an attack misses. Hits do not wear weapons (armor is the opposite).
 * `outcome: 'hit'` is a no-op so callers can pass the attack result straight through.
 */
export function applyWeaponWear(c: Character, itemId: string, outcome: 'hit' | 'miss' = 'miss'): { char: Character; message: string; itemId?: string; prev?: number; amount: number } {
  const w = (c.inventory ?? []).find((i) => i.id === itemId && i.kind === 'weapon')
  if (!w || outcome === 'hit' || maxDur(w) <= 0) return { char: c, message: '', amount: 0 }
  const amount = WEAPON_MISS_WEAR
  const prev = durOf(w), now = Math.max(0, prev - amount)
  let n = setDur(c, w.id, now)
  if (now === 0) {
    n = unequip(n, w.id)
    return { char: n, itemId: w.id, prev, amount, message: `${w.name} is BROKEN (0/${maxDur(w)}) — the miss wrecked it. Unequipped until it's repaired.` }
  }
  return { char: n, itemId: w.id, prev, amount, message: `${w.name} durability ${prev}→${now}/${maxDur(w)} (miss)` }
}

/** Blacksmith repair: points (or 'full'), cost per point by tier, Broken costs double. Armor and tiered weapons. */
export function blacksmithRepair(c: Character, itemId: string, points: number | 'full'): { char: Character; ok: boolean; message: string } {
  const it = (c.inventory ?? []).find((x) => x.id === itemId)
  if (!it || (it.kind !== 'armor' && it.kind !== 'weapon') || !it.tier || it.special) return { char: c, ok: false, message: 'Pick a piece of gear with a tier.' }
  const pts = Math.min(missing(it), points === 'full' ? missing(it) : Math.max(0, points))
  if (!pts) return { char: c, ok: false, message: `${it.name} is already at full durability.` }
  const cost = repairCost(it, pts) * 10
  if (totalSilver(c) < cost) return { char: c, ok: false, message: `${c.name} needs ${cost / 10}g to repair ${pts} point${pts > 1 ? 's' : ''}.` }
  const left = totalSilver(c) - cost
  const n = recalcArmor(setDur({ ...c, purse: { gold: Math.floor(left / 10), silver: left % 10 } }, itemId, durOf(it) + pts))
  return { char: n, ok: true, message: `${c.name} pays ${cost / 10}g: ${it.name} repaired ${durOf(it)}→${durOf(it) + pts}/${maxDur(it)}${isBroken(it) ? ' (Broken: double cost)' : ''}.` }
}
