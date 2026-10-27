import { DurBar } from './DurBar'
import { isBroken, maxDur } from '../durability'
import { itemRarity } from '../armor'
import { useEffect, useMemo, useState } from 'react'
import type { DamageType, Item, ItemKind } from '../types'
import { DAMAGE_TYPES, uid } from '../types'
import { ARMOR_CATALOG, RARITY_OPTIONS, TIERS, TIER_COLORS, TIER_SHORT, type Tier } from '../armor'
import { COMMON_WEAPONS, KIND_ICON, armorItem, potionOfHealing, scrollItem, weaponItem } from '../inventory'
import { itemArtSrc } from '../itemArt'
import { accessoryItem } from '../accessories'
import { materialItem } from '../salvage'
import { pinkCoin, pinkLantern, whisperfang } from '../specialGear'
import { tieredWeapon } from '../weapons'
import { fromSrd, loadSpells, type CharSpell, type SrdSpell } from '../spells'
import { CustomSpell } from './Spells'
import { DAMAGE_ICONS } from '../types'
import { CONSUMABLES, armorPrice, catalogToItem, displayName, itemPrice } from '../catalog'
import { ackTap } from '../feedback'

/** PNG when one exists; emoji if art is missing or fails to load. */
export function ItemArt({ src, fallback }: { src: string | null; fallback: string }) {
  const [broken, setBroken] = useState<string | null>(null)
  if (!src || broken === src) return fallback
  return <img src={src} alt="" draggable={false} onError={() => setBroken(src)} />
}

export function ItemCard({ it, selected, onClick, onPointerDown, dragging }: {
  it: Item; selected?: boolean; onClick?: () => void; onPointerDown?: (e: React.PointerEvent) => void; dragging?: boolean
}) {
  const rarity = itemRarity(it)
  const color = rarity?.color
  return (
    <button type="button" className={`item-card ${it.equipped ? 'equipped' : ''} ${selected ? 'selected' : ''} ${dragging ? 'lifted' : ''}`}
      style={color ? { borderColor: color, boxShadow: `0 0 10px ${color}55` } : undefined}
      onClick={onClick} onPointerDown={onPointerDown} onContextMenu={(e) => e.preventDefault()}>
      {it.equipped && <span className="eq-ribbon">EQUIPPED</span>}
      <span className="item-icon"><ItemArt src={itemArtSrc(it)} fallback={KIND_ICON[it.kind]} /></span>
      <span className="item-name">{it.name}</span>
      <small className="item-sub">{it.scroll?.kind === 'spell' ? `${it.scroll.spell.level ? 'lv ' + it.scroll.spell.level : 'cantrip'} scroll` : it.kind === 'weapon' ? `${it.damage} ${it.damageType}` : it.heal ? `heals ${it.heal}` : rarity ? <span style={{ color }}>◆ {rarity.label}</span> : it.materialKey ? 'material' : it.kind}</small>
      {it.qty > 1 && <span className="qty">×{it.qty}</span>}
      {maxDur(it) > 0 && <DurBar it={it} small />}
      {isBroken(it) && <span className="broken-ribbon">BROKEN</span>}
      {it.special === 'black' && !it.synced && <span className="broken-ribbon">UNSYNCED</span>}
      {it.atForge && <span className="forge-ribbon">🔥 AT THE FORGE</span>}
      {itemPrice(it) != null && <span className="item-price">{itemPrice(it)}g</span>}
    </button>
  )
}

