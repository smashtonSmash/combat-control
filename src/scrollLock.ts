/** How many sheets are holding the page still. Shared so one sheet cannot restore a stale "hidden". */
export function createPageScrollLock(getBody: () => { style: { overflow: string } }) {
  let count = 0
  let previous: string | null = null
  return function lockPageScroll(): () => void {
    const body = getBody()
    if (count === 0) {
      previous = body.style.overflow
      body.style.overflow = 'hidden'
    }
    count += 1
    let released = false
    return () => {
      if (released) return
      released = true
      count -= 1
      if (count > 0) return
      count = 0
      body.style.overflow = previous ?? ''
      previous = null
    }
  }
}

export const lockPageScroll = createPageScrollLock(() => document.body)
