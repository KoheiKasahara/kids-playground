// よぞらの ほしつなぎ の純粋ロジック。
// 星座の形（データ）と、「つぎにつなぐ星」を進める規則だけを持ち、描画・音・入力方法は持たない。

/** せいざ ができたあとに、形そのものが動き出すときの動き方。 */
export type ConstellationMotion = 'spin' | 'hop' | 'swim' | 'sail' | 'beat' | 'fly' | 'nod' | 'flutter'

export type Constellation = {
  id: string
  /** ひらがなの なまえ。「〇〇の せいざ」として表示する。 */
  name: string
  emoji: string
  /** 0〜100 の正方形座標。配列の順番が、つなぐ順番（1ばんめ・2ばんめ…）になる。 */
  points: readonly (readonly [number, number])[]
  /** できあがった形のぬり色。 */
  color: string
  motion: ConstellationMotion
}

export const CONSTELLATIONS: readonly Constellation[] = [
  {
    id: 'star',
    name: 'おほしさま',
    emoji: '⭐',
    // 正五角形の頂点を1つとばしでたどると、一筆書きの星になる。
    points: [
      [50, 12],
      [73.5, 84.4],
      [12, 39.6],
      [88, 39.6],
      [26.5, 84.4],
    ],
    color: '#ffd43b',
    motion: 'spin',
  },
  {
    id: 'house',
    name: 'おうち',
    emoji: '🏠',
    points: [
      [50, 14],
      [88, 48],
      [76, 48],
      [76, 86],
      [24, 86],
      [24, 48],
      [12, 48],
    ],
    color: '#ff8787',
    motion: 'hop',
  },
  {
    id: 'fish',
    name: 'さかな',
    emoji: '🐟',
    points: [
      [10, 50],
      [40, 28],
      [68, 44],
      [90, 28],
      [90, 72],
      [68, 56],
      [40, 72],
    ],
    color: '#74c0fc',
    motion: 'swim',
  },
  {
    id: 'yacht',
    name: 'ヨット',
    emoji: '⛵',
    points: [
      [48, 10],
      [78, 60],
      [90, 62],
      [78, 82],
      [22, 82],
      [10, 62],
      [48, 62],
    ],
    color: '#e9ecef',
    motion: 'sail',
  },
  {
    id: 'heart',
    name: 'ハート',
    emoji: '💖',
    points: [
      [50, 30],
      [66, 16],
      [86, 22],
      [90, 42],
      [50, 86],
      [10, 42],
      [14, 22],
      [34, 16],
    ],
    color: '#f783ac',
    motion: 'beat',
  },
  {
    id: 'moon',
    name: 'おつきさま',
    emoji: '🌙',
    // 外がわの丸みから内がわのくぼみへ戻り、三日月の輪郭をつくる。
    points: [
      [68, 10],
      [36, 20],
      [18, 50],
      [36, 80],
      [68, 90],
      [52, 70],
      [44, 50],
      [52, 30],
    ],
    color: '#ffe066',
    motion: 'sail',
  },
  {
    id: 'rocket',
    name: 'ロケット',
    emoji: '🚀',
    points: [
      [50, 8],
      [63, 26],
      [63, 62],
      [78, 80],
      [62, 76],
      [56, 90],
      [44, 90],
      [38, 76],
      [22, 80],
      [37, 62],
      [37, 26],
    ],
    color: '#ced4da',
    motion: 'fly',
  },
  {
    id: 'cat',
    name: 'ねこ',
    emoji: '🐱',
    points: [
      [22, 18],
      [38, 36],
      [62, 36],
      [78, 18],
      [82, 50],
      [72, 74],
      [50, 84],
      [28, 74],
      [18, 50],
    ],
    color: '#ffc078',
    motion: 'nod',
  },
  {
    id: 'flower',
    name: 'おはな',
    emoji: '🌼',
    // 6枚の花びらを、外がわと谷間の星をこうごにつないで描く。
    points: Array.from({ length: 12 }, (_, index): [number, number] => {
      const radius = index % 2 === 0 ? 40 : 25
      const angle = ((index * 30 - 90) * Math.PI) / 180
      return [Math.round(50 + radius * Math.cos(angle)), Math.round(50 + radius * Math.sin(angle))]
    }),
    color: '#ffd43b',
    motion: 'spin',
  },
  {
    id: 'umbrella',
    name: 'かさ',
    emoji: '☂️',
    points: [
      [50, 12],
      [72, 22],
      [88, 44],
      [92, 56],
      [76, 52],
      [62, 60],
      [50, 52],
      [38, 60],
      [24, 52],
      [8, 56],
      [12, 44],
      [28, 22],
      [40, 16],
    ],
    color: '#b197fc',
    motion: 'sail',
  },
  {
    id: 'butterfly',
    name: 'ちょうちょ',
    emoji: '🦋',
    points: [
      [50, 32],
      [64, 14],
      [88, 16],
      [84, 44],
      [62, 52],
      [80, 74],
      [66, 88],
      [50, 68],
      [34, 88],
      [20, 74],
      [38, 52],
      [16, 44],
      [12, 16],
      [36, 14],
    ],
    color: '#da77f2',
    motion: 'flutter',
  },
  {
    id: 'whale',
    name: 'くじら',
    emoji: '🐳',
    points: [
      [8, 56],
      [20, 34],
      [44, 28],
      [66, 34],
      [76, 44],
      [88, 26],
      [96, 36],
      [86, 50],
      [96, 64],
      [86, 72],
      [74, 58],
      [60, 70],
      [30, 72],
      [14, 66],
    ],
    color: '#4dabf7',
    motion: 'swim',
  },
  {
    id: 'airplane',
    name: 'ひこうき',
    emoji: '✈️',
    points: [
      [50, 6],
      [57, 16],
      [57, 38],
      [94, 58],
      [94, 68],
      [57, 58],
      [57, 78],
      [70, 86],
      [70, 97],
      [50, 90],
      [30, 97],
      [30, 86],
      [43, 78],
      [43, 58],
      [6, 68],
      [6, 58],
      [43, 38],
      [43, 16],
    ],
    color: '#a5d8ff',
    motion: 'fly',
  },
  {
    id: 'tree',
    name: 'もみのき',
    emoji: '🌲',
    points: [
      [50, 6],
      [62, 22],
      [56, 36],
      [72, 36],
      [64, 50],
      [82, 50],
      [72, 66],
      [90, 78],
      [60, 78],
      [60, 94],
      [40, 94],
      [40, 78],
      [10, 78],
      [28, 66],
      [18, 50],
      [36, 50],
      [28, 36],
      [44, 36],
      [38, 22],
    ],
    color: '#69db7c',
    motion: 'nod',
  },
  {
    id: 'robot',
    name: 'ロボット',
    emoji: '🤖',
    points: [
      [30, 8],
      [44, 8],
      [44, 22],
      [58, 22],
      [58, 8],
      [72, 8],
      [72, 22],
      [84, 22],
      [84, 72],
      [72, 72],
      [72, 90],
      [58, 90],
      [58, 72],
      [44, 72],
      [44, 90],
      [30, 90],
      [30, 72],
      [18, 72],
      [18, 22],
      [30, 22],
    ],
    color: '#74c0fc',
    motion: 'hop',
  },
  {
    id: 'dinosaur',
    name: 'きょうりゅう',
    emoji: '🦕',
    points: [
      [74, 8],
      [86, 8],
      [96, 16],
      [88, 24],
      [78, 26],
      [74, 40],
      [72, 54],
      [74, 88],
      [62, 88],
      [60, 72],
      [44, 72],
      [44, 88],
      [32, 88],
      [30, 70],
      [16, 72],
      [4, 80],
      [12, 60],
      [28, 50],
      [46, 42],
      [62, 40],
      [66, 22],
    ],
    color: '#8ce99a',
    motion: 'hop',
  },
  {
    id: 'castle',
    name: 'おしろ',
    emoji: '🏰',
    points: [
      [6, 92],
      [6, 18],
      [17, 18],
      [17, 29],
      [28, 29],
      [28, 18],
      [39, 18],
      [39, 44],
      [50, 28],
      [61, 44],
      [61, 18],
      [72, 18],
      [72, 29],
      [83, 29],
      [83, 18],
      [94, 18],
      [94, 92],
      [61, 92],
      [61, 72],
      [50, 61],
      [39, 72],
      [39, 92],
    ],
    color: '#b197fc',
    motion: 'beat',
  },
  {
    id: 'fireworks',
    name: 'はなび',
    emoji: '🎆',
    // 外がわ（半径44）と内がわ（半径24）をこうごにたどる、12本のとげの はなび。
    points: Array.from({ length: 24 }, (_, index): [number, number] => {
      const radius = index % 2 === 0 ? 44 : 24
      const angle = ((index * 15 - 90) * Math.PI) / 180
      return [Math.round((50 + radius * Math.cos(angle)) * 10) / 10, Math.round((50 + radius * Math.sin(angle)) * 10) / 10]
    }),
    color: '#ffa94d',
    motion: 'spin',
  },
  {
    id: 'diamond',
    name: 'ダイヤモンド',
    emoji: '💎',
    points: [
      [30, 16],
      [70, 16],
      [90, 38],
      [50, 88],
      [10, 38],
    ],
    color: '#99e9f2',
    motion: 'spin',
  },
  {
    id: 'tulip',
    name: 'チューリップ',
    emoji: '🌷',
    points: [
      [22, 20],
      [36, 34],
      [50, 16],
      [64, 34],
      [78, 20],
      [74, 56],
      [50, 70],
      [26, 56],
    ],
    color: '#ff8787',
    motion: 'nod',
  },
  {
    id: 'bird',
    name: 'ことり',
    emoji: '🐦',
    points: [
      [66, 22],
      [80, 28],
      [94, 38],
      [80, 44],
      [74, 60],
      [56, 74],
      [34, 74],
      [6, 62],
      [12, 48],
      [34, 50],
      [44, 30],
    ],
    color: '#ffe066',
    motion: 'fly',
  },
  {
    id: 'turtle',
    name: 'かめ',
    emoji: '🐢',
    points: [
      [20, 40],
      [36, 24],
      [60, 24],
      [74, 38],
      [90, 34],
      [96, 48],
      [80, 56],
      [76, 74],
      [64, 62],
      [40, 62],
      [30, 76],
      [22, 58],
      [8, 58],
    ],
    color: '#8ce99a',
    motion: 'swim',
  },
  {
    id: 'crown',
    name: 'おうかん',
    emoji: '👑',
    // 5つの とんがりと、下のふちの なみなみを ぐるりと たどる。
    points: [
      [8, 86],
      [8, 66],
      [10, 24],
      [20, 50],
      [30, 16],
      [40, 48],
      [50, 8],
      [60, 48],
      [70, 16],
      [80, 50],
      [90, 24],
      [92, 66],
      [92, 86],
      [78, 94],
      [64, 86],
      [50, 94],
      [36, 86],
      [22, 94],
    ],
    color: '#fcc419',
    motion: 'beat',
  },
  {
    id: 'train',
    name: 'きかんしゃ',
    emoji: '🚂',
    // えんとつ・うんてんせき・しゃりんの でこぼこを ひとまわりする。
    points: [
      [4, 76],
      [12, 60],
      [12, 44],
      [24, 44],
      [24, 28],
      [18, 12],
      [44, 12],
      [38, 28],
      [38, 44],
      [58, 44],
      [58, 16],
      [94, 16],
      [94, 76],
      [84, 90],
      [72, 76],
      [60, 90],
      [48, 76],
      [36, 90],
      [24, 76],
      [14, 90],
    ],
    color: '#ff6b6b',
    motion: 'sail',
  },
]

