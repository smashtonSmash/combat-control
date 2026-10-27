// Manual coin buttons vs gold that arrives on its own.
import type { Purse } from './types'

const empty = (p?: Purse): Purse => ({ gold: p?.gold ?? 0, silver: p?.silver ?? 0 })

export interface GoldResult { ok: boolean; purse: Purse; message: string }

/**
 * + Add is DM-only. Spend is for anyone who has the coin.
 * Making change (1 gp = 10 sp) stays inside spend.
 */
export function manualGold(purse: Purse | undefined, kind: 'add' | 'spend', coin: 'gold' | 'silver', amt: number, dm: boolean): GoldResult {
  const p = empty(purse)
  const n = Math.max(0, Math.floor(amt))
  if (n <= 0) return { ok: false, purse: p, message: 'Enter an amount.' }
  if (kind === 'add') {
    if (!dm) return { ok: false, purse: p, message: 'Only the DM can add gold.' }
    return { ok: true, purse: coin === 'gold' ? { ...p, gold: p.gold + n } : { ...p, silver: p.silver + n }, message: '' }
  }
  const total = p.gold * 10 + p.silver
  const cost = coin === 'gold' ? n * 10 : n
  if (cost > total) return { ok: false, purse: p, message: 'Not enough coin!' }
  if (coin === 'gold' && p.gold >= n) return { ok: true, purse: { ...p, gold: p.gold - n }, message: '' }
  if (coin === 'silver' && p.silver >= n) return { ok: true, purse: { ...p, silver: p.silver - n }, message: '' }
  const left = total - cost
  return { ok: true, purse: { gold: Math.floor(left / 10), silver: left % 10 }, message: 'Made change automatically (1 gp = 10 sp).' }
}

/** Gold that shows up without the Add button: a town sale, or loot. Players can receive this. */
export function receiveGold(purse: Purse | undefined, gold: number, silver: number): Purse {
  const p = empty(purse)
  return { gold: p.gold + Math.max(0, Math.floor(gold)), silver: p.silver + Math.max(0, Math.floor(silver)) }
}
