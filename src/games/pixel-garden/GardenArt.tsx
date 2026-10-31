import type { PlotStage } from './garden'

// 本アプリ用に描いたドット絵。整数座標の四角だけで描き、拡大しても輪郭を保つ。
const FLOWERS = [
  ['..pp..pp..', '..pPppPp..', '..pPPPPp..', '..pPPPPp..', '...pPPp...', '....pp....'],
  ['....pp....', '...pPPp...', '.pppPPppp.', '.pPPCCPPp.', '..pPCCPp..', '...pPPp...', '....pp....'],
  ['...pppp...', '..pPPPPp..', '.pPPCCPPp.', '.pPCCCCPp.', '.pPPCCPPp.', '..pPPPPp..', '...pppp...'],
] as const

const PALETTES = [
  ['#b84967', '#ff91aa', '#ffdf73'],
  ['#a67122', '#ffdc66', '#835238'],
  ['#6f59a4', '#c0a2ed', '#fff3ba'],
  ['#b65b35', '#ffae76', '#ffe3a1'],
  ['#bb5d8d', '#ffc1db', '#ffe787'],
  ['#41819a', '#a4e4f2', '#fff1b1'],
] as const

function Pixels({ rows, colors, x = 0, y = 0 }: { rows: readonly string[]; colors: Record<string, string>; x?: number; y?: number }) {
  return <g transform={`translate(${x} ${y})`}>
    {rows.flatMap((row, py) => [...row].map((pixel, px) => colors[pixel]
      ? <rect key={`${px}-${py}`} x={px} y={py} width="1" height="1" fill={colors[pixel]} /> : null))}
  </g>
}

export function FlowerArt({ variant, stage = 'flower' }: { variant: number; stage?: PlotStage }) {
  const [edge, petal, center] = PALETTES[variant % PALETTES.length]
  return <svg viewBox="0 0 20 24" aria-hidden="true" shapeRendering="crispEdges">
    {stage === 'soil' ? <>
      <path d="M8 17h4v2H8zM7 18h2v3H7zM9 19h3v2H9z" fill="#ffe5a1" />
      <rect x="8" y="18" width="2" height="1" fill="#fff6ce" />
    </> : stage === 'picked' ? <path d="M6 18h3v2H6zM9 20h2v-2h2v-2h2v3h-2v3H9z" fill="#d9edb6" /> : <>
      <path d={stage === 'sprout' ? 'M9 16h2v6H9zM5 14h4v2H5zM7 16h2v2H7zM11 13h4v2h-4zM11 15h2v2h-2z' : 'M9 8h2v14H9zM4 13h3v2H4zM6 15h3v2H6zM11 16h3v-2h3v3h-3v2h-3z'} fill="#377855" />
      {stage === 'bud' && <path d="M8 6h4v2h1v4h-2v2H9v-2H7V8h1z" fill={petal} />}
      {stage === 'flower' && <Pixels rows={FLOWERS[variant % FLOWERS.length]} colors={{ p: edge, P: petal, C: center }} x={5} y={4} />}
      <rect x="9" y="20" width="1" height="2" fill="#8bbd69" />
    </>}
  </svg>
}

export function ActionArt({ water }: { water: boolean }) {
  return <svg viewBox="0 0 12 12" aria-hidden="true" shapeRendering="crispEdges">
    {water ? <>
      <path d="M5 1h2v2h1v2h1v2h1v3H8v1H4v-1H2V7h1V5h1V3h1z" fill="#438aa9" />
      <path d="M4 7h1v2H4zM5 9h2v1H5z" fill="#c5f1ff" />
    </> : <path d="M5 1h2v3h1v1h3v2H8v1H7v3H5V8H4V7H1V5h3V4h1z" fill="#fff0a5" />}
  </svg>
}

