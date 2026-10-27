import { describe, expect, it } from 'vitest'
import { allMerchants, merchantFromTrade } from './favor'
import { defaultTown } from './fountain'
import { mergeTown } from './townSync'
import { emptyVault } from './vault'

describe('town sync', () => {
  it('gives a player the merchants the DM added, and keeps a newer vault', () => {
    const local = defaultTown()
    const hesta = merchantFromTrade('Hesta', 'Blacksmith', 'h1')
    const remote = {
      ...defaultTown(),
      places: [
        { id: 'crossroads', name: 'Crossroads', hasFountain: true },
        { id: 'mill', name: 'Milltown', hasFountain: false },
      ],
      currentId: 'mill',
      merchants: [hesta],
      vault: { ...emptyVault(), items: [] },
      vaultRev: 1,
    }
    const seen = mergeTown({ ...local, currentId: 'crossroads' }, remote, 'player')
    expect(allMerchants(seen.merchants, seen.removedMerchantIds).some((m) => m.name === 'Hesta')).toBe(true)
    expect(seen.places.map((p) => p.name)).toEqual(['Crossroads', 'Milltown'])
    expect(seen.currentId).toBe('crossroads')
    expect(seen.vaultRev).toBe(1)

    const newer = mergeTown({ ...local, vault: emptyVault(), vaultRev: 4 }, { ...remote, vaultRev: 2 }, 'player')
    expect(newer.vaultRev).toBe(4)
    expect(newer.merchants?.[0].name).toBe('Hesta')
  })
  it('keeps the DM’s places and only takes a vault with a higher revision', () => {
    const local = {
      ...defaultTown(),
      places: [{ id: 'keep', name: 'Keep', hasFountain: false }],
      currentId: 'keep',
      vaultRev: 3,
    }
    const remote = { ...defaultTown(), vaultRev: 5, vault: emptyVault() }
    const kept = mergeTown(local, remote, 'dm')
    expect(kept.places).toEqual(local.places)
    expect(kept.vaultRev).toBe(5)
    const stale = mergeTown(local, { ...remote, vaultRev: 1 }, 'dm')
    expect(stale.vaultRev).toBe(3)
    expect(stale.places[0].name).toBe('Keep')
  })
})
