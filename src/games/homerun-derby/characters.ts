import type { PitcherId } from './stages'

// ピッチャー と バッター（ねこ）の 絵。どれも この ゲーム用に コードで かいた オリジナル。
// よびだす まえに、足もとを 原点・1 = 1cm に なるよう ctx を うごかしておく（うえが マイナス）。

export type PitcherPose = {
  /** なげる うでの むき（がめんの かくど。0 = みぎ、π/2 = した）。 */
  arm: number
  /** ボールを もっているか。 */
  holding: boolean
  /** うごきの ための じかん[s]。 */
  time: number
  /** ほのおを はく（ドラゴンの びゅーん ボール）。 */
  fire: number
  /** ピタッと とめている（ロボの ランプが ひかる）。 */
  stopped: boolean
}

const INK = '#2d2a3e'
const LINE = 4
const BALL_WHITE = '#fffdf6'
const GLOVE = '#b86b2c'
const GLOVE_DARK = '#7a4314'

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke: string | null = INK, rotation = 0) {
  ctx.beginPath()
  ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), rotation, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  if (stroke) {
    ctx.strokeStyle = stroke
    ctx.lineWidth = LINE
    ctx.stroke()
  }
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke: string | null = INK) {
  ellipse(ctx, x, y, r, r, fill, stroke)
}

function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, time: number, look = 0) {
  // ときどき まばたき する。
  const blink = (time * .7 + x * .013) % 4 < .12
  if (blink) {
    ctx.beginPath()
    ctx.moveTo(x - r, y)
    ctx.quadraticCurveTo(x, y + r * .6, x + r, y)
    ctx.strokeStyle = INK
    ctx.lineWidth = LINE
    ctx.lineCap = 'round'
    ctx.stroke()
    return
  }
  ellipse(ctx, x, y, r * .78, r, INK, null)
  circle(ctx, x - r * .25 + look, y - r * .35, r * .32, '#ffffff', null)
}

function cheek(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.globalAlpha = .55
  ellipse(ctx, x, y, r, r * .7, '#ff8fa3', null)
  ctx.globalAlpha = 1
}

function smallBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  circle(ctx, x, y, r, BALL_WHITE, INK)
  ctx.beginPath()
  ctx.arc(x - r * 1.3, y, r * 1.05, -.55, .55)
  ctx.moveTo(x + r * 1.3 + Math.cos(Math.PI - .55) * r * 1.05, y + Math.sin(Math.PI - .55) * r * 1.05)
  ctx.arc(x + r * 1.3, y, r * 1.05, Math.PI - .55, Math.PI + .55)
  ctx.strokeStyle = '#e0453a'
  ctx.lineWidth = Math.max(1, r * .22)
  ctx.stroke()
}

/** うで。肩から むき angle に のばし、さきに ボールや グローブを もたせる。 */
function arm(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, width: number, color: string, hand: 'ball' | 'glove' | 'none', handColor = color) {
  const hx = x + Math.cos(angle) * length, hy = y + Math.sin(angle) * length
  ctx.lineCap = 'round'
  ctx.strokeStyle = INK
  ctx.lineWidth = width + LINE * 2
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(hx, hy)
  ctx.stroke()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
  if (hand === 'glove') {
    ellipse(ctx, hx, hy, width * .95, width * 1.05, GLOVE, INK, angle)
    ellipse(ctx, hx + Math.cos(angle) * width * .25, hy + Math.sin(angle) * width * .25, width * .45, width * .5, GLOVE_DARK, null, angle)
  } else {
    circle(ctx, hx, hy, width * .62, handColor)
    if (hand === 'ball') smallBall(ctx, hx + Math.cos(angle) * width * .5, hy + Math.sin(angle) * width * .5, width * .55)
  }
}

