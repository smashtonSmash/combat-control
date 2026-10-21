import { useState } from 'react'
import type { DamageType, Item, ItemKind } from '../types'
import { DAMAGE_TYPES, uid } from '../types'
import { ARMOR_CATALOG, TIERS, TIER_COLORS, TIER_SHORT, type Tier } from '../armor'
import { COMMON_WEAPONS, KIND_ICON, armorItem, potionOfHealing, weaponItem } from '../inventory'

export function ItemCard({ it, selected, onClick, onPointerDown, dragging }: {
  it: Item; selected?: boolean; onClick?: () => void; onPointerDown?: (e: React.PointerEvent) => void; dragging?: boolean
}) {
  const color = it.tier ? TIER_COLORS[it.tier] : undefined
  return (
    <button type="button" className={`item-card ${it.equipped ? 'equipped' : ''} ${selected ? 'selected' : ''} ${dragging ? 'lifted' : ''}`}
      style={color ? { borderColor: color, boxShadow: `0 0 10px ${color}55` } : undefined}
      onClick={onClick} onPointerDown={onPointerDown} onContextMenu={(e) => e.preventDefault()}>
      {it.equipped && <span className="eq-ribbon">EQUIPPED</span>}
      <span className="item-icon">{KIND_ICON[it.kind]}</span>
      <span className="item-name">{it.name}</span>
      <small className="item-sub">{it.kind === 'weapon' ? `${it.damage} ${it.damageType}` : it.heal ? `heals ${it.heal}` : it.tier ? <span style={{ color }}>◆ {TIER_SHORT[it.tier]}</span> : it.kind}</small>
      {it.qty > 1 && <span className="qty">×{it.qty}</span>}
    </button>
  )
}

/** Quick picks + custom item form. */
export function ItemPicker({ onAdd }: { onAdd: (it: Item) => void }) {
  const [armorId, setArmorId] = useState(ARMOR_CATALOG[0].id)
  const [tier, setTier] = useState<Tier>('green')
  const [custom, setCustom] = useState<{ name: string; kind: ItemKind; qty: number; description: string; damage: string; damageType: DamageType; heal: string }>(
    { name: '', kind: 'misc', qty: 1, description: '', damage: '1d6', damageType: 'slashing', heal: '' })
  const [open, setOpen] = useState<'quick' | 'custom'>('quick')
  return (
    <div className="item-picker">
      <div className="segmented">
        <button type="button" className={open === 'quick' ? 'on' : ''} onClick={() => setOpen('quick')}>Quick picks</button>
        <button type="button" className={open === 'custom' ? 'on' : ''} onClick={() => setOpen('custom')}>Custom item</button>
      </div>
      {open === 'quick' ? (
        <>
          <button className="btn sm" onClick={() => onAdd(potionOfHealing())}>🧪 + Potion of Healing (2d4+2)</button>
          <div className="mini-label">Armor</div>
          <div className="chips-row wrap">{ARMOR_CATALOG.map((a) => <button key={a.id} className={'chip ' + (armorId === a.id ? 'on' : '')} onClick={() => setArmorId(a.id)}>{a.name}</button>)}</div>
          <div className="chips-row wrap">{TIERS.map((t) => <button key={t} className={'chip ' + (tier === t ? 'on' : '')} style={{ color: TIER_COLORS[t] }} onClick={() => setTier(t)}>◆ {TIER_SHORT[t]}</button>)}</div>
          <button className="btn sm" onClick={() => onAdd(armorItem(armorId, tier))}>🛡 + {TIER_SHORT[tier]} {ARMOR_CATALOG.find((a) => a.id === armorId)?.name} Armor</button>
          <div className="mini-label">Weapons</div>
          <div className="chips-row wrap">{COMMON_WEAPONS.map((w) => <button key={w.name} className="chip" onClick={() => onAdd(weaponItem(w))}>+ {w.name} <small>{w.damage}</small></button>)}</div>
        </>
      ) : (
        <>
          <div className="row">
            <input className="grow" placeholder="Item name" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
            <input style={{ width: 56 }} inputMode="numeric" value={String(custom.qty)} onChange={(e) => setCustom({ ...custom, qty: Math.max(1, parseInt(e.target.value) || 1) })} />
          </div>
          <div className="chips-row wrap">{(['misc', 'consumable', 'weapon'] as ItemKind[]).map((k) => <button key={k} className={'chip ' + (custom.kind === k ? 'on' : '')} onClick={() => setCustom({ ...custom, kind: k })}>{KIND_ICON[k]} {k}</button>)}</div>
          {custom.kind === 'weapon' && (
            <div className="row">
              <input style={{ width: 80 }} value={custom.damage} onChange={(e) => setCustom({ ...custom, damage: e.target.value })} placeholder="1d8" />
              <select value={custom.damageType} onChange={(e) => setCustom({ ...custom, damageType: e.target.value as DamageType })}>{DAMAGE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
          )}
          {custom.kind === 'consumable' && <input placeholder="Heals (dice, optional) e.g. 4d4+4" value={custom.heal} onChange={(e) => setCustom({ ...custom, heal: e.target.value })} />}
          <textarea rows={2} placeholder="Description" value={custom.description} onChange={(e) => setCustom({ ...custom, description: e.target.value })} />
          <button className="btn sm primary" disabled={!custom.name.trim()} onClick={() => {
            onAdd({ id: uid(), name: custom.name.trim(), kind: custom.kind, qty: custom.qty, description: custom.description,
              ...(custom.kind === 'weapon' ? { damage: custom.damage, damageType: custom.damageType } : {}),
              ...(custom.kind === 'consumable' && custom.heal.trim() ? { heal: custom.heal.trim() } : {}) })
            setCustom({ ...custom, name: '', description: '', qty: 1 })
          }}>+ Add {custom.name || 'item'}</button>
        </>
      )}
    </div>
  )
}
