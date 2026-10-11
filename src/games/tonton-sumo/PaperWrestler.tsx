import { useId, type ReactNode } from 'react'
import { DEPTH_PX, RING_PX } from './projection'
import { WRESTLERS } from './sumoGame'

/**
 * Original paper-cutout art, drawn flat in a 160 × 180 sheet. The fold runs down the
 * middle (x = 80) and the figure stands on y = 170, like a real folded paper wrestler.
 */
const INK = '#4d3f35'

function Face({ y, gap = 15, cheeks = '#f19a8b', mouth = 'smile' }: { y: number; gap?: number; cheeks?: string; mouth?: 'smile' | 'o' | 'grin' }) {
  return (
    <g>
      <g fill={INK}><ellipse cx={80 - gap} cy={y} rx="4" ry="5.5" /><ellipse cx={80 + gap} cy={y} rx="4" ry="5.5" /></g>
      <g fill="#fff" opacity=".9"><circle cx={81 - gap} cy={y - 2} r="1.4" /><circle cx={81 + gap} cy={y - 2} r="1.4" /></g>
      <g fill={cheeks} opacity=".6"><ellipse cx={80 - gap - 11} cy={y + 10} rx="8" ry="4.5" /><ellipse cx={80 + gap + 11} cy={y + 10} rx="8" ry="4.5" /></g>
      {mouth === 'o' ? <ellipse cx="80" cy={y + 13} rx="4" ry="5" fill="#b8574c" stroke={INK} strokeWidth="2" />
        : mouth === 'grin' ? <path d={`M70 ${y + 9} Q80 ${y + 22} 90 ${y + 9}Z`} fill="#b8574c" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          : <path d={`M73 ${y + 10} Q80 ${y + 17} 87 ${y + 10}`} fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />}
    </g>
  )
}

type Art = { silhouette: string; belt: number; art: ReactNode }

