/** Mechanical facts for options outside the SRD 5.1 bundle.
 * Short original summaries of published bonuses and traits — not book text. */

export interface TraitBlurb { name: string; desc: string }
export interface SubraceBlurb { key: string; name: string; bonuses: Record<string, number>; traits: TraitBlurb[] }
export interface RaceBlurb {
  key: string
  name: string
  speed?: number
  bonuses?: Record<string, number>
  bonusChoice?: { choose: number; amount: number }
  traits: TraitBlurb[]
  subraces?: SubraceBlurb[]
}
export interface ClassBlurb {
  key: string
  name: string
  hitDie: number
  saves: string[]
  proficiencies: string[]
  skillChoice: { choose: number; from: string[] }
  features: TraitBlurb[]
  spellcasting?: string
}
export interface BgBlurb { key: string; name: string; skills: string[]; feature: TraitBlurb }

const t = (name: string, desc: string): TraitBlurb => ({ name, desc })

export const EXPANDED_RACES: RaceBlurb[] = [
  { key: 'aarakocra', name: 'Aarakocra', speed: 25, bonuses: { dex: 2, wis: 1 }, traits: [
    t('Flight', 'You have a flying speed of 50 feet while you are not wearing medium or heavy armor.'),
    t('Talons', 'Your unarmed strikes deal 1d4 slashing damage.'),
  ] },
  { key: 'aasimar', name: 'Aasimar', speed: 30, bonuses: { cha: 2 }, traits: [
    t('Darkvision', 'You can see in dim light within 60 feet as if it were bright, and in darkness as if it were dim.'),
    t('Celestial Resistance', 'You have resistance to necrotic damage and radiant damage.'),
    t('Healing Hands', 'Once per long rest, touch a creature to restore hit points equal to your level.'),
    t('Light Bearer', 'You know the light cantrip.'),
  ], subraces: [
    { key: 'protector', name: 'Protector Aasimar', bonuses: { wis: 1 }, traits: [t('Radiant Soul', 'Once per long rest, bonus action: for 1 minute you sprout wings (fly 30) and add level radiant damage to one attack or spell each turn.')] },
    { key: 'scourge', name: 'Scourge Aasimar', bonuses: { con: 1 }, traits: [t('Radiant Consumption', 'Once per long rest, bonus action: for 1 minute you and creatures within 10 feet take radiant damage at the end of your turns, and one hit each turn deals extra radiant damage.')] },
    { key: 'fallen', name: 'Fallen Aasimar', bonuses: { str: 1 }, traits: [t('Necrotic Shroud', 'Once per long rest, bonus action: creatures within 10 feet that can see you make a Charisma save or are frightened until the end of your next turn. One hit each turn for 1 minute deals extra necrotic damage.')] },
  ] },
  { key: 'bugbear', name: 'Bugbear', speed: 30, bonuses: { str: 2, dex: 1 }, traits: [
    t('Long-Limbed', 'On your turn, your melee reach is 5 feet longer.'),
    t('Powerful Build', 'You count as one size larger for how much you can carry, push, drag, or lift.'),
    t('Surprise Attack', 'If you hit a creature that has not acted yet in the first round, it takes an extra 2d6 damage. Once per combat.'),
    t('Sneaky', 'You have proficiency in the Stealth skill.'),
  ] },
  { key: 'centaur', name: 'Centaur', speed: 40, bonuses: { str: 2, wis: 1 }, traits: [
    t('Charge', 'If you move 30 feet straight toward a target and hit it with a melee attack, you can bonus-action a hoof attack.'),
    t('Hooves', 'Your hooves are a natural weapon: 1d4 + Strength bludgeoning.'),
    t('Equine Build', 'Climbing costs extra movement. You count as one size larger for carrying.'),
    t('Survivor', 'Once per short rest, when you start your turn below half your hit points and above 0, you can spend a hit die to heal.'),
  ] },
  { key: 'changeling', name: 'Changeling', speed: 30, bonuses: { cha: 2 }, bonusChoice: { choose: 1, amount: 1 }, traits: [
    t('Shapechanger', 'As an action, you change your appearance and voice. You stay the same size.'),
    t('Changeling Instincts', 'You have proficiency in two of Deception, Insight, Intimidation, and Persuasion.'),
  ] },
  { key: 'firbolg', name: 'Firbolg', speed: 30, bonuses: { wis: 2, str: 1 }, traits: [
    t('Firbolg Magic', 'You can cast detect magic and disguise self once each per short rest. Wisdom is your spellcasting ability.'),
    t('Hidden Step', 'Once per short rest, bonus action: you turn invisible until the start of your next turn or until you attack or cast a spell.'),
    t('Powerful Build', 'You count as one size larger for how much you can carry, push, drag, or lift.'),
    t('Speech of Beast and Leaf', 'You can make yourself understood, in a limited way, by beasts and plants.'),
  ] },
  { key: 'genasi', name: 'Genasi', speed: 30, bonuses: { con: 2 }, traits: [
    t('Genasi', 'You carry the mark of an elemental plane. Your subrace says which one.'),
  ], subraces: [
    { key: 'air', name: 'Air Genasi', bonuses: { dex: 1 }, traits: [t('Mingle with the Wind', 'You can hold your breath forever. Once per long rest you can cast levitate without a slot.')] },
    { key: 'earth', name: 'Earth Genasi', bonuses: { str: 1 }, traits: [t('Merge with Stone', 'You can move across difficult earth or stone without extra cost. Once per long rest you can cast pass without trace without a slot.')] },
    { key: 'fire', name: 'Fire Genasi', bonuses: { int: 1 }, traits: [t('Reach to the Blaze', 'Darkvision 60 feet and fire resistance. You know produce flame.')] },
    { key: 'water', name: 'Water Genasi', bonuses: { wis: 1 }, traits: [t('Call to the Wave', 'Swim speed 30, acid resistance, and you know shape water. Once per long rest you can cast create or destroy water without a slot.')] },
  ] },
  { key: 'gith', name: 'Gith', speed: 30, traits: [
    t('Gith', 'Choose githyanki or githzerai. Their training is not the same.'),
  ], subraces: [
    { key: 'githyanki', name: 'Githyanki', bonuses: { str: 2, int: 1 }, traits: [
      t('Decadent Mastery', 'You have proficiency in one skill or tool of your choice.'),
      t('Martial Prodigy', 'You have proficiency with light and medium armor and with shortswords, longswords, and greatswords.'),
      t('Githyanki Psionics', 'You know mage hand. At 3rd level you can cast jump once per long rest, and at 5th misty step once per long rest. Intelligence is your spellcasting ability.'),
    ] },
    { key: 'githzerai', name: 'Githzerai', bonuses: { wis: 2, int: 1 }, traits: [
      t('Mental Discipline', 'You have advantage on saves against the charmed and frightened conditions.'),
      t('Githzerai Psionics', 'You know mage hand. At 3rd level you can cast shield once per long rest, and at 5th detect thoughts once per long rest. Wisdom is your spellcasting ability.'),
    ] },
  ] },
  { key: 'goblin', name: 'Goblin', speed: 30, bonuses: { dex: 2, con: 1 }, traits: [
    t('Fury of the Small', 'Once per short rest, when you damage a larger creature, you can add your level to the damage.'),
    t('Nimble Escape', 'You can take the Disengage or Hide action as a bonus action.'),
  ] },
  { key: 'goliath', name: 'Goliath', speed: 30, bonuses: { str: 2, con: 1 }, traits: [
    t("Stone's Endurance", 'Once per short rest, when you take damage, you can use a reaction to roll 1d12 + your Constitution modifier and reduce the damage by that amount.'),
    t('Powerful Build', 'You count as one size larger for how much you can carry, push, drag, or lift.'),
    t('Mountain Born', 'You are naturally adapted to high altitude and cold climates.'),
  ] },
  { key: 'hobgoblin', name: 'Hobgoblin', speed: 30, bonuses: { con: 2, int: 1 }, traits: [
    t('Martial Training', 'You have proficiency with two martial weapons and with light armor.'),
    t('Saving Face', 'Once per short rest, when you miss an attack or fail a check or save, you can add a bonus equal to the number of allies you can see (maximum +5).'),
  ] },
  { key: 'kenku', name: 'Kenku', speed: 30, bonuses: { dex: 2, wis: 1 }, traits: [
    t('Expert Forgery', 'You can copy writing or craft a replica of an object you have seen, and you have advantage on checks to pass it off.'),
    t('Kenku Training', 'You have proficiency in two of Acrobatics, Deception, Stealth, and Sleight of Hand.'),
    t('Mimicry', 'You can mimic sounds you have heard. A listener can tell it is a mimic with a successful Insight check against your Deception.'),
  ] },
  { key: 'kobold', name: 'Kobold', speed: 30, bonuses: { dex: 2 }, traits: [
    t('Grovel, Cower, and Beg', 'Once per short rest, as an action, each ally who can see you within 10 feet can gain advantage on attack rolls against enemies within 10 feet of you until the end of your next turn.'),
    t('Pack Tactics', 'You have advantage on an attack roll against a creature if at least one ally is within 5 feet of it and not incapacitated.'),
    t('Sunlight Sensitivity', 'You have disadvantage on attack rolls and on sight-based Wisdom (Perception) checks while you or your target is in direct sunlight.'),
  ] },
  { key: 'lizardfolk', name: 'Lizardfolk', speed: 30, bonuses: { con: 2, wis: 1 }, traits: [
    t('Bite', 'Your fanged maw is a natural weapon: 1d6 + Strength piercing.'),
    t('Cunning Artisan', 'You can harvest a creature and craft a simple shield, club, javelin, or similar gear during a short rest.'),
    t('Hold Breath', 'You can hold your breath for up to 15 minutes.'),
    t("Hunter's Lore", 'You have proficiency in two of Animal Handling, Nature, Perception, Stealth, and Survival.'),
    t('Natural Armor', 'When you are not wearing armor, your AC is 13 + your Dexterity modifier. You can use a shield and still gain this benefit.'),
    t('Hungry Jaws', 'Once per short rest, as a bonus action you can bite. On a hit, you gain temporary hit points equal to your Constitution modifier (minimum 1).'),
    t('Swim', 'You have a swimming speed of 30 feet.'),
  ] },
  { key: 'minotaur', name: 'Minotaur', speed: 30, bonuses: { str: 2, con: 1 }, traits: [
    t('Horns', 'Your horns are a natural weapon: 1d6 + Strength piercing.'),
    t('Goring Rush', 'When you take the Dash action and move at least 20 feet, you can make a horn attack as a bonus action.'),
    t('Hammering Horns', 'When you hit with a melee attack, you can use a bonus action to shove the target with your horns.'),
    t('Labyrinthine Recall', 'You always know which way is north, and you remember any path you have traveled.'),
  ] },
  { key: 'orc', name: 'Orc', speed: 30, bonuses: { str: 2, con: 1 }, traits: [
    t('Aggressive', 'As a bonus action, you can move up to your speed toward a hostile creature you can see.'),
    t('Menacing', 'You have proficiency in the Intimidation skill.'),
    t('Powerful Build', 'You count as one size larger for how much you can carry, push, drag, or lift.'),
  ] },
  { key: 'satyr', name: 'Satyr', speed: 35, bonuses: { cha: 2, dex: 1 }, traits: [
    t('Magic Resistance', 'You have advantage on saving throws against spells.'),
    t('Mirthful Leaps', 'Your long jump is a number of feet equal to 3 + your Strength modifier when you have a running start, and you add 1d8 feet.'),
    t('Reveler', 'You have proficiency in Performance and Persuasion, and with one musical instrument.'),
  ] },
  { key: 'shifter', name: 'Shifter', speed: 30, traits: [
    t('Shifting', 'As a bonus action, once per short rest, you take on a bestial aspect for 1 minute. You gain temporary hit points equal to your level + your Constitution modifier. The subrace adds more.'),
  ], subraces: [
    { key: 'beasthide', name: 'Beasthide Shifter', bonuses: { con: 2, str: 1 }, traits: [t('Beasthide', 'While shifted you gain +1 AC and extra temporary hit points equal to your level.')] },
    { key: 'longtooth', name: 'Longtooth Shifter', bonuses: { str: 2, dex: 1 }, traits: [t('Longtooth', 'While shifted you can use a bonus action to bite (1d6 + Strength piercing).')] },
    { key: 'swiftstride', name: 'Swiftstride Shifter', bonuses: { dex: 2, cha: 1 }, traits: [t('Swiftstride', 'While shifted your speed increases by 5 feet, and you can use a reaction to move 10 feet when an enemy ends its turn next to you.')] },
    { key: 'wildhunt', name: 'Wildhunt Shifter', bonuses: { wis: 2, dex: 1 }, traits: [t('Wildhunt', 'While shifted you have advantage on Wisdom checks, and no creature within 30 feet can make an attack roll against you with advantage.')] },
  ] },
  { key: 'tabaxi', name: 'Tabaxi', speed: 30, bonuses: { dex: 2, cha: 1 }, traits: [
    t("Cat's Talent", 'You have proficiency in Perception and Stealth.'),
    t('Feline Agility', 'When you move on your turn, you can double your speed until the end of the turn. You cannot do it again until you move 0 feet on one of your turns.'),
    t("Cat's Claws", 'You have a climbing speed of 20 feet. Your claws deal 1d4 + Strength slashing.'),
  ] },
  { key: 'tortle', name: 'Tortle', speed: 30, bonuses: { str: 2, wis: 1 }, traits: [
    t('Claws', 'Your claws deal 1d4 + Strength slashing.'),
    t('Hold Breath', 'You can hold your breath for up to 1 hour.'),
    t('Natural Armor', 'Your shell gives you a base AC of 17. You gain no benefit from Dexterity and cannot wear armor, but you can use a shield.'),
    t('Shell Defense', 'As an action you withdraw into your shell: AC +4, advantage on Strength and Constitution saves, disadvantage on Dexterity saves, speed 0, and you cannot take reactions until you emerge.'),
    t('Survival Instinct', 'You have proficiency in one of Animal Handling, Medicine, Nature, Perception, Stealth, or Survival.'),
  ] },
  { key: 'triton', name: 'Triton', speed: 30, bonuses: { str: 1, con: 1, cha: 1 }, traits: [
    t('Amphibious', 'You can breathe air and water.'),
    t('Control Air and Water', 'You can cast fog cloud once per long rest. At 3rd level you can also cast gust of wind, and at 5th wall of water, each once per long rest. Charisma is your spellcasting ability.'),
    t('Emissary of the Sea', 'You can communicate simple ideas with beasts that have a swimming speed.'),
    t('Guardians of the Depths', 'You have resistance to cold damage and ignore the drawbacks of deep water.'),
    t('Swim', 'You have a swimming speed of 30 feet.'),
  ] },
  { key: 'warforged', name: 'Warforged', speed: 30, bonuses: { con: 2 }, bonusChoice: { choose: 1, amount: 1 }, traits: [
    t('Constructed Resilience', 'You have advantage on saves against poison, resistance to poison damage, immunity to disease, and you do not need to eat, drink, or breathe.'),
    t("Sentry's Rest", 'You rest 6 hours fully aware, instead of sleeping.'),
    t('Integrated Protection', 'You gain +1 AC. Armor you wear is integrated and takes an hour to don or doff.'),
    t('Specialized Design', 'You have proficiency in one skill and one tool of your choice.'),
  ] },
  { key: 'yuan-ti', name: 'Yuan-ti', speed: 30, bonuses: { cha: 2, int: 1 }, traits: [
    t('Darkvision', 'You can see in dim light within 60 feet as if it were bright, and in darkness as if it were dim.'),
    t('Innate Spellcasting', 'You know the poison spray cantrip. You can cast animal friendship (snakes only) at will, and suggestion once per long rest. Charisma is your spellcasting ability.'),
    t('Magic Resistance', 'You have advantage on saving throws against spells.'),
    t('Poison Immunity', 'You are immune to poison damage and the poisoned condition.'),
  ] },
]

