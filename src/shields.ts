// Small / medium / heavy shields. No art yet — cards keep the shield KIND_ICON.
// Durability uses the armor HP row for the shield’s category (small = light).
import type { Item, ShieldMode } from './types'
import { uid } from './types'
import { TIER_SHORT, type ArmorCategory, type Tier } from './armor'
import { ARMOR_HP, ARMOR_PRICE_MULTIPLIER, ARMOR_PRICES, DAMAGED_AT } from './catalog'

export interface ShieldDef {
  id: string
  name: string
  /** Small uses the light HP/price row, medium the medium row, heavy the heavy row. */
  category: ArmorCategory
  /** Passive AC while wielded. Each tier is the total, not a stack on the previous tier. */
  ac: Record<Tier, number>
  /** A heavy shield fills the hand. No weapon while it is wielded. */
  occupiesHand: boolean
  /** Heavy bash dice while wielded. Strength is added when the attack is created. */
  bash?: Record<Tier, string>
  /** Full rules text for that tier (not stacked on lower tiers). */
  rules: Record<Tier, string[]>
}

export const SHIELD_CATALOG: ShieldDef[] = [
  {
    id: 'shield-small', name: 'Small Shield', category: 'light', occupiesHand: false,
    ac: { green: 0, blue: 1, purple: 1, legendary: 1, mythic: 2 },
    rules: {
      green: ['Fine beside a one-handed weapon.', 'When you attack, roll 1d4. On a 4, +1 AC against that attack.'],
      blue: ['Fine beside a one-handed weapon.', '+1 AC.'],
      purple: ['Fine beside a one-handed weapon.', '+1 AC.', 'Parry: roll 1d4; on a 4, +1 AC against that attack and it deals no damage if it still hits.'],
      legendary: ['Fine beside a one-handed weapon.', '+1 AC.', 'Parry on a 3–4.', '1/day, reflect a ranged attack back at the attacker.'],
      mythic: ['Fine beside a one-handed weapon.', '+2 AC.', 'Parry on a 2–4.'],
    },
  },
  {
    id: 'shield-medium', name: 'Medium Shield', category: 'medium', occupiesHand: false,
    ac: { green: 2, blue: 2, purple: 2, legendary: 2, mythic: 3 },
    rules: {
      green: ['+2 AC.'],
      blue: ['+2 AC.', '1/short rest: impose disadvantage on one attack against you.'],
      purple: ['+2 AC.', 'Reaction: +2 AC to an ally within 5 ft against one attack.'],
      legendary: ['+2 AC.', 'That ally reaction also halves the damage if the attack hits.'],
      mythic: ['+3 AC.', 'The ally reaction can be used once a round.'],
    },
  },
  {
    id: 'shield-heavy', name: 'Heavy Shield', category: 'heavy', occupiesHand: true,
    ac: { green: 2, blue: 2, purple: 3, legendary: 3, mythic: 3 },
    bash: { green: '1d4', blue: '1d4', purple: '1d6', legendary: '1d6', mythic: '1d8' },
    rules: {
      green: [
        'Occupies a hand — no weapon while wielded.',
        '+2 AC. Bash 1d4 bludgeoning.',
        'On your back: −5 ft speed.',
        'Planted: half cover for you and one ally until someone picks it up.',
        'Switch mode: an object interaction out of combat, an action in combat.',
      ],
      blue: [
        'Occupies a hand — no weapon while wielded.',
        '+2 AC. Bash 1d4 + Strength.',
        'On your back: disadvantage on Stealth.',
        'Planted: half cover, and 1/short rest block one ranged shot through the wall.',
      ],
      purple: [
        'Occupies a hand — no weapon while wielded.',
        '+3 AC. Bash 1d6 + Strength and shove the target 5 ft.',
        'On your back: choose −5 ft speed or Stealth disadvantage when you sling it.',
        'Planted: half cover, and 1/fight allies behind it ignore the first forced movement through that space.',
      ],
      legendary: [
        'Occupies a hand — no weapon while wielded.',
        '+3 AC. Bash 1d6 + Strength. 1/day the bash is a critical if it hits.',
        'No penalty on your back.',
        'Planted: 1/short rest three-quarters cover until the start of your next turn, then half cover if you leave it planted.',
      ],
      mythic: [
        'Occupies a hand — no weapon while wielded.',
        '+3 AC. Bash 1d8 + Strength, and the bash can replace an attack.',
        'No penalty on your back. Back ↔ wield is a free object interaction.',
        'Plant as a bonus action.',
        '1/long rest the planted wall also grants +1 AC to you and the ally while it stands.',
      ],
    },
  },
]

export const shieldById = (id?: string | null) => SHIELD_CATALOG.find((s) => s.id === id)

export function shieldMaxHp(shieldId: string | undefined, tier: Tier): number {
  const cat = shieldById(shieldId)?.category ?? 'light'
  return ARMOR_HP[cat][tier]
}

/** PLACEHOLDER: shields sell on the armor price ladder for their category (medium ×2, heavy ×5). */
export function shieldPrice(shieldId: string | undefined, tier: Tier): number {
  const cat = shieldById(shieldId)?.category ?? 'light'
  return Math.round(ARMOR_PRICES[tier] * ARMOR_PRICE_MULTIPLIER[cat])
}

export function shieldRules(def: ShieldDef, tier: Tier): string[] {
  return [`+${def.ac[tier]} AC while wielded`, ...def.rules[tier]]
}

export function shieldItem(id: string, tier: Tier): Item {
  const s = shieldById(id) ?? SHIELD_CATALOG[0]
  return {
    id: uid(),
    name: `${TIER_SHORT[tier]} ${s.name}`,
    kind: 'shield',
    qty: 1,
    shieldId: s.id,
    tier,
    shieldMode: 'wielded',
    price: shieldPrice(s.id, tier),
    ...(s.bash ? { damage: s.bash[tier], damageType: 'bludgeoning' as const } : {}),
    description: `${s.category} shield · ${s.occupiesHand ? 'fills a hand while wielded' : 'can sit beside a one-handed weapon'}. ${shieldRules(s, tier).join(' ')}`,
  }
}

/** AC from a shield that is equipped and wielded. On back / planted grants no passive AC. Damaged is −1. */
export function shieldAcBonus(c: { inventory?: Item[] }): number {
  const s = (c.inventory ?? []).find((i) => i.kind === 'shield' && i.equipped && i.tier && i.shieldId)
  if (!s?.tier) return 0
  const def = shieldById(s.shieldId)
  if (!def) return 0
  const mode: ShieldMode = s.shieldMode ?? 'wielded'
  if (def.occupiesHand && mode !== 'wielded') return 0
  if (!def.occupiesHand && mode === 'planted') return 0
  const max = shieldMaxHp(s.shieldId, s.tier)
  const dur = Math.max(0, Math.min(max, s.dur ?? max))
  const damaged = dur > 0 && dur <= max * DAMAGED_AT
  return def.ac[s.tier] - (damaged ? 1 : 0)
}
