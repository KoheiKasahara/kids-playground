// ステージの形だけを持つデータ層。物理エンジンは読み込まず、テストでは形の整合だけを確かめる。
// 座標は y が下向きの「せかい」単位。地面の上面が GROUND_Y。

export const GROUND_Y = 600
/** パチンコの ゴムの まんなか（たまを のせる位置）。 */
export const SLING = { x: 240, y: 468 } as const
export const ROBOT_SIZE = 44
/** おやぶんロボの 大きさ。 */
export const BOSS_SIZE = 72
export const BOX_SIZE = 40
export const BALLOON_R = 26
/** ワープの わの 大きさ。たまの まんなかが この中に はいったら ワープする。 */
export const PORTAL_R = 42
/** トランポリンの あつみ。 */
export const SPRING_H = 24
/** せんぷうきの だいの たかさ。 */
export const FAN_H = 26

export type Material = 'wood' | 'ice' | 'stone'
export type BallKind = 'normal' | 'heavy' | 'split' | 'bomb' | 'drill' | 'bouncy'
export type RobotKind = 'normal' | 'helmet' | 'boss'
export type Sky = 'day' | 'evening' | 'night'
export type Point = { x: number; y: number }

export type Piece =
  | { type: 'block'; material: Material; x: number; y: number; w: number; h: number; angle?: number }
  /** balloon が あれば、その ながさの ひもで ふうせんから つりさげる。 */
  | { type: 'robot'; x: number; y: number; size: number; kind?: RobotKind; balloon?: number }
  | { type: 'box'; x: number; y: number; balloon?: number }
  /** うごかない おか。上面が y - h/2 になる。 */
  | { type: 'hill'; x: number; y: number; w: number; h: number }
  /** こわれない てつの かべ。うごかない。 */
  | { type: 'steel'; x: number; y: number; w: number; h: number; angle?: number }
  /** いったり きたり する てつの かべ。(x, y) を まんなかに ±(dx, dy) を period フレームで 1おうふく。 */
  | { type: 'mover'; x: number; y: number; w: number; h: number; dx: number; dy: number; period: number }
  /** のったものを うえへ はねとばす トランポリン。 */
  | { type: 'spring'; x: number; y: number; w: number }
  /** 地面に おいた せんぷうき。top の たかさまで うえむきの かぜが ふく。 */
  | { type: 'fan'; x: number; w: number; top: number }
  /** (x, y) の わに はいった たまが to から でてくる（いっぽうつうこう）。 */
  | { type: 'portal'; x: number; y: number; to: Point }

export type Level = {
  name: string
  hint: string
  /** 右はしの せかいの はば。カメラの いどう範囲にも使う。 */
  width: number
  balls: readonly BallKind[]
  pieces: readonly Piece[]
  sky?: Sky
}

export type Bounds = { l: number; r: number; t: number; b: number }

const T = 20 // いたの あつみ

type Built = { pieces: Piece[]; top: number }

/** たてに 立てた 柱。baseY は柱の下はし。 */
function post(x: number, baseY: number, h: number, material: Material, w = T): Piece {
  return { type: 'block', material, x, y: baseY - h / 2, w, h }
}

/** よこに ねかせた 板。baseY は板の下はし。 */
function plank(x: number, baseY: number, w: number, material: Material, h = T): Piece {
  return { type: 'block', material, x, y: baseY - h / 2, w, h }
}

function robot(x: number, baseY: number, kind: RobotKind = 'normal'): Piece {
  const size = kind === 'boss' ? BOSS_SIZE : ROBOT_SIZE
  return kind === 'normal' ? { type: 'robot', x, y: baseY - size / 2, size } : { type: 'robot', x, y: baseY - size / 2, size, kind }
}

function box(x: number, baseY: number): Piece {
  return { type: 'box', x, y: baseY - BOX_SIZE / 2 }
}

