import { FOODS, type FoodKind } from './foods'

// レースの コース。ならべた「パーツ」を ひだりから じゅんに つないで、じめん・あな・だん・
// ぺったん（うえから おちてくる きね）・はち・くも・ごちそうの ばしょを つくる。
// きょりの たんいは がめんの 1ドットくらい。y は じめんから うえへの たかさ。

export type ThemeId = 'meadow' | 'sweets' | 'starry'

/** じめん。x0〜x1 の あいだは top より したが ぜんぶ かたい。あいだが あいていれば あな。 */
export type Span = { x0: number; x1: number; top: number }
/** うえに のれる くも。したからは すりぬける。 */
export type Cloud = { x0: number; x1: number; top: number }
/**
 * ぺったん。うえで まつ → どすんと おちる → じめんで まつ → ゆっくり あがる を くりかえす。
 * base は したの じめんの たかさ、height は あがった ときの すきまの たかさ。
 */
export type Pounder = { x: number; w: number; base: number; height: number; up: number; drop: number; down: number; rise: number; phase: number }
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
  pounders: readonly Pounder[]
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

/** ぺったんの はやさ。 */
export type PounderTempo = 'slow' | 'normal' | 'quick'

export type Piece =
  /** たいらな みち。row が あれば じめんの ちかくに n こ（なければ ぜんぶ）ごちそうを ならべる。 */
  | { t: 'run'; len: number; row?: FoodKind; n?: number; y?: number }
  /** あな。arc が あれば ジャンプの みちに ごちそうを ならべる。 */
  | { t: 'gap'; w: number; arc?: FoodKind }
  /** じめんの たかさを h だけ かえて len はしる（だんの のぼり・くだり）。 */
  | { t: 'step'; h: number; len: number; row?: FoodKind; n?: number }
  /** ジャンプで こえる ちいさな やま。top が あれば うえに ごちそう。 */
  | { t: 'hurdle'; h: number; w?: number; top?: FoodKind }
  /** ぺったん。food が あれば したに ごちそう（とまって まってから とろう）。 */
  | { t: 'pounder'; tempo?: PounderTempo; food?: FoodKind; phase?: number }
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
const POUNDER_W = 64
const POUNDER_ROOM = 120
const POUNDER_TEMPO: Record<PounderTempo, Pick<Pounder, 'up' | 'drop' | 'down' | 'rise'>> = {
  slow: { up: 1.6, drop: .22, down: .6, rise: .6 },
  normal: { up: 1.25, drop: .2, down: .55, rise: .55 },
  quick: { up: 1, drop: .18, down: .45, rise: .5 },
}
export const POUNDER_HEIGHT = 150

