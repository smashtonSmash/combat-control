import { useState } from 'react'
import type { Character, Item } from '../types'
import { ARMOR_CATALOG, TIERS, TIER_COLORS, TIER_SHORT, type Tier } from '../armor'
import { FUSE_FEES, FUSE_NOTE, armorPrice, shopPriceSilver } from '../catalog'
import { blacksmithRepair, buy, fmtCost, forgeReady, fuse, fuseGroups, fuseWeapon, salvageArmor, weaponFuseGroups } from '../effects'
import { BROKEN_REPAIR_MULT, REPAIR_COST_PER_POINT } from '../catalog'
import { isBroken, missing, repairCost } from '../durability'
import { DurBar } from './DurBar'
import { armorItem } from '../inventory'
import { WEAPON_CATALOG, tieredWeapon, weaponPrice } from '../weapons'
import { favorAdjust, favorFace, favorOf, MERCHANTS, merchantById, clampFavor } from '../favor'
import type { RecapKind } from '../recap'
import { ConsumablePicker } from './Items'
import { Segmented, Stepper } from './Sheet'

/** DM-run Shop (sell catalog items to a character) and Blacksmith (fuse two matching armors + fee → next tier). */
export function ShopForge({ characters, onSave, onRecap }: { characters: Character[]; onSave: (c: Character) => void; onRecap?: (kind: RecapKind, text: string) => void }) {
  const [tab, setTab] = useState<'shop' | 'forge'>('shop')
  const [charId, setCharId] = useState(characters[0]?.id ?? '')
  const [adjust, setAdjust] = useState(0)
  const [what, setWhat] = useState<'potions' | 'armor' | 'weapons'>('potions')
  const [merchantId, setMerchantId] = useState('')
  const [weaponId, setWeaponId] = useState(WEAPON_CATALOG[0].id)
  const [armorId, setArmorId] = useState(ARMOR_CATALOG[0].id)
  const [atForge, setAtForge] = useState(true)
  const [msg, setMsg] = useState('')
  const [repairPts, setRepairPts] = useState<Record<string, number>>({})
  const c = characters.find((x) => x.id === charId)
  const merchant = merchantById(merchantId)
  const sell = (item: Item, gold: number) => {
    if (!c) return
    const r = buy(c, item, shopPriceSilver(gold, adjust))
    setMsg((r.ok ? '🛒 ' : '⚠ ') + r.message)
    if (!r.ok) return
    let next = r.char
    if (merchant) {
      const favor = clampFavor(favorOf(next, merchant.id) + 2)
      next = { ...next, favor: { ...next.favor, [merchant.id]: favor } }
      setMsg(`🛒 ${r.message} Favor with ${merchant.name} is now ${favor}.`)
    }
    onSave(next)
    onRecap?.('spend', r.message)
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
          <div className="chips-row wrap">
            <button className={'chip ' + (!merchantId ? 'on' : '')} onClick={() => setMerchantId('')}>List price</button>
            {MERCHANTS.map((m) => {
              const f = favorOf(c, m.id)
              const face = favorFace(f)
              return <button key={m.id} className={'chip ' + (merchantId === m.id ? 'on' : '')} onClick={() => setMerchantId(m.id)}>{face.emoji} {m.name} <small>{f}</small></button>
            })}
          </div>
          {merchant && <div className="small">{merchant.personality} Suggests {favorAdjust(favorOf(c, merchant.id), merchant)}%. <button className="link" onClick={() => setAdjust(favorAdjust(favorOf(c, merchant.id), merchant))}>Use that discount</button></div>}
          <Segmented value={what} onChange={setWhat} options={[{ value: 'potions', label: '🧪 Potions & Scrolls' }, { value: 'armor', label: '🛡 Armor' }, { value: 'weapons', label: '⚔️ Weapons' }]} />
          {what === 'potions'
            ? <ConsumablePicker priceLabel={(g) => fmtCost(shopPriceSilver(g, adjust))} onAdd={(it) => sell(it, it.price ?? 0)} />
            : what === 'weapons' ? (
              <div className="consumable-picker">
                <div className="chips-row wrap">{WEAPON_CATALOG.map((w) => <button key={w.id} className={'chip ' + (weaponId === w.id ? 'on' : '')} onClick={() => setWeaponId(w.id)}>{w.name} <small>{w.slots === 2 ? '2 slots' : '1 slot'}</small></button>)}</div>
                {TIERS.map((t) => (
                  <button key={t} className="cp-row" style={{ ['--tier' as string]: TIER_COLORS[t] }} onClick={() => sell(tieredWeapon(weaponId, t), weaponPrice(t))}>
                    <span className="cp-icon">⚔️</span><span className="cp-main"><b style={{ color: TIER_COLORS[t] }}>{TIER_SHORT[t]} {WEAPON_CATALOG.find((w) => w.id === weaponId)?.name}</b></span>
                    <span className="cp-price">{fmtCost(shopPriceSilver(weaponPrice(t), adjust))}</span>
                  </button>
                ))}
              </div>
            ) : (
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
          <label className="row small"><input type="checkbox" checked={atForge} onChange={(e) => setAtForge(e.target.checked)} /> Mark the new piece “at the forge” until I tap Ready</label>
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
          <h4 className="forge-h">⚔️ Fuse weapons</h4>
          <div className="small muted">Same ladder and the same fees as armor. Mythic does not fuse. Pink and black pieces are not on this ladder.</div>
          {weaponFuseGroups(c).filter((g) => g.items.length >= 2).length === 0 && <div className="small muted">{c.name} has no matching pair of weapons to fuse.</div>}
          {weaponFuseGroups(c).filter((g) => g.items.length >= 2).map((g) => {
            const w = WEAPON_CATALOG.find((x) => x.id === g.weaponId)
            return (
              <div key={g.weaponId + g.tier} className="fuse-row">
                <span>2× <b style={{ color: TIER_COLORS[g.tier] }}>{TIER_SHORT[g.tier]} {w?.name}</b> → {g.next ? <b style={{ color: TIER_COLORS[g.next] }}>{TIER_SHORT[g.next]}</b> : '—'}</span>
                <button className="btn sm primary" disabled={!g.next} onClick={() => { const r = fuseWeapon(c, g.weaponId, g.tier, { atForge }); setMsg((r.ok ? '🔨 ' : '⚠ ') + r.message); if (r.ok) { onSave(r.char); onRecap?.('spend', r.message) } }}>
                  {g.next ? `Fuse · ${g.fee}g` : 'Max tier'}</button>
              </div>
            )
          })}
          <h4 className="forge-h">🪓 Salvage armor</h4>
          <div className="small muted">Broken armor, or armor the player marked for salvage. Parts are a PLACEHOLDER recipe (two of them craft a kit). The coin refund is small on purpose.</div>
          {(c.inventory ?? []).filter((i) => i.kind === 'armor' && i.tier && (isBroken(i) || i.salvaged)).length === 0 && <div className="small muted">Nothing waiting to be salvaged.</div>}
          {(c.inventory ?? []).filter((i) => i.kind === 'armor' && i.tier && (isBroken(i) || i.salvaged)).map((i) => (
            <div key={i.id} className="fuse-row">
              <span>{i.name} {i.salvaged && !isBroken(i) && <small className="muted">marked</small>} {isBroken(i) && <b className="bad">Broken</b>}</span>
              <span className="row">
                <button className="btn sm" onClick={() => { const r = salvageArmor(c, i.id, 'materials'); setMsg((r.ok ? '🪓 ' : '⚠ ') + r.message); if (r.ok) { onSave(r.char); onRecap?.('salvage', r.message) } }}>Take parts</button>
                <button className="btn sm" onClick={() => { const r = salvageArmor(c, i.id, 'coins'); setMsg((r.ok ? '🪙 ' : '⚠ ') + r.message); if (r.ok) { onSave(r.char); onRecap?.('salvage', r.message) } }}>Take coins</button>
              </span>
            </div>
          ))}
          <h4 className="forge-h">🛠 Repair gear</h4>
          <div className="fee-table small">{(Object.entries(REPAIR_COST_PER_POINT) as [Tier, number][]).map(([t, f]) => <span key={t}><b style={{ color: TIER_COLORS[t] }}>{TIER_SHORT[t]}</b> {f}g/pt</span>)}<span>Broken ×{BROKEN_REPAIR_MULT}</span></div>
          {(c.inventory ?? []).filter((i) => (i.kind === 'armor' || i.kind === 'weapon') && i.tier && !i.special && missing(i) > 0).length === 0 && <div className="small muted">{c.name}'s gear is all at full durability.</div>}
          {(c.inventory ?? []).filter((i) => (i.kind === 'armor' || i.kind === 'weapon') && i.tier && !i.special && missing(i) > 0).map((i) => {
            const pts = Math.min(missing(i), repairPts[i.id] ?? missing(i))
            return (
              <div key={i.id} className="fuse-row repair-row">
                <span>{i.name} <DurBar it={i} small /> {isBroken(i) && <b className="bad">Broken</b>}</span>
                <span className="row">
                  <input className="num-in" type="number" min={1} max={missing(i)} value={pts} aria-label="Points" onChange={(e) => setRepairPts({ ...repairPts, [i.id]: Math.max(1, Math.min(missing(i), +e.target.value || 1)) })} />
                  <button className="btn sm primary" onClick={() => { const r = blacksmithRepair(c, i.id, pts); setMsg((r.ok ? '🛠 ' : '⚠ ') + r.message); if (r.ok) { onSave(r.char); onRecap?.('repair', r.message) } }}>+{pts} · {repairCost(i, pts)}g</button>
                  <button className="btn sm" onClick={() => { const r = blacksmithRepair(c, i.id, 'full'); setMsg((r.ok ? '🛠 ' : '⚠ ') + r.message); if (r.ok) { onSave(r.char); onRecap?.('repair', r.message) } }}>Full · {repairCost(i, missing(i))}g</button>
                </span>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