export type HoshiCourse = 'easy' | 'normal' | 'hard'

/** コースごとに遊ぶ星座の順番。かんたん → ふつう → むずかしい の順に星が多くなる形だけにする。 */
export const COURSE_CONSTELLATION_IDS: Record<HoshiCourse, readonly string[]> = {
  easy: ['star', 'diamond', 'house', 'fish', 'yacht', 'heart', 'tulip', 'moon'],
  normal: ['cat', 'rocket', 'bird', 'flower', 'umbrella', 'turtle', 'butterfly', 'whale'],
  hard: ['crown', 'airplane', 'tree', 'robot', 'train', 'dinosaur', 'castle', 'fireworks'],
}

export function courseConstellations(course: HoshiCourse): Constellation[] {
  return COURSE_CONSTELLATION_IDS[course].map((id) => {
    const found = CONSTELLATIONS.find((constellation) => constellation.id === id)
    if (!found) throw new Error(`星座 ${id} が見つかりません`)
    return found
  })
}

export type BoardState = {
  /** つなぎおわった星の数。つぎにつなぐ星の番号（0はじまり）と同じ値になる。 */
  connected: number
  /** まちがえた星をさわったあとは、つぎの星を光らせて教える。正しくつなぐと消える。 */
  hint: boolean
}

