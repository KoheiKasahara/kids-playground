import { batPose, batterTwist, smoothstep, type BatterPose, type PitcherPose } from './motion'
import type { PitcherId } from './stages'

// ピッチャー と バッター（ねこ）の 絵。どれも この ゲーム用に コードで かいた オリジナル。
// よびだす まえに、足もとを 原点・1 = 1cm に なるよう ctx を うごかしておく（うえが マイナス）。

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
// なげる うでは がめんの みぎ（ボールが でてくる がわ）、グローブは ひだり。

type ArmSpec = { x: number; y: number; length: number; width: number; color: string; hand?: string }

/** うでを ふった あとの すじ。 */
function swoosh(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, width: number, s: NonNullable<PitcherPose['swoosh']>) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#ffffff'
  ctx.globalAlpha = s.alpha * .6
  ctx.lineWidth = width * 1.6
  ctx.beginPath()
  ctx.arc(x, y, r, s.to, s.from)
  ctx.stroke()
  ctx.globalAlpha = s.alpha
  ctx.lineWidth = 4
  for (const k of [.7, 1.3]) {
    ctx.beginPath()
    ctx.arc(x, y, r * k, s.to + (s.from - s.to) * .25, s.from)
    ctx.stroke()
  }
  ctx.restore()
}

/** グローブの うで と なげる うでの うち、からだの まえ（または うしろ）に くる ほうを かく。 */
function limbs(ctx: CanvasRenderingContext2D, pose: PitcherPose, front: boolean, glove: ArmSpec, thrower: ArmSpec) {
  // すじは かおに かぶらない よう、いつも からだの うしろに かく。
  // うでの ほんとうの ながさで かく（まえに のばして みじかく みえても ちいさく しない）。
  if (!front && pose.swoosh) swoosh(ctx, thrower.x, thrower.y, thrower.length * .9, thrower.width, pose.swoosh)
  if (pose.glove.front === front) arm(ctx, glove.x, glove.y, pose.glove.angle, glove.length * pose.glove.reach, glove.width, glove.color, 'glove')
  if (pose.throwing.front === front) {
    arm(ctx, thrower.x, thrower.y, pose.throwing.angle, thrower.length * pose.throwing.reach, thrower.width, thrower.color, pose.holding ? 'ball' : 'none', thrower.hand)
  }
}

/** こし（hip）を じくに からだを かたむけ、のびちぢみ させてから paint で かく。 */
function withBody(ctx: CanvasRenderingContext2D, pose: PitcherPose, hip: number, paint: () => void) {
  ctx.save()
  ctx.translate(0, -pose.hop)
  ctx.scale(1 - pose.stretch * .5, 1 + pose.stretch)
  ctx.translate(0, -hip)
  ctx.rotate(pose.lean)
  ctx.translate(0, hip)
  paint()
  ctx.restore()
}

/** グローブがわ（ひだり）の あしを あげた ぶんの ずれ。あげた あしは からだの まえに かく。 */
function kickOffset(pose: PitcherPose) {
  return { x: pose.kick * 12, y: -pose.kick * 32 - pose.hop, front: pose.kick > .05 }
}

function penguin(ctx: CanvasRenderingContext2D, pose: PitcherPose) {
  const navy = '#30395c', orange = '#ffa53a'
  const bob = Math.sin(pose.time * 3) * 2
  const kick = kickOffset(pose)
  const leftFoot = () => ellipse(ctx, -24 + kick.x, -6 + kick.y, 22, 10, orange, INK, pose.kick * .5)
  shadow(ctx, 62)
  if (!kick.front) leftFoot()
  ellipse(ctx, 24, -6 - pose.hop, 22, 10, orange)
  const glove = { x: -44, y: -110, length: 46, width: 22, color: navy }
  const thrower = { x: 44, y: -110, length: 50, width: 22, color: navy }
  withBody(ctx, pose, 60, () => {
    ctx.translate(0, bob)
    limbs(ctx, pose, false, glove, thrower)
    ellipse(ctx, 0, -90, 58, 86, navy)
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
    ctx.fillStyle = orange
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = 3
    ctx.stroke()
    cap(ctx, 0, -158, 40, '#e8413c', '#b72d29')
    limbs(ctx, pose, true, glove, thrower)
  })
  if (kick.front) leftFoot()
}

