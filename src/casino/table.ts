// Multi-seat blackjack. One shoe, one dealer, one hand (or split) per seated player.
// Solo blackjack in blackjack.ts is unchanged. This is the table the DM deals.
import type { Card, Hand } from './blackjack'
import { handValue, isBlackjack, needsShuffle, newShoe, dealerShouldHit } from './blackjack'
import { insuranceCost, payBlackjack, payEvenMoney, payInsurance } from './money'

export interface Seat {
  charId: string
  name: string
  status: 'invited' | 'seated' | 'declined'
  bet: number
  hands: Hand[]
  active: number
  done: boolean
  insurance: 'pending' | 'taken' | 'declined'
  insStake: number
}

export interface PurseFlash { charId: string; delta: number; name: string }

export interface CasinoTable {
  open: boolean
  invited: boolean
  phase: 'invite' | 'insurance' | 'betting' | 'play' | 'done'
  shoe: Card[]
  dealer: Card[]
  seats: Seat[]
  turnId: string | null
  updated: number
  settled: boolean
  flashes: PurseFlash[]
}

export interface TableAction {
  id: string
  charId: string
  action: 'sit' | 'decline' | 'bet' | 'hit' | 'stand' | 'double' | 'split' | 'insure' | 'skip-insure'
  payload?: { silver?: number }
}

const emptySeat = (charId: string, name: string): Seat => ({
  charId, name, status: 'invited', bet: 0, hands: [], active: 0, done: false, insurance: 'declined', insStake: 0,
})

export function emptyTable(): CasinoTable {
  return { open: false, invited: false, phase: 'invite', shoe: [], dealer: [], seats: [], turnId: null, updated: 0, settled: true, flashes: [] }
}

export function openInvite(chars: { id: string; name: string }[], now = Date.now()): CasinoTable {
  return {
    ...emptyTable(),
    open: true, invited: true, phase: 'invite', shoe: newShoe(), settled: true, updated: now,
    seats: chars.map((c) => emptySeat(c.id, c.name)),
  }
}

export function respondInvite(t: CasinoTable, charId: string, yes: boolean): CasinoTable {
  return { ...t, seats: t.seats.map((s) => (s.charId === charId ? { ...s, status: yes ? 'seated' : 'declined' } : s)) }
}

export const seated = (t: CasinoTable) => t.seats.filter((s) => s.status === 'seated')

export function beginBetting(t: CasinoTable): CasinoTable {
  if (!seated(t).length) return t
  return {
    ...t, phase: 'betting', dealer: [], turnId: null, settled: true, flashes: [],
    seats: t.seats.map((s) => ({ ...s, bet: 0, hands: [], active: 0, done: s.status !== 'seated', insurance: 'declined', insStake: 0 })),
  }
}

export function setBet(t: CasinoTable, charId: string, silver: number): CasinoTable {
  if (t.phase !== 'betting') return t
  const bet = Math.max(0, Math.floor(silver))
  return { ...t, seats: t.seats.map((s) => (s.charId === charId && s.status === 'seated' ? { ...s, bet } : s)) }
}

const draw = (shoe: Card[]): [Card, Card[]] => [shoe[0], shoe.slice(1)]

function freshHand(bet: number, cards: Card[] = []): Hand {
  return { cards, bet, doubled: false, done: false, splitAces: false, fromSplit: false }
}

