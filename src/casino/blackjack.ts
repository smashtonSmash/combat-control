// Pure blackjack engine. 6-deck shoe, dealer stands on soft 17 (S17), BJ pays 3:2, insurance 2:1,
// split pairs up to 4 hands, split aces get one card each, double on any first two cards (incl. after split).
import { insuranceCost, payBlackjack, payEvenMoney, payInsurance } from './money'

export type Suit = '♠' | '♥' | '♦' | '♣'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'
export interface Card { rank: Rank; suit: Suit }
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const SUITS: Suit[] = ['♠', '♥', '♦', '♣']
export const DECKS = 6
export const MAX_HANDS = 4

export const cardValue = (c: Card) => (c.rank === 'A' ? 11 : ['J', 'Q', 'K'].includes(c.rank) ? 10 : Number(c.rank))

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0, aces = 0
  for (const c of cards) { total += cardValue(c); if (c.rank === 'A') aces++ }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return { total, soft: aces > 0 }
}
export const isBlackjack = (cards: Card[]) => cards.length === 2 && handValue(cards).total === 21

export function newShoe(rand: () => number = Math.random): Card[] {
  const shoe: Card[] = []
  for (let d = 0; d < DECKS; d++) for (const suit of SUITS) for (const rank of RANKS) shoe.push({ rank, suit })
  for (let i = shoe.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [shoe[i], shoe[j]] = [shoe[j], shoe[i]] }
  return shoe
}
/** Reshuffle when the shoe runs low (cut card ~75%). */
export const needsShuffle = (shoe: Card[]) => shoe.length < DECKS * 52 * 0.25

export type Outcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust'
export interface Hand { cards: Card[]; bet: number; doubled: boolean; done: boolean; splitAces: boolean; fromSplit: boolean; outcome?: Outcome; payout?: number }
export type Phase = 'insurance' | 'player' | 'done'
export interface Round {
  shoe: Card[]; dealer: Card[]; hands: Hand[]; active: number; phase: Phase
  insurance: number; insurancePayout: number
  /** total silver taken from the purse so far this round */
  staked: number
  /** total silver returned to the purse at the end */
  returned: number
}

const draw = (r: Round): Card => r.shoe.shift()!

export function deal(shoe: Card[], bet: number): Round {
  const r: Round = { shoe: [...shoe], dealer: [], hands: [], active: 0, phase: 'player', insurance: 0, insurancePayout: 0, staked: bet, returned: 0 }
  const h: Hand = { cards: [], bet, doubled: false, done: false, splitAces: false, fromSplit: false }
  h.cards.push(draw(r)); r.dealer.push(draw(r)); h.cards.push(draw(r)); r.dealer.push(draw(r))
  r.hands = [h]
  if (r.dealer[0].rank === 'A') { r.phase = 'insurance'; return r }
  return afterPeek(r)
}

export const canInsure = (r: Round) => r.phase === 'insurance'
export const insuranceFor = (r: Round) => insuranceCost(r.hands[0].bet)

export function resolveInsurance(r0: Round, take: boolean): Round {
  const r = clone(r0)
  if (take) { r.insurance = insuranceFor(r); r.staked += r.insurance }
  r.phase = 'player'
  return afterPeek(r)
}

/** Dealer peeks for blackjack (Ace or 10 up); player natural pays immediately. */
function afterPeek(r: Round): Round {
  const dealerBJ = isBlackjack(r.dealer)
  const h = r.hands[0]
  if (dealerBJ) {
    if (r.insurance) r.insurancePayout = payInsurance(r.insurance)
    h.done = true
    h.outcome = isBlackjack(h.cards) ? 'push' : 'lose'
    h.payout = h.outcome === 'push' ? h.bet : 0
    return finish(r)
  }
  if (isBlackjack(h.cards)) { h.done = true; h.outcome = 'blackjack'; h.payout = payBlackjack(h.bet); return finish(r) }
  return r
}

const clone = (r: Round): Round => ({ ...r, shoe: [...r.shoe], dealer: [...r.dealer], hands: r.hands.map((h) => ({ ...h, cards: [...h.cards] })) })
const cur = (r: Round) => r.hands[r.active]

export const canHit = (r: Round) => r.phase === 'player' && !cur(r).done
export const canDouble = (r: Round) => r.phase === 'player' && cur(r).cards.length === 2 && !cur(r).splitAces && !cur(r).done
export const canSplit = (r: Round) => {
  if (r.phase !== 'player') return false
  const h = cur(r)
  return !h.done && h.cards.length === 2 && h.cards[0].rank === h.cards[1].rank && r.hands.length < MAX_HANDS && !h.splitAces
}
/** extra silver the action needs from the purse */
export const costOf = (r: Round, action: 'double' | 'split') => (action === 'double' || action === 'split' ? cur(r).bet : 0)

function autoComplete(r: Round): Round {
  const h = cur(r)
  const v = handValue(h.cards).total
  if (v >= 21 || h.doubled || (h.splitAces && h.cards.length >= 2)) h.done = true
  return advance(r)
}

function advance(r: Round): Round {
  while (r.active < r.hands.length && r.hands[r.active].done) {
    r.active++
    if (r.active < r.hands.length) {
      const h = r.hands[r.active]
      if (h.cards.length === 1) { h.cards.push(draw(r)); if (h.splitAces || handValue(h.cards).total === 21) h.done = true }
    }
  }
  if (r.active >= r.hands.length) { r.active = r.hands.length - 1; return dealerPlay(r) }
  return r
}

export function hit(r0: Round): Round { const r = clone(r0); cur(r).cards.push(draw(r)); return autoComplete(r) }
export function stand(r0: Round): Round { const r = clone(r0); cur(r).done = true; return advance(r) }
export function double(r0: Round): Round {
  const r = clone(r0); const h = cur(r)
  r.staked += h.bet; h.bet *= 2; h.doubled = true; h.cards.push(draw(r))
  return autoComplete(r)
}
export function split(r0: Round): Round {
  const r = clone(r0); const h = cur(r)
  const aces = h.cards[0].rank === 'A'
  const second: Hand = { cards: [h.cards.pop()!], bet: h.bet, doubled: false, done: false, splitAces: aces, fromSplit: true }
  h.splitAces = aces; h.fromSplit = true
  r.staked += h.bet
  r.hands.splice(r.active + 1, 0, second)
  h.cards.push(draw(r))
  if (aces || handValue(h.cards).total === 21) h.done = true
  return advance(r)
}

/** S17: dealer hits below 17, stands on all 17s (incl. soft 17). */
export function dealerShouldHit(cards: Card[]) { return handValue(cards).total < 17 }

function dealerPlay(r: Round): Round {
  const live = r.hands.some((h) => handValue(h.cards).total <= 21)
  if (live) while (dealerShouldHit(r.dealer)) r.dealer.push(draw(r))
  const d = handValue(r.dealer).total
  for (const h of r.hands) {
    const v = handValue(h.cards).total
    if (v > 21) { h.outcome = 'bust'; h.payout = 0 }
    else if (d > 21 || v > d) { h.outcome = 'win'; h.payout = payEvenMoney(h.bet) }
    else if (v === d) { h.outcome = 'push'; h.payout = h.bet }
    else { h.outcome = 'lose'; h.payout = 0 }
  }
  return finish(r)
}

function finish(r: Round): Round {
  r.phase = 'done'
  r.returned = r.hands.reduce((s, h) => s + (h.payout ?? 0), 0) + r.insurancePayout
  return r
}
