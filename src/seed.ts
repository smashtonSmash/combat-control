import type { Character, Combatant, Encounter, WikiPage } from './types'
import { uid } from './types'
import { profFromLevel } from './armor'

export const sampleCharacters = (): Character[] => [
  {
    id: 'sample-thorin', sample: true, name: 'Thorin', cls: 'Fighter', level: 3, race: 'Mountain Dwarf',
    abilities: { str: 16, dex: 12, con: 16, int: 10, wis: 12, cha: 8 },
    ac: 12, armor: 'Purple Padded Armor', purse: { gold: 12, silver: 7 }, maxHp: 31, initMod: 1,
    armorId: 'padded', armorTier: 'purple', tierV: 2,
    traits: [
      { id: uid(), name: 'Dwarven Resilience', damageTypes: ['poison'], effect: 'resistance',
        note: 'Resistance to poison damage; advantage on saves vs poison.' },
    ],
    attacks: [
      { id: uid(), name: 'Warhammer', toHit: 5, damage: '1d8+3', damageType: 'bludgeoning' },
      { id: uid(), name: 'Handaxe (thrown)', toHit: 5, damage: '1d6+3', damageType: 'slashing' },
    ],
    notes: 'SAMPLE character — delete any time from the banner or the Characters tab.\nSecond Wind: 1d10+3 heal, once per short rest.',
  },
  ...extraSamples(),
  {
    id: 'sample-lyra', sample: true, name: 'Lyra', cls: 'Wizard', level: 3, race: 'High Elf',
    abilities: { str: 8, dex: 14, con: 13, int: 17, wis: 12, cha: 10 },
    ac: 12, armor: 'No armor (Mage Armor = 15)', maxHp: 17, initMod: 2,
    traits: [
      { id: uid(), name: 'Ring of Warmth', damageTypes: ['cold'], effect: 'resistance', note: 'Homebrew ring: resistance to cold damage.' },
    ],
    attacks: [
      { id: uid(), name: 'Fire Bolt', toHit: 5, damage: '1d10', damageType: 'fire' },
      { id: uid(), name: 'Dagger', toHit: 4, damage: '1d4+2', damageType: 'piercing' },
    ],
    notes: 'SAMPLE character.\nSpell slots: 4 × 1st, 2 × 2nd.',
  },
]

export const extraSamples = (): Character[] => [
  {
    id: 'sample-kael', sample: true, name: 'Kael', cls: 'Ranger', level: 5, race: 'Half-Elf',
    abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 14, cha: 10 },
    ac: 14, armor: 'Legendary Studded Leather Armor', armorId: 'studded', armorTier: 'legendary', tierV: 2, maxHp: 44, initMod: 3,
    purse: { gold: 40, silver: 15 }, traits: [],
    attacks: [{ id: uid(), name: 'Longbow', toHit: 7, damage: '1d8+3', damageType: 'piercing' }],
    notes: 'SAMPLE character in Legendary Studded Leather.',
  },
  {
    id: 'sample-vex', sample: true, name: 'Vex', cls: 'Rogue', level: 3, race: 'Tiefling',
    abilities: { str: 8, dex: 16, con: 12, int: 12, wis: 10, cha: 14 },
    ac: 14, armor: 'Purple Studded Leather Armor', armorId: 'studded', armorTier: 'purple', maxHp: 21, initMod: 3,
    purse: { gold: 3, silver: 22 }, traits: [],
    attacks: [{ id: uid(), name: 'Rapier', toHit: 5, damage: '1d8+3', damageType: 'piercing' }],
    notes: 'SAMPLE character in Purple Studded Leather (d6 deflect).',
  },
]

export const charProf = (c: Character) => c.profOverride ?? profFromLevel(c.level)

export function characterToCombatant(c: Character): Combatant {
  return {
    id: uid(), side: 'party', name: c.name, ac: c.ac, armor: c.armor, maxHp: c.maxHp, hp: Math.min(c.currentHp ?? c.maxHp, c.maxHp),
    initMod: c.initMod, initiative: null, traits: c.traits, attacks: c.attacks, conditions: [],
    characterId: c.id, sample: c.sample,
    armorId: c.armorId, armorTier: c.armorTier, underId: c.underId, underTier: c.underTier, prof: charProf(c), tierV: 2,
  }
}

const goblin = (n: number): Combatant => ({
  id: uid(), side: 'monster', sample: true, name: `Goblin ${n}`, ac: 15, armor: 'Leather Armor, Shield',
  maxHp: 7, hp: 7, initMod: 2, initiative: null, conditions: [],
  traits: [{ id: uid(), name: 'Nimble Escape', damageTypes: [], effect: 'custom', note: 'Can Disengage or Hide as a bonus action.' }],
  attacks: [
    { id: uid(), name: 'Scimitar', toHit: 4, damage: '1d6+2', damageType: 'slashing' },
    { id: uid(), name: 'Shortbow', toHit: 4, damage: '1d6+2', damageType: 'piercing' },
  ],
})

export const sampleEncounter = (): Encounter => ({
  combatants: [
    ...sampleCharacters().map(characterToCombatant),
    goblin(1), goblin(2),
    {
      id: uid(), side: 'monster', sample: true, name: 'Skeleton', ac: 13, armor: 'Armor scraps',
      maxHp: 13, hp: 13, initMod: 2, initiative: null, conditions: [],
      traits: [
        { id: uid(), name: 'Brittle Bones', damageTypes: ['bludgeoning'], effect: 'vulnerability', note: 'Damage vulnerabilities: bludgeoning' },
        { id: uid(), name: 'Undead Nature', damageTypes: ['poison'], effect: 'immunity', note: 'Damage immunities: poison' },
      ],
      attacks: [{ id: uid(), name: 'Shortsword', toHit: 4, damage: '1d6+2', damageType: 'piercing' }],
    },
  ],
  round: 1, turnId: null, log: [],
})

export const samplePages = (): WikiPage[] => [
  { id: uid(), sample: true, title: 'Sample: Mayor Grelda', category: 'NPC', updated: Date.now(),
    body: '# Mayor Grelda\nStout halfling mayor of [[Sample: Thornvale]].\n\n- **Wants:** the goblin raids to stop\n- **Secret:** owes money to the *Black Lantern* guild\n\nOffered 50 gp for clearing the cave.' },
  { id: uid(), sample: true, title: 'Sample: Thornvale', category: 'Location', updated: Date.now() - 1000,
    body: '# Thornvale\nA sleepy farming village on the edge of the Mirewood.\n\n## Places\n- The Crooked Kettle (tavern)\n- Old mill — goblin tracks nearby' },
  { id: uid(), sample: true, title: 'Sample: Session 1 recap', category: 'Session', updated: Date.now() - 2000,
    body: '# Session 1\nThe party met **Mayor Grelda** and tracked goblins to the cave.\n\n- Thorin smashed a skeleton (vulnerable to bludgeoning!)\n- Next time: the cave entrance' },
]
