import { useId, type ReactNode } from 'react'
import { DEPTH_PX, FIGURE_SCALE, RING_PX } from './projection'
import { WRESTLERS } from './sumoGame'

/**
 * Original paper-cutout art in a 160 × 180 sheet, like a real tonton-sumo figure: the
 * wrestler is drawn side-on in the right half, facing right, and the sheet is folded
 * down the middle (x = 80) along its back. The left half is the mirror image, so once
 * folded both outsides show the same profile. The figure stands on y = 170.
 */
const INK = '#4d3f35'
const CREASE = 80

/** A side-on face: one eye, a cheek behind it and the mouth toward the front. */
function Face({ x, y, mouth = 'smile', cheek = '#f19a8b' }: { x: number; y: number; mouth?: 'smile' | 'o' | 'grin'; cheek?: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx="4" ry="5.5" fill={INK} stroke="none" />
      <circle cx={x + 1.2} cy={y - 2} r="1.4" fill="#fff" opacity=".9" stroke="none" />
      <ellipse cx={x - 3} cy={y + 11} rx="7" ry="4.5" fill={cheek} opacity=".6" stroke="none" />
      {mouth === 'o' ? <ellipse cx={x + 13} cy={y + 11} rx="3.5" ry="4.5" fill="#b8574c" stroke={INK} strokeWidth="2" />
        : mouth === 'grin' ? <path d={`M${x + 7} ${y + 8} Q${x + 13} ${y + 19} ${x + 19} ${y + 7}Z`} fill="#b8574c" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          : <path d={`M${x + 8} ${y + 11} Q${x + 13} ${y + 15} ${x + 18} ${y + 9}`} fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />}
    </g>
  )
}

type Art = {
  /** The body outline. Only its right half (x ≥ 80) is used. */
  silhouette: string
  belt: number
  /** Where the outstretched hand ends, pushing toward the opponent; null when the art already reaches forward. */
  hand: [number, number] | null
  skin: string
  /** The frontmost point of the figure, which meets the opponent. */
  reach: number
  art: ReactNode
}

