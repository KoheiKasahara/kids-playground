/** とまった ときに おきる できごと。すすむ・もどる・ワープ・いれかわりは さらに べつの できごとを よばない。 */
export type SquareEvent =
  | { kind: 'forward'; steps: number }
  | { kind: 'back'; steps: number }
  | { kind: 'rest' }
  | { kind: 'again' }
  /** とびさきは とまった ときに この なかから くじびきで きまる（ばんめんには ださない）。 */
  | { kind: 'warp'; to: readonly number[] }
  /** つぎの じぶんの ばんは サイコロを 2こ ふる。 */
  | { kind: 'double' }
  /** いちばん まえの ひとと ばしょを いれかえる。じぶんが いちばん まえなら そのまま。 */
  | { kind: 'swap' }

/** fork は みちが ふたつに わかれる マス。とおりかかると そこで とまり、つぎの ばんに みちを えらぶ。 */
export type Square = { kind: 'start' } | { kind: 'normal' } | { kind: 'goal' } | { kind: 'fork' } | SquareEvent

export type CourseId = 'mori' | 'okashi' | 'umi'

/** ばんめんの マスめ。1マスぶんが 1。 */
export type GridPoint = { x: number; y: number }

export type LandmarkKind = 'bigTree' | 'pond' | 'bearHouse' | 'castle' | 'island' | 'palmIsland' | 'ship' | 'lighthouse'
export type SceneryKind = 'tree' | 'pine' | 'flower' | 'mushroom' | 'lollipop' | 'donut' | 'candy' | 'cupcake' | 'wave' | 'fish' | 'shell' | 'rock'

/** みちの ない ところに おく おおきな めじるし。x, y は ひだりうえの マスめ。 */
export type Landmark = { kind: LandmarkKind; x: number; y: number; w: number; h: number }

/** わかれみちから えらべる みち。first は その みちの さいしょの マス。 */
export type CourseRoute = { label: string; hint: string; first: number }

export type Course = {
  id: CourseId
  name: string
  /** コースえらびの カードに そえる みじかい ことば。 */
  tagline: string
  /** スタートから ゴールまでの おおどおりの マスの ならび。となりあう マスは かならず 1マス はなれる。 */
  path: readonly GridPoint[]
  /** ぜんぶの マスの ばしょ。0〜path.length-1 は おおどおり、その あとに わきみちの マスが つづく。 */
  cells: readonly GridPoint[]
  /** スタートと ゴールを ふくめた ぜんぶの マスの かず。 */
  length: number
  /** その マスから 1マス すすんだ さき。わかれみちだけ ふたつ ある。 */
  next: readonly (readonly number[])[]
  /** その マスから 1マス もどった さき。わきみちが もどってくる マスでは おおどおりへ もどる。 */
  prev: readonly number[]
  /** わかれみちの マスと、そこから えらべる みち。 */
  forks: Readonly<Record<number, readonly CourseRoute[]>>
  /** わきみちの マスが どの みちか（おおどおりの マスには ない）。 */
  routeOf: Readonly<Record<number, string>>
  /** その マスから ゴールまで いちばん みじかい ときの マスの かず。 */
  toGoal: readonly number[]
  /** ばんめんに かく みち。おおどおりと、わかれみち→わきみち→もどる マス。 */
  roads: readonly (readonly number[])[]
  events: Readonly<Record<number, SquareEvent>>
  landmarks: readonly Landmark[]
  /** あいた ところに ちらす こものの しゅるい。 */
  scenery: readonly SceneryKind[]
}

const DIRECTIONS = { R: { x: 1, y: 0 }, L: { x: -1, y: 0 }, U: { x: 0, y: -1 }, D: { x: 0, y: 1 } } as const

/** 'R3 D2 L1' のような みちじゅんを、from（ふつうは スタートの 0, 0）から たどった マスめの ならびに する。 */
export function traceRoute(route: string, from: GridPoint = { x: 0, y: 0 }): GridPoint[] {
  const path: GridPoint[] = [from]
  for (const token of route.trim().split(/\s+/)) {
    const direction = DIRECTIONS[token[0] as keyof typeof DIRECTIONS]
    const steps = Number(token.slice(1))
    if (!direction || !Number.isInteger(steps) || steps <= 0) throw new Error(`bad route token: ${token}`)
    for (let step = 0; step < steps; step++) {
      const last = path.at(-1)!
      path.push({ x: last.x + direction.x, y: last.y + direction.y })
    }
  }
  return path
}

/** わきみち。from の マスで おおどおりから わかれ、route を たどって to の マスへ もどる。おおどおりと おなじ ながさ。 */
export type BranchSource = {
  from: number
  to: number
  route: string
  label: string
  hint: string
  /** わかれみちで おおどおりを えらぶ ときの なまえと ひとこと。 */
  mainLabel: string
  mainHint: string
  /** わきみちの なかの しかけ。1 が わかれみちの つぎの マス。 */
  events?: Readonly<Record<number, SquareEvent>>
}

