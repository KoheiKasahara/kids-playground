/** とまった ときに おきる できごと。すすむ・もどる・ワープは さらに べつの できごとを よばない。 */
export type SquareEvent =
  | { kind: 'forward'; steps: number }
  | { kind: 'back'; steps: number }
  | { kind: 'rest' }
  | { kind: 'again' }
  | { kind: 'warp'; to: number }

export type Square = { kind: 'start' } | { kind: 'normal' } | { kind: 'goal' } | SquareEvent

export type CourseId = 'mori' | 'okashi' | 'umi'

export type Course = {
  id: CourseId
  name: string
  /** コースえらびの カードに そえる みじかい ことば。 */
  tagline: string
  /** ばんめんの よこの マスの かず。ジグザグに ならべる。 */
  columns: number
  /** スタートと ゴールを ふくめた マスの かず。 */
  length: number
  events: Readonly<Record<number, SquareEvent>>
}

export const COURSES: readonly Course[] = [
  {
    id: 'mori',
    name: 'もりの こみち',
    tagline: 'みじかくて やさしい',
    columns: 5,
    length: 20,
    events: {
      3: { kind: 'forward', steps: 2 },
      6: { kind: 'again' },
      8: { kind: 'back', steps: 1 },
      11: { kind: 'warp', to: 15 },
      13: { kind: 'rest' },
      16: { kind: 'back', steps: 2 },
    },
  },
  {
    id: 'okashi',
    name: 'おかしの くに',
    tagline: 'しかけが いっぱい',
    columns: 5,
    length: 25,
    events: {
      2: { kind: 'forward', steps: 2 },
      5: { kind: 'rest' },
      7: { kind: 'again' },
      9: { kind: 'warp', to: 14 },
      12: { kind: 'back', steps: 2 },
      16: { kind: 'forward', steps: 3 },
      18: { kind: 'again' },
      20: { kind: 'back', steps: 3 },
      22: { kind: 'rest' },
    },
  },
  {
    id: 'umi',
    name: 'うみの ぼうけん',
    tagline: 'ながい たび',
    columns: 5,
    length: 30,
    events: {
      2: { kind: 'forward', steps: 2 },
      5: { kind: 'back', steps: 2 },
      7: { kind: 'again' },
      10: { kind: 'warp', to: 17 },
      13: { kind: 'rest' },
      15: { kind: 'forward', steps: 3 },
      19: { kind: 'back', steps: 3 },
      21: { kind: 'again' },
      23: { kind: 'warp', to: 27 },
      25: { kind: 'rest' },
    },
  },
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
