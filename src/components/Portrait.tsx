import { useEffect, useRef, useState } from 'react'
import { supabase } from '../cloud'

const cache = new Map<string, { url: string; exp: number }>()
/** Resolve a stored portrait ref (data: URL or sb:<path>?v=) to something an <img> can show. */
export function usePortraitUrl(ref?: string) {
  const [url, setUrl] = useState<string | undefined>(() => (ref?.startsWith('sb:') ? cache.get(ref)?.url : ref))
  useEffect(() => {
    if (!ref) { setUrl(undefined); return }
    if (!ref.startsWith('sb:')) { setUrl(ref); return }
    const hit = cache.get(ref)
    if (hit && hit.exp > Date.now()) { setUrl(hit.url); return }
    let live = true
    const path = ref.slice(3).split('?')[0]
    supabase.storage.from('portraits').createSignedUrl(path, 60 * 60 * 24 * 7).then(({ data }) => {
      if (data?.signedUrl) { cache.set(ref, { url: data.signedUrl, exp: Date.now() + 1000 * 60 * 60 * 24 * 6 }); if (live) setUrl(data.signedUrl) }
    })
    return () => { live = false }
  }, [ref])
  return url
}

export function Portrait({ src, name, size = 56, className = '' }: { src?: string; name?: string; size?: number; className?: string }) {
  const url = usePortraitUrl(src)
  const initials = (name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={'portrait ' + className} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {url ? <img src={url} alt={name ? `${name} portrait` : 'portrait'} draggable={false} /> : <span>{initials}</span>}
    </div>
  )
}

/** Upload a data URL portrait to Storage; returns the 'sb:' ref to store on the character. */
export async function uploadPortrait(campaignId: string, charId: string, dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob()
  const path = `${campaignId}/${charId}.jpg`
  const { error } = await supabase.storage.from('portraits').upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' })
  if (error) throw error
  const ref = `sb:${path}?v=${Date.now()}`
  cache.set(ref, { url: dataUrl, exp: Date.now() + 1000 * 60 * 60 })
  return ref
}

/** Pick a photo (camera or gallery), pan/zoom to crop a square, export ~512px JPEG data URL. */
export function PortraitPicker({ onPick, onCancel }: { onPick: (dataUrl: string) => void; onCancel: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const BOX = 280
  const load = (f?: File) => {
    if (!f) return
    const r = new FileReader()
    r.onload = () => { const i = new Image(); i.onload = () => { setImg(i); setZoom(1); setOff({ x: 0, y: 0 }) }; i.src = r.result as string }
    r.readAsDataURL(f)
  }
  // image drawn to "cover" the square box, then zoomed + offset
  const base = img ? BOX / Math.min(img.width, img.height) : 1
  const w = img ? img.width * base * zoom : 0, h = img ? img.height * base * zoom : 0
  const clampOff = (o: { x: number; y: number }) => ({ x: Math.max(-(w - BOX) / 2, Math.min((w - BOX) / 2, o.x)), y: Math.max(-(h - BOX) / 2, Math.min((h - BOX) / 2, o.y)) })
  const o = clampOff(off)
  const done = () => {
    if (!img) return
    const OUT = 512, s = OUT / BOX, cv = document.createElement('canvas')
    cv.width = cv.height = OUT
    const ctx = cv.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, (BOX / 2 - w / 2 + o.x) * s, (BOX / 2 - h / 2 + o.y) * s, w * s, h * s)
    onPick(cv.toDataURL('image/jpeg', 0.85))
  }
  return (
    <div className="pp-backdrop" onClick={onCancel}>
      <div className="pp-sheet" onClick={(e) => e.stopPropagation()}>
        <b className="pp-title">Character portrait</b>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => load(e.target.files?.[0])} data-testid="portrait-file" />
        {!img ? (
          <button className="pp-drop" onClick={() => fileRef.current?.click()}>📷<span>Take a photo or choose from gallery</span></button>
        ) : (
          <>
            <div className="pp-box" style={{ width: BOX, height: BOX }}
              onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, ox: o.x, oy: o.y } }}
              onPointerMove={(e) => { const d = drag.current; if (d) setOff(clampOff({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y })) }}
              onPointerUp={() => { drag.current = null }}>
              <img src={img.src} alt="" draggable={false} style={{ width: w, height: h, transform: `translate(${BOX / 2 - w / 2 + o.x}px, ${BOX / 2 - h / 2 + o.y}px)` }} />
              <div className="pp-ring" />
            </div>
            <label className="pp-zoom">🔍 <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(+e.target.value)} /></label>
            <div className="small muted center">Drag to position · pinch-free zoom slider</div>
          </>
        )}
        <div className="row">
          <button className="btn grow" onClick={onCancel}>Cancel</button>
          {img && <button className="btn grow" onClick={() => fileRef.current?.click()}>Change</button>}
          <button className="btn primary grow" disabled={!img} onClick={done}>Use photo</button>
        </div>
      </div>
    </div>
  )
}
