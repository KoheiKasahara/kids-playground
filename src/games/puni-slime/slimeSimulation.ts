/** Small deterministic soft body. One step is 1/60 second; no DOM or renderer dependency. */
export const WIDTH = 600
export const HEIGHT = 500
export const FLOOR = 456
const COUNT = 48
const HOME = { x: 300, y: 265 }
export type Point = { x: number; y: number }
export type Particle = Point & { px: number; py: number }
export type Grab = { index: number; target: Point; offset: Point }
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const angles = Array.from({ length: COUNT }, (_, i) => i * Math.PI * 2 / COUNT)
/** Signed power, so a superellipse keeps its corners in every quadrant. */
const curve = (n: number, exponent: number) => (n < 0 ? -1 : 1) * Math.abs(n) ** exponent
function ringPerimeter(points: readonly Point[]): number {
  return points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length]
    return sum + Math.hypot(p.x - q.x, p.y - q.y)
  }, 0)
}
function ringArea(points: readonly Point[]): number {
  return points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length]
    return sum + p.x * q.y - q.x * p.y
  }, 0) / 2
}
function ring(points: readonly Point[]): string {
  const n = points.length
  const mid = (a: Point, b: Point) => `${((a.x + b.x) / 2).toFixed(1)},${((a.y + b.y) / 2).toFixed(1)}`
  return `M${mid(points[n - 1], points[0])} ` + points.map((p, i) => `Q${p.x.toFixed(1)},${p.y.toFixed(1)} ${mid(p, points[(i + 1) % n])}`).join(' ') + 'Z'
}

/* ---- かたち（仕様1）----
   形ごとに違うのは「中心からの相対輪郭」だけ。ひっぱり・戻りのロジックは形を知らずに動く。 */
export type ShapeId = 'round' | 'star' | 'donut' | 'cube' | 'long' | 'cloud'
type Link = { i: number; j: number; length: number }
export type Shape = {
  id: ShapeId
  label: string
  emoji: string
  /** 中心からの相対座標。stepSlimeはここへ戻そうとする。 */
  rest: readonly Point[]
  /** rest方向の単位ベクトル。ぷるぷるの震えを輪郭の外向きへ乗せるのに使う。 */
  normals: readonly Point[]
  links: readonly Link[]
  restArea: number
  restPerimeter: number
  restWidth: number
  restHeight: number
  /** 0以外なら中央に穴。輪郭を縮小した内側ループとして描く。 */
  hole: number
  /** 顔の置き場所。穴あきや横長でも顔が輪郭からはみ出さないようにする。 */
  face: { y: number; scale: number }
}
type ShapeSource = { label: string; emoji: string; hole?: number; face?: { y: number; scale: number }; at: (t: number) => Point }
const SHAPE_SOURCES: Record<ShapeId, ShapeSource> = {
  round: { label: 'まる', emoji: '⚪️', at: (t) => ({ x: Math.cos(t) * 145, y: Math.sin(t) * 112 }) },
  star: {
    label: 'ほし', emoji: '⭐️', face: { y: 4, scale: 0.78 },
    // 上にとがりが来るよう5つの山をずらし、指数で山をとがらせる。
    at: (t) => { const lobe = ((1 + Math.cos(5 * t + Math.PI * 2.5)) / 2) ** 1.7, r = 62 + 88 * lobe; return { x: Math.cos(t) * r, y: Math.sin(t) * r * 0.94 } },
  },
  donut: { label: 'ドーナツ', emoji: '🍩', hole: 0.38, face: { y: 66, scale: 0.72 }, at: (t) => ({ x: Math.cos(t) * 148, y: Math.sin(t) * 116 }) },
  cube: { label: 'しかく', emoji: '🟦', at: (t) => ({ x: curve(Math.cos(t), 0.42) * 134, y: curve(Math.sin(t), 0.42) * 116 }) },
  long: { label: 'ながぼう', emoji: '🥖', face: { y: 2, scale: 0.9 }, at: (t) => ({ x: Math.cos(t) * 198, y: Math.sin(t) * 76 }) },
  cloud: {
    label: 'くも', emoji: '☁️',
    // |sin(2.5t)| は2πで5回きれいに閉じるので、もこもこが継ぎ目なく並ぶ。
    at: (t) => { const bump = 1 + 0.17 * Math.abs(Math.sin(2.5 * t)); return { x: Math.cos(t) * 130 * bump, y: Math.sin(t) * 100 * bump } },
  },
}
function buildShape(id: ShapeId): Shape {
  const source = SHAPE_SOURCES[id]
  // 平均を原点へ寄せておく。stepSlimeは「今の中心＋rest」を目標にするので、
  // restの重心がずれていると形を変えるたびに体が横へ流れてしまう。
  const raw = angles.map(source.at)
  const bias = raw.reduce((c, p) => ({ x: c.x + p.x / COUNT, y: c.y + p.y / COUNT }), { x: 0, y: 0 })
  const rest = raw.map((p) => ({ x: p.x - bias.x, y: p.y - bias.y }))
  return {
    id, label: source.label, emoji: source.emoji,
    rest,
    normals: rest.map((p) => { const length = Math.hypot(p.x, p.y) || 1; return { x: p.x / length, y: p.y / length } }),
    links: rest.flatMap((p, i) => [1, 3].map((gap) => {
      const j = (i + gap) % COUNT
      return { i, j, length: Math.hypot(p.x - rest[j].x, p.y - rest[j].y) }
    })),
    restArea: ringArea(rest),
    restPerimeter: ringPerimeter(rest),
    restWidth: Math.max(...rest.map((p) => p.x)) - Math.min(...rest.map((p) => p.x)),
    restHeight: Math.max(...rest.map((p) => p.y)) - Math.min(...rest.map((p) => p.y)),
    hole: source.hole ?? 0,
    face: source.face ?? { y: 8, scale: 1 },
  }
}
export const SHAPE_IDS: readonly ShapeId[] = ['round', 'star', 'donut', 'cube', 'long', 'cloud']
export const SHAPES: Record<ShapeId, Shape> = Object.fromEntries(SHAPE_IDS.map((id) => [id, buildShape(id)])) as Record<ShapeId, Shape>