const ART: Record<string, Art> = {
  mochi: {
    silhouette: 'M18 170 Q10 122 32 96 Q52 70 80 68 Q108 70 128 96 Q150 122 142 170Z M80 70 Q88 46 106 40 Q110 58 80 70Z',
    belt: 138, hand: [158, 124], skin: '#fffaf0', reach: 158,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M80 70 Q88 46 106 40 Q110 58 80 70Z" fill="#8cc06e" />
        <path d="M18 170 Q10 122 32 96 Q52 70 80 68 Q108 70 128 96 Q150 122 142 170Z" fill="#fffaf0" />
        <path d="M92 84 Q110 84 122 96" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
        <Face x={112} y={102} />
      </g>
    ),
  },
  onigiri: {
    silhouette: 'M80 24 Q96 24 106 42 L148 134 Q160 170 126 170 L34 170 Q0 170 12 134 L54 42 Q64 24 80 24Z',
    belt: 140, hand: [158, 116], skin: '#fffdf7', reach: 158,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M80 24 Q96 24 106 42 L148 134 Q160 170 126 170 L34 170 Q0 170 12 134 L54 42 Q64 24 80 24Z" fill="#fffdf7" />
        <g fill="#e9e1cf" stroke="none"><ellipse cx="92" cy="54" rx="4" ry="2.5" /><ellipse cx="96" cy="128" rx="4" ry="2.5" /></g>
        <path d="M80 136 L120 136 L126 168 L80 168Z" fill="#2f4b3c" />
        <path d="M84 146 l34 0 M84 156 l36 0" stroke="#476a55" strokeWidth="2" />
        <circle cx="90" cy="38" r="5" fill="#d2525a" />
        <Face x={100} y={80} />
      </g>
    ),
  },
  pencil: {
    silhouette: 'M80 8 L112 64 L112 170 L48 170 L48 64Z',
    belt: 132, hand: [136, 112], skin: '#f7c843', reach: 136,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M80 8 L112 64 L48 64Z" fill="#f2cf9b" />
        <path d="M80 8 L90 26 L70 26Z" fill="#555" />
        <path d="M48 64 L112 64 L112 148 L48 148Z" fill="#f7c843" />
        <path d="M91 64 L91 148" stroke="#d9a326" strokeWidth="2" />
        <path d="M48 148 L112 148 L112 158 L48 158Z" fill="#c3c7c9" />
        <path d="M48 158 L112 158 L112 170 L48 170Z" fill="#f19aa6" />
        <Face x={94} y={82} mouth="o" />
      </g>
    ),
  },
  penguin: {
    silhouette: 'M80 22 Q132 22 136 96 Q140 146 124 164 L132 170 L28 170 L36 164 Q20 146 24 96 Q28 22 80 22Z M126 92 Q160 100 162 118 Q144 122 128 112Z M128 78 L146 84 L128 92Z',
    belt: 132, hand: null, skin: '#30455f', reach: 162,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M80 22 Q132 22 136 96 Q140 146 120 166 L40 166 Q20 146 24 96 Q28 22 80 22Z" fill="#30455f" />
        <path d="M104 52 Q132 60 132 108 Q132 156 106 162 Q94 140 94 106 Q94 70 104 52Z" fill="#fdfaf2" />
        <path d="M100 166 Q104 158 120 160 Q126 170 100 170Z" fill="#f2a33a" />
        <path d="M128 78 L146 84 L128 92Z" fill="#f2a33a" />
        <ellipse cx="114" cy="68" rx="4" ry="5.5" fill={INK} stroke="none" />
        <circle cx="115.2" cy="66" r="1.4" fill="#fff" opacity=".9" stroke="none" />
        <ellipse cx="114" cy="84" rx="6" ry="4" fill="#f19a8b" opacity=".6" stroke="none" />
        <path d="M126 92 Q160 100 162 118 Q144 122 128 112Z" fill="#30455f" />
      </g>
    ),
  },
  robot: {
    silhouette: 'M74 6 L86 6 L86 24 L114 24 Q122 24 122 32 L122 80 L136 84 L136 170 L24 170 L24 84 L38 80 L38 32 Q38 24 46 24 L74 24Z',
    belt: 134, hand: [162, 112], skin: '#93a8b6', reach: 162,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M84 26 L84 14" />
        <circle cx="84" cy="12" r="6" fill="#ef6a5a" />
        <rect x="40" y="26" width="80" height="54" rx="8" fill="#bfcbd3" />
        <rect x="88" y="36" width="26" height="34" rx="6" fill="#e9f6f3" />
        <rect x="28" y="86" width="104" height="72" rx="8" fill="#93a8b6" />
        <rect x="90" y="156" width="40" height="14" rx="3" fill="#6c7e8b" />
        <g stroke="none"><circle cx="96" cy="100" r="5" fill="#f4c542" /><circle cx="116" cy="100" r="5" fill="#ef6a5a" /></g>
        <rect x="100" y="44" width="8" height="10" rx="2" fill={INK} stroke="none" />
        <path d="M102 62 L112 62" strokeLinecap="round" />
        <circle cx="88" cy="54" r="5" fill="#93a8b6" />
      </g>
    ),
  },
  daikon: {
    silhouette: 'M80 74 Q86 44 98 18 Q112 22 104 52 Q118 28 132 36 Q118 62 82 74Z M50 74 Q80 62 110 74 Q122 122 108 170 L52 170 Q38 122 50 74Z',
    belt: 136, hand: [136, 116], skin: '#fdfcf6', reach: 136,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M80 74 Q86 44 98 18 Q112 22 104 52 Q118 28 132 36 Q118 62 82 74Z" fill="#6fae5b" />
        <path d="M50 74 Q80 62 110 74 Q122 122 108 170 L52 170 Q38 122 50 74Z" fill="#fdfcf6" />
        <path d="M50 74 Q80 64 110 74 Q112 86 110 92 Q80 82 50 92 Q48 84 50 74Z" fill="#cfe5a8" />
        <path d="M92 152 l8 2" stroke="#d6cfbd" strokeWidth="2" />
        <Face x={94} y={100} />
      </g>
    ),
  },
  octopus: {
    silhouette: 'M30 112 Q22 30 80 26 Q138 30 130 112 L142 170 L18 170Z',
    belt: 112, hand: null, skin: '#e4685a', reach: 160,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M34 118 Q24 150 18 170 L42 170 Q46 148 52 126 Q56 150 62 170 L82 170 Q80 150 80 128 Q84 150 98 170 L118 170 Q110 148 108 126 Q118 150 142 170 Q134 140 126 118Z" fill="#e4685a" />
        <path d="M126 88 Q150 88 158 76 Q164 84 156 94 Q146 104 126 104Z" fill="#e4685a" />
        <path d="M30 116 Q22 30 80 26 Q138 30 130 116 Q80 128 30 116Z" fill="#ef7f6c" />
        <path d="M30 60 Q80 44 130 60 L132 72 Q80 58 28 72Z" fill="#fffaf0" />
        <g fill="#f8b4a6" stroke="none"><circle cx="92" cy="152" r="3" /><circle cx="114" cy="150" r="3" /><circle cx="146" cy="88" r="2.5" /></g>
        <Face x={108} y={86} mouth="o" cheek="#c94a3e" />
      </g>
    ),
  },
  pudding: {
    silhouette: 'M80 30 Q94 30 92 44 Q104 56 106 66 L122 170 L38 170 L54 66 Q56 56 68 44 Q66 30 80 30Z',
    belt: 146, hand: [140, 124], skin: '#f8d870', reach: 140,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M54 66 Q80 58 106 66 L122 166 L38 166Z" fill="#f8d870" />
        <path d="M54 66 Q80 58 106 66 L109 84 Q80 96 51 84Z" fill="#9b5a2e" />
        <path d="M60 66 Q58 52 72 52 Q74 42 86 46 Q100 46 100 62 Q80 70 60 66Z" fill="#fffdf7" />
        <circle cx="84" cy="40" r="9" fill="#e2434d" />
        <path d="M84 31 Q88 22 96 20" fill="none" strokeLinecap="round" />
        <path d="M30 166 Q80 176 130 166 L130 170 L30 170Z" fill="#d7e6ef" />
        <Face x={92} y={104} />
      </g>
    ),
  },
  bread: {
    silhouette: 'M38 170 L38 74 Q16 68 18 44 Q22 16 56 20 Q80 4 104 20 Q138 16 142 44 Q144 68 122 74 L122 170Z',
    belt: 144, hand: [148, 122], skin: '#fbe8bf', reach: 148,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M38 170 L38 74 Q16 68 18 44 Q22 16 56 20 Q80 4 104 20 Q138 16 142 44 Q144 68 122 74 L122 170Z" fill="#c98a4b" />
        <path d="M46 162 L46 68 Q28 64 28 46 Q30 28 58 30 Q80 16 102 30 Q130 28 132 46 Q132 64 114 68 L114 162Z" fill="#fbe8bf" stroke="none" />
        <g fill="#efd39b" stroke="none"><ellipse cx="100" cy="50" rx="3" ry="2" /><ellipse cx="94" cy="140" rx="3" ry="2" /></g>
        <Face x={96} y={84} mouth="grin" />
      </g>
    ),
  },
  frog: {
    silhouette: 'M24 170 Q14 112 36 84 Q24 60 40 44 Q60 30 72 54 Q80 50 88 54 Q100 30 120 44 Q136 60 124 84 Q146 112 136 170Z',
    belt: 140, hand: [160, 118], skin: '#79bf63', reach: 160,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M24 170 Q14 112 36 84 Q24 60 40 44 Q60 30 72 54 Q80 50 88 54 Q100 30 120 44 Q136 60 124 84 Q146 112 136 170Z" fill="#79bf63" />
        <path d="M104 170 Q100 126 132 112 Q142 140 136 170Z" fill="#d7ecb0" stroke="none" />
        <circle cx="108" cy="56" r="13" fill="#fff" />
        <circle cx="112" cy="58" r="5.5" fill={INK} stroke="none" />
        <ellipse cx="108" cy="94" rx="8" ry="5" fill="#f19a8b" opacity=".6" stroke="none" />
        <path d="M100 82 Q118 90 130 80" fill="none" strokeLinecap="round" />
      </g>
    ),
  },
  rocket: {
    silhouette: 'M80 6 Q108 26 110 70 L110 120 L132 150 L132 170 L28 170 L28 150 L50 120 L50 70 Q52 26 80 6Z',
    belt: 140, hand: [134, 116], skin: '#eef1f4', reach: 134,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M50 122 L28 150 L28 170 L54 160Z M110 122 L132 150 L132 170 L106 160Z" fill="#e45a4f" />
        <path d="M50 64 L110 64 L110 160 Q80 168 50 160Z" fill="#eef1f4" />
        <path d="M80 6 Q108 26 110 64 L50 64 Q52 26 80 6Z" fill="#e45a4f" />
        <circle cx="96" cy="44" r="8" fill="#8fd0e8" />
        <path d="M70 160 L90 160 L86 170 L74 170Z" fill="#f4c542" />
        <Face x={92} y={86} />
      </g>
    ),
  },
  bear: {
    silhouette: 'M24 170 Q14 120 30 92 Q24 76 30 62 Q18 40 38 28 Q56 20 62 38 Q80 32 98 38 Q104 20 122 28 Q142 40 130 62 Q136 76 130 92 Q146 120 136 170Z M118 74 Q140 70 144 82 Q144 96 122 96Z',
    belt: 140, hand: [160, 120], skin: '#d9a46e', reach: 160,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <circle cx="102" cy="36" r="15" fill="#d9a46e" />
        <circle cx="102" cy="36" r="7" fill="#f0c9a0" stroke="none" />
        <path d="M24 170 Q14 120 32 94 Q24 76 32 60 Q50 34 80 34 Q110 34 128 60 Q136 76 128 94 Q146 120 136 170Z" fill="#d9a46e" />
        <path d="M118 74 Q140 70 144 82 Q144 96 122 96Z" fill="#f0d2b0" />
        <ellipse cx="141" cy="79" rx="4.5" ry="4" fill={INK} stroke="none" />
        <path d="M130 90 Q136 94 142 90" fill="none" strokeLinecap="round" />
        <ellipse cx="112" cy="64" rx="4" ry="5.5" fill={INK} stroke="none" />
        <circle cx="113.2" cy="62" r="1.4" fill="#fff" opacity=".9" stroke="none" />
        <ellipse cx="108" cy="80" rx="7" ry="4.5" fill="#f19a8b" opacity=".6" stroke="none" />
      </g>
    ),
  },
}

