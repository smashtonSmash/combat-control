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
  toHit: number
  damage: string // dice expression e.g. 1d8+3
  damageType: DamageType
}

export interface Abilities { str: number; dex: number; con: number; int: number; wis: number; cha: number }

export interface Purse { gold: number; silver: number }

export type ItemKind = 'armor' | 'weapon' | 'consumable' | 'misc'
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
}

export interface Chest { id: string; name: string; items: Item[]; gold: number; silver: number; pouches?: { id: string; gold: number; silver: number }[]; updated?: number }

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