export type CourseSource = Omit<Course, 'path' | 'cells' | 'length' | 'next' | 'prev' | 'forks' | 'routeOf' | 'toGoal' | 'roads'> & {
  route: string
  branches?: readonly BranchSource[]
}

const sameCell = (a: GridPoint, b: GridPoint) => a.x === b.x && a.y === b.y

export function defineCourse({ route, branches = [], events, ...course }: CourseSource): Course {
  const path = traceRoute(route)
  const cells = [...path]
  const next = path.map((_, index) => (index < path.length - 1 ? [index + 1] : []))
  const prev = path.map((_, index) => Math.max(0, index - 1))
  const forks: Record<number, CourseRoute[]> = {}
  const routeOf: Record<number, string> = {}
  const roads: number[][] = [path.map((_, index) => index)]
  const allEvents: Record<number, SquareEvent> = { ...events }

  for (const branch of branches) {
    const traced = traceRoute(branch.route, path[branch.from]!)
    if (!sameCell(traced.at(-1)!, path[branch.to]!)) throw new Error(`branch from ${branch.from} does not reach ${branch.to}`)
    if (forks[branch.from]) throw new Error(`two branches from ${branch.from}`)
    const ids = traced.slice(1, -1).map((cell) => {
      cells.push(cell)
      return cells.length - 1
    })
    // みじかい ほうばかり えらばれない ように、おおどおりと おなじ ながさに する。
    if (ids.length + 1 !== branch.to - branch.from) throw new Error(`branch from ${branch.from} must be as long as the main road`)
    ids.forEach((id, index) => {
      next[id] = [ids[index + 1] ?? branch.to]
      prev[id] = ids[index - 1] ?? branch.from
      routeOf[id] = branch.label
    })
    next[branch.from] = [...next[branch.from]!, ids[0]!]
    forks[branch.from] = [
      { label: branch.mainLabel, hint: branch.mainHint, first: branch.from + 1 },
      { label: branch.label, hint: branch.hint, first: ids[0]! },
    ]
    roads.push([branch.from, ...ids, branch.to])
    for (const [step, event] of Object.entries(branch.events ?? {})) allEvents[ids[Number(step) - 1]!] = event
  }

  // ゴールから さかのぼって、どの マスからも いちばん みじかい のこりを かぞえる。
  const goal = path.length - 1
  const toGoal = cells.map(() => Infinity)
  toGoal[goal] = 0
  for (let changed = true; changed;) {
    changed = false
    next.forEach((targets, id) => {
      const best = Math.min(...targets.map((target) => toGoal[target]! + 1))
      if (best < toGoal[id]!) {
        toGoal[id] = best
        changed = true
      }
    })
  }

  return { ...course, path, cells, length: cells.length, next, prev, forks, routeOf, toGoal, roads, events: allEvents }
}

/**
 * わかれみちの ふたつの みちは かならず おなじ ながさに する（みじかい ほうばかり えらばれない ように）。
 * ちがいは とちゅうの しかけだけ。
 */
