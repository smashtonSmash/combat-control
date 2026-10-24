import { createContext, useContext } from 'react'
import { cleanPlayerName, type PlayerDirectory } from '../playerLabel'

const EMPTY: PlayerDirectory = { label: {}, account: {} }
const Ctx = createContext<PlayerDirectory>(EMPTY)

export function PlayerNames({ value, children }: { value: PlayerDirectory; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePlayerDirectory() {
  return useContext(Ctx)
}

/** Smaller secondary label. Renders nothing when the player is unknown. */
export function PlayerTag({ name }: { name?: string | null }) {
  const p = cleanPlayerName(name)
  if (!p) return null
  return <small className="player-tag"> ({p})</small>
}

/** Character name, with the player in parentheses when we know who that is. */
export function WhoName({ id, name }: { id?: string; name: string }) {
  const dir = useContext(Ctx)
  const player = id ? dir.label[id] : undefined
  return (
    <>
      {name.trim() || 'Unnamed'}
      <PlayerTag name={player} />
    </>
  )
}