/** ふうせんで つりさげる。piece の 下はしを baseY に して、rope の ながさで つる。 */
function hanging(piece: Piece, rope: number): Piece {
  if (piece.type !== 'robot' && piece.type !== 'box') throw new Error('つりさげられるのは ロボットと はこ だけ')
  return { ...piece, balloon: rope }
}

/** 2本の 柱と 上の 板で できた 「門」。上の 板の 上面を top で返す。 */
function gate(cx: number, baseY: number, width: number, height: number, material: Material, top: Material = material): Built {
  const pieces = [
    post(cx - width / 2 + T / 2, baseY, height, material),
    post(cx + width / 2 - T / 2, baseY, height, material),
    plank(cx, baseY - height, width + 20, top),
  ]
  return { pieces, top: baseY - height - T }
}

function hill(x: number, w: number, h: number): Piece {
  return { type: 'hill', x, y: GROUND_Y - h / 2, w, h }
}

/** てつの かべ。left〜right, top〜bottom の 四角。 */
function steel(left: number, top: number, right: number, bottom: number): Piece {
  return { type: 'steel', x: (left + right) / 2, y: (top + bottom) / 2, w: right - left, h: bottom - top }
}

function spring(x: number, baseY: number, w: number): Piece {
  return { type: 'spring', x, y: baseY - SPRING_H / 2, w }
}

function level1(): Piece[] {
  const g = gate(1060, GROUND_Y, 110, 90, 'wood')
  return [...g.pieces, robot(1060, g.top)]
}

function level2(): Piece[] {
  const a = gate(980, GROUND_Y, 110, 100, 'wood')
  const b = gate(1140, GROUND_Y, 110, 100, 'wood')
  const c = gate(1060, a.top, 130, 80, 'wood')
  return [...a.pieces, ...b.pieces, robot(980, GROUND_Y), robot(1140, GROUND_Y), ...c.pieces, robot(1060, c.top)]
}

function level3(): Piece[] {
  const a = gate(1000, GROUND_Y, 100, 110, 'ice')
  const a2 = gate(1000, a.top, 100, 90, 'ice')
  const b = gate(1180, GROUND_Y, 100, 110, 'ice')
  const b2 = gate(1180, b.top, 100, 90, 'ice')
  return [...a.pieces, robot(1000, GROUND_Y), ...a2.pieces, robot(1000, a2.top),
    ...b.pieces, ...b2.pieces, robot(1180, b.top), robot(1180, b2.top)]
}

function level4(): Piece[] {
  // いしの かべは ふつうの たまでは びくともしない。おもい たまで おしたおす。
  const wall = [post(930, GROUND_Y, 150, 'stone', 30), post(930, GROUND_Y - 150, 60, 'stone', 30)]
  const g = gate(1080, GROUND_Y, 120, 100, 'wood')
  const g2 = gate(1080, g.top, 120, 80, 'wood')
  return [...wall, ...g.pieces, robot(1080, GROUND_Y), ...g2.pieces, robot(1080, g.top), robot(1080, g2.top)]
}

function level5(): Piece[] {
  // たかい おかの 上に 立つ とりで。やまなりに とばす。
  const h = hill(1180, 420, 160)
  const top = GROUND_Y - 160
  const a = gate(1100, top, 100, 90, 'wood')
  const b = gate(1260, top, 100, 90, 'ice')
  const c = gate(1180, a.top, 260, 70, 'wood')
  return [h, ...a.pieces, ...b.pieces, robot(1100, top), robot(1260, top), ...c.pieces, robot(1180, c.top)]
}

function level6(): Piece[] {
  // びっくりばこの まわりは ぜんぶ ふきとぶ。
  const a = gate(1000, GROUND_Y, 110, 100, 'wood')
  const b = gate(1250, GROUND_Y, 110, 100, 'wood')
  const shield = [post(1125, GROUND_Y, 120, 'stone', 30)]
  return [...a.pieces, ...b.pieces, ...shield, box(1125, GROUND_Y - 120),
    robot(1000, GROUND_Y), robot(1250, GROUND_Y), robot(1000, a.top), robot(1250, b.top)]
}

function level7(): Piece[] {
  // ばらばらに ならんだ ロボットは とちゅうで 3つに わかれる たまで いっぺんに ねらう。
  const a = gate(960, GROUND_Y, 90, 70, 'ice')
  const b = gate(1110, GROUND_Y, 90, 140, 'wood')
  const c = gate(1260, GROUND_Y, 90, 210, 'ice')
  return [...a.pieces, ...b.pieces, ...c.pieces, robot(960, a.top), robot(1110, b.top), robot(1260, c.top), robot(1110, GROUND_Y)]
}

function level8(): Piece[] {
  // ひょろながい タワー。上を ねらうと ぜんぶ たおれる。
  const pieces: Piece[] = []
  let base: number = GROUND_Y
  for (let i = 0; i < 4; i++) {
    const g = gate(1120, base, 90, 90, i % 2 ? 'ice' : 'wood')
    pieces.push(...g.pieces)
    base = g.top
  }
  pieces.push(robot(1120, base), robot(1120, GROUND_Y), robot(1280, GROUND_Y), post(1330, GROUND_Y, 60, 'stone', 30))
  return pieces
}

function level9(): Piece[] {
  // いしで まもられた とりで。びっくりばこを うまく つかおう。
  const left = gate(1000, GROUND_Y, 120, 110, 'stone', 'wood')
  const right = gate(1200, GROUND_Y, 120, 110, 'wood')
  const roof = gate(1100, left.top, 260, 80, 'ice')
  return [...left.pieces, ...right.pieces, robot(1000, GROUND_Y), box(1200, GROUND_Y),
    ...roof.pieces, robot(1040, left.top), robot(1160, left.top), robot(1100, roof.top)]
}

function level10(): Piece[] {
  // さいごの おしろ。おかの 上と 下に ロボットが いっぱい。
  const h = hill(1420, 260, 120)
  const hillTop = GROUND_Y - 120
  const a = gate(960, GROUND_Y, 110, 100, 'wood')
  const b = gate(1120, GROUND_Y, 110, 100, 'ice')
  const mid = gate(1040, a.top, 270, 80, 'wood')
  const tower = gate(1420, hillTop, 110, 110, 'stone', 'wood')
  const tower2 = gate(1420, tower.top, 110, 80, 'ice')
  return [h, ...a.pieces, ...b.pieces, robot(960, GROUND_Y), robot(1120, GROUND_Y), ...mid.pieces, box(1000, mid.top),
    robot(1085, mid.top), ...tower.pieces, robot(1420, hillTop), ...tower2.pieces, robot(1420, tower.top), robot(1420, tower2.top)]
}

function level11(): Piece[] {
  // いしの こやに かくれた ロボット。ばくだんで まとめて ふきとばす。
  const a = gate(1040, GROUND_Y, 150, 100, 'stone')
  const b = gate(1040, a.top, 150, 90, 'stone')
  const c = gate(1260, GROUND_Y, 110, 110, 'stone', 'wood')
  return [...a.pieces, robot(1040, GROUND_Y), ...b.pieces, robot(1040, a.top), robot(1040, b.top),
    ...c.pieces, robot(1260, GROUND_Y), robot(1260, c.top)]
}

function level12(): Piece[] {
  // ふうせんで ういている ロボット。ふうせんを わると おちてくる。
  const g = gate(1150, GROUND_Y, 120, 100, 'wood')
  return [
    hanging(robot(960, 400), 90),
    hanging(robot(1150, 330), 70),
    hanging(robot(1330, 420), 110),
    ...g.pieces, robot(1150, GROUND_Y),
  ]
}

function level13(): Piece[] {
  // きの へやが ずらりと ならぶ ながや。ドリルなら まとめて つきぬける。
  const pieces: Piece[] = []
  for (let i = 0; i < 4; i++) {
    const x = 900 + i * 130
    const g = gate(x, GROUND_Y, 110, 90, i % 2 ? 'ice' : 'wood')
    pieces.push(...g.pieces, robot(x, GROUND_Y))
  }
  pieces.push(post(1430, GROUND_Y, 160, 'stone', 30))
  return pieces
}

function level14(): Piece[] {
  // たかい てつの かべの むこう。トランポリンで ぴょーんと とびこえる。
  const a = gate(1160, GROUND_Y, 110, 90, 'wood')
  const b = gate(1300, GROUND_Y, 110, 90, 'ice')
  return [
    spring(790, GROUND_Y, 140),
    steel(960, 300, 1000, GROUND_Y),
    ...a.pieces, robot(1160, GROUND_Y), robot(1160, a.top),
    ...b.pieces, robot(1300, GROUND_Y),
  ]
}

function level15(): Piece[] {
  // てつの はこに とじこめられた ロボット。ワープの わから なかへ とびこむ。
  const a = gate(1110, GROUND_Y, 100, 80, 'wood')
  return [
    steel(960, 330, 990, GROUND_Y),
    steel(960, 300, 1360, 330),
    steel(1330, 330, 1360, GROUND_Y),
    { type: 'portal', x: 690, y: 310, to: { x: 1050, y: 400 } },
    ...a.pieces, robot(1110, GROUND_Y), robot(1110, a.top), robot(1250, GROUND_Y),
  ]
}

function level16(): Piece[] {
  // せんぷうきの かぜに のると ふわっと たかく あがる。
  const a = gate(1080, GROUND_Y, 110, 90, 'wood')
  const b = gate(1230, GROUND_Y, 110, 90, 'wood')
  return [
    { type: 'fan', x: 815, w: 130, top: 215 },
    steel(880, 260, 910, GROUND_Y),
    ...a.pieces, robot(1080, GROUND_Y), robot(1080, a.top),
    ...b.pieces, robot(1230, GROUND_Y), robot(1230, b.top),
  ]
}

function level17(): Piece[] {
  // ヘルメットの ロボは おちても へっちゃら。ちょくせつ ぶつけよう。
  const a = gate(1000, GROUND_Y, 120, 100, 'wood')
  const b = gate(1180, GROUND_Y, 120, 100, 'ice')
  const c = gate(1090, a.top, 300, 80, 'wood')
  return [...a.pieces, ...b.pieces, robot(1000, GROUND_Y, 'helmet'), robot(1180, GROUND_Y),
    ...c.pieces, robot(1040, a.top), robot(1140, a.top, 'helmet'), robot(1090, c.top, 'helmet')]
}

function level18(): Piece[] {
  // うえ したに うごく てつの かべ。すきまが あいた ときに うつ。
  const a = gate(1120, GROUND_Y, 120, 100, 'wood')
  const b = gate(1120, a.top, 120, 80, 'ice')
  return [
    { type: 'mover', x: 880, y: 380, w: 34, h: 220, dx: 0, dy: 100, period: 200 },
    ...a.pieces, robot(1120, GROUND_Y), ...b.pieces, robot(1120, a.top), robot(1120, b.top),
    robot(1280, GROUND_Y),
  ]
}

function level19(): Piece[] {
  // うえが あいた てつの はこ。ぽよんの たまを いれると なかで はねまわる。
  const stool = gate(1190, GROUND_Y, 90, 70, 'wood')
  return [
    steel(900, 380, 930, GROUND_Y),
    steel(1420, 300, 1450, GROUND_Y),
    robot(1000, GROUND_Y), robot(1090, GROUND_Y), ...stool.pieces, robot(1190, stool.top), robot(1190, GROUND_Y), robot(1320, GROUND_Y),
  ]
}

function level20(): Piece[] {
  // おやぶんロボの おしろ。ばくだん・ドリル・ふうせんを ぜんぶ つかう。
  const h = hill(1330, 300, 110)
  const hillTop = GROUND_Y - 110
  const wall = gate(940, GROUND_Y, 120, 110, 'stone', 'wood')
  const keep = gate(1330, hillTop, 170, 110, 'stone', 'wood')
  return [
    ...wall.pieces, robot(940, GROUND_Y, 'helmet'), robot(940, wall.top),
    h, ...keep.pieces, robot(1330, hillTop, 'boss'),
    robot(1330, keep.top, 'helmet'),
    hanging(box(1110, 380), 80),
    robot(1110, GROUND_Y),
  ]
}

export const LEVELS: readonly Level[] = [
  { name: 'はじめの いっぽ', hint: 'たまを うしろへ ひっぱって、はなそう！', width: 1400, balls: ['normal', 'normal', 'normal'], pieces: level1() },
  { name: 'きの おしろ', hint: 'いちばん うえの ロボットを ねらってみよう', width: 1400, balls: ['normal', 'normal', 'normal'], pieces: level2() },
  { name: 'こおりの とう', hint: 'こおりは すぐに われるよ', width: 1450, balls: ['normal', 'normal', 'normal'], pieces: level3() },
  { name: 'いしの かべ', hint: 'くろい てつの たまは とっても おもいよ', width: 1400, balls: ['heavy', 'normal', 'heavy'], pieces: level4() },
  { name: 'おかの とりで', hint: 'うえに むけて やまなりに とばそう', width: 1550, balls: ['normal', 'normal', 'heavy'], pieces: level5() },
  { name: 'びっくりばこ', hint: '？の はこに あてると ドカーン！', width: 1500, balls: ['normal', 'normal', 'normal'], pieces: level6() },
  { name: 'みっつに わかれる', hint: 'あおい たまは とちゅうで 3つに わかれるよ！', width: 1500, balls: ['split', 'split', 'normal'], pieces: level7() },
  { name: 'ひょろながタワー', hint: 'たかい ところを ねらうと ばたーん！', width: 1500, balls: ['normal', 'split', 'heavy'], pieces: level8() },
  { name: 'いしの とりで', hint: 'びっくりばこは どこかな？', width: 1450, balls: ['heavy', 'split', 'normal', 'normal'], pieces: level9() },
  { name: 'さいごの おしろ', hint: 'ぜんぶの たまを つかって がんばろう！', width: 1700, balls: ['split', 'heavy', 'normal', 'heavy'], pieces: level10() },
  { name: 'ドッカン ばくだん', hint: 'ばくだんは ぶつかると ドッカーン！', width: 1450, balls: ['bomb', 'normal', 'bomb'], pieces: level11(), sky: 'evening' },
  { name: 'ふうせん ロボ', hint: 'ふうせんを わると ロボットが おちるよ', width: 1450, balls: ['normal', 'split', 'normal'], pieces: level12(), sky: 'evening' },
  { name: 'つきぬけ ドリル', hint: 'ドリルは きや こおりを つきぬけるよ', width: 1500, balls: ['drill', 'normal', 'drill'], pieces: level13(), sky: 'evening' },
  { name: 'トランポリン', hint: 'トランポリンに のせると ぴょーんと とぶよ', width: 1400, balls: ['normal', 'normal', 'heavy'], pieces: level14(), sky: 'evening' },
  { name: 'ワープ ゲート', hint: 'オレンジの わに はいると あおい わから でるよ', width: 1400, balls: ['normal', 'normal', 'split'], pieces: level15(), sky: 'evening' },
  { name: 'かぜの エレベーター', hint: 'かぜに のせると ふわっと あがるよ', width: 1400, balls: ['normal', 'normal', 'heavy'], pieces: level16(), sky: 'night' },
  { name: 'ヘルメット ロボ', hint: 'ヘルメットの ロボは かたいよ。ちょくせつ ぶつけよう', width: 1450, balls: ['heavy', 'normal', 'heavy', 'drill'], pieces: level17(), sky: 'night' },
  { name: 'うごく かべ', hint: 'かべが うごいているよ。すきまを ねらおう', width: 1400, balls: ['normal', 'heavy', 'normal'], pieces: level18(), sky: 'night' },
  { name: 'ぽよんぽよん', hint: 'ぽよんの たまは かべで よく はねるよ', width: 1500, balls: ['bouncy', 'bouncy', 'normal'], pieces: level19(), sky: 'night' },
  { name: 'おやぶんロボの しろ', hint: 'おやぶんロボは とっても かたい！ばくだんで ねらおう', width: 1550, balls: ['bomb', 'drill', 'heavy', 'split', 'bomb'], pieces: level20(), sky: 'night' },
]

