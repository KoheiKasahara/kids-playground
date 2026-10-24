/** とまった ときに おきる できごと。すすむ・もどる・ワープは さらに べつの できごとを よばない。 */
export type SquareEvent =
  | { kind: 'forward'; steps: number }
  | { kind: 'back'; steps: number }
  | { kind: 'rest' }
  | { kind: 'again' }
  /** とびさきは とまった ときに この なかから くじびきで きまる（ばんめんには ださない）。 */
  | { kind: 'warp'; to: readonly number[] }

export type Square = { kind: 'start' } | { kind: 'normal' } | { kind: 'goal' } | SquareEvent

export type CourseId = 'mori' | 'okashi' | 'umi'

/** ばんめんの マスめ。1マスぶんが 1。 */
export type GridPoint = { x: number; y: number }

export type LandmarkKind = 'bigTree' | 'pond' | 'bearHouse' | 'castle' | 'island' | 'palmIsland' | 'ship' | 'lighthouse'
export type SceneryKind = 'tree' | 'pine' | 'flower' | 'mushroom' | 'lollipop' | 'donut' | 'candy' | 'cupcake' | 'wave' | 'fish' | 'shell' | 'rock'

/** みちの ない ところに おく おおきな めじるし。x, y は ひだりうえの マスめ。 */
export type Landmark = { kind: LandmarkKind; x: number; y: number; w: number; h: number }

export type Course = {
  id: CourseId
  name: string
  /** コースえらびの カードに そえる みじかい ことば。 */
  tagline: string
  /** スタートから ゴールまでの マスの ならび。となりあう マスは かならず 1マス はなれる。 */
  path: readonly GridPoint[]
  /** スタートと ゴールを ふくめた マスの かず。 */
  length: number
  events: Readonly<Record<number, SquareEvent>>
  landmarks: readonly Landmark[]
  /** あいた ところに ちらす こものの しゅるい。 */
  scenery: readonly SceneryKind[]
}

const DIRECTIONS = { R: { x: 1, y: 0 }, L: { x: -1, y: 0 }, U: { x: 0, y: -1 }, D: { x: 0, y: 1 } } as const

/** 'R3 D2 L1' のような みちじゅんを、スタート（0, 0）から たどった マスめの ならびに する。 */
export function traceRoute(route: string): GridPoint[] {
  const path: GridPoint[] = [{ x: 0, y: 0 }]
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

type CourseSource = Omit<Course, 'path' | 'length'> & { route: string }

function defineCourse({ route, ...course }: CourseSource): Course {
  const path = traceRoute(route)
  return { ...course, path, length: path.length }
}

export const COURSES: readonly Course[] = [
  defineCourse({
    id: 'mori',
    name: 'もりの こみち',
    tagline: 'くねくね やまみち',
    // もりの なかを くねくね あるき、いけの まわりを とおって くまさんの いえへ。
    route: 'R2 D2 R2 U2 R3 D4 L7 D3 R2 D2 R3',
    events: {
      2: { kind: 'forward', steps: 2 },
      5: { kind: 'again' },
      8: { kind: 'back', steps: 1 },
      11: { kind: 'rest' },
      14: { kind: 'warp', to: [20, 24, 10] },
      17: { kind: 'forward', steps: 2 },
      21: { kind: 'back', steps: 3 },
      25: { kind: 'again' },
      28: { kind: 'rest' },
      30: { kind: 'back', steps: 3 },
    },
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
    // そとがわから ぐるぐる まわって、まんなかの おかしの おしろへ。
    route: 'R8 D7 L7 U5 R5 D3 L3',
    events: {
      3: { kind: 'again' },
      5: { kind: 'forward', steps: 3 },
      9: { kind: 'rest' },
      12: { kind: 'back', steps: 2 },
      15: { kind: 'warp', to: [22, 27, 6] },
      18: { kind: 'again' },
      20: { kind: 'forward', steps: 2 },
      24: { kind: 'back', steps: 3 },
      26: { kind: 'rest' },
      29: { kind: 'warp', to: [33, 35, 19] },
      32: { kind: 'forward', steps: 2 },
      36: { kind: 'back', steps: 3 },
    },
    landmarks: [
      { kind: 'castle', x: 2, y: 3, w: 4, h: 2 },
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
      2: { kind: 'forward', steps: 2 },
      5: { kind: 'again' },
      8: { kind: 'back', steps: 2 },
      10: { kind: 'warp', to: [18, 25, 3] },
      13: { kind: 'rest' },
      16: { kind: 'forward', steps: 3 },
      20: { kind: 'again' },
      23: { kind: 'back', steps: 2 },
      26: { kind: 'warp', to: [31, 36, 14] },
      29: { kind: 'rest' },
      33: { kind: 'forward', steps: 2 },
      37: { kind: 'back', steps: 3 },
      39: { kind: 'again' },
      42: { kind: 'warp', to: [46, 50, 30] },
      44: { kind: 'rest' },
      47: { kind: 'forward', steps: 3 },
      49: { kind: 'back', steps: 3 },
      51: { kind: 'back', steps: 5 },
    },
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
  return course.length - 1
}

export function squareAt(course: Course, index: number): Square {
  if (index <= 0) return { kind: 'start' }
  if (index >= goalIndex(course)) return { kind: 'goal' }
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
