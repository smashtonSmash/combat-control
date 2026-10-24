import { useState } from 'react'
import type { Character } from '../types'
import { uid } from '../types'
import { currentPlace, defaultTown, fountainReward, goldLabelFromSilver, offerToFountain, type TownState } from '../fountain'
import { favorAdjust, favorFace, favorOf, MERCHANTS, merchantById, clampFavor } from '../favor'
import { shopPriceSilver } from '../catalog'
import { fmtCost } from '../effects'
import { fromSilver, purseSilver } from '../party'
import { addItem } from '../inventory'
import { Stepper } from '../components/Sheet'
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
  const c = characters.find((x) => x.id === charId)
  const merchant = merchantById(merchantId) ?? MERCHANTS[0]
  const favor = c ? favorOf(c, merchant.id) : 0
  const face = favorFace(favor)
  const adjust = favorAdjust(favor, merchant)

  const offer = () => {
    if (!c) return
    if (!place.hasFountain) return setMsg('No wishing fountain in this town.')
    const silverIn = gold * 10 + silver
    if (silverIn <= 0) return setMsg('Offer some coin.')
    if (purseSilver(c.purse) < silverIn) return setMsg(`${c.name} doesn’t have that much.`)
    const result = offerToFountain(town.fountain, silverIn)
    let next: Character = { ...c, purse: fromSilver(purseSilver(c.purse) - silverIn) }
    let note = `${c.name} offers ${gold}g ${silver}s. The fountain holds ${goldLabelFromSilver(result.state.contributedSilver || 0)}.`
    if (result.granted && result.rewardNote) {
      next = addItem(next, fountainReward())
      note = `${c.name} offers ${gold}g ${silver}s. ${result.rewardNote}`
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
              <button key={x.id} className={'chip ' + (x.id === charId ? 'on' : '')} onClick={() => setCharId(x.id)}>{x.name} <small>{x.purse?.gold ?? 0}g</small></button>
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
        <div className="small muted">Each one haggles differently. Favor is per character. Higher favor, happier face, better prices. The numbers are a placeholder.</div>
        <div className="chips-row wrap">{MERCHANTS.map((m) => (
          <button key={m.id} className={'chip ' + (m.id === merchant.id ? 'on' : '')} onClick={() => setMerchantId(m.id)}>{m.name}</button>
        ))}</div>
        <p className="small"><b>{merchant.name}</b> — {merchant.personality}</p>
        {c && (
          <>
            <div className="favor-bar" aria-label={`Favor ${favor} of 100`}>
              <i style={{ width: favor + '%' }} />
              <em>{favor}/100</em>
            </div>
            <div className="small">A 10g item is {fmtCost(shopPriceSilver(10, adjust))} here ({adjust > 0 ? `+${adjust}%` : `${adjust}%`}).</div>
            {isDM && (
              <div className="row">
                <button className="btn sm" onClick={() => setFavor(favor - 5)}>− Favor</button>
                <button className="btn sm" onClick={() => setFavor(favor + 5)}>+ Favor</button>
              </div>
            )}
          </>
        )}
        {!c && <div className="small muted">Add a character to track favor.</div>}
      </div>
    </div>
  )
}