function frog(ctx: CanvasRenderingContext2D, pose: PitcherPose) {
  const green = '#5cc35a', dark = '#3e9e45'
  const kick = kickOffset(pose)
  const leftFoot = () => ellipse(ctx, -34 + kick.x, -7 + kick.y, 28, 11, dark, INK, pose.kick * .5)
  shadow(ctx, 66)
  if (!kick.front) leftFoot()
  ellipse(ctx, 34, -7 - pose.hop, 28, 11, dark)
  const glove = { x: -50, y: -96, length: 44, width: 20, color: green }
  const thrower = { x: 50, y: -96, length: 48, width: 20, color: green }
  withBody(ctx, pose, 50, () => {
    ctx.scale(1, 1 + Math.sin(pose.time * 4) * .02)
    limbs(ctx, pose, false, glove, thrower)
    ellipse(ctx, 0, -70, 63, 66, green)
    ellipse(ctx, 0, -58, 43, 46, '#dff5b0', null)
    circle(ctx, -34, -162, 25, green)
    circle(ctx, 34, -162, 25, green)
    ellipse(ctx, 0, -128, 68, 44, green)
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
    limbs(ctx, pose, true, glove, thrower)
  })
  if (kick.front) leftFoot()
}

function octopus(ctx: CanvasRenderingContext2D, pose: PitcherPose) {
  const body = '#ff7a59', light = '#ffc2ad'
  shadow(ctx, 72)
  ctx.save()
  ctx.translate(0, -pose.hop)
  // あし（6ぽん）。グローブがわの 3ぼんは あしを あげる ときに まるめる。
  for (let i = 0; i < 6; i++) {
    const base = -40 + i * 16
    const wiggle = Math.sin(pose.time * 3 + i * 1.3) * 8
    const curl = i < 3 ? pose.kick * (34 - i * 8) : 0
    const end = base * 1.75 + wiggle + curl * .4
    ctx.lineCap = 'round'
    for (const [w, c] of [[22 + LINE * 2, INK], [22, body]] as const) {
      ctx.beginPath()
      ctx.moveTo(base, -78)
      ctx.quadraticCurveTo(base * 1.2 - wiggle, -34 - curl * .5, end, -10 - curl)
      ctx.quadraticCurveTo(end + Math.sign(base || 1) * 14, -2 - curl, end + Math.sign(base || 1) * 18, -16 - curl * 1.2)
      ctx.strokeStyle = c
      ctx.lineWidth = w
      ctx.stroke()
    }
    for (let k = 0; k < 3; k++) circle(ctx, base * (1.25 + k * .17) - wiggle * (.5 - k * .2), -54 + k * 17 - curl * (.3 + k * .25), 3.4, light, null)
  }
  ctx.restore()
  const glove = { x: -56, y: -98, length: 46, width: 20, color: body }
  const thrower = { x: 56, y: -98, length: 52, width: 20, color: body }
  withBody(ctx, pose, 80, () => {
    limbs(ctx, pose, false, glove, thrower)
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
      ctx.moveTo(-60, -146)
      ctx.quadraticCurveTo(-78, -150 + tail * 10, -86, -140 + tail * 16)
      ctx.lineTo(-80, -136 + tail * 10)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    circle(ctx, -61, -146, 7, '#ffffff')
    ellipse(ctx, -22, -118, 13, 16, '#ffffff')
    ellipse(ctx, 22, -118, 13, 16, '#ffffff')
    eye(ctx, -21, -116, 9, pose.time)
    eye(ctx, 23, -116, 9, pose.time + .3)
    cheek(ctx, -42, -98, 8)
    cheek(ctx, 42, -98, 8)
    circle(ctx, 0, -92, 10, '#ff5e3a')
    circle(ctx, 0, -92, 4.5, '#b53a22', null)
    limbs(ctx, pose, true, glove, thrower)
  })
}

