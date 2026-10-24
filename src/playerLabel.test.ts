import { describe, expect, it } from 'vitest'
import { cleanPlayerName, playerDirectory, withPlayer } from './playerLabel'

describe('player labels', () => {
  it('hides blank and whitespace names', () => {
    expect(cleanPlayerName(undefined)).toBeUndefined()
    expect(cleanPlayerName(null)).toBeUndefined()
    expect(cleanPlayerName('')).toBeUndefined()
    expect(cleanPlayerName('   ')).toBeUndefined()
    expect(withPlayer('Thorin', '  ')).toBe('Thorin')
    expect(withPlayer('  ', undefined)).toBe('Unnamed')
  })

  it('uses the campaign member display name when signed in', () => {
    const dir = playerDirectory(
      [
        { id: 'thorin', ownerId: 'u1', playerName: 'Offline Nick' },
        { id: 'lyra', ownerId: 'u2', playerName: 'Should stay' },
        { id: 'npc', playerName: 'Guest' },
        { id: 'blank-owner', ownerId: 'u3', playerName: '' },
      ],
      [
        { user_id: 'u1', display_name: 'Ashton' },
        { user_id: 'u2', display_name: '   ' },
        { user_id: 'u3', display_name: '' },
      ],
    )
    expect(dir.account.thorin).toBe('Ashton')
    expect(dir.label.thorin).toBe('Ashton')
    expect(dir.account.lyra).toBeUndefined()
    expect(dir.label.lyra).toBe('Should stay')
    expect(dir.label.npc).toBe('Guest')
    expect(dir.label['blank-owner']).toBeUndefined()
    expect(withPlayer('Thorin', dir.label.thorin)).toBe('Thorin (Ashton)')
  })

  it('uses the sheet field offline and does not invent a name', () => {
    const dir = playerDirectory([
      { id: 'a', playerName: ' Sam ' },
      { id: 'b', playerName: '' },
      { id: 'c' },
    ])
    expect(dir.account).toEqual({})
    expect(dir.label).toEqual({ a: 'Sam' })
    expect(withPlayer('Kael', dir.label.b)).toBe('Kael')
    expect(withPlayer('Vex', dir.label.c)).toBe('Vex')
  })
})
