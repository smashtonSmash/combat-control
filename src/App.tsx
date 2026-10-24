import { clearEffects } from './effects'
import { migrateChestItems, migrateInventory } from './catalog'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Character, Chest, DiceRoll, Encounter, Item, WikiPage } from './types'
import { useStored } from './store'
import { charProf, characterToCombatant, extraSamples, sampleCharacters, sampleEncounter, samplePages } from './seed'
import Battle from './screens/Battle'
import Characters from './screens/Characters'
import Dice from './screens/Dice'
import Campaign from './screens/Campaign'
import Casino from './screens/Casino'
import Loot from './screens/Loot'
import Town from './screens/Town'
import Rules from './screens/Rules'
import { emptyParty, transferPurse, type PartyStash } from './party'
import { defaultTown, type TownState } from './fountain'
import { makeRecap, type RecapEvent, type RecapKind } from './recap'
import { RevealOverlay } from './components/Reveal'
import { addItem, removeItem } from './inventory'
import { effectiveSlots, isCaster } from './components/Spells'
import { loadSpells, restoreAll, spendSlot } from './spells'
import { applyDelta } from './casino/money'
import { listCampaigns, useCampaign, useSession, supabase, type CampaignInfo } from './cloud'
import { CloudSheet } from './components/Cloud'
import { PlayerNames } from './components/PlayerName'
import { playerDirectory } from './playerLabel'
import { uid } from './types'
import { migrateTiers } from './armor'

const emptyEncounter = (): Encounter => ({ combatants: [], round: 1, turnId: null, log: [] })
const joinFromHash = () => { const m = location.hash.match(/join=([A-Za-z0-9]+)/); return m ? m[1].toUpperCase() : undefined }