function robot(ctx: CanvasRenderingContext2D, pose: PitcherPose) {
  const metal = '#c7d0dc', dark = '#8792a6'
  const kick = kickOffset(pose)
  const leg = (x: number, dx: number, dy: number) => {
    ctx.fillStyle = dark
    ctx.strokeStyle = INK
    ctx.lineWidth = LINE
    ctx.beginPath()
    ctx.roundRect(x + dx, -62 + dy, 24, 56, 6)
    ctx.fill()
    ctx.stroke()
    ellipse(ctx, x + 12 + dx, -6 + dy, 20, 9, '#4a5568')
  }
  shadow(ctx, 64)
  if (!kick.front) leg(-34, kick.x, kick.y)
  leg(10, 0, -pose.hop)
  const glove = { x: -54, y: -124, length: 46, width: 18, color: dark }
  const thrower = { x: 54, y: -124, length: 50, width: 18, color: dark, hand: metal }
  withBody(ctx, pose, 62, () => {
    limbs(ctx, pose, false, glove, thrower)
    ctx.strokeStyle = INK
    ctx.lineWidth = LINE
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
    limbs(ctx, pose, true, glove, thrower)
  })
  if (kick.front) leg(-34, kick.x, kick.y)
}

function ghost(ctx: CanvasRenderingContext2D, pose: PitcherPose) {
  // あしが ないので、あしを あげる かわりに ふわっと うかぶ。
  const float = -24 + Math.sin(pose.time * 2.2) * 7 - pose.kick * 14
  shadow(ctx, 50, .16)
  ctx.save()
  ctx.translate(0, float)
  const glove = { x: -50, y: -98, length: 30, width: 18, color: '#f4f2ff' }
  const thrower = { x: 50, y: -98, length: 36, width: 18, color: '#f4f2ff' }
  withBody(ctx, pose, 100, () => {
    const glow = ctx.createRadialGradient(0, -120, 10, 0, -120, 120)
    glow.addColorStop(0, 'rgba(214, 200, 255, .55)')
    glow.addColorStop(1, 'rgba(214, 200, 255, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(-130, -250, 260, 260)
    limbs(ctx, pose, false, glove, thrower)
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
    limbs(ctx, pose, true, glove, thrower)
  })
  ctx.restore()
}

function dragon(ctx: CanvasRenderingContext2D, pose: PitcherPose) {
  const body = '#8a63d2', light = '#a98ae6', belly = '#ffd98a'
  const kick = kickOffset(pose)
  const leg = (x: number, dx: number, dy: number) => {
    ellipse(ctx, x + dx, -24 + dy, 22, 26, body)
    for (const c of [-10, 0, 10]) circle(ctx, x + dx + c, -2 + dy, 5, '#fff3d6', INK)
  }
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
  if (!kick.front) leg(-26, kick.x, kick.y)
  leg(26, 0, -pose.hop)
  const glove = { x: -50, y: -104, length: 44, width: 22, color: body }
  const thrower = { x: 50, y: -104, length: 50, width: 22, color: body }
  withBody(ctx, pose, 40, () => {
    // つばさ。なげる ときは おおきく はばたく。
    const flap = Math.sin(pose.time * 5) * .12 + Math.max(0, -pose.lean) * 1.6
    for (const side of [-1, 1]) {
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
    limbs(ctx, pose, false, glove, thrower)
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
    // つの。
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
    limbs(ctx, pose, true, glove, thrower)
  })
  if (kick.front) leg(-26, kick.x, kick.y)
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

const BAT_LENGTH = 98

function bat(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, scale: number) {
  const length = BAT_LENGTH * scale
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

/** スイングの すすみぐあいから、からだの ずれ と バットを にぎる ところを きめる。 */
function batterRig(pose: BatterPose, swing: number | null) {
  const b = batPose(swing)
  const twist = batterTwist(swing)
  // ふりはじめたら、ひいていた バットと あげていた あしを すぐ もどす。
  const release = swing === null ? 1 : 1 - smoothstep(0, .18, swing)
  const load = pose.load * release, step = pose.step * release
  const idle = swing === null ? 1 - pose.load : 0
  const bounce = idle * Math.abs(Math.sin(pose.time * 2.2)) * 2
  const shift = -load * 7 + twist * 9
  const grip = { x: b.hand.x + shift * .8 - load * 8, y: b.hand.y - load * 6 - bounce }
  const angle = b.angle - load * .32 + idle * Math.sin(pose.time * 2.6) * .06
  return { grip, angle, length: b.length, twist, load, step, bounce, shift }
}

/** ふった バットの すじ（バットの さきが とおった ところ）。 */
function batTrail(ctx: CanvasRenderingContext2D, pose: BatterPose, swing: number) {
  const steps = 10
  const inner: { x: number; y: number }[] = [], tip: { x: number; y: number }[] = []
  for (let k = 0; k <= steps; k++) {
    const r = batterRig(pose, Math.max(0, swing - k * .022))
    const dx = Math.cos(r.angle) * BAT_LENGTH * r.length, dy = Math.sin(r.angle) * BAT_LENGTH * r.length
    inner.push({ x: r.grip.x + dx * .55, y: r.grip.y + dy * .55 })
    tip.push({ x: r.grip.x + dx * 1.05, y: r.grip.y + dy * 1.05 })
  }
  // いま の バットから はなれるほど うすく する。
  const gradient = ctx.createLinearGradient(tip[0].x, tip[0].y, tip[steps].x, tip[steps].y)
  gradient.addColorStop(0, 'rgba(255, 255, 255, .55)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.globalAlpha = 1 - smoothstep(.3, .6, swing)
  ctx.fillStyle = gradient
  ctx.beginPath()
  tip.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  for (let k = steps; k >= 0; k--) ctx.lineTo(inner[k].x, inner[k].y)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
}

function limb(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, width: number, color: string) {
  ctx.strokeStyle = INK
  ctx.lineWidth = width + LINE * 2
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}

/** ねこの バッターを うしろから かく。 */
export function drawBatter(ctx: CanvasRenderingContext2D, pose: BatterPose) {
  const fur = '#f2a03d', furDark = '#c9761d', navy = '#273d8c', white = '#f7f7fb'
  const { swing, time } = pose
  const rig = batterRig(pose, swing)
  const { twist, load, step, bounce, shift } = rig
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  shadow(ctx, 62, .3)
  // からぶりした あとは くるっと よろける。
  if (pose.wobble !== null) ctx.rotate(Math.sin(pose.wobble * 10) * .08 * Math.exp(-pose.wobble * 2.4))
  // しっぽ（ゆらゆら。ふると ぴんと たつ）。
  const wag = Math.sin(time * 2.4) * 10 * (1 - twist) - twist * 18
  const tx = -18 + shift
  for (const [w, c] of [[16 + LINE * 2, INK], [16, fur]] as const) {
    ctx.beginPath()
    ctx.moveTo(tx, -60)
    ctx.bezierCurveTo(tx - 52, -60, tx - 58 + wag, -104, tx - 36 + wag, -126)
    ctx.strokeStyle = c
    ctx.lineWidth = w
    ctx.stroke()
  }
  ctx.strokeStyle = furDark
  ctx.lineWidth = 5
  for (const t of [.35, .6, .82]) {
    const px = tx - 52 * t * 1.2 + wag * t * t
    const py = -60 - 66 * t * t
    ctx.beginPath()
    ctx.moveTo(px - 6, py + 4)
    ctx.lineTo(px + 6, py - 4)
    ctx.stroke()
  }
  // あし。まえあし（みぎ）は ボールを まつ あいだ すこし あげ、ふると ふみこむ。うしろあしは つまさきで まわる。
  const legs = [
    { hip: { x: -16 + shift, y: -54 - bounce }, foot: { x: -34 + twist * 5, y: -8 - twist * 3 }, sole: { rx: 18 - twist * 7, tilt: -twist * .5 } },
    { hip: { x: 16 + shift, y: -54 - bounce }, foot: { x: 32 + twist * 8 - step * 8, y: -8 - step * 20 }, sole: { rx: 18, tilt: step * .3 } },
  ]
  for (const { hip, foot, sole } of legs) {
    limb(ctx, hip, foot, 26, white)
    ctx.strokeStyle = navy
    ctx.lineWidth = 22
    ctx.beginPath()
    ctx.moveTo(hip.x + (foot.x - hip.x) * .62, hip.y + (foot.y - hip.y) * .62)
    ctx.lineTo(foot.x, foot.y)
    ctx.stroke()
    ellipse(ctx, foot.x + 4, foot.y + 4, sole.rx, 9, '#222433', INK, sole.tilt)
  }
  // うで。うしろから みると からだの むこうがわに あるので、せなかより さきに かく。
  const torso = { x: shift, y: -84 - bounce, r: twist * .12 - load * .06 }
  const cos = Math.cos(torso.r), sin = Math.sin(torso.r)
  const shoulder = (x: number, y: number) => ({ x: torso.x + x * cos - y * sin, y: torso.y + x * sin + y * cos })
  const dir = { x: Math.cos(rig.angle), y: Math.sin(rig.angle) }
  const top = { x: rig.grip.x + dir.x * 11 * rig.length, y: rig.grip.y + dir.y * 11 * rig.length }
  limb(ctx, shoulder(-24, -22), rig.grip, 17, white)
  limb(ctx, shoulder(24, -22), top, 17, white)
  // からだ（ユニフォームの せなか）。こしを まわすと せばんごうが よこへ ずれて、からだが まわって みえる。
  ctx.save()
  ctx.translate(torso.x, torso.y)
  ctx.rotate(torso.r)
  const half = 38 - twist * 5
  ctx.beginPath()
  ctx.roundRect(-half, -38, half * 2, 66, 20)
  ctx.fillStyle = white
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = LINE
  ctx.stroke()
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = 'rgba(39, 61, 140, .22)'
  ctx.lineWidth = 3
  const turn = twist * 18 - load * 5
  const offset = ((turn % 12) + 12) % 12
  for (let x = -48 + offset; x <= 44; x += 12) {
    ctx.beginPath()
    ctx.moveTo(x, -40)
    ctx.lineTo(x, 30)
    ctx.stroke()
  }
  // まわった ぶん、よこがわに かげが できる。
  ctx.globalAlpha = .1 + twist * .12
  ctx.fillStyle = navy
  ctx.fillRect(-half, -40, 12 + twist * 12, 70)
  ctx.globalAlpha = 1
  ctx.fillStyle = navy
  ctx.fillRect(-half, 16, half * 2, 8)
  ctx.save()
  ctx.translate(-turn * .85, -8)
  ctx.scale(1 - twist * .45, 1)
  ctx.font = '900 34px "Hiragino Maru Gothic ProN", "Hiragino Sans", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 5
  ctx.strokeStyle = '#ffffff'
  ctx.strokeText('8', 0, 0)
  ctx.fillStyle = navy
  ctx.fillText('8', 0, 0)
  ctx.restore()
  ctx.restore()
  ctx.restore()
  // バットの すじは あたまの うしろを とおる。
  if (swing !== null && swing > .02 && swing < .6) batTrail(ctx, pose, swing)
  // かお（うしろあたま）と ヘルメット。ボールを みるので あたまは あまり うごかさない。
  ctx.save()
  ctx.translate(shift * .6 + twist * 2, -bounce)
  ctx.rotate(twist * .04)
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
  ctx.restore()
  // バット と て。
  bat(ctx, rig.grip.x, rig.grip.y, rig.angle, rig.length)
  circle(ctx, rig.grip.x, rig.grip.y, 10, fur)
  circle(ctx, top.x, top.y, 10, fur)
  ctx.restore()
}