const ART: Record<string, Art> = {
  mochi: {
    silhouette: 'M18 170 Q10 122 32 96 Q52 70 80 68 Q108 70 128 96 Q150 122 142 170Z M80 70 Q72 46 90 38 Q100 52 80 70Z',
    belt: 138,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M80 70 Q72 46 90 38 Q100 52 80 70Z" fill="#8cc06e" />
        <path d="M18 170 Q10 122 32 96 Q52 70 80 68 Q108 70 128 96 Q150 122 142 170Z" fill="#fffaf0" />
        <path d="M40 100 Q56 84 74 82" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
        <Face y={108} />
      </g>
    ),
  },
  onigiri: {
    silhouette: 'M80 24 Q96 24 106 42 L148 134 Q160 170 126 170 L34 170 Q0 170 12 134 L54 42 Q64 24 80 24Z',
    belt: 122,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M80 24 Q96 24 106 42 L148 134 Q160 170 126 170 L34 170 Q0 170 12 134 L54 42 Q64 24 80 24Z" fill="#fffdf7" />
        <g fill="#e9e1cf" stroke="none"><ellipse cx="62" cy="62" rx="4" ry="2.5" /><ellipse cx="102" cy="74" rx="4" ry="2.5" /><ellipse cx="40" cy="112" rx="4" ry="2.5" /></g>
        <path d="M54 136 L106 136 L110 168 L50 168Z" fill="#2f4b3c" />
        <path d="M60 144 l38 0 M60 154 l40 0" stroke="#476a55" strokeWidth="2" />
        <circle cx="80" cy="50" r="5" fill="#d2525a" />
        <Face y={86} gap={14} />
      </g>
    ),
  },
  pencil: {
    silhouette: 'M80 8 L112 64 L112 170 L48 170 L48 64Z',
    belt: 126,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M80 8 L112 64 L48 64Z" fill="#f2cf9b" />
        <path d="M80 8 L90 26 L70 26Z" fill="#555" />
        <path d="M48 64 L112 64 L112 148 L48 148Z" fill="#f7c843" />
        <path d="M69 64 L69 148 M91 64 L91 148" stroke="#d9a326" strokeWidth="2" />
        <path d="M48 148 L112 148 L112 158 L48 158Z" fill="#c3c7c9" />
        <path d="M48 158 L112 158 L112 170 L48 170Z" fill="#f19aa6" />
        <Face y={86} gap={12} mouth="o" />
      </g>
    ),
  },
  penguin: {
    silhouette: 'M80 22 Q132 22 136 96 Q140 146 124 164 L132 170 L28 170 L36 164 Q20 146 24 96 Q28 22 80 22Z M26 92 Q2 120 12 136 Q28 124 32 104Z M134 92 Q158 120 148 136 Q132 124 128 104Z',
    belt: 128,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M26 92 Q2 120 12 136 Q28 124 32 104Z M134 92 Q158 120 148 136 Q132 124 128 104Z" fill="#30455f" />
        <path d="M80 22 Q132 22 136 96 Q140 146 120 166 L40 166 Q20 146 24 96 Q28 22 80 22Z" fill="#30455f" />
        <path d="M80 50 Q116 54 116 108 Q116 160 80 162 Q44 160 44 108 Q44 54 80 50Z" fill="#fdfaf2" />
        <path d="M44 166 Q48 158 62 160 Q66 170 44 170Z M116 166 Q112 158 98 160 Q94 170 116 170Z" fill="#f2a33a" />
        <Face y={78} gap={14} />
        <path d="M72 88 L88 88 L80 98Z" fill="#f2a33a" />
      </g>
    ),
  },
  robot: {
    silhouette: 'M74 6 L86 6 L86 24 L114 24 Q122 24 122 32 L122 80 L136 84 L136 170 L24 170 L24 84 L38 80 L38 32 Q38 24 46 24 L74 24Z',
    belt: 130,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M80 26 L80 14" />
        <circle cx="80" cy="12" r="6" fill="#ef6a5a" />
        <rect x="40" y="26" width="80" height="54" rx="8" fill="#bfcbd3" />
        <rect x="50" y="36" width="60" height="34" rx="6" fill="#e9f6f3" />
        <rect x="28" y="86" width="104" height="72" rx="8" fill="#93a8b6" />
        <rect x="30" y="156" width="40" height="14" rx="3" fill="#6c7e8b" />
        <rect x="90" y="156" width="40" height="14" rx="3" fill="#6c7e8b" />
        <g stroke="none"><circle cx="58" cy="102" r="5" fill="#f4c542" /><circle cx="80" cy="102" r="5" fill="#6dc0b3" /><circle cx="102" cy="102" r="5" fill="#ef6a5a" /></g>
        <g fill={INK} stroke="none"><rect x="62" y="46" width="8" height="10" rx="2" /><rect x="90" y="46" width="8" height="10" rx="2" /></g>
        <path d="M70 62 L90 62" strokeLinecap="round" />
      </g>
    ),
  },
  daikon: {
    silhouette: 'M80 74 Q58 50 44 22 Q62 14 76 44 Q74 12 86 6 Q96 30 88 50 Q104 18 120 26 Q110 54 82 74Z M50 74 Q80 62 110 74 Q122 122 108 170 L52 170 Q38 122 50 74Z',
    belt: 132,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M80 74 Q58 50 44 22 Q62 14 76 44 Q74 12 86 6 Q96 30 88 50 Q104 18 120 26 Q110 54 82 74Z" fill="#6fae5b" />
        <path d="M50 74 Q80 62 110 74 Q122 122 108 170 L52 170 Q38 122 50 74Z" fill="#fdfcf6" />
        <path d="M50 74 Q80 64 110 74 Q112 86 110 92 Q80 82 50 92 Q48 84 50 74Z" fill="#cfe5a8" />
        <path d="M58 148 l8 2 M98 150 l6 -2" stroke="#d6cfbd" strokeWidth="2" />
        <Face y={106} gap={13} />
      </g>
    ),
  },
  octopus: {
    silhouette: 'M30 112 Q22 30 80 26 Q138 30 130 112 L142 170 L18 170Z',
    belt: 112,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M34 118 Q24 150 18 170 L42 170 Q46 148 52 126 Q56 150 62 170 L82 170 Q80 150 80 128 Q84 150 98 170 L118 170 Q110 148 108 126 Q118 150 142 170 Q134 140 126 118Z" fill="#e4685a" />
        <path d="M30 116 Q22 30 80 26 Q138 30 130 116 Q80 128 30 116Z" fill="#ef7f6c" />
        <path d="M30 60 Q80 44 130 60 L132 72 Q80 58 28 72Z" fill="#fffaf0" />
        <g fill="#f8b4a6" stroke="none"><circle cx="48" cy="150" r="3" /><circle cx="78" cy="152" r="3" /><circle cx="110" cy="150" r="3" /></g>
        <Face y={88} gap={15} cheeks="#c94a3e" mouth="o" />
      </g>
    ),
  },
  pudding: {
    silhouette: 'M80 30 Q94 30 92 44 Q104 56 106 66 L122 170 L38 170 L54 66 Q56 56 68 44 Q66 30 80 30Z',
    belt: 142,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M54 66 Q80 58 106 66 L122 166 L38 166Z" fill="#f8d870" />
        <path d="M54 66 Q80 58 106 66 L109 84 Q80 96 51 84Z" fill="#9b5a2e" />
        <path d="M60 66 Q58 52 72 52 Q74 42 86 46 Q100 46 100 62 Q80 70 60 66Z" fill="#fffdf7" />
        <circle cx="80" cy="40" r="9" fill="#e2434d" />
        <path d="M80 31 Q84 22 92 20" fill="none" strokeLinecap="round" />
        <path d="M30 166 Q80 176 130 166 L130 170 L30 170Z" fill="#d7e6ef" />
        <Face y={112} gap={14} />
      </g>
    ),
  },
  bread: {
    silhouette: 'M38 170 L38 74 Q16 68 18 44 Q22 16 56 20 Q80 4 104 20 Q138 16 142 44 Q144 68 122 74 L122 170Z',
    belt: 140,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M38 170 L38 74 Q16 68 18 44 Q22 16 56 20 Q80 4 104 20 Q138 16 142 44 Q144 68 122 74 L122 170Z" fill="#c98a4b" />
        <path d="M46 162 L46 68 Q28 64 28 46 Q30 28 58 30 Q80 16 102 30 Q130 28 132 46 Q132 64 114 68 L114 162Z" fill="#fbe8bf" stroke="none" />
        <g fill="#efd39b" stroke="none"><ellipse cx="60" cy="54" rx="3" ry="2" /><ellipse cx="100" cy="60" rx="3" ry="2" /><ellipse cx="70" cy="132" rx="3" ry="2" /></g>
        <Face y={90} gap={14} mouth="grin" />
      </g>
    ),
  },
  frog: {
    silhouette: 'M24 170 Q14 112 36 84 Q24 60 40 44 Q60 30 72 54 Q80 50 88 54 Q100 30 120 44 Q136 60 124 84 Q146 112 136 170Z',
    belt: 136,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M24 170 Q14 112 36 84 Q24 60 40 44 Q60 30 72 54 Q80 50 88 54 Q100 30 120 44 Q136 60 124 84 Q146 112 136 170Z" fill="#79bf63" />
        <path d="M50 170 Q44 120 80 112 Q116 120 110 170Z" fill="#d7ecb0" stroke="none" />
        <circle cx="52" cy="58" r="13" fill="#fff" /><circle cx="108" cy="58" r="13" fill="#fff" />
        <g fill={INK} stroke="none"><circle cx="54" cy="60" r="5.5" /><circle cx="106" cy="60" r="5.5" /></g>
        <g fill="#f19a8b" opacity=".6" stroke="none"><ellipse cx="40" cy="96" rx="9" ry="5" /><ellipse cx="120" cy="96" rx="9" ry="5" /></g>
        <path d="M54 88 Q80 108 106 88" fill="none" strokeLinecap="round" />
      </g>
    ),
  },
  rocket: {
    silhouette: 'M80 6 Q108 26 110 70 L110 120 L132 150 L132 170 L28 170 L28 150 L50 120 L50 70 Q52 26 80 6Z',
    belt: 132,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M50 122 L28 150 L28 170 L54 160Z M110 122 L132 150 L132 170 L106 160Z" fill="#e45a4f" />
        <path d="M50 64 L110 64 L110 160 Q80 168 50 160Z" fill="#eef1f4" />
        <path d="M80 6 Q108 26 110 64 L50 64 Q52 26 80 6Z" fill="#e45a4f" />
        <circle cx="80" cy="86" r="14" fill="#8fd0e8" />
        <path d="M74 80 Q78 76 84 78" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <path d="M70 160 L90 160 L86 170 L74 170Z" fill="#f4c542" />
        <Face y={114} gap={13} />
      </g>
    ),
  },
  bear: {
    silhouette: 'M24 170 Q14 120 30 92 Q24 76 30 62 Q18 40 38 28 Q56 20 62 38 Q80 32 98 38 Q104 20 122 28 Q142 40 130 62 Q136 76 130 92 Q146 120 136 170Z',
    belt: 134,
    art: (
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <g fill="#d9a46e"><circle cx="42" cy="40" r="16" /><circle cx="118" cy="40" r="16" /></g>
        <g fill="#f0c9a0" stroke="none"><circle cx="42" cy="40" r="8" /><circle cx="118" cy="40" r="8" /></g>
        <path d="M24 170 Q14 120 32 94 Q24 76 32 60 Q50 34 80 34 Q110 34 128 60 Q136 76 128 94 Q146 120 136 170Z" fill="#d9a46e" />
        <ellipse cx="80" cy="92" rx="20" ry="14" fill="#f0d2b0" />
        <ellipse cx="80" cy="86" rx="6" ry="4.5" fill={INK} stroke="none" />
        <Face y={70} gap={20} mouth="smile" />
      </g>
    ),
  },
}

