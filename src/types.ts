import type { ArmorFields } from './armor'
export const DAMAGE_TYPES = [
  'bludgeoning', 'piercing', 'slashing',
  'fire', 'cold', 'lightning', 'thunder', 'acid', 'poison',
  'necrotic', 'radiant', 'force', 'psychic',
] as const
export type DamageType = (typeof DAMAGE_TYPES)[number]

export const DAMAGE_ICONS: Record<DamageType, string> = {
  bludgeoning: '🔨', piercing: '🏹', slashing: '🗡️', fire: '🔥', cold: '❄️',
  lightning: '⚡', thunder: '💥', acid: '🧪', poison: '☠️', necrotic: '💀',
  radiant: '✨', force: '🌀', psychic: '🧠',
}

export const TRAIT_EFFECTS = ['resistance', 'vulnerability', 'immunity', 'advantage', 'disadvantage', 'custom'] as const
export type TraitEffect = (typeof TRAIT_EFFECTS)[number]

export interface Trait {
  id: string
  name: string
  damageTypes: DamageType[]
  effect: TraitEffect
  note: string
}

export interface Attack {
  id: string
  name: string
  /** extra damage rider, e.g. Ember Flask +1d4 fire */
  bonus?: { dice: string; type: DamageType }
  toHit: number
  damage: string // dice expression e.g. 1d8+3
  damageType: DamageType
}

export interface Abilities { str: number; dex: number; con: number; int: number; wis: number; cha: number }

export interface Purse { gold: number; silver: number }

export type ItemKind = 'armor' | 'weapon' | 'consumable' | 'scroll' | 'misc'

/**
 * What a scroll does. Extend this union for new scroll kinds, e.g.
 * { kind: 'enhance'; target: 'weapon' | 'armor'; ... } — enhances gear until the next long rest (planned).
 */
export type ScrollData = { kind: 'spell'; spell: import('./spells').CharSpell }
export interface Item {
  id: string
  name: string
  kind: ItemKind
  qty: number
  description: string
  equipped?: boolean
  // armor
  armorId?: string
  tier?: import('./armor').Tier
  // weapon
  damage?: string
  damageType?: DamageType
  // consumable: dice healed on use, e.g. 2d4+2
  heal?: string
  // scroll
  scroll?: ScrollData
  /** homebrew catalog entry (src/catalog.ts) */
  catalogKey?: string
  /** gold value (shop) */
  price?: number
  /** armor durability (current). Missing = full (max comes from the tier, see catalog.ts) */
  dur?: number
  /** blacksmith: fused armor waiting at the forge until the DM taps Ready */
  atForge?: boolean
  /** weapon coatings until the next long rest (oils / Ember Flask) */
  coating?: { type?: DamageType; bonus?: { dice: string; type: DamageType }; source: string }
}

export interface Chest { id: string; name: string; items: Item[]; gold: number; silver: number; pouches?: { id: string; gold: number; silver: number }[]; updated?: number
  /** shown to all players as a full-screen reveal while set (timestamp of the reveal) */
  revealedAt?: number | null
  lastGiven?: { text: string; at: number }
  /** DM toggle: players may take loot themselves from the reveal (default true) */
  allowTake?: boolean
  /** who took which item/pouch id (server-written) */
  takenBy?: Record<string, string> }

export interface Character extends ArmorFields {
  id: string
  name: string
  cls: string
  level: number
  race: string
  abilities: Abilities
  ac: number
  armor: string
  maxHp: number
  initMod: number
  traits: Trait[]
  attacks: Attack[]
  notes: string
  sample?: boolean
  /** true = AC typed by hand, don't auto-calc from armor */
  acManual?: boolean
  /** proficiency override; undefined = auto from level */
  profOverride?: number
  purse?: Purse
  /** current HP (synced with the DM's battle when playing online) */
  currentHp?: number
  inventory?: Item[]
  /** show the Spells section even for non-caster classes */
  spellcasting?: boolean
  spells?: import('./spells').CharSpell[]
  slots?: import('./spells').Slots
  /** slots edited by hand; don't auto-fill from class/level */
  slotsManual?: boolean
  // ---- origins (race / class / background) ----
  origin?: { raceKey?: string; subraceKey?: string; raceBonus?: Partial<Abilities>; classKey?: string; bgKey?: string; bgBonus?: Partial<Abilities> }
  /** scores before race/background bonuses (abilities = base + bonuses) */
  baseAbilities?: Abilities
  background?: string
  features?: import('./origins').Feature[]
  hitDie?: number
  saves?: (keyof Abilities)[]
  skills?: string[]
  proficiencies?: string[]
  speed?: number
  tempHp?: number
  /** data: URL (offline) or 'sb:<storage path>?v=<ts>' (Supabase Storage) */
  portrait?: string
  /** how base scores were generated (roll results, assignment, reroll lock) */
  abilityGen?: import('./components/AbilityGen').GenState
  /** active potion / scroll effects (cleared by long rest or End combat) */
  effects?: ActiveEffect[]
}

export interface ActiveEffect {
  id: string
  key: string // catalog key or effect kind
  name: string
  note: string
  until: 'combat' | 'long'
  kind: 'acBonus' | 'stoneskin' | 'frostbite' | 'mirror' | 'secondWind' | 'mending' | 'whetstone' | 'badge'
  /** mending: original tier to restore */
  restoreTier?: import('./armor').Tier
  amount?: number
}

export type Side = 'party' | 'monster'

export interface Combatant extends ArmorFields {
  id: string
  side: Side
  name: string
  ac: number
  armor: string
  maxHp: number
  hp: number
  initMod: number
  initiative: number | null
  traits: Trait[]
  attacks: Attack[]
  conditions: string[]
  characterId?: string
  sample?: boolean
  shrugUsed?: boolean
  /** temporary effects for this battle (e.g. resistance from a spell) */
  tempTraits?: Trait[]
}

export interface LogEntry {
  id: string
  round: number
  text: string
  kind: 'hit' | 'miss' | 'heal' | 'info' | 'down'
  time: number
}

export interface Encounter {
  combatants: Combatant[]
  round: number
  turnId: string | null
  log: LogEntry[]
}

export const CATEGORIES = ['NPC', 'Location', 'Session', 'Lore', 'Item', 'Faction', 'Other'] as const
export type Category = (typeof CATEGORIES)[number]

export interface WikiPage {
  id: string
  title: string
  category: Category
  body: string
  updated: number
  sample?: boolean
}

export interface DiceRoll {
  id: string
  label: string
  total: number
  detail: string
  time: number
  crit?: 'nat20' | 'nat1'
}

export const CONDITIONS = [
  'Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible',
  'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious', 'Concentrating',
]

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
