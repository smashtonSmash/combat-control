import { useEffect, useState } from 'react'
import type { Character, DiceRoll, Encounter, WikiPage } from './types'
import { useStored } from './store'
import { sampleCharacters, sampleEncounter, samplePages } from './seed'
import Battle from './screens/Battle'
import Characters from './screens/Characters'
import Dice from './screens/Dice'
import Campaign from './screens/Campaign'

const TABS = [
  { id: 'battle', label: 'Battle', icon: '⚔️' },
  { id: 'characters', label: 'Characters', icon: '🛡️' },
  { id: 'dice', label: 'Dice', icon: '🎲' },
  { id: 'campaign', label: 'Campaign', icon: '📜' },
] as const
type Tab = (typeof TABS)[number]['id']

const tabFromHash = (): Tab => {
  const h = location.hash.slice(1)
  return (TABS.some((t) => t.id === h) ? h : localStorage.getItem('dnd.tab') || 'battle') as Tab
}

export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [characters, setCharacters] = useStored<Character[]>('characters', sampleCharacters)
  const [encounter, setEncounter] = useStored<Encounter>('encounter', sampleEncounter)
  const [history, setHistory] = useStored<DiceRoll[]>('dice', () => [])
  const [pages, setPages] = useStored<WikiPage[]>('pages', samplePages)
  const [bannerHidden, setBannerHidden] = useStored<boolean>('sampleBannerHidden', () => false)

  useEffect(() => {
    localStorage.setItem('dnd.tab', tab)
    if (location.hash.slice(1) !== tab) history_replace(tab)
    window.scrollTo({ top: 0 })
  }, [tab])
  useEffect(() => {
    const on = () => setTab(tabFromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const hasSamples = characters.some((c) => c.sample) || encounter.combatants.some((c) => c.sample) || pages.some((p) => p.sample)
  const removeSamples = () => {
    if (!confirm('Remove all sample characters, monsters and wiki pages? Your own data stays.')) return
    setCharacters((cs) => cs.filter((c) => !c.sample))
    setEncounter((e) => {
      const cs = e.combatants.filter((c) => !c.sample)
      return { ...e, combatants: cs, turnId: cs.some((c) => c.id === e.turnId) ? e.turnId : null }
    })
    setPages((ps) => ps.filter((p) => !p.sample))
  }

  const saveCharacter = (c: Character) => {
    setCharacters((cs) => (cs.some((x) => x.id === c.id) ? cs.map((x) => (x.id === c.id ? c : x)) : [...cs, c]))
    // keep battle copies in sync (HP in battle is preserved)
    setEncounter((e) => ({
      ...e,
      combatants: e.combatants.map((x) => x.characterId === c.id
        ? { ...x, name: c.name, ac: c.ac, armor: c.armor, maxHp: c.maxHp, hp: Math.min(x.hp, c.maxHp), initMod: c.initMod, traits: c.traits, attacks: c.attacks }
        : x),
    }))
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">✦</span> Lorekeeper’s Table</div>
      </header>
      {hasSamples && !bannerHidden && (
        <div className="sample-banner">
          <span>🧪 Sample data loaded so you can try things out.</span>
          <button className="link" onClick={removeSamples}>Remove samples</button>
          <button className="icon-btn sm" onClick={() => setBannerHidden(true)} aria-label="Hide">✕</button>
        </div>
      )}
      <main key={tab} className="fade-in">
        {tab === 'battle' && <Battle encounter={encounter} setEncounter={setEncounter} characters={characters} />}
        {tab === 'characters' && (
          <>
            <Characters characters={characters} onSave={saveCharacter} onDelete={(id) => setCharacters((cs) => cs.filter((c) => c.id !== id))} />
            {hasSamples && <div className="center pad"><button className="btn ghost danger" onClick={removeSamples}>Remove all sample data</button></div>}
          </>
        )}
        {tab === 'dice' && <Dice history={history} setHistory={setHistory} />}
        {tab === 'campaign' && <Campaign pages={pages} setPages={setPages} />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function history_replace(tab: string) {
  history.replaceState(null, '', '#' + tab)
}
