import { useState } from 'react'
import type { Character } from '../types'
import { uid } from '../types'
import type { Card } from '../casino/blackjack'
import { handValue } from '../casino/blackjack'
import { fmtCoins, insuranceCost, purseTotal, toSilver } from '../casino/money'
import { beginBetting, dealTable, emptyTable, openInvite, seated, type CasinoTable, type TableAction } from '../casino/table'
import { WhoName } from './PlayerName'

function PlayingCard({ card, hidden, i = 0 }: { card?: Card; hidden?: boolean; i?: number }) {
  if (!card || hidden) return <div className="pcard back" style={{ animationDelay: `${i * 0.08}s` }}><span>✦</span></div>
  const red = card.suit === '♥' || card.suit === '♦'
  return (
    <div className={'pcard ' + (red ? 'red' : '')} style={{ animationDelay: `${i * 0.08}s` }}>
      <span className="pc-tl">{card.rank}<br />{card.suit}</span>
      <span className="pc-mid">{card.suit}</span>
      <span className="pc-br">{card.rank}<br />{card.suit}</span>
    </div>
  )
}

const act = (charId: string, action: TableAction['action'], silver?: number): TableAction => ({
  id: uid(), charId, action, ...(silver != null ? { payload: { silver } } : {}),
})

export function CasinoTableView({ table, characters, localIds, isDealer, onCommit, onAct }: {
  table: CasinoTable
  characters: Character[]
  localIds: string[]
  isDealer: boolean
  onCommit: (t: CasinoTable) => void
  onAct: (a: TableAction) => void
}) {
  const [msg, setMsg] = useState('')
  const purseOf = (id: string) => purseTotal(characters.find((c) => c.id === id)?.purse)
  const mine = (id: string) => isDealer || localIds.includes(id)
  const holeHidden = !isDealer && table.phase !== 'done'
  const dealerCards = holeHidden ? table.dealer.slice(0, 1) : table.dealer
  const flashFor = (id: string) => table.flashes.find((f) => f.charId === id)

  const afford = (id: string, silver: number) => {
    if (silver <= 0) return true
    if (purseOf(id) >= silver) return true
    setMsg('Not enough coin in that purse.')
    return false
  }

  const deal = () => {
    const bets = seated(table).filter((s) => s.bet > 0)
    if (!bets.length) return setMsg('Someone needs a bet before the deal.')
    const short = bets.find((s) => purseOf(s.charId) < s.bet)
    if (short) return setMsg(`${short.name} cannot cover ${fmtCoins(short.bet)}.`)
    setMsg('')
    onCommit(dealTable(table))
  }

  if (!table.open) {
    return isDealer ? (
      <div className="panel casino-invite">
        <div className="row between"><b>🃏 Casino table</b><span className="small muted">Blackjack</span></div>
        <p className="small">Invite the party. Anyone who sits plays. You deal.</p>
        <button className="btn primary" onClick={() => onCommit(openInvite(characters.map((c) => ({ id: c.id, name: c.name || 'Unnamed' }))))}>Sit down at casino table?</button>
      </div>
    ) : null
  }

  return (
    <div className="panel casino-invite">
      <div className="row between">
        <b>🃏 Table</b>
        <span className="small muted">{isDealer ? 'You are the dealer' : 'Dealer runs the shoe'}</span>
      </div>
      {table.dealer.length > 0 && (
        <div className="bj-seat">
          <div className="small">Dealer {dealerCards.length ? `· ${handValue(dealerCards).total}` : ''}{holeHidden && table.dealer.length > 1 ? ' + hole card' : ''}</div>
          <div className="hand">{table.dealer.map((card, i) => <PlayingCard key={i} card={card} hidden={holeHidden && i > 0} i={i} />)}</div>
        </div>
      )}
      {table.phase === 'invite' && <p className="small">Sit down at the casino table? Yes joins as a player. The DM stays the dealer.</p>}
      {table.seats.map((s) => {
        const showCards = isDealer || localIds.includes(s.charId)
        const flash = flashFor(s.charId)
        const h = s.hands[s.active]
        const myTurn = table.phase === 'play' && table.turnId === s.charId && mine(s.charId)
        return (
          <div key={s.charId} className={'bj-seat ' + (table.turnId === s.charId ? 'turn' : '')}>
            <div className="row between">
              <span><WhoName id={s.charId} name={s.name} /> <small className="muted">{s.status}{s.bet ? ` · bet ${fmtCoins(s.bet)}` : ''}</small></span>
              {flash && <span className={'coin-flash ' + (flash.delta >= 0 ? 'win' : 'lose')}>{flash.delta >= 0 ? '+' : '−'}{fmtCoins(Math.abs(flash.delta))}</span>}
            </div>
            {showCards && s.hands.map((hand, i) => (
              <div key={i} className="hand">
                {hand.cards.map((card, n) => <PlayingCard key={n} card={card} i={n} />)}
                <span className="small">{hand.cards.length ? handValue(hand.cards).total : ''}{hand.outcome ? ` · ${hand.outcome}` : ''}</span>
              </div>
            ))}
            {!showCards && s.status === 'seated' && s.hands.length > 0 && <div className="small muted">Cards hidden.</div>}
            {table.phase === 'invite' && s.status === 'invited' && mine(s.charId) && (
              <div className="row">
                <button className="btn sm primary" onClick={() => onAct(act(s.charId, 'sit'))}>Yes, sit</button>
                <button className="btn sm" onClick={() => onAct(act(s.charId, 'decline'))}>No</button>
              </div>
            )}
            {table.phase === 'betting' && s.status === 'seated' && mine(s.charId) && (
              <div className="row">
                <button className="btn sm" onClick={() => onAct(act(s.charId, 'bet', Math.max(0, s.bet - toSilver(1, 'gold'))))}>−1g</button>
                <button className="btn sm" onClick={() => onAct(act(s.charId, 'bet', s.bet + toSilver(1, 'gold')))}>+1g</button>
                <button className="btn sm" onClick={() => onAct(act(s.charId, 'bet', Math.max(0, s.bet - 1)))}>−1s</button>
                <button className="btn sm" onClick={() => onAct(act(s.charId, 'bet', s.bet + 1))}>+1s</button>
              </div>
            )}
            {table.phase === 'insurance' && s.insurance === 'pending' && mine(s.charId) && (
              <div className="row">
                <span className="small">Insurance {fmtCoins(insuranceCost(s.bet))}?</span>
                <button className="btn sm" onClick={() => { if (afford(s.charId, insuranceCost(s.bet))) onAct(act(s.charId, 'insure')) }}>Take</button>
                <button className="btn sm" onClick={() => onAct(act(s.charId, 'skip-insure'))}>Skip</button>
              </div>
            )}
            {myTurn && h && (
              <div className="row">
                <button className="btn sm primary" onClick={() => onAct(act(s.charId, 'hit'))}>Hit</button>
                <button className="btn sm" onClick={() => onAct(act(s.charId, 'stand'))}>Stand</button>
                {h.cards.length === 2 && !h.splitAces && <button className="btn sm" onClick={() => { if (afford(s.charId, h.bet)) onAct(act(s.charId, 'double')) }}>Double</button>}
                {h.cards.length === 2 && h.cards[0].rank === h.cards[1].rank && s.hands.length < 4 && <button className="btn sm" onClick={() => { if (afford(s.charId, h.bet)) onAct(act(s.charId, 'split')) }}>Split</button>}
              </div>
            )}
          </div>
        )
      })}
      {msg && <div className="inv-msg">{msg}</div>}
      {isDealer && (
        <div className="row">
          {table.phase === 'invite' && <button className="btn sm primary" disabled={!seated(table).length} onClick={() => onCommit(beginBetting(table))}>Open betting</button>}
          {table.phase === 'betting' && <button className="btn sm primary" onClick={deal}>Deal</button>}
          {table.phase === 'done' && <button className="btn sm primary" onClick={() => onCommit(beginBetting(table))}>Next hand</button>}
          <button className="btn sm" onClick={() => onCommit(emptyTable())}>Close table</button>
        </div>
      )}
    </div>
  )
}