export function RabbitArt() {
  return <svg viewBox="0 0 24 26" aria-hidden="true" shapeRendering="crispEdges">
    <Pixels rows={[
      '....ww....ww....', '...wPPw..wPPw...', '...wPPw..wPPw...', '...wPPw..wPPw...',
      '...wPPw..wPPw...', '...wwwwwwwwww...', '..wWWWWWWWWWWw..', '.wWWWWWWWWWWWWw.',
      '.wWWWkWWWWkWWWw.', '.wWWWkWWWWkWWWw.', '.wWPPWWppWWPPWw.', '..wWWWWkkWWWWw..',
      '...wwWWWWWWww...', '....wggggggw....', '...wWgGggGgWw...', '...wWggggggWw...',
      '....wggggggw....', '...wwww..wwww...',
    ]} x={4} y={4} colors={{ w: '#c5aa86', W: '#fff6df', P: '#edb6b0', p: '#b67c72', k: '#4a4943', g: '#56816a', G: '#e1bc69' }} />
  </svg>
}

export function FriendArt({ id }: { id: number }) {
  const rows = [
    ['.pp...pp.', 'pPPpkpPPp', 'pPPPkPPPp', '.pppkppp.', '..ppkpp..', '.pPPkPPp.', '..pp.pp..'],
    ['..ww.ww..', '.wWWwWWw.', '..wwwww..', '.yykyky..', 'yYYkYkYk.', '.yykyky..', '...k.k...'],
    ['....bbbb.', '...bBBkb.', '..bBBBBby', 'bbBBBBbb.', '.bBBBBb..', '..bbbb...', '...k.k...'],
  ][id]
  return <svg viewBox="0 0 12 12" aria-hidden="true" shapeRendering="crispEdges">
    <Pixels rows={rows} x={1} y={2} colors={{ p: '#a85a88', P: '#f6abd0', k: '#4a4943', w: '#98bfc2', W: '#eafaff', y: '#b98a31', Y: '#ffe088', b: '#467f98', B: '#99d6e6' }} />
  </svg>
}

export function BouquetArt({ round }: { round: number }) {
  return <svg viewBox="0 0 120 92" aria-hidden="true" shapeRendering="crispEdges">
    {[[22, 13], [46, 5], [70, 13], [32, 30], [56, 26], [75, 33]].map(([x, y], index) =>
      <svg key={index} x={x - 10} y={y - 8} width="40" height="48"><FlowerArt variant={index + round} /></svg>)}
    <path d="M31 45h12v5h10v4h16v-4h12v-5h10v13h-6v10h-6v10h-6v9H49v-9h-6V68h-6V58h-6z" fill="#fff1bd" />
    <path d="M31 45h6v13h6v10h6v10h24v9H49v-9h-6V68h-6V58h-6z" fill="#d5b780" />
    <path d="M48 68h26v6H48zM43 65h9v5h-9zM70 65h9v5h-9zM53 74h5v10h-5zM65 74h5v10h-5z" fill="#bf6783" />
    <path d="M56 67h10v8H56z" fill="#ed9ead" />
    <path d="M16 34h3v3h3v3h-3v3h-3v-3h-3v-3h3zM99 17h3v3h3v3h-3v3h-3v-3h-3v-3h3z" fill="#fff3c6" />
  </svg>
}

export function GardenScenery() {
  return <svg viewBox="0 0 160 68" preserveAspectRatio="xMidYMax slice" aria-hidden="true" shapeRendering="crispEdges">
    <path d="M13 12h16v3h5v6H8v-5h5zM112 7h18v4h8v6h-32v-6h6z" fill="#fff8df" />
    <path d="M74 5h10v3h3v10h-3v3H74v-3h-3V8h3z" fill="#ffda76" />
    <path d="M0 45h12v-7h22v7h15v7h28v-9h21v-8h24v10h21v-7h17v30H0z" fill="#a8c795" />
    <path d="M0 55h30v-7h19v6h25v-4h26v7h22v-7h38v18H0z" fill="#7ea77b" />
    <path d="M8 38h3v30H8zM149 32h3v36h-3z" fill="#84674b" />
    <path d="M0 21h16v6h5v15h-5v6H0zM140 17h15v5h5v23h-19v-6h-7V26h6z" fill="#507c60" />
    <path d="M0 24h13v5h4v7H5v5H0zM144 20h11v7h5v8h-18v-6h-4v-3h6z" fill="#67986e" />
    <path d="M0 63h160v5H0z" fill="#5a895c" />
    <path d="M23 57h3v11h-3zM37 57h3v11h-3zM120 57h3v11h-3zM134 57h3v11h-3zM21 60h21v3H21zM118 60h21v3h-21z" fill="#f1dfb1" />
  </svg>
}