export type TapResult = 'connect' | 'complete' | 'wrong' | 'none'

export function createBoard(): BoardState {
  return { connected: 0, hint: false }
}

export function isComplete(board: BoardState, constellation: Constellation): boolean {
  return board.connected >= constellation.points.length
}

/**
 * 星をさわったときの進行。つぎの番号の星ならつなぐ。最後の星をつなぐと、
 * 1ばんめの星まで自動で線がもどって形ができあがる（'complete'）。
 * もうつないだ星は、なぞっている途中にふれることが多いので何もしない（'none'）。
 */
export function tapStar(
  board: BoardState,
  constellation: Constellation,
  starIndex: number,
): { board: BoardState; result: TapResult } {
  const total = constellation.points.length
  if (isComplete(board, constellation) || starIndex < 0 || starIndex >= total) {
    return { board, result: 'none' }
  }
  if (starIndex < board.connected) return { board, result: 'none' }
  if (starIndex !== board.connected) {
    return { board: { ...board, hint: true }, result: 'wrong' }
  }
  const next: BoardState = { connected: board.connected + 1, hint: false }
  return { board: next, result: next.connected >= total ? 'complete' : 'connect' }
}

/** 0〜100座標で、指の位置からいちばん近い星（ふれられる距離の中だけ）を探す。 */
export function findStarNear(
  constellation: Constellation,
  x: number,
  y: number,
  radius: number,
): number | undefined {
  let best: number | undefined
  let bestDistance = radius
  constellation.points.forEach(([starX, starY], index) => {
    const distance = Math.hypot(starX - x, starY - y)
    if (distance <= bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}

/** できあがった形の中心。絵文字を重ねる位置に使う。 */
export function centerOf(constellation: Constellation): [number, number] {
  const xs = constellation.points.map(([x]) => x)
  const ys = constellation.points.map(([, y]) => y)
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
}
