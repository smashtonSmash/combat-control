// Shared magical bank. One vault for the whole campaign, the same in every town.
import type { TownState } from './fountain'
import { addItem, removeItem } from './inventory'
import { fromSilver, purseSilver } from './party'
import type { Character, Item } from './types'

export const VAULT_START_SLOTS = 10
export const VAULT_BLOCK = 5

export interface VaultState {
  slots: number
  /** How many +5 blocks have already been bought. The next block costs 2^blocks gold. */
  blocks: number
  items: Item[]
}

export function emptyVault(): VaultState {
  return { slots: VAULT_START_SLOTS, blocks: 0, items: [] }
}

export function vaultOf(t: { vault?: VaultState }): VaultState {
  const v = t.vault
  if (!v) return emptyVault()
  return {
    slots: Math.max(VAULT_START_SLOTS, Math.floor(v.slots) || VAULT_START_SLOTS),
    blocks: Math.max(0, Math.floor(v.blocks) || 0),
    items: v.items ?? [],
  }
}

/** Soft curve: the first +5 is 1g, then 2, 4, 8, 16, and it keeps doubling. */
export function vaultBlockPrice(blocksAlreadyBought: number): number {
  const n = Math.max(0, Math.floor(blocksAlreadyBought))
  return 2 ** n
}

export function nextVaultPrice(t: { vault?: VaultState }): number {
  return vaultBlockPrice(vaultOf(t).blocks)
}

function withVault(t: TownState, vault: VaultState): TownState {
  return { ...t, vault, vaultRev: (t.vaultRev ?? 0) + 1 }
}

export function buyVaultSlots(c: Character, town: TownState): { ok: boolean; char: Character; town: TownState; message: string } {
  const vault = vaultOf(town)
  const price = vaultBlockPrice(vault.blocks)
  if (purseSilver(c.purse) < price * 10) return { ok: false, char: c, town, message: `${c.name} needs ${price}g for the next 5 vault slots.` }
  const next: VaultState = { ...vault, slots: vault.slots + VAULT_BLOCK, blocks: vault.blocks + 1 }
  return {
    ok: true,
    char: { ...c, purse: fromSilver(purseSilver(c.purse) - price * 10) },
    town: withVault(town, next),
    message: `${c.name} pays ${price}g. The vault now has ${next.slots} slots.`,
  }
}

export function depositToVault(c: Character, town: TownState, itemId: string): { ok: boolean; char: Character; town: TownState; message: string } {
  const it = (c.inventory ?? []).find((i) => i.id === itemId)
  if (!it) return { ok: false, char: c, town, message: 'That item is not in the pack.' }
  const vault = vaultOf(town)
  if (vault.items.length >= vault.slots) return { ok: false, char: c, town, message: `The vault is full (${vault.slots} slots).` }
  const char = removeItem(c, itemId)
  const stored: Item = { ...it, equipped: false }
  return {
    ok: true, char, town: withVault(town, { ...vault, items: [...vault.items, stored] }),
    message: `${stored.name} is in the vault.`,
  }
}

export function withdrawFromVault(c: Character, town: TownState, itemId: string): { ok: boolean; char: Character; town: TownState; message: string } {
  const vault = vaultOf(town)
  const it = vault.items.find((i) => i.id === itemId)
  if (!it) return { ok: false, char: c, town, message: 'That is not in the vault.' }
  return {
    ok: true,
    char: addItem(c, { ...it, equipped: false }),
    town: withVault(town, { ...vault, items: vault.items.filter((i) => i.id !== itemId) }),
    message: `${c.name} takes ${it.name} from the vault.`,
  }
}
