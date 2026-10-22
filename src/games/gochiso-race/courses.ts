import { FOODS, type FoodKind } from './foods'

// レースの コース。ならべた「パーツ」を ひだりから じゅんに つないで、じめん・あな・だん・
// トンネル（スライディングで くぐる）・ジャンプだい・かそくそうち・わかれみち・はち・くも・ごちそうの ばしょを つくる。
// きょりの たんいは がめんの 1ドットくらい。y は じめんから うえへの たかさ。

export type ThemeId = 'meadow' | 'sweets' | 'starry'

/** じめん。x0〜x1 の あいだは top より したが ぜんぶ かたい。あいだが あいていれば あな。 */
export type Span = { x0: number; x1: number; top: number }
/** うえに のれる くも。したからは すりぬける。 */
export type Cloud = { x0: number; x1: number; top: number }
/** かたい ブロック。y0 より したは あいていて（スライディングで くぐる）、y1 の うえには のれる。 */
export type Block = { x0: number; x1: number; y0: number; y1: number }
/** じめん（top）の うえに おく いた。ジャンプだい・かそくそうち。 */
export type Pad = { x0: number; x1: number; top: number }
/** ジャンプだい。fork は わかれみちの いりぐち（スライディングで とおりすぎると したの みち）。 */
export type Spring = Pad & { fork: boolean }
/** わかれみちの かんばん。 */
export type Sign = { x: number; top: number }
/** うえ・したに ゆれて とぶ はち。 */
export type Bee = { x: number; y: number; amp: number; period: number; phase: number }
export type FoodSpot = { id: number; kind: FoodKind; x: number; y: number }

/** あいての はしりかた。 */
export type RivalStyle = {
  /** はやさ（1 = じぶんと おなじ）。 */
  speed: number
  /** たかい ところの ごちそうを ジャンプして とりに いく わりあい。 */
  greed: number
  /** あなや だんの まえで まよって たちどまる わりあい。 */
  hesitate: number
  /** さわった ごちそうを たべる わりあい（すききらいが あるので ぜんぶは たべない）。 */
  appetite: number
}

export type Course = {
  id: ThemeId
  name: string
  /** えらぶ がめんに だす ひとこと。 */
  lead: string
  theme: ThemeId
  rival: RivalStyle
  spans: readonly Span[]
  clouds: readonly Cloud[]
  blocks: readonly Block[]
  springs: readonly Spring[]
  boosts: readonly Pad[]
  signs: readonly Sign[]
  bees: readonly Bee[]
  foods: readonly FoodSpot[]
  /** スタートの いち（はしる ひとの ひだりはし）。 */
  start: number
  /** ゴールの せん。 */
  goal: number
  /** じめんの おわり。 */
  end: number
  /** ごちそうの てんすうの ごうけい。 */
  foodTotal: number
}

export type Piece =
  /** たいらな みち。row が あれば じめんの ちかくに n こ（なければ ぜんぶ）ごちそうを ならべる。 */
  | { t: 'run'; len: number; row?: FoodKind; n?: number; y?: number }
  /** あな。arc が あれば ジャンプの みちに ごちそうを ならべる。 */
  | { t: 'gap'; w: number; arc?: FoodKind }
  /** じめんの たかさを h だけ かえて len はしる（だんの のぼり・くだり）。 */
  | { t: 'step'; h: number; len: number; row?: FoodKind; n?: number }
  /** ジャンプで こえる ちいさな やま。top が あれば うえに ごちそう。 */
  | { t: 'hurdle'; h: number; w?: number; top?: FoodKind }
  /** トンネル。スライディングで くぐる（row は なかの ごちそう、top は うえの ごちそう）。h は うえの たかさ。 */
  | { t: 'tunnel'; len: number; h?: number; row?: FoodKind; n?: number; top?: FoodKind }
  /** ジャンプだい（すすまない）。のると たかく とぶ。 */
  | { t: 'spring'; at?: number }
  /** かそくそうち（すすまない）。のると しばらく はやく なる。 */
  | { t: 'boost'; at?: number }
  /**
   * わかれみち。ジャンプだいで うえの くもの みちへ、スライディングで とおりすぎると トンネルを くぐって したの みちへ。
   * うえの みちは len の ながさで y の たかさ。このあとに ならべる パーツが したの みち。
   */
  | { t: 'fork'; len: number; y?: number; row?: FoodKind; n?: number }
  /** はち。y の たかさを まんなかに ゆれる。 */
  | { t: 'bee'; y: number; amp?: number; period?: number; phase?: number; len?: number; row?: FoodKind; n?: number }
  /** くもの あしば。いまの ばしょから at さきに おく（すすまない）。 */
  | { t: 'cloud'; y: number; len: number; at?: number; row?: FoodKind; n?: number }
  /** たかい ところの ごちそう ひとつ（すすまない）。 */
  | { t: 'high'; kind: FoodKind; y: number; at?: number }
  /** たてに つんだ ごちそう（とまって ジャンプ すると ぜんぶ とれる）。 */
  | { t: 'tower'; kind: FoodKind; n: number; at?: number }

