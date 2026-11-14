import { memo, type ReactElement } from 'react'
import { findPart, isBuilding, sizeOf, spanOf, type BuildingId, type CategoryId, type Scale, type TilePart, type ToolId } from './parts'
import { COLS, colOf, rowOf, type Ground, type Town } from './town'
import { artId, bodyKey, railKey, roadKey, windowKey } from './sharedArt'
import { directions, pathOf, segmentsOf } from './trackGeometry'
import { CAR_COLORS, TRAIN_COLORS } from './vehicles'
import styles from './PartArt.module.css'

// まちの え。どの マスも 0〜100 の viewBox に えがく。
// おおきな たてもの（2マス いじょう）は よこ 100×よこの マスかず・たて 100×たての マスかず に えがき、
// それぞれの マスには じぶんの ぶんだけ ずらして うつす。
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

/** よこ 2マスぶんの たてものの かげ。 */
const wideShadow = <ellipse cx="100" cy="88" rx="88" ry="5" fill="#00000026" />

/** おりの さく。 */
const PEN = { stroke: '#8d5a2b', strokeWidth: 3, strokeDasharray: '6 3' }

/** もりの き（cx, cy, はんけい, はの いろ）。うしろ（うえ）から じゅんに えがく。 */
const FOREST_TREES = [
  [124, 40, 26, '#4caf50'], [56, 48, 24, '#3f9b46'], [168, 78, 20, '#3f9b46'], [90, 92, 26, '#4caf50'],
  [38, 112, 22, '#5cb85c'], [148, 124, 26, '#3f9b46'], [70, 150, 22, '#4caf50'], [118, 162, 18, '#5cb85c'],
] as const

function Penguin({ x, y }: { x: number; y: number }) {
  return <g>
    <ellipse cx={x} cy={y} rx="7" ry="10" fill="#2b2d42" />
    <ellipse cx={x} cy={y + 2} rx="4.5" ry="7" fill="#ffffff" />
    <path d={`M${x - 2} ${y - 5} L${x + 2} ${y - 5} L${x} ${y - 2} Z`} fill="#ffa94d" />
  </g>
}

