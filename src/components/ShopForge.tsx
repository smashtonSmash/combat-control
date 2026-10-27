import { useEffect, useRef, useState } from 'react'
import type { Character, DamageType, Item } from '../types'
import { ARMOR_CATALOG, TIERS, TIER_COLORS, TIER_SHORT, type Tier } from '../armor'
import { CRAFT_GOLD, KIT_PRICES, UPGRADE_FEES, UPGRADE_MULT, armorPrice, shopPriceSilver } from '../catalog'
import { upgradeFeeFor, upgradeGear, craftGear, craftRepairKit, mergeMats, salvageItem, type CraftChoice } from '../blacksmith'
import { blacksmithRepair, buy, fmtCost, forgeReady } from '../effects'
import { isBroken, missing, repairCost, durOf, maxDur } from '../durability'
import { DurBar } from './DurBar'
import { KIND_ICON, armorItem } from '../inventory'
import { itemArtSrc } from '../itemArt'
import { WEAPON_CATALOG, tieredWeapon, weaponPrice } from '../weapons'
import { SHIELD_CATALOG, shieldItem, shieldPrice, shieldRules } from '../shields'
import { MAT_COLORS, MAT_LABELS, MAT_TIERS, MAT_TO_GEAR, materialTier, matQty, salvageYield, repairKitItem } from '../salvage'
import { allMerchants, favorAdjust, favorFace, favorOf, merchantById, clampFavor, refusesToSell, type Merchant } from '../favor'
import type { RecapKind } from '../recap'
import { ConsumablePicker, ItemArt } from './Items'
import { Segmented, Stepper } from './Sheet'
import { WhoName } from './PlayerName'

type ShopWhat = 'potions' | 'armor' | 'weapons' | 'shields' | 'kits'

