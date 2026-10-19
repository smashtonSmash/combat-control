import { useEffect, useState } from 'react'

export function useStored<T>(key: string, initial: () => T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem('dnd.' + key)
      if (raw) return JSON.parse(raw) as T
    } catch { /* ignore */ }
    return initial()
  })
  useEffect(() => {
    try { localStorage.setItem('dnd.' + key, JSON.stringify(value)) } catch { /* quota */ }
  }, [key, value])
  return [value, setValue] as const
}