export function dealTable(t0: CasinoTable): CasinoTable {
  const players = seated(t0).filter((s) => s.bet > 0)
  if (!players.length) return t0
  let shoe = needsShuffle(t0.shoe) || t0.shoe.length < players.length * 4 + 8 ? newShoe() : [...t0.shoe]
  const byId = new Map(t0.seats.map((s) => [s.charId, { ...s, hands: [] as Hand[], active: 0, done: s.status !== 'seated' || s.bet <= 0, insurance: 'declined' as Seat['insurance'], insStake: 0 }]))
  const order = players.map((p) => byId.get(p.charId)!)
  for (const s of order) {
    const [c, next] = draw(shoe); shoe = next
    s.hands = [freshHand(s.bet, [c])]
  }
  let dealer: Card[] = []
  { const [c, next] = draw(shoe); shoe = next; dealer = [c] }
  for (const s of order) {
    const [c, next] = draw(shoe); shoe = next
    s.hands[0].cards.push(c)
  }
  { const [c, next] = draw(shoe); shoe = next; dealer = [...dealer, c] }
  const offerIns = dealer[0].rank === 'A'
  for (const s of order) {
    const h = s.hands[0]
    if (offerIns) { s.insurance = 'pending'; s.done = false; continue }
    resolveNatural(s, h, dealer)
  }
  const seats = t0.seats.map((s) => byId.get(s.charId)!)
  const t: CasinoTable = { ...t0, shoe, dealer, seats, settled: false, flashes: [] }
  if (offerIns) return { ...t, phase: 'insurance', turnId: order[0]?.charId ?? null }
  return advanceTable(t)
}

function resolveNatural(s: Seat, h: Hand, dealer: Card[]) {
  const dealerBJ = isBlackjack(dealer)
  if (dealerBJ) {
    h.done = true
    h.outcome = isBlackjack(h.cards) ? 'push' : 'lose'
    h.payout = h.outcome === 'push' ? h.bet : 0
    s.done = true
    return
  }
  if (isBlackjack(h.cards)) {
    h.done = true
    h.outcome = 'blackjack'
    h.payout = payBlackjack(h.bet)
    s.done = true
  }
}

function playing(t: CasinoTable) {
  return t.seats.filter((s) => s.status === 'seated' && s.bet > 0)
}

function advanceTable(t: CasinoTable): CasinoTable {
  const order = playing(t)
  const turn = order.find((s) => !s.done)
  if (turn) return { ...t, phase: 'play', turnId: turn.charId }
  return dealerPlay({ ...t, turnId: null })
}

function dealerPlay(t: CasinoTable): CasinoTable {
  const seats = t.seats.map((s) => ({ ...s, hands: s.hands.map((h) => ({ ...h, cards: [...h.cards] })) }))
  let shoe = [...t.shoe]
  let dealer = [...t.dealer]
  const live = seats.some((s) => s.hands.some((h) => handValue(h.cards).total <= 21 && h.outcome !== 'blackjack'))
  if (live) while (dealerShouldHit(dealer)) { const [c, next] = draw(shoe); shoe = next; dealer = [...dealer, c] }
  const d = handValue(dealer).total
  const dealerBJ = isBlackjack(dealer)
  for (const s of seats) {
    for (const h of s.hands) {
      if (h.outcome === 'blackjack' || h.outcome === 'push' || h.outcome === 'lose') continue
      const v = handValue(h.cards).total
      if (v > 21) { h.outcome = 'bust'; h.payout = 0 }
      else if (dealerBJ) { h.outcome = 'lose'; h.payout = 0 }
      else if (d > 21 || v > d) { h.outcome = 'win'; h.payout = payEvenMoney(h.bet) }
      else if (v === d) { h.outcome = 'push'; h.payout = h.bet }
      else { h.outcome = 'lose'; h.payout = 0 }
    }
    s.done = true
  }
  return { ...t, shoe, dealer, seats, phase: 'done', turnId: null }
}

/** Silver to return to each purse. Stakes were already taken when the bet was locked. */
export function tablePayouts(t: CasinoTable): { charId: string; silver: number }[] {
  return playing(t).map((s) => ({
    charId: s.charId,
    silver: s.hands.reduce((n, h) => n + (h.payout ?? 0), 0) + (s.insurance === 'taken' && isBlackjack(t.dealer) ? payInsurance(s.insStake) : 0),
  })).filter((p) => p.silver > 0)
}

function seat(t: CasinoTable, charId: string) {
  return t.seats.find((s) => s.charId === charId)
}

