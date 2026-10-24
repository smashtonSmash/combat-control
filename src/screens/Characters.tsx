import { DurBar } from '../components/DurBar'
import { BodyDoll } from '../components/BodyDoll'
import { PartyPanel } from '../components/PartyPanel'
import { durLabel, durOf, equippedArmor, isBroken, maxDur, stateText } from '../durability'
import { armorDamagedFlag } from '../durability'
import { useState } from 'react'
import type { Character } from '../types'
import { DAMAGE_ICONS, uid } from '../types'
import { abilityMod, fmtMod } from '../dice'
import { EFFECT_LABEL } from '../combat'
import { NumField, Sheet, Stepper, TextField } from '../components/Sheet'
import { AttackEditor, TraitEditor } from '../components/Editors'
import type { Tier } from '../armor'
import { ARMOR_CATALOG, TIERS, TIER_COLORS, TIER_LABELS, TIER_SHORT, armorAc, armorById, armorLabel, canBeUnderLayer, combinedArmor, profFromLevel } from '../armor'
import { charProf } from '../seed'
import { ItemCard, ItemPicker } from '../components/Items'
import { SpellsSection } from '../components/Spells'
import { addItem, equip, removeItem, unequip, useItem } from '../inventory'
import { accessoryAc } from '../accessories'
import { craftRepairKit, markForSalvage } from '../effects'
import { kitsFromCount } from '../salvage'
import { syncBlackMythic, unsyncBlackMythic, wieldBlock } from '../specialGear'
import type { PartyStash } from '../party'
import type { RecapKind } from '../recap'
import { FeatureEditor, OriginsPanel, SRC_ICON } from '../components/Origins'
import { ABIL_KEYS, ABIL_NAMES, SKILLS, applyBonuses, saveMod, skillMod, totalBonus } from '../origins'
import { Portrait, PortraitPicker } from '../components/Portrait'
import { AbilityGenerator } from '../components/AbilityGen'
import { KIND_ICON } from '../inventory'
import { WhoName, usePlayerDirectory } from '../components/PlayerName'
import { cleanPlayerName, withPlayer } from '../playerLabel'

const blank = (): Character => ({
  id: uid(), name: '', cls: '', level: 1, race: '',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  ac: 10, armor: '', maxHp: 10, initMod: 0, traits: [], attacks: [], notes: '',
})

export type GiveFn = (from: Character, toId: string, itemId: string) => Promise<boolean> | boolean

