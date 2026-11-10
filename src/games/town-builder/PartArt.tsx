import type { ReactElement } from 'react'
import type { BuildingId, TilePart, ToolId } from './parts'
import type { Ground } from './town'
import { directions, pathOf, segmentsOf } from './trackGeometry'
import { CAR_COLORS, TRAIN_COLORS } from './vehicles'
import styles from './PartArt.module.css'

// まちの え。どの マスも 0〜100 の viewBox に えがく。
// まど（windows）は よるに あかりが つくので、からだ（body）とは わけて もつ。

type Rect = readonly [x: number, y: number, width: number, height: number]
type Bulb = readonly [cx: number, cy: number, r: number]
type BuildingArt = { body: ReactElement; windows?: readonly Rect[]; bulbs?: readonly Bulb[] }

const LINE = { stroke: '#46404f', strokeWidth: 2.4, strokeLinejoin: 'round' as const }
const shadow = <ellipse cx="50" cy="88" rx="38" ry="5" fill="#00000026" />

function Clock({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return <g>
    <circle cx={cx} cy={cy} r={r} fill="#ffffff" {...LINE} strokeWidth={1.8} />
    <path d={`M${cx} ${cy - r * 0.65} L${cx} ${cy} L${cx + r * 0.5} ${cy}`} stroke="#46404f" strokeWidth={1.6} fill="none" strokeLinecap="round" />
  </g>
}

function grid(xs: readonly number[], ys: readonly number[], width: number, height: number): Rect[] {
  return ys.flatMap((y) => xs.map((x) => [x, y, width, height] as const))
}

const BUILDINGS: Record<BuildingId, BuildingArt> = {
  house: {
    body: <g>{shadow}
      <rect x="64" y="20" width="9" height="18" fill="#a65b3e" {...LINE} />
      <rect x="20" y="46" width="60" height="40" fill="#fff3d6" {...LINE} />
      <path d="M12 50 L50 16 L88 50 Z" fill="#ef5a4f" {...LINE} />
      <rect x="44" y="62" width="13" height="24" rx="2" fill="#b9773f" {...LINE} />
    </g>,
    windows: [[25, 56, 13, 11], [63, 56, 13, 11]],
  },
  'house-blue': {
    body: <g>{shadow}
      <rect x="22" y="40" width="56" height="46" fill="#f4f0ff" {...LINE} />
      <path d="M14 44 L30 18 L70 18 L86 44 Z" fill="#4d8be8" {...LINE} />
      <rect x="58" y="65" width="12" height="21" rx="2" fill="#7a5a44" {...LINE} />
    </g>,
    windows: [[28, 50, 12, 10], [58, 50, 12, 10], [28, 68, 12, 10]],
  },
  apartment: {
    body: <g>{shadow}
      <rect x="20" y="18" width="60" height="68" fill="#f6d7a7" {...LINE} />
      <rect x="17" y="12" width="66" height="8" fill="#b97a4b" {...LINE} />
      <rect x="44" y="72" width="12" height="14" fill="#7b5a43" {...LINE} />
    </g>,
    windows: [...grid([26, 44, 62], [26, 39, 52], 12, 9), [26, 72, 12, 9], [62, 72, 12, 9]],
  },
  tower: {
    body: <g>{shadow}
      <rect x="30" y="8" width="40" height="78" fill="#8fc1ea" {...LINE} />
      <rect x="27" y="4" width="46" height="6" fill="#4f78a8" {...LINE} />
      <rect x="44" y="74" width="12" height="12" fill="#3f5f86" {...LINE} />
    </g>,
    windows: grid([35, 53], [14, 24, 34, 44, 54, 64], 12, 6),
  },
  shop: {
    body: <g>{shadow}
      <rect x="12" y="38" width="76" height="48" fill="#ffffff" {...LINE} />
      <rect x="10" y="29" width="80" height="12" fill="#2fa56b" {...LINE} />
      <rect x="12" y="41" width="76" height="6" fill="#f08c2e" />
      <path d="M42 33 L58 33" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
    </g>,
    windows: [[18, 56, 30, 20], [54, 56, 16, 30]],
  },
  cake: {
    body: <g>{shadow}
      <rect x="16" y="44" width="68" height="42" fill="#ffe1ec" {...LINE} />
      <rect x="12" y="40" width="76" height="9" fill="#f06d9b" {...LINE} />
      {[19, 31, 43, 55, 67, 79].map((cx) => <circle key={cx} cx={cx} cy="50" r="5" fill="#f06d9b" />)}
      <rect x="36" y="22" width="28" height="18" rx="3" fill="#fff8f0" {...LINE} />
      <rect x="36" y="22" width="28" height="6" rx="3" fill="#ff9ec0" />
      <circle cx="50" cy="17" r="5" fill="#e53935" {...LINE} strokeWidth={1.8} />
      <rect x="58" y="62" width="14" height="24" rx="2" fill="#b26a4a" {...LINE} />
    </g>,
    windows: [[22, 60, 28, 16]],
  },
  office: {
    body: <g>{shadow}
      <rect x="22" y="8" width="56" height="78" fill="#aebfd3" {...LINE} />
      <rect x="19" y="4" width="62" height="6" fill="#6f7f95" {...LINE} />
      <rect x="43" y="74" width="14" height="12" fill="#4c5a6e" {...LINE} />
    </g>,
    windows: grid([28, 44, 60], [15, 27, 39, 51, 63], 12, 7),
  },
  depart: {
    body: <g>{shadow}
      <path d="M50 22 L50 5" stroke="#46404f" strokeWidth="2" />
      <path d="M50 5 L64 9 L50 13 Z" fill="#ffd43b" {...LINE} strokeWidth={1.6} />
      <rect x="8" y="28" width="84" height="58" fill="#f3dfbf" {...LINE} />
      <rect x="6" y="21" width="88" height="9" fill="#c0504d" {...LINE} />
      <rect x="34" y="61" width="32" height="6" fill="#c0504d" {...LINE} strokeWidth={1.8} />
    </g>,
    windows: [...grid([14, 33, 53, 72], [36, 49], 14, 9), [38, 67, 24, 19]],
  },
  factory: {
    body: <g>{shadow}
      <g className={styles.smoke}>
        <circle cx="78" cy="10" r="6" fill="#e9ecef" />
        <circle cx="86" cy="6" r="4" fill="#dee2e6" />
      </g>
      <rect x="70" y="18" width="12" height="68" fill="#b5583a" {...LINE} />
      <rect x="70" y="26" width="12" height="5" fill="#ffffff" />
      <path d="M10 86 L10 52 L24 40 L24 52 L38 40 L38 52 L52 40 L52 52 L66 40 L66 86 Z" fill="#cfc6b8" {...LINE} />
      <rect x="28" y="70" width="14" height="16" fill="#7e7468" {...LINE} />
    </g>,
    windows: [[15, 58, 10, 8], [48, 58, 10, 8], [48, 72, 10, 8]],
  },
  school: {
    body: <g>{shadow}
      <rect x="38" y="20" width="24" height="24" fill="#fff1d6" {...LINE} />
      <path d="M34 22 L50 8 L66 22 Z" fill="#e57373" {...LINE} />
      <rect x="10" y="42" width="80" height="44" fill="#fff1d6" {...LINE} />
      <rect x="8" y="38" width="84" height="6" fill="#8d6e63" {...LINE} />
      <Clock cx={50} cy={31} r={7} />
      <rect x="43" y="66" width="14" height="20" fill="#a0703c" {...LINE} />
    </g>,
    windows: grid([16, 28, 62, 74], [50, 68], 10, 9),
  },
  hospital: {
    body: <g>{shadow}
      <rect x="14" y="24" width="72" height="62" fill="#ffffff" {...LINE} />
      <rect x="12" y="19" width="76" height="7" fill="#9fb3c8" {...LINE} />
      <rect x="45" y="30" width="10" height="26" fill="#e53935" />
      <rect x="37" y="38" width="26" height="10" fill="#e53935" />
    </g>,
    windows: [[20, 32, 12, 10], [68, 32, 12, 10], [20, 52, 12, 10], [68, 52, 12, 10], [42, 68, 16, 18]],
  },
  fire: {
    body: <g>{shadow}
      <rect x="72" y="8" width="12" height="22" fill="#e2483d" {...LINE} />
      <rect x="12" y="32" width="76" height="54" fill="#e2483d" {...LINE} />
      <rect x="10" y="26" width="80" height="8" fill="#9e2a22" {...LINE} />
      {[18, 54].map((x) => <g key={x}>
        <rect x={x} y="56" width="28" height="30" fill="#f1eee8" {...LINE} />
        {[63, 70, 77].map((y) => <path key={y} d={`M${x + 2} ${y} L${x + 26} ${y}`} stroke="#c9c2b8" strokeWidth="2" />)}
      </g>)}
    </g>,
    windows: grid([20, 44, 68], [38], 12, 10),
  },
  police: {
    body: <g>{shadow}
      <rect x="43" y="16" width="14" height="10" rx="3" fill="#e53935" {...LINE} strokeWidth={1.8} />
      <rect x="14" y="34" width="72" height="52" fill="#eef3fb" {...LINE} />
      <rect x="12" y="26" width="76" height="11" fill="#2f4fa2" {...LINE} />
      <path d="M50 27 L52.4 30.4 L56.4 30.8 L53.4 33.4 L54.2 37 L50 35 L45.8 37 L46.6 33.4 L43.6 30.8 L47.6 30.4 Z" fill="#ffd43b" />
      <rect x="43" y="64" width="14" height="22" fill="#6a7fb3" {...LINE} />
    </g>,
    windows: grid([20, 66], [46, 66], 14, 11),
  },
  station: {
    body: <g>{shadow}
      <rect x="14" y="40" width="72" height="46" fill="#f2e4c9" {...LINE} />
      <path d="M6 42 L18 24 L82 24 L94 42 Z" fill="#5f7d95" {...LINE} />
      <Clock cx={50} cy={33} r={6} />
    </g>,
    windows: [[20, 50, 12, 10], [68, 50, 12, 10], [40, 60, 20, 26]],
  },
  tree: {
    body: <g>{shadow}
      <rect x="45" y="56" width="10" height="31" rx="2" fill="#8d5a2b" {...LINE} />
      <circle cx="50" cy="40" r="26" fill="#4caf50" {...LINE} />
      <circle cx="40" cy="32" r="8" fill="#7dd181" />
    </g>,
  },
  sakura: {
    body: <g>{shadow}
      <rect x="45" y="56" width="10" height="31" rx="2" fill="#7b4a2c" {...LINE} />
      <circle cx="50" cy="40" r="26" fill="#f8bbd0" {...LINE} />
      {[[38, 32], [58, 28], [62, 46], [42, 50], [50, 38]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="#ff86b0" />)}
    </g>,
  },
  flowers: {
    body: <g>
      <ellipse cx="50" cy="58" rx="42" ry="32" fill="#7cc35a" {...LINE} />
      {[[30, 46, '#ff6b81'], [50, 38, '#ffd43b'], [70, 46, '#b197fc'], [36, 64, '#ff8cc6'], [62, 64, '#74c0fc'], [50, 78, '#ff922b'], [22, 62, '#ffd43b'], [78, 62, '#ff6b81']].map(([cx, cy, color]) => <g key={`${cx}-${cy}`}>
        <circle cx={cx} cy={cy} r="7" fill={color as string} />
        <circle cx={cx} cy={cy} r="2.6" fill="#fff6cc" />
      </g>)}
    </g>,
  },
  farm: {
    body: <g>
      <rect x="8" y="12" width="84" height="76" rx="8" fill="#b07a4a" {...LINE} />
      {[26, 44, 62, 80].map((y) => <g key={y}>
        <path d={`M16 ${y} L84 ${y}`} stroke="#8a5a32" strokeWidth="6" strokeLinecap="round" />
        {[24, 42, 60, 76].map((x) => <path key={x} d={`M${x} ${y - 3} q-6 -8 -1 -11 q5 3 1 11 q2 -9 8 -9 q0 7 -8 9`} fill="#5cb85c" />)}
      </g>)}
    </g>,
  },
  park: {
    body: <g>
      <rect x="8" y="10" width="84" height="80" rx="16" fill="#a8e07a" {...LINE} />
      <circle cx="34" cy="66" r="15" fill="#f1d9a6" {...LINE} strokeWidth={1.8} />
      <rect x="23" y="34" width="6" height="14" fill="#8d5a2b" />
      <circle cx="26" cy="28" r="12" fill="#43a047" {...LINE} strokeWidth={1.8} />
      <rect x="56" y="30" width="5" height="36" fill="#ff8a3d" {...LINE} strokeWidth={1.6} />
      <path d="M60 32 L84 64" stroke="#ffb703" strokeWidth="7" strokeLinecap="round" />
      <rect x="54" y="27" width="12" height="5" fill="#ff8a3d" {...LINE} strokeWidth={1.6} />
      <rect x="58" y="74" width="24" height="5" rx="2" fill="#8d5a2b" />
    </g>,
  },
  fountain: {
    body: <g>
      <ellipse cx="50" cy="70" rx="40" ry="17" fill="#cfd8dc" {...LINE} />
      <ellipse cx="50" cy="68" rx="32" ry="11" fill="#64c4ef" />
      <rect x="46" y="40" width="8" height="28" fill="#b0bec5" {...LINE} strokeWidth={1.8} />
      <ellipse cx="50" cy="40" rx="13" ry="4" fill="#cfd8dc" {...LINE} strokeWidth={1.8} />
      <g className={styles.spray} fill="none" stroke="#7fd3ff" strokeWidth="4" strokeLinecap="round">
        <path d="M50 36 Q38 10 26 36" />
        <path d="M50 36 Q62 10 74 36" />
        <path d="M50 36 L50 10" />
      </g>
    </g>,
  },
  ferris: {
    body: <g>
      <path d="M50 46 L28 86 M50 46 L72 86" stroke="#6d6875" strokeWidth="5" strokeLinecap="round" />
      <rect x="20" y="84" width="60" height="5" rx="2" fill="#6d6875" />
      <g className={styles.spin}>
        <circle cx="50" cy="46" r="34" fill="none" stroke="#e05d8f" strokeWidth="4" />
        {[0, 45, 90, 135].map((angle) => <path key={angle} d="M16 46 L84 46" transform={`rotate(${angle} 50 46)`} stroke="#e05d8f" strokeWidth="2" />)}
        {['#ffd43b', '#4dabf7', '#69db7c', '#ff8787', '#b197fc', '#ffa94d', '#63e6be', '#f783ac'].map((color, index) => {
          const angle = (index * Math.PI) / 4
          return <circle key={color} cx={50 + Math.cos(angle) * 34} cy={46 + Math.sin(angle) * 34} r="6" fill={color} {...LINE} strokeWidth={1.6} />
        })}
      </g>
      <circle cx="50" cy="46" r="5" fill="#ffffff" {...LINE} strokeWidth={1.8} />
    </g>,
    bulbs: [0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
      const angle = Math.PI / 8 + (index * Math.PI) / 4
      return [50 + Math.cos(angle) * 34, 46 + Math.sin(angle) * 34, 2.4] as const
    }),
  },
  castle: {
    body: <g>{shadow}
      {[10, 72].map((x) => <g key={x}>
        <rect x={x} y="30" width="18" height="56" fill="#ddd4c4" {...LINE} />
        <path d={`M${x - 2} 32 L${x + 9} 6 L${x + 20} 32 Z`} fill="#5c7cfa" {...LINE} />
      </g>)}
      <rect x="28" y="52" width="44" height="34" fill="#e8e1d5" {...LINE} />
      {[28, 40, 52, 64].map((x) => <rect key={x} x={x} y="46" width="8" height="7" fill="#e8e1d5" {...LINE} strokeWidth={1.8} />)}
      <rect x="36" y="34" width="28" height="52" fill="#efe8dc" {...LINE} />
      <path d="M33 36 L50 12 L67 36 Z" fill="#e64980" {...LINE} />
      <path d="M42 86 L42 72 Q50 62 58 72 L58 86 Z" fill="#7b5a3c" {...LINE} />
    </g>,
    windows: [[16, 42, 6, 9], [78, 42, 6, 9], [46, 44, 8, 10]],
  },
  'tv-tower': {
    body: <g>
      <ellipse cx="50" cy="89" rx="26" ry="4" fill="#00000026" />
      <g stroke="#f76707" strokeLinecap="round">
        <path d="M28 88 L46 34 M72 88 L54 34" strokeWidth="5" />
        <path d="M34 70 L66 70 M39 52 L61 52 M28 88 L66 70 M72 88 L34 70 M34 70 L61 52 M66 70 L39 52" stroke="#ffffff" strokeWidth="3" />
      </g>
      <path d="M46.5 38 L50 3 L53.5 38 Z" fill="#f76707" {...LINE} strokeWidth={1.6} />
      <rect x="36" y="37" width="28" height="10" rx="3" fill="#ffffff" {...LINE} />
    </g>,
    windows: [[39, 40, 22, 4]],
    bulbs: [[50, 5, 2.6]],
  },
  windmill: {
    body: <g>{shadow}
      <path d="M36 86 L40 40 L60 40 L64 86 Z" fill="#f2e2c4" {...LINE} />
      <path d="M37 42 Q50 24 63 42 Z" fill="#c0504d" {...LINE} />
      <rect x="45" y="70" width="10" height="16" rx="2" fill="#8d5a2b" {...LINE} strokeWidth={1.8} />
      <g className={styles.spin}>
        {[0, 90, 180, 270].map((angle) => <g key={angle} transform={`rotate(${angle} 50 36)`}>
          <rect x="46" y="6" width="8" height="29" fill="#ffffff" {...LINE} strokeWidth={1.6} />
          <path d="M46 14 L54 14 M46 22 L54 22" stroke="#c9b48a" strokeWidth="1.5" />
        </g>)}
      </g>
      <circle cx="50" cy="36" r="4" fill="#6d6875" />
    </g>,
    windows: [[46, 52, 8, 9]],
  },
  igloo: {
    body: <g>{shadow}
      <path d="M12 86 Q12 30 50 30 Q88 30 88 86 Z" fill="#eef7ff" {...LINE} />
      <path d="M16 62 L84 62 M24 46 L76 46 M50 30 L50 46 M34 46 L34 62 M66 46 L66 62 M24 62 L24 86 M76 62 L76 86" stroke="#a9c7e0" strokeWidth="2" fill="none" />
      <path d="M38 86 L38 70 Q50 56 62 70 L62 86 Z" fill="#5b6b82" {...LINE} />
    </g>,
    windows: [[45, 73, 10, 9]],
  },
  lighthouse: {
    body: <g>{shadow}
      <path d="M36 88 L42 30 L58 30 L64 88 Z" fill="#ffffff" {...LINE} />
      <path d="M38.3 66 L61.7 66 L60.4 53 L39.6 53 Z" fill="#e5484d" />
      <path d="M41.2 40 L58.8 40 L58 30 L42 30 Z" fill="#e5484d" />
      <path d="M36 88 L42 30 L58 30 L64 88 Z" fill="none" {...LINE} />
      <rect x="38" y="16" width="24" height="14" rx="2" fill="#5b6b82" {...LINE} />
      <path d="M36 16 L50 5 L64 16 Z" fill="#e5484d" {...LINE} />
      <rect x="45" y="74" width="10" height="14" rx="2" fill="#8d5a2b" {...LINE} strokeWidth={1.8} />
    </g>,
    windows: [[42, 19, 16, 8]],
    bulbs: [[50, 23, 5]],
  },
  pine: {
    body: <g>{shadow}
      <rect x="45" y="66" width="10" height="21" rx="2" fill="#7b4a2c" {...LINE} />
      <path d="M50 8 L74 42 L62 42 L80 70 L20 70 L38 42 L26 42 Z" fill="#2f8f5b" {...LINE} />
      <path d="M50 8 L58 20 L50 17 L42 20 Z" fill="#ffffff" />
    </g>,
  },
  palm: {
    body: <g>{shadow}
      <path d="M46 88 Q42 60 52 36 L59 38 Q51 62 56 88 Z" fill="#b9864a" {...LINE} />
      {[[-62, 30], [-28, 34], [8, 36], [44, 34], [78, 30]].map(([angle, length]) => <path key={angle} transform={`rotate(${angle} 55 36)`}
        d={`M55 36 Q${55 + length / 2} ${22} ${55 + length} 34 Q${55 + length / 2} 32 55 36 Z`} fill="#4fae5b" {...LINE} strokeWidth={2} />)}
      <circle cx="52" cy="40" r="4" fill="#7b4a2c" />
      <circle cx="59" cy="42" r="4" fill="#7b4a2c" />
    </g>,
  },
  cactus: {
    body: <g>{shadow}
      <path d="M26 58 L26 46 Q26 40 31 40 Q36 40 36 46 L36 52 L42 52 L42 66 L34 66 Q26 66 26 58 Z" fill="#5fa55a" {...LINE} />
      <path d="M74 50 L74 38 Q74 32 69 32 Q64 32 64 38 L64 44 L58 44 L58 58 L66 58 Q74 58 74 50 Z" fill="#5fa55a" {...LINE} />
      <rect x="40" y="18" width="20" height="70" rx="10" fill="#6dbb63" {...LINE} />
      <path d="M50 26 L50 80" stroke="#4d9450" strokeWidth="2" strokeDasharray="3 6" />
      <circle cx="50" cy="17" r="5" fill="#ff8cc6" {...LINE} strokeWidth={1.6} />
    </g>,
  },
  snowman: {
    body: <g>{shadow}
      <circle cx="50" cy="66" r="22" fill="#ffffff" {...LINE} />
      <circle cx="50" cy="36" r="15" fill="#ffffff" {...LINE} />
      <rect x="38" y="8" width="24" height="14" rx="2" fill="#46404f" />
      <rect x="32" y="20" width="36" height="5" rx="2" fill="#46404f" />
      <circle cx="44" cy="33" r="2" fill="#46404f" />
      <circle cx="56" cy="33" r="2" fill="#46404f" />
      <path d="M50 37 L62 40 L50 42 Z" fill="#ff922b" />
      <path d="M36 48 Q50 56 64 48 L64 53 Q50 61 36 53 Z" fill="#e5484d" />
      <circle cx="50" cy="62" r="2" fill="#46404f" />
      <circle cx="50" cy="72" r="2" fill="#46404f" />
    </g>,
  },
  pyramid: {
    body: <g>{shadow}
      <path d="M50 12 L92 86 L8 86 Z" fill="#e9c46a" {...LINE} />
      <path d="M50 12 L92 86 L62 86 Z" fill="#d4a548" />
      <path d="M40 30 L60 30 M30 48 L70 48 M20 66 L80 66" stroke="#b98a3a" strokeWidth="2" />
      <path d="M50 12 L92 86 L8 86 Z" fill="none" {...LINE} />
      <path d="M44 86 L44 76 Q50 70 56 76 L56 86 Z" fill="#7b5a2c" />
    </g>,
  },
  tent: {
    body: <g>{shadow}
      <path d="M40 22 L84 84 L8 84 Z" fill="#ff922b" {...LINE} />
      <path d="M40 22 L56 84 L26 84 Z" fill="#7b4a2c" />
      <path d="M40 22 L41 84" stroke="#ffd8a8" strokeWidth="2" />
      <path d="M40 22 L84 84 L8 84 Z" fill="none" {...LINE} />
      <path d="M76 88 L80 72 L84 88 Z" fill="#8d5a2b" />
      <path d="M80 60 Q88 70 80 78 Q72 70 80 60 Z" fill="#ff6b35" />
    </g>,
    bulbs: [[80, 72, 4]],
  },
}

