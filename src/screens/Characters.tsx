import { useState } from 'react'
import type { Abilities, Character } from '../types'
import { DAMAGE_ICONS, uid } from '../types'
import { abilityMod, fmtMod } from '../dice'
import { EFFECT_LABEL } from '../combat'
import { NumField, Sheet, Stepper, TextField } from '../components/Sheet'
import { AttackEditor, TraitEditor } from '../components/Editors'
import type { Tier } from '../armor'
import { ARMOR_CATALOG, TIERS, TIER_COLORS, TIER_LABELS, TIER_SHORT, armorAc, armorById, armorLabel, canBeUnderLayer, combinedArmor, profFromLevel } from '../armor'
import { charProf } from '../seed'

const blank = (): Character => ({
  id: uid(), name: '', cls: '', level: 1, race: '',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  ac: 10, armor: '', maxHp: 10, initMod: 0, traits: [], attacks: [], notes: '',
})

export default function Characters({ characters, onSave, onDelete }: {
  characters: Character[]; onSave: (c: Character) => void; onDelete: (id: string) => void
}) {
  const [edit, setEdit] = useState<Character | null>(null)
  return (
    <div className="screen">
      <div className="screen-head">
        <h1>Characters</h1>
        <button className="btn primary" onClick={() => setEdit(blank())}>＋ New</button>
      </div>
      {characters.length === 0 && <div className="empty">No characters yet. Tap <b>＋ New</b> to make your first sheet.</div>}
      <div className="char-list">
        {characters.map((c) => (
          <button key={c.id} className="char-card" onClick={() => setEdit(structuredClone(c))}>
            {c.sample && <div className="sample-tag">SAMPLE</div>}
            <div className="ac-shield lg" style={c.armorTier ? { filter: `drop-shadow(0 0 6px ${TIER_COLORS[c.armorTier]})` } : undefined}><small>AC</small><b>{c.ac}</b></div>
            <div className="char-main">
              <b className="char-name">{c.name || 'Unnamed'}</b>
              <div className="muted small">{[c.race, c.cls, c.level && `Lv ${c.level}`].filter(Boolean).join(' · ')}</div>
              {c.armorTier && <TierBadge tier={c.armorTier} />}
              <div className="small">🛡 {c.armor || '—'} · ❤️ {c.currentHp ?? c.maxHp}/{c.maxHp} · ⚡ Init {fmtMod(c.initMod)}</div>
              {c.traits.length > 0 && (
                <div className="badges">
                  {c.traits.map((t) => <span key={t.id} className={'badge trait effect-' + t.effect}>✦ {t.name || EFFECT_LABEL[t.effect]} {t.damageTypes.map((d) => DAMAGE_ICONS[d]).join('')}</span>)}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
      {edit && (
        <CharacterSheet c={edit} isNew={!characters.some((x) => x.id === edit.id)} onClose={() => setEdit(null)}
          onSave={(c) => { onSave(c); setEdit(null) }}
          onDelete={() => { if (confirm(`Delete ${edit.name || 'this character'}?`)) { onDelete(edit.id); setEdit(null) } }} />
      )}
    </div>
  )
}

const ABILS: (keyof Abilities)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

function CharacterSheet({ c, isNew, onClose, onSave, onDelete }: {
  c: Character; isNew: boolean; onClose: () => void; onSave: (c: Character) => void; onDelete: () => void
}) {
  const [d, setD] = useState(c)
  const recalc = (n: Character): Character => {
    const ac = armorAc(n, abilityMod(n.abilities.dex))
    return { ...n, ...(ac !== null && !n.acManual ? { ac } : {}), ...(n.armorId ? { armor: armorLabel(n) } : {}) }
  }
  const set = (p: Partial<Character>) => setD((cur) => recalc({ ...cur, ...p }))
  return (
    <Sheet open onClose={onClose} tall title={isNew ? 'New character' : d.name || 'Character'}
      footer={<button className="btn big primary" disabled={!d.name.trim()} onClick={() => onSave(d)}>Save character</button>}>
      <TextField label="Name" value={d.name} onChange={(v) => set({ name: v })} placeholder="Thorin" />
      <div className="grid3">
        <TextField label="Race" value={d.race} onChange={(v) => set({ race: v })} placeholder="Dwarf" />
        <TextField label="Class" value={d.cls} onChange={(v) => set({ cls: v })} placeholder="Fighter" />
        <NumField label="Level" value={d.level} onChange={(v) => set({ level: v })} />
      </div>
      <div className="mini-label">Ability scores</div>
      <div className="abil-grid">
        {ABILS.map((k) => (
          <label key={k} className="abil">
            <span>{k.toUpperCase()}</span>
            <input inputMode="numeric" value={String(d.abilities[k])}
              onChange={(e) => set({ abilities: { ...d.abilities, [k]: parseInt(e.target.value) || 0 } })} />
            <b>{fmtMod(abilityMod(d.abilities[k]))}</b>
          </label>
        ))}
      </div>
      <ArmorPicker d={d} set={set} />
      <div className="grid3">
        <NumField label={d.armorId && !d.acManual ? 'AC (auto)' : 'AC'} value={d.ac} onChange={(v) => set({ ac: v, acManual: d.armorId ? true : d.acManual })} />
        <NumField label="Max HP" value={d.maxHp} onChange={(v) => set({ maxHp: v })} />
        <NumField label="Current HP" value={d.currentHp ?? d.maxHp} onChange={(v) => set({ currentHp: v })} />
        <NumField label="Init mod" value={d.initMod} onChange={(v) => set({ initMod: v })} />
      </div>
      <button className="link small" onClick={() => set({ initMod: abilityMod(d.abilities.dex) })}>Use DEX modifier ({fmtMod(abilityMod(d.abilities.dex))}) for initiative</button>
      {!d.armorId && <TextField label="Armor (free text)" value={d.armor} onChange={(v) => set({ armor: v })} placeholder="Padded armor" />}
      <div className="row">
        <Stepper label={`Proficiency${d.profOverride === undefined ? ' (auto)' : ''}`} value={charProf(d)} min={1} max={9}
          onChange={(v) => set({ profOverride: v })} />
        {d.profOverride !== undefined && <button className="link small" onClick={() => set({ profOverride: undefined })}>Auto from level (+{profFromLevel(d.level)})</button>}
      </div>
      <CoinPurse d={d} set={set} />
      <div className="mini-label">Traits & homebrew (resistances, armor perks…)</div>
      <TraitEditor traits={d.traits} onChange={(t) => set({ traits: t })} />
      <div className="mini-label">Attacks</div>
      <AttackEditor attacks={d.attacks} onChange={(a) => set({ attacks: a })} />
      <label className="field"><span>Notes</span>
        <textarea rows={6} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Backstory, spells, inventory, reminders…" /></label>
      {!isNew && <button className="btn ghost danger" onClick={onDelete}>🗑 Delete character</button>}
    </Sheet>
  )
}

export function TierBadge({ tier }: { tier: Tier }) {
  return <span className="tier-badge" style={{ color: TIER_COLORS[tier], borderColor: TIER_COLORS[tier], boxShadow: `0 0 8px ${TIER_COLORS[tier]}66` }}>◆ {TIER_SHORT[tier]}</span>
}

function ArmorPicker({ d, set }: { d: Character; set: (p: Partial<Character>) => void }) {
  const def = armorById(d.armorId)
  const eff = combinedArmor({ ...d, prof: charProf(d) })
  const unders = ARMOR_CATALOG.flatMap((a) => TIERS.filter((t) => canBeUnderLayer(a.id, t)).map((t) => ({ a, t })))
  return (
    <div className="panel armor-picker">
      <div className="row between"><b>🛡 Armor</b>{d.armorTier && <TierBadge tier={d.armorTier} />}</div>
      <div className="chips-row wrap">
        <button className={'chip ' + (!d.armorId ? 'on' : '')} onClick={() => set({ armorId: undefined, armorTier: undefined })}>None / custom</button>
        {ARMOR_CATALOG.map((a) => (
          <button key={a.id} className={'chip ' + (d.armorId === a.id ? 'on' : '')} onClick={() => set({ armorId: a.id, armorTier: d.armorTier ?? 'green' })}>
            {a.name} <small>{a.category} · {a.focus}</small>
          </button>
        ))}
      </div>
      {def && (
        <>
          <div className="tier-row">
            {TIERS.map((t) => (
              <button key={t} className={'tier-chip ' + (d.armorTier === t ? 'on' : '')} style={{ ['--tier' as string]: TIER_COLORS[t] }} onClick={() => set({ armorTier: t })}>
                {TIER_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="small muted">AC {def.baseAc} + Dex{def.dexCap === null ? '' : def.dexCap ? ` (max ${def.dexCap})` : ' (none)'} = <b>{armorAc(d, abilityMod(d.abilities.dex))}</b>
            {d.acManual && <> · manual AC {d.ac} in use <button className="link small" onClick={() => set({ acManual: false })}>use auto</button></>}</div>
          <ul className="armor-effects">
            {eff.lines.map((l) => <li key={l}>✦ {l}</li>)}
            {eff.notes.map((l) => <li key={l} className="muted">📝 {l}</li>)}
          </ul>
          <div className="mini-label">Under-layer (only under medium/heavy armor)</div>
          {def.category === 'light'
            ? <div className="small muted">Not available with light armor. Only Mythic Padded qualifies as an under-layer.</div>
            : <div className="chips-row wrap">
                <button className={'chip ' + (!d.underId ? 'on' : '')} onClick={() => set({ underId: undefined, underTier: undefined })}>None</button>
                {unders.map(({ a, t }) => <button key={a.id + t} className={'chip ' + (d.underId === a.id && d.underTier === t ? 'on' : '')} onClick={() => set({ underId: a.id, underTier: t })}>{TIER_SHORT[t]} {a.name}</button>)}
              </div>}
        </>
      )}
    </div>
  )
}

function CoinPurse({ d, set }: { d: Character; set: (p: Partial<Character>) => void }) {
  const p = d.purse ?? { gold: 0, silver: 0 }
  const [amt, setAmt] = useState(1)
  const [coin, setCoin] = useState<'gold' | 'silver'>('gold')
  const [msg, setMsg] = useState('')
  const put = (gold: number, silver: number) => set({ purse: { gold, silver } })
  const spend = () => {
    const total = p.gold * 10 + p.silver, cost = coin === 'gold' ? amt * 10 : amt
    if (cost > total) return setMsg('Not enough coin!')
    let { gold, silver } = p
    if (coin === 'gold' && gold >= amt) gold -= amt
    else if (coin === 'silver' && silver >= amt) silver -= amt
    else { const left = total - cost; gold = Math.floor(left / 10); silver = left % 10; setMsg('Made change automatically (1 gp = 10 sp).'); return put(gold, silver) }
    setMsg(''); put(gold, silver)
  }
  return (
    <div className="panel purse">
      <div className="row between"><b>💰 Coin purse</b><span className="small muted">Total {(p.gold + p.silver / 10).toFixed(1)} gp</span></div>
      <div className="coins">
        <div className="coin gold"><b>{p.gold}</b><small>Gold</small></div>
        <div className="coin silver"><b>{p.silver}</b><small>Silver</small></div>
      </div>
      <div className="row">
        <Stepper value={amt} onChange={setAmt} min={1} max={9999} />
        <div className="segmented">
          <button type="button" className={coin === 'gold' ? 'on' : ''} onClick={() => setCoin('gold')}>gp</button>
          <button type="button" className={coin === 'silver' ? 'on' : ''} onClick={() => setCoin('silver')}>sp</button>
        </div>
      </div>
      <div className="row">
        <button className="btn grow" onClick={() => { setMsg(''); coin === 'gold' ? put(p.gold + amt, p.silver) : put(p.gold, p.silver + amt) }}>＋ Add</button>
        <button className="btn grow" onClick={spend}>− Spend</button>
      </div>
      <div className="row">
        <button className="btn sm grow" disabled={p.silver < 10} onClick={() => put(p.gold + Math.floor(p.silver / 10), p.silver % 10)}>⇄ Silver → Gold</button>
        <button className="btn sm grow" disabled={p.gold < 1} onClick={() => put(p.gold - 1, p.silver + 10)}>⇄ 1 Gold → 10 Silver</button>
      </div>
      {msg && <div className="small">{msg}</div>}
      <div className="small muted">1 gold = 10 silver. 🪙 Merchants value gold slightly higher when haggling.</div>
    </div>
  )
}
