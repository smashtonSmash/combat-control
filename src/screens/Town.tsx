import { useState } from 'react'
import type { Character } from '../types'
import { uid } from '../types'
import { currentPlace, defaultTown, fountainReward, goldLabelFromSilver, offerToFountain, type TownState } from '../fountain'
import { FAVOR_MIN, FAVOR_MAX, MERCHANT_TRADES, allMerchants, favorAdjust, favorFace, favorOf, MERCHANTS, merchantById, merchantFromTrade, clampFavor, refusesToSell } from '../favor'
import { shopPriceSilver } from '../catalog'
import { fmtCost } from '../effects'
import { fromSilver, purseSilver } from '../party'
import { addItem } from '../inventory'
import { Stepper } from '../components/Sheet'
import { WhoName, usePlayerDirectory } from '../components/PlayerName'
import { withPlayer } from '../playerLabel'
import type { RecapKind } from '../recap'

export default function Town({ characters, town, onTown, onSave, isDM, onRecap }: {
  characters: Character[]
  town: TownState
  onTown: (t: TownState) => void
  onSave: (c: Character) => void
  isDM: boolean
  onRecap?: (kind: RecapKind, text: string) => void
}) {
  const place = currentPlace(town) ?? defaultTown().places[0]
  const [charId, setCharId] = useState(characters[0]?.id ?? '')
  const [gold, setGold] = useState(1)
  const [silver, setSilver] = useState(0)
  const [merchantId, setMerchantId] = useState(MERCHANTS[0].id)
  const [msg, setMsg] = useState('')
  const [townName, setTownName] = useState('')
  const [mName, setMName] = useState('')
  const [trade, setTrade] = useState<string>(MERCHANT_TRADES[0])
  const [customTrade, setCustomTrade] = useState('')
  const dir = usePlayerDirectory()
  const c = characters.find((x) => x.id === charId)
  const who = c ? withPlayer(c.name, dir.label[c.id]) : ''
  const extras = town.merchants ?? []
  const merchantList = allMerchants(extras)
  const merchant = merchantById(merchantId, extras) ?? merchantList[0]
  const favor = c ? favorOf(c, merchant.id) : 0
  const face = favorFace(favor)
  const adjust = favorAdjust(favor, merchant)

  const offer = () => {
    if (!c) return
    if (!place.hasFountain) return setMsg('No wishing fountain in this town.')
    const silverIn = gold * 10 + silver
    if (silverIn <= 0) return setMsg('Offer some coin.')
    if (purseSilver(c.purse) < silverIn) return setMsg(`${who} doesn’t have that much.`)
    const result = offerToFountain(town.fountain, silverIn)
    let next: Character = { ...c, purse: fromSilver(purseSilver(c.purse) - silverIn) }
    let note = `${who} offers ${gold}g ${silver}s. The fountain holds ${goldLabelFromSilver(result.state.contributedSilver || 0)}.`
    if (result.granted && result.rewardNote) {
      next = addItem(next, fountainReward())
      note = `${who} offers ${gold}g ${silver}s. ${result.rewardNote}`
      onRecap?.('fountain', note)
    }
    onSave(next)
    onTown({ ...town, fountain: result.state })
    setMsg(note)
  }

  const setFavor = (n: number) => {
    if (!c) return
    const v = clampFavor(n)
    onSave({ ...c, favor: { ...c.favor, [merchant.id]: v } })
  }
  const addMerchant = () => {
    const label = trade === 'Custom' ? customTrade.trim() : trade
    if (!mName.trim() || !label) return
    const m = merchantFromTrade(mName, label, uid())
    onTown({ ...town, merchants: [...extras, m] })
    setMerchantId(m.id)
    setMName('')
    setCustomTrade('')
  }
  const neg = favor < 0
  const pos = favor > 0
  const span = (FAVOR_MAX - FAVOR_MIN) || 1

  return (
    <div className="screen">
      <div className="screen-head"><h1>⛲ Town</h1></div>
      <div className="panel">
        <div className="row between"><b>{place.name}</b>{place.hasFountain ? <span className="small">Fountain here</span> : <span className="small muted">No fountain</span>}</div>
        <div className="chips-row wrap">
          {town.places.map((p) => (
            <button key={p.id} className={'chip ' + (p.id === town.currentId ? 'on' : '')} onClick={() => onTown({ ...town, currentId: p.id })}>
              {p.name}{p.hasFountain ? ' ⛲' : ''}
            </button>
          ))}
        </div>
        {isDM && (
          <>
            <div className="row">
              <input className="grow" placeholder="New town name" value={townName} onChange={(e) => setTownName(e.target.value)} />
              <button className="btn sm" disabled={!townName.trim()} onClick={() => {
                const id = uid()
                onTown({ ...town, currentId: id, places: [...town.places, { id, name: townName.trim(), hasFountain: false }] })
                setTownName('')
              }}>Add town</button>
            </div>
            <label className="row small">
              <input type="checkbox" checked={place.hasFountain} onChange={(e) => onTown({ ...town, places: town.places.map((p) => p.id === place.id ? { ...p, hasFountain: e.target.checked } : p) })} />
              This town has a wishing fountain
            </label>
          </>
        )}
      </div>

      <div className="panel">
        <div className="row between"><b>Wishing fountain</b><span className="small muted">Gold & silver only</span></div>
        {!place.hasFountain && <div className="empty">No fountain in {place.name}. {isDM ? 'Turn the town flag on when the party finds one.' : 'The DM marks towns that have one.'}</div>}
        {place.hasFountain && (
          <>
            <p className="small">Throw coins in. The fountain decides its price in secret each time it resets — one of 10, 50, 100, or 200 gold — so a fixed number can’t be farmed. The whole offering is kept.</p>
            <div className="fountain-pool">Offered this pool: <b>{goldLabelFromSilver(town.fountain.contributedSilver)}</b></div>
            {isDM && (
              <details className="small muted">
                <summary>DM peek (keep this off the table)</summary>
                {town.fountain.thresholdGold == null
                  ? <div>Not chosen yet. The fountain picks when the first coin of this pool lands.</div>
                  : <div>Secret threshold: <b>{town.fountain.thresholdGold} gold</b>.</div>}
              </details>
            )}
            <div className="chips-row wrap">{characters.map((x) => (
              <button key={x.id} className={'chip ' + (x.id === charId ? 'on' : '')} onClick={() => setCharId(x.id)}><WhoName id={x.id} name={x.name} /> <small>{x.purse?.gold ?? 0}g</small></button>
            ))}</div>
            <div className="row">
              <Stepper label="Gold" value={gold} min={0} max={9999} onChange={setGold} />
              <Stepper label="Silver" value={silver} min={0} max={99} onChange={setSilver} />
            </div>
            <button className="btn primary" disabled={!c || !isDM} onClick={offer}>Offer {gold}g {silver}s</button>
            {!isDM && <div className="small muted">The DM records offerings here so the secret pool stays on one sheet. Favor still lives on your character.</div>}
          </>
        )}
        {msg && <div className="inv-msg">{msg}</div>}
      </div>

      <div className="panel">
        <div className="row between"><b>Merchants</b><span className="face" title={face.label}>{face.emoji} {face.label}</span></div>
        <div className="small muted">Favor starts at 0 in the center. Left is colder, right is warmer. Low enough, they refuse to sell. Each merchant still haggles from their own markup. The percent math is a placeholder.</div>
        <div className="chips-row wrap">{merchantList.map((m) => (
          <button key={m.id} className={'chip ' + (m.id === merchant.id ? 'on' : '')} onClick={() => setMerchantId(m.id)}>{m.name}{m.trade ? <small> {m.trade}</small> : null}</button>
        ))}</div>
        <p className="small"><b>{merchant.name}</b>{merchant.trade ? ` · ${merchant.trade}` : ''} — {merchant.personality}</p>
        {c && (
          <>
            <div className="favor-bar" aria-label={`Favor ${favor} from ${FAVOR_MIN} to ${FAVOR_MAX}`}>
              <span className="favor-axis" />
              {neg && <i className="neg" style={{ width: `${(Math.abs(favor) / span) * 100}%` }} />}
              {pos && <i className="pos" style={{ width: `${(favor / span) * 100}%` }} />}
              <em>{favor > 0 ? `+${favor}` : favor}</em>
            </div>
            <div className="favor-scale small muted"><span>{FAVOR_MIN}</span><span>0</span><span>+{FAVOR_MAX}</span></div>
            {refusesToSell(favor)
              ? <div className="small warn">{merchant.name} refuses to sell to {who}. Favor is too low.</div>
              : <div className="small">A 10g item is {fmtCost(shopPriceSilver(10, adjust))} here ({adjust > 0 ? `+${adjust}%` : `${adjust}%`}).</div>}
            {isDM && (
              <div className="row">
                <button className="btn sm" onClick={() => setFavor(favor - 5)}>− Favor</button>
                <button className="btn sm" onClick={() => setFavor(favor + 5)}>+ Favor</button>
                {merchant.custom && <button className="btn sm danger" onClick={() => { onTown({ ...town, merchants: extras.filter((m) => m.id !== merchant.id) }); setMerchantId(MERCHANTS[0].id) }}>Remove</button>}
              </div>
            )}
          </>
        )}
        {isDM && (
          <div className="merchant-add">
            <div className="mini-label">Add merchant</div>
            <div className="row">
              <input className="grow" placeholder="Name" value={mName} onChange={(e) => setMName(e.target.value)} />
              <select value={trade} onChange={(e) => setTrade(e.target.value)} aria-label="Merchant type">
                {MERCHANT_TRADES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            {trade === 'Custom' && <input className="grow" placeholder="Custom type" value={customTrade} onChange={(e) => setCustomTrade(e.target.value)} />}
            <button className="btn sm" disabled={!mName.trim() || (trade === 'Custom' && !customTrade.trim())} onClick={addMerchant}>Add merchant</button>
          </div>
        )}
        {!c && <div className="small muted">Add a character to track favor.</div>}
      </div>
    </div>
  )
}