export type CourseDef = {
  id: ThemeId
  name: string
  lead: string
  rival: RivalStyle
  pieces: readonly Piece[]
}

export const RUNNER_START = 40
/** ゴールの あとも すこし はしれる ように のばす じめん。 */
const AFTER_GOAL = 700
const BEFORE_GOAL = 240
const ROW_GAP = 44
const ROW_Y = 20
/** トンネルの てんじょうの たかさ（たっていると ぶつかり、スライディングなら くぐれる）。 */
export const TUNNEL_GAP = 30
/** トンネルの うえの たかさ（ふつうの ジャンプでは とどかない）。 */
const TUNNEL_TOP = 150
/** トンネルの なかの ごちそうの たかさ。 */
const TUNNEL_ROW_Y = 14
/** ジャンプだいは どうぶつ 2ひきぶん より ひろく して ふみやすく する。 */
export const SPRING_W = 88
export const BOOST_W = 96
/** わかれみちの ジャンプだいの あとの トンネル。 */
const FORK_ROOM = 16
const FORK_GATE = 120
const FORK_GATE_TOP = 120
/** わかれみちの うえの みちの たかさ と はじまり（ジャンプだいの ひだりはしから）。 */
const FORK_Y = 170
const FORK_PATH_AT = 100

export function buildCourse(def: CourseDef): Course {
  const spans: Span[] = []
  const clouds: Cloud[] = []
  const blocks: Block[] = []
  const springs: Spring[] = []
  const boosts: Pad[] = []
  const signs: Sign[] = []
  const bees: Bee[] = []
  const foods: FoodSpot[] = []
  let x = 0
  let top = 0
  let open: Span = { x0: -600, x1: 0, top: 0 }
  const close = () => {
    if (open.x1 > open.x0) spans.push(open)
  }
  const food = (kind: FoodKind, fx: number, fy: number) => {
    foods.push({ id: foods.length, kind, x: Math.round(fx), y: Math.round(fy) })
  }
  const row = (kind: FoodKind, from: number, len: number, y: number, count?: number) => {
    const n = Math.max(1, Math.min(count ?? Infinity, Math.floor((len - 40) / ROW_GAP) + 1))
    const offset = (len - (n - 1) * ROW_GAP) / 2
    for (let i = 0; i < n; i++) food(kind, from + offset + i * ROW_GAP, y)
  }
  const run = (len: number) => {
    x += len
    open.x1 = x
  }
  const restart = (newTop: number, at: number) => {
    close()
    top = newTop
    x = at
    open = { x0: x, x1: x, top }
  }
  const tunnel = (len: number, h: number, inside?: FoodKind, n?: number, onTop?: FoodKind) => {
    blocks.push({ x0: x, x1: x + len, y0: top + TUNNEL_GAP, y1: top + h })
    if (inside) row(inside, x, len, top + TUNNEL_ROW_Y, n)
    if (onTop) food(onTop, x + len / 2, top + h + ROW_Y)
    run(len)
  }

  for (const piece of def.pieces) {
    switch (piece.t) {
      case 'run':
        if (piece.row) row(piece.row, x, piece.len, top + (piece.y ?? ROW_Y), piece.n)
        run(piece.len)
        break
      case 'gap': {
        const from = x
        if (piece.arc) {
          const n = Math.max(3, Math.round(piece.w / 34) + 1)
          for (let i = 0; i < n; i++) {
            const u = (i + .5) / n
            food(piece.arc, from - 24 + (piece.w + 48) * u, top + 34 + 92 * 4 * u * (1 - u))
          }
        }
        restart(top, from + piece.w)
        break
      }
      case 'step':
        restart(top + piece.h, x)
        if (piece.row) row(piece.row, x, piece.len, top + ROW_Y, piece.n)
        run(piece.len)
        break
      case 'hurdle': {
        const w = piece.w ?? 44
        const base = top
        restart(base + piece.h, x)
        if (piece.top) food(piece.top, x + w / 2, top + 26)
        run(w)
        restart(base, x)
        break
      }
      case 'tunnel':
        tunnel(piece.len, piece.h ?? TUNNEL_TOP, piece.row, piece.n, piece.top)
        break
      case 'spring': {
        const from = x + (piece.at ?? 0)
        springs.push({ x0: from, x1: from + SPRING_W, top, fork: false })
        break
      }
      case 'boost': {
        const from = x + (piece.at ?? 0)
        boosts.push({ x0: from, x1: from + BOOST_W, top })
        break
      }
      case 'fork': {
        const from = x
        const y = top + (piece.y ?? FORK_Y)
        signs.push({ x: from - 36, top })
        springs.push({ x0: from, x1: from + SPRING_W, top, fork: true })
        clouds.push({ x0: from + FORK_PATH_AT, x1: from + FORK_PATH_AT + piece.len, top: y })
        if (piece.row) row(piece.row, from + FORK_PATH_AT, piece.len, y + ROW_Y, piece.n)
        run(SPRING_W + FORK_ROOM)
        tunnel(FORK_GATE, FORK_GATE_TOP)
        break
      }
      case 'bee': {
        const len = piece.len ?? 260
        bees.push({ x: x + len / 2, y: top + piece.y, amp: piece.amp ?? 34, period: piece.period ?? 1.8, phase: piece.phase ?? 0 })
        if (piece.row) row(piece.row, x, len, top + ROW_Y, piece.n)
        run(len)
        break
      }
      case 'cloud': {
        const from = x + (piece.at ?? 0)
        clouds.push({ x0: from, x1: from + piece.len, top: top + piece.y })
        if (piece.row) row(piece.row, from, piece.len, top + piece.y + ROW_Y, piece.n)
        break
      }
      case 'high':
        food(piece.kind, x + (piece.at ?? 0), top + piece.y)
        break
      case 'tower':
        for (let i = 0; i < piece.n; i++) food(piece.kind, x + (piece.at ?? 0), top + ROW_Y + 40 + i * 38)
        break
    }
  }
  run(BEFORE_GOAL)
  const goal = x
  run(AFTER_GOAL)
  close()
  foods.sort((a, b) => a.x - b.x || a.y - b.y)
  foods.forEach((spot, i) => { spot.id = i })
  return {
    id: def.id,
    name: def.name,
    lead: def.lead,
    theme: def.id,
    rival: def.rival,
    spans,
    clouds,
    blocks: blocks.sort((a, b) => a.x0 - b.x0),
    springs: springs.sort((a, b) => a.x0 - b.x0),
    boosts: boosts.sort((a, b) => a.x0 - b.x0),
    signs,
    bees,
    foods,
    start: RUNNER_START,
    goal,
    end: x,
    foodTotal: foods.reduce((sum, spot) => sum + FOODS[spot.kind].points, 0),
  }
}