function Cow({ x, y }: { x: number; y: number }) {
  return <g>
    {[x - 10, x - 4, x + 6, x + 12].map((leg) => <rect key={leg} x={leg - 1.5} y={y + 6} width="3.5" height="11" fill="#46404f" />)}
    <ellipse cx={x} cy={y + 2} rx="17" ry="10" fill="#ffffff" {...LINE} strokeWidth={1.8} />
    <ellipse cx={x - 5} cy={y} rx="5" ry="4" fill="#46404f" />
    <ellipse cx={x + 8} cy={y + 5} rx="4" ry="3" fill="#46404f" />
    <ellipse cx={x + 19} cy={y - 4} rx="7" ry="6" fill="#ffffff" {...LINE} strokeWidth={1.6} />
    <ellipse cx={x + 22} cy={y - 1} rx="4" ry="3" fill="#ffc9c9" />
  </g>
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
  icecream: {
    body: <g>{shadow}
      <rect x="16" y="42" width="68" height="44" fill="#fff0f6" {...LINE} />
      <rect x="12" y="34" width="76" height="10" fill="#74c0fc" {...LINE} />
      {[20, 36, 52, 68].map((x) => <rect key={x} x={x} y="35" width="8" height="8" fill="#ffffff" />)}
      <path d="M41 24 L59 24 L50 34 Z" fill="#e0a458" {...LINE} strokeWidth={1.8} />
      <circle cx="45" cy="19" r="7" fill="#ff8cc6" {...LINE} strokeWidth={1.8} />
      <circle cx="55" cy="19" r="7" fill="#fff3bf" {...LINE} strokeWidth={1.8} />
      <circle cx="50" cy="11" r="6.5" fill="#8ce99a" {...LINE} strokeWidth={1.8} />
      <rect x="60" y="62" width="14" height="24" rx="2" fill="#c2255c" {...LINE} />
    </g>,
    windows: [[22, 54, 30, 18]],
  },
  bakery: {
    body: <g>{shadow}
      <rect x="60" y="14" width="10" height="20" fill="#8d5a2b" {...LINE} />
      <rect x="16" y="40" width="68" height="46" fill="#fbe3c0" {...LINE} />
      <path d="M10 44 L24 28 L76 28 L90 44 Z" fill="#a0522d" {...LINE} />
      <ellipse cx="38" cy="24" rx="15" ry="8" fill="#e8a849" {...LINE} strokeWidth={1.8} />
      <path d="M31 21 L34 27 M37 20 L40 27 M43 21 L46 27" stroke="#b8742a" strokeWidth="2" strokeLinecap="round" />
      <rect x="58" y="62" width="14" height="24" rx="2" fill="#8d5a2b" {...LINE} />
    </g>,
    windows: [[22, 52, 28, 18]],
  },
  heliport: {
    body: <g>
      <rect x="8" y="12" width="84" height="76" rx="10" fill="#7d8590" {...LINE} />
      <circle cx="50" cy="50" r="30" fill="none" stroke="#fcc419" strokeWidth="4" />
      <path d="M38 34 L38 66 M62 34 L62 66 M38 50 L62 50" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" opacity="0.7" />
      <path d="M58 55 L84 52 L84 58 Z" fill="#e03131" {...LINE} strokeWidth={1.6} />
      <ellipse cx="50" cy="55" rx="15" ry="10" fill="#e03131" {...LINE} />
      <ellipse cx="44" cy="53" rx="6" ry="5" fill="#cfeefe" />
      <path d="M38 67 L62 67" stroke="#46404f" strokeWidth="3" strokeLinecap="round" />
      <g className={styles.spin}>
        <path d="M22 45 L78 45 M50 31 L50 59" stroke="#46404f" strokeWidth="3.5" strokeLinecap="round" transform="rotate(20 50 45)" />
      </g>
    </g>,
    bulbs: [[16, 20, 3], [84, 20, 3], [16, 80, 3], [84, 80, 3]],
  },
  shrine: {
    body: <g>{shadow}
      <rect x="36" y="52" width="28" height="24" fill="#f1e3c6" {...LINE} />
      <path d="M30 55 L50 40 L70 55 Z" fill="#5c5f66" {...LINE} />
      <rect x="45" y="62" width="10" height="14" fill="#c92a2a" />
      <rect x="25" y="34" width="7" height="53" fill="#e8590c" {...LINE} strokeWidth={1.8} />
      <rect x="68" y="34" width="7" height="53" fill="#e8590c" {...LINE} strokeWidth={1.8} />
      <path d="M14 30 Q50 20 86 30 L86 26 Q50 14 14 26 Z" fill="#e8590c" {...LINE} strokeWidth={1.8} />
      <rect x="20" y="38" width="60" height="5" fill="#e8590c" {...LINE} strokeWidth={1.6} />
    </g>,
  },
  lighthouse: {
    body: <g>{shadow}
      <ellipse cx="50" cy="84" rx="26" ry="7" fill="#9aa5b1" {...LINE} />
      <path d="M38 84 L42 28 L58 28 L62 84 Z" fill="#ffffff" {...LINE} />
      <path d="M40.3 52 L59.7 52 L60.4 62 L39.6 62 Z M38.9 72 L61.1 72 L61.7 80 L38.3 80 Z" fill="#e03131" />
      <rect x="38" y="24" width="24" height="5" fill="#46404f" />
      <rect x="41" y="13" width="18" height="11" fill="#fff3b0" {...LINE} strokeWidth={1.8} />
      <path d="M38 14 L50 4 L62 14 Z" fill="#e03131" {...LINE} strokeWidth={1.8} />
    </g>,
    windows: [[46, 36, 8, 9]],
    bulbs: [[50, 18.5, 5]],
  },
  beach: {
    body: <g>
      <rect x="6" y="8" width="88" height="84" rx="18" fill="#f6dfa0" {...LINE} />
      <path d="M6 74 Q28 66 50 74 T94 74 L94 74 Q94 92 76 92 L24 92 Q6 92 6 74 Z" fill="#5bbde8" />
      <path d="M20 82 q6 -4 12 0 M60 84 q6 -4 12 0" stroke="#d6f3ff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M50 30 L46 66" stroke="#8d5a2b" strokeWidth="3" strokeLinecap="round" />
      <path d="M22 36 Q48 8 78 30 Z" fill="#ff6b6b" {...LINE} />
      <path d="M40 22 L48 33 M58 18 L60 31" stroke="#ffffff" strokeWidth="5" />
      <rect x="18" y="52" width="24" height="12" rx="3" fill="#4dabf7" {...LINE} strokeWidth={1.6} transform="rotate(-8 30 58)" />
      <circle cx="74" cy="56" r="7" fill="#ffd43b" {...LINE} strokeWidth={1.6} />
      <path d="M68 53 Q74 58 80 53" stroke="#e03131" strokeWidth="2" fill="none" />
    </g>,
  },
  camp: {
    body: <g>{shadow}
      <path d="M12 82 L40 30 L68 82 Z" fill="#f08c00" {...LINE} />
      <path d="M40 82 L40 46 L52 82 Z" fill="#a35200" />
      <path d="M40 30 L40 24" stroke="#46404f" strokeWidth="2.4" />
      <path d="M70 84 L88 76 M70 76 L88 84" stroke="#8d5a2b" strokeWidth="5" strokeLinecap="round" />
      <g className={styles.flicker}>
        <path d="M79 76 Q70 66 78 56 Q80 64 85 62 Q88 70 79 76 Z" fill="#ff922b" />
        <path d="M79 76 Q75 70 79 64 Q83 70 79 76 Z" fill="#ffe066" />
      </g>
      <rect x="20" y="10" width="4" height="12" fill="#8d5a2b" />
      <circle cx="22" cy="10" r="9" fill="#4caf50" {...LINE} strokeWidth={1.8} />
    </g>,
    bulbs: [[79, 66, 6]],
  },
  merry: {
    body: <g>{shadow}
      <ellipse cx="50" cy="78" rx="40" ry="9" fill="#f3d9fa" {...LINE} />
      {[22, 40, 60, 78].map((x) => <path key={x} d={`M${x} 40 L${x} 76`} stroke="#ffd43b" strokeWidth="3" />)}
      {([[22, 62, '#ffffff'], [40, 56, '#ffc9c9'], [60, 60, '#d0ebff'], [78, 56, '#ffffff']] as const).map(([x, y, color]) => <g key={x} className={styles.bob}>
        <ellipse cx={x} cy={y} rx="8" ry="5" fill={color} {...LINE} strokeWidth={1.6} />
        <circle cx={x + 7} cy={y - 5} r="3.5" fill={color} {...LINE} strokeWidth={1.4} />
      </g>)}
      <path d="M10 42 L50 14 L90 42 Z" fill="#e64980" {...LINE} />
      <path d="M50 14 L36 42 M50 14 L64 42" stroke="#ffffff" strokeWidth="4" />
      {[14, 26, 38, 50, 62, 74, 86].map((x) => <circle key={x} cx={x} cy="44" r="4" fill="#ffd43b" {...LINE} strokeWidth={1.2} />)}
      <path d="M50 14 L50 6" stroke="#46404f" strokeWidth="2" />
      <path d="M50 6 L60 9 L50 12 Z" fill="#4dabf7" />
    </g>,
    bulbs: [14, 26, 38, 50, 62, 74, 86].map((x) => [x, 44, 2.2] as const),
  },
  rocket: {
    body: <g>
      <ellipse cx="50" cy="90" rx="30" ry="5" fill="#00000026" />
      <rect x="22" y="80" width="56" height="8" rx="3" fill="#868e96" {...LINE} />
      <g className={styles.flicker}>
        <path d="M42 70 Q50 92 58 70 Z" fill="#ff922b" />
      </g>
      <path d="M36 52 L24 74 L38 70 Z M64 52 L76 74 L62 70 Z" fill="#e03131" {...LINE} strokeWidth={1.8} />
      <path d="M50 4 Q68 24 64 70 L36 70 Q32 24 50 4 Z" fill="#ffffff" {...LINE} />
      <path d="M50 4 Q60 14 62 24 L38 24 Q40 14 50 4 Z" fill="#e03131" {...LINE} strokeWidth={1.8} />
      <path d="M50 54 L50 70" stroke="#e03131" strokeWidth="4" />
    </g>,
    windows: [[43, 32, 14, 12]],
  },
  circus: {
    body: <g>{shadow}
      <path d="M8 84 L16 44 Q50 22 84 44 L92 84 Z" fill="#ffffff" {...LINE} />
      {[22, 40, 58, 76].map((x) => <path key={x} d={`M${x} 84 L${x - 2} 40 L${x + 8} 38 L${x + 10} 84 Z`} fill="#e03131" />)}
      <path d="M8 84 L16 44 Q50 22 84 44 L92 84 Z" fill="none" {...LINE} />
      <path d="M14 46 Q50 4 86 46 Q50 28 14 46 Z" fill="#4c6ef5" {...LINE} strokeWidth={1.8} />
      <path d="M50 18 L50 6" stroke="#46404f" strokeWidth="2" />
      <path d="M50 6 L62 9 L50 12 Z" fill="#ffd43b" />
      <path d="M38 84 Q50 56 62 84 Z" fill="#46404f" />
    </g>,
    bulbs: [[16, 46, 2.4], [30, 38, 2.4], [50, 34, 2.4], [70, 38, 2.4], [84, 46, 2.4]],
  },

  // ---- 2マス（よこ 200×たて 100） ----
  'big-apartment': {
    body: <g>{wideShadow}
      <rect x="14" y="16" width="172" height="70" fill="#f9e0b8" {...LINE} />
      <rect x="10" y="9" width="180" height="9" fill="#b97a4b" {...LINE} />
      {[34, 52].map((y) => <rect key={y} x="14" y={y} width="172" height="3.5" fill="#c98d5c" />)}
      <rect x="92" y="70" width="16" height="16" fill="#7b5a43" {...LINE} />
    </g>,
    windows: [...grid([22, 40, 58, 94, 130, 148, 166], [21, 39, 57], 12, 10), ...grid([22, 40, 148, 166], [72], 12, 10)],
  },
  supermarket: {
    body: <g>{wideShadow}
      <rect x="10" y="38" width="180" height="48" fill="#fffaf0" {...LINE} />
      <rect x="6" y="28" width="188" height="12" fill="#e8590c" {...LINE} />
      {Array.from({ length: 9 }, (_, n) => <rect key={n} x={12 + n * 20} y="40" width="10" height="7" fill="#ffd8a8" />)}
      <rect x="66" y="6" width="68" height="22" rx="6" fill="#ffd43b" {...LINE} />
      <path d="M78 11 L83 11 L87 21 L101 21 L104 14 L85 14" fill="none" stroke="#46404f" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="89" cy="24" r="2" fill="#46404f" />
      <circle cx="99" cy="24" r="2" fill="#46404f" />
      <circle cx="115" cy="17" r="5" fill="#e03131" />
      <circle cx="125" cy="18" r="4.5" fill="#fd7e14" />
      <rect x="16" y="74" width="30" height="12" fill="#b9773f" {...LINE} strokeWidth={1.8} />
      {([[22, '#e03131'], [31, '#fd7e14'], [40, '#82c91e']] as const).map(([cx, color]) => <circle key={cx} cx={cx} cy="71" r="4.5" fill={color} />)}
    </g>,
    windows: [[18, 50, 56, 16], [126, 50, 56, 16], [88, 54, 24, 32]],
  },
  pool: {
    body: <g>
      <rect x="6" y="10" width="188" height="80" rx="14" fill="#f1e3c6" {...LINE} />
      <rect x="22" y="24" width="156" height="52" rx="8" fill="#ffffff" {...LINE} />
      <rect x="26" y="28" width="148" height="44" rx="6" fill="#4dc3f0" />
      {[43, 57].map((y) => <path key={y} d={`M28 ${y} L172 ${y}`} stroke="#ff8787" strokeWidth="2.6" strokeDasharray="5 4" />)}
      <path d="M40 36 q6 -4 12 0 M120 66 q6 -4 12 0 M140 36 q6 -4 12 0" stroke="#d6f3ff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <circle cx="82" cy="64" r="6.5" fill="none" stroke="#ff6b6b" strokeWidth="4.5" />
      <circle cx="110" cy="36" r="5" fill="#ffd43b" stroke="#46404f" strokeWidth="1.6" />
      <path d="M158 14 L158 30 M168 14 L168 30 M158 20 L168 20 M158 26 L168 26" stroke="#adb5bd" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M14 84 L36 84" stroke="#ff922b" strokeWidth="5" strokeLinecap="round" />
    </g>,
  },
  ranch: {
    body: <g>
      <rect x="6" y="10" width="188" height="80" rx="14" fill="#b2e08a" {...LINE} />
      <path d="M12 82 L188 82 M12 74 L188 74" stroke="#a0703c" strokeWidth="3" />
      {[16, 44, 72, 100, 128, 156, 184].map((x) => <rect key={x} x={x - 2} y="68" width="4" height="18" fill="#8d5a2b" />)}
      <rect x="14" y="36" width="50" height="36" fill="#d9480f" {...LINE} />
      <path d="M8 40 L39 14 L70 40 Z" fill="#a61e4d" {...LINE} />
      <rect x="30" y="50" width="18" height="22" fill="#ffffff" {...LINE} strokeWidth={1.8} />
      <path d="M30 50 L48 72 M48 50 L30 72" stroke="#d9480f" strokeWidth="2.4" />
      <Cow x={108} y={50} />
      <Cow x={150} y={40} />
      <ellipse cx="170" cy="62" rx="12" ry="5" fill="#f6dfa0" {...LINE} strokeWidth={1.6} />
    </g>,
    windows: [[33, 26, 12, 8]],
  },

  // ---- 4マス（よこ 200×たて 200） ----
  airport: {
    body: <g>
      <rect x="6" y="6" width="188" height="188" rx="16" fill="#c9ced6" {...LINE} />
      <rect x="12" y="20" width="176" height="44" rx="4" fill="#5d6470" />
      <path d="M24 42 L176 42" stroke="#ffffff" strokeWidth="3.5" strokeDasharray="14 10" />
      <path d="M92 36 L104 8 L114 8 L110 36 Z M92 48 L104 76 L114 76 L110 48 Z" fill="#4dabf7" {...LINE} strokeWidth={1.8} />
      <path d="M62 39 L54 28 L62 28 L72 39 Z M62 45 L54 56 L62 56 L72 45 Z" fill="#e8590c" {...LINE} strokeWidth={1.6} />
      <path d="M58 42 Q58 35 68 35 L132 35 Q146 37 152 42 Q146 47 132 49 L68 49 Q58 49 58 42 Z" fill="#ffffff" {...LINE} strokeWidth={2} />
      <ellipse cx="100" cy="186" rx="88" ry="4" fill="#00000026" />
      <rect x="16" y="120" width="124" height="64" fill="#eef3fb" {...LINE} />
      <rect x="12" y="112" width="132" height="10" fill="#4f78a8" {...LINE} />
      <rect x="156" y="98" width="16" height="86" fill="#eef3fb" {...LINE} />
      <path d="M146 98 L182 98 L178 80 L150 80 Z" fill="#4f78a8" {...LINE} />
      <rect x="161" y="70" width="6" height="10" fill="#6d6875" />
    </g>,
    windows: [...grid([24, 46, 68, 90, 112], [130], 16, 12), ...grid([24, 46, 112], [154], 16, 12), [70, 154, 26, 30], [152, 84, 24, 10], [136, 38.5, 9, 7]],
    bulbs: [[164, 68, 3]],
  },
  forest: {
    body: <g>
      <rect x="8" y="8" width="184" height="184" rx="34" fill="#7fbf5a" {...LINE} />
      {FOREST_TREES.map(([cx, cy, r, leaves]) => <g key={`${cx}-${cy}`}>
        <rect x={cx - r * 0.18} y={cy + r * 0.5} width={r * 0.36} height={r * 0.75} rx="2" fill="#8d5a2b" {...LINE} strokeWidth={1.8} />
        <circle cx={cx} cy={cy} r={r} fill={leaves} {...LINE} />
        <circle cx={cx - r * 0.35} cy={cy - r * 0.3} r={r * 0.3} fill="#9be29b" opacity="0.7" />
      </g>)}
      <rect x="160" y="168" width="5" height="9" fill="#fff3d6" />
      <path d="M154 169 Q162.5 156 171 169 Z" fill="#e03131" {...LINE} strokeWidth={1.6} />
      <circle cx="159" cy="165" r="1.6" fill="#ffffff" />
      <circle cx="166" cy="164" r="1.6" fill="#ffffff" />
    </g>,
  },
  stadium: {
    body: <g>
      <ellipse cx="100" cy="104" rx="90" ry="82" fill="#00000026" />
      <ellipse cx="100" cy="98" rx="90" ry="82" fill="#d0d7e2" {...LINE} />
      <ellipse cx="100" cy="98" rx="76" ry="68" fill="#4dabf7" {...LINE} />
      <ellipse cx="100" cy="98" rx="68" ry="60" fill="none" stroke="#a5d8ff" strokeWidth="3" />
      <ellipse cx="100" cy="98" rx="60" ry="52" fill="#69c048" {...LINE} />
      <g fill="none" stroke="#ffffff" strokeWidth="2.6">
        <rect x="62" y="70" width="76" height="56" />
        <path d="M100 70 L100 126" />
        <circle cx="100" cy="98" r="11" />
        <rect x="62" y="88" width="12" height="20" />
        <rect x="126" y="88" width="12" height="20" />
      </g>
      <circle cx="114" cy="104" r="4" fill="#ffffff" stroke="#46404f" strokeWidth="1.6" />
      {([[20, 18], [180, 18], [20, 180], [180, 180]] as const).map(([x, y]) => <g key={`${x}-${y}`}>
        <rect x={x - 2} y={y} width="4" height="12" fill="#6d6875" />
        <rect x={x - 11} y={y - 7} width="22" height="12" rx="3" fill="#6d6875" {...LINE} strokeWidth={1.6} />
      </g>)}
    </g>,
    bulbs: ([[20, 18], [180, 18], [20, 180], [180, 180]] as const).flatMap(([x, y]) => [[x - 5, y - 1, 3], [x + 5, y - 1, 3]] as const),
  },
  zoo: {
    body: <g>
      <rect x="6" y="6" width="188" height="188" rx="22" fill="#cfe8a5" {...LINE} />
      <path d="M100 190 L100 104 M20 104 L180 104" stroke="#f1d9a6" strokeWidth="16" strokeLinecap="round" fill="none" />
      {/* きりん */}
      <rect x="16" y="16" width="76" height="76" rx="10" fill="#e9d8a6" {...PEN} />
      <path d="M38 74 L38 86 M46 76 L46 86 M56 76 L56 86 M62 74 L62 86" stroke="#c07a2c" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M58 64 L66 30 L73 32 L66 66 Z" fill="#f4c542" {...LINE} strokeWidth={1.8} />
      <ellipse cx="50" cy="68" rx="18" ry="10" fill="#f4c542" {...LINE} strokeWidth={1.8} />
      <path d="M70 22 L69 16 M76 22 L77 16" stroke="#8d5a2b" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="74" cy="28" rx="9" ry="6" fill="#f4c542" {...LINE} strokeWidth={1.8} />
      <circle cx="76" cy="27" r="1.4" fill="#46404f" />
      {([[44, 66, 3], [54, 71, 3], [60, 64, 2.5], [66, 44, 2.2], [64, 55, 2.2]] as const).map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#c9822f" />)}
      {/* ぞう */}
      <rect x="108" y="16" width="76" height="76" rx="10" fill="#e3d6bd" {...PEN} />
      {[138, 148, 158, 166].map((x) => <rect key={x} x={x} y="68" width="7" height="17" fill="#9aa5b1" {...LINE} strokeWidth={1.6} />)}
      <ellipse cx="154" cy="62" rx="22" ry="15" fill="#9aa5b1" {...LINE} />
      <path d="M124 60 Q117 72 123 80" stroke="#8a95a1" strokeWidth="6" strokeLinecap="round" fill="none" />
      <circle cx="131" cy="54" r="13" fill="#9aa5b1" {...LINE} />
      <ellipse cx="140" cy="55" rx="8" ry="11" fill="#b6c0cb" {...LINE} strokeWidth={1.6} />
      <circle cx="127" cy="50" r="1.6" fill="#46404f" />
      {/* ライオン */}
      <rect x="16" y="116" width="72" height="66" rx="10" fill="#e9d8a6" {...PEN} />
      <path d="M78 160 Q88 152 84 142" stroke="#f4b942" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="62" cy="160" rx="18" ry="10" fill="#f4b942" {...LINE} strokeWidth={1.8} />
      <circle cx="40" cy="150" r="15" fill="#c8641e" {...LINE} strokeWidth={1.8} />
      <circle cx="40" cy="151" r="9" fill="#f4c542" />
      <circle cx="37" cy="149" r="1.4" fill="#46404f" />
      <circle cx="43" cy="149" r="1.4" fill="#46404f" />
      <path d="M38.5 153 L41.5 153 L40 155 Z" fill="#46404f" />
      {/* ペンギンの いけ */}
      <ellipse cx="148" cy="150" rx="32" ry="24" fill="#5bbde8" {...LINE} />
      <Penguin x={138} y={146} />
      <Penguin x={157} y={152} />
      {/* いりぐち */}
      <rect x="84" y="170" width="6" height="20" fill="#8d5a2b" />
      <rect x="110" y="170" width="6" height="20" fill="#8d5a2b" />
      <rect x="78" y="162" width="44" height="11" rx="4" fill="#f08c00" {...LINE} strokeWidth={1.8} />
    </g>,
  },
  mountain: {
    body: <g>
      <ellipse cx="100" cy="188" rx="92" ry="7" fill="#00000026" />
      <path d="M62 184 L136 30 L196 184 Z" fill="#7c9a5e" {...LINE} />
      <path d="M136 30 L120 64 L130 58 L137 68 L145 58 L154 66 Z" fill="#ffffff" {...LINE} strokeWidth={1.8} />
      <path d="M4 188 L78 46 L156 188 Z" fill="#94b86f" {...LINE} />
      <path d="M78 46 L60 82 L70 76 L78 88 L87 76 L97 84 Z" fill="#ffffff" {...LINE} strokeWidth={1.8} />
      <path d="M40 150 Q60 130 78 140 Q96 150 110 136" stroke="#7aa05a" strokeWidth="4" fill="none" strokeLinecap="round" />
      {([[34, 168], [52, 176], [120, 172], [168, 170]] as const).map(([x, y]) => <g key={x}>
        <rect x={x - 2} y={y} width="4" height="10" fill="#8d5a2b" />
        <path d={`M${x - 10} ${y + 2} L${x} ${y - 20} L${x + 10} ${y + 2} Z`} fill="#3f7d34" {...LINE} strokeWidth={1.6} />
      </g>)}
    </g>,
  },
  coaster: {
    body: <g>
      <rect x="6" y="6" width="188" height="188" rx="22" fill="#cfe8a5" {...LINE} />
      <g stroke="#adb5bd" strokeWidth="4">
        {[30, 56, 82, 150, 176].map((x) => <path key={x} d={`M${x} 186 L${x} ${x < 100 ? 110 - (x - 30) * 0.9 : 120}`} />)}
        <path d="M118 186 L118 150" />
      </g>
      <path d="M14 160 Q30 40 70 60 Q100 80 100 120 Q100 168 132 160 A34 34 0 1 1 150 110 Q170 130 188 120" fill="none" stroke="#e03131" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 160 Q30 40 70 60 Q100 80 100 120 Q100 168 132 160 A34 34 0 1 1 150 110 Q170 130 188 120" fill="none" stroke="#ffd8d8" strokeWidth="2" strokeDasharray="4 6" />
      {[0, 1, 2].map((n) => <g key={n} transform={`translate(${40 + n * 15} ${58 - n * 4}) rotate(${-38 + n * 12})`}>
        <rect x="-7" y="-9" width="14" height="9" rx="2" fill={['#fcc419', '#4dabf7', '#69db7c'][n]} {...LINE} strokeWidth={1.6} />
        <circle cx="0" cy="-12" r="3" fill="#ffd8a8" />
      </g>)}
      <rect x="20" y="168" width="40" height="18" rx="4" fill="#f08c00" {...LINE} strokeWidth={1.8} />
    </g>,
    bulbs: [[132, 92, 3], [164, 110, 3], [116, 116, 3]],
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

function GroundArt({ ground, waterMask, checker }: { ground: Ground; waterMask: number; checker: boolean }) {
  const grass = <rect width="100" height="100" fill={checker ? '#9bd66f' : '#92ce66'} />
  if (ground === 'grass') return grass
  const open = (dir: number) => !(waterMask & (1 << dir))
  const radius = (a: number, b: number) => (open(a) && open(b) ? 30 : 0)
  return <g>
    {grass}
    <path d={roundedRect([radius(0, 3), radius(0, 1), radius(1, 2), radius(2, 3)])} fill="#5bbde8" />
    <path d="M18 34 q8 -6 16 0 M58 70 q8 -6 16 0" stroke="#d6f3ff" strokeWidth="3" fill="none" strokeLinecap="round" />
  </g>
}

// ---- マス ぜんたい -----------------------------------------------------

export type TileArtProps = {
  ground: Ground
  part: TilePart | null
  roadMask: number
  railMask: number
  waterMask: number
  checker: boolean
  /** みちに つながって いて、よるに あかりが つくか。 */
  lit: boolean
  wantsRoad: boolean
  /** おおきな たてものの なかで この マスが ひだりから・うえから なんばんめか。 */
  pieceCol?: number
  pieceRow?: number
  /** おおきく おいた ときの ばい（え を この ばいに ひろげる）。 */
  scale?: Scale
  /** おいた ときの はずむ うごき（0 なら うごかない）。 */
  pop: number
  dust: boolean
  /** ちずの なかでは true。え を SharedTileArt の <defs> から よびだす。 */
  shared?: boolean
}

// ---- おなじ え の つかいまわし --------------------------------------------------
// ちずの マスは おなじ たてもの・みち・せんろの え を なんども かく。え は 1かい だけ <defs> に おき、
// マスでは <use> で よびだす（DOM の かずと はじめに ひらく ときの しごとを へらす）。

function windowsOf(part: BuildingId, lit: boolean): ReactElement {
  const building = BUILDINGS[part]
  return <g>
    {building.windows?.map(([x, y, width, height]) => <rect key={`${x}-${y}`} className={styles.window} data-lit={lit} x={x} y={y} width={width} height={height} rx="1.5" />)}
    {building.bulbs?.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} className={styles.bulb} cx={cx} cy={cy} r={r} />)}
  </g>
}

function sharedArt(key: string): ReactElement | null {
  const [kind, a, b, c] = key.split('-')
  if (kind === 'road') return <Road mask={Number(a)} bridge={b === '1'} />
  if (kind === 'rail') return <Rail mask={Number(a)} bridge={b === '1'} overRoad={c === '1'} />
  const part = key.slice(kind.length + 1).replace(/-[01]$/, '') as BuildingId
  if (kind === 'body') return BUILDINGS[part]?.body ?? null
  if (kind === 'win' && BUILDINGS[part]) return windowsOf(part, key.endsWith('-1'))
  return null
}

/** ちずで つかう え を 1かい だけ かく みえない <svg>。keys は スペースで くぎった なまえ（かわった ときだけ かきなおす）。 */
export const SharedTileArt = memo(function SharedTileArt({ keys }: { keys: string }) {
  return <svg className={styles.defs} aria-hidden="true" focusable="false" width="0" height="0">
    <defs>{keys.split(' ').filter(Boolean).map((key) => <g key={key} id={artId(key)}>{sharedArt(key)}</g>)}</defs>
  </svg>
})

function Shared({ name, transform, inline }: { name: string; transform?: string; inline: ReactElement | null }) {
  return inline ?? <use href={`#${artId(name)}`} transform={transform} />
}

export function TileArt({ ground, part, roadMask, railMask, waterMask, checker, lit, wantsRoad, pieceCol = 0, pieceRow = 0, scale = 1, pop, dust, shared = false }: TileArtProps) {
  const bridge = ground === 'water'
  const buildingId = isBuilding(part) ? part : null
  const building = buildingId ? BUILDINGS[buildingId] : undefined
  const hasRoad = part === 'road' || part === 'crossing'
  const [cols, rows] = part ? spanOf(part, scale) : [1, 1]
  const large = cols * rows > 1
  // おおきな たてものは え を ばいに ひろげ、この マスの ぶんだけ ずらして うつす。
  const moves = [pieceCol || pieceRow ? `translate(${-pieceCol * 100} ${-pieceRow * 100})` : '', scale > 1 ? `scale(${scale})` : ''].filter(Boolean)
  const shift = moves.length ? moves.join(' ') : undefined
  // shared の ときは <defs> の え を よびだし、そうで ない ときは その ばで かく。
  const here = (element: ReactElement) => (shared ? null : element)
  return <svg viewBox="0 0 100 100" className={styles.tile} aria-hidden="true" focusable="false">
    <GroundArt ground={ground} waterMask={waterMask} checker={checker} />
    <g key={pop} className={pop ? (large ? styles.popLarge : styles.pop) : undefined}>
      {hasRoad && <Shared name={roadKey(roadMask, bridge)} inline={here(<Road mask={roadMask} bridge={bridge} />)} />}
      {(part === 'rail' || part === 'crossing') && <Shared name={railKey(railMask, bridge, part === 'crossing')}
        inline={here(<Rail mask={railMask} bridge={bridge} overRoad={part === 'crossing'} />)} />}
      {buildingId && building && <Shared name={bodyKey(buildingId)} transform={shift} inline={here(<g transform={shift}>{building.body}</g>)} />}
    </g>
    <rect className={styles.shade} width="100" height="100" />
    {buildingId && building && (building.windows || building.bulbs) && <Shared name={windowKey(buildingId, lit)} transform={shift}
      inline={here(<g transform={shift}>{windowsOf(buildingId, lit)}</g>)} />}
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
  const [cols, rows] = sizeOf(tool)
  if (tool === 'erase') art = <Bulldozer />
  else if (tool === 'road') art = <g><rect width="100" height="100" rx="18" fill="#92ce66" /><Road mask={10} bridge={false} /></g>
  else if (tool === 'rail') art = <g><rect width="100" height="100" rx="18" fill="#92ce66" /><Rail mask={10} bridge={false} overRoad={false} /></g>
  else if (tool === 'water') art = <g><rect width="100" height="100" rx="18" fill="#5bbde8" /><path d="M18 34 q8 -6 16 0 M58 70 q8 -6 16 0 M36 54 q8 -6 16 0" stroke="#d6f3ff" strokeWidth="4" fill="none" strokeLinecap="round" /></g>
  else {
    const building = BUILDINGS[tool]
    art = <g>
      {building.body}
      {building.windows?.map(([x, y, width, height]) => <rect key={`${x}-${y}`} className={styles.window} x={x} y={y} width={width} height={height} rx="1.5" />)}
    </g>
  }
  return <svg viewBox={`0 0 ${cols * 100} ${rows * 100}`} className={styles.icon} aria-hidden="true" focusable="false">{art}</svg>
}

// ---- のりもの -----------------------------------------------------------

/** うえ（きた）むきの くるま・でんしゃ。しゅるいと いろが おなじ あいだは かきなおさない。 */
export const VehicleArt = memo(function VehicleArt({ kind, variant }: { kind: 'car' | 'train'; variant: number }) {
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
})

// ---- ちずの みほん ---------------------------------------------------------

type PreviewKey = CategoryId | 'grass' | 'water' | 'rail' | 'crossing'

const PREVIEW_COLORS: Record<PreviewKey, string> = {
  grass: '#92ce66', water: '#5bbde8', rail: '#9a6b3c', crossing: '#f4f1ea',
  way: '#6b7280', home: '#ef5a4f', shop: '#f59f00', town: '#4d8be8', nature: '#2f9e44', fun: '#e05d8f',
}

function previewKey(tile: Town[number]): PreviewKey {
  const part = tile.part
  if (part === 'road') return 'way'
  if (part === 'rail' || part === 'crossing') return part
  if (isBuilding(part)) return findPart(part)?.category ?? 'home'
  return tile.ground
}

/** ちずを えらぶ カードの ちいさな みほん。いろごとに 1つの path に まとめて かく。 */
export const TownPreview = memo(function TownPreview({ town }: { town: Town }) {
  const paths = new Map<PreviewKey, string>()
  town.forEach((tile, index) => {
    const key = previewKey(tile)
    if (key === 'grass') return
    // 1マスの たてものは すこし ちいさく かいて、となりどうしの さかいめを みせる。
    const inset = isBuilding(tile.part) && tile.anchor === undefined ? 0.12 : 0
    const size = 1 - inset * 2
    paths.set(key, `${paths.get(key) ?? ''}M${colOf(index) + inset} ${rowOf(index) + inset}h${size}v${size}h-${size}z`)
  })
  const rows = town.length / COLS
  return <svg viewBox={`0 0 ${COLS} ${rows}`} className={styles.preview} aria-hidden="true" focusable="false">
    <rect width={COLS} height={rows} fill={PREVIEW_COLORS.grass} />
    {[...paths].map(([key, d]) => <path key={key} d={d} fill={PREVIEW_COLORS[key]} />)}
  </svg>
})
