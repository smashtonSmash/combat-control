import { useState } from 'react'
import type { Character, Item } from '../types'
import { depositItem, fromSilver, purseSilver, transferPurse, withdrawItem, type PartyStash } from '../party'
import { Stepper } from './Sheet'
import { WhoName, usePlayerDirectory } from './PlayerName'
import { withPlayer } from '../playerLabel'

export function PartyPanel({ characters, party, onParty, onSave, canToggle, onRecap }: {
  characters: Character[]
  party: PartyStash
  onParty: (p: PartyStash) => void
  onSave: (c: Character) => void
  canToggle: boolean
  onRecap?: (text: string) => void
}) {
  const [charId, setCharId] = useState(characters[0]?.id ?? '')
  const [gold, setGold] = useState(0)
  const [silver, setSilver] = useState(0)
  const [msg, setMsg] = useState('')
  const players = usePlayerDirectory()
  const c = characters.find((x) => x.id === charId)
  const who = (x: Character) => withPlayer(x.name, players.label[x.id])
  const say = (t: string) => setMsg(t)
  const moveCoins = (dir: 'in' | 'out') => {
    if (!c || !party.shared) return
    const r = dir === 'in'
      ? transferPurse(c.purse, { gold: party.gold, silver: party.silver }, gold, silver)
      : transferPurse({ gold: party.gold, silver: party.silver }, c.purse, gold, silver)
    if (!r.ok) return say(r.message)
    if (dir === 'in') {
      onSave({ ...c, purse: r.from })
      onParty({ ...party, gold: r.to.gold, silver: r.to.silver })
    } else {
      onSave({ ...c, purse: r.to })
      onParty({ ...party, gold: r.from.gold, silver: r.from.silver })
    }
    const text = `${who(c)} ${dir === 'in' ? 'puts' : 'takes'} ${gold}g ${silver}s ${dir === 'in' ? 'in' : 'from'} the party pool.`
    say(text); onRecap?.(text)
  }
  const stashItem = (it: Item, dir: 'in' | 'out') => {
    if (!c) return
    const r = dir === 'in' ? depositItem(c, party, it.id) : withdrawItem(c, party, it.id)
    say(r.message)
    if (!r.ok) return
    onSave(r.char); onParty(r.stash); onRecap?.(r.message)
  }
  return (
    <div className="panel party-panel">
      <div className="row between">
        <b>🎒 Party stash</b>
        {canToggle
          ? <label className="row small"><input type="checkbox" checked={party.shared} onChange={(e) => onParty({ ...party, shared: e.target.checked })} /> Shared gold & inventory</label>
          : <span className="small muted">{party.shared ? 'Shared pool is on' : 'Personal purses'}</span>}
      </div>
      <div className="small muted">Optional. Off, everyone keeps their own coins. On, the pool below is the party’s. Players can still hand coins to each other from a character sheet.</div>
      {party.shared && (
        <>
          <div className="coins">
            <div className="coin gold"><b>{party.gold}</b><small>Pool gold</small></div>
            <div className="coin silver"><b>{party.silver}</b><small>Pool silver</small></div>
          </div>
          <div className="chips-row wrap">{characters.map((x) => (
            <button key={x.id} className={'chip ' + (x.id === charId ? 'on' : '')} onClick={() => setCharId(x.id)}><WhoName id={x.id} name={x.name} /></button>
          ))}</div>
          {c && <div className="small muted">{who(c)} carries {c.purse?.gold ?? 0}g {c.purse?.silver ?? 0}s · pool total {fromSilver(purseSilver({ gold: party.gold, silver: party.silver })).gold}g</div>}
          <div className="row">
            <Stepper label="Gold" value={gold} min={0} max={9999} onChange={setGold} />
            <Stepper label="Silver" value={silver} min={0} max={9999} onChange={setSilver} />
          </div>
          <div className="row">
            <button className="btn sm grow" onClick={() => moveCoins('in')}>Deposit</button>
            <button className="btn sm grow" onClick={() => moveCoins('out')}>Withdraw</button>
          </div>
          <div className="mini-label">Stash items</div>
          {party.items.length === 0 && <div className="small muted">Nothing in the stash.</div>}
          {party.items.map((it) => (
            <div key={it.id} className="fuse-row"><span>{it.name}{it.qty > 1 ? ` ×${it.qty}` : ''}</span>
              <button className="btn sm" onClick={() => stashItem(it, 'out')}>Give to {c ? who(c) : '…'}</button></div>
          ))}
          {c && (c.inventory ?? []).length > 0 && (
            <>
              <div className="mini-label">{who(c)}’s pack → stash</div>
              <div className="chips-row wrap">{(c.inventory ?? []).map((it) => (
                <button key={it.id} className="chip" onClick={() => stashItem(it, 'in')}>{it.name}</button>
              ))}</div>
            </>
          )}
        </>
      )}
      {msg && <div className="inv-msg">{msg}</div>}
    </div>
  )
}
