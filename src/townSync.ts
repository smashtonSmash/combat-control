// Players do not keep their own copy of the DM's town.
// Merchants the DM added live on the campaign town. A local default only has the stock examples.
import type { TownState } from './fountain'

export function mergeTown(local: TownState, remote: TownState, role: 'dm' | 'player'): TownState {
  const localRev = local.vaultRev ?? 0
  const remoteRev = remote.vaultRev ?? 0
  const vault = localRev > remoteRev
    ? { vault: local.vault, vaultRev: local.vaultRev }
    : { vault: remote.vault, vaultRev: remote.vaultRev }
  if (role === 'dm') return { ...local, ...vault }
  if (!remote.places?.length) return { ...local, ...vault }
  const currentId = remote.places.some((p) => p.id === local.currentId) ? local.currentId : remote.currentId
  return { ...remote, ...vault, currentId }
}
