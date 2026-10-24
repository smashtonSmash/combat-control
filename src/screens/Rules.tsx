import { DAMAGE_TYPES, DAMAGE_ICONS } from '../types'
import { TIERS, TIER_COLORS, TIER_LABELS, SPECIAL_LABELS, SPECIAL_COLORS } from '../armor'
import { ARMOR_DURABILITY, BROKEN_REPAIR_MULT, CONSUMABLES, DAMAGED_AT, FIELD_REPAIR_DICE, FUSE_FEES, REPAIR_COST_PER_POINT, WEAPON_DURABILITY, WEAPON_MISS_WEAR, WEAR } from '../catalog'
import { MATERIALS, MATERIALS_PER_KIT, SALVAGE_REFUND_SILVER } from '../salvage'
import { FOUNTAIN_THRESHOLDS } from '../fountain'
import { MERCHANTS } from '../favor'
import { LOOT_TABLES } from '../lootTables'
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
          {TIERS.map((t) => <li key={t}><b style={{ color: TIER_COLORS[t] }}>{TIER_LABELS[t]}</b> — id <code>{t}</code>. Armor durability {ARMOR_DURABILITY[t]}, repair {REPAIR_COST_PER_POINT[t]}g per point. Weapon durability {WEAPON_DURABILITY[t]} (PLACEHOLDER, same table).</li>)}
          <li><b style={{ color: SPECIAL_COLORS.pink }}>{SPECIAL_LABELS.pink}</b> — unique abilities. Not stronger than Mythic, and not a fuse step.</li>
          <li><b style={{ color: SPECIAL_COLORS.black }}>{SPECIAL_LABELS.black}</b> — a named item with a will. The owner must sync or they cannot use it. Mythic stays the top of the normal ladder.</li>
        </ul>
        <p className="small">Damaged armor (at or below {DAMAGED_AT * 100}% durability) is −1 AC. Broken (0) can’t be worn. Broken repair costs ×{BROKEN_REPAIR_MULT}.</p>
      </section>

      <section className="panel">
        <h3>Durability</h3>
        <ul className="rules-list">
          <li>Armor wears when the wearer is <b>hit</b>: {WEAR.hit} (hit), {WEAR.weakType} (a type the armor is weak to), {WEAR.crit} (crit), {WEAR.weakCrit} (weak crit).</li>
          <li>Weapons wear when the attack <b>misses</b> AC: −{WEAPON_MISS_WEAR}. A hit does not wear a weapon.</li>
          <li>Field Repair Kit ({FIELD_REPAIR_DICE} during a short rest) still can’t fix Broken armor.</li>
          <li>A matching tier kit, crafted from {MATERIALS_PER_KIT} materials, repairs that armor in the field, including Broken. The blacksmith’s paid repair stays available.</li>
          <li>Fuse fees (armor and weapons, gold): {Object.entries(FUSE_FEES).map(([t, n]) => `${TIER_LABELS[t as keyof typeof TIER_LABELS]} ${n}g`).join(', ')}. Mythic does not fuse further.</li>
        </ul>
      </section>

      <section className="panel">
        <h3>Salvage & parts <small className="muted">PLACEHOLDER recipes</small></h3>
        <ul className="rules-list">
          {MATERIALS.map((m) => <li key={m.key}>{m.note}</li>)}
          <li>Other broken armor salvages into generic scrap of its tier. Refund instead of parts: {TIERS.map((t) => `${TIER_LABELS[t]} ${money(SALVAGE_REFUND_SILVER[t])}`).join(', ')}.</li>
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
          <li><b>Merchants.</b> {MERCHANTS.map((m) => `${m.name} (${m.style}, starts at ${m.baseAdjust > 0 ? '+' : ''}${m.baseAdjust}%)`).join('; ')}. PLACEHOLDER: every 5 favor removes 1% from that markup.</li>
          <li><b>Loot.</b> {LOOT_TABLES.map((t) => `${t.name} gear ${(t.gearChance * 100).toFixed(0)}% / parts ${(t.partChance * 100).toFixed(0)}%`).join('; ')}. A miss on the roll means nothing. Goblins can drop a Common weapon or “Goblin Something”.</li>
          <li><b>Party stash.</b> DM toggle. Shared coins and a shared pack, plus person-to-person coin gifts.</li>
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