const MEADOW: CourseDef = {
  id: 'meadow',
  name: 'はらっぱ コース',
  lead: 'はじめての レース。ジャンプと スライディングで すすもう',
  rival: { speed: .84, greed: .3, hesitate: .35, appetite: .5 },
  pieces: [
    { t: 'run', len: 520, row: 'apple', n: 4 },
    { t: 'hurdle', h: 40, top: 'strawberry' },
    { t: 'run', len: 320, row: 'banana', n: 3 },
    { t: 'gap', w: 70, arc: 'strawberry' },
    { t: 'high', kind: 'onigiri', y: 112, at: 170 },
    { t: 'run', len: 340 },
    { t: 'tunnel', len: 180, row: 'donut', n: 1 },
    { t: 'run', len: 300, row: 'strawberry', n: 3 },
    { t: 'boost', at: 40 },
    { t: 'run', len: 420, row: 'apple', n: 3 },
    { t: 'gap', w: 86, arc: 'banana' },
    { t: 'run', len: 280 },
    { t: 'bee', y: 48, amp: 34, row: 'strawberry', n: 3 },
    { t: 'run', len: 300 },
    // うえは ごちそう、したは かそくそうち。
    { t: 'fork', len: 760, row: 'onigiri', n: 5 },
    { t: 'run', len: 80 },
    { t: 'boost' },
    { t: 'run', len: 300, row: 'banana', n: 2 },
    { t: 'tunnel', len: 160, row: 'pudding', n: 1 },
    { t: 'run', len: 300 },
    { t: 'hurdle', h: 60, top: 'donut' },
    { t: 'run', len: 300, row: 'onigiri', n: 2 },
    { t: 'gap', w: 80, arc: 'apple' },
    { t: 'high', kind: 'cake', y: 130, at: 180 },
    { t: 'run', len: 340, row: 'banana', n: 3 },
    { t: 'spring', at: 40 },
    { t: 'cloud', y: 200, len: 180, at: 140, row: 'parfait', n: 1 },
    { t: 'run', len: 440 },
    { t: 'step', h: 60, len: 280, row: 'strawberry', n: 3 },
    { t: 'gap', w: 80, arc: 'banana' },
    { t: 'run', len: 220 },
    { t: 'step', h: -60, len: 300, row: 'apple', n: 2 },
    { t: 'tower', kind: 'apple', n: 3, at: 150 },
    { t: 'tunnel', len: 220, row: 'strawberry', n: 3 },
    { t: 'boost', at: 60 },
    { t: 'run', len: 600, row: 'banana', n: 3 },
    { t: 'high', kind: 'cake', y: 120, at: 100 },
    { t: 'run', len: 260 },
  ],
}

