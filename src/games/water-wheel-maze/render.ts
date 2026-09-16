// ばんめんを canvas へ えがく。
// かべは シミュレーションと おなじ ならび（rings.wallRuns）から 円弧にするので、
// 見えている すきまと、水が とおれる すきまが ずれない。

import {
  CATCH_ROW, CHUTE, DISC, GRID_HEIGHT, GRID_WIDTH, GROUND_ROW, RING_SLOTS, TOY, WHEEL,
} from './scene'

const COLORS = {
  skyTop: '#dff1fb',
  skyBottom: '#bfe6f5',
  discBase: '#f2fbff',
  discShade: '#d6eefa',
  wall: '#3f9fbb',
  wallEdge: '#8fdcef',
  wallFoot: '#2b7691',
  grip: '#ffb347',
  water: '#2f9bf0',
  waterTop: '#9adcff',
  wood: '#c98a45',
  woodDark: '#9a6329',
  wheel: '#d79a55',
  wheelDark: '#8d5c26',
  bucket: '#6fc5e8',
  axle: '#6b7785',
  toy: '#ef6f6f',
  toyDark: '#c94f4f',
  ground: '#8fd28a',
  groundDark: '#68b465',
} as const

const RIDERS = ['🐰', '🐻', '🐼', '🐥', '🐸', '🐨'] as const
const TAU = Math.PI * 2
const toRadians = (degrees: number) => degrees * Math.PI / 180

export type RingShape = { slot: number; runs: readonly { from: number; length: number }[] }

export type SceneView = {
  rings: readonly RingShape[]
  /** 円盤の むき（度）。 */
  rotation: number
  water: Uint8Array
  /** みずぐるまの 角度（ラジアン）。 */
  wheelAngle: number
  /** かんらんしゃの 角度（ラジアン）。 */
  toyAngle: number
  /** 水が とどいた ときの しぶき。1で いちばん大きく、0で 消える。 */
  splash: number
  /** てっぺんを こえた ゴンドラの かず。 */
  riders: number
  tick: number
}

function annulus(
  ctx: CanvasRenderingContext2D, radiusInner: number, radiusOuter: number, from: number, to: number,
): void {
  ctx.beginPath()
  ctx.arc(DISC.x, DISC.y, radiusOuter, from, to)
  ctx.arc(DISC.x, DISC.y, radiusInner, to, from, true)
  ctx.closePath()
}

function drawBackground(ctx: CanvasRenderingContext2D): void {
  const sky = ctx.createLinearGradient(0, 0, 0, GRID_HEIGHT)
  sky.addColorStop(0, COLORS.skyTop)
  sky.addColorStop(1, COLORS.skyBottom)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, GRID_WIDTH, GRID_HEIGHT)
  ctx.fillStyle = COLORS.ground
  ctx.fillRect(0, GROUND_ROW, GRID_WIDTH, GRID_HEIGHT - GROUND_ROW)
  ctx.fillStyle = COLORS.groundDark
  ctx.fillRect(0, GROUND_ROW, GRID_WIDTH, 1.5)
}

function drawDiscBase(ctx: CanvasRenderingContext2D): void {
  const base = ctx.createRadialGradient(DISC.x, DISC.y - DISC.radius * 0.3, 2, DISC.x, DISC.y, DISC.radius)
  base.addColorStop(0, COLORS.discBase)
  base.addColorStop(1, COLORS.discShade)
  ctx.fillStyle = base
  ctx.beginPath()
  ctx.arc(DISC.x, DISC.y, DISC.radius, 0, TAU)
  ctx.fill()
}

/**
 * わっかの かべは 水より あとに えがく。
 * 円盤が まわった しゅんかんに かべと かさなった つぶが かべの上に 見えてしまうのを ふせぐ。
 */