const TABS = [
  { id: 'battle', label: 'Battle', icon: '⚔️' },
  { id: 'characters', label: 'Characters', icon: '🛡️' },
  { id: 'dice', label: 'Dice', icon: '🎲' },
  { id: 'campaign', label: 'Campaign', icon: '📜' },
  { id: 'loot', label: 'Loot', icon: '💎' },
  { id: 'casino', label: 'Casino', icon: '🎰' },
  { id: 'town', label: 'Town', icon: '⛲' },
  { id: 'rules', label: 'DM', icon: '📋' },
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
          armorId: ch.armorId, armorTier: ch.armorTier, underId: ch.underId, underTier: ch.underTier, prof: charProf(ch), tierV: ch.tierV }
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
  const players = useMemo(() => playerDirectory(
    online
      ? cloud.chars.map((r) => ({ id: r.id, ownerId: r.owner_id, playerName: r.data.playerName }))
      : localChars.map((c) => ({ id: c.id, playerName: c.playerName })),
    online ? cloud.members : [],
  ), [online, cloud.chars, cloud.members, localChars])
  const encounter: Encounter = online ? (isDM ? dmEnc ?? emptyEncounter() : cloud.encounter ?? emptyEncounter()) : localEnc
  const setEnc = online ? (isDM ? setDmEncounter : () => { /* players watch the DM's battle */ }) : setEncounter
  const copyLocal = () => {
    const mine = localChars.filter((c) => !c.sample)
    const list = mine.length ? mine : localChars
    for (const c of list) cloud.saveChar({ ...structuredClone(c), id: uid(), sample: undefined }, myId)
    setCloudOpen(false)
  }

  // Tier rename: old 'mythic' → 'legendary' (idempotent, keyed by tierV)
  useEffect(() => {
    const needs = (x: { tierV?: number; armorTier?: string; underTier?: string }) => x.tierV !== 2 && (x.armorTier === 'mythic' || x.underTier === 'mythic')
    setCharacters((cs) => (cs.some(needs) ? cs.map(migrateTiers) : cs))
    // old Potion of Healing (2d4+2) → Green Healing Potion
    setCharacters((cs) => { const n = cs.map(migrateInventory); return n.some((x, i) => x !== cs[i]) ? n : cs })
    setEncounter((e) => { const cs = e.combatants.map(migrateInventory); return cs.some((x, i) => x !== e.combatants[i]) ? { ...e, combatants: cs } : e })
    setLocalChests((ks) => { const n = ks.map(migrateChestItems); return n.some((x, i) => x !== ks[i]) ? n : ks })
    setEncounter((e) => (e.combatants.some(needs) ? { ...e, combatants: e.combatants.map(migrateTiers) } : e))
  }, [])

  // One-time migration for saves made before the armor catalog existed (only touches SAMPLE data).
  useEffect(() => {
    if (localStorage.getItem('dnd.migrated.armor1')) return
    localStorage.setItem('dnd.migrated.armor1', '1')
    const isOldThorin = (t: { id?: string; armorId?: string }) => !t.armorId
    const fixThorin = <T extends { traits: Character['traits']; armorId?: string }>(x: T): T => ({
      ...x, ac: 12, armor: 'Ultra Rare Padded Armor', armorId: 'padded', armorTier: 'purple',
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
            armorId: c.armorId, armorTier: c.armorTier, armorDamaged: c.armorDamaged, underId: c.underId, underTier: c.underTier, prof: charProf(c), tierV: c.tierV }
        : x),
    }))
  }
  // Casino: change a character's coins (synced like any sheet edit). Uses the latest data via a ref.
  const charsRef = useRef(characters); charsRef.current = characters
  const adjustCoins = (id: string, delta: number) => {
    const c = charsRef.current.find((x) => x.id === id)
    if (!c) return false
    const purse = applyDelta(c.purse, delta)
    if (!purse) return false
    const next = { ...c, purse }
    charsRef.current = charsRef.current.map((x) => (x.id === id ? next : x))
    saveCharacter(next)
    return true
  }
  // ---- loot / inventory ----
  const [localChests, setLocalChests] = useStored<Chest[]>('chests', () => [])
  const [party, setParty] = useStored<PartyStash>('party', emptyParty)
  const [town, setTown] = useStored<TownState>('town', defaultTown)
  const [recap, setRecap] = useStored<RecapEvent[]>('sessionRecap', () => [])
  const [pendingLoot, setPendingLoot] = useStored<Item[]>('pendingLoot', () => [])
  const hydrated = useRef<string | null>(null)
  const chests = online ? cloud.chests : localChests
  const saveChest = (k: Chest) => (online ? cloud.saveChest(k) : setLocalChests((ks) => (ks.some((x) => x.id === k.id) ? ks.map((x) => (x.id === k.id ? k : x)) : [...ks, k])))
  const deleteChest = (id: string) => (online ? cloud.deleteChest(id) : setLocalChests((ks) => ks.filter((x) => x.id !== id)))
  // players see a full-screen reveal while the DM has a chest revealed
  const revealed = online && !isDM ? chests.find((k) => k.revealedAt) : undefined
  const [dismissedReveal, setDismissedReveal] = useState<number | null>(null)
  const showReveal = !!revealed && dismissedReveal !== revealed.revealedAt
  const allChars: Character[] = online ? cloud.chars.map((r) => r.data) : localChars
  // custom-origin ability budget: per campaign (DM sets it) or local when offline
  const [localBudget, setLocalBudget] = useStored<number>('originBudget', () => 3)
  const customBudget = online ? active?.settings?.originBudget ?? 3 : localBudget
  const setBudget = online
    ? (isDM ? async (n: number) => {
        setCampaigns((cs) => cs.map((x) => (x.id === active!.id ? { ...x, settings: { ...x.settings, originBudget: n } } : x)))
        await supabase.from('campaigns').update({ settings: { ...active!.settings, originBudget: n } }).eq('id', active!.id)
      } : undefined)
    : setLocalBudget
  const [localReroll, setLocalReroll] = useStored<boolean>('allowReroll', () => true)
  const allowReroll = online ? active?.settings?.allowReroll !== false : localReroll
  const setAllowReroll = online
    ? (isDM ? async (v: boolean) => {
        setCampaigns((cs) => cs.map((x) => (x.id === active!.id ? { ...x, settings: { ...x.settings, allowReroll: v } } : x)))
        await supabase.from('campaigns').update({ settings: { ...active!.settings, allowReroll: v } }).eq('id', active!.id)
      } : undefined)
    : setLocalReroll
  const homebrewKey = online && active?.settings?.homebrew ? active.id : ''
  useEffect(() => {
    if (!homebrewKey || !active?.settings?.homebrew) return
    if (hydrated.current === homebrewKey) return
    hydrated.current = homebrewKey
    const h = active.settings.homebrew
    if (h.party) setParty(h.party)
    if (h.town) setTown(h.town)
    if (h.recap) setRecap(h.recap)
  }, [homebrewKey, active?.settings?.homebrew, setParty, setTown, setRecap])
  const pushHomebrew = (patch: { party?: PartyStash; town?: TownState; recap?: RecapEvent[] }) => {
    if (!online || !isDM || !active) return
    const settings = { ...active.settings, homebrew: { ...active.settings?.homebrew, ...patch } }
    setCampaigns((cs) => cs.map((x) => (x.id === active.id ? { ...x, settings } : x)))
    void supabase.from('campaigns').update({ settings }).eq('id', active.id)
  }
  const note = (kind: RecapKind, text: string) => setRecap((rs) => {
    const next = [...rs, makeRecap(kind, text)].slice(-300)
    pushHomebrew({ recap: next })
    return next
  })
  const saveParty = (p: PartyStash) => { setParty(p); pushHomebrew({ party: p }) }
  const saveTown = (t: TownState) => { setTown(t); pushHomebrew({ town: t }) }
  const giveItemTo = (charId: string, item: Item) => {
    const c = allChars.find((x) => x.id === charId)
    if (c) { saveCharacter(addItem(c, item)); note('loot', `${c.name} received ${item.name}${item.qty > 1 ? ` ×${item.qty}` : ''}.`) }
  }
  const giveCoinsTo = (charId: string, gold: number, silver: number) => {
    const c = allChars.find((x) => x.id === charId)
    if (c) saveCharacter({ ...c, purse: { gold: (c.purse?.gold ?? 0) + gold, silver: (c.purse?.silver ?? 0) + silver } })
  }
  const transferCoins = async (fromId: string, toId: string, gold: number, silver: number) => {
    const from = allChars.find((x) => x.id === fromId)
    const to = allChars.find((x) => x.id === toId)
    if (!from || !to || fromId === toId) return
    const r = transferPurse(from.purse, to.purse, gold, silver)
    if (!r.ok) return
    if (online) {
      const err = await cloud.transferCoins(fromId, toId, gold, silver)
      if (err && isDM) { saveCharacter({ ...from, purse: r.from }); saveCharacter({ ...to, purse: r.to }) }
      if (!err) note('transfer', `${from.name} sends ${gold}g ${silver}s to ${to.name}.`)
      return
    }
    saveCharacter({ ...from, purse: r.from })
    saveCharacter({ ...to, purse: r.to })
    note('transfer', `${from.name} sends ${gold}g ${silver}s to ${to.name}.`)
  }
  const giveBetween = async (from: Character, toId: string, itemId: string) => {
    const item = (from.inventory ?? []).find((i) => i.id === itemId)
    if (!item) return false
    if (online) { await cloud.saveChar(from); return cloud.giveItem(from.id, toId, itemId) }
    giveItemTo(toId, { ...item, equipped: false })
    return true
  }

  // ---- spells ----
  // warm the offline cache with the SRD spell list
  useEffect(() => { const t = setTimeout(() => { loadSpells().catch(() => {}) }, 4000); return () => clearTimeout(t) }, [])
  const spendCharSlot = (charId: string, level: number) => {
    const c = allChars.find((x) => x.id === charId)
    if (!c) return
    const ns = spendSlot(effectiveSlots(c), level)
    if (ns) saveCharacter({ ...c, slots: ns })
  }
  const useScroll = (charId: string, itemId: string) => {
    const c = allChars.find((x) => x.id === charId)
    if (c) saveCharacter(removeItem(c, itemId, 1))
  }
  const restAll = (kind: 'long' | 'short') => {
    for (const c of allChars) {
      let n = kind === 'long' ? clearEffects(c, 'long') : c
      if (isCaster(c)) { const sl = effectiveSlots(c); if (kind === 'long' || sl.pact) n = { ...n, slots: restoreAll(sl) } }
      if (n !== c) saveCharacter(n)
    }
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
      <PlayerNames value={players}>
      <main key={tab} className="fade-in">
        {tab === 'battle' && <Battle encounter={encounter} setEncounter={setEnc} characters={characters} onSpendSlot={spendCharSlot} onUseScroll={useScroll} onRest={restAll} onUpdateChar={saveCharacter} portraits={Object.fromEntries(allChars.map((c) => [c.id, c.portrait]))} onRecap={note} onDrops={(items, source) => { setPendingLoot((xs) => [...items, ...xs].slice(0, 40)); void source }} />}
        {tab === 'characters' && (
          <>
            <Characters characters={characters} onSave={saveCharacter} onDelete={deleteCharacter} giveTargets={allChars.map((c) => ({ id: c.id, name: c.name }))} onGive={giveBetween} customBudget={customBudget} onBudget={setBudget} allowReroll={allowReroll} onAllowReroll={setAllowReroll} party={party} onParty={saveParty} canToggleParty={!online || isDM} onTransfer={transferCoins} onRecap={note} />
            {hasSamples && <div className="center pad"><button className="btn ghost danger" onClick={removeSamples}>Remove all sample data</button></div>}
          </>
        )}
        {tab === 'dice' && <Dice history={history} setHistory={setHistory} />}
        {tab === 'campaign' && <Campaign pages={pages} setPages={setPages} />}
        {tab === 'loot' && <Loot chests={chests} saveChest={saveChest} deleteChest={deleteChest} characters={allChars} onGiveItem={giveItemTo} onGiveCoins={giveCoinsTo} readOnly={online && !isDM} online={online} onOpenReveal={() => setDismissedReveal(null)} onSaveChar={saveCharacter} pendingLoot={pendingLoot} onPendingLoot={setPendingLoot} onRecap={note} />}
        {tab === 'casino' && <Casino characters={characters} adjust={adjustCoins} />}
        {tab === 'town' && <Town characters={allChars} town={town} onTown={saveTown} onSave={saveCharacter} isDM={!online || isDM} onRecap={note} />}
        {tab === 'rules' && <Rules recap={recap} onClearRecap={() => { setRecap([]); pushHomebrew({ recap: [] }) }} />}
      </main>
      {showReveal && revealed && <RevealOverlay chest={revealed} myChars={characters} onTake={(what, ref, charId, g, s) => cloud.takeLoot(revealed.id, charId, what, ref, g, s)} onClose={() => setDismissedReveal(revealed.revealedAt ?? null)} />}
      </PlayerNames>
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
