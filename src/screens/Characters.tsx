import { useState } from 'react'
import type { Abilities, Character } from '../types'
import { DAMAGE_ICONS, uid } from '../types'
import { abilityMod, fmtMod } from '../dice'
import { EFFECT_LABEL } from '../combat'
import { NumField, Sheet, TextField } from '../components/Sheet'
import { AttackEditor, TraitEditor } from '../components/Editors'

const blank = (): Character => ({
  id: uid(), name: '', cls: '', level: 1, race: '',
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  ac: 10, armor: '', maxHp: 10, initMod: 0, traits: [], attacks: [], notes: '',
})

export default function Characters({ characters, onSave, onDelete }: {
  characters: Character[]; onSave: (c: Character) => void; onDelete: (id: string) => void
}) {
  const [edit, setEdit] = useState<Character | null>(null)
  return (
    <div className="screen">
      <div className="screen-head">
        <h1>Characters</h1>
        <button className="btn primary" onClick={() => setEdit(blank())}>＋ New</button>
      </div>
      {characters.length === 0 && <div className="empty">No characters yet. Tap <b>＋ New</b> to make your first sheet.</div>}
      <div className="char-list">
        {characters.map((c) => (
          <button key={c.id} className="char-card" onClick={() => setEdit(structuredClone(c))}>
            {c.sample && <div className="sample-tag">SAMPLE</div>}
            <div className="ac-shield lg"><small>AC</small><b>{c.ac}</b></div>
            <div className="char-main">
              <b className="char-name">{c.name || 'Unnamed'}</b>
              <div className="muted small">{[c.race, c.cls, c.level && `Lv ${c.level}`].filter(Boolean).join(' · ')}</div>
              <div className="small">🛡 {c.armor || '—'} · ❤️ {c.maxHp} · ⚡ Init {fmtMod(c.initMod)}</div>
              {c.traits.length > 0 && (
                <div className="badges">
                  {c.traits.map((t) => <span key={t.id} className={'badge trait effect-' + t.effect}>✦ {t.name || EFFECT_LABEL[t.effect]} {t.damageTypes.map((d) => DAMAGE_ICONS[d]).join('')}</span>)}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
      {edit && (
        <CharacterSheet c={edit} isNew={!characters.some((x) => x.id === edit.id)} onClose={() => setEdit(null)}
          onSave={(c) => { onSave(c); setEdit(null) }}
          onDelete={() => { if (confirm(`Delete ${edit.name || 'this character'}?`)) { onDelete(edit.id); setEdit(null) } }} />
      )}
    </div>
  )
}

const ABILS: (keyof Abilities)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

function CharacterSheet({ c, isNew, onClose, onSave, onDelete }: {
  c: Character; isNew: boolean; onClose: () => void; onSave: (c: Character) => void; onDelete: () => void
}) {
  const [d, setD] = useState(c)
  const set = (p: Partial<Character>) => setD({ ...d, ...p })
  return (
    <Sheet open onClose={onClose} tall title={isNew ? 'New character' : d.name || 'Character'}
      footer={<button className="btn big primary" disabled={!d.name.trim()} onClick={() => onSave(d)}>Save character</button>}>
      <TextField label="Name" value={d.name} onChange={(v) => set({ name: v })} placeholder="Thorin" />
      <div className="grid3">
        <TextField label="Race" value={d.race} onChange={(v) => set({ race: v })} placeholder="Dwarf" />
        <TextField label="Class" value={d.cls} onChange={(v) => set({ cls: v })} placeholder="Fighter" />
        <NumField label="Level" value={d.level} onChange={(v) => set({ level: v })} />
      </div>
      <div className="mini-label">Ability scores</div>
      <div className="abil-grid">
        {ABILS.map((k) => (
          <label key={k} className="abil">
            <span>{k.toUpperCase()}</span>
            <input inputMode="numeric" value={String(d.abilities[k])}
              onChange={(e) => set({ abilities: { ...d.abilities, [k]: parseInt(e.target.value) || 0 } })} />
            <b>{fmtMod(abilityMod(d.abilities[k]))}</b>
          </label>
        ))}
      </div>
      <div className="grid3">
        <NumField label="AC" value={d.ac} onChange={(v) => set({ ac: v })} />
        <NumField label="Max HP" value={d.maxHp} onChange={(v) => set({ maxHp: v })} />
        <NumField label="Init mod" value={d.initMod} onChange={(v) => set({ initMod: v })} />
      </div>
      <button className="link small" onClick={() => set({ initMod: abilityMod(d.abilities.dex) })}>Use DEX modifier ({fmtMod(abilityMod(d.abilities.dex))}) for initiative</button>
      <TextField label="Armor" value={d.armor} onChange={(v) => set({ armor: v })} placeholder="Padded armor" />
      <div className="mini-label">Traits & homebrew (resistances, armor perks…)</div>
      <TraitEditor traits={d.traits} onChange={(t) => set({ traits: t })} />
      <div className="mini-label">Attacks</div>
      <AttackEditor attacks={d.attacks} onChange={(a) => set({ attacks: a })} />
      <label className="field"><span>Notes</span>
        <textarea rows={6} value={d.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Backstory, spells, inventory, reminders…" /></label>
      {!isNew && <button className="btn ghost danger" onClick={onDelete}>🗑 Delete character</button>}
    </Sheet>
  )
}