/** Quick picks + custom item form. */
export function ItemPicker({ onAdd, customSpells = [], ack = false }: { onAdd: (it: Item) => void; customSpells?: CharSpell[]; ack?: boolean }) {
  const add = (it: Item) => { if (ack) ackTap(); onAdd(it) }
  const [armorId, setArmorId] = useState(ARMOR_CATALOG[0].id)
  const [tier, setTier] = useState<Tier>('green')
  const [custom, setCustom] = useState<{ name: string; kind: ItemKind; qty: number; description: string; damage: string; damageType: DamageType; heal: string; rarity: string }>(
    { name: '', kind: 'misc', qty: 1, description: '', damage: '1d6', damageType: 'slashing', heal: '', rarity: 'green' })
  const [open, setOpen] = useState<'quick' | 'potions' | 'scroll' | 'custom'>('quick')
  return (
    <div className="item-picker">
      <div className="segmented">
        <button type="button" className={open === 'quick' ? 'on' : ''} onClick={() => setOpen('quick')}>Quick picks</button>
        <button type="button" className={open === 'potions' ? 'on' : ''} onClick={() => setOpen('potions')}>🧪 Potions & Scrolls</button>
        <button type="button" className={open === 'scroll' ? 'on' : ''} onClick={() => setOpen('scroll')}>📜 Spell scroll</button>
        <button type="button" className={open === 'custom' ? 'on' : ''} onClick={() => setOpen('custom')}>Custom item</button>
      </div>
      {open === 'potions' ? <ConsumablePicker onAdd={add} /> : open === 'scroll' ? <ScrollPicker onAdd={add} customSpells={customSpells} /> : open === 'quick' ? (
        <>
          <button className="btn sm" onClick={() => add(potionOfHealing())}>🧪 + Common Healing Potion (2d6+2) <small>10g</small></button>
          <div className="mini-label">Armor</div>
          <div className="chips-row wrap">{ARMOR_CATALOG.map((a) => <button key={a.id} className={'chip ' + (armorId === a.id ? 'on' : '')} onClick={() => setArmorId(a.id)}>{a.name}</button>)}</div>
          <div className="chips-row wrap">{TIERS.map((t) => <button key={t} className={'chip ' + (tier === t ? 'on' : '')} style={{ color: TIER_COLORS[t] }} onClick={() => setTier(t)}>◆ {TIER_SHORT[t]} <small>{armorPrice(armorId, t)}g</small></button>)}</div>
          <button className="btn sm" onClick={() => add(armorItem(armorId, tier))}>🛡 + {TIER_SHORT[tier]} {ARMOR_CATALOG.find((a) => a.id === armorId)?.name} Armor <small>{armorPrice(armorId, tier)}g</small></button>
          <div className="mini-label">Weapons</div>
          <div className="chips-row wrap">{COMMON_WEAPONS.map((w) => <button key={w.name} className="chip" onClick={() => add(weaponItem(w))}>+ {w.name} <small>{w.damage}</small></button>)}</div>
          <div className="mini-label">Homebrew (first pass)</div>
          <div className="chips-row wrap">
            <button className="chip" onClick={() => add(tieredWeapon('longsword', tier))}>+ {TIER_SHORT[tier]} Longsword</button>
            <button className="chip" onClick={() => add(tieredWeapon('greatsword', 'green'))}>+ Common Greatsword <small>2 slots</small></button>
            <button className="chip" onClick={() => add(accessoryItem('iron-cap'))}>+ Iron Cap</button>
            <button className="chip" onClick={() => add(accessoryItem('archer-gauntlets'))}>+ Archer’s Gauntlets</button>
            <button className="chip" onClick={() => add(accessoryItem('softstep-boots'))}>+ Softstep Boots</button>
            <button className="chip" onClick={() => add(materialItem('green', 2))}>+ 2 Green Material</button>
            <button className="chip" onClick={() => add(pinkLantern())}>+ Pink Lantern</button>
            <button className="chip" onClick={() => add(pinkCoin())}>+ Pink Coin</button>
            <button className="chip" onClick={() => add(whisperfang())}>+ Whisperfang</button>
          </div>
        </>
      ) : (
        <>
          <div className="row">
            <input className="grow" placeholder="Item name" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
            <input style={{ width: 56 }} inputMode="numeric" value={String(custom.qty)} onChange={(e) => setCustom({ ...custom, qty: Math.max(1, parseInt(e.target.value) || 1) })} />
          </div>
          <div className="chips-row wrap">{(['misc', 'consumable', 'weapon'] as ItemKind[]).map((k) => <button key={k} className={'chip ' + (custom.kind === k ? 'on' : '')} onClick={() => setCustom({ ...custom, kind: k })}>{KIND_ICON[k]} {k}</button>)}</div>
          <div className="mini-label">Rarity</div>
          <div className="chips-row wrap" aria-label="Rarity">{RARITY_OPTIONS.map((r) => (
            <button key={r.id} type="button" className={'chip ' + (custom.rarity === r.id ? 'on' : '')} style={{
              color: r.id === 'black' ? '#f3f3f6' : r.color,
              background: r.id === 'black' ? '#0c0c0e' : undefined,
              borderColor: custom.rarity === r.id ? (r.id === 'black' ? '#f3f3f6' : r.color) : (r.id === 'black' ? '#3a3a40' : undefined),
            }}
              onClick={() => setCustom({ ...custom, rarity: r.id })}>◆ {r.label}</button>
          ))}</div>
          {custom.kind === 'weapon' && (
            <div className="row">
              <input style={{ width: 80 }} value={custom.damage} onChange={(e) => setCustom({ ...custom, damage: e.target.value })} placeholder="1d8" />
              <select value={custom.damageType} onChange={(e) => setCustom({ ...custom, damageType: e.target.value as DamageType })}>{DAMAGE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
          )}
          {custom.kind === 'consumable' && <input placeholder="Heals (dice, optional) e.g. 4d4+4" value={custom.heal} onChange={(e) => setCustom({ ...custom, heal: e.target.value })} />}
          <textarea rows={2} placeholder="Description" value={custom.description} onChange={(e) => setCustom({ ...custom, description: e.target.value })} />
          <button className="btn sm primary" disabled={!custom.name.trim()} onClick={() => {
            const rarity = RARITY_OPTIONS.find((r) => r.id === custom.rarity) ?? RARITY_OPTIONS[0]
            add({ id: uid(), name: custom.name.trim(), kind: custom.kind, qty: custom.qty, description: custom.description,
              ...(rarity.special ? { special: rarity.special } : { tier: rarity.tier }),
              ...(custom.kind === 'weapon' ? { damage: custom.damage, damageType: custom.damageType } : {}),
              ...(custom.kind === 'consumable' && custom.heal.trim() ? { heal: custom.heal.trim() } : {}) })
            setCustom({ ...custom, name: '', description: '', qty: 1 })
          }}>+ Add {custom.name || 'item'}</button>
        </>
      )}
    </div>
  )
}

const LV = ['Cantrip', '1', '2', '3', '4', '5', '6', '7', '8', '9']
function ScrollPicker({ onAdd, customSpells }: { onAdd: (it: Item) => void; customSpells: CharSpell[] }) {
  const [all, setAll] = useState<SrdSpell[] | null>(null)
  const [lvl, setLvl] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [made, setMade] = useState('')
  useEffect(() => { loadSpells().then(setAll) }, [])
  const ql = q.toLowerCase()
  const custom = useMemo(() => {
    const seen = new Set<string>()
    return customSpells.filter((s) => !seen.has(s.name) && seen.add(s.name) && (lvl === null || s.level === lvl) && s.name.toLowerCase().includes(ql))
  }, [customSpells, lvl, ql])
  const list = useMemo(() => (all ?? []).filter((s) => (lvl === null || s.l === lvl) && s.n.toLowerCase().includes(ql)), [all, lvl, ql])
  const add = (sp: CharSpell) => { const it = scrollItem(sp); onAdd(it); setMade(`Added ${it.name}`) }
  return (
    <div className="spell-picker">
      <div className="chips-row lv-tabs">
        <button className={'chip ' + (lvl === null ? 'on' : '')} onClick={() => setLvl(null)}>All</button>
        {LV.map((o, i) => <button key={o} className={'chip ' + (lvl === i ? 'on' : '')} onClick={() => setLvl(i)}>{o}</button>)}
      </div>
      <input placeholder="Search all spells for a scroll…" value={q} onChange={(e) => setQ(e.target.value)} />
      {made && <div className="small">✓ {made}</div>}
      <div className="picker-list">
        {!all && <div className="small muted">Loading spells…</div>}
        {custom.map((s) => (
          <button key={'c' + s.id} className="picker-row" onClick={() => add(s)}>
            <b>📜 {s.name}</b> <small className="muted">custom · {s.level ? 'lv ' + s.level : 'cantrip'}</small><span className="add">+</span>
          </button>
        ))}
        {list.map((s) => (
          <button key={s.i} className="picker-row" onClick={() => add(fromSrd(s, s.i))}>
            <b>📜 {s.n}</b> <small className="muted">{s.l ? 'lv ' + s.l : 'cantrip'}{s.dt ? ` · ${DAMAGE_ICONS[s.dt]} ${s.dt}` : ''}</small><span className="add">+</span>
          </button>
        ))}
        <CustomSpell level={lvl ?? 1} onAdd={add} label="✎ Custom scroll" />
      </div>
    </div>
  )
}

/** Homebrew potions & scrolls from src/catalog.ts, grouped by tier. */
export function ConsumablePicker({ onAdd, priceLabel }: { onAdd: (it: Item) => void; priceLabel?: (gold: number) => string }) {
  return (
    <div className="consumable-picker">
      {TIERS.map((t) => {
        const list = CONSUMABLES.filter((c) => c.tier === t)
        return (
          <div key={t} className="cp-tier">
            <div className="cp-tier-head" style={{ color: TIER_COLORS[t] }}>◆ {TIER_SHORT[t]}</div>
            {list.length === 0 && <div className="small muted">None yet.</div>}
            {list.map((c) => {
              const art = itemArtSrc({
                name: displayName(c), kind: c.type === 'scroll' ? 'scroll' : 'consumable', tier: c.tier, catalogKey: c.key,
                ...(c.effect.kind === 'heal' ? { heal: c.effect.dice } : {}),
              })
              return (
                <button key={c.key} className="cp-row" style={{ ['--tier' as string]: TIER_COLORS[t] }} onClick={() => onAdd(catalogToItem(c))}>
                  <span className="cp-icon"><ItemArt src={art} fallback={KIND_ICON[c.type === 'scroll' ? 'scroll' : 'consumable']} /></span>
                  <span className="cp-main"><b>{displayName(c)}</b><small>{c.desc}</small></span>
                  <span className="cp-price">{priceLabel ? priceLabel(c.price) : `${c.price}g`}</span>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