// ---- じめんと みち・せんろ -------------------------------------------------

function Road({ mask, bridge }: { mask: number; bridge: boolean }) {
  if (mask === 0) {
    return <g>
      <rect x="18" y="18" width="64" height="64" rx="16" fill="#d9d4c7" />
      <rect x="25" y="25" width="50" height="50" rx="11" fill="#5d6470" />
      <circle cx="50" cy="50" r="9" fill="none" stroke="#ffffff" strokeWidth="3" strokeDasharray="6 5" />
    </g>
  }
  const { segments, junction } = segmentsOf(mask)
  const ends = directions(mask).length === 1
  const cap = junction ? 'square' : ends ? 'round' : 'butt'
  return <g fill="none">
    {bridge && segments.map((segment, index) => <path key={`b${index}`} d={pathOf(segment)} stroke="#8d6e52" strokeWidth="68" strokeLinecap={cap} />)}
    {segments.map((segment, index) => <path key={`s${index}`} d={pathOf(segment)} stroke={bridge ? '#e8dcc8' : '#d9d4c7'} strokeWidth="62" strokeLinecap={cap} />)}
    {segments.map((segment, index) => <path key={`a${index}`} d={pathOf(segment)} stroke="#5d6470" strokeWidth="48" strokeLinecap={cap} />)}
    {segments.map((segment, index) => <path key={`l${index}`} d={pathOf(segment, 0, junction ? 0.5 : 1)} stroke="#ffffff" strokeWidth="3" strokeDasharray="9 8" />)}
  </g>
}

