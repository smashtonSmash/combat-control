import { createClient, type Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabaseConfig'
import type { Character, Chest, Encounter } from './types'
import { migrateTiers } from './armor'
const normEnc = (e: Encounter | null) => (e ? { ...e, combatants: (e.combatants ?? []).map(migrateTiers) } : e)

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const APP_URL = 'https://smashtonsmash.github.io/combat-control/'

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return { session, ready }
}

export interface CampaignInfo { id: string; name: string; join_code: string; role: 'dm' | 'player'; dm_id: string; settings?: { originBudget?: number } }
export interface MemberInfo { user_id: string; role: 'dm' | 'player'; display_name: string }

export async function listCampaigns(userId: string): Promise<CampaignInfo[]> {
  const { data, error } = await supabase.from('members').select('role, campaigns(id, name, join_code, dm_id, settings)').eq('user_id', userId)
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).filter((r: any) => r.campaigns).map((r: any) => ({ ...r.campaigns, role: r.role }))
}
export async function createCampaign(name: string) {
  const { data, error } = await supabase.from('campaigns').insert({ name }).select().single()
  if (error) throw error
  return data as { id: string; join_code: string }
}
export async function joinCampaign(code: string, name: string) {
  const { data, error } = await supabase.rpc('join_campaign', { code, name })
  if (error) throw error
  return data as string
}
export async function leaveCampaign(cid: string, userId: string) {
  const { error } = await supabase.from('members').delete().eq('campaign_id', cid).eq('user_id', userId)
  if (error) throw error
}

export interface CloudChar { id: string; owner_id: string; data: Character }