/* ---- さわりごこち（仕様2）----
   戻りの速さ・粘り・見た目・音をひとまとめにしておき、質感を足すときはここへ1行増やすだけにする。 */
export type Feel = 'soft' | 'bouncy'
export type FeelParams = {
  label: string
  emoji: string
  /** rest形状へ戻る強さ。小さいほどゆっくり戻る。 */
  spring: number
  /** 速度の残り方。小さいほど粘って揺れが止まる。 */
  drag: number
  gravity: number
  /** 輪郭の伸び縮みへの抵抗。小さいほど細く糸を引く。 */
  stiffness: number
  /** 面積を保とうとする上限。小さいほど伸ばしたとき痩せる。 */
  pressure: number
  /** 揺らしたあと続く震え。gainが0なら震えない。 */
  jiggle: { gain: number; decay: number; speed: number; force: number; wake: number }
  /** 伸びた先から垂れる滴。everyが0なら垂れない。 */
  drip: { every: number; max: number; stretch: number }
  /** 見た目の差。半透明でにじむか、不透明でくっきりか。 */
  look: { body: number; shine: number; blur: number; stroke: number; gloss: number }
  /** 効果音の地の音。低く間延びするか、高く弾むか。 */
  voice: { base: number; wave: OscillatorType; length: number; glide: number; volume: number }
}
export const FEELS: Record<Feel, FeelParams> = {
  soft: {
    label: 'とろ〜り', emoji: '🫠',
    spring: 0.0028, drag: 0.955, gravity: 0.46, stiffness: 0.13, pressure: 0.095,
    jiggle: { gain: 0, decay: 0.9, speed: 0, force: 0, wake: 0 },
    drip: { every: 15, max: 6, stretch: 1.12 },
    look: { body: 0.84, shine: 0.3, blur: 9, stroke: 2.5, gloss: 0.16 },
    voice: { base: 168, wave: 'sine', length: 0.4, glide: -0.3, volume: 0.075 },
  },
  bouncy: {
    label: 'ぷるぷる', emoji: '🟢',
    spring: 0.021, drag: 0.994, gravity: 0.3, stiffness: 0.2, pressure: 0.16,
    jiggle: { gain: 0.035, decay: 0.965, speed: 0.72, force: 0.5, wake: 0.9 },
    drip: { every: 0, max: 0, stretch: 0 },
    look: { body: 1, shine: 0.72, blur: 0, stroke: 3.5, gloss: 0.44 },
    voice: { base: 392, wave: 'triangle', length: 0.15, glide: 0.55, volume: 0.06 },
  },
}