const SWEETS: CourseDef = {
  id: 'sweets',
  name: 'おかしの もり コース',
  lead: 'わかれみちは うえと した、どっちに する？',
  rival: { speed: .89, greed: .45, hesitate: .25, appetite: .6 },
  pieces: [
    { t: 'run', len: 520, row: 'strawberry', n: 4 },
    { t: 'gap', w: 80, arc: 'donut' },
    { t: 'run', len: 300 },
    { t: 'hurdle', h: 50, top: 'onigiri' },
    { t: 'run', len: 260, row: 'apple', n: 2 },
    { t: 'tunnel', len: 200, row: 'cake', n: 1 },
    { t: 'run', len: 240 },
    { t: 'step', h: 70, len: 300, row: 'strawberry', n: 3 },
    { t: 'gap', w: 96, arc: 'banana' },
    { t: 'run', len: 260 },
    { t: 'step', h: -70, len: 200 },
    { t: 'bee', y: 40, amp: 24, period: 1.6, row: 'apple', n: 3 },
    { t: 'boost', at: 60 },
    { t: 'run', len: 420, row: 'banana', n: 3 },
    { t: 'fork', len: 820, row: 'burger', n: 4 },
    { t: 'run', len: 60 },
    { t: 'boost' },
    { t: 'run', len: 260, row: 'apple', n: 2 },
    { t: 'tunnel', len: 140, row: 'onigiri', n: 1 },
    { t: 'run', len: 120 },
    { t: 'boost' },
    { t: 'run', len: 300 },
    { t: 'gap', w: 104, arc: 'strawberry' },
    { t: 'high', kind: 'pudding', y: 120, at: 140 },
    { t: 'run', len: 300 },
    { t: 'tunnel', len: 240, row: 'strawberry', n: 3 },
    { t: 'run', len: 200, row: 'apple', n: 2 },
    { t: 'hurdle', h: 70, w: 60, top: 'donut' },
    { t: 'run', len: 260 },
    { t: 'bee', y: 60, amp: 46, period: 1.4, row: 'strawberry', n: 3 },
    { t: 'tower', kind: 'onigiri', n: 3, at: 120 },
    { t: 'run', len: 300 },
    { t: 'step', h: 50, len: 200, row: 'banana', n: 2 },
    { t: 'step', h: 50, len: 260, row: 'apple', n: 3 },
    { t: 'gap', w: 90, arc: 'donut' },
    { t: 'run', len: 240 },
    { t: 'step', h: -100, len: 260 },
    { t: 'spring', at: 40 },
    { t: 'cloud', y: 210, len: 160, at: 140, row: 'parfait', n: 1 },
    { t: 'run', len: 440, row: 'strawberry', n: 2 },
    { t: 'tunnel', len: 160, row: 'burger', n: 1 },
    { t: 'run', len: 300, row: 'strawberry', n: 2 },
    { t: 'gap', w: 100, arc: 'banana' },
    { t: 'run', len: 300 },
    { t: 'bee', y: 50, amp: 34, period: 1.5, phase: 1.5 },
    { t: 'run', len: 260, row: 'banana', n: 3 },
    { t: 'hurdle', h: 60, top: 'cake' },
    { t: 'run', len: 360, row: 'strawberry', n: 3 },
  ],
}