/** Live view of a campaign: characters + DM's encounter, kept in sync via realtime. */
export function useCampaign(cid: string | null) {
  const [chars, setChars] = useState<CloudChar[]>([])
  const [encounter, setEnc] = useState<Encounter | null>(null)
  const [members, setMembers] = useState<MemberInfo[]>([])
  const [chests, setChests] = useState<Chest[]>([])
  const [status, setStatus] = useState<'off' | 'loading' | 'live' | 'error'>('off')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!cid) return
    const [c, e, m, k] = await Promise.all([
      supabase.from('characters').select('id, owner_id, data').eq('campaign_id', cid),
      supabase.from('encounters').select('data').eq('campaign_id', cid).maybeSingle(),
      supabase.from('members').select('user_id, role, display_name').eq('campaign_id', cid),
      supabase.from('chests').select('id, data').eq('campaign_id', cid),
    ])
    if (c.error) { setStatus('error'); setError(c.error.message); return }
    setChars((c.data ?? []).map((r) => ({ ...r, data: migrateTiers({ ...(r.data as Character), id: r.id }) })))
    setEnc(normEnc((e.data?.data as Encounter) ?? null))
    setMembers((m.data ?? []) as MemberInfo[])
    setChests((k.data ?? []).map((r) => ({ ...(r.data as Chest), id: r.id })))
  }, [cid])

  useEffect(() => {
    if (!cid) { setChars([]); setEnc(null); setMembers([]); setChests([]); setStatus('off'); return }
    setStatus('loading')
    load()
    const ch = supabase.channel('campaign-' + cid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'characters', filter: `campaign_id=eq.${cid}` }, (p) => {
        if (p.eventType === 'DELETE') { const id = (p.old as { id: string }).id; setChars((cs) => cs.filter((x) => x.id !== id)); return }
        const r = p.new as CloudChar
        const row = { id: r.id, owner_id: r.owner_id, data: migrateTiers({ ...r.data, id: r.id }) }
        setChars((cs) => (cs.some((x) => x.id === r.id) ? cs.map((x) => (x.id === r.id ? row : x)) : [...cs, row]))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'encounters', filter: `campaign_id=eq.${cid}` }, (p) => {
        if (p.eventType !== 'DELETE') setEnc(normEnc((p.new as { data: Encounter }).data))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chests', filter: `campaign_id=eq.${cid}` }, (p) => {
        if (p.eventType === 'DELETE') { const id = (p.old as { id: string }).id; setChests((ks) => ks.filter((x) => x.id !== id)); return }
        const r = p.new as { id: string; data: Chest }
        const row = { ...r.data, id: r.id }
        setChests((ks) => (ks.some((x) => x.id === r.id) ? ks.map((x) => (x.id === r.id ? row : x)) : [...ks, row]))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `campaign_id=eq.${cid}` }, () => { load() })
      .subscribe((s) => { if (s === 'SUBSCRIBED') { setStatus('live'); load() } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setStatus('error') })
    // refresh when the phone wakes up / comes back online
    const wake = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake)
    return () => { supabase.removeChannel(ch); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', wake) }
  }, [cid, load])

  const saveChar = useCallback(async (c: Character, ownerId?: string) => {
    if (!cid) return
    setChars((cs) => {
      const ex = cs.find((x) => x.id === c.id)
      const row = { id: c.id, owner_id: ex?.owner_id ?? ownerId ?? '', data: c }
      return ex ? cs.map((x) => (x.id === c.id ? row : x)) : [...cs, row]
    })
    const { error } = await supabase.from('characters').upsert({ id: c.id, campaign_id: cid, data: c, ...(ownerId ? { owner_id: ownerId } : {}) })
    if (error) { setError(error.message); load(); return }
    // portraits picked as data URLs are moved to Storage once the character row exists
    if (c.portrait?.startsWith('data:')) {
      try {
        const { uploadPortrait } = await import('./components/Portrait')
        const ref = await uploadPortrait(cid, c.id, c.portrait)
        const n = { ...c, portrait: ref }
        setChars((cs) => cs.map((x) => (x.id === c.id ? { ...x, data: n } : x)))
        await supabase.from('characters').update({ data: n }).eq('id', c.id)
      } catch (e) { setError('Portrait upload failed: ' + (e as Error).message) }
    }
  }, [cid, load])
  const deleteChar = useCallback(async (id: string) => {
    setChars((cs) => cs.filter((x) => x.id !== id))
    const { error } = await supabase.from('characters').delete().eq('id', id)
    if (error) { setError(error.message); load() }
  }, [load])

  const saveChest = useCallback(async (k: Chest) => {
    if (!cid) return
    setChests((ks) => (ks.some((x) => x.id === k.id) ? ks.map((x) => (x.id === k.id ? k : x)) : [...ks, k]))
    const { error } = await supabase.from('chests').upsert({ id: k.id, campaign_id: cid, data: k, updated_at: new Date().toISOString() })
    if (error) { setError(error.message); load() }
  }, [cid, load])
  const deleteChest = useCallback(async (id: string) => {
    setChests((ks) => ks.filter((x) => x.id !== id))
    const { error } = await supabase.from('chests').delete().eq('id', id)
    if (error) { setError(error.message); load() }
  }, [load])
  const giveItem = useCallback(async (fromId: string, toId: string, itemId: string) => {
    const { error } = await supabase.rpc('give_item', { from_id: fromId, to_id: toId, item_id: itemId })
    if (error) { setError(error.message); return false }
    load(); return true
  }, [load])

  const takeLoot = useCallback(async (chestId: string, charId: string, what: 'item' | 'pouch' | 'coins', ref: string | null, gold = 0, silver = 0): Promise<string | null> => {
    const { error } = await supabase.rpc('take_loot', { chest_id: chestId, char_id: charId, what, ref, want_gold: gold, want_silver: silver })
    load()
    return error ? error.message : null
  }, [load])

  // DM: push encounter (debounced)
  const t = useRef<number | undefined>(undefined)
  const pushEncounter = useCallback((e: Encounter) => {
    if (!cid) return
    clearTimeout(t.current)
    t.current = window.setTimeout(async () => {
      const { error } = await supabase.from('encounters').upsert({ campaign_id: cid, data: e, updated_at: new Date().toISOString() })
      if (error) setError(error.message)
    }, 500)
  }, [cid])

  return { chars, encounter, members, chests, saveChest, deleteChest, giveItem, takeLoot, status, error, setError, saveChar, deleteChar, pushEncounter, reload: load }
}
