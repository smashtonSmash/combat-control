import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { APP_URL, createCampaign, joinCampaign, leaveCampaign, supabase, type CampaignInfo, type MemberInfo } from '../cloud'
import { Sheet, TextField } from './Sheet'

export function CloudSheet({ session, campaigns, activeId, members, onSelect, onRefresh, onClose, initialCode, localCount, onCopyLocal }: {
  session: Session | null; campaigns: CampaignInfo[]; activeId: string | null; members: MemberInfo[]
  onSelect: (id: string | null) => void; onRefresh: () => Promise<void>; onClose: () => void
  initialCode?: string; localCount: number; onCopyLocal: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [campName, setCampName] = useState('')
  const [code, setCode] = useState(initialCode ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const run = async (f: () => Promise<unknown>) => {
    setBusy(true); setMsg('')
    try { await f() } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }
  const active = campaigns.find((c) => c.id === activeId)

  if (!session) {
    return (
      <Sheet open onClose={onClose} title="☁ Play together">
        <p className="small muted">Sign in so your party’s sheets sync live between phones. Without signing in, everything stays on this phone.</p>
        {initialCode && <div className="reminder"><div className="reminder-head">Invite code {initialCode}</div>Sign in or create an account, then you’ll join.</div>}
        <TextField label="Email" value={email} onChange={setEmail} placeholder="you@example.com" />
        <label className="field"><span>Password (6+ characters)</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
        <TextField label="Your name (for new accounts)" value={name} onChange={setName} placeholder="Ashton" />
        <div className="row">
          <button className="btn primary grow" disabled={busy || !email || password.length < 6} onClick={() => run(async () => {
            const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
            if (error) throw error
          })}>Sign in</button>
          <button className="btn grow" disabled={busy || !email || password.length < 6} onClick={() => run(async () => {
            const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() }, emailRedirectTo: APP_URL } })
            if (error) throw error
            if (!data.session) setMsg('Check your email to confirm, then sign in.')
          })}>Create account</button>
        </div>
        <button className="link small" disabled={busy || !email} onClick={() => run(async () => {
          const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: APP_URL } })
          if (error) throw error
          setMsg('Magic link sent — open it on this phone.')
        })}>Or email me a sign-in link instead</button>
        {msg && <div className="small" style={{ marginTop: 8 }}>{msg}</div>}
      </Sheet>
    )
  }

  const me = session.user
  const myName = (me.user_metadata?.display_name as string) || me.email || ''
  return (
    <Sheet open onClose={onClose} tall title="☁ Campaigns">
      <div className="row between small"><span>Signed in as <b>{myName}</b></span>
        <button className="link small" onClick={() => { onSelect(null); supabase.auth.signOut() }}>Sign out</button></div>

      {active && (
        <div className="panel">
          <div className="row between"><b>{active.name}</b><span className="badge">{active.role === 'dm' ? '👑 DM' : '🎲 Player'}</span></div>
          {active.role === 'dm' && (
            <>
              <div className="mini-label">Join code — give this to your players</div>
              <div className="join-code">{active.join_code}</div>
              <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(`${APP_URL}#join=${active.join_code}`); setMsg('Invite link copied!') }}>📋 Copy invite link</button>
            </>
          )}
          <div className="mini-label">Members</div>
          {members.map((m) => <div key={m.user_id} className="small">{m.role === 'dm' ? '👑' : '🎲'} {m.display_name || 'Player'}{m.user_id === me.id ? ' (you)' : ''}</div>)}
          {localCount > 0 && <button className="btn sm" onClick={onCopyLocal}>⬆ Copy my {localCount} offline character{localCount > 1 ? 's' : ''} into this campaign</button>}
          {active.role === 'player' && <button className="link small danger" onClick={() => run(async () => { await leaveCampaign(active.id, me.id); onSelect(null); await onRefresh() })}>Leave campaign</button>}
        </div>
      )}

      <div className="mini-label">Your campaigns</div>
      <div className="chips-row wrap">
        <button className={'chip ' + (!activeId ? 'on' : '')} onClick={() => onSelect(null)}>📱 Offline (this phone only)</button>
        {campaigns.map((c) => (
          <button key={c.id} className={'chip ' + (c.id === activeId ? 'on' : '')} onClick={() => onSelect(c.id)}>{c.role === 'dm' ? '👑' : '🎲'} {c.name}</button>
        ))}
      </div>

      <div className="panel">
        <b>🎲 Join a campaign</b>
        <div className="row">
          <input className="grow" placeholder="Join code (e.g. 7F3A9C)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="btn primary" disabled={busy || code.trim().length < 4} onClick={() => run(async () => {
            const id = await joinCampaign(code, myName); await onRefresh(); onSelect(id); setCode(''); setMsg('Joined! Make or copy your character in the Characters tab.')
          })}>Join</button>
        </div>
      </div>
      <div className="panel">
        <b>👑 Start a campaign (you’re the DM)</b>
        <div className="row">
          <input className="grow" placeholder="Campaign name" value={campName} onChange={(e) => setCampName(e.target.value)} />
          <button className="btn" disabled={busy || !campName.trim()} onClick={() => run(async () => {
            const c = await createCampaign(campName.trim()); await onRefresh(); onSelect(c.id); setCampName('')
          })}>Create</button>
        </div>
      </div>
      {msg && <div className="small">{msg}</div>}
    </Sheet>
  )
}
