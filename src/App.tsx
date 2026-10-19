import { useCallback, useEffect, useRef, useState } from 'react'
import type { Character, DiceRoll, Encounter, WikiPage } from './types'
import { useStored } from './store'
import { charProf, characterToCombatant, extraSamples, sampleCharacters, sampleEncounter, samplePages } from './seed'
import Battle from './screens/Battle'
import Characters from './screens/Characters'
import Dice from './screens/Dice'
import Campaign from './screens/Campaign'
import { listCampaigns, useCampaign, useSession, type CampaignInfo } from './cloud'
import { CloudSheet } from './components/Cloud'
import { uid } from './types'

const emptyEncounter = (): Encounter => ({ combatants: [], round: 1, turnId: null, log: [] })
const joinFromHash = () => { const m = location.hash.match(/join=([A-Za-z0-9]+)/); return m ? m[1].toUpperCase() : undefined }

const TABS = [
  { id: 'battle', label: 'Battle', icon: '⚔️' },
  { id: 'characters', label: 'Characters', icon: '🛡️' },
  { id: 'dice', label: 'Dice', icon: '🎲' },
  { id: 'campaign', label: 'Campaign', icon: '📜' },
] as const
type Tab = (typeof TABS)[number]['id']

const tabFromHash = (): Tab => {
  const h = location.hash.slice(1)
  if (h.startsWith('join=')) return 'characters'
  return (TABS.some((t) => t.id === h) ? h : localStorage.getItem('dnd.tab') || 'battle') as Tab
}