/** A short outstretched arm ending in a round fist at `hand`. */
const armPath = ([x, y]: [number, number]) => `M${x - 34} ${y - 7} L${x - 7} ${y - 7} A7 7 0 0 1 ${x - 7} ${y + 7} L${x - 34} ${y + 7}Z`
const outline = (art: Art) => (art.hand ? `${art.silhouette} ${armPath(art.hand)}` : art.silhouette)

/** Each half opens this far from the crease, so the two hands spread toward the opponent. */
const SPREAD = 0.42
const DEPTH_RATIO = DEPTH_PX / RING_PX
const RISE = Math.sqrt(1 - DEPTH_RATIO ** 2)
/** Light comes from the front left, toward the viewer. */
const LIGHT = { x: -0.5, z: -0.86 }
const PAPER_BACK = '#f4ead6'

const clean = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '')

/** The printed outside of one half: the side-on wrestler, facing right. */
export function PaperSheet({ index, belt }: { index: number; belt?: string }) {
  const art = ART[WRESTLERS[index]!.key]!
  const id = clean(useId())
  const shape = outline(art)
  return (
    <g>
      <defs>
        <clipPath id={`${id}-half`}><rect x={CREASE} y="-20" width="110" height="220" /></clipPath>
        <clipPath id={`${id}-body`}><path d={art.silhouette} /></clipPath>
      </defs>
      <g clipPath={`url(#${id}-half)`}>
        <path d={shape} fill="none" stroke="#d3c4a8" strokeWidth="16" strokeLinejoin="round" />
        <path d={shape} fill="#fffdf6" stroke="#fffdf6" strokeWidth="12" strokeLinejoin="round" />
        {art.art}
        {belt && (
          <g clipPath={`url(#${id}-body)`}>
            <rect x={CREASE} y={art.belt} width="80" height="15" fill={belt} />
            <rect x={CREASE} y={art.belt + 3} width="80" height="2" fill="#fff" opacity=".35" />
            <path d={`M${CREASE + 6} ${art.belt + 13} L${CREASE + 4} ${art.belt + 30} M${CREASE + 14} ${art.belt + 13} L${CREASE + 14} ${art.belt + 31}`} stroke={belt} strokeWidth="4" strokeLinecap="round" />
          </g>
        )}
        {art.hand && (
          <g stroke={INK} strokeWidth="3" strokeLinejoin="round" fill={art.skin}>
            <path d={`M${art.hand[0] - 34} ${art.hand[1] - 6} L${art.hand[0] - 8} ${art.hand[1] - 6} L${art.hand[0] - 8} ${art.hand[1] + 6} L${art.hand[0] - 34} ${art.hand[1] + 6}`} />
            <circle cx={art.hand[0] - 7} cy={art.hand[1]} r="7.5" />
          </g>
        )}
      </g>
    </g>
  )
}