function mapSeat(t: CasinoTable, charId: string, fn: (s: Seat) => Seat): CasinoTable {
  return { ...t, seats: t.seats.map((s) => (s.charId === charId ? fn({ ...s, hands: s.hands.map((h) => ({ ...h, cards: [...h.cards] })) }) : s)) }
}

export function hitSeat(t: CasinoTable, charId: string): CasinoTable {
  if (t.phase !== 'play' || t.turnId !== charId) return t
  const s = seat(t, charId)
  if (!s || s.done) return t
  const [c, shoe] = draw(t.shoe)
  let next = mapSeat({ ...t, shoe }, charId, (seat) => {
    const h = seat.hands[seat.active]
    h.cards.push(c)
    if (handValue(h.cards).total >= 21) h.done = true
    return seat
  })
  next = finishHand(next, charId)
  return next
}

export function standSeat(t: CasinoTable, charId: string): CasinoTable {
  if (t.phase !== 'play' || t.turnId !== charId) return t
  const next = mapSeat(t, charId, (s) => { s.hands[s.active].done = true; return s })
  return finishHand(next, charId)
}

export function doubleSeat(t: CasinoTable, charId: string): CasinoTable {
  if (t.phase !== 'play' || t.turnId !== charId) return t
  const s0 = seat(t, charId)
  const h0 = s0?.hands[s0.active]
  if (!h0 || h0.cards.length !== 2 || h0.splitAces) return t
  const [c, shoe] = draw(t.shoe)
  const next = mapSeat({ ...t, shoe }, charId, (s) => {
    const h = s.hands[s.active]
    s.bet += h.bet
    h.bet *= 2
    h.doubled = true
    h.cards.push(c)
    h.done = true
    return s
  })
  return finishHand(next, charId)
}

export function splitSeat(t: CasinoTable, charId: string): CasinoTable {
  if (t.phase !== 'play' || t.turnId !== charId) return t
  const s0 = seat(t, charId)
  const h0 = s0?.hands[s0.active]
  if (!h0 || h0.cards.length !== 2 || h0.cards[0].rank !== h0.cards[1].rank || (s0?.hands.length ?? 0) >= 4) return t
  const [c, shoe] = draw(t.shoe)
  const next = mapSeat({ ...t, shoe }, charId, (s) => {
    const h = s.hands[s.active]
    const aces = h.cards[0].rank === 'A'
    const second = freshHand(h.bet, [h.cards.pop()!])
    second.splitAces = aces
    second.fromSplit = true
    h.splitAces = aces
    h.fromSplit = true
    h.cards.push(c)
    s.bet += h.bet
    s.hands.splice(s.active + 1, 0, second)
    if (aces || handValue(h.cards).total === 21) h.done = true
    return s
  })
  return finishHand(next, charId)
}

function finishHand(t: CasinoTable, charId: string): CasinoTable {
  let next = mapSeat(t, charId, (s) => {
    const h = s.hands[s.active]
    if (h.done) {
      const more = s.hands.findIndex((x, i) => i > s.active && !x.done)
      if (more >= 0) {
        s.active = more
        if (s.hands[more].cards.length === 1) {
          /* filled by caller via shoe — split second card is drawn here */
        }
      } else s.done = s.hands.every((x) => x.done)
    }
    return s
  })
  // Draw the second card of a split hand that only has one card.
  const s = seat(next, charId)
  if (s && !s.done) {
    const h = s.hands[s.active]
    if (h && h.cards.length === 1 && next.shoe.length) {
      const [c, shoe] = draw(next.shoe)
      next = mapSeat({ ...next, shoe }, charId, (seat) => {
        const hand = seat.hands[seat.active]
        hand.cards.push(c)
        if (hand.splitAces || handValue(hand.cards).total === 21) hand.done = true
        if (hand.done && seat.hands.every((x) => x.done || x === hand)) {
          const later = seat.hands.findIndex((x, i) => i > seat.active && !x.done)
          if (later < 0) seat.done = seat.hands.every((x) => x === hand ? hand.done : x.done)
        }
        return seat
      })
      if (seat(next, charId)?.done) return advanceTable(next)
      if (seat(next, charId)?.hands[seat(next, charId)!.active]?.done) return finishHand(next, charId)
    }
  }
  if (seat(next, charId)?.done) return advanceTable(next)
  return next
}

