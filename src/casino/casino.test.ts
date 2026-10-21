import { describe, expect, it } from 'vitest'
import { applyDelta, fmtCoins, insuranceCost, payBlackjack, payEvenMoney, payInsurance, payOdds, purseTotal, toSilver } from './money'
import { type Card, type Rank, deal, double, handValue, hit, isBlackjack, resolveInsurance, split, stand, dealerShouldHit, newShoe } from './blackjack'
import { oddsOf, settle, wins } from './roulette'

const c = (...ranks: Rank[]): Card[] => ranks.map((rank) => ({ rank, suit: '♠' }))
// shoe order for deal(): p1, d1, p2, d2, then hits
const shoe = (...ranks: Rank[]) => [...c(...ranks), ...newShoe(() => 0.5)]

describe('money', () => {
  it('converts and formats', () => {
    expect(toSilver(3, 'gold')).toBe(30); expect(toSilver(7, 'silver')).toBe(7)
    expect(purseTotal({ gold: 2, silver: 5 })).toBe(25)
    expect(fmtCoins(25)).toBe('2g 5s'); expect(fmtCoins(30)).toBe('3g'); expect(fmtCoins(0)).toBe('0s'); expect(fmtCoins(-4)).toBe('−4s')
  })
  it('applies wins and losses, making change', () => {
    expect(applyDelta({ gold: 1, silver: 2 }, 25)).toEqual({ gold: 3, silver: 7 })
    expect(applyDelta({ gold: 2, silver: 3 }, -3)).toEqual({ gold: 2, silver: 0 })
    expect(applyDelta({ gold: 2, silver: 3 }, -7)).toEqual({ gold: 1, silver: 6 })
    expect(applyDelta({ gold: 2, silver: 0 }, -20)).toEqual({ gold: 0, silver: 0 })
    expect(applyDelta({ gold: 1, silver: 0 }, -11)).toBeNull()
  })
  it('pays 3:2 rounding down to the silver', () => {
    expect(payBlackjack(10)).toBe(25)
    expect(payBlackjack(5)).toBe(12) // 7.5 → 7 winnings
    expect(payBlackjack(1)).toBe(2)
    expect(payEvenMoney(7)).toBe(14)
    expect(insuranceCost(10)).toBe(5); expect(insuranceCost(5)).toBe(2)
    expect(payInsurance(5)).toBe(15)
    expect(payOdds(2, 35)).toBe(72)
  })
})

describe('hand values', () => {
  it('counts aces soft/hard', () => {
    expect(handValue(c('A', 'K'))).toEqual({ total: 21, soft: true })
    expect(handValue(c('A', 'A', '9'))).toEqual({ total: 21, soft: true })
    expect(handValue(c('A', '6', 'K'))).toEqual({ total: 17, soft: false })
    expect(handValue(c('A', 'A', 'A', 'A'))).toEqual({ total: 14, soft: true })
    expect(handValue(c('K', 'Q', '5'))).toEqual({ total: 25, soft: false })
    expect(isBlackjack(c('A', 'Q'))).toBe(true)
    expect(isBlackjack(c('7', '7', '7'))).toBe(false)
  })
  it('dealer stands on soft 17', () => {
    expect(dealerShouldHit(c('A', '6'))).toBe(false)
    expect(dealerShouldHit(c('10', '6'))).toBe(true)
    expect(dealerShouldHit(c('10', '7'))).toBe(false)
  })
})

describe('blackjack rounds', () => {
  it('natural pays 3:2', () => {
    const r = deal(shoe('A', '9', 'K', '7'), 10)
    expect(r.phase).toBe('done'); expect(r.hands[0].outcome).toBe('blackjack'); expect(r.returned).toBe(25)
  })
  it('insurance pays 2:1 when dealer has blackjack', () => {
    let r = deal(shoe('10', 'A', '9', 'K'), 10)
    expect(r.phase).toBe('insurance')
    r = resolveInsurance(r, true)
    expect(r.staked).toBe(15); expect(r.hands[0].outcome).toBe('lose'); expect(r.returned).toBe(15) // net 0
  })
  it('push returns the bet', () => {
    let r = deal(shoe('10', '10', '8', '8'), 10)
    r = stand(r); expect(r.hands[0].outcome).toBe('push'); expect(r.returned).toBe(10)
  })
  it('double down doubles stake and draws one', () => {
    let r = deal(shoe('5', '10', '6', '7', 'K'), 10) // player 11, dealer 17
    r = double(r); expect(r.staked).toBe(20); expect(r.hands[0].cards.length).toBe(3); expect(r.hands[0].outcome).toBe('win'); expect(r.returned).toBe(40)
  })
  it('split aces get one card each', () => {
    let r = deal(shoe('A', '10', 'A', '7', 'K', '5'), 10) // dealer 17
    r = split(r)
    expect(r.hands.length).toBe(2); expect(r.hands.every((h) => h.cards.length === 2)).toBe(true)
    expect(r.phase).toBe('done'); expect(r.staked).toBe(20)
    expect(r.hands[0].outcome).toBe('win') // A+K = 21 (not blackjack) pays 1:1
    expect(r.returned).toBe(20)
  })
  it('re-splits up to 4 hands and allows double after split', () => {
    let r = deal(shoe('8', '10', '8', '7', '8', '8', '8', '3', 'K'), 10)
    r = split(r); r = split(r); r = split(r)
    expect(r.hands.length).toBe(4)
    expect(r.staked).toBe(40)
    expect(r.phase).toBe('player')
  })
  it('bust loses', () => {
    let r = deal(shoe('10', '10', '6', '7', 'K'), 10)
    r = hit(r); expect(r.hands[0].outcome).toBe('bust'); expect(r.returned).toBe(0)
  })
})

describe('roulette', () => {
  it('pays standard odds', () => {
    expect(oddsOf('n17')).toBe(35); expect(oddsOf('dozen2')).toBe(2); expect(oddsOf('col3')).toBe(2); expect(oddsOf('red')).toBe(1)
    expect(wins('red', 1)).toBe(true); expect(wins('black', 2)).toBe(true); expect(wins('col1', 34)).toBe(true); expect(wins('dozen3', 25)).toBe(true)
    expect(settle({ n17: 1, red: 10, odd: 10, dozen2: 5 }, 17).returned).toBe(36 + 0 + 20 + 15)
  })
  it('zero loses outside bets', () => {
    expect(settle({ red: 10, black: 10, even: 10, low: 10, col3: 10 }, 0).returned).toBe(0)
    expect(settle({ n0: 2 }, 0).returned).toBe(72)
  })
})