/* ---- 容器（仕様3）----
   容器は「48点ぶんの内側の目標点」を配るだけ。乗るとそこへ吸われ、引き出すと形が戻る。 */
export type ContainerId = 'cup' | 'plate' | 'star'
export type Container = {
  id: ContainerId
  label: string
  emoji: string
  /** 内側の中心。乗る・出るの判定はここからの距離で決める。 */
  center: Point
  /** 内側の輪郭（絶対座標・48点）。 */
  inner: readonly Point[]
  innerArea: number
  innerPerimeter: number
  /** 容器の壁。内側をくり抜いた evenodd のパス。 */
  wall: string
  /** 乗る距離と、出たと見なす距離。出る側を広く取って行ったり来たりを防ぐ。 */
  grip: number
  release: number
}
/** 中心から48方向へ光線を飛ばし、多角形の内壁を等角度でサンプルする。捻れずに形へ収まる。 */
function contour(vertices: readonly Point[], center: Point): Point[] {
  return angles.map((t) => {
    const dx = Math.cos(t), dy = Math.sin(t)
    let hit = Infinity
    for (let k = 0; k < vertices.length; k++) {
      const a = vertices[k], b = vertices[(k + 1) % vertices.length]
      const ex = b.x - a.x, ey = b.y - a.y
      const den = dx * ey - dy * ex
      if (Math.abs(den) < 1e-9) continue
      const wx = a.x - center.x, wy = a.y - center.y
      const along = (wx * ey - wy * ex) / den
      const edge = (wx * dy - wy * dx) / den
      if (along > 0 && edge >= 0 && edge <= 1 && along < hit) hit = along
    }
    return Number.isFinite(hit) ? { x: center.x + dx * hit, y: center.y + dy * hit } : { ...center }
  })
}
const starVertices = (cx: number, cy: number, outer: number, inner: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const t = i * Math.PI / 5 - Math.PI / 2
    const r = i % 2 ? inner : outer
    return { x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r }
  })
function buildContainer(id: ContainerId, label: string, emoji: string, vertices: readonly Point[], wall: string, grip: number, release: number): Container {
  const center = vertices.reduce((c, p) => ({ x: c.x + p.x / vertices.length, y: c.y + p.y / vertices.length }), { x: 0, y: 0 })
  const inner = contour(vertices, center)
  return { id, label, emoji, center, inner, innerArea: ringArea(inner), innerPerimeter: ringPerimeter(inner), wall: `${wall} ${ring(inner)}`, grip, release }
}
export const CONTAINERS: readonly Container[] = [
  buildContainer('cup', 'コップ', '🥛',
    [{ x: 164, y: 300 }, { x: 142, y: 430 }, { x: 132, y: 444 }, { x: 60, y: 444 }, { x: 50, y: 430 }, { x: 28, y: 300 }],
    'M13 288 L35 434 Q44 456 66 456 L126 456 Q148 456 157 434 L179 288 Z', 80, 140),
  buildContainer('plate', 'おさら', '🍽️',
    [{ x: 400, y: 362 }, { x: 388, y: 424 }, { x: 366, y: 436 }, { x: 234, y: 436 }, { x: 212, y: 424 }, { x: 200, y: 362 }],
    'M186 352 L198 428 Q208 456 238 456 L362 456 Q392 456 402 428 L414 352 Z', 84, 148),
  buildContainer('star', 'ほしがた', '⭐️',
    starVertices(504, 356, 77, 34),
    `M${starVertices(504, 356, 88, 42).map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')} Z`, 78, 136),
]