/** Fold angle of each half away from flat, and the camera tilt used to project the paper. */
const FOLD = 0.4
const DEPTH_RATIO = DEPTH_PX / RING_PX
const RISE = Math.sqrt(1 - DEPTH_RATIO ** 2)
const MAX_TURN = Math.PI / 2 - FOLD - 0.15

const clean = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '')

/** Flat cutout art, used inside the fold and anywhere a plain sheet is enough. */
export function PaperSheet({ index, belt }: { index: number; belt?: string }) {
  const art = ART[WRESTLERS[index]!.key]!
  const id = clean(useId())
  return (
    <g>
      <defs><clipPath id={`${id}-shape`}><path d={art.silhouette} /></clipPath></defs>
      <path d={art.silhouette} fill="none" stroke="#d3c4a8" strokeWidth="16" strokeLinejoin="round" />
      <path d={art.silhouette} fill="#fffdf6" stroke="#fffdf6" strokeWidth="12" strokeLinejoin="round" />
      {art.art}
      {belt && (
        <g clipPath={`url(#${id}-shape)`}>
          <rect x="0" y={art.belt} width="160" height="15" fill={belt} />
          <rect x="0" y={art.belt + 3} width="160" height="2" fill="#fff" opacity=".35" />
          <path d={`M72 ${art.belt + 13} L70 ${art.belt + 30} M80 ${art.belt + 13} L80 ${art.belt + 31} M88 ${art.belt + 13} L90 ${art.belt + 30}`} stroke={belt} strokeWidth="4" strokeLinecap="round" />
        </g>
      )}
    </g>
  )
}