/** The plain inside of one half, seen when that half opens away from the viewer. */
function PaperBack({ index }: { index: number }) {
  const art = ART[WRESTLERS[index]!.key]!
  const id = clean(useId())
  const shape = outline(art)
  return (
    <g>
      <defs><clipPath id={`${id}-half`}><rect x={CREASE} y="-20" width="110" height="220" /></clipPath></defs>
      <path d={shape} fill={PAPER_BACK} stroke={PAPER_BACK} strokeWidth="12" strokeLinejoin="round" clipPath={`url(#${id}-half)`} />
    </g>
  )
}

/**
 * A folded paper wrestler, projected as two half-panels hinged at the crease along its
 * back. Both halves open toward `heading` (0 faces right, in the box's x/z plane), so the
 * outside of the near half shows the wrestler side-on and the far half shows its blank
 * inside. The origin is the figure's middle on the box; the crease sits behind it so the
 * hands meet the opponent just as the bodies touch.
 */
export default function PaperWrestler({ index, belt, heading = 0 }: { index: number; belt?: string; heading?: number }) {
  const wrestler = WRESTLERS[index]!
  const art = ART[wrestler.key]!
  const id = clean(useId())
  const back = (art.reach - CREASE) * Math.cos(SPREAD) - (wrestler.stats.width * RING_PX) / FIGURE_SCALE
  const crease = { x: -back * Math.cos(heading), z: -back * Math.sin(heading) }
  const halves = ([1, -1] as const).map((side) => {
    const angle = heading + side * SPREAD
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const matrix = `matrix(${cos} ${-sin * DEPTH_RATIO} 0 ${RISE} ${crease.x - CREASE * cos} ${CREASE * sin * DEPTH_RATIO - 170 * RISE - crease.z * DEPTH_RATIO})`
    // The printed side faces away from the other half.
    const normal = { x: -side * sin, z: side * cos }
    const printed = normal.z < 0
    const light = (printed ? 1 : -1) * (LIGHT.x * normal.x + LIGHT.z * normal.z)
    return { side, matrix, depth: sin, printed, shade: Math.max(0, Math.min(0.32, (0.95 - light) * 0.3)) }
  }).sort((a, b) => b.depth - a.depth)
  const shape = outline(art)
  return (
    <g>
      <defs>
        <clipPath id={`${id}-half`}><rect x={CREASE} y="-20" width="110" height="220" /></clipPath>
      </defs>
      {halves.map(({ side, matrix, printed, shade }) => (
        <g key={side} transform={matrix} data-face={printed ? 'print' : 'blank'}>
          {printed ? <PaperSheet index={index} belt={belt} /> : <PaperBack index={index} />}
          <path d={shape} fill="#5a4330" stroke="#5a4330" strokeWidth="12" strokeLinejoin="round" opacity={shade} clipPath={`url(#${id}-half)`} />
        </g>
      ))}
    </g>
  )
}