/** ふうせんの まんなか。つりさげて いなければ undefined。 */
export function balloonAt(piece: Piece): Point | undefined {
  if ((piece.type !== 'robot' && piece.type !== 'box') || !piece.balloon) return undefined
  const h = piece.type === 'robot' ? piece.size : BOX_SIZE
  return { x: piece.x, y: piece.y - h / 2 - piece.balloon - BALLOON_R }
}

/** せんぷうきの かぜが ふく はんい。 */
export function fanZone(piece: Extract<Piece, { type: 'fan' }>): Bounds {
  return { l: piece.x - piece.w / 2, r: piece.x + piece.w / 2, t: piece.top, b: GROUND_Y - FAN_H }
}

function rotatedBounds(x: number, y: number, w: number, h: number, angle = 0): Bounds {
  const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle))
  const hw = (w * c + h * s) / 2, hh = (w * s + h * c) / 2
  return { l: x - hw, r: x + hw, t: y - hh, b: y + hh }
}

const circleBounds = (p: Point, r: number): Bounds => ({ l: p.x - r, r: p.x + r, t: p.y - r, b: p.y + r })

/**
 * ものが しめる はんい（かたむきや うごく はんいも ふくむ）。
 * ふうせん・ワープの わ・せんぷうきの だいも べつの はんいとして かえす。
 */
export function pieceBounds(piece: Piece): Bounds[] {
  switch (piece.type) {
    case 'robot': case 'box': {
      const size = piece.type === 'robot' ? piece.size : BOX_SIZE
      const balloon = balloonAt(piece)
      const body = rotatedBounds(piece.x, piece.y, size, size)
      return balloon ? [body, circleBounds(balloon, BALLOON_R)] : [body]
    }
    case 'block': case 'steel': return [rotatedBounds(piece.x, piece.y, piece.w, piece.h, piece.angle)]
    case 'hill': return [rotatedBounds(piece.x, piece.y, piece.w, piece.h)]
    case 'mover': return [{ l: piece.x - piece.w / 2 - Math.abs(piece.dx), r: piece.x + piece.w / 2 + Math.abs(piece.dx), t: piece.y - piece.h / 2 - Math.abs(piece.dy), b: piece.y + piece.h / 2 + Math.abs(piece.dy) }]
    case 'spring': return [rotatedBounds(piece.x, piece.y, piece.w, SPRING_H)]
    case 'fan': return [{ l: piece.x - piece.w / 2, r: piece.x + piece.w / 2, t: GROUND_Y - FAN_H, b: GROUND_Y }]
    case 'portal': return [circleBounds(piece, PORTAL_R), circleBounds(piece.to, PORTAL_R)]
  }
}

export function robotCount(level: Level) {
  return level.pieces.filter(p => p.type === 'robot').length
}

/** のこった たまの 数から ほしの 数（1〜3）を きめる。 */
export function starsFor(remaining: number): number {
  return Math.max(1, Math.min(3, 1 + remaining))
}