export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash)
  const [localChars, setCharacters] = useStored<Character[]>('characters', sampleCharacters)
  const [localEnc, setEncounter] = useStored<Encounter>('encounter', sampleEncounter)
  const [history, setHistory] = useStored<DiceRoll[]>('dice', () => [])
  const [pages, setPages] = useStored<WikiPage[]>('pages', samplePages)
  const [bannerHidden, setBannerHidden] = useStored<boolean>('sampleBannerHidden', () => false)

  // ---------- online campaign (Supabase) ----------
  const { session } = useSession()
  const [campaigns, setCampaigns] = useState<CampaignInfo[]>([])
  const [activeId, setActiveId] = useStored<string | null>('activeCampaign', () => null)
  const [joinCode] = useState(joinFromHash)
  const [cloudOpen, setCloudOpen] = useState(!!joinCode)
  const refreshCampaigns = useCallback(async () => {
    if (!session) { setCampaigns([]); return }
    try { setCampaigns(await listCampaigns(session.user.id)) } catch { /* offline */ }
  }, [session])
  useEffect(() => { refreshCampaigns() }, [refreshCampaigns])
  const active = session ? campaigns.find((c) => c.id === activeId) ?? null : null
  const online = !!active
  const isDM = active?.role === 'dm'
  const cloud = useCampaign(active?.id ?? null)
  const myId = session?.user.id

  // DM keeps the authoritative encounter locally (per campaign) and pushes it; players watch it live.
  const [dmEnc, setDmEnc] = useState<Encounter | null>(null)
  const dmEncRef = useRef<Encounter | null>(null)
  useEffect(() => {
    setDmEnc(null); dmEncRef.current = null
  }, [active?.id])
  useEffect(() => {
    if (isDM && dmEncRef.current === null && cloud.status === 'live') {
      const e = cloud.encounter ?? emptyEncounter()
      dmEncRef.current = e; setDmEnc(e)
    }
  }, [isDM, cloud.status, cloud.encounter])
  const setDmEncounter = useCallback((f: (e: Encounter) => Encounter) => {
    const cur = dmEncRef.current ?? emptyEncounter()
    const next = f(cur)
    if (next === cur) return
    dmEncRef.current = next; setDmEnc(next); cloud.pushEncounter(next)
  }, [cloud.pushEncounter])

  // Player sheet edits → DM battle cards (armor, AC, HP…)
  useEffect(() => {
    if (!isDM) return
    setDmEncounter((e) => {
      let changed = false
      const cs = e.combatants.map((x) => {
        const ch = x.characterId ? cloud.chars.find((r) => r.id === x.characterId)?.data : undefined
        if (!ch) return x
        const hp = typeof ch.currentHp === 'number' ? Math.min(ch.currentHp, ch.maxHp) : Math.min(x.hp, ch.maxHp)
        const nx = { ...x, name: ch.name, ac: ch.ac, armor: ch.armor, maxHp: ch.maxHp, hp, initMod: ch.initMod, traits: ch.traits, attacks: ch.attacks,
          armorId: ch.armorId, armorTier: ch.armorTier, underId: ch.underId, underTier: ch.underTier, prof: charProf(ch) }
        if (JSON.stringify(nx) !== JSON.stringify(x)) { changed = true; return nx }
        return x
      })
      return changed ? { ...e, combatants: cs } : e
    })
  }, [isDM, cloud.chars, setDmEncounter])
  // DM damage/healing → player's sheet (current HP)
  useEffect(() => {
    if (!isDM || !dmEnc) return
    for (const x of dmEnc.combatants) {
      const r = x.characterId ? cloud.chars.find((c) => c.id === x.characterId) : undefined
      if (r && r.data.currentHp !== x.hp) cloud.saveChar({ ...r.data, currentHp: x.hp })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDM, dmEnc])

  const characters: Character[] = online
    ? cloud.chars.filter((r) => isDM || r.owner_id === myId).map((r) => r.data)
    : localChars
  const encounter: Encounter = online ? (isDM ? dmEnc ?? emptyEncounter() : cloud.encounter ?? emptyEncounter()) : localEnc
  const setEnc = online ? (isDM ? setDmEncounter : () => { /* players watch the DM's battle */ }) : setEncounter
  const copyLocal = () => {
    const mine = localChars.filter((c) => !c.sample)
    const list = mine.length ? mine : localChars
    for (const c of list) cloud.saveChar({ ...structuredClone(c), id: uid(), sample: undefined }, myId)
    setCloudOpen(false)
  }

  // One-time migration for saves made before the armor catalog existed (only touches SAMPLE data).
  useEffect(() => {
    if (localStorage.getItem('dnd.migrated.armor1')) return
    localStorage.setItem('dnd.migrated.armor1', '1')
    const isOldThorin = (t: { id?: string; armorId?: string }) => !t.armorId
    const fixThorin = <T extends { traits: Character['traits']; armorId?: string }>(x: T): T => ({
      ...x, ac: 12, armor: 'Purple Padded Armor', armorId: 'padded', armorTier: 'purple',
      traits: x.traits.filter((t) => t.name !== 'Homebrew Padded Armor'),
    })
    let added: Character[] = []
    setCharacters((cs) => {
      if (!cs.some((c) => c.sample)) return cs
      added = extraSamples().filter((x) => !cs.some((c) => c.id === x.id))
      return [...cs.map((c) => (c.id === 'sample-thorin' && isOldThorin(c) ? { ...fixThorin(c), purse: c.purse ?? { gold: 12, silver: 7 } } : c)), ...added]
    })
    setEncounter((e) => {
      if (!e.combatants.some((c) => c.sample)) return e
      const cs = e.combatants.map((c) => (c.characterId === 'sample-thorin' && isOldThorin(c) ? { ...fixThorin(c), prof: 2 } : c))
      const add = extraSamples().filter((x) => !cs.some((c) => c.characterId === x.id)).map(characterToCombatant)
      return { ...e, combatants: [...cs.filter((c) => c.side === 'party'), ...add, ...cs.filter((c) => c.side !== 'party')] }
    })
    void added
  }, [])

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

  const hasSamples = !online && (localChars.some((c) => c.sample) || localEnc.combatants.some((c) => c.sample) || pages.some((p) => p.sample))
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
    if (online) cloud.saveChar(c, cloud.chars.some((x) => x.id === c.id) ? undefined : myId)
    else setCharacters((cs) => (cs.some((x) => x.id === c.id) ? cs.map((x) => (x.id === c.id ? c : x)) : [...cs, c]))
    // keep battle copies in sync (HP in battle is preserved unless the sheet sets current HP)
    setEnc((e) => ({
      ...e,
      combatants: e.combatants.map((x) => x.characterId === c.id
        ? { ...x, name: c.name, ac: c.ac, armor: c.armor, maxHp: c.maxHp, hp: Math.min(typeof c.currentHp === 'number' ? c.currentHp : x.hp, c.maxHp), initMod: c.initMod, traits: c.traits, attacks: c.attacks,
            armorId: c.armorId, armorTier: c.armorTier, underId: c.underId, underTier: c.underTier, prof: charProf(c) }
        : x),
    }))
  }
  const deleteCharacter = (id: string) => (online ? cloud.deleteChar(id) : setCharacters((cs) => cs.filter((c) => c.id !== id)))

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">✦</span> Lorekeeper’s Table</div>
        <button className={'cloud-btn ' + (online ? (cloud.status === 'live' ? 'live' : cloud.status === 'error' ? 'err' : '') : '')} onClick={() => setCloudOpen(true)}>
          {online ? `${isDM ? '👑' : '🎲'} ${active!.name}${cloud.status === 'live' ? ' ●' : cloud.status === 'error' ? ' ⚠' : ' …'}` : session ? '☁ Campaigns' : '☁ Sign in'}
        </button>
      </header>
      {hasSamples && !bannerHidden && (
        <div className="sample-banner">
          <span>🧪 Sample data loaded so you can try things out.</span>
          <button className="link" onClick={removeSamples}>Remove samples</button>
          <button className="icon-btn sm" onClick={() => setBannerHidden(true)} aria-label="Hide">✕</button>
        </div>
      )}
      {online && !isDM && tab === 'battle' && <div className="live-banner">👁 Live view of {active!.name}’s battle — your DM runs combat. Damage they deal updates your sheet’s HP.</div>}
      {online && cloud.error && <div className="live-banner" style={{ borderColor: '#a83a28', background: '#2a1210' }}>⚠ Sync problem: {cloud.error} <button className="link" onClick={() => cloud.setError('')}>dismiss</button></div>}
      <main key={tab} className="fade-in">
        {tab === 'battle' && <Battle encounter={encounter} setEncounter={setEnc} characters={characters} />}
        {tab === 'characters' && (
          <>
            <Characters characters={characters} onSave={saveCharacter} onDelete={deleteCharacter} />
            {hasSamples && <div className="center pad"><button className="btn ghost danger" onClick={removeSamples}>Remove all sample data</button></div>}
          </>
        )}
        {tab === 'dice' && <Dice history={history} setHistory={setHistory} />}
        {tab === 'campaign' && <Campaign pages={pages} setPages={setPages} />}
      </main>
      {cloudOpen && (
        <CloudSheet session={session} campaigns={campaigns} activeId={active?.id ?? null} members={cloud.members}
          onSelect={(id) => setActiveId(id)} onRefresh={refreshCampaigns} onClose={() => { setCloudOpen(false); if (location.hash.includes('join=')) history_replace(tab) }}
          initialCode={joinCode} localCount={online ? localChars.filter((c) => !c.sample).length || localChars.length : 0} onCopyLocal={copyLocal} />
      )}
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
