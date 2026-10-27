import { DAMAGE_TYPES, DAMAGE_ICONS } from '../types'
import { TIERS, TIER_COLORS, TIER_LABELS, SPECIAL_LABELS, SPECIAL_COLORS } from '../armor'
import { ARMOR_HP, BROKEN_REPAIR_MULT, CONSUMABLES, CRAFT_GOLD, DAMAGED_AT, FIELD_REPAIR_DICE, KIT_DICE, KIT_PRICES, MERGE_FEE_SILVER, REPAIR_COST_PER_POINT, SALVAGE_RICH_ABOVE, UPGRADE_FEES, UPGRADE_MULT, WEAPON_HP, WEAPON_MISS_WEAR, WEAR } from '../catalog'
import { MATERIALS_PER_KIT, MAT_LABELS, MAT_TIERS } from '../salvage'
import { FOUNTAIN_THRESHOLDS } from '../fountain'
import { FAVOR_MIN, FAVOR_MAX, MERCHANTS, REFUSE_FAVOR } from '../favor'
import { MONSTER_PIES } from '../lootTables'
import { INSPIRATION_SLOTS } from '../inspiration'
import { RECAP_LABEL, type RecapEvent } from '../recap'

function money(silver: number) {
  const g = Math.floor(silver / 10), s = silver % 10
  return s ? `${g}g ${s}s` : `${g}g`
}

