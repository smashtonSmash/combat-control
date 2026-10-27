import { describe, expect, it } from 'vitest'
import { createPageScrollLock } from './scrollLock'

describe('page scroll lock', () => {
  it('restores the page after the last sheet closes, even if a second sheet opened during a re-render', () => {
    const body = { style: { overflow: '' } }
    const lock = createPageScrollLock(() => body)
    const character = lock()
    const levelUp = lock()
    expect(body.style.overflow).toBe('hidden')

    // Parent re-render while both sheets are open: each effect releases and locks again.
    // The old per-sheet "save previous overflow" path restored "hidden" and froze the list.
    character()
    const characterAgain = lock()
    levelUp()
    const levelUpAgain = lock()
    expect(body.style.overflow).toBe('hidden')

    levelUpAgain()
    expect(body.style.overflow).toBe('hidden')
    characterAgain()
    expect(body.style.overflow).toBe('')
  })

  it('ignores a second release and keeps a non-empty overflow the page had before', () => {
    const body = { style: { overflow: 'auto' } }
    const lock = createPageScrollLock(() => body)
    const release = lock()
    release()
    release()
    expect(body.style.overflow).toBe('auto')
  })
})
