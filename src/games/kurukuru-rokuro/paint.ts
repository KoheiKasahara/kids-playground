/**
 * うわぐすり（ぜんたいの いろ）と ふでの もようの データ、そして それを 2Dキャンバスへ かく処理。
 * かいた キャンバスを 3Dの うつわの そとがわに まきつけて 表示する。
 * u は うつわの まわり（0〜1）、v は そこから かべに そって はかった ながさの わりあい（0〜1）。
 */

export type GlazeId = 'white' | 'pink' | 'red' | 'orange' | 'yellow' | 'green' | 'sky' | 'blue' | 'purple' | 'brown'

export const GLAZES: readonly { id: GlazeId; name: string; hex: string }[] = [
  { id: 'white', name: 'しろ', hex: '#f4f1ea' },
  { id: 'pink', name: 'ピンク', hex: '#ef8fb0' },
  { id: 'red', name: 'あか', hex: '#d8433a' },
  { id: 'orange', name: 'オレンジ', hex: '#ee8a2c' },
  { id: 'yellow', name: 'きいろ', hex: '#f2c936' },
  { id: 'green', name: 'みどり', hex: '#4da862' },
  { id: 'sky', name: 'みずいろ', hex: '#5cbfe0' },
  { id: 'blue', name: 'あお', hex: '#2f5fb8' },
  { id: 'purple', name: 'むらさき', hex: '#8a5cc4' },
  { id: 'brown', name: 'こげちゃ', hex: '#6b4128' },
]

/** まだ うわぐすりを ぬっていない ねんどの いろ。 */
export const CLAY_HEX = '#c48a5e'

export type BrushId = 'thick' | 'thin' | 'dots'

/** size は ふでの はば（3Dの せかいの 長さ）。 */
export const BRUSHES: readonly { id: BrushId; name: string; size: number }[] = [
  { id: 'thick', name: 'ふとい ふで', size: 0.2 },
  { id: 'thin', name: 'ほそい ふで', size: 0.07 },
  { id: 'dots', name: 'てんてん', size: 0.13 },
]

export type StrokePoint = readonly [u: number, v: number]
export type Stroke = { readonly color: GlazeId; readonly brush: BrushId; readonly points: readonly StrokePoint[] }
export type PaintState = { readonly base: GlazeId | null; readonly strokes: readonly Stroke[] }

export const EMPTY_PAINT: PaintState = { base: null, strokes: [] }
/** 1本の せんの 点の 上限。ずっと おしていても データが ふくらみすぎない。 */
export const MAX_STROKE_POINTS = 260
/** ぜんぶの せんの 点の 上限。 */
export const MAX_TOTAL_POINTS = 5000

export function glazeHex(id: GlazeId | null): string {
  return GLAZES.find(glaze => glaze.id === id)?.hex ?? CLAY_HEX
}

export function brushSize(id: BrushId): number {
  return BRUSHES.find(brush => brush.id === id)?.size ?? BRUSHES[0]!.size
}

export function totalPoints(paint: PaintState): number {
  return paint.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0)
}

/** キーボード用。v の ところに まわり いっしゅうの せんを ひく。 */
export function ringStroke(v: number, color: GlazeId, brush: BrushId): Stroke {
  const count = 72
  const rounded = Math.round(v * 1000) / 1000
  return { color, brush, points: Array.from({ length: count + 1 }, (_, index) => [Math.round((index / count) * 1000) / 1000, rounded] as const) }
}

function mix(hex: string, other: string, amount: number): string {
  const parse = (value: string) => [1, 3, 5].map(offset => parseInt(value.slice(offset, offset + 2), 16))
  const a = parse(hex)
  const b = parse(other)
  return `#${a.map((channel, index) => Math.round(channel + (b[index]! - channel) * amount).toString(16).padStart(2, '0')).join('')}`
}

/** やく まえの うわぐすりは 白っぽく こなっぽい。やくと あざやかに なる。 */
export function shownHex(id: GlazeId | null, baked: boolean): string {
  const hex = glazeHex(id)
  if (id === null) return baked ? mix(hex, '#8a4a2a', 0.12) : hex
  return baked ? hex : mix(hex, '#f3eee6', 0.45)
}

/** 決まった じゅんばんの らんすう（毎回 おなじ もようの ねんどに する）。 */
function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

