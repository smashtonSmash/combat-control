import { useEffect, useRef, useState } from 'react'
import type { Character } from '../types'
import { fmtCoins, purseTotal, toSilver } from '../casino/money'
import * as BJ from '../casino/blackjack'
import { WHEEL_ORDER, betLabel, colorOf, oddsOf, settle, spinNumber, type BetKey } from '../casino/roulette'
import { WhoName } from '../components/PlayerName'

/** Change a character's coins by `delta` silver. Returns false if they can't afford it. */
export type Adjust = (charId: string, delta: number, note: string) => boolean

interface GameProps { player: Character; adjust: (delta: number, note: string) => boolean }

/** Add new games here — they show up in the Casino game picker automatically. */
const GAMES: { id: string; name: string; icon: string; blurb: string; Component: (p: GameProps) => React.ReactElement }[] = [
  { id: 'blackjack', name: 'Blackjack', icon: '🃏', blurb: 'Beat the dealer to 21 · BJ pays 3:2', Component: Blackjack },
  { id: 'roulette', name: 'Roulette', icon: '🎡', blurb: 'European single zero · straight up 35:1', Component: Roulette },
]

export default function Casino({ characters, adjust }: { characters: Character[]; adjust: Adjust }) {
  const [charId, setCharId] = useState<string | null>(() => localStorage.getItem('dnd.casinoChar'))
  const [gameId, setGameId] = useState<string>(() => localStorage.getItem('dnd.casinoGame') || 'blackjack')
  useEffect(() => { if (charId) localStorage.setItem('dnd.casinoChar', charId) }, [charId])
  useEffect(() => { localStorage.setItem('dnd.casinoGame', gameId) }, [gameId])
  const player = characters.find((c) => c.id === charId) ?? characters[0]
  const game = GAMES.find((g) => g.id === gameId) ?? GAMES[0]

  return (
    <div className="screen casino">
      <div className="screen-head"><h1>🎰 Casino</h1></div>
      {!player ? <div className="empty">Make a character first — they bet from their coin purse.</div> : (
        <>
          <div className="mini-label">Who’s playing?</div>
          <div className="chips-row wrap">
            {characters.map((c) => (
              <button key={c.id} className={'chip ' + (c.id === player.id ? 'on' : '')} onClick={() => setCharId(c.id)}>
                <WhoName id={c.id} name={c.name} /> <small>💰 {fmtCoins(purseTotal(c.purse))}</small>
              </button>
            ))}
          </div>
          <div className="purse-bar">
            <span>💰 <b><WhoName id={player.id} name={player.name} /></b></span>
            <span className="coin-pill gold">{player.purse?.gold ?? 0} g</span>
            <span className="coin-pill silver">{player.purse?.silver ?? 0} s</span>
          </div>
          <div className="game-picker">
            {GAMES.map((g) => (
              <button key={g.id} className={'game-tile ' + (g.id === game.id ? 'on' : '')} onClick={() => setGameId(g.id)}>
                <span className="game-icon">{g.icon}</span><b>{g.name}</b><small>{g.blurb}</small>
              </button>
            ))}
          </div>
          <game.Component key={game.id + player.id} player={player} adjust={(d, n) => adjust(player.id, d, n)} />
        </>
      )}
    </div>
  )
}

function BetInput({ amount, setAmount, unit, setUnit, label = 'Bet' }: {
  amount: number; setAmount: (n: number) => void; unit: 'gold' | 'silver'; setUnit: (u: 'gold' | 'silver') => void; label?: string
}) {
  return (
    <div className="bet-input">
      <span className="mini-label">{label}</span>
      <div className="row">
        <button type="button" className="icon-btn" onClick={() => setAmount(Math.max(1, amount - 1))}>−</button>
        <input inputMode="numeric" value={String(amount)} onChange={(e) => setAmount(Math.max(0, parseInt(e.target.value.replace(/\D/g, '')) || 0))} />
        <button type="button" className="icon-btn" onClick={() => setAmount(amount + 1)}>+</button>
        <div className="segmented">
          <button type="button" className={unit === 'gold' ? 'on' : ''} onClick={() => setUnit('gold')}>gold</button>
          <button type="button" className={unit === 'silver' ? 'on' : ''} onClick={() => setUnit('silver')}>silver</button>
        </div>
      </div>
      <div className="chips-row">{[1, 5, 10, 25].map((n) => <button key={n} className="chip" onClick={() => setAmount(n)}>{n}</button>)}</div>
    </div>
  )
}