function Rail({ mask, bridge, overRoad }: { mask: number; bridge: boolean; overRoad: boolean }) {
  const { segments, junction } = segmentsOf(mask)
  const cap = junction ? 'square' : 'butt'
  return <g fill="none">
    {bridge && segments.map((segment, index) => <path key={`b${index}`} d={pathOf(segment)} stroke="#8d6e52" strokeWidth="50" strokeLinecap={cap} />)}
    {!overRoad && segments.map((segment, index) => <path key={`g${index}`} d={pathOf(segment)} stroke="#c2b59b" strokeWidth="42" strokeLinecap={cap} />)}
    {segments.map((segment, index) => <path key={`t${index}`} d={pathOf(segment)} stroke={overRoad ? '#f4f1ea' : '#8b5a2b'} strokeWidth="34" strokeDasharray="5 7" />)}
    {segments.flatMap((segment, index) => [-11, 11].map((offset) => <path key={`r${index}${offset}`} d={pathOf(segment, offset)} stroke="#5f6b78" strokeWidth="4.5" strokeLinecap={cap} />))}
  </g>
}

function roundedRect(radii: readonly [number, number, number, number]): string {
  const [tl, tr, br, bl] = radii
  return `M${tl} 0 L${100 - tr} 0 Q100 0 100 ${tr} L100 ${100 - br} Q100 100 ${100 - br} 100 L${bl} 100 Q0 100 0 ${100 - bl} L0 ${tl} Q0 0 ${tl} 0 Z`
}

