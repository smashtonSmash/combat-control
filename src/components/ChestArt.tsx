import { useId } from 'react'
import type { Item } from '../types'

export type ChestPhase = 'closed' | 'opening' | 'open'

/** Hand-drawn SVG fantasy chest: grained planks, gold banding, rivets, lock. Lid hinges in 3D. */
export function ChestArt({ phase, small, drama = 0 }: { phase: ChestPhase; small?: boolean; drama?: number }) {
  const u = useId().replace(/:/g, '')
  const wood = `w${u}`, grain = `g${u}`, gold = `au${u}`, inner = `in${u}`
  const defs = (
    <defs>
      <linearGradient id={wood} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8a5329" /><stop offset=".55" stopColor="#6a3c1c" /><stop offset="1" stopColor="#3f220f" /></linearGradient>
      <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff1b0" /><stop offset=".35" stopColor="#e2b04a" /><stop offset=".7" stopColor="#a8741f" /><stop offset="1" stopColor="#6e4a12" /></linearGradient>
      <radialGradient id={inner} cx=".5" cy="0" r="1"><stop offset="0" stopColor="#ffe9a0" /><stop offset=".5" stopColor="#b0701c" /><stop offset="1" stopColor="#2a1607" /></radialGradient>
      <pattern id={grain} width="40" height="14" patternUnits="userSpaceOnUse">
        <path d="M0 4 Q10 2 20 5 T40 4 M0 10 Q12 12 22 9 T40 11" stroke="#2c1608" strokeOpacity=".35" fill="none" strokeWidth="1" />
        <ellipse cx="28" cy="7" rx="3" ry="1.4" fill="none" stroke="#2c1608" strokeOpacity=".3" />
      </pattern>
    </defs>
  )
  const rivets = (xs: number[], y: number) => xs.map((x) => <g key={x + '-' + y}><circle cx={x} cy={y} r="2.6" fill={`url(#${gold})`} stroke="#4a300a" strokeWidth=".6" /><circle cx={x - .8} cy={y - .8} r=".8" fill="#fff8d0" /></g>)
  return (
    <div className={`chest3d ${phase} ${small ? 'small' : ''} ${drama ? 'drama' + drama : ''}`} aria-hidden>
      <div className="chest-halo" /><div className="chest-beam" />
      <div className="chest-sparkles">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ ['--x' as string]: `${(i * 37) % 100}%`, ['--d' as string]: `${(i * 0.29) % 2.6}s`, ['--s' as string]: `${3 + (i % 4)}px` }} />)}</div>
      <svg className="chest-inner" viewBox="0 0 200 30"><ellipse cx="100" cy="15" rx="92" ry="14" fill={`url(#${inner})`} /></svg>
      <svg className="chest-base-svg" viewBox="0 0 200 110">
        {defs}
        <rect x="4" y="2" width="192" height="104" rx="6" fill={`url(#${wood})`} />
        <rect x="4" y="2" width="192" height="104" rx="6" fill={`url(#${grain})`} />
        {[36, 70].map((y) => <line key={y} x1="6" y1={y} x2="194" y2={y} stroke="#24110a" strokeOpacity=".6" strokeWidth="1.5" />)}
        <rect x="2" y="0" width="196" height="10" rx="3" fill={`url(#${gold})`} stroke="#4a300a" />
        <rect x="2" y="96" width="196" height="12" rx="4" fill={`url(#${gold})`} stroke="#4a300a" />
        {[26, 174].map((x) => <rect key={x} x={x - 9} y="0" width="18" height="108" fill={`url(#${gold})`} stroke="#4a300a" />)}
        {rivets([26, 174], 22)}{rivets([26, 174], 52)}{rivets([26, 174], 84)}{rivets([12, 60, 100, 140, 188], 102)}
        <g className="chest-lock">
          <path d="M84 6 h32 v30 q0 14 -16 18 q-16 -4 -16 -18 z" fill={`url(#${gold})`} stroke="#4a300a" strokeWidth="1.2" />
          <circle cx="100" cy="24" r="4.5" fill="#1a0e04" /><path d="M98 26 h4 l1.5 12 h-7 z" fill="#1a0e04" />
        </g>
      </svg>
      <div className="chest-lid3d">
        <svg viewBox="0 0 200 70">
          {defs}
          <path d="M4 70 V34 Q4 4 100 2 Q196 4 196 34 V70 z" fill={`url(#${wood})`} />
          <path d="M4 70 V34 Q4 4 100 2 Q196 4 196 34 V70 z" fill={`url(#${grain})`} />
          {[18, 40].map((y) => <path key={y} d={`M8 ${y + 8} Q100 ${y - 14} 192 ${y + 8}`} stroke="#24110a" strokeOpacity=".5" fill="none" strokeWidth="1.4" />)}
          {[26, 174].map((x) => <path key={x} d={`M${x - 9} 70 V${x < 100 ? 20 : 20} Q${x} ${x < 100 ? 12 : 12} ${x + 9} ${x < 100 ? 16 : 24} V70 z`} fill={`url(#${gold})`} stroke="#4a300a" />)}
          <rect x="2" y="58" width="196" height="12" rx="3" fill={`url(#${gold})`} stroke="#4a300a" />
          <path d="M88 58 h24 v12 h-24 z" fill={`url(#${gold})`} stroke="#4a300a" />
          {rivets([26, 174], 34)}{rivets([12, 60, 100, 140, 188], 64)}
          <path d="M100 18 l4 8 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1z" fill="#ffe28a" opacity=".85" />
        </svg>
      </div>
      <div className="chest-lid-inner">
        <svg viewBox="0 0 200 80">
          <path d="M4 80 V6 Q4 2 10 2 H190 Q196 2 196 6 V80 z" fill={`url(#${gold})`} stroke="#4a300a" />
          <path d="M14 78 V12 H186 V78 z" fill="#3a1f0c" />
          <path d="M14 78 V12 H186 V78 z" fill={`url(#${grain})`} />
          {[34, 56].map((y) => <line key={y} x1="14" y1={y} x2="186" y2={y} stroke="#1a0c04" strokeOpacity=".7" strokeWidth="1.5" />)}
          <path d="M14 78 V12 H186 V78 z" fill={`url(#${inner})`} opacity=".45" />
          {rivets([20, 180], 18)}{rivets([20, 180], 72)}
          <path d="M100 22 l7 14 15 2 -11 10 3 15 -14 -8 -14 8 3 -15 -11 -10 15 -2z" fill="#ffe28a" stroke="#a8741f" strokeWidth="1.2" />
        </svg>
      </div>
      <div className="chest-seam" /><div className="chest-keyglow" />
      <div className="chest-shadow" />
    </div>
  )
}