type Half = 'left' | 'right'

/**
 * A folded paper wrestler, projected as two half-panels meeting at the crease.
 * `turn` swivels the fold toward the right (positive) or left (negative).
 * The origin is where the crease touches the box.
 */
export default function PaperWrestler({ index, belt, turn = 0 }: { index: number; belt?: string; turn?: number }) {
  const art = ART[WRESTLERS[index]!.key]!
  const id = clean(useId())
  const swivel = Math.max(-MAX_TURN, Math.min(MAX_TURN, turn))
  const halves = (['left', 'right'] as Half[]).map((half) => {
    const angle = half === 'right' ? FOLD + swivel : Math.PI - FOLD + swivel
    const ux = Math.cos(angle)
    const depth = Math.sin(angle)
    const sign = half === 'right' ? 1 : -1
    const matrix = `matrix(${sign * ux} ${-sign * depth * DEPTH_RATIO} 0 ${RISE} ${-sign * 80 * ux} ${sign * 80 * depth * DEPTH_RATIO - 170 * RISE})`
    // The printed side faces outward; light comes from the front left.
    const normalX = sign * Math.sin(angle)
    const normalDepth = -sign * Math.cos(angle)
    const light = -0.5 * normalX - 0.86 * normalDepth
    return { half, matrix, depth, shade: Math.max(0, Math.min(0.32, (0.95 - light) * 0.3)) }
  }).sort((a, b) => b.depth - a.depth)
  return (
    <g>
      <defs>
        <clipPath id={`${id}-left`}><rect x="-20" y="-20" width="100" height="220" /></clipPath>
        <clipPath id={`${id}-right`}><rect x="80" y="-20" width="100" height="220" /></clipPath>
        <clipPath id={`${id}-shape`}><path d={art.silhouette} /></clipPath>
      </defs>
      {halves.map(({ half, matrix, shade }) => (
        <g key={half} transform={matrix}>
          <g clipPath={`url(#${id}-${half})`}>
            <PaperSheet index={index} belt={belt} />
            <path d={art.silhouette} fill="#5a4330" stroke="#5a4330" strokeWidth="12" strokeLinejoin="round" opacity={shade} />
          </g>
        </g>
      ))}
      <g transform={halves[1]!.matrix}>
        <path d="M80 0 L80 172" stroke="#7a6247" strokeWidth="1.8" opacity=".4" clipPath={`url(#${id}-shape)`} />
      </g>
    </g>
  )
}
