import { useState } from 'react'
import type { Character } from '../types'
import type { TownState } from '../fountain'
import { buyVaultSlots, depositToVault, nextVaultPrice, vaultOf, withdrawFromVault } from '../vault'
import { WhoName } from './PlayerName'

export function VaultPanel({ characters, town, onTown, onSave }: {
  characters: Character[]
  town: TownState
  onTown: (t: TownState) => void
  onSave: (c: Character) => void
}) {
  const vault = vaultOf(town)
  const price = nextVaultPrice(town)
  const [charId, setCharId] = useState(characters[0]?.id ?? '')
  const [msg, setMsg] = useState('')
  const c = characters.find((x) => x.id === charId)
  const open = Math.max(0, vault.slots - vault.items.length)
  const apply = (r: { ok: boolean; char: Character; town: TownState; message: string }) => {
    setMsg(r.message)
    if (!r.ok) return
    onSave(r.char)
    onTown(r.town)
  }
  return (
    <div className="panel" id="vault">
      <div className="row between">
        <b>Vault</b>
        <span className="small muted">{vault.items.length}/{vault.slots} slots</span>
      </div>
      <p className="small muted">A magical bank. The same vault in every town. It starts with 10 slots. Five more cost {price}g, then the price doubles each time.</p>
      {msg && <div className="inv-msg">{msg}</div>}
      <div className="vault-grid" aria-label="Vault slots">
        {Array.from({ length: vault.slots }, (_, i) => {
          const it = vault.items[i]
          return (
            <button key={it?.id ?? `empty-${i}`} type="button" className={'vault-slot' + (it ? ' filled' : '')} disabled={!it || !c}
              onClick={() => c && it && apply(withdrawFromVault(c, town, it.id))}>
              {it ? it.name : 'Empty'}
            </button>
          )
        })}
      </div>
      <div className="small muted">{open} open. Tap a filled slot to withdraw into the chosen character.</div>
      {characters.length === 0 && <div className="small muted">Add a character to deposit, withdraw, or buy slots.</div>}
      {characters.length > 0 && (
        <>
          <div className="chips-row wrap">{characters.map((x) => (
            <button key={x.id} type="button" className={'chip ' + (x.id === charId ? 'on' : '')} onClick={() => setCharId(x.id)}>
              <WhoName id={x.id} name={x.name} /> <small>{x.purse?.gold ?? 0}g</small>
            </button>
          ))}</div>
          {c && (
            <>
              <div className="mini-label">Deposit from {c.name}</div>
              <div className="chips-row wrap">
                {(c.inventory ?? []).length === 0 && <span className="small muted">Pack is empty.</span>}
                {(c.inventory ?? []).map((it) => (
                  <button key={it.id} type="button" className="chip" disabled={open <= 0} onClick={() => apply(depositToVault(c, town, it.id))}>
                    {it.name}{it.qty > 1 ? ` ×${it.qty}` : ''}
                  </button>
                ))}
              </div>
              <button className="btn sm" disabled={(c.purse?.gold ?? 0) * 10 + (c.purse?.silver ?? 0) < price * 10} onClick={() => apply(buyVaultSlots(c, town))}>
                Buy 5 slots · {price}g
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