export default function Characters({ characters, onSave, onDelete, giveTargets = [], onGive, customBudget = 3, onBudget, allowReroll = true, onAllowReroll, party, onParty, canToggleParty = true, onTransfer, onRecap }: {
  characters: Character[]; onSave: (c: Character) => void; onDelete: (id: string) => void
  giveTargets?: { id: string; name: string }[]; onGive?: GiveFn
  customBudget?: number; onBudget?: (n: number) => void; allowReroll?: boolean; onAllowReroll?: (v: boolean) => void
  party?: PartyStash; onParty?: (p: PartyStash) => void; canToggleParty?: boolean
  onTransfer?: (fromId: string, toId: string, gold: number, silver: number) => void
  onRecap?: (kind: RecapKind, text: string) => void
}) {
  const [edit, setEdit] = useState<Character | null>(null)
  const [viewId, setViewId] = useState<string | null>(null)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const viewing = characters.find((c) => c.id === viewId)
  return (
    <div className="screen">
      <div className="screen-head">
        <h1>Characters</h1>
        <div className="row">
          {onBudget && <button className="btn sm" aria-label="Origin settings" onClick={() => setBudgetOpen(!budgetOpen)}>⚙</button>}
          <button className="btn primary" onClick={() => setEdit(blank())}>＋ New</button>
        </div>
      </div>
      {budgetOpen && onBudget && (
        <div className="panel">
          <Stepper label="Custom origin ability budget (DM)" value={customBudget} min={0} max={10} onChange={onBudget} />
          <div className="small muted">Points players allocate for Custom / non-SRD races and Custom backgrounds (max +2 per ability). Default +3.</div>
          {onAllowReroll && <label className="row small"><input type="checkbox" checked={allowReroll} onChange={(e) => onAllowReroll(e.target.checked)} /> Allow “Reroll all” for 4d6 ability rolls (until scores are assigned)</label>}
        </div>
      )}
      {party && onParty && <PartyPanel characters={characters} party={party} onParty={onParty} onSave={onSave} canToggle={canToggleParty} onRecap={(t) => onRecap?.('transfer', t)} />}
      {characters.length === 0 && <div className="empty">No characters yet. Tap <b>＋ New</b> to make your first sheet.</div>}
      <div className="char-list">
        {characters.map((c) => (
          <button key={c.id} className="char-card" onClick={() => setViewId(c.id)}>
            {c.sample && <div className="sample-tag">SAMPLE</div>}
            <div className="cc-left">
              <Portrait src={c.portrait} name={c.name} size={60} />
              <div className="ac-shield" style={c.armorTier ? { filter: `drop-shadow(0 0 6px ${TIER_COLORS[c.armorTier]})` } : undefined}><small>AC</small><b>{c.ac}</b></div>
            </div>
            <div className="char-main">
              <b className="char-name"><WhoName id={c.id} name={c.name || 'Unnamed'} /></b>
              <div className="muted small">{[c.race, c.cls, c.level && `Lv ${c.level}`].filter(Boolean).join(' · ')}</div>
              {c.armorTier && <TierBadge tier={c.armorTier} />}
              {(c.inventory ?? []).some((i) => i.equipped) && <div className="small">⚔️ {(c.inventory ?? []).filter((i) => i.equipped).map((i) => i.name).join(', ')}</div>}
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
      {viewing && !edit && (
        <CharacterView c={viewing} onClose={() => setViewId(null)} onEdit={() => setEdit(structuredClone(viewing))} onPersist={onSave}
          giveTargets={giveTargets.filter((t) => t.id !== viewing.id)} onGive={onGive} onTransfer={onTransfer} onRecap={onRecap} />
      )}
      {edit && (
        <CharacterSheet c={edit} customBudget={customBudget} allowReroll={allowReroll} isNew={!characters.some((x) => x.id === edit.id)} onClose={() => setEdit(null)}
          onSave={(c) => { onSave(c); setEdit(null); setViewId(c.id) }} onPersist={onSave}
          giveTargets={giveTargets.filter((t) => t.id !== edit.id)} onGive={onGive} onTransfer={onTransfer} onRecap={onRecap}
          onDelete={() => { if (confirm(`Delete ${edit.name || 'this character'}?`)) { onDelete(edit.id); setEdit(null) } }} />
      )}
    </div>
  )
}



function CharacterSheet({ c, isNew, onClose, onSave, onDelete, onPersist, giveTargets, onGive, customBudget, allowReroll, onTransfer, onRecap }: {
  c: Character; isNew: boolean; onClose: () => void; onSave: (c: Character) => void; onDelete: () => void
  onPersist: (c: Character) => void; giveTargets: { id: string; name: string }[]; onGive?: GiveFn; customBudget: number; allowReroll: boolean
  onTransfer?: (fromId: string, toId: string, gold: number, silver: number) => void
  onRecap?: (kind: RecapKind, text: string) => void
}) {
  const [d, setD] = useState(c)
  const [picking, setPicking] = useState(false)
  const account = usePlayerDirectory().account[d.id]
  const bonus = totalBonus(d)
  const recalc = (n0: Character): Character => {
    const n = { ...n0, armorDamaged: armorDamagedFlag(n0) || undefined }
    const ac = armorAc(n, abilityMod(n.abilities.dex))
    const bonus = accessoryAc(n)
    return { ...n, ...(ac !== null && !n.acManual ? { ac: ac + bonus } : {}), ...(n.armorId ? { armor: armorLabel(n) } : {}) }
  }
  const set = (p: Partial<Character>) => setD((cur) => {
    const n = { ...cur, ...p, tierV: 2 }
    // keep initiative following DEX if it was the DEX modifier
    if ((p.initMod === undefined || p.initMod === cur.initMod) && cur.initMod === abilityMod(cur.abilities.dex)) n.initMod = abilityMod(n.abilities.dex)
    return recalc(n)
  })
  return (
    <Sheet open onClose={onClose} tall title={isNew ? 'New character' : <WhoName id={d.id} name={d.name || 'Character'} />}
      footer={<button className="btn big primary" disabled={!d.name.trim()} onClick={() => onSave(d)}>Save character</button>}>
      <div className="edit-top">
        <button type="button" className="portrait-btn" onClick={() => setPicking(true)} aria-label="Change portrait">
          <Portrait src={d.portrait} name={d.name} size={84} /><span>📷</span>
        </button>
        <div className="grow">
          <TextField label="Name" value={d.name} onChange={(v) => set({ name: v })} placeholder="Thorin" />
          {account && <div className="small">Played by <b>{account}</b> <span className="muted">(campaign account)</span></div>}
          <TextField label="Player name" value={d.playerName ?? ''} onChange={(v) => set({ playerName: cleanPlayerName(v) })} placeholder="Optional" />
          <div className="small muted">{account ? 'Used offline, or when that account has no display name. Leave blank if you don’t know.' : 'Optional. Who plays this character, so the table can tell them apart. Leave blank if you don’t know.'}</div>
          <div className="grid2">
            <NumField label="Level" value={d.level} onChange={(v) => set({ level: v })} />
            <NumField label="Speed (ft)" value={d.speed ?? 30} onChange={(v) => set({ speed: v })} />
          </div>
        </div>
      </div>
      {d.portrait && <button className="link small" onClick={() => set({ portrait: undefined })}>Remove portrait</button>}
      {picking && <PortraitPicker onCancel={() => setPicking(false)} onPick={(u) => { set({ portrait: u }); setPicking(false) }} />}
      <OriginsPanel d={d} setD={(n) => set(n)} customBudget={customBudget} />
      {!d.origin?.raceKey && !d.origin?.classKey && (d.race || d.cls) && <div className="small muted">Current: {[d.race, d.cls].filter(Boolean).join(' · ')} (pick from the lists to add traits and features)</div>}
      <div className="mini-label">Ability scores {Object.keys(bonus).some((k) => bonus[k as keyof typeof bonus]) && <span className="muted">(base + bonuses)</span>}</div>
      <AbilityGenerator d={d} allowReroll={allowReroll} setBase={(b, g) => set(applyBonuses({ ...d, baseAbilities: b, abilityGen: g }))} />
      <ArmorPicker d={d} set={set} />
      <div className="grid3">
        <NumField label={d.armorId && !d.acManual ? 'AC (auto)' : 'AC'} value={d.ac} onChange={(v) => set({ ac: v, acManual: d.armorId ? true : d.acManual })} />
        <NumField label="Max HP" value={d.maxHp} onChange={(v) => set({ maxHp: v })} />
        <NumField label="Current HP" value={d.currentHp ?? d.maxHp} onChange={(v) => set({ currentHp: v })} />
        <NumField label="Temp HP" value={d.tempHp ?? 0} onChange={(v) => set({ tempHp: Math.max(0, v) || undefined })} />
        <NumField label="Init mod" value={d.initMod} onChange={(v) => set({ initMod: v })} />
      </div>
      <button className="link small" onClick={() => set({ initMod: abilityMod(d.abilities.dex) })}>Use DEX modifier ({fmtMod(abilityMod(d.abilities.dex))}) for initiative</button>
      {!d.armorId && <TextField label="Armor (free text)" value={d.armor} onChange={(v) => set({ armor: v })} placeholder="Padded armor" />}
      <div className="row">
        <Stepper label={`Proficiency${d.profOverride === undefined ? ' (auto)' : ''}`} value={charProf(d)} min={1} max={9}
          onChange={(v) => set({ profOverride: v })} />
        {d.profOverride !== undefined && <button className="link small" onClick={() => set({ profOverride: undefined })}>Auto from level (+{profFromLevel(d.level)})</button>}
      </div>
      <CoinPurse d={d} set={set} targets={giveTargets} onTransfer={onTransfer} />
      <div className="mini-label">🧬 Traits & features</div>
      <FeatureEditor features={d.features ?? []} onChange={(f) => set({ features: f })} />
      <div className="mini-label">Combat traits & homebrew (resistances, armor perks…)</div>
      <TraitEditor traits={d.traits} onChange={(t) => set({ traits: t })} />
      <div className="mini-label">Attacks</div>
      <AttackEditor attacks={d.attacks} onChange={(a) => set({ attacks: a })} />
      <div className="mini-label">✨ Spells</div>
      <SpellsSection d={d} commit={(n) => { setD(n); if (!isNew && n.name.trim()) onPersist(n) }} />
      <div className="mini-label">🎒 Inventory</div>
      <Inventory d={d} commit={(n) => { setD(n); if (!isNew && n.name.trim()) onPersist(n) }} giveTargets={isNew ? [] : giveTargets} onGive={onGive} onRecap={onRecap} />
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
            ? <div className="small muted">Not available with light armor. Only Legendary/Mythic Padded qualify as an under-layer.</div>
            : <div className="chips-row wrap">
                <button className={'chip ' + (!d.underId ? 'on' : '')} onClick={() => set({ underId: undefined, underTier: undefined })}>None</button>
                {unders.map(({ a, t }) => <button key={a.id + t} className={'chip ' + (d.underId === a.id && d.underTier === t ? 'on' : '')} onClick={() => set({ underId: a.id, underTier: t })}>{TIER_SHORT[t]} {a.name}</button>)}
              </div>}
        </>
      )}
    </div>
  )
}