/** DM-run Shop (catalog) and Blacksmith (repair, 3→1 upgrade, craft, merge, salvage). */
export function ShopForge({ characters, onSave, onRecap, merchants = [], removedMerchantIds = [], isDM = true }: {
  characters: Character[]
  onSave: (c: Character) => void
  onRecap?: (kind: RecapKind, text: string) => void
  merchants?: Merchant[]
  removedMerchantIds?: string[]
  isDM?: boolean
}) {
  const [tab, setTab] = useState<'shop' | 'forge'>(isDM ? 'shop' : 'forge')
  const [charId, setCharId] = useState(characters[0]?.id ?? '')
  const [adjust, setAdjust] = useState(0)
  const [what, setWhat] = useState<ShopWhat>('potions')
  const [merchantId, setMerchantId] = useState('')
  const [weaponId, setWeaponId] = useState(WEAPON_CATALOG[0].id)
  const [armorId, setArmorId] = useState(ARMOR_CATALOG[0].id)
  const [shieldId, setShieldId] = useState(SHIELD_CATALOG[0].id)
  const [msg, setMsg] = useState('')
  const c = characters.find((x) => x.id === charId) ?? characters[0]
  const merchantList = allMerchants(merchants, removedMerchantIds)
  const merchant = merchantById(merchantId, merchants, removedMerchantIds)
  useEffect(() => {
    if (isDM || !c) return
    if (!merchant) { setAdjust(0); return }
    setAdjust(favorAdjust(favorOf(c, merchant.id), merchant))
  }, [isDM, c, merchant])
  const sell = (item: Item, gold: number) => {
    if (!c) return
    if (merchant && refusesToSell(favorOf(c, merchant.id))) {
      setMsg(`${merchant.name} refuses to sell to ${c.name}. Favor is too low.`)
      return
    }
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
  if (!characters.length || !c) {
    return (
      <div className="panel shopforge" id="shop-forge">
        <div className="row between"><b>🔨 Blacksmith</b><span className="small muted">{isDM ? 'Town · DM' : 'Town'}</span></div>
        <div className="small muted">The blacksmith is here. Add a character to repair, fuse, or buy from the merchants.</div>
      </div>
    )
  }
  return (
    <div className="panel shopforge" id="shop-forge">
      <div className="row between"><b>🏪 Shop & Forge</b><span className="small muted">{isDM ? 'Town · DM' : 'Town'}</span></div>
      <Segmented value={tab} onChange={(v) => { setTab(v); setMsg('') }} options={[{ value: 'shop', label: '🛒 Shop' }, { value: 'forge', label: '🔨 Blacksmith' }]} />
      <div className="chips-row wrap">{characters.map((x) => (
        <button key={x.id} className={'chip ' + (x.id === c.id ? 'on' : '')} onClick={() => { setCharId(x.id); setMsg('') }}><WhoName id={x.id} name={x.name} /> <small>{x.purse?.gold ?? 0}g {x.purse?.silver ?? 0}s</small></button>
      ))}</div>
      {msg && <div className="inv-msg">{msg}</div>}
      {tab === 'shop' && (
        <>
          {isDM && <Stepper label="Price adjust %" value={adjust} min={-90} max={300} step={5} onChange={setAdjust} />}
          {!isDM && <div className="small muted">Prices follow the merchant you pick. The DM sets anything past that.</div>}
          <div className="chips-row wrap">
            <button className={'chip ' + (!merchantId ? 'on' : '')} onClick={() => setMerchantId('')}>List price</button>
            {merchantList.map((m) => {
              const f = favorOf(c, m.id)
              const face = favorFace(f)
              return <button key={m.id} className={'chip ' + (merchantId === m.id ? 'on' : '')} onClick={() => setMerchantId(m.id)}>{face.emoji} {m.name} <small>{f}</small></button>
            })}
          </div>
          {merchant && <div className="small">{merchant.personality} Suggests {favorAdjust(favorOf(c, merchant.id), merchant)}%.{isDM && <> <button className="link" onClick={() => setAdjust(favorAdjust(favorOf(c, merchant.id), merchant))}>Use that discount</button></>}</div>}
          <Segmented value={what} onChange={setWhat} options={[
            { value: 'potions', label: '🧪 Potions' },
            { value: 'armor', label: '🛡 Armor' },
            { value: 'weapons', label: '⚔️ Weapons' },
            { value: 'shields', label: '🛡️ Shields' },
            { value: 'kits', label: '🧰 Kits' },
          ]} />
          {what === 'potions' && <ConsumablePicker priceLabel={(g) => fmtCost(shopPriceSilver(g, adjust))} onAdd={(it) => sell(it, it.price ?? 0)} />}
          {what === 'weapons' && (
            <div className="consumable-picker">
              <div className="chips-row wrap">{WEAPON_CATALOG.map((w) => <button key={w.id} className={'chip ' + (weaponId === w.id ? 'on' : '')} onClick={() => setWeaponId(w.id)}>{w.name} <small>{w.size}</small></button>)}</div>
              {TIERS.map((t) => (
                <button key={t} className="cp-row" style={{ ['--tier' as string]: TIER_COLORS[t] }} onClick={() => sell(tieredWeapon(weaponId, t), weaponPrice(t))}>
                  <span className="cp-icon"><ItemArt src={itemArtSrc({ name: '', kind: 'weapon', weaponId, tier: t })} fallback={KIND_ICON.weapon} /></span><span className="cp-main"><b style={{ color: TIER_COLORS[t] }}>{TIER_SHORT[t]} {WEAPON_CATALOG.find((w) => w.id === weaponId)?.name}</b><small>{WEAPON_CATALOG.find((w) => w.id === weaponId)?.damage} · {WEAPON_CATALOG.find((w) => w.id === weaponId)?.size}</small></span>
                  <span className="cp-price">{fmtCost(shopPriceSilver(weaponPrice(t), adjust))}</span>
                </button>
              ))}
            </div>
          )}
          {what === 'armor' && (
            <div className="consumable-picker">
              {(['light', 'medium', 'heavy'] as const).map((cat) => (
                <div key={cat}>
                  <div className="mini-label">{cat}{cat === 'medium' ? ' ×2 price' : cat === 'heavy' ? ' ×5 price' : ''}</div>
                  <div className="chips-row wrap">{ARMOR_CATALOG.filter((a) => a.category === cat).map((a) => <button key={a.id} className={'chip ' + (armorId === a.id ? 'on' : '')} onClick={() => setArmorId(a.id)}>{a.name}</button>)}</div>
                </div>
              ))}
              {TIERS.map((t) => {
                const def = ARMOR_CATALOG.find((a) => a.id === armorId)
                return (
                  <button key={t} className="cp-row" style={{ ['--tier' as string]: TIER_COLORS[t] }} onClick={() => sell(armorItem(armorId, t), armorPrice(armorId, t))}>
                    <span className="cp-icon"><ItemArt src={itemArtSrc({ name: def?.name ?? '', kind: 'armor', armorId, tier: t })} fallback={KIND_ICON.armor} /></span>
                    <span className="cp-main"><b style={{ color: TIER_COLORS[t] }}>{TIER_SHORT[t]} {def?.name} Armor</b><small>{def?.category} · {def?.focus}</small></span>
                    <span className="cp-price">{fmtCost(shopPriceSilver(armorPrice(armorId, t), adjust))}</span>
                  </button>
                )
              })}
            </div>
          )}
          {what === 'shields' && (
            <div className="consumable-picker">
              <div className="chips-row wrap">{SHIELD_CATALOG.map((s) => <button key={s.id} className={'chip ' + (shieldId === s.id ? 'on' : '')} onClick={() => setShieldId(s.id)}>{s.name}</button>)}</div>
              {TIERS.map((t) => {
                const def = SHIELD_CATALOG.find((s) => s.id === shieldId)!
                return (
                  <button key={t} className="cp-row" style={{ ['--tier' as string]: TIER_COLORS[t] }} onClick={() => sell(shieldItem(shieldId, t), shieldPrice(shieldId, t))}>
                    <span className="cp-icon"><ItemArt src={itemArtSrc({ name: def.name, kind: 'shield', shieldId, tier: t })} fallback={KIND_ICON.shield} /></span>
                    <span className="cp-main"><b style={{ color: TIER_COLORS[t] }}>{TIER_SHORT[t]} {def.name}</b><small>{shieldRules(def, t)[0]}</small></span>
                    <span className="cp-price">{fmtCost(shopPriceSilver(shieldPrice(shieldId, t), adjust))}</span>
                  </button>
                )
              })}
            </div>
          )}
          {what === 'kits' && (
            <div className="consumable-picker">
              <div className="small muted">Kits restore durability. They cannot fix Broken gear.</div>
              {TIERS.map((t) => (
                <button key={t} className="cp-row" style={{ ['--tier' as string]: TIER_COLORS[t] }} onClick={() => sell(repairKitItem(t), KIT_PRICES[t])}>
                  <span className="cp-icon"><ItemArt src={itemArtSrc({ name: `${TIER_SHORT[t]} Repair Kit`, kind: 'consumable', tier: t, kitTier: t })} fallback="🧰" /></span>
                  <span className="cp-main"><b style={{ color: TIER_COLORS[t] }}>{TIER_SHORT[t]} Repair Kit</b></span>
                  <span className="cp-price">{fmtCost(shopPriceSilver(KIT_PRICES[t], adjust))}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {tab === 'forge' && <Blacksmith c={c} onSave={onSave} onRecap={onRecap} onMsg={setMsg} dm={isDM} />}
    </div>
  )
}

type SlotId = 'repair' | 'salvage' | 'u0' | 'u1' | 'u2' | 'c0' | 'c1' | 'c2' | 'c3' | 'g0' | 'g1' | 'g2'

function Blacksmith({ c, onSave, onRecap, onMsg, dm }: {
  c: Character
  onSave: (c: Character) => void
  onRecap?: (kind: RecapKind, text: string) => void
  onMsg: (s: string) => void
  dm: boolean
}) {
  const [slots, setSlots] = useState<Partial<Record<SlotId, string>>>({})
  const [picked, setPicked] = useState<string | null>(null)
  const [craft, setCraft] = useState('armor:padded')
  const [sworn, setSworn] = useState<DamageType>('slashing')
  const [over, setOver] = useState<string | null>(null)
  const drag = useRef<{ id: string; active: boolean } | null>(null)
  const item = (id?: string) => (c.inventory ?? []).find((i) => i.id === id)
  const draggable = (i: Item) => !i.special && (i.kind === 'armor' || i.kind === 'weapon' || i.kind === 'shield' || !!i.materialKey)

  useEffect(() => {
    setSlots((s) => {
      const next = { ...s }
      let changed = false
      for (const [k, id] of Object.entries(next) as [SlotId, string][]) {
        const it = item(id)
        if (!it) { delete next[k]; changed = true }
      }
      return changed ? next : s
    })
  }, [c])

  const countOf = (id: string, except?: SlotId) => Object.entries(slots).filter(([k, v]) => v === id && k !== except).length
  const place = (slot: SlotId, id: string) => {
    const it = item(id)
    if (!it) return
    if (countOf(id, slot) >= it.qty) { onMsg(`Not enough ${it.name} for another slot.`); return }
    setSlots((s) => ({ ...s, [slot]: id }))
  }
  const clear = (slot: SlotId) => setSlots((s) => { const n = { ...s }; delete n[slot]; return n })

  useEffect(() => {
    const move = (ev: PointerEvent) => {
      if (!drag.current?.active) return
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-slot]') as HTMLElement | null
      setOver(el?.dataset.slot ?? null)
    }
    const up = (ev: PointerEvent) => {
      const d = drag.current
      drag.current = null
      document.body.classList.remove('dragging')
      setOver(null)
      if (!d?.active) return
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-slot]') as HTMLElement | null
      if (el?.dataset.slot) place(el.dataset.slot as SlotId, d.id)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  })

  const startDrag = (e: React.PointerEvent, id: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const d = { id, active: false, x: e.clientX, y: e.clientY }
    drag.current = d
    const move = (ev: PointerEvent) => {
      if (drag.current !== d) return
      if (!d.active && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 6) { d.active = true; document.body.classList.add('dragging') }
    }
    const cleanup = () => { window.removeEventListener('pointermove', move) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', cleanup, { once: true })
  }

  const slotView = (id: SlotId, hint: string) => {
    const it = item(slots[id])
    return (
      <button type="button" className={'bs-slot ' + (over === id ? 'over' : '') + (it ? ' filled' : '')} data-slot={id}
        onClick={() => { if (picked) place(id, picked); else if (it) clear(id) }}>
        {it ? <><b>{it.name}</b>{it.tier && maxDur(it) > 0 && <DurBar it={it} small />} <small className="muted">tap to clear</small></> : <span className="muted">{hint}</span>}
      </button>
    )
  }

  const repair = item(slots.repair)
  const salvage = item(slots.salvage)
  const ups = [item(slots.u0), item(slots.u1), item(slots.u2)]
  const upIds = [slots.u0, slots.u1, slots.u2].filter((x): x is string => !!x)
  const upSame = ups.every((x) => x && ups[0] && x.kind === ups[0].kind && x.tier && x.tier === ups[0].tier && (x.armorId ?? x.weaponId ?? x.shieldId) === (ups[0].armorId ?? ups[0].weaponId ?? ups[0].shieldId) && !x.special)
  const upFee = ups[0] ? upgradeFeeFor(ups[0]) : null
  const upNext = ups[0]?.tier ? TIERS[TIERS.indexOf(ups[0].tier) + 1] as Tier | undefined : undefined
  const mats = [slots.c0, slots.c1, slots.c2, slots.c3].map((id) => materialTier(item(id)?.materialKey))
  const matSame = mats.every((t) => t && t === mats[0]) ? mats[0] : undefined
  const craftTier = matSame ? MAT_TO_GEAR[matSame] : undefined
  const merges = [slots.g0, slots.g1, slots.g2].map((id) => materialTier(item(id)?.materialKey))
  const mergeTier = merges.every((t) => t && t === merges[0]) ? merges[0] : undefined
  const needsSwear = (id?: string, tier?: Tier) => !!id && (id === 'plate' || id === 'half-plate') && tier === 'mythic'
  const previewName = () => {
    if (!ups[0] || !upNext || !upSame) return 'Need three of the same type and tier'
    const base = ups[0].armorId ? ARMOR_CATALOG.find((a) => a.id === ups[0]!.armorId)?.name + ' Armor'
      : ups[0].weaponId ? WEAPON_CATALOG.find((w) => w.id === ups[0]!.weaponId)?.name
        : SHIELD_CATALOG.find((s) => s.id === ups[0]!.shieldId)?.name
    return `${TIER_SHORT[upNext]} ${base ?? 'piece'}`
  }
  const yieldText = (it: Item) => {
    if (!it.tier) return ''
    return salvageYield(durOf(it), maxDur(it), it.tier).map((s) => `${s.qty}× ${MAT_LABELS[s.tier]}`).join(' + ')
  }
  const run = (r: { ok: boolean; char: Character; message: string }, kind: RecapKind) => {
    onMsg((r.ok ? '🔨 ' : '⚠ ') + r.message)
    if (!r.ok) return
    onSave(r.char)
    onRecap?.(kind, r.message)
    setSlots({})
  }

  const pack = (c.inventory ?? []).filter(draggable)
  const atForge = (c.inventory ?? []).filter((i) => i.atForge)

  return (
    <div className="blacksmith" id="blacksmith">
      <p className="small muted">Drag a piece onto a slot, or tap it and then tap the slot. Upgrade is three of the same piece. Gray mats only merge.</p>
      <div className="fee-table small">
        {(Object.entries(UPGRADE_FEES) as [Tier, number][]).map(([t, f]) => <span key={t}><b style={{ color: TIER_COLORS[t] }}>{TIER_SHORT[t]}</b>→{TIER_SHORT[TIERS[TIERS.indexOf(t) + 1]]} {f}g <small>med ×{UPGRADE_MULT.medium} heavy ×{UPGRADE_MULT.heavy}</small></span>)}
      </div>
      <div className="mini-label">Pack — tap to pick, or drag</div>
      <div className="chips-row wrap">
        {pack.length === 0 && <span className="small muted">No armor, weapons, shields, or materials in this pack.</span>}
        {pack.map((i) => (
          <button key={i.id} type="button" className={'chip ' + (picked === i.id ? 'on' : '')}
            onPointerDown={(e) => startDrag(e, i.id)} onClick={() => setPicked(picked === i.id ? null : i.id)}>
            {i.name}{i.qty > 1 ? ` ×${i.qty}` : ''}
          </button>
        ))}
      </div>

      <h4 className="forge-h">🛠 Repair</h4>
      <div className="bs-row">{slotView('repair', 'Drop armor, weapon, or shield')}</div>
      {repair && maxDur(repair) > 0 && (
        <div className="fuse-row">
          <span>{repair.name} <DurBar it={repair} /> {isBroken(repair) && <b className="bad">Broken ×2</b>} · {missing(repair)} missing</span>
          <button className="btn sm primary" disabled={!missing(repair)} onClick={() => {
            const r = blacksmithRepair(c, repair.id, 'full')
            onMsg((r.ok ? '🛠 ' : '⚠ ') + r.message)
            if (r.ok) { onSave(r.char); onRecap?.('repair', r.message) }
          }}>{missing(repair) ? `Full · ${repairCost(repair, missing(repair))}g` : 'Full'}</button>
        </div>
      )}

      <h4 className="forge-h">⬆ Upgrade 3 → 1</h4>
      <div className="bs-upgrade">
        <div className="bs-row">{slotView('u0', '1') }{slotView('u1', '2')}{slotView('u2', '3')}</div>
        <div className="bs-arrow">→</div>
        <div className="bs-preview">
          <b>{previewName()}</b>
          {upSame && upFee != null && upNext && <div className="small">{upFee}g{needsSwear(ups[0]?.armorId, upNext) && ' · swear a type'}</div>}
        </div>
      </div>
      {upSame && upNext && needsSwear(ups[0]?.armorId, upNext) && (
        <div className="chips-row wrap">{(['bludgeoning', 'piercing', 'slashing'] as DamageType[]).map((t) => (
          <button key={t} className={'chip ' + (sworn === t ? 'on' : '')} onClick={() => setSworn(t)}>{t}</button>
        ))}</div>
      )}
      <button className="btn sm primary" disabled={!upSame || upIds.length !== 3 || !upNext || upFee == null} onClick={() => run(upgradeGear(c, upIds, sworn), 'spend')}>
        Take{upFee != null && upSame ? ` · ${upFee}g` : ''}
      </button>

      <h4 className="forge-h">✨ Craft from materials</h4>
      <div className="bs-row">{slotView('c0', 'Mat')}{slotView('c1', 'Mat')}{slotView('c2', 'Mat')}{slotView('c3', 'Mat')}</div>
      {matSame === 'gray' && <div className="small muted">Gray is merge-only. It does not craft gear.</div>}
      {craftTier && matSame && (
        <>
          <div className="row">
            <select aria-label="Craft item" value={craft} onChange={(e) => setCraft(e.target.value)}>
              <optgroup label="Armor">{ARMOR_CATALOG.map((a) => <option key={a.id} value={`armor:${a.id}`}>{a.name} Armor</option>)}</optgroup>
              <optgroup label="Weapons">{WEAPON_CATALOG.map((w) => <option key={w.id} value={`weapon:${w.id}`}>{w.name}</option>)}</optgroup>
              <optgroup label="Shields">{SHIELD_CATALOG.map((s) => <option key={s.id} value={`shield:${s.id}`}>{s.name}</option>)}</optgroup>
            </select>
            <b>{CRAFT_GOLD[craftTier]}g</b>
          </div>
          {(craft.startsWith('armor:plate') || craft.startsWith('armor:half-plate')) && craftTier === 'mythic' && (
            <div className="chips-row wrap">{(['bludgeoning', 'piercing', 'slashing'] as DamageType[]).map((t) => (
              <button key={t} className={'chip ' + (sworn === t ? 'on' : '')} onClick={() => setSworn(t)}>Swear {t}</button>
            ))}</div>
          )}
          <button className="btn sm primary" onClick={() => {
            const [kind, id] = craft.split(':') as [CraftChoice['kind'], string]
            run(craftGear(c, matSame, { kind, id }, sworn), 'craft')
          }}>Craft · {CRAFT_GOLD[craftTier]}g</button>
        </>
      )}
      <div className="small muted">Repair kits are two mats, not four. No gold.</div>
      <div className="chips-row wrap">
        {MAT_TIERS.filter((t) => t !== 'gray' && matQty(c, t) >= 2).map((t) => (
          <button key={t} className="btn sm" onClick={() => run(craftRepairKit(c, t), 'craft')}>Kit from 2 {MAT_LABELS[t]}</button>
        ))}
      </div>

      <h4 className="forge-h">🔗 Merge materials 3 → 1</h4>
      <div className="bs-row">{slotView('g0', 'Mat')}{slotView('g1', 'Mat')}{slotView('g2', 'Mat')}</div>
      <button className="btn sm primary" disabled={!mergeTier || !MAT_TIERS[MAT_TIERS.indexOf(mergeTier) + 1]} onClick={() => mergeTier && run(mergeMats(c, mergeTier), 'craft')}>
        Merge{mergeTier ? ` → ${MAT_LABELS[MAT_TIERS[MAT_TIERS.indexOf(mergeTier) + 1] ?? 'red'] ?? '—'} · 1s` : ''}
      </button>

      <h4 className="forge-h">🪓 Salvage</h4>
      <div className="bs-row">{slotView('salvage', 'Drop armor, weapon, or shield')}</div>
      {salvage && salvage.tier && (salvage.kind === 'armor' || salvage.kind === 'weapon' || salvage.kind === 'shield') && (
        <div className="fuse-row">
          <span>{yieldText(salvage) || 'Nothing'}</span>
          <button className="btn sm" onClick={() => run(salvageItem(c, salvage.id), 'salvage')}>Break down</button>
        </div>
      )}

      {atForge.length > 0 && <h4 className="forge-h">At the forge</h4>}
      {atForge.map((i) => (
        <div key={i.id} className="fuse-row"><span>🔥 {i.name}</span>
          {dm && <button className="btn sm" onClick={() => { onSave(forgeReady(c, i.id)); onMsg(`✅ ${i.name} is ready.`) }}>Ready</button>}</div>
      ))}
      <div className="small muted">Mat colors: {MAT_TIERS.map((t) => <b key={t} style={{ color: MAT_COLORS[t] }}>{MAT_LABELS[t]} </b>)}. Craft gold is {TIERS.map((t) => `${TIER_SHORT[t]} ${CRAFT_GOLD[t]}g`).join(', ')}.</div>
    </div>
  )
}
