/** A real player label, or nothing. Whitespace and missing names stay hidden. */
export function cleanPlayerName(raw?: string | null): string | undefined {
  const t = raw?.trim()
  return t ? t : undefined
}

export interface PlayerSource {
  id: string
  /** characters.owner_id when this row came from a campaign */
  ownerId?: string
  /** optional name the table set on the sheet (offline, or when the account has none) */
  playerName?: string
}

export interface MemberName {
  user_id: string
  display_name?: string | null
}

export interface PlayerDirectory {
  /** character id → name to show */
  label: Record<string, string>
  /** character id → campaign member display name, when that member has one */
  account: Record<string, string>
}

/**
 * Who plays each character.
 * Signed in: the owner's campaign display name, when it is non-empty.
 * Otherwise: the optional sheet field. Never fills in "Player" or any other stand-in.
 */
export function playerDirectory(rows: PlayerSource[], members: MemberName[] = []): PlayerDirectory {
  const byUser = new Map<string, string>()
  for (const m of members) {
    const n = cleanPlayerName(m.display_name)
    if (n && m.user_id) byUser.set(m.user_id, n)
  }
  const label: Record<string, string> = {}
  const account: Record<string, string> = {}
  for (const r of rows) {
    const member = r.ownerId ? byUser.get(r.ownerId) : undefined
    if (member) account[r.id] = member
    const name = member ?? cleanPlayerName(r.playerName)
    if (name) label[r.id] = name
  }
  return { label, account }
}

/** "Thorin (Ashton)" when a player is known. The character name alone when not. */
export function withPlayer(characterName: string, player?: string | null): string {
  const p = cleanPlayerName(player)
  const name = characterName.trim() || 'Unnamed'
  return p ? `${name} (${p})` : name
}
