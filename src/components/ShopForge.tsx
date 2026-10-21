import { useState } from 'react'
import type { Character, Item } from '../types'
import { ARMOR_CATALOG, TIERS, TIER_COLORS, TIER_SHORT, type Tier } from '../armor'
import { FUSE_FEES, FUSE_NOTE, armorPrice, shopPriceSilver } from '../catalog'
import { buy, fmtCost, forgeReady, fuse, fuseGroups } from '../effects'
import { armorItem } from '../inventory'
import { ConsumablePicker } from './Items'
import { Segmented, Stepper } from './Sheet'

/** DM-run Shop (sell catalog items to a character) and Blacksmith (fuse two matching armors + fee → next tier). */
export function ShopForge({ characters, onSave }: { characters: Character[]; onSave: (c: Character) => void }) {
  const [tab, setTab] = useState<'shop' | 'forge'>('shop')
  const [charId, setCharId] = useState(characters[0]?.id ?? '')
  const [adjust, setAdjust] = useState(0)
  const [what, setWhat] = useState<'potions' | 'armor'>('potions')
  const [armorId, setArmorId] = useState(ARMOR_CATALOG[0].id)
  const [atForge, setAtForge] = useState(true)
  const [msg, setMsg] = useState('')
  const c = characters.find((x) => x.id === charId)
  const sell = (item: Item, gold: number) => {
    if (!c) return
    const r = buy(c, item, shopPriceSilver(gold, adjust)); setMsg((r.ok ? '🛒 ' : '⚠ ') + r.message); if (r.ok) onSave(r.char)
  }
  if (!characters.length) return null
  return (
    <div className="panel shopforge">
      <div className="row between"><b>🏪 Shop & Forge</b><span className="small muted">DM</span></div>
      <Segmented value={tab} onChange={(v) => { setTab(v); setMsg('') }} options={[{ value: 'shop', label: '🛒 Shop' }, { value: 'forge', label: '🔨 Blacksmith' }]} />
      <div className="chips-row wrap">{characters.map((x) => (
        <button key={x.id} className={'chip ' + (x.id === charId ? 'on' : '')} onClick={() => { setCharId(x.id); setMsg('') }}>{x.name} <small>{x.purse?.gold ?? 0}g {x.purse?.silver ?? 0}s</small></button>
      ))}</div>
      {msg && <div className="inv-msg">{msg}</div>}
      {c && tab === 'shop' && (
        <>
          <Stepper label="Price adjust %" value={adjust} min={-90} max={300} step={5} onChange={setAdjust} />
          <Segmented value={what} onChange={setWhat} options={[{ value: 'potions', label: '🧪 Potions & Scrolls' }, { value: 'armor', label: '🛡 Armor' }]} />
          {what === 'potions'
            ? <ConsumablePicker priceLabel={(g) => fmtCost(shopPriceSilver(g, adjust))} onAdd={(it) => sell(it, it.price ?? 0)} />
            : (
              <div className="consumable-picker">
                <div className="chips-row wrap">{ARMOR_CATALOG.map((a) => <button key={a.id} className={'chip ' + (armorId === a.id ? 'on' : '')} onClick={() => setArmorId(a.id)}>{a.name}</button>)}</div>
                {TIERS.map((t) => (
                  <button key={t} className="cp-row" style={{ ['--tier' as string]: TIER_COLORS[t] }} onClick={() => sell(armorItem(armorId, t), armorPrice(armorId, t))}>
                    <span className="cp-icon">🛡</span><span className="cp-main"><b style={{ color: TIER_COLORS[t] }}>{TIER_SHORT[t]} {ARMOR_CATALOG.find((a) => a.id === armorId)?.name} Armor</b></span>
                    <span className="cp-price">{fmtCost(shopPriceSilver(armorPrice(armorId, t), adjust))}</span>
                  </button>
                ))}
              </div>
            )}
        </>
      )}
      {c && tab === 'forge' && (
        <>
          <div className="small muted">Two armors of the same type and tier + the fee → one of the next tier. {FUSE_NOTE}</div>
          <div className="fee-table small">{(Object.entries(FUSE_FEES) as [Tier, number][]).map(([t, f]) => <span key={t}><b style={{ color: TIER_COLORS[t] }}>{TIER_SHORT[t]}</b>→{TIER_SHORT[TIERS[TIERS.indexOf(t) + 1]]} {f}g</span>)}</div>
          <label className="row small"><input type="checkbox" checked={atForge} onChange={(e) => setAtForge(e.target.checked)} /> Mark new armor “at the forge” until I tap Ready</label>
          {fuseGroups(c).filter((g) => g.items.length >= 2).length === 0 && <div className="small muted">{c.name} has no matching pair of armors to fuse.</div>}
          {fuseGroups(c).filter((g) => g.items.length >= 2).map((g) => {
            const a = ARMOR_CATALOG.find((x) => x.id === g.armorId)!
            return (
              <div key={g.armorId + g.tier} className="fuse-row">
                <span>2× <b style={{ color: TIER_COLORS[g.tier] }}>{TIER_SHORT[g.tier]} {a.name}</b> → {g.next ? <b style={{ color: TIER_COLORS[g.next] }}>{TIER_SHORT[g.next]}</b> : '—'}</span>
                <button className="btn sm primary" disabled={!g.next} onClick={() => { const r = fuse(c, g.armorId, g.tier, { atForge }); setMsg((r.ok ? '🔨 ' : '⚠ ') + r.message); if (r.ok) onSave(r.char) }}>
                  {g.next ? `Fuse · ${g.fee}g` : 'Max tier'}</button>
              </div>
            )
          })}
          {(c.inventory ?? []).filter((i) => i.atForge).map((i) => (
            <div key={i.id} className="fuse-row"><span>🔥 {i.name} <small className="muted">at the forge</small></span>
              <button className="btn sm" onClick={() => { onSave(forgeReady(c, i.id)); setMsg(`✅ ${i.name} is ready for ${c.name}.`) }}>Ready</button></div>
          ))}
        </>
      )}
    </div>
  )
}
