import { Fragment, useMemo, useState, type ReactNode } from 'react'
import type { Category, WikiPage } from '../types'
import { CATEGORIES, uid } from '../types'
import { Sheet } from '../components/Sheet'

const CAT_ICON: Record<Category, string> = { NPC: '🧙', Location: '🏰', Session: '📅', Lore: '📜', Item: '💎', Faction: '⚑', Other: '📝' }

function inline(text: string, open: (t: string) => void): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[\[[^\]]+\]\])/g
  let last = 0, m: RegExpExecArray | null, k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const t = m[0]
    if (t.startsWith('**')) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>)
    else if (t.startsWith('[[')) { const title = t.slice(2, -2); out.push(<button key={k++} className="wikilink" onClick={() => open(title)}>{title}</button>) }
    else out.push(<em key={k++}>{t.slice(1, -1)}</em>)
    last = m.index + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function Markdown({ text, open }: { text: string; open: (t: string) => void }) {
  const blocks: ReactNode[] = []
  let list: ReactNode[] = []
  const flush = () => { if (list.length) { blocks.push(<ul key={blocks.length}>{list}</ul>); list = [] } }
  text.split('\n').forEach((line, i) => {
    if (/^\s*[-*] /.test(line)) { list.push(<li key={i}>{inline(line.replace(/^\s*[-*] /, ''), open)}</li>); return }
    flush()
    if (line.startsWith('### ')) blocks.push(<h4 key={i}>{inline(line.slice(4), open)}</h4>)
    else if (line.startsWith('## ')) blocks.push(<h3 key={i}>{inline(line.slice(3), open)}</h3>)
    else if (line.startsWith('# ')) blocks.push(<h2 key={i}>{inline(line.slice(2), open)}</h2>)
    else if (line.trim()) blocks.push(<p key={i}>{inline(line, open)}</p>)
  })
  flush()
  return <div className="md">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>
}

export default function Campaign({ pages, setPages }: { pages: WikiPage[]; setPages: (f: (p: WikiPage[]) => WikiPage[]) => void }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | 'All'>('All')
  const [viewId, setViewId] = useState<string | null>(null)
  const [draft, setDraft] = useState<WikiPage | null>(null)

  const list = useMemo(() => {
    const s = q.toLowerCase()
    return pages.filter((p) => (cat === 'All' || p.category === cat) && (!s || p.title.toLowerCase().includes(s) || p.body.toLowerCase().includes(s)))
      .sort((a, b) => b.updated - a.updated)
  }, [pages, q, cat])

  const view = pages.find((p) => p.id === viewId)
  const openTitle = (t: string) => {
    const p = pages.find((x) => x.title.toLowerCase() === t.toLowerCase())
    if (p) { setViewId(p.id) } else { setViewId(null); setDraft({ id: uid(), title: t, category: 'Other', body: '', updated: Date.now() }) }
  }
  const save = (p: WikiPage) => {
    setPages((ps) => ps.some((x) => x.id === p.id) ? ps.map((x) => (x.id === p.id ? { ...p, updated: Date.now() } : x)) : [{ ...p, updated: Date.now() }, ...ps])
    setDraft(null); setViewId(p.id)
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <h1>Campaign</h1>
        <button className="btn primary" onClick={() => setDraft({ id: uid(), title: '', category: 'NPC', body: '', updated: Date.now() })}>＋ Page</button>
      </div>
      <input className="search" placeholder="🔍 Search notes…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips-row">
        {(['All', ...CATEGORIES] as const).map((c) => (
          <button key={c} className={'chip ' + (cat === c ? 'on' : '')} onClick={() => setCat(c)}>{c === 'All' ? 'All' : `${CAT_ICON[c]} ${c}`}</button>
        ))}
      </div>
      {list.length === 0 && <div className="empty">{pages.length ? 'Nothing matches.' : 'Your campaign wiki is empty. Add NPCs, places and session notes!'}</div>}
      <div className="page-list">
        {list.map((p) => (
          <button key={p.id} className="page-card" onClick={() => setViewId(p.id)}>
            <span className="page-icon">{CAT_ICON[p.category]}</span>
            <div className="grow">
              <b>{p.title || 'Untitled'}</b>
              <div className="muted small clamp">{p.body.replace(/[#*[\]]/g, '').slice(0, 120)}</div>
            </div>
            <span className="tag">{p.category}</span>
          </button>
        ))}
      </div>

      {view && !draft && (
        <Sheet open tall onClose={() => setViewId(null)} title={<>{CAT_ICON[view.category]} {view.title}</>}
          footer={<button className="btn big" onClick={() => setDraft({ ...view })}>✏️ Edit</button>}>
          <Markdown text={view.body} open={openTitle} />
          <div className="muted small pad">Updated {new Date(view.updated).toLocaleString()}</div>
        </Sheet>
      )}
      {draft && (
        <Sheet open tall onClose={() => setDraft(null)} title={pages.some((p) => p.id === draft.id) ? 'Edit page' : 'New page'}
          footer={<button className="btn big primary" disabled={!draft.title.trim()} onClick={() => save(draft)}>Save page</button>}>
          <label className="field"><span>Title</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Mayor Grelda" /></label>
          <div className="chips-row wrap">
            {CATEGORIES.map((c) => <button key={c} className={'chip ' + (draft.category === c ? 'on' : '')} onClick={() => setDraft({ ...draft, category: c })}>{CAT_ICON[c]} {c}</button>)}
          </div>
          <label className="field"><span>Text</span>
            <textarea rows={14} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              placeholder={'# Heading\n**bold**, *italic*\n- bullet list\nLink pages: [[Thornvale]]'} /></label>
          <div className="muted small">Tip: # heading · **bold** · *italic* · - list · [[Page title]] links</div>
          {pages.some((p) => p.id === draft.id) && (
            <button className="btn ghost danger" onClick={() => { if (confirm('Delete this page?')) { setPages((ps) => ps.filter((p) => p.id !== draft.id)); setDraft(null); setViewId(null) } }}>🗑 Delete page</button>
          )}
        </Sheet>
      )}
    </div>
  )
}
