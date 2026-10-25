import { describe, expect, it } from 'vitest'
import { beginBetting, dealTable, openInvite, respondInvite, seated, setBet } from './table'

describe('blackjack table join', () => {
  it('seats a yes and keeps a decline out of the deal', () => {
    let t = openInvite([{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Bo' }], 1)
    expect(t.phase).toBe('invite')
    expect(t.seats.every((s) => s.status === 'invited')).toBe(true)
    t = respondInvite(t, 'a', true)
    t = respondInvite(t, 'b', false)
    expect(seated(t).map((s) => s.charId)).toEqual(['a'])
    t = beginBetting(t)
    t = setBet(t, 'a', 10)
    t = setBet(t, 'b', 50)
    expect(t.seats.find((s) => s.charId === 'b')!.bet).toBe(0)
    t = dealTable(t)
    expect(t.dealer).toHaveLength(2)
    expect(t.seats.find((s) => s.charId === 'a')!.hands[0].cards).toHaveLength(2)
    expect(t.seats.find((s) => s.charId === 'b')!.hands).toEqual([])
    expect(t.phase === 'play' || t.phase === 'insurance' || t.phase === 'done').toBe(true)
  })
})