// ステージの データだけを 持つ。うごきや あたりはんていは world.ts が きめる。

/** せかいの 大きさ（たてながの ぶたい）。画面の 大きさに あわせて 拡大・縮小して かく。 */
export const WORLD = { width: 400, height: 720 } as const
/** たいほうの まわる じく。 */
export const CANNON = { x: 200, y: 676, barrel: 58 } as const
export const BALL_RADIUS = 10
/** たまの はやさ（1びょうに すすむ きょり）。まとまで だいたい 1びょう かかる。 */
export const BALL_SPEED = 470

/**
 * うごきかた。period は 1往復・1しゅうに かかる びょう、phase は 0〜1 の ずれ。
 * line: もとの ばしょを まんなかに dx・dy だけ いったり きたり。orbit: まわりを ぐるぐる。
 */
export type Motion =
  | { kind: 'line'; dx: number; dy: number; period: number; phase?: number }
  | { kind: 'orbit'; radius: number; period: number; phase?: number; reverse?: boolean }
/** きえる かべ。period の うち on の わりあいだけ あらわれる。 */
export type Blink = { period: number; on: number; phase?: number }

export type TargetKind = 'normal' | 'hard' | 'gold'
export type TargetDef = { x: number; y: number; kind?: TargetKind; r?: number; motion?: Motion }

export type WallKind = 'block' | 'bouncy'
/** かべ。w・h なら しかく（x・y は まんなか）、r なら まるい ガード。 */
export type WallDef = {
  x: number; y: number
  w?: number; h?: number; r?: number
  kind?: WallKind
  motion?: Motion
  blink?: Blink
}

export type Difficulty = 'easy' | 'normal' | 'hard'
export type Level = {
  name: string
  difficulty: Difficulty
  balls: number
  hint: string
  targets: readonly TargetDef[]
  walls: readonly WallDef[]
}

export const DIFFICULTIES: readonly { id: Difficulty; label: string; lead: string }[] = [
  { id: 'easy', label: 'かんたん', lead: 'まずは ここから' },
  { id: 'normal', label: 'ふつう', lead: 'うごく かべに ちゅうい' },
  { id: 'hard', label: 'むずかしい', lead: 'きえる かべ・まわる ガード' },
]

export const TARGET_RADIUS: Record<TargetKind, number> = { normal: 30, hard: 31, gold: 19 }
export const TARGET_HP: Record<TargetKind, number> = { normal: 1, hard: 2, gold: 1 }
export const TARGET_SCORE: Record<TargetKind, number> = { normal: 100, hard: 200, gold: 300 }

const line = (dx: number, dy: number, period: number, phase = 0): Motion => ({ kind: 'line', dx, dy, period, phase })
const orbit = (radius: number, period: number, phase = 0, reverse = false): Motion => ({ kind: 'orbit', radius, period, phase, reverse })

