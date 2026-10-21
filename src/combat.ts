import type { Combatant, DamageType, Trait } from './types'

export function matchingTraits(target: Combatant, type: DamageType): Trait[] {
  return [...target.traits, ...(target.tempTraits ?? [])].filter((t) => t.damageTypes.includes(type))
}

export interface DamageOutcome {
  final: number
  steps: string[]
}

/** Applies 5e ordering: immunity → resistance (halve, round down) → vulnerability (double). */
export function computeDamage(raw: number, traits: Trait[]): DamageOutcome {
  const steps: string[] = []
  let dmg = Math.max(0, Math.floor(raw))
  const imm = traits.find((t) => t.effect === 'immunity')
  if (imm) {
    steps.push(`Immune (${imm.name}): ${dmg} → 0`)
    return { final: 0, steps }
  }
  const res = traits.find((t) => t.effect === 'resistance')
  if (res) {
    const n = Math.floor(dmg / 2)
    steps.push(`Resistance (${res.name}): ${dmg} → ${n} (halved, rounded down)`)
    dmg = n
  }
  const vul = traits.find((t) => t.effect === 'vulnerability')
  if (vul) {
    steps.push(`Vulnerable (${vul.name}): ${dmg} → ${dmg * 2} (doubled)`)
    dmg *= 2
  }
  return { final: dmg, steps }
}

export const EFFECT_LABEL: Record<string, string> = {
  resistance: 'Resistant', vulnerability: 'Vulnerable', immunity: 'Immune',
  advantage: 'Advantage', disadvantage: 'Disadvantage', custom: 'Reminder',
}

export function traitSentence(target: Combatant, t: Trait, type: DamageType): string {
  switch (t.effect) {
    case 'resistance': return `${target.name} resists ${type} — damage is halved.`
    case 'vulnerability': return `${target.name} is vulnerable to ${type} — damage is doubled!`
    case 'immunity': return `${target.name} is immune to ${type} — no damage.`
    case 'advantage': return `${target.name} has advantage vs ${type}.`
    case 'disadvantage': return `${target.name} has disadvantage vs ${type}.`
    default: return `Special rule vs ${type}.`
  }
}

export const isOut = (c: Combatant) => c.hp <= 0

export function sortedOrder(cs: Combatant[]): Combatant[] {
  return [...cs]
    .filter((c) => c.initiative !== null)
    .sort((a, b) => (b.initiative! - a.initiative!) || (b.initMod - a.initMod) || (a.side === 'party' ? -1 : 1))
}