const GROUND_FILL: Record<Exclude<Ground, 'water'>, readonly [string, string]> = {
  grass: ['#9bd66f', '#92ce66'],
  sand: ['#f4dfa6', '#eed597'],
  snow: ['#fbfdff', '#edf3f9'],
}

function GroundArt({ ground, bank, waterMask, checker }: { ground: Ground; bank: Ground; waterMask: number; checker: boolean }) {
  const land = ground === 'water' ? (bank === 'water' ? 'grass' : bank) : ground
  const base = <rect width="100" height="100" fill={GROUND_FILL[land][checker ? 0 : 1]} />
  if (ground !== 'water') return base
  const open = (dir: number) => !(waterMask & (1 << dir))
  const radius = (a: number, b: number) => (open(a) && open(b) ? 30 : 0)
  return <g>
    {base}
    <path d={roundedRect([radius(0, 3), radius(0, 1), radius(1, 2), radius(2, 3)])} fill="#5bbde8" />
    <path d="M18 34 q8 -6 16 0 M58 70 q8 -6 16 0" stroke="#d6f3ff" strokeWidth="3" fill="none" strokeLinecap="round" />
  </g>
}

// ---- マス ぜんたい -----------------------------------------------------

export type TileArtProps = {
  ground: Ground
  /** みずの かどから のぞく きしの じめん（みず いがいの マスは じぶんの じめん）。 */
  bank: Ground
  part: TilePart | null
  roadMask: number
  railMask: number
  waterMask: number
  checker: boolean
  /** みちに つながって いて、よるに あかりが つくか。 */
  lit: boolean
  wantsRoad: boolean
  /** おいた ときの はずむ うごき（0 なら うごかない）。 */
  pop: number
  dust: boolean
}