const STARRY: CourseDef = {
  id: 'starry',
  name: 'ほしぞら コース',
  lead: 'さいごの レース！ あいても はやいよ',
  rival: { speed: .93, greed: .6, hesitate: .15, appetite: .7 },
  pieces: [
    { t: 'run', len: 520, row: 'banana', n: 4 },
    { t: 'gap', w: 96, arc: 'strawberry' },
    { t: 'run', len: 260 },
    { t: 'bee', y: 44, amp: 28, period: 1.4, row: 'apple', n: 3 },
    { t: 'tunnel', len: 200, row: 'cake', n: 1 },
    { t: 'run', len: 220 },
    { t: 'step', h: 90, len: 280, row: 'donut', n: 3 },
    { t: 'gap', w: 110, arc: 'banana' },
    { t: 'run', len: 220 },
    { t: 'step', h: -90, len: 220 },
    { t: 'hurdle', h: 60, top: 'onigiri' },
    { t: 'run', len: 160 },
    { t: 'hurdle', h: 80, top: 'onigiri' },
    { t: 'run', len: 300, row: 'strawberry', n: 3 },
    { t: 'fork', len: 700, row: 'pudding', n: 3 },
    { t: 'run', len: 60 },
    { t: 'boost' },
    { t: 'run', len: 200 },
    { t: 'tunnel', len: 120, row: 'apple', n: 1 },
    { t: 'run', len: 80 },
    { t: 'tunnel', len: 120, row: 'apple', n: 1 },
    { t: 'run', len: 220 },
    { t: 'gap', w: 120, arc: 'apple' },
    { t: 'run', len: 340 },
    { t: 'tunnel', len: 260, row: 'pudding', n: 2 },
    { t: 'run', len: 240, row: 'banana', n: 2 },
    { t: 'bee', y: 70, amp: 50, period: 1.3, phase: 2 },
    { t: 'bee', y: 38, amp: 22, period: 1.5, row: 'strawberry', n: 3 },
    { t: 'run', len: 200 },
    { t: 'step', h: 60, len: 160 },
    { t: 'step', h: 60, len: 160, row: 'apple', n: 2 },
    { t: 'step', h: 60, len: 300, row: 'burger', n: 2 },
    { t: 'gap', w: 120, arc: 'donut' },
    { t: 'run', len: 200 },
    { t: 'step', h: -180, len: 300 },
    { t: 'tower', kind: 'cake', n: 2, at: 140 },
    { t: 'run', len: 300, row: 'banana', n: 2 },
    { t: 'gap', w: 130, arc: 'strawberry' },
    { t: 'high', kind: 'parfait', y: 190, at: -65 },
    { t: 'run', len: 300 },
    { t: 'fork', len: 760, y: 190, row: 'cake', n: 2 },
    { t: 'run', len: 60 },
    { t: 'boost' },
    { t: 'run', len: 160, row: 'apple', n: 2 },
    { t: 'tunnel', len: 200, row: 'burger', n: 1 },
    { t: 'boost', at: 40 },
    { t: 'run', len: 360, row: 'strawberry', n: 2 },
    { t: 'bee', y: 62, amp: 46, period: 1.2, row: 'apple', n: 3 },
    { t: 'run', len: 200 },
    { t: 'hurdle', h: 90, w: 60, top: 'cake' },
    { t: 'run', len: 240, row: 'strawberry', n: 2 },
    { t: 'cloud', y: 90, len: 140, at: 100 },
    { t: 'cloud', y: 180, len: 120, at: 260 },
    { t: 'cloud', y: 260, len: 90, at: 420, row: 'parfait', n: 1 },
    { t: 'run', len: 700, row: 'banana', n: 4 },
    { t: 'gap', w: 110, arc: 'donut' },
    { t: 'run', len: 300 },
    { t: 'tunnel', len: 200, row: 'cake', n: 1 },
    { t: 'run', len: 400, row: 'strawberry', n: 4 },
  ],
}

export const COURSE_DEFS: readonly CourseDef[] = [MEADOW, SWEETS, STARRY]

export const COURSES: readonly Course[] = COURSE_DEFS.map(buildCourse)