const useStoredUnit = (key: string) => {
  const [u, setU] = useState<'gold' | 'silver'>(() => (localStorage.getItem(key) === 'silver' ? 'silver' : 'gold'))
  return [u, (v: 'gold' | 'silver') => { setU(v); localStorage.setItem(key, v) }] as const
}

// ---------------- Blackjack ----------------
function PlayingCard({ card, hidden, i = 0 }: { card?: BJ.Card; hidden?: boolean; i?: number }) {
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

const OUTCOME: Record<BJ.Outcome, string> = { blackjack: 'BLACKJACK!', win: 'WIN', push: 'PUSH', lose: 'LOSE', bust: 'BUST' }

function Blackjack({ player, adjust }: GameProps) {
  const shoe = useRef<BJ.Card[]>(BJ.newShoe())
  const [amount, setAmount] = useState(1)
  const [unit, setUnit] = useStoredUnit('dnd.casinoUnit')
  const [r, setR] = useState<BJ.Round | null>(null)
  const [msg, setMsg] = useState('')
  const paid = useRef<BJ.Round | null>(null)
  const bank = purseTotal(player.purse)

  const update = (n: BJ.Round) => { shoe.current = n.shoe; setR(n) }
  useEffect(() => {
    if (r && r.phase === 'done' && paid.current !== r) {
      paid.current = r
      if (r.returned > 0) adjust(r.returned, `Blackjack payout ${fmtCoins(r.returned)}`)
      const net = r.returned - r.staked
      setMsg(net > 0 ? `🎉 Won ${fmtCoins(net)}` : net < 0 ? `Lost ${fmtCoins(-net)}` : 'Even — bet returned')
    }
  }, [r, adjust])

  const dealHand = () => {
    const bet = toSilver(amount, unit)
    if (bet <= 0) return setMsg('Enter a bet.')
    if (!adjust(-bet, `Blackjack bet ${fmtCoins(bet)}`)) return setMsg(`Not enough coin (has ${fmtCoins(bank)}).`)
    if (BJ.needsShuffle(shoe.current)) { shoe.current = BJ.newShoe(); setMsg('🔀 Shuffling a fresh 6-deck shoe…') } else setMsg('')
    paid.current = null
    update(BJ.deal(shoe.current, bet))
  }
  const pay = (cost: number, what: string) => adjust(-cost, what) || (setMsg(`Not enough coin to ${what.toLowerCase()}.`), false)

  const playing = r && r.phase !== 'done'
  const dv = r ? BJ.handValue(r.phase === 'done' ? r.dealer : [r.dealer[0]]) : null
  return (
    <div className="felt">
      <div className="table-area">
        <div className="mini-label">Dealer {dv && <b className="hv">{dv.total}</b>}</div>
        <div className="card-row">{r ? r.dealer.map((c, i) => <PlayingCard key={i} card={c} i={i} hidden={i === 1 && r.phase !== 'done'} />) : <><PlayingCard hidden /><PlayingCard hidden /></>}</div>
        <div className="mini-label" style={{ marginTop: 14 }}>{player.name}</div>
        {r ? r.hands.map((h, i) => {
          const v = BJ.handValue(h.cards)
          return (
            <div key={i} className={'bj-hand ' + (r.phase === 'player' && i === r.active ? 'active' : '') + (h.outcome ? ' o-' + h.outcome : '')}>
              <div className="card-row">{h.cards.map((c, j) => <PlayingCard key={j} card={c} i={j} />)}</div>
              <div className="hand-meta">
                <b className="hv">{v.soft && v.total < 21 ? `soft ${v.total}` : v.total}</b>
                <span>bet {fmtCoins(h.bet)}{h.doubled ? ' (doubled)' : ''}</span>
                {h.outcome && <span className="outcome">{OUTCOME[h.outcome]}</span>}
              </div>
            </div>
          )
        }) : <div className="card-row"><PlayingCard hidden /><PlayingCard hidden /></div>}
        {r?.insurance ? <div className="small muted">Insurance {fmtCoins(r.insurance)}{r.phase === 'done' ? (r.insurancePayout ? ` → paid ${fmtCoins(r.insurancePayout)}` : ' → lost') : ''}</div> : null}
      </div>

      {msg && <div className="casino-msg">{msg}</div>}

      {r?.phase === 'insurance' && (
        <div className="panel">
          <b>Dealer shows an Ace — insurance?</b>
          <div className="small muted">Costs {fmtCoins(BJ.insuranceFor(r))} (half your bet), pays 2:1 if the dealer has blackjack.</div>
          <div className="row">
            <button className="btn primary grow" onClick={() => pay(BJ.insuranceFor(r), 'Buy insurance') && update(BJ.resolveInsurance(r, true))}>Take insurance</button>
            <button className="btn grow" onClick={() => update(BJ.resolveInsurance(r, false))}>No thanks</button>
          </div>
        </div>
      )}
      {r?.phase === 'player' && (
        <div className="bj-actions">
          <button className="btn big" disabled={!BJ.canHit(r)} onClick={() => update(BJ.hit(r))}>Hit</button>
          <button className="btn big primary" onClick={() => update(BJ.stand(r))}>Stand</button>
          <button className="btn big" disabled={!BJ.canDouble(r)} onClick={() => pay(BJ.costOf(r, 'double'), 'Double down') && update(BJ.double(r))}>Double</button>
          <button className="btn big" disabled={!BJ.canSplit(r)} onClick={() => pay(BJ.costOf(r, 'split'), 'Split') && update(BJ.split(r))}>Split</button>
        </div>
      )}
      {!playing && (
        <>
          <BetInput amount={amount} setAmount={setAmount} unit={unit} setUnit={setUnit} />
          <button className="btn big primary" onClick={dealHand}>🃏 Deal ({fmtCoins(toSilver(amount, unit))})</button>
        </>
      )}
      <div className="small muted center">6 decks · dealer stands on soft 17 · split to 4 hands · split aces get one card</div>
    </div>
  )
}

// ---------------- Roulette ----------------
const SEG = 360 / 37
const wheelGradient = `conic-gradient(${WHEEL_ORDER.map((n, i) => `${colorOf(n) === 'red' ? '#b3261e' : colorOf(n) === 'black' ? '#1b1712' : '#2f7d3a'} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(',')})`

function Roulette({ player, adjust }: GameProps) {
  const [amount, setAmount] = useState(1)
  const [unit, setUnit] = useStoredUnit('dnd.casinoUnit')
  const [bets, setBets] = useState<Partial<Record<BetKey, number>>>({})
  const [rot, setRot] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const [history, setHistory] = useState<number[]>([])
  const total = Object.values(bets).reduce<number>((s, v) => s + (v ?? 0), 0)
  const bank = purseTotal(player.purse)

  const place = (k: BetKey) => {
    if (spinning) return
    const chip = toSilver(amount, unit)
    if (total + chip > bank) return setMsg(`Not enough coin (has ${fmtCoins(bank)}).`)
    setMsg(''); setBets((b) => ({ ...b, [k]: (b[k] ?? 0) + chip }))
  }
  const spin = () => {
    if (!total || spinning) return
    if (!adjust(-total, `Roulette bets ${fmtCoins(total)}`)) return setMsg('Not enough coin.')
    const n = spinNumber()
    const idx = WHEEL_ORDER.indexOf(n)
    const target = 360 - (idx * SEG + SEG / 2)
    const base = rot - (rot % 360)
    setRot(base + 360 * 6 + target)
    setSpinning(true); setResult(null); setMsg('')
    window.setTimeout(() => {
      const s = settle(bets, n)
      if (s.returned) adjust(s.returned, `Roulette payout ${fmtCoins(s.returned)}`)
      const net = s.returned - total
      setResult(n); setSpinning(false); setHistory((h) => [n, ...h].slice(0, 12))
      setMsg(net > 0 ? `🎉 ${n} ${colorOf(n)} — won ${fmtCoins(net)}!` : net === 0 ? `${n} ${colorOf(n)} — broke even` : `${n} ${colorOf(n)} — lost ${fmtCoins(-net)}`)
    }, 4200)
  }
  const chipOn = (k: BetKey) => bets[k] ? <span className="chip-stack">{fmtCoins(bets[k]!)}</span> : null
  const cell = (k: BetKey, label: React.ReactNode, cls = '') => (
    <button key={k} className={`rcell ${cls} ${result !== null && settle({ [k]: 1 }, result).returned ? 'hit' : ''}`} onClick={() => place(k)} title={`${betLabel(k)} pays ${oddsOf(k)}:1`}>
      {label}{chipOn(k)}
    </button>
  )
  const rows = Array.from({ length: 12 }, (_, r) => [r * 3 + 1, r * 3 + 2, r * 3 + 3])

  return (
    <div className="felt">
      <div className="wheel-wrap">
        <div className="wheel-pointer">▼</div>
        <div className="wheel" style={{ background: wheelGradient, transform: `rotate(${rot}deg)`, transition: spinning ? 'transform 4s cubic-bezier(.15,.75,.2,1)' : 'none' }}>
          {WHEEL_ORDER.map((n, i) => (
            <span key={n} className="wheel-num" style={{ transform: `rotate(${i * SEG + SEG / 2}deg) translateY(-118px)` }}>{n}</span>
          ))}
          <div className="wheel-hub">{result ?? (spinning ? '…' : '✦')}</div>
        </div>
      </div>
      {history.length > 0 && <div className="r-history">{history.map((n, i) => <span key={i} className={'rball ' + colorOf(n)}>{n}</span>)}</div>}
      {msg && <div className="casino-msg">{msg}</div>}

      <BetInput amount={amount} setAmount={setAmount} unit={unit} setUnit={setUnit} label="Chip value (tap the board to bet)" />
      <div className="rboard">
        {cell('n0', '0', 'zero green')}
        {rows.map((row) => row.map((n) => cell(`n${n}` as BetKey, n, colorOf(n))))}
        {cell('col1', '2:1', 'col')}{cell('col2', '2:1', 'col')}{cell('col3', '2:1', 'col')}
      </div>
      <div className="rboard-outside">
        {cell('dozen1', '1st 12', 'out')}{cell('dozen2', '2nd 12', 'out')}{cell('dozen3', '3rd 12', 'out')}
        {cell('low', '1–18', 'out')}{cell('even', 'Even', 'out')}{cell('red', <span className="diamond red">◆ Red</span>, 'out')}
        {cell('black', <span className="diamond">◆ Black</span>, 'out')}{cell('odd', 'Odd', 'out')}{cell('high', '19–36', 'out')}
      </div>
      <div className="row">
        <button className="btn grow" disabled={!total || spinning} onClick={() => { setBets({}); setResult(null) }}>Clear bets</button>
        <button className="btn big primary grow" disabled={!total || spinning || total > bank} onClick={spin}>🎡 Spin ({fmtCoins(total)})</button>
      </div>
      <div className="small muted center">Straight 35:1 · dozens & columns 2:1 · red/black, odd/even, 1–18/19–36 1:1 · 0 loses outside bets. Bets stay on the board for the next spin.</div>
    </div>
  )
}