export function TileArt({ ground, bank, part, roadMask, railMask, waterMask, checker, lit, wantsRoad, pop, dust }: TileArtProps) {
  const bridge = ground === 'water'
  const building = part && part !== 'road' && part !== 'rail' && part !== 'crossing' ? BUILDINGS[part] : undefined
  const hasRoad = part === 'road' || part === 'crossing'
  return <svg viewBox="0 0 100 100" className={styles.tile} aria-hidden="true" focusable="false">
    <GroundArt ground={ground} bank={bank} waterMask={waterMask} checker={checker} />
    <g key={pop} className={pop ? styles.pop : undefined}>
      {hasRoad && <Road mask={roadMask} bridge={bridge} />}
      {(part === 'rail' || part === 'crossing') && <Rail mask={railMask} bridge={bridge} overRoad={part === 'crossing'} />}
      {building?.body}
    </g>
    <rect className={styles.shade} width="100" height="100" />
    {building?.windows?.map(([x, y, width, height]) => <rect key={`${x}-${y}`} className={styles.window} data-lit={lit} x={x} y={y} width={width} height={height} rx="1.5" />)}
    {building?.bulbs?.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} className={styles.bulb} cx={cx} cy={cy} r={r} />)}
    {hasRoad && !bridge && <g className={styles.lamp}><circle cx="11" cy="11" r="9" fill="#ffe680" opacity="0.45" /><circle cx="11" cy="11" r="3.5" fill="#fff3b0" /></g>}
    {wantsRoad && <g className={styles.wants}>
      <circle cx="80" cy="20" r="15" fill="#ffffff" stroke="#f08c00" strokeWidth="3" />
      <rect x="69" y="15" width="22" height="10" rx="2" fill="#5d6470" />
      <path d="M71 20 L89 20" stroke="#ffffff" strokeWidth="2" strokeDasharray="4 3" />
    </g>}
    {dust && <g key={`d${pop}`} className={styles.dust} fill="#e9e2d0">
      <circle cx="34" cy="60" r="14" />
      <circle cx="58" cy="52" r="18" />
      <circle cx="70" cy="70" r="12" />
    </g>}
  </svg>
}