function CoinPurse({ d, set, targets = [], onTransfer }: { d: Character; set: (p: Partial<Character>) => void; targets?: { id: string; name: string }[]; onTransfer?: (fromId: string, toId: string, gold: number, silver: number) => void }) {
  const p = d.purse ?? { gold: 0, silver: 0 }
  const [amt, setAmt] = useState(1)
  const [coin, setCoin] = useState<'gold' | 'silver'>('gold')
  const [msg, setMsg] = useState('')
  const [toId, setToId] = useState(targets[0]?.id ?? '')
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
      <div className="small muted">1 gold = 10 silver. Merchants on the Town tab haggle from favor, not from the coin itself.</div>
      {onTransfer && targets.length > 0 && (
        <>
          <div className="mini-label">Send to another character</div>
          <div className="chips-row wrap">{targets.map((t) => <button key={t.id} type="button" className={'chip ' + (toId === t.id ? 'on' : '')} onClick={() => setToId(t.id)}><WhoName id={t.id} name={t.name} /></button>)}</div>
          <button className="btn sm" disabled={!toId} onClick={() => onTransfer(d.id, toId, coin === 'gold' ? amt : 0, coin === 'silver' ? amt : 0)}>Send {amt} {coin === 'gold' ? 'gold' : 'silver'}</button>
        </>
      )}
    </div>
  )
}