function drawDiscWalls(ctx: CanvasRenderingContext2D, view: SceneView): void {
  // まわっていることが すぐ わかるように、円盤の そとへ にぎりを つける。
  ctx.fillStyle = COLORS.grip
  for (let corner = 0; corner < 4; corner++) {
    const angle = toRadians(view.rotation + corner * 90 + 45)
    ctx.beginPath()
    ctx.arc(DISC.x + Math.cos(angle) * (DISC.radius + 1.6), DISC.y + Math.sin(angle) * (DISC.radius + 1.6), 3, 0, TAU)
    ctx.fill()
  }

  ctx.lineJoin = 'round'
  for (const ring of view.rings) {
    const slot = RING_SLOTS[ring.slot]
    if (!slot) continue
    for (const run of ring.runs) {
      const from = toRadians(run.from + view.rotation)
      const to = toRadians(run.from + run.length + view.rotation)
      // ます目に そろえた あたり判定より ほんの すこし ふとく えがき、
      // かべの きわで 水の ドットが ぎざぎざに はみ出して 見えないようにする。
      annulus(ctx, slot.inner - 0.5, slot.outer + 0.5, from, to)
      ctx.fillStyle = COLORS.wall
      ctx.fill()
      ctx.strokeStyle = COLORS.wallFoot
      ctx.lineWidth = 0.8
      ctx.stroke()
      // うちがわの ふちだけ 明るくして、わっかの あつみを 見せる。
      ctx.beginPath()
      ctx.arc(DISC.x, DISC.y, slot.inner + 0.3, from, to)
      ctx.strokeStyle = COLORS.wallEdge
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }
}

function drawWater(ctx: CanvasRenderingContext2D, water: Uint8Array): void {
  ctx.beginPath()
  for (let index = 0; index < water.length; index++) {
    if (water[index] === 0) continue
    const x = index % GRID_WIDTH
    // ますの あいだに すきまが 出ないよう、すこし 大きめに ぬる。
    ctx.rect(x - 0.03, (index - x) / GRID_WIDTH - 0.03, 1.06, 1.06)
  }
  ctx.fillStyle = COLORS.water
  ctx.fill()

  ctx.beginPath()
  for (let index = GRID_WIDTH; index < water.length; index++) {
    if (water[index] === 0 || water[index - GRID_WIDTH] === 1) continue
    const x = index % GRID_WIDTH
    ctx.rect(x - 0.03, (index - x) / GRID_WIDTH - 0.03, 1.06, 0.9)
  }
  ctx.fillStyle = COLORS.waterTop
  ctx.fill()
}

function drawChute(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = COLORS.wood
  ctx.lineCap = 'round'
  ctx.lineWidth = CHUTE.thickness
  for (const [outer, mouth] of [[CHUTE.outerLeft, CHUTE.mouthLeft], [CHUTE.outerRight, CHUTE.mouthRight]]) {
    ctx.beginPath()
    ctx.moveTo(outer, CHUTE.top)
    ctx.lineTo(mouth, CHUTE.bottom)
    ctx.stroke()
    // 円盤の よこの かこい。とび出した水も シュートへ もどってくる。
    ctx.beginPath()
    ctx.moveTo(outer, CHUTE.wallTop)
    ctx.lineTo(outer, CHUTE.top)
    ctx.stroke()
  }
}

function drawSplash(ctx: CanvasRenderingContext2D, view: SceneView): void {
  if (view.splash <= 0.02) return
  const center = (CHUTE.mouthLeft + CHUTE.mouthRight) / 2
  ctx.fillStyle = COLORS.waterTop
  for (let drop = 0; drop < 5; drop++) {
    const spread = (drop - 2) * 2.4
    const lift = Math.sin((view.tick * 0.3) + drop) * 1.2
    ctx.beginPath()
    ctx.arc(center + spread, CATCH_ROW + 2 + lift, 0.8 + view.splash * 1.2, 0, TAU)
    ctx.fill()
  }
}

function drawSupport(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
  ctx.fillStyle = COLORS.wheelDark
  ctx.beginPath()
  ctx.moveTo(x - width, GROUND_ROW)
  ctx.lineTo(x - 1.4, y)
  ctx.lineTo(x + 1.4, y)
  ctx.lineTo(x + width, GROUND_ROW)
  ctx.closePath()
  ctx.fill()
}

function drawWheel(ctx: CanvasRenderingContext2D, view: SceneView): void {
  drawSupport(ctx, WHEEL.x, WHEEL.y, WHEEL.radius * 0.7)
  ctx.save()
  ctx.translate(WHEEL.x, WHEEL.y)
  ctx.rotate(view.wheelAngle)
  ctx.strokeStyle = COLORS.wheel
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, WHEEL.radius, 0, TAU)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, WHEEL.radius * 0.55, 0, TAU)
  ctx.stroke()
  for (let blade = 0; blade < WHEEL.blades; blade++) {
    const angle = (blade / WHEEL.blades) * TAU
    ctx.save()
    ctx.rotate(angle)
    ctx.strokeStyle = COLORS.wheel
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(WHEEL.radius, 0)
    ctx.stroke()
    ctx.fillStyle = COLORS.bucket
    ctx.fillRect(WHEEL.radius * 0.6, -2.6, WHEEL.radius * 0.4, 5.2)
    ctx.restore()
  }
  ctx.restore()
  ctx.fillStyle = COLORS.axle
  ctx.beginPath()
  ctx.arc(WHEEL.x, WHEEL.y, 2.4, 0, TAU)
  ctx.fill()
}

function drawBelt(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = COLORS.axle
  ctx.lineWidth = 1.2
  for (const offset of [-2.2, 2.2]) {
    ctx.beginPath()
    ctx.moveTo(WHEEL.x, WHEEL.y + offset)
    ctx.lineTo(TOY.x, TOY.y + offset)
    ctx.stroke()
  }
}

function drawToy(ctx: CanvasRenderingContext2D, view: SceneView): void {
  drawSupport(ctx, TOY.x, TOY.y, TOY.radius * 0.8)
  ctx.save()
  ctx.translate(TOY.x, TOY.y)
  ctx.strokeStyle = COLORS.toy
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.arc(0, 0, TOY.radius, 0, TAU)
  ctx.stroke()
  for (let gondola = 0; gondola < TOY.gondolas; gondola++) {
    const angle = view.toyAngle + (gondola / TOY.gondolas) * TAU - Math.PI / 2
    const x = Math.cos(angle) * TOY.radius
    const y = Math.sin(angle) * TOY.radius
    ctx.strokeStyle = COLORS.toyDark
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(x, y)
    ctx.stroke()
    // ゴンドラは まわっても かたむかない。のっている どうぶつが つねに 上をむく。
    ctx.fillStyle = gondola < view.riders ? COLORS.grip : '#ffffff'
    ctx.beginPath()
    ctx.arc(x, y, 3.4, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = COLORS.toyDark
    ctx.lineWidth = 0.7
    ctx.stroke()
    ctx.font = '4.4px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(RIDERS[gondola % RIDERS.length], x, y + 0.3)
  }
  ctx.fillStyle = COLORS.axle
  ctx.beginPath()
  ctx.arc(0, 0, 2, 0, TAU)
  ctx.fill()
  ctx.restore()
}

/** ばんめん ぜんぶを 1こま ぶん えがく。 */
export function drawScene(ctx: CanvasRenderingContext2D, view: SceneView): void {
  drawBackground(ctx)
  drawDiscBase(ctx)
  drawWater(ctx, view.water)
  drawDiscWalls(ctx, view)
  drawChute(ctx)
  drawSplash(ctx, view)
  drawBelt(ctx)
  drawWheel(ctx, view)
  drawToy(ctx, view)
}
