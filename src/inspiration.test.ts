import { describe, expect, it } from 'vitest'
import { observeInspiration } from './inspiration'

const aldric = (ping?: number) => ({ id: 'a', name: 'Aldric', inspirationPing: ping })

describe('inspiration animation', () => {
  it('does not play for inspiration already saved on cold load', () => {
    const first = observeInspiration(new Map(), [aldric(1_700_000_000_000)])
    expect(first.burst).toBeNull()
    expect(first.seen.get('a')).toBe(1_700_000_000_000)
  })

  it('does not play when an empty list hydrates into saved inspiration', () => {
    const empty = observeInspiration(new Map(), [])
    expect(empty.burst).toBeNull()
    const hydrated = observeInspiration(empty.seen, [aldric(42), { id: 'b', name: 'Bryn', inspirationPing: 99 }])
    expect(hydrated.burst).toBeNull()
    expect(hydrated.seen.get('a')).toBe(42)
    expect(hydrated.seen.get('b')).toBe(99)
  })

  it('plays only when a character we already see is granted a newer ping', () => {
    const loaded = observeInspiration(new Map(), [aldric(10)])
    const again = observeInspiration(loaded.seen, [aldric(10)])
    expect(again.burst).toBeNull()
    const granted = observeInspiration(again.seen, [aldric(20)])
    expect(granted.burst).toEqual({ name: 'Aldric', key: 20 })
    const held = observeInspiration(granted.seen, [{ id: 'a', name: 'Aldric', inspirationPing: 20 }])
    expect(held.burst).toBeNull()
  })
})