function cap(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, dark: string) {
  ctx.beginPath()
  ctx.arc(x, y, r, Math.PI, 0)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = LINE
  ctx.stroke()
  ellipse(ctx, x, y + 1, r * 1.18, r * .24, dark)
  circle(ctx, x, y - r, r * .14, dark, null)
  // まえの マーク（ほし）。
  star(ctx, x, y - r * .45, r * .28, '#fff6c8')
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5
    const rr = i % 2 ? r * .45 : r
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

function shadow(ctx: CanvasRenderingContext2D, rx: number, alpha = .25) {
  ctx.globalAlpha = alpha
  ellipse(ctx, 0, 0, rx, rx * .22, '#1d2b1a', null)
  ctx.globalAlpha = 1
}

// ---- ピッチャー -------------------------------------------------------------

function penguin(ctx: CanvasRenderingContext2D, pose: PitcherPose) {
  const bob = Math.sin(pose.time * 3) * 2
  shadow(ctx, 62)
  ellipse(ctx, -24, -6, 22, 10, '#ffa53a')
  ellipse(ctx, 24, -6, 22, 10, '#ffa53a')
  ctx.save()
  ctx.translate(0, bob)
  arm(ctx, 44, -110, 1.25 - (pose.holding ? .5 : 0), 46, 22, '#30395c', 'glove')
  ellipse(ctx, 0, -90, 58, 86, '#30395c')
  ellipse(ctx, 0, -80, 41, 64, '#fdfdfd', null)
  ellipse(ctx, 0, -128, 35, 27, '#fdfdfd', null)
  eye(ctx, -14, -134, 8, pose.time)
  eye(ctx, 14, -134, 8, pose.time + .1)
  cheek(ctx, -27, -116, 7)
  cheek(ctx, 27, -116, 7)
  ctx.beginPath()
  ctx.moveTo(-11, -120)
  ctx.quadraticCurveTo(0, -126, 11, -120)
  ctx.lineTo(0, -106)
  ctx.closePath()
  ctx.fillStyle = '#ffa53a'
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.stroke()
  cap(ctx, 0, -158, 40, '#e8413c', '#b72d29')
  arm(ctx, -44, -110, pose.arm, 50, 22, '#30395c', pose.holding ? 'ball' : 'none')
  ctx.restore()
}

function frog(ctx: CanvasRenderingContext2D, pose: PitcherPose) {
  const squash = 1 + Math.sin(pose.time * 4) * .02
  shadow(ctx, 66)
  ellipse(ctx, -34, -7, 28, 11, '#3e9e45')
  ellipse(ctx, 34, -7, 28, 11, '#3e9e45')
  ctx.save()
  ctx.scale(1, squash)
  arm(ctx, 50, -96, 1.2 - (pose.holding ? .5 : 0), 44, 20, '#5cc35a', 'glove')
  ellipse(ctx, 0, -70, 63, 66, '#5cc35a')
  ellipse(ctx, 0, -58, 43, 46, '#dff5b0', null)
  circle(ctx, -34, -162, 25, '#5cc35a')
  circle(ctx, 34, -162, 25, '#5cc35a')
  ellipse(ctx, 0, -128, 68, 44, '#5cc35a')
  // めの しろい ところは あたまの うえに のせる。
  circle(ctx, -34, -164, 18, '#ffffff', null)
  circle(ctx, 34, -164, 18, '#ffffff', null)
  eye(ctx, -32, -163, 10, pose.time)
  eye(ctx, 32, -163, 10, pose.time + .2)
  cheek(ctx, -46, -120, 9)
  cheek(ctx, 46, -120, 9)
  ctx.beginPath()
  ctx.moveTo(-36, -124)
  ctx.quadraticCurveTo(0, -96, 36, -124)
  ctx.strokeStyle = INK
  ctx.lineWidth = LINE
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.save()
  ctx.translate(0, -170)
  ctx.rotate(-.12)
  cap(ctx, 0, 0, 20, '#3d7bf0', '#2b5cc2')
  ctx.restore()
  arm(ctx, -50, -96, pose.arm, 48, 20, '#5cc35a', pose.holding ? 'ball' : 'none')
  ctx.restore()
}

function octopus(ctx: CanvasRenderingContext2D, pose: PitcherPose) {
  const body = '#ff7a59', light = '#ffc2ad'
  shadow(ctx, 72)
  // あし（6ぽん）。
  for (let i = 0; i < 6; i++) {
    const base = -40 + i * 16
    const wiggle = Math.sin(pose.time * 3 + i * 1.3) * 8
    const end = base * 1.75 + wiggle
    ctx.lineCap = 'round'
    for (const [w, c] of [[22 + LINE * 2, INK], [22, body]] as const) {
      ctx.beginPath()
      ctx.moveTo(base, -78)
      ctx.quadraticCurveTo(base * 1.2 - wiggle, -34, end, -10)
      ctx.quadraticCurveTo(end + Math.sign(base || 1) * 14, -2, end + Math.sign(base || 1) * 18, -16)
      ctx.strokeStyle = c
      ctx.lineWidth = w
      ctx.stroke()
    }
    for (let k = 0; k < 3; k++) circle(ctx, base * (1.25 + k * .17) - wiggle * (.5 - k * .2), -54 + k * 17, 3.4, light, null)
  }
  arm(ctx, 56, -98, 1.1 - (pose.holding ? .5 : 0), 46, 20, body, 'glove')
  ellipse(ctx, 0, -132, 64, 66, body)
  ellipse(ctx, -24, -168, 14, 9, '#ffa489', null, -.4)
  circle(ctx, 30, -160, 6, '#ffa489', null)
  // はちまき。
  ctx.beginPath()
  ctx.ellipse(0, -150, 64, 16, 0, Math.PI * .02, Math.PI * .98)
  ctx.strokeStyle = INK
  ctx.lineWidth = 16
  ctx.stroke()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 10
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  for (const tail of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(60, -146)
    ctx.quadraticCurveTo(78, -150 + tail * 10, 86, -140 + tail * 16)
    ctx.lineTo(80, -136 + tail * 10)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  circle(ctx, 61, -146, 7, '#ffffff')
  ellipse(ctx, -22, -118, 13, 16, '#ffffff')
  ellipse(ctx, 22, -118, 13, 16, '#ffffff')
  eye(ctx, -21, -116, 9, pose.time)
  eye(ctx, 23, -116, 9, pose.time + .3)
  cheek(ctx, -42, -98, 8)
  cheek(ctx, 42, -98, 8)
  circle(ctx, 0, -92, 10, '#ff5e3a')
  circle(ctx, 0, -92, 4.5, '#b53a22', null)
  arm(ctx, -56, -98, pose.arm, 52, 20, body, pose.holding ? 'ball' : 'none')
}

function robot(ctx: CanvasRenderingContext2D, pose: PitcherPose) {
  const metal = '#c7d0dc', dark = '#8792a6'
  shadow(ctx, 64)
  ctx.fillStyle = dark
  ctx.strokeStyle = INK
  ctx.lineWidth = LINE
  for (const x of [-34, 10]) {
    ctx.beginPath()
    ctx.roundRect(x, -62, 24, 56, 6)
    ctx.fill()
    ctx.stroke()
    ellipse(ctx, x + 12, -6, 20, 9, '#4a5568')
  }
  arm(ctx, 54, -124, 1.15 - (pose.holding ? .5 : 0), 46, 18, dark, 'glove')
  ctx.beginPath()
  ctx.roundRect(-52, -146, 104, 88, 14)
  ctx.fillStyle = metal
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.roundRect(-32, -130, 64, 42, 8)
  ctx.fillStyle = '#3e4a63'
  ctx.fill()
  ctx.stroke()
  const lamps = ['#ff5a5a', '#ffd43b', '#51cf66']
  lamps.forEach((color, i) => {
    const on = pose.stopped || Math.floor(pose.time * 3 + i) % 3 === 0
    circle(ctx, -16 + i * 16, -112, 6.5, on ? color : '#5b667f', null)
  })
  for (const x of [-44, 44]) circle(ctx, x, -138, 3, dark, null)
  ctx.fillStyle = dark
  ctx.fillRect(-12, -160, 24, 16)
  ctx.strokeRect(-12, -160, 24, 16)
  ctx.beginPath()
  ctx.roundRect(-44, -220, 88, 62, 16)
  ctx.fillStyle = '#e3e8f0'
  ctx.fill()
  ctx.stroke()
  circle(ctx, -48, -190, 9, dark)
  circle(ctx, 48, -190, 9, dark)
  ctx.beginPath()
  ctx.roundRect(-33, -206, 66, 26, 10)
  ctx.fillStyle = '#1f2a44'
  ctx.fill()
  ctx.stroke()
  const blink = (pose.time * .8) % 3.5 < .12
  ctx.fillStyle = pose.stopped ? '#ff6b6b' : '#5ff3ff'
  for (const x of [-15, 15]) {
    ctx.beginPath()
    if (blink) ctx.rect(x - 8, -194, 16, 3)
    else ctx.roundRect(x - 7, -200, 14, 14, 4)
    ctx.fill()
  }
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(-15 + i * 10, -172)
    ctx.lineTo(-15 + i * 10, -165)
    ctx.stroke()
  }
  ctx.lineWidth = LINE
  ctx.beginPath()
  ctx.moveTo(0, -220)
  ctx.lineTo(0, -240)
  ctx.stroke()
  if (pose.stopped) {
    ctx.globalAlpha = .45
    circle(ctx, 0, -246, 16, '#ff6b6b', null)
    ctx.globalAlpha = 1
  }
  circle(ctx, 0, -246, 8, pose.stopped ? '#ff3b3b' : '#ff8787')
  arm(ctx, -54, -124, pose.arm, 50, 18, dark, pose.holding ? 'ball' : 'none', metal)
}

function ghost(ctx: CanvasRenderingContext2D, pose: PitcherPose) {
  const float = -24 + Math.sin(pose.time * 2.2) * 7
  shadow(ctx, 50, .16)
  ctx.save()
  ctx.translate(0, float)
  const glow = ctx.createRadialGradient(0, -120, 10, 0, -120, 120)
  glow.addColorStop(0, 'rgba(214, 200, 255, .55)')
  glow.addColorStop(1, 'rgba(214, 200, 255, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(-130, -250, 260, 260)
  ctx.beginPath()
  ctx.moveTo(-58, -40)
  for (let i = 0; i < 4; i++) {
    const x = -58 + i * 29
    const wave = Math.sin(pose.time * 4 + i) * 5
    ctx.quadraticCurveTo(x + 7, -16 + wave, x + 14.5, -34)
    ctx.quadraticCurveTo(x + 22, -50 - wave, x + 29, -40)
  }
  ctx.bezierCurveTo(62, -100, 64, -208, 0, -208)
  ctx.bezierCurveTo(-64, -208, -62, -100, -58, -40)
  ctx.closePath()
  ctx.fillStyle = 'rgba(250, 249, 255, .97)'
  ctx.fill()
  ctx.strokeStyle = '#7d74b3'
  ctx.lineWidth = LINE
  ctx.stroke()
  arm(ctx, 50, -98, .9 - (pose.holding ? .5 : 0), 30, 18, '#f4f2ff', 'glove')
  eye(ctx, -19, -132, 11, pose.time)
  eye(ctx, 19, -132, 11, pose.time + .25)
  cheek(ctx, -34, -110, 9)
  cheek(ctx, 34, -110, 9)
  ellipse(ctx, 0, -106, 7, 9, '#6b4f9e', null)
  ctx.save()
  ctx.translate(4, -196)
  ctx.rotate(.2)
  cap(ctx, 0, 0, 26, '#9b6bff', '#6f45d1')
  ctx.restore()
  arm(ctx, -50, -98, pose.arm, 36, 18, '#f4f2ff', pose.holding ? 'ball' : 'none')
  ctx.restore()
}

function dragon(ctx: CanvasRenderingContext2D, pose: PitcherPose) {
  const body = '#8a63d2', light = '#a98ae6', belly = '#ffd98a'
  shadow(ctx, 70)
  // しっぽ。
  ctx.lineCap = 'round'
  for (const [w, c] of [[28 + LINE * 2, INK], [28, body]] as const) {
    ctx.beginPath()
    ctx.moveTo(30, -40)
    ctx.quadraticCurveTo(96, -20, 92, -64 + Math.sin(pose.time * 2) * 6)
    ctx.strokeStyle = c
    ctx.lineWidth = w
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(84, -70)
  ctx.lineTo(106, -86)
  ctx.lineTo(100, -60)
  ctx.closePath()
  ctx.fillStyle = '#ffcf5a'
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.stroke()
  // つばさ。
  for (const side of [-1, 1]) {
    const flap = Math.sin(pose.time * 5) * .12
    ctx.save()
    ctx.translate(side * 34, -118)
    ctx.rotate(side * (-.35 + flap))
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.quadraticCurveTo(side * 40, -60, side * 74, -46)
    ctx.quadraticCurveTo(side * 60, -30, side * 66, -12)
    ctx.quadraticCurveTo(side * 44, -18, side * 40, 4)
    ctx.closePath()
    ctx.fillStyle = light
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = LINE
    ctx.stroke()
    ctx.restore()
  }
  for (const x of [-26, 26]) {
    ellipse(ctx, x, -24, 22, 26, body)
    for (const c of [-10, 0, 10]) circle(ctx, x + c, -2, 5, '#fff3d6', INK)
  }
  arm(ctx, 50, -104, 1.15 - (pose.holding ? .5 : 0), 44, 22, body, 'glove')
  ellipse(ctx, 0, -84, 56, 66, body)
  ellipse(ctx, 0, -76, 37, 50, belly, null)
  ctx.strokeStyle = '#e0b660'
  ctx.lineWidth = 3
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(-28 + Math.abs(i - 1.5) * 4, -104 + i * 18)
    ctx.quadraticCurveTo(0, -98 + i * 18, 28 - Math.abs(i - 1.5) * 4, -104 + i * 18)
    ctx.stroke()
  }
  // つの と せなかの とげ。
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(side * 16, -180)
    ctx.quadraticCurveTo(side * 30, -206, side * 40, -214)
    ctx.quadraticCurveTo(side * 34, -192, side * 32, -172)
    ctx.closePath()
    ctx.fillStyle = '#fff1c9'
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = 3
    ctx.stroke()
  }
  ellipse(ctx, 0, -156, 50, 42, body)
  ellipse(ctx, 0, -136, 30, 19, light)
  ellipse(ctx, -9, -140, 3.5, 2.5, INK, null)
  ellipse(ctx, 9, -140, 3.5, 2.5, INK, null)
  ctx.beginPath()
  ctx.moveTo(-16, -128)
  ctx.quadraticCurveTo(0, -120, 16, -128)
  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.stroke()
  circle(ctx, -19, -166, 12, '#ffffff')
  circle(ctx, 19, -166, 12, '#ffffff')
  eye(ctx, -18, -164, 8, pose.time)
  eye(ctx, 20, -164, 8, pose.time + .15)
  ctx.lineWidth = LINE
  ctx.beginPath()
  ctx.moveTo(-32, -184)
  ctx.lineTo(-10, -178)
  ctx.moveTo(32, -184)
  ctx.lineTo(10, -178)
  ctx.stroke()
  cheek(ctx, -36, -144, 7)
  cheek(ctx, 36, -144, 7)
  if (pose.fire > 0) {
    ctx.globalAlpha = Math.min(1, pose.fire)
    const flame = ctx.createRadialGradient(0, -112, 2, 0, -100, 34)
    flame.addColorStop(0, '#fff6b0')
    flame.addColorStop(.5, '#ffb22e')
    flame.addColorStop(1, 'rgba(255, 90, 40, 0)')
    ctx.fillStyle = flame
    ctx.beginPath()
    ctx.ellipse(0, -100, 30, 24, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  arm(ctx, -50, -104, pose.arm, 50, 22, body, pose.holding ? 'ball' : 'none')
}

const PITCHERS: Record<PitcherId, (ctx: CanvasRenderingContext2D, pose: PitcherPose) => void> = {
  penguin, frog, octopus, robot, ghost, dragon,
}

/** ピッチャーの せの たかさ（cm）。えらぶ がめんの かおの おおきさを そろえる。 */
export const PITCHER_HEIGHT: Record<PitcherId, number> = {
  penguin: 200, frog: 195, octopus: 205, robot: 255, ghost: 240, dragon: 220,
}

export function drawPitcher(ctx: CanvasRenderingContext2D, id: PitcherId, pose: PitcherPose) {
  ctx.save()
  ctx.lineJoin = 'round'
  PITCHERS[id](ctx, pose)
  ctx.restore()
}

// ---- バッター（ねこ） ---------------------------------------------------------

const easeOut = (t: number) => 1 - (1 - t) ** 3

type Dir = [x: number, y: number, z: number]
/** バットの むき（x: みぎ、y: うえ、z: ピッチャーの ほう）。かまえ → ミート → ふりぬき。 */
const BAT_KEYS: [at: number, dir: Dir, hand: [number, number]][] = [
  [0, [.25, 1, -.25], [30, -108]],
  [.39, [1, -.08, .12], [50, -94]],
  [.7, [.15, .05, 1], [38, -100]],
  [1, [-.95, .55, .15], [8, -112]],
]

/**
 * バットを ふる うごき。u は 0 → 1（ふりはじめ → ふりおわり）。null は かまえ。
 * バットは よこに まわるので、むきを 3D で まぜてから がめんへ うつす（おくを むくと みじかく みえる）。
 */
export function batPose(u: number | null): { angle: number; length: number; hand: { x: number; y: number } } {
  const e = u === null ? 0 : easeOut(Math.max(0, Math.min(1, u)))
  let i = 0
  while (i < BAT_KEYS.length - 2 && e > BAT_KEYS[i + 1][0]) i++
  const [a0, d0, h0] = BAT_KEYS[i], [a1, d1, h1] = BAT_KEYS[i + 1]
  const t = Math.max(0, Math.min(1, (e - a0) / (a1 - a0)))
  const mix = d0.map((v, k) => v + (d1[k] - v) * t)
  const norm = Math.hypot(...mix) || 1
  const [x, y, z] = mix.map(v => v / norm)
  const sx = x, sy = -y - z * .32
  return {
    angle: Math.atan2(sy, sx),
    length: Math.max(.22, Math.min(1, Math.hypot(sx, sy))),
    hand: { x: h0[0] + (h1[0] - h0[0]) * t, y: h0[1] + (h1[1] - h0[1]) * t },
  }
}

function bat(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number) {
  const length = 98 * scale
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.beginPath()
  ctx.moveTo(-14, -4)
  ctx.lineTo(length * .45, -5)
  ctx.quadraticCurveTo(length * .8, -8.5, length, -8)
  ctx.arc(length, 0, 8, -Math.PI / 2, Math.PI / 2)
  ctx.quadraticCurveTo(length * .8, 8.5, length * .45, 5)
  ctx.lineTo(-14, 4)
  ctx.closePath()
  ctx.fillStyle = '#e2a85c'
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = LINE
  ctx.stroke()
  ctx.fillStyle = '#f3c98a'
  ctx.fillRect(length * .45, -4, length * .45, 2.5)
  ctx.fillStyle = '#3b2b5e'
  ctx.fillRect(-12, -4, 22, 8)
  circle(ctx, -16, 0, 6, '#3b2b5e')
  ctx.restore()
}

/** ねこの バッターを うしろから かく。swing は バットを ふる すすみぐあい。 */
export function drawBatter(ctx: CanvasRenderingContext2D, swing: number | null, time: number) {
  const fur = '#f2a03d', furDark = '#c9761d', navy = '#273d8c'
  const pose = batPose(swing)
  const twist = swing === null ? 0 : Math.sin(Math.min(1, swing * 1.4) * Math.PI / 2)
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  shadow(ctx, 62, .3)
  // しっぽ（ゆらゆら）。
  const wag = Math.sin(time * 2.4) * 10
  for (const [w, c] of [[16 + LINE * 2, INK], [16, fur]] as const) {
    ctx.beginPath()
    ctx.moveTo(-18, -60)
    ctx.bezierCurveTo(-70, -60, -76 + wag, -104, -54 + wag, -126)
    ctx.strokeStyle = c
    ctx.lineWidth = w
    ctx.stroke()
  }
  ctx.strokeStyle = furDark
  ctx.lineWidth = 5
  for (const t of [.35, .6, .82]) {
    const px = -18 + (-70 + 18) * t * 1.2 + wag * t * t
    const py = -60 - 66 * t * t
    ctx.beginPath()
    ctx.moveTo(px - 6, py + 4)
    ctx.lineTo(px + 6, py - 4)
    ctx.stroke()
  }
  // あし。
  ctx.lineCap = 'round'
  const legs: [number, number, number, number][] = [[-16, -54, -34 + twist * 4, -8], [16, -54, 32 + twist * 6, -8]]
  for (const [x1, y1, x2, y2] of legs) {
    ctx.strokeStyle = INK
    ctx.lineWidth = 26 + LINE * 2
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.strokeStyle = '#f7f7fb'
    ctx.lineWidth = 26
    ctx.stroke()
    ctx.strokeStyle = navy
    ctx.lineWidth = 22
    ctx.beginPath()
    ctx.moveTo(x1 + (x2 - x1) * .62, y1 + (y2 - y1) * .62)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ellipse(ctx, x2 + 4, -4, 18, 9, '#222433')
  }
  // からだ（ユニフォームの せなか）。
  ctx.save()
  ctx.translate(0, -84)
  ctx.rotate(twist * .1)
  ctx.beginPath()
  ctx.roundRect(-38, -38, 76, 66, 20)
  ctx.fillStyle = '#f7f7fb'
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = LINE
  ctx.stroke()
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = 'rgba(39, 61, 140, .22)'
  ctx.lineWidth = 3
  for (let x = -32; x <= 32; x += 12) {
    ctx.beginPath()
    ctx.moveTo(x, -40)
    ctx.lineTo(x, 30)
    ctx.stroke()
  }
  ctx.restore()
  ctx.fillStyle = navy
  ctx.fillRect(-38, 16, 76, 8)
  ctx.font = '900 34px "Hiragino Maru Gothic ProN", "Hiragino Sans", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 5
  ctx.strokeStyle = '#ffffff'
  ctx.strokeText('8', 0, -8)
  ctx.fillStyle = navy
  ctx.fillText('8', 0, -8)
  ctx.restore()
  // かお（うしろあたま）と ヘルメット。
  circle(ctx, 4, -142, 38, fur)
  for (const [x, tilt] of [[-22, -.3], [26, .35]] as const) {
    ctx.save()
    ctx.translate(x, -170)
    ctx.rotate(tilt)
    ctx.beginPath()
    ctx.moveTo(-13, 6)
    ctx.lineTo(0, -26)
    ctx.lineTo(13, 6)
    ctx.closePath()
    ctx.fillStyle = fur
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = LINE
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(-6, 2)
    ctx.lineTo(0, -14)
    ctx.lineTo(6, 2)
    ctx.closePath()
    ctx.fillStyle = '#ffb3c1'
    ctx.fill()
    ctx.restore()
  }
  ctx.beginPath()
  ctx.arc(4, -146, 40, Math.PI * 1.06, Math.PI * 1.94)
  ctx.quadraticCurveTo(48, -128, 40, -122)
  ctx.lineTo(-30, -124)
  ctx.quadraticCurveTo(-42, -128, -36, -158)
  ctx.closePath()
  ctx.fillStyle = navy
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = LINE
  ctx.stroke()
  ctx.globalAlpha = .35
  ellipse(ctx, -10, -168, 14, 7, '#ffffff', null, -.3)
  ctx.globalAlpha = 1
  // みみ ぶくろ（みぎがわ）。
  ellipse(ctx, 40, -132, 12, 16, navy)
  // ひげ が すこし みえる。
  ctx.strokeStyle = '#fff4e0'
  ctx.lineWidth = 2
  for (const dy of [-4, 3]) {
    ctx.beginPath()
    ctx.moveTo(44, -112 + dy)
    ctx.lineTo(62, -114 + dy * 1.6)
    ctx.stroke()
  }
  // うで と バット。
  const shoulder = { x: 18, y: -104 }
  ctx.strokeStyle = INK
  ctx.lineWidth = 18 + LINE * 2
  ctx.beginPath()
  ctx.moveTo(shoulder.x, shoulder.y)
  ctx.lineTo(pose.hand.x, pose.hand.y)
  ctx.stroke()
  ctx.strokeStyle = '#f7f7fb'
  ctx.lineWidth = 18
  ctx.stroke()
  bat(ctx, pose.hand.x, pose.hand.y, pose.angle, pose.length)
  circle(ctx, pose.hand.x, pose.hand.y, 10, fur)
  ctx.restore()
}