export function answerInsurance(t: CasinoTable, charId: string, take: boolean): CasinoTable {
  if (t.phase !== 'insurance') return t
  let next = mapSeat(t, charId, (s) => {
    if (s.insurance !== 'pending') return s
    if (take) { s.insurance = 'taken'; s.insStake = insuranceCost(s.bet) } else s.insurance = 'declined'
    return s
  })
  const waiting = playing(next).filter((s) => s.insurance === 'pending')
  if (waiting.length) return { ...next, turnId: waiting[0].charId }
  next = mapSeat(next, next.seats[0]?.charId ?? charId, (s) => s) // touch copy
  const seats = next.seats.map((s) => {
    if (s.status !== 'seated' || s.bet <= 0) return s
    const copy = { ...s, hands: s.hands.map((h) => ({ ...h, cards: [...h.cards] })) }
    resolveNatural(copy, copy.hands[0], next.dealer)
    return copy
  })
  return advanceTable({ ...next, seats })
}

export function applyInbox(t: CasinoTable, actions: TableAction[]): CasinoTable {
  let next = t
  for (const a of actions) {
    if (a.action === 'sit') next = respondInvite(next, a.charId, true)
    else if (a.action === 'decline') next = respondInvite(next, a.charId, false)
    else if (a.action === 'bet') next = setBet(next, a.charId, a.payload?.silver ?? 0)
    else if (a.action === 'hit') next = hitSeat(next, a.charId)
    else if (a.action === 'stand') next = standSeat(next, a.charId)
    else if (a.action === 'double') next = doubleSeat(next, a.charId)
    else if (a.action === 'split') next = splitSeat(next, a.charId)
    else if (a.action === 'insure') next = answerInsurance(next, a.charId, true)
    else if (a.action === 'skip-insure') next = answerInsurance(next, a.charId, false)
  }
  return { ...next, updated: Date.now() }
}

/** Move coins when the table leaves betting, when a seat adds stake, and when a hand pays out.
 * `charge` receives a signed silver delta (negative leaves the purse). */
export function withMoney(prev: CasinoTable, next: CasinoTable, charge: (charId: string, silver: number) => void): CasinoTable {
  const leftBetting = prev.phase === 'betting' && next.phase !== 'betting' && next.phase !== 'invite'
  for (const s of next.seats) {
    const was = prev.seats.find((x) => x.charId === s.charId)
    if (leftBetting) {
      if (s.status === 'seated' && s.bet > 0) charge(s.charId, -s.bet)
      if (s.insStake > 0) charge(s.charId, -s.insStake)
    } else if (next.phase === 'play' || next.phase === 'insurance' || next.phase === 'done') {
      const extraBet = s.bet - (was?.bet ?? 0)
      const extraIns = s.insStake - (was?.insStake ?? 0)
      if (extraBet > 0) charge(s.charId, -extraBet)
      if (extraIns > 0) charge(s.charId, -extraIns)
    }
  }
  if (next.phase === 'done' && !next.settled) {
    const pays = tablePayouts(next)
    for (const p of pays) if (p.silver > 0) charge(p.charId, p.silver)
    const flashes: PurseFlash[] = next.seats.filter((s) => s.status === 'seated' && s.bet > 0).map((s) => {
      const back = pays.find((p) => p.charId === s.charId)?.silver ?? 0
      const staked = s.bet + (s.insurance === 'taken' ? s.insStake : 0)
      return { charId: s.charId, delta: back - staked, name: s.name }
    })
    return { ...next, settled: true, flashes }
  }
  return next
}
