// ステージの形だけを持つデータ層。物理エンジンは読み込まず、テストでは形の整合だけを確かめる。
// 座標は y が下向きの「せかい」単位。地面の上面が GROUND_Y。

export const GROUND_Y = 600
/** パチンコの ゴムの まんなか（たまを のせる位置）。 */
export const SLING = { x: 240, y: 468 } as const
export const ROBOT_SIZE = 44

export type Material = 'wood' | 'ice' | 'stone'
export type BallKind = 'normal' | 'heavy' | 'split'

export type Piece =
  | { type: 'block'; material: Material; x: number; y: number; w: number; h: number; angle?: number }
  | { type: 'robot'; x: number; y: number; size: number }
  | { type: 'box'; x: number; y: number }
  /** うごかない おか。上面が y - h/2 になる。 */
  | { type: 'hill'; x: number; y: number; w: number; h: number }

export type Level = {
  name: string
  hint: string
  /** 右はしの せかいの はば。カメラの いどう範囲にも使う。 */
  width: number
  balls: readonly BallKind[]
  pieces: readonly Piece[]
}

export const BOX_SIZE = 40
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

function robot(x: number, baseY: number, size = ROBOT_SIZE): Piece {
  return { type: 'robot', x, y: baseY - size / 2, size }
}

function box(x: number, baseY: number): Piece {
  return { type: 'box', x, y: baseY - BOX_SIZE / 2 }
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
  // ばらばらに ならんだ ロボットは 3つに わかれる たまで いっぺんに ねらう。
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

export const LEVELS: readonly Level[] = [
  { name: 'はじめの いっぽ', hint: 'たまを うしろへ ひっぱって、はなそう！', width: 1400, balls: ['normal', 'normal', 'normal'], pieces: level1() },
  { name: 'きの おしろ', hint: 'いちばん うえの ロボットを ねらってみよう', width: 1400, balls: ['normal', 'normal', 'normal'], pieces: level2() },
  { name: 'こおりの とう', hint: 'こおりは すぐに われるよ', width: 1450, balls: ['normal', 'normal', 'normal'], pieces: level3() },
  { name: 'いしの かべ', hint: 'くろい てつの たまは とっても おもいよ', width: 1400, balls: ['heavy', 'normal', 'heavy'], pieces: level4() },
  { name: 'おかの とりで', hint: 'うえに むけて やまなりに とばそう', width: 1550, balls: ['normal', 'normal', 'heavy'], pieces: level5() },
  { name: 'びっくりばこ', hint: '？の はこに あてると ドカーン！', width: 1500, balls: ['normal', 'normal', 'normal'], pieces: level6() },
  { name: 'みっつに わかれる', hint: 'あおい たまは とんでいる ときに タップ！', width: 1500, balls: ['split', 'split', 'normal'], pieces: level7() },
  { name: 'ひょろながタワー', hint: 'たかい ところを ねらうと ばたーん！', width: 1500, balls: ['normal', 'split', 'heavy'], pieces: level8() },
  { name: 'いしの とりで', hint: 'びっくりばこは どこかな？', width: 1450, balls: ['heavy', 'split', 'normal', 'normal'], pieces: level9() },
  { name: 'さいごの おしろ', hint: 'ぜんぶの たまを つかって がんばろう！', width: 1700, balls: ['split', 'heavy', 'normal', 'heavy'], pieces: level10() },
]

/** のこった たまの 数から ほしの 数（1〜3）を きめる。 */
export function starsFor(remaining: number): number {
  return Math.max(1, Math.min(3, 1 + remaining))
}