/** DM quick reference for the homebrew already in the app, plus this batch. Placeholder rules are marked. */
export default function Rules({ recap, onClearRecap }: { recap: RecapEvent[]; onClearRecap: () => void }) {
  return (
    <div className="screen rules">
      <div className="screen-head"><h1>📋 DM reference</h1></div>
      <p className="small muted">What’s in the app today. Lines marked PLACEHOLDER are first-pass numbers Ashton can replace without a rewrite.</p>

      <section className="panel">
        <h3>Damage types</h3>
        <div className="chips-row wrap">{DAMAGE_TYPES.map((t) => <span key={t} className="chip">{DAMAGE_ICONS[t]} {t}</span>)}</div>
        <p className="small">Armor can reduce a type, grant AC against a type, or (Studded) deflect a piercing hit on a d6 roll of 6. Traits on a creature still apply: resistance, vulnerability, immunity.</p>
      </section>

      <section className="panel">
        <h3>Rarity</h3>
        <ul className="rules-list">
          {TIERS.map((t) => <li key={t}><b style={{ color: TIER_COLORS[t] }}>{TIER_LABELS[t]}</b> — id <code>{t}</code>. Repair {REPAIR_COST_PER_POINT[t]}g per missing point. Light / medium / heavy armor HP {ARMOR_HP.light[t]}/{ARMOR_HP.medium[t]}/{ARMOR_HP.heavy[t]}. Weapon HP light/standard/heavy {WEAPON_HP.light[t]}/{WEAPON_HP.standard[t]}/{WEAPON_HP.heavy[t]} (PLACEHOLDER lowball).</li>)}
          <li><b style={{ color: SPECIAL_COLORS.pink }}>{SPECIAL_LABELS.pink}</b> — unique abilities. Not stronger than Mythic, and not an upgrade step.</li>
          <li><b style={{ color: SPECIAL_COLORS.black }}>{SPECIAL_LABELS.black}</b> — a named item with a will. The owner must sync or they cannot use it. Mythic stays the top of the normal ladder.</li>
        </ul>
        <p className="small">Damaged armor and shields (at or below {DAMAGED_AT * 100}% durability) are −1 AC. Half plate at legendary or mythic uses 25% instead. Broken (0) can’t be worn. Broken gold repair costs ×{BROKEN_REPAIR_MULT}. Salvage pays the rich bundle only above {SALVAGE_RICH_ABOVE * 100}%.</p>
      </section>

      <section className="panel">
        <h3>Durability</h3>
        <ul className="rules-list">
          <li>Armor wears when the wearer is <b>hit</b>: {WEAR.hit} (hit), {WEAR.weakType} (a type the armor is weak to), {WEAR.crit} (crit), {WEAR.weakCrit} (weak crit).</li>
          <li>Weapons wear when the attack <b>misses</b> AC: −{WEAPON_MISS_WEAR}. A hit does not wear a weapon.</li>
          <li>Field Repair Kit ({FIELD_REPAIR_DICE} during a short rest) still can’t fix Broken armor. It is armor-only and stays in the potion list.</li>
          <li>A tier kit is crafted from {MATERIALS_PER_KIT} materials of that tier (no gold). Same-tier dice: {TIERS.map((t) => `${TIER_LABELS[t]} ${KIT_DICE[t]}`).join(', ')}. A higher-tier kit on lower-tier gear bumps the die one step (PLACEHOLDER, not +2 flat). Kits cannot repair Broken gear — gold at the blacksmith, or Scroll of Mending Steel. Shop prices: {TIERS.map((t) => `${TIER_LABELS[t]} ${KIT_PRICES[t]}g`).join(', ')}.</li>
          <li>Upgrade is three of the same piece → the next tier. Light fees (gold): {Object.entries(UPGRADE_FEES).map(([t, n]) => `${TIER_LABELS[t as keyof typeof TIER_LABELS]} ${n}g`).join(', ')}. Medium ×{UPGRADE_MULT.medium}, heavy ×{UPGRADE_MULT.heavy}. Weapons use the light baseline (PLACEHOLDER). Mythic does not upgrade further.</li>
          <li>Craft gear from 4 mats of a tier plus gold: {TIERS.map((t) => `${TIER_LABELS[t]} ${CRAFT_GOLD[t]}g`).join(', ')}. Gray is merge-only. Merge three mats into the next tier for {money(MERGE_FEE_SILVER)} (PLACEHOLDER).</li>
        </ul>
      </section>

      <section className="panel">
        <h3>Salvage & materials</h3>
        <ul className="rules-list">
          <li>Materials are generic: {MAT_TIERS.map((t) => MAT_LABELS[t]).join(' → ')}. Legendary gear is orange. Mythic gear is red. Old typed parts still count as the matching generic tier.</li>
          <li>Broken (0): 1 mat of the item’s tier. From 1% through {SALVAGE_RICH_ABOVE * 100}%: 2 mats of that tier. Above that: those 2, plus 2 of the tier below (green’s below is gray).</li>
          <li>Armor, weapons, and shields all salvage this way. Pink and black named gear do not.</li>
        </ul>
      </section>

      <section className="panel">
        <h3>Potions & scrolls</h3>
        <p className="small">The shop catalog is unchanged ({CONSUMABLES.length} entries). Oils coat a weapon until a long rest. Ironhide, Mirror Oil (1 min), and Mending Steel end at End combat. Stoneskin mud only matters on Mythic armor.</p>
      </section>

      <section className="panel">
        <h3>Other systems in this pass</h3>
        <ul className="rules-list">
          <li><b>Accessories.</b> Helmet, gauntlets, and boots are their own slots. A helmet’s AC is flat. It is not worn under armor.</li>
          <li><b>Slots.</b> PLACEHOLDER capacity = Strength score. Armor is 1 slot. Greatsword and greataxe are 2. Identical potions share one slot. Going over is a warning, not a hard block, so taking loot still works.</li>
          <li><b>Merchants.</b> {MERCHANTS.map((m) => `${m.name} (${m.style}, starts at ${m.baseAdjust > 0 ? '+' : ''}${m.baseAdjust}%)`).join('; ')}. Favor runs {FAVOR_MIN} to +{FAVOR_MAX} and starts at 0 in the center. PLACEHOLDER: every 5 favor removes 1% from that markup. At {REFUSE_FAVOR} or lower they refuse to sell. The DM can add a merchant by name and trade.</li>
          <li><b>Loot.</b> On a kill, roll the monster’s tier pie: {TIERS.filter((t) => t !== 'mythic').map((t) => `${TIER_LABELS[t]} ${Math.round(MONSTER_PIES[t].drop * 100)}%`).join('; ')}. Mythic always drops one legendary piece and has a 50% chance of an extra mythic piece. Gear is the weapon they hold or fitting armor (light splits padded / leather / studded). Pink and black are not on the tables. Roll it from the Battle tab with <b>Roll loot</b>. Nothing drops just because HP hits 0.</li>
          <li><b>Inspiration.</b> {INSPIRATION_SLOTS} slots. The DM gives one from Town (or the character sheet). The player view plays a white orb. Spending a pip is the table’s call — the sheet only clears the slot.</li>
          <li><b>Blacksmith.</b> Lives on the Town tab with the shop, for the DM and for players. Repair, upgrade 3→1, craft, merge, and salvage. A 3→1 fuse keeps the lowest current HP of the three pieces. Example merchants can be removed. Players see merchants the DM added. Add, remove, and favor buttons stay with the DM.</li>
          <li><b>Gold.</b> Players can spend. Only the DM uses Add Gold. Loot and a town sale still put coin in the purse.</li>
          <li><b>Level up.</b> A player levels their own character. The DM can level one character or all of them. Hit die: roll here, type a table roll, or take the fixed average (d8 → 5). Then a short checklist for an ASI, a feat, or new spells when that level grants them.</li>
          <li><b>Vault.</b> Town tab. One shared bank in every town, 10 slots to start. +5 slots costs 1g, then 2, 4, 8, 16, and keeps doubling.</li>
          <li><b>Party stash.</b> DM toggle. Shared coins and a shared pack, plus person-to-person coin gifts.</li>
          <li><b>Player names.</b> Sheets show “Character (Player)” when we know who is playing. Signed in, that is the campaign member’s display name. Offline, the DM can type an optional player name. Blank stays blank.</li>
          <li><b>Fountain.</b> Towns only, and only when that town’s flag is on. Secret threshold is a fresh pick from {FOUNTAIN_THRESHOLDS.join(', ')} gold. The prize is <b>PLACEHOLDER (TBD)</b>.</li>
        </ul>
      </section>

      <section className="panel">
        <div className="row between"><h3>Session recap</h3><button className="btn sm" onClick={onClearRecap}>Clear for next session</button></div>
        <p className="small muted">Loot, spending, breaks, salvage, and fountain gifts recorded this session.</p>
        {recap.length === 0 && <div className="empty">Nothing logged yet.</div>}
        <ul className="recap-list">
          {[...recap].reverse().map((e) => (
            <li key={e.id}><small>{RECAP_LABEL[e.kind]}</small> {e.text}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