// ---- どうぐの アイコン ---------------------------------------------------

function Bulldozer() {
  return <g>
    <rect x="18" y="64" width="62" height="20" rx="10" fill="#4a4a4a" {...LINE} />
    {[30, 49, 68].map((cx) => <circle key={cx} cx={cx} cy="74" r="5" fill="#9e9e9e" />)}
    <rect x="28" y="44" width="44" height="22" rx="3" fill="#ffc233" {...LINE} />
    <rect x="48" y="24" width="22" height="22" rx="3" fill="#ffc233" {...LINE} />
    <rect x="52" y="28" width="14" height="11" fill="#bfe6f7" />
    <path d="M28 56 L18 56" stroke="#46404f" strokeWidth="4" />
    <path d="M6 42 L18 46 L18 84 L6 86 Z" fill="#9e9e9e" {...LINE} />
  </g>
}

/** パレットや タブに だす ちいさな え。 */
export function ToolIcon({ tool }: { tool: ToolId }) {
  let art: ReactElement
  if (tool === 'erase') art = <Bulldozer />
  else if (tool === 'road') art = <g><rect width="100" height="100" rx="18" fill="#92ce66" /><Road mask={10} bridge={false} /></g>
  else if (tool === 'rail') art = <g><rect width="100" height="100" rx="18" fill="#92ce66" /><Rail mask={10} bridge={false} overRoad={false} /></g>
  else if (tool === 'water') art = <g><rect width="100" height="100" rx="18" fill="#5bbde8" /><path d="M18 34 q8 -6 16 0 M58 70 q8 -6 16 0 M36 54 q8 -6 16 0" stroke="#d6f3ff" strokeWidth="4" fill="none" strokeLinecap="round" /></g>
  else if (tool === 'sand') art = <g><rect width="100" height="100" rx="18" fill="#f4dfa6" /><path d="M14 40 q12 -10 24 0 t24 0 t24 0 M14 66 q12 -10 24 0 t24 0 t24 0" stroke="#d9b96a" strokeWidth="4" fill="none" strokeLinecap="round" /></g>
  else if (tool === 'snow') art = <g><rect width="100" height="100" rx="18" fill="#dcebf7" />{[0, 60, 120].map((angle) => <path key={angle} transform={`rotate(${angle} 50 50)`} d="M50 18 L50 82 M42 26 L50 34 L58 26 M42 74 L50 66 L58 74" stroke="#ffffff" strokeWidth="6" fill="none" strokeLinecap="round" />)}</g>
  else {
    const building = BUILDINGS[tool]
    art = <g>
      {building.body}
      {building.windows?.map(([x, y, width, height]) => <rect key={`${x}-${y}`} className={styles.window} x={x} y={y} width={width} height={height} rx="1.5" />)}
    </g>
  }
  return <svg viewBox="0 0 100 100" className={styles.icon} aria-hidden="true" focusable="false">{art}</svg>
}