/** Small vector item icons per type. */
export function ItemIcon({ kind }: { kind: Item['kind'] | 'pouch' | 'coins' }) {
  const s = { width: 30, height: 30, viewBox: '0 0 32 32' }
  switch (kind) {
    case 'armor': return <svg {...s}><path d="M16 3 L27 7 V15 Q27 24 16 29 Q5 24 5 15 V7z" fill="#5f6b7a" stroke="#d6dde6" strokeWidth="1.5" /><path d="M16 6 V26" stroke="#d6dde6" /><path d="M8 13 H24" stroke="#d6dde6" /></svg>
    case 'weapon': return <svg {...s}><path d="M24 3 L29 3 29 8 13 24 8 19z" fill="#cfd8e3" stroke="#8a96a5" /><path d="M6 17 L15 26 M9 22 L4 27 M5 26 L6 27" stroke="#c99a3c" strokeWidth="3" strokeLinecap="round" /></svg>
    case 'consumable': return <svg {...s}><path d="M13 4 h6 v6 q7 3 7 11 a10 8 0 0 1 -20 0 q0 -8 7 -11z" fill="#c23a4a" stroke="#f2c0c6" strokeWidth="1.3" /><rect x="12" y="2" width="8" height="4" rx="1" fill="#a0683a" /><circle cx="12" cy="19" r="2" fill="#ffd0d6" opacity=".8" /></svg>
    case 'scroll': return <svg {...s}><rect x="7" y="6" width="18" height="20" fill="#efd9a6" stroke="#8a6a32" /><rect x="5" y="4" width="22" height="4" rx="2" fill="#c9a86a" stroke="#8a6a32" /><rect x="5" y="24" width="22" height="4" rx="2" fill="#c9a86a" stroke="#8a6a32" /><path d="M10 12 h12 M10 16 h10 M10 20 h8" stroke="#7a5a2a" /></svg>
    case 'pouch': return <svg {...s}><path d="M11 9 Q16 12 21 9 L23 11 Q29 18 26 25 Q16 31 6 25 Q3 18 9 11z" fill="#8a5a2e" stroke="#e2b04a" strokeWidth="1.3" /><path d="M10 8 Q16 4 22 8" stroke="#e2b04a" strokeWidth="2" fill="none" /><circle cx="16" cy="20" r="3.5" fill="#f0c95a" stroke="#8a6a12" /></svg>
    case 'coins': return <svg {...s}>{[[10, 22], [20, 23], [15, 14]].map(([x, y]) => <g key={x}><ellipse cx={x} cy={y} rx="7" ry="6" fill="#e9b93d" stroke="#8a6a12" strokeWidth="1.2" /><ellipse cx={x} cy={y} rx="4" ry="3.4" fill="none" stroke="#fff0b0" strokeOpacity=".7" /></g>)}</svg>
    default: return <svg {...s}><rect x="5" y="9" width="22" height="17" rx="2" fill="#9a6a3a" stroke="#e2b04a" /><path d="M5 14 H27 M16 9 V26" stroke="#e2b04a" /></svg>
  }
}