export const LEVELS: readonly Level[] = [
  // --- かんたん ---
  {
    name: 'はじめての まと', difficulty: 'easy', balls: 6,
    hint: 'まとを タップすると たまが とんでいくよ',
    targets: [{ x: 110, y: 300 }, { x: 200, y: 190 }, { x: 290, y: 300 }],
    walls: [],
  },
  {
    name: 'ゆらゆら まと', difficulty: 'easy', balls: 6,
    hint: 'うごく まとは すこし さきを ねらおう',
    targets: [{ x: 200, y: 170, motion: line(110, 0, 6) }, { x: 100, y: 340 }, { x: 300, y: 340 }],
    walls: [],
  },
  {
    name: 'かべの むこう', difficulty: 'easy', balls: 6,
    hint: 'かべに あたると たまは とまるよ',
    targets: [{ x: 90, y: 290 }, { x: 310, y: 290 }, { x: 200, y: 160, motion: line(120, 0, 6.5) }],
    walls: [{ x: 200, y: 400, w: 110, h: 26 }],
  },
  {
    name: 'きらきら きんの まと', difficulty: 'easy', balls: 7,
    hint: 'きんの まとは ボーナス！',
    targets: [
      { x: 200, y: 330, motion: line(100, 0, 5) },
      { x: 110, y: 220, motion: line(0, 40, 4) },
      { x: 290, y: 220, motion: line(0, 40, 4, .5) },
      { x: 200, y: 130, kind: 'gold', motion: line(130, 0, 3.4) },
    ],
    walls: [],
  },
  // --- ふつう ---
  {
    name: 'いったり きたり', difficulty: 'normal', balls: 7,
    hint: 'まとが とおる ところを まって うとう',
    targets: [
      { x: 200, y: 140, motion: line(140, 0, 4.4) },
      { x: 200, y: 250, motion: line(-120, 0, 3.6) },
      { x: 200, y: 360, motion: line(100, 0, 3) },
    ],
    walls: [{ x: 60, y: 470, w: 60, h: 24 }, { x: 340, y: 470, w: 60, h: 24 }],
  },
  {
    name: 'うごく かべ', difficulty: 'normal', balls: 7,
    hint: 'かべが どいた すきに うとう',
    targets: [{ x: 105, y: 190 }, { x: 200, y: 140 }, { x: 295, y: 190 }],
    walls: [
      { x: 200, y: 330, w: 150, h: 24, motion: line(110, 0, 4) },
      { x: 200, y: 460, w: 110, h: 24, motion: line(-120, 0, 3.2) },
    ],
  },
  {
    name: 'かたい まと', difficulty: 'normal', balls: 8,
    hint: 'はがねの まとは 2かい あてよう',
    targets: [
      { x: 110, y: 210, kind: 'hard' },
      { x: 290, y: 210, kind: 'hard' },
      { x: 200, y: 330, motion: line(120, 0, 3.6) },
      { x: 200, y: 125, kind: 'gold', motion: orbit(40, 2.6) },
    ],
    walls: [{ x: 200, y: 450, w: 56, h: 56 }],
  },
  {
    name: 'ぽよんと はねかえり', difficulty: 'normal', balls: 7,
    hint: 'ピンクの かべで はねかえして うらの まとを ねらおう',
    targets: [{ x: 200, y: 160 }, { x: 60, y: 200 }, { x: 330, y: 470 }],
    walls: [
      { x: 200, y: 320, w: 150, h: 26 },
      { x: 20, y: 380, w: 24, h: 260, kind: 'bouncy' },
      { x: 380, y: 300, w: 24, h: 260, kind: 'bouncy' },
    ],
  },
  // --- むずかしい ---
  {
    name: 'きえる かべ', difficulty: 'hard', balls: 7,
    hint: 'かべが きえた しゅんかんを ねらおう',
    targets: [{ x: 200, y: 150, motion: line(130, 0, 3.4) }, { x: 110, y: 240 }, { x: 290, y: 240 }],
    walls: [
      { x: 200, y: 340, w: 320, h: 22, blink: { period: 3, on: .55 } },
      { x: 200, y: 460, w: 170, h: 22, blink: { period: 2.4, on: .5, phase: .5 } },
    ],
  },
  {
    name: 'まわる ガード', difficulty: 'hard', balls: 8,
    hint: 'ガードが よこに いった ときが チャンス',
    targets: [{ x: 115, y: 280 }, { x: 285, y: 280 }, { x: 200, y: 140 }],
    walls: [
      { x: 115, y: 280, r: 15, motion: orbit(56, 2.6) },
      { x: 285, y: 280, r: 15, motion: orbit(56, 2.6, .5, true) },
      { x: 200, y: 140, r: 15, motion: orbit(58, 3.2, .25) },
      { x: 200, y: 140, r: 15, motion: orbit(58, 3.2, .75) },
    ],
  },
  {
    name: 'ぐるぐる まと', difficulty: 'hard', balls: 9,
    hint: 'まわる まとは くる ところを まちぶせ！',
    targets: [
      { x: 200, y: 240, kind: 'hard' },
      { x: 200, y: 240, motion: orbit(115, 5.5) },
      { x: 200, y: 240, motion: orbit(115, 5.5, 1 / 3) },
      { x: 200, y: 240, motion: orbit(115, 5.5, 2 / 3) },
    ],
    walls: [{ x: 200, y: 450, w: 120, h: 24, motion: line(120, 0, 3) }],
  },
  {
    name: 'さいごの ちょうせん', difficulty: 'hard', balls: 10,
    hint: 'しかけを ぜんぶ つかって クリアしよう',
    targets: [
      { x: 200, y: 120, kind: 'hard', motion: line(120, 0, 4) },
      { x: 90, y: 250, motion: orbit(40, 3) },
      { x: 310, y: 250, motion: orbit(40, 3, .5, true) },
      { x: 200, y: 250, kind: 'gold', motion: line(0, 50, 1.8) },
    ],
    walls: [
      { x: 200, y: 370, w: 240, h: 22, blink: { period: 2.8, on: .5 } },
      { x: 18, y: 330, w: 22, h: 200, kind: 'bouncy' },
      { x: 382, y: 330, w: 22, h: 200, kind: 'bouncy' },
      { x: 200, y: 480, w: 90, h: 24, motion: line(110, 0, 3.4, .25) },
    ],
  },
]

/** クリアに ひつような あてる かず（きんの まとは おまけ）。 */
export function requiredHits(level: Level): number {
  return level.targets.reduce((sum, t) => sum + ((t.kind ?? 'normal') === 'gold' ? 0 : TARGET_HP[t.kind ?? 'normal']), 0)
}

/** はずした かずで ほしを きめる。 */
export function starsFor(misses: number): number {
  return misses <= 1 ? 3 : misses <= 3 ? 2 : 1
}

export type Feature = 'move' | 'hard' | 'gold' | 'wall' | 'slide' | 'blink' | 'bouncy' | 'guard'
export const FEATURE_LABELS: Record<Feature, string> = {
  move: 'うごく まと', hard: 'かたい まと', gold: 'きんの まと', wall: 'かべ',
  slide: 'うごく かべ', blink: 'きえる かべ', bouncy: 'ぽよん かべ', guard: 'まわる ガード',
}

/** ステージに でてくる しかけ（カードに ならべて どんな ステージか わかるように する）。 */
export function levelFeatures(level: Level): Feature[] {
  const found = new Set<Feature>()
  for (const t of level.targets) {
    if (t.motion) found.add('move')
    if (t.kind === 'hard') found.add('hard')
    if (t.kind === 'gold') found.add('gold')
  }
  for (const w of level.walls) {
    if (w.r !== undefined) found.add('guard')
    else if (w.blink) found.add('blink')
    else if (w.kind === 'bouncy') found.add('bouncy')
    else if (w.motion) found.add('slide')
    else found.add('wall')
  }
  return (Object.keys(FEATURE_LABELS) as Feature[]).filter(f => found.has(f))
}