/* ---- スライム本体 ---- */
export type Drip = { x: number; y: number; vy: number; r: number; life: number }
export type Ghost = { d: string; life: number }
/** 音を鳴らすきっかけ。stepSlimeは音を知らず、印だけ残す。 */
export type SlimeEvent = 'fit' | 'free' | null
export type Slime = {
  shape: Shape
  points: Particle[]
  /** 揺らされた勢い。ぷるぷるの震えの持続に使う。 */
  jiggle: number
  phase: number
  tick: number
  drips: Drip[]
  molded: ContainerId | null
  /** 直前に出た容器。すぐ吸い戻されないよう少しのあいだだけ入れなくする。 */
  released: { id: ContainerId; life: number } | null
  ghost: Ghost | null
  event: SlimeEvent
}
/** 容器から出たあと、跡が消えるまでのステップ数。 */
export const GHOST_LIFE = 34
const RELEASE_LOCK = 26
export function createSlime(shape: ShapeId = 'round'): Slime {
  const body = SHAPES[shape]
  return {
    shape: body,
    points: body.rest.map((p) => ({ x: p.x + HOME.x, y: p.y + HOME.y, px: p.x + HOME.x, py: p.y + HOME.y })),
    jiggle: 0, phase: 0, tick: 0, drips: [], molded: null, released: null, ghost: null, event: null,
  }
}
/** 今の中心を保ったまま別の形へ入れ替える。速度は捨てるのでパチンと切り替わる。 */
export function morph(slime: Slime, shape: ShapeId): void {
  const c = center(slime)
  slime.shape = SHAPES[shape]
  slime.points.forEach((p, i) => {
    p.x = clamp(c.x + slime.shape.rest[i].x, 12, WIDTH - 12)
    p.y = clamp(c.y + slime.shape.rest[i].y, 12, FLOOR)
    p.px = p.x; p.py = p.y
  })
  slime.drips.length = 0
  slime.jiggle = 0
  slime.molded = null
  slime.released = null
  slime.ghost = null
}
export function center(slime: Slime): Point {
  return slime.points.reduce((c, p) => ({ x: c.x + p.x / COUNT, y: c.y + p.y / COUNT }), { x: 0, y: 0 })
}
export function area(slime: Slime): number {
  return ringArea(slime.points)
}
export function beginGrab(slime: Slime, target: Point, occupied: readonly Grab[] = []): Grab | null {
  // Polygon hit-test, with a forgiving 28-unit rim for small fingers.
  let inside = false
  let nearest = -1
  let distance = Infinity
  for (let i = 0, j = COUNT - 1; i < COUNT; j = i++) {
    const p = slime.points[i], q = slime.points[j]
    if ((p.y > target.y) !== (q.y > target.y) && target.x < (q.x - p.x) * (target.y - p.y) / (q.y - p.y) + p.x) inside = !inside
    const d = Math.hypot(p.x - target.x, p.y - target.y)
    if (d < distance && !occupied.some((g) => Math.min(Math.abs(g.index - i), COUNT - Math.abs(g.index - i)) < 5)) { nearest = i; distance = d }
  }
  if (nearest < 0 || (!inside && distance > 28)) return null
  const p = slime.points[nearest]
  return { index: nearest, target: { ...target }, offset: { x: p.x - target.x, y: p.y - target.y } }
}
/** 乗せる・引き出すの判定。指先か体の中心が近づけば収まり、どちらかが十分離れたら出る。 */
function updateMold(slime: Slime, c: Point, grabs: readonly Grab[], containers: readonly Container[]): Container | null {
  const reach = (k: Container) => [c, ...grabs.map((g) => g.target)].map((p) => Math.hypot(p.x - k.center.x, p.y - k.center.y))
  const held = containers.find((k) => k.id === slime.molded)
  if (held) {
    if (Math.max(...reach(held)) <= held.release) return held
    // 指が容器から十分離れたら抜ける。抜けた直後は体がまだ容器の中にあるので、
    // 同じ容器へ吸い戻されないよう少しのあいだ入口を閉じる。
    slime.ghost = { d: ring(held.inner), life: GHOST_LIFE }
    slime.released = { id: held.id, life: RELEASE_LOCK }
    slime.event = 'free'
  }
  slime.molded = null
  const found = containers.find((k) => k.id !== slime.released?.id && Math.min(...reach(k)) < k.grip)
  if (!found) return null
  slime.molded = found.id
  slime.released = null
  slime.event = 'fit'
  return found
}
function updateDrips(slime: Slime, feel: FeelParams): void {
  for (const drip of slime.drips) {
    if (drip.y < FLOOR) { drip.vy += 0.42; drip.y = Math.min(FLOOR, drip.y + drip.vy) }
    else drip.life -= 2
    drip.life -= 1
  }
  slime.drips = slime.drips.filter((drip) => drip.life > 0)
  if (!feel.drip.every || slime.tick % feel.drip.every || slime.drips.length >= feel.drip.max) return
  const low = slime.points.reduce((lowest, p) => (p.y > lowest.y ? p : lowest), slime.points[0])
  const top = Math.min(...slime.points.map((p) => p.y))
  if (low.y - top < slime.shape.restHeight * feel.drip.stretch || low.y > FLOOR - 26) return
  slime.drips.push({ x: low.x, y: low.y, vy: 0.3, r: 7 + slime.tick % 3, life: 96 })
}
export function stepSlime(slime: Slime, grabs: readonly Grab[] = [], feel: Feel = 'soft', containers: readonly Container[] = []): void {
  const params = FEELS[feel]
  const c = center(slime)
  const { rest, normals, links } = slime.shape
  slime.event = null
  slime.tick += 1
  if (slime.ghost) slime.ghost = slime.ghost.life > 1 ? { ...slime.ghost, life: slime.ghost.life - 1 } : null
  if (slime.released) slime.released = slime.released.life > 1 ? { ...slime.released, life: slime.released.life - 1 } : null
  const mold = updateMold(slime, c, grabs, containers)
  // 揺れの勢いを溜め、静かになれば自然に消える。とろ〜りはgainが0なので震えない。
  const motion = slime.points.reduce((sum, p) => sum + Math.abs(p.x - p.px) + Math.abs(p.y - p.py), 0) / COUNT
  slime.jiggle = clamp(slime.jiggle * params.jiggle.decay + (motion > params.jiggle.wake ? motion * params.jiggle.gain : 0), 0, 1)
  slime.phase += params.jiggle.speed
  const spring = mold ? 0.05 : params.spring
  const gravity = mold ? 0 : params.gravity
  for (let i = 0; i < COUNT; i++) {
    const p = slime.points[i]
    const vx = clamp((p.x - p.px) * params.drag, -18, 18)
    const vy = clamp((p.y - p.py) * params.drag, -18, 18)
    const wave = slime.jiggle > 0.001 ? Math.sin(slime.phase + i * 0.8) * slime.jiggle * params.jiggle.force : 0
    p.px = p.x; p.py = p.y
    p.x += vx + ((mold ? mold.inner[i].x : c.x + rest[i].x) - p.x) * spring + normals[i].x * wave
    p.y += vy + gravity + ((mold ? mold.inner[i].y : c.y + rest[i].y) - p.y) * spring + normals[i].y * wave
  }
  // 容器の中では圧力をゆるめ、輪郭の自然長も容器の周長へ縮める。
  // 縮めないと余った輪郭が座屈して、内壁沿いがギザギザに波打つ。
  const stiffness = mold ? params.stiffness * 0.5 : params.stiffness
  const shrink = mold ? Math.min(1, mold.innerPerimeter / slime.shape.restPerimeter) : 1
  const restArea = mold ? mold.innerArea : slime.shape.restArea
  const limit = mold ? params.pressure * 0.5 : params.pressure
  for (let pass = 0; pass < 5; pass++) {
    for (const link of links) {
      const a = slime.points[link.i], b = slime.points[link.j]
      const dx = b.x - a.x, dy = b.y - a.y
      const length = Math.hypot(dx, dy) || 1
      const correction = (length - link.length * shrink) / length * stiffness
      a.x += dx * correction; a.y += dy * correction
      b.x -= dx * correction; b.y -= dy * correction
    }
    // Area preservation gives the squish its sideways bulge. Cap corrections during extreme drags.
    const gradients = slime.points.map((_, i) => {
      const prev = slime.points[(i + COUNT - 1) % COUNT], next = slime.points[(i + 1) % COUNT]
      return { x: (next.y - prev.y) / 2, y: (prev.x - next.x) / 2 }
    })
    const norm = gradients.reduce((n, g) => n + g.x * g.x + g.y * g.y, 0)
    const pressure = clamp((restArea - area(slime)) / Math.max(norm, 1), -limit, limit)
    slime.points.forEach((p, i) => { p.x += gradients[i].x * pressure; p.y += gradients[i].y * pressure })
    if (mold) slime.points.forEach((p, i) => { p.x += (mold.inner[i].x - p.x) * 0.16; p.y += (mold.inner[i].y - p.y) * 0.16 })
    for (const grab of grabs) {
      const p = slime.points[grab.index]
      p.x += (clamp(grab.target.x + grab.offset.x, 16, WIDTH - 16) - p.x) * 0.3
      p.y += (clamp(grab.target.y + grab.offset.y, 16, FLOOR) - p.y) * 0.3
    }
    for (const p of slime.points) {
      if (p.y > FLOOR) { p.y = FLOOR; p.py = FLOOR + Math.max(0, p.y - p.py) * 0.18; p.px += (p.x - p.px) * 0.12 }
      p.x = clamp(p.x, 12, WIDTH - 12)
      p.y = Math.max(12, p.y)
    }
  }
  updateDrips(slime, params)
}
/** A brief tap also leaves a visible ripple, even if the finger never moves. */
export function poke(slime: Slime, index: number): void {
  for (let offset = -5; offset <= 5; offset++) {
    const p = slime.points[(index + offset + COUNT) % COUNT]
    p.py -= (1 - Math.abs(offset) / 6) * 5
  }
}
export function squish(slime: Slime): void {
  const c = center(slime)
  for (const p of slime.points) {
    // Change position and velocity together: visible flattening, followed by an elastic recovery.
    p.x = clamp(c.x + (p.x - c.x) * 1.2, 12, WIDTH - 12)
    p.y = clamp(c.y + (p.y - c.y) * 0.62 + 20, 12, FLOOR)
    p.px = p.x; p.py = p.y - 2
  }
}
export function lift(slime: Slime): void {
  const c = center(slime)
  const top = Math.min(...slime.points.map((p) => p.y))
  const shift = Math.max(12 - top, Math.min(-80, 175 - c.y))
  for (const p of slime.points) { p.y += shift; p.py = p.y + 3; p.px = p.x }
  // 持ち上げた瞬間に容器から抜け、落ちてもう一度入れるようにする。
  if (slime.molded) slime.released = { id: slime.molded, life: RELEASE_LOCK }
  slime.molded = null
}
export function outline(slime: Slime): string {
  return ring(slime.points)
}
/**
 * ドーナツの穴。輪郭を中心へ縮めた内側ループなので、変形しても穴が一緒に動く。
 * 外周と逆回りに書くことで nonzero のまま穴として抜ける。evenodd に頼ると、
 * 大きく伸ばして輪郭が自分自身と重なったとき、その重なりまで穴になってしまう。
 */
export function holeOutline(slime: Slime): string {
  if (!slime.shape.hole) return ''
  const c = center(slime), k = slime.shape.hole
  return ring(slime.points.map((p) => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k })).reverse())
}
/** 形えらびボタン用のミニチュア。選ぶ形をそのままの比率で見せる。 */
export function shapePreview(id: ShapeId, size: number): string {
  const body = SHAPES[id]
  const half = size / 2
  const scale = (half - 2) / Math.max(...body.rest.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))))
  const points = body.rest.map((p) => ({ x: half + p.x * scale, y: half + p.y * scale }))
  const outer = ring(points)
  return body.hole ? `${outer} ${ring(points.map((p) => ({ x: half + (p.x - half) * body.hole, y: half + (p.y - half) * body.hole })).reverse())}` : outer
}
/** 塗りに使う本体パス。穴あき形状は evenodd で内側を抜く。 */
export function bodyPath(slime: Slime): string {
  const hole = holeOutline(slime)
  return hole ? `${outline(slime)} ${hole}` : outline(slime)
}