export type PaintSurface = {
  /** キャンバスの はば・たかさ [px]。 */
  width: number
  height: number
  /** そとがわの かべの ながさ（3Dの 長さ）。ふでの はばを v へ なおすのに つかう。 */
  wallLength: number
  /** v での はんけい。てんてんを まるく みせるのに つかう。 */
  radiusAtV: (v: number) => number
}

/** ぜんたいを かきなおす。 */
export function drawPaint(ctx: CanvasRenderingContext2D, surface: PaintSurface, paint: PaintState, baked: boolean): void {
  const { width, height } = surface
  ctx.globalAlpha = 1
  ctx.fillStyle = shownHex(paint.base, baked)
  ctx.fillRect(0, 0, width, height)
  if (paint.base === null) drawClayGrain(ctx, width, height)
  for (const stroke of paint.strokes) drawStrokeSegments(ctx, surface, stroke, 1, baked)
  if (baked) drawSpecks(ctx, width, height)
}

/** ねんどの すじ。まわっているのが 見えるように、たての すじと しみを うすく いれる。 */
function drawClayGrain(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const random = seeded(7)
  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.05 + random() * 0.09
    ctx.fillStyle = random() < 0.5 ? '#8f5a36' : '#e3b48c'
    ctx.fillRect(random() * width, 0, 2 + random() * 9, height)
  }
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.06 + random() * 0.08
    ctx.fillStyle = '#7d4b2b'
    ctx.beginPath()
    ctx.ellipse(random() * width, random() * height, 6 + random() * 20, 3 + random() * 8, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

/** やいた あとの こまかい てんてん（ほんものの やきものらしさ）。 */
function drawSpecks(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const random = seeded(11)
  ctx.fillStyle = '#3b2a20'
  for (let i = 0; i < 160; i++) {
    ctx.globalAlpha = 0.08 + random() * 0.14
    ctx.fillRect(random() * width, random() * height, 1.5, 1.5)
  }
  ctx.globalAlpha = 1
}

/**
 * せんの from ばんめの 点から さいごまでを かく（かいている とちゅうは あたらしい ぶんだけ かき足す）。
 * まわりの つなぎめ（u=0 と 1）を またぐ せんは、左右に ずらして もう一度 かいて つなげる。
 */
export function drawStrokeSegments(ctx: CanvasRenderingContext2D, surface: PaintSurface, stroke: Stroke, from: number, baked: boolean): void {
  const { width, height, wallLength } = surface
  const color = shownHex(stroke.color, baked)
  const size = (brushSize(stroke.brush) / Math.max(0.1, wallLength)) * height
  ctx.globalAlpha = 1
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = size
  const points = stroke.points
  if (stroke.brush === 'dots') {
    // まわり 1しゅうに 10こ くらいの てんてん。u の くぎりを こえた ところに 1こ おく。
    const slots = 10
    for (let index = Math.max(0, from - 1); index < points.length; index++) {
      const [u, v] = points[index]!
      const previous = index > 0 ? points[index - 1]! : null
      const slot = Math.floor(u * slots) % slots
      if (previous && Math.floor(previous[0] * slots) % slots === slot && Math.abs(previous[1] - v) < 0.08) continue
      const radius = Math.max(0.05, surface.radiusAtV(v))
      const rx = (brushSize('dots') / 2 / (Math.PI * 2 * radius)) * width
      const ry = size / 2
      const x = ((slot + 0.5) / slots) * width
      const y = (1 - v) * height
      ctx.beginPath()
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }
  if (points.length === 1 && from <= 1) {
    const [u, v] = points[0]!
    ctx.beginPath()
    ctx.arc(u * width, (1 - v) * height, size / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  for (let index = Math.max(1, from); index < points.length; index++) {
    const [u0, v0] = points[index - 1]!
    const [u1, v1] = points[index]!
    let du = u1 - u0
    if (du > 0.5) du -= 1
    if (du < -0.5) du += 1
    for (const offset of [-1, 0, 1]) {
      const x0 = (u0 + offset) * width
      const x1 = (u0 + du + offset) * width
      if (Math.max(x0, x1) < -size || Math.min(x0, x1) > width + size) continue
      ctx.beginPath()
      ctx.moveTo(x0, (1 - v0) * height)
      ctx.lineTo(x1, (1 - v1) * height)
      ctx.stroke()
    }
  }
}

const GLAZE_IDS = new Set<string>(GLAZES.map(glaze => glaze.id))
export function isGlazeId(value: unknown): value is GlazeId {
  return typeof value === 'string' && GLAZE_IDS.has(value)
}