export const COURSES: readonly Course[] = [
  defineCourse({
    id: 'mori',
    name: 'もりの こみち',
    tagline: 'くねくね やまみち',
    // もりの なかを くねくね あるき、いけの まわりを とおって くまさんの いえへ。
    route: 'R2 D2 R2 U2 R3 D4 L7 D3 R2 D2 R3',
    events: {
      4: { kind: 'forward', steps: 2 },
      5: { kind: 'again' },
      8: { kind: 'back', steps: 1 },
      11: { kind: 'rest' },
      14: { kind: 'warp', to: [24, 26, 10] },
      16: { kind: 'double' },
      21: { kind: 'swap' },
      25: { kind: 'back', steps: 3 },
      28: { kind: 'rest' },
      30: { kind: 'back', steps: 3 },
    },
    branches: [
      {
        // たにを くだらずに、おかの うえを まっすぐ わたる。
        from: 2,
        to: 11,
        route: 'U2 R5 D2',
        label: 'おかの みち',
        hint: 'サイコロ2こが ある',
        mainLabel: 'たにの みち',
        mainHint: 'もう1かいが ある',
        events: { 2: { kind: 'double' }, 5: { kind: 'back', steps: 2 }, 7: { kind: 'forward', steps: 1 } },
      },
    ],
    landmarks: [
      { kind: 'bigTree', x: 0, y: 1, w: 2, h: 2 },
      { kind: 'pond', x: 3, y: 5, w: 3, h: 2 },
      { kind: 'bearHouse', x: 6, y: 7, w: 2, h: 2 },
    ],
    scenery: ['tree', 'pine', 'flower', 'mushroom'],
  }),
  defineCourse({
    id: 'okashi',
    name: 'おかしの くに',
    tagline: 'ぐるぐる うずまき',
    // かいだんを おりてから そとがわを ぐるぐる まわって、まんなかの おかしの おしろへ。
    route: 'R5 D3 R3 D7 L7 U5 R5 D3 L3',
    events: {
      2: { kind: 'forward', steps: 2 },
      7: { kind: 'again' },
      9: { kind: 'rest' },
      14: { kind: 'back', steps: 2 },
      16: { kind: 'warp', to: [24, 28, 10] },
      19: { kind: 'swap' },
      21: { kind: 'forward', steps: 2 },
      26: { kind: 'double' },
      30: { kind: 'back', steps: 3 },
      32: { kind: 'rest' },
      34: { kind: 'warp', to: [37, 39, 23] },
      35: { kind: 'forward', steps: 2 },
      38: { kind: 'back', steps: 2 },
    },
    branches: [
      {
        // かいだんを おりずに、キャンディの おかを まわる。
        from: 5,
        to: 11,
        route: 'R3 D3',
        label: 'キャンディの おか',
        hint: 'サイコロ2こが ある',
        mainLabel: 'かいだん',
        mainHint: 'もう1かいが ある',
        events: { 2: { kind: 'double' }, 4: { kind: 'back', steps: 1 } },
      },
    ],
    landmarks: [
      { kind: 'castle', x: 2, y: 6, w: 4, h: 2 },
    ],
    scenery: ['lollipop', 'donut', 'candy', 'cupcake'],
  }),
  defineCourse({
    id: 'umi',
    name: 'うみの ぼうけん',
    tagline: 'しまを めぐる ながい たび',
    // はまべから しまを めぐって、とおくの とうだいを めざす。
    route: 'D2 R2 D2 R3 D2 R2 U6 R2 D9 L4 D2 L4 D3 R3 D2 R4 U2',
    events: {
      4: { kind: 'forward', steps: 2 },
      5: { kind: 'again' },
      8: { kind: 'back', steps: 2 },
      10: { kind: 'warp', to: [18, 25, 3] },
      13: { kind: 'rest' },
      16: { kind: 'forward', steps: 3 },
      20: { kind: 'again' },
      23: { kind: 'back', steps: 2 },
      26: { kind: 'warp', to: [31, 36, 14] },
      29: { kind: 'rest' },
      32: { kind: 'double' },
      37: { kind: 'back', steps: 2 },
      39: { kind: 'again' },
      42: { kind: 'warp', to: [46, 50, 30] },
      44: { kind: 'rest' },
      47: { kind: 'forward', steps: 3 },
      49: { kind: 'swap' },
      51: { kind: 'back', steps: 5 },
    },
    branches: [
      {
        // おかを のぼらずに、すなはまを まっすぐ あるく。
        from: 2,
        to: 11,
        route: 'D4 R5',
        label: 'すなはま',
        hint: 'すすむが ある',
        mainLabel: 'おかの うえ',
        mainHint: 'ワープが ある',
        events: { 2: { kind: 'forward', steps: 2 }, 5: { kind: 'rest' }, 7: { kind: 'double' } },
      },
      {
        // しまの よこを ふねで わたる。
        from: 34,
        to: 40,
        route: 'L4 D2',
        label: 'ふねの みち',
        hint: 'すすむが ある',
        mainLabel: 'いわば',
        mainHint: 'もう1かいが ある',
        events: { 2: { kind: 'forward', steps: 2 }, 5: { kind: 'back', steps: 2 } },
      },
    ],
    landmarks: [
      { kind: 'island', x: 4, y: 0, w: 2, h: 2 },
      { kind: 'palmIsland', x: 1, y: 7, w: 3, h: 2 },
      { kind: 'island', x: 6, y: 7, w: 3, h: 2 },
      { kind: 'ship', x: 6, y: 11, w: 2, h: 2 },
      { kind: 'lighthouse', x: 9, y: 12, w: 1, h: 2 },
    ],
    scenery: ['wave', 'fish', 'shell', 'rock'],
  }),
]

export function courseById(id: CourseId): Course {
  return COURSES.find((course) => course.id === id) ?? COURSES[0]!
}

export function goalIndex(course: Course): number {
  return course.path.length - 1
}

export function squareAt(course: Course, index: number): Square {
  if (index <= 0) return { kind: 'start' }
  if (index === goalIndex(course)) return { kind: 'goal' }
  if (course.forks[index]) return { kind: 'fork' }
  return course.events[index] ?? { kind: 'normal' }
}

export type PieceId = 'usagi' | 'kuma' | 'neko' | 'kaeru'

export type Piece = {
  id: PieceId
  name: string
  /** マスの うえの コマの だいざと、じゅんばんの ふだに つかう いろ。 */
  color: string
}

/** ひとりで あそぶ ときは 2ばんめの くまさんを コンピュータが うごかす。 */
export const PIECES: readonly Piece[] = [
  { id: 'usagi', name: 'うさぎ', color: '#e0587f' },
  { id: 'kuma', name: 'くま', color: '#3f78d0' },
  { id: 'neko', name: 'ねこ', color: '#e08a1f' },
  { id: 'kaeru', name: 'かえる', color: '#2e9a58' },
]

export const MAX_PLAYERS = PIECES.length