export const EXPANDED_CLASSES: ClassBlurb[] = [
  {
    key: 'artificer',
    name: 'Artificer',
    hitDie: 8,
    saves: ['con', 'int'],
    proficiencies: ['Light armor', 'Medium armor', 'Shields', 'Simple weapons', "Thieves' tools", "Tinker's tools"],
    skillChoice: { choose: 2, from: ['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Sleight of Hand'] },
    spellcasting: 'Intelligence',
    features: [
      t('Magical Tinkering', 'You touch a tiny nonmagical object and give it one small effect: light, a continuous sound, a static odor, or a tiny sketch. You can keep a few of these going at once.'),
      t('Spellcasting', 'You cast artificer spells using Intelligence. You prepare a list after each long rest. You need thieves’ tools or some other artisan’s tools in hand as a focus. At 1st level you already have spell slots.'),
    ],
  },
]

export const EXPANDED_BACKGROUNDS: BgBlurb[] = [
  { key: 'charlatan', name: 'Charlatan', skills: ['Deception', 'Sleight of Hand'], feature: t('False Identity', 'You have a second identity, complete with papers, and given time you can forge a document.') },
  { key: 'criminal', name: 'Criminal', skills: ['Deception', 'Stealth'], feature: t('Criminal Contact', 'You have a reliable contact who can pass a message through the underworld.') },
  { key: 'entertainer', name: 'Entertainer', skills: ['Acrobatics', 'Performance'], feature: t('By Popular Demand', 'You can find a venue to perform. A pleased room usually feeds and lodges you for the night.') },
  { key: 'folk-hero', name: 'Folk Hero', skills: ['Animal Handling', 'Survival'], feature: t('Rustic Hospitality', 'Common folk will shelter you from the law or a hunter when they can, though they will not fight your battles.') },
  { key: 'guild-artisan', name: 'Guild Artisan', skills: ['Insight', 'Persuasion'], feature: t('Guild Membership', 'Your guild lodges you in guildhalls and will back you in a dispute, so long as you pay your dues.') },
  { key: 'hermit', name: 'Hermit', skills: ['Medicine', 'Religion'], feature: t('Discovery', 'You uncovered one important secret in seclusion. Decide it with the DM.') },
  { key: 'noble', name: 'Noble', skills: ['History', 'Persuasion'], feature: t('Position of Privilege', 'People assume you belong among the powerful, and common folk try to make room for you.') },
  { key: 'outlander', name: 'Outlander', skills: ['Athletics', 'Survival'], feature: t('Wanderer', 'You remember the lay of the land, and you can find food and water for yourself and five others in the wild.') },
  { key: 'sage', name: 'Sage', skills: ['Arcana', 'History'], feature: t('Researcher', 'When you do not know a fact, you usually know where it is written down.') },
  { key: 'sailor', name: 'Sailor', skills: ['Athletics', 'Perception'], feature: t("Ship's Passage", 'You can get free passage, for yourself and companions, on a ship you have sailed with.') },
  { key: 'soldier', name: 'Soldier', skills: ['Athletics', 'Intimidation'], feature: t('Military Rank', 'Soldiers loyal to your old army recognize your rank. You can request simple gear from a friendly force.') },
  { key: 'urchin', name: 'Urchin', skills: ['Sleight of Hand', 'Stealth'], feature: t('City Secrets', 'You move through a city’s alleys at a normal pace and you know its street pattern.') },
  { key: 'far-traveler', name: 'Far Traveler', skills: ['Insight', 'Perception'], feature: t('All Eyes on You', 'Your foreign manner draws notice. You can use that attention to find a rumor, a patron, or an audience.') },
  { key: 'haunted-one', name: 'Haunted One', skills: ['Investigation', 'Survival'], feature: t('Heart of Darkness', 'People who meet your eyes sense you have seen something awful. They may help you, or they may fear you.') },
  { key: 'city-watch', name: 'City Watch', skills: ['Athletics', 'Insight'], feature: t("Watcher's Eye", 'You can get the local watch to share what they know, and they treat you as one of their own if you keep the peace.') },
  { key: 'clan-crafter', name: 'Clan Crafter', skills: ['History', 'Insight'], feature: t('Respect of the Stout Folk', 'Dwarves, and merchants who trade with them, treat you as a known crafter and may offer a bench and a bed.') },
]
