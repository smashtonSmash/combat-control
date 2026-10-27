import type { CSSProperties } from 'react'
import type { Character, Item } from '../types'
import { itemRarity } from '../armor'
import { weaponStyle } from '../weapons'
import { carryCapacity, slotsUsed } from '../encumbrance'

function partTint(item?: Item): CSSProperties | undefined {
  if (!item) return
  const rarity = itemRarity(item)
  if (!rarity) return
  if (item.special === 'black') {
    return { background: '#141416', borderColor: '#f3f3f6', boxShadow: '0 0 10px #f3f3f6' }
  }
  return { background: rarity.color, borderColor: rarity.color, boxShadow: `0 0 10px ${rarity.color}` }
}

function Slot({ label, hint, item, onPick }: { label: string; hint: string; item?: Item; onPick?: (id: string) => void }) {
  const rarity = item ? itemRarity(item) : null
  return (
    <button type="button" className={'doll-slot' + (item ? ' filled' : '')} style={rarity ? { borderColor: rarity.color } : undefined}
      onClick={() => item && onPick?.(item.id)} disabled={!item}>
      <small>{label}</small>
      <b>{item ? item.name : hint}</b>
      {rarity && <em style={{ color: rarity.color }}>{rarity.label}</em>}
    </button>
  )
}

/** Paper-doll slots. Chest is body armor. Head, hands, and feet are accessories, not armor layers. */
export function BodyDoll({ c, onPick }: { c: Character; onPick?: (itemId: string) => void }) {
  const inv = c.inventory ?? []
  const eq = (pred: (i: Item) => boolean) => inv.find((i) => i.equipped && pred(i))
  const used = slotsUsed(inv)
  const cap = carryCapacity(c)
  const head = eq((i) => i.equipSlot === 'head')
  const chest = eq((i) => i.kind === 'armor')
  const hands = eq((i) => i.equipSlot === 'hands')
  const feet = eq((i) => i.equipSlot === 'feet')
  return (
    <div className="doll">
      <div className="doll-figure" aria-hidden="true">
        <i className={'doll-head' + (head ? ' tinted' : '')} style={partTint(head)} />
        <i className={'doll-body' + (chest ? ' tinted' : '')} style={partTint(chest)} />
        <i className={'doll-arm l' + (hands ? ' tinted' : '')} style={partTint(hands)} /><i className={'doll-arm r' + (hands ? ' tinted' : '')} style={partTint(hands)} />
        <i className={'doll-leg l' + (feet ? ' tinted' : '')} style={partTint(feet)} /><i className={'doll-leg r' + (feet ? ' tinted' : '')} style={partTint(feet)} />
      </div>
      <div className="doll-slots">
        <Slot label="Melee" hint="Empty" item={eq((i) => i.kind === 'weapon' && weaponStyle(i) === 'melee')} onPick={onPick} />
        <Slot label="Head" hint="Helmet" item={eq((i) => i.equipSlot === 'head')} onPick={onPick} />
        <Slot label="Ranged" hint="Empty" item={eq((i) => i.kind === 'weapon' && weaponStyle(i) === 'ranged')} onPick={onPick} />
        <Slot label="Hands" hint="Gauntlets" item={eq((i) => i.equipSlot === 'hands')} onPick={onPick} />
        <Slot label="Chest" hint="Armor" item={eq((i) => i.kind === 'armor')} onPick={onPick} />
        <Slot label="Feet" hint="Boots" item={eq((i) => i.equipSlot === 'feet')} onPick={onPick} />
      </div>
      <div className={'doll-cap' + (used > cap ? ' over' : '')} title="Shadowdark-style slots. Identical potions share one slot. Armor is 1. Large weapons are 2.">
        Pack {used}/{cap} {used > cap ? '· over capacity' : ''}
      </div>
    </div>
  )
}