// ---- のりもの -----------------------------------------------------------

/** うえ（きた）むきの くるま・でんしゃ。 */
export function VehicleArt({ kind, variant }: { kind: 'car' | 'train'; variant: number }) {
  if (kind === 'train') {
    const color = TRAIN_COLORS[variant % TRAIN_COLORS.length]
    return <svg viewBox="0 0 40 60" className={styles.vehicle} aria-hidden="true" focusable="false">
      <rect x="8" y="2" width="24" height="56" rx="9" fill={color} {...LINE} strokeWidth={2} />
      <rect x="12" y="6" width="16" height="8" rx="3" fill="#cfeefe" />
      <rect x="11" y="20" width="18" height="30" rx="2" fill="#ffffff" opacity="0.85" />
      <circle className={styles.headlight} cx="20" cy="4" r="2.5" />
    </svg>
  }
  const color = CAR_COLORS[variant % CAR_COLORS.length]
  return <svg viewBox="0 0 40 40" className={styles.vehicle} aria-hidden="true" focusable="false">
    <rect x="10" y="3" width="20" height="34" rx="7" fill={color} {...LINE} strokeWidth={2} />
    <rect x="13" y="10" width="14" height="7" rx="2" fill="#cfeefe" />
    <rect x="13" y="27" width="14" height="5" rx="2" fill="#cfeefe" />
    <circle className={styles.headlight} cx="14" cy="5" r="2" />
    <circle className={styles.headlight} cx="26" cy="5" r="2" />
  </svg>
}