export function buildCourse(def: CourseDef): Course {
  const spans: Span[] = []
  const clouds: Cloud[] = []
  const pounders: Pounder[] = []
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
      case 'pounder': {
        const tempo = POUNDER_TEMPO[piece.tempo ?? 'normal']
        const px = x + POUNDER_ROOM
        pounders.push({ x: px, w: POUNDER_W, base: top, height: POUNDER_HEIGHT, ...tempo, phase: piece.phase ?? 0 })
        if (piece.food) food(piece.food, px + POUNDER_W / 2, top + ROW_Y)
        run(POUNDER_ROOM * 2 + POUNDER_W)
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
    pounders,
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
  lead: 'はじめての レース。ジャンプで あなを こえよう',
  rival: { speed: .84, greed: .3, hesitate: .35, appetite: .5 },
  pieces: [
    { t: 'run', len: 520, row: 'apple', n: 4 },
    { t: 'hurdle', h: 40, top: 'strawberry' },
    { t: 'run', len: 320, row: 'banana', n: 3 },
    { t: 'gap', w: 70, arc: 'strawberry' },
    { t: 'high', kind: 'onigiri', y: 112, at: 170 },
    { t: 'run', len: 340 },
    { t: 'step', h: 50, len: 360, row: 'banana', n: 4 },
    { t: 'step', h: -50, len: 240 },
    { t: 'pounder', tempo: 'slow', food: 'donut' },
    { t: 'run', len: 300, row: 'strawberry', n: 3 },
    { t: 'cloud', y: 84, len: 220, at: 60, row: 'onigiri', n: 3 },
    { t: 'run', len: 340, row: 'apple', n: 2 },
    { t: 'gap', w: 86, arc: 'banana' },
    { t: 'run', len: 280 },
    { t: 'bee', y: 48, amp: 34, row: 'strawberry', n: 3 },
    { t: 'run', len: 260 },
    { t: 'hurdle', h: 60, top: 'donut' },
    { t: 'run', len: 300, row: 'onigiri', n: 2 },
    { t: 'gap', w: 80, arc: 'apple' },
    { t: 'high', kind: 'cake', y: 130, at: 180 },
    { t: 'run', len: 340, row: 'banana', n: 3 },
    { t: 'pounder', tempo: 'slow', food: 'pudding' },
    { t: 'run', len: 280 },
    { t: 'step', h: 60, len: 280, row: 'strawberry', n: 3 },
    { t: 'gap', w: 80, arc: 'banana' },
    { t: 'run', len: 220 },
    { t: 'step', h: -60, len: 300, row: 'apple', n: 2 },
    { t: 'tower', kind: 'apple', n: 3, at: 150 },
    { t: 'cloud', y: 96, len: 180, at: 360, row: 'burger', n: 2 },
    { t: 'run', len: 600, row: 'banana', n: 3 },
    { t: 'high', kind: 'cake', y: 120, at: 100 },
    { t: 'run', len: 260 },
  ],
}

const SWEETS: CourseDef = {
  id: 'sweets',
  name: 'おかしの もり コース',
  lead: 'ぺったんと はちに きをつけて。とまって まつのも だいじ',
  rival: { speed: .89, greed: .45, hesitate: .25, appetite: .6 },
  pieces: [
    { t: 'run', len: 520, row: 'strawberry', n: 4 },
    { t: 'gap', w: 80, arc: 'donut' },
    { t: 'run', len: 300 },
    { t: 'hurdle', h: 50, top: 'onigiri' },
    { t: 'run', len: 260, row: 'apple', n: 2 },
    { t: 'pounder', tempo: 'normal', food: 'cake' },
    { t: 'run', len: 240 },
    { t: 'step', h: 70, len: 300, row: 'strawberry', n: 3 },
    { t: 'gap', w: 96, arc: 'banana' },
    { t: 'run', len: 260 },
    { t: 'step', h: -70, len: 200 },
    { t: 'bee', y: 40, amp: 24, period: 1.6, row: 'apple', n: 3 },
    { t: 'cloud', y: 80, len: 200, at: 80 },
    { t: 'cloud', y: 160, len: 120, at: 220, row: 'burger', n: 2 },
    { t: 'run', len: 420, row: 'banana', n: 3 },
    { t: 'gap', w: 104, arc: 'strawberry' },
    { t: 'high', kind: 'pudding', y: 120, at: 140 },
    { t: 'run', len: 300 },
    { t: 'pounder', tempo: 'normal', food: 'pudding', phase: .6 },
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
    { t: 'cloud', y: 70, len: 160, at: 120 },
    { t: 'cloud', y: 140, len: 160, at: 300 },
    { t: 'cloud', y: 210, len: 100, at: 480, row: 'parfait', n: 1 },
    { t: 'run', len: 700, row: 'strawberry', n: 4 },
    { t: 'gap', w: 100, arc: 'banana' },
    { t: 'run', len: 240 },
    { t: 'pounder', tempo: 'quick', food: 'burger' },
    { t: 'run', len: 260, row: 'apple', n: 2 },
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
    { t: 'pounder', tempo: 'quick', food: 'cake' },
    { t: 'run', len: 220 },
    { t: 'step', h: 90, len: 280, row: 'donut', n: 3 },
    { t: 'gap', w: 110, arc: 'banana' },
    { t: 'run', len: 220 },
    { t: 'step', h: -90, len: 220 },
    { t: 'hurdle', h: 60, top: 'onigiri' },
    { t: 'run', len: 160 },
    { t: 'hurdle', h: 80, top: 'onigiri' },
    { t: 'run', len: 280, row: 'strawberry', n: 3 },
    { t: 'cloud', y: 80, len: 180, at: 60 },
    { t: 'cloud', y: 170, len: 140, at: 240, row: 'pudding', n: 2 },
    { t: 'gap', w: 120, arc: 'apple' },
    { t: 'run', len: 340 },
    { t: 'pounder', tempo: 'quick', food: 'pudding', phase: .4 },
    { t: 'pounder', tempo: 'quick', phase: 1.1 },
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
    { t: 'pounder', tempo: 'normal', food: 'burger' },
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
    { t: 'pounder', tempo: 'quick', food: 'cake', phase: .8 },
    { t: 'run', len: 400, row: 'strawberry', n: 4 },
  ],
}

export const COURSE_DEFS: readonly CourseDef[] = [MEADOW, SWEETS, STARRY]

export const COURSES: readonly Course[] = COURSE_DEFS.map(buildCourse)