function Inventory({ d, commit, giveTargets, onGive, onRecap }: {
  d: Character; commit: (c: Character) => void; giveTargets: { id: string; name: string }[]; onGive?: GiveFn
  onRecap?: (kind: RecapKind, text: string) => void
}) {
  const dir = usePlayerDirectory()
  const inv = d.inventory ?? []
  const [sel, setSel] = useState<string | null>(null)
  const [kitFor, setKitFor] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [giving, setGiving] = useState(false)
  const [msg, setMsg] = useState('')
  const it = inv.find((x) => x.id === sel)
  const close = () => { setSel(null); setGiving(false) }
  const mats = new Map<string, { name: string; qty: number }>()
  for (const i of inv) if (i.materialKey) {
    const g = mats.get(i.materialKey) ?? { name: i.name, qty: 0 }
    g.qty += i.qty
    mats.set(i.materialKey, g)
  }
  return (
    <div className="panel">
      <BodyDoll c={d} onPick={(id) => { setSel(id); setGiving(false); setMsg('') }} />
      {[...mats.entries()].filter(([, g]) => kitsFromCount(g.qty) >= 1).map(([key, g]) => (
        <button key={key} className="btn sm" onClick={() => {
          const r = craftRepairKit(d, key)
          setMsg(r.message)
          if (r.ok) { commit(r.char); onRecap?.('craft', r.message) }
        }}>Craft kit from {g.qty}× {g.name}</button>
      ))}
      {(d.effects ?? []).length > 0 && (
        <div className="active-effects">
          {(d.effects ?? []).map((e) => <span key={e.id} className="badge effect-badge" title={e.note}>✨ {e.name} <small>· {e.until === 'combat' ? 'this fight' : 'until long rest'}</small>
            <button className="link small" aria-label={`End ${e.name}`} onClick={() => commit({ ...d, effects: (d.effects ?? []).filter((x) => x.id !== e.id) })}>✕</button></span>)}
        </div>
      )}
      {inv.length === 0 && <div className="small muted">Empty pack. Add items below, or the DM can drop loot to you.</div>}
      <div className="item-grid">
        {[...inv].sort((a, b) => Number(!!b.equipped) - Number(!!a.equipped)).map((x) => (
          <ItemCard key={x.id} it={x} selected={x.id === sel} onClick={() => { setSel(x.id === sel ? null : x.id); setGiving(false); setMsg('') }} />
        ))}
      </div>
      {msg && <div className="inv-msg">{msg}</div>}
      {it && (
        <div className="item-actions panel">
          <b>{it.name}</b>{it.qty > 1 && <span className="muted"> ×{it.qty}</span>}
          {it.description && <div className="small muted spell-desc">{it.description}</div>}
          <div className="row">
            {it.atForge && <span className="small muted">🔥 At the forge — the DM taps Ready when it's done.</span>}
            {(it.kind === 'armor' || it.kind === 'weapon') && maxDur(it) > 0 && <span className="small">Durability <DurBar it={it} /> {stateText(it) && <b className={isBroken(it) ? 'bad' : 'warn'}>{stateText(it)}</b>}</span>}
            {it.abilityNote && <div className="small">{it.abilityNote}</div>}
            {it.special === 'black' && !it.synced && <span className="small warn">Not synced — {d.name || 'this character'} can’t use it until they choose to.</span>}
            {it.special === 'black' && it.synced && <span className="small">Synced to its owner.</span>}
            {it.special === 'black' && !it.synced && <button className="btn sm primary" onClick={() => { const r = syncBlackMythic(d, it.id); commit(r.char); setMsg(r.message) }}>Sync with {d.name || 'owner'}</button>}
            {it.special === 'black' && it.synced && <button className="btn sm" onClick={() => { const base = it.equipped ? unequip(d, it.id) : d; commit(unsyncBlackMythic(base, it.id)); setMsg(`${it.name} slips the bond.`) }}>Release the bond</button>}
            {it.special === 'pink' && <button className="btn sm" onClick={() => setMsg(it.abilityNote || 'PLACEHOLDER unique ability. TBD.')}>Invoke unique ability (stub)</button>}
            {isBroken(it) && <span className="small muted">⛓ Broken — a blacksmith can repair it, or a matching repair kit if it’s armor.</span>}
            {it.kind === 'armor' && (isBroken(it) || it.salvaged) && <span className="small">Bring it to Shop & Forge → Blacksmith to salvage for parts or a small refund.</span>}
            {it.kind === 'armor' && !it.salvaged && !isBroken(it) && <button className="btn sm" onClick={() => { commit(markForSalvage(d, it.id)); setMsg(`${it.name} is marked for salvage. It can’t be worn until you change your mind at the forge… or rather, until you scrap it.`) }}>Mark for salvage</button>}
            {wieldBlock(it, d.id) && <span className="small warn">{wieldBlock(it, d.id)}</span>}
            {!it.atForge && !isBroken(it) && !it.salvaged && !wieldBlock(it, d.id) && (it.kind === 'armor' || it.kind === 'weapon' || it.equipSlot) && (it.equipped
              ? <button className="btn sm" onClick={() => { commit(unequip(d, it.id)); setMsg(`Unequipped ${it.name}.`) }}>Unequip</button>
              : <button className="btn sm primary" onClick={() => { commit(equip(d, it.id)); setMsg(it.kind === 'armor' ? `Equipped ${it.name} — AC and armor effects updated.` : it.equipSlot ? `Equipped ${it.name}.` : `Equipped ${it.name} — added to attacks.`) }}>Equip</button>)}
            {it.coating && <span className="small">🧴 {it.coating.source}{it.coating.type ? ` → ${it.coating.type}` : ''}{it.coating.bonus ? ` +${it.coating.bonus.dice} ${it.coating.bonus.type}` : ''} (until long rest)</span>}
            {it.kind === 'scroll' && <button className="btn sm primary" onClick={() => { const r = useItem(d, it.id); commit(r.char); setMsg(r.message); if (it.qty <= 1) setSel(null) }}>📜 Use scroll</button>}
            {it.kitTier && (kitFor === it.id ? (
              <div className="kit-pick">
                <span className="small">Matching {it.kitArmorId ? it.kitArmorId + ' ' : ''}armor of this tier, including Broken:</span>
                {(d.inventory ?? []).filter((a) => a.kind === 'armor' && a.tier === it.kitTier && (!it.kitArmorId || a.armorId === it.kitArmorId)).map((a) => (
                  <button key={a.id} className="btn sm" disabled={durOf(a) >= maxDur(a)} onClick={() => { const r = useItem(d, it.id, { targetId: a.id }); commit(r.char); setMsg(r.message); onRecap?.('repair', r.message); setKitFor(null); if (it.qty <= 1) setSel(null) }}>{a.name} {durLabel(a)}</button>
                ))}
                <button className="link small" onClick={() => setKitFor(null)}>Cancel</button>
              </div>
            ) : <button className="btn sm primary" onClick={() => setKitFor(it.id)}>🧰 Use repair kit…</button>)}
            {it.catalogKey === 'field-repair' && (kitFor === it.id ? (
              <div className="kit-pick">
                <span className="small warn">⏳ Use during a short rest. Which armor?</span>
                {(d.inventory ?? []).filter((a) => a.kind === 'armor' && a.tier).map((a) => (
                  <button key={a.id} className="btn sm" disabled={isBroken(a) || durOf(a) >= maxDur(a)} onClick={() => { const r = useItem(d, it.id, { targetId: a.id }); commit(r.char); setMsg(r.message); setKitFor(null); if (it.qty <= 1) setSel(null) }}>
                    {a.name} {durLabel(a)}{isBroken(a) ? ' (Broken)' : ''}</button>))}
                <button className="link small" onClick={() => setKitFor(null)}>Cancel</button>
              </div>) : <button className="btn sm primary" onClick={() => setKitFor(it.id)}>🧰 Use kit…</button>)}
            {it.kind === 'consumable' && it.catalogKey !== 'field-repair' && !it.kitTier && <button className="btn sm primary" onClick={() => { const r = useItem(d, it.id); commit(r.char); setMsg(r.message); if (it.qty <= 1) setSel(null) }}>Use</button>}
            {onGive && giveTargets.length > 0 && <button className="btn sm" onClick={() => setGiving(!giving)}>Give…</button>}
            <button className="btn sm danger" onClick={() => { if (confirm(`Drop ${it.name}${it.qty > 1 ? ` (all ${it.qty})` : ''}?`)) { commit(removeItem(d, it.id)); setMsg(`Dropped ${it.name}.`); close() } }}>Drop</button>
          </div>
          {giving && (
            <div className="chips-row wrap">
              {giveTargets.map((t) => (
                <button key={t.id} className="chip" onClick={async () => {
                  const from = it.equipped ? unequip(d, it.id) : d
                  if (from !== d) commit(from)
                  const ok = await onGive!(from, t.id, it.id)
                  if (ok) { setD_after(from) } else setMsg('Could not give that item.')
                  function setD_after(f: Character) { commit(removeItem(f, it!.id)); setMsg(`Gave ${it!.name} to ${withPlayer(t.name, dir.label[t.id])}.`); close() }
                }}>→ <WhoName id={t.id} name={t.name} /></button>
              ))}
            </div>
          )}
        </div>
      )}
      <button className="btn ghost sm" onClick={() => setAdding(!adding)}>{adding ? 'Done adding' : '+ Add item'}</button>
      {adding && <ItemPicker customSpells={(d.spells ?? []).filter((s) => !s.srd)} onAdd={(x) => { commit(addItem(d, x)); setMsg(`Added ${x.name}.`) }} />}
    </div>
  )
}

function CharacterView({ c, onClose, onEdit, onPersist, giveTargets, onGive, onTransfer, onRecap }: {
  c: Character; onClose: () => void; onEdit: () => void; onPersist: (c: Character) => void; giveTargets: { id: string; name: string }[]; onGive?: GiveFn
  onTransfer?: (fromId: string, toId: string, gold: number, silver: number) => void
  onRecap?: (kind: RecapKind, text: string) => void
}) {
  const prof = charProf(c)
  const cur = c.currentHp ?? c.maxHp, temp = c.tempHp ?? 0
  const pct = Math.max(0, Math.min(100, (cur / Math.max(1, c.maxHp)) * 100))
  const tpct = Math.min(100 - pct, (temp / Math.max(1, c.maxHp)) * 100)
  const equipped = (c.inventory ?? []).filter((i) => i.equipped)
  const [, force] = useState(0)
  const commit = (n: Character) => { onPersist(n); force((x) => x + 1) }
  return (
    <Sheet open onClose={onClose} tall title={<span className="cv-titlebar"><WhoName id={c.id} name={c.name || 'Character'} /></span>}
      footer={<button className="btn big primary" onClick={onEdit}>✎ Edit character</button>}>
      <div className="cv">
        <div className="cv-hero">
          <Portrait src={c.portrait} name={c.name} size={132} className="cv-portrait" />
          <div className="cv-id">
            <h2><WhoName id={c.id} name={c.name || 'Unnamed'} /></h2>
            <div className="cv-sub">{[c.race, c.cls && `${c.cls} ${c.level}`].filter(Boolean).join(' · ') || `Level ${c.level}`}</div>
            {c.background && <div className="cv-bg">📖 {c.background}</div>}
            <button className="btn sm cv-edit" onClick={onEdit}>✎ Edit</button>
          </div>
        </div>
        <div className="cv-hp" aria-label={`HP ${cur} of ${c.maxHp}${temp ? `, ${temp} temporary` : ''}`}>
          <div className="cv-hp-bar"><i className={pct > 50 ? 'good' : pct > 25 ? 'mid' : 'low'} style={{ width: pct + '%' }} />{temp > 0 && <i className="temp" style={{ width: tpct + '%' }} />}</div>
          <div className="cv-hp-nums"><b>{cur}</b><span>/ {c.maxHp} HP</span>{temp > 0 && <em>+{temp} temp</em>}</div>
        </div>
        <div className="cv-stats">
          <div className="cv-stat"><div className="ac-shield lg" style={c.armorTier ? { filter: `drop-shadow(0 0 6px ${TIER_COLORS[c.armorTier]})` } : undefined}><small>AC</small><b>{c.ac}</b></div></div>
          <div className="cv-stat"><b>{c.speed ?? 30}</b><small>ft speed</small></div>
          <div className="cv-stat"><b>{fmtMod(c.initMod)}</b><small>initiative</small></div>
          <div className="cv-stat"><b>+{prof}</b><small>proficiency</small></div>
          {c.hitDie && <div className="cv-stat"><b>d{c.hitDie}</b><small>hit die</small></div>}
        </div>
        <div className="cv-abils">
          {ABIL_KEYS.map((k) => (
            <div key={k} className="cv-abil" title={ABIL_NAMES[k]}>
              <small>{k.toUpperCase()}</small><b>{fmtMod(abilityMod(c.abilities[k]))}</b><span>{c.abilities[k]}</span>
              <em className={(c.saves ?? []).includes(k) ? 'prof' : ''}>save {fmtMod(saveMod(c, k, prof))}</em>
            </div>
          ))}
        </div>
        <section className="cv-sec"><h3>Skills</h3>
          <div className="cv-skills">{SKILLS.map(([s, ab]) => {
            const p = (c.skills ?? []).includes(s)
            return <div key={s} className={'cv-skill ' + (p ? 'prof' : '')}><i>{p ? '●' : '○'}</i><span>{s} <small>{ab}</small></span><b>{fmtMod(skillMod(c, s, prof))}</b></div>
          })}</div>
        </section>
        <section className="cv-sec"><h3>⚔️ Equipped</h3>
          <BodyDoll c={c} />
          {equipped.length === 0 && !c.armor ? <div className="small muted">Nothing equipped.</div> : (
            <div className="cv-gear">
              {c.armor && <div>🛡 {c.armor}{c.armorTier && <> <TierBadge tier={c.armorTier} /></>}{equippedArmor(c) && <> <DurBar it={equippedArmor(c)!} />{c.armorDamaged && <span className="badge dur-damaged">Damaged −1 AC</span>}</>}</div>}
              {equipped.filter((i) => i.kind !== 'armor').map((i) => <div key={i.id}>{KIND_ICON[i.kind]} {i.name}</div>)}
              {c.attacks.map((a) => <div key={a.id} className="small muted">🎯 {a.name} {fmtMod(a.toHit)} · {a.damage} {a.damageType}</div>)}
            </div>
          )}
        </section>
        <section className="cv-sec"><h3>💰 Coins</h3>
          <div className="cv-coins"><span className="coin-pill gold">{c.purse?.gold ?? 0} g</span><span className="coin-pill silver">{c.purse?.silver ?? 0} s</span></div>
        </section>
        <section className="cv-sec"><h3>🎒 Inventory</h3>
          <Inventory d={c} commit={commit} giveTargets={giveTargets} onGive={onGive} onRecap={onRecap} />
          {onTransfer && <CoinPurse d={c} set={(p) => commit({ ...c, ...p })} targets={giveTargets} onTransfer={onTransfer} />}
        </section>
        {(c.spells?.length || c.spellcasting || c.slots) ? <section className="cv-sec"><h3>✨ Spells</h3><SpellsSection d={c} commit={commit} /></section> : null}
        <section className="cv-sec"><h3>🧬 Traits & features</h3>
          {(c.features ?? []).length === 0 && c.traits.length === 0 && <div className="small muted">None yet — tap Edit to add some.</div>}
          {(c.features ?? []).map((f) => (
            <details key={f.id} className="cv-feature"><summary>{SRC_ICON[f.source]} <b>{f.name}</b></summary>{f.desc ? <p>{f.desc}</p> : <p className="muted">No description.</p>}</details>
          ))}
          {c.traits.map((t) => <div key={t.id} className={'badge trait effect-' + t.effect}>✦ {t.name || EFFECT_LABEL[t.effect]} {t.damageTypes.map((x) => DAMAGE_ICONS[x]).join('')}</div>)}
          {(c.proficiencies ?? []).length > 0 && <div className="small muted cv-profs">Proficiencies: {c.proficiencies!.join(', ')}</div>}
        </section>
        {c.notes && <section className="cv-sec"><h3>📝 Notes</h3><p className="cv-notes">{c.notes}</p></section>}
      </div>
    </Sheet>
  )
}
