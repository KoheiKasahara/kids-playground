// レースのコースの形（中心線）と、コースの上の位置の計算（純粋な計算。Three.js を使わない）。
// 座標は動物園と同じ（x 右, z 手前, 単位メートル）。向きは 0 で +z、正の向きに増えると左へ回る。
// コースは中心線にそって「スタートからの距離 s」で位置を決め、レーンは中心線から横へずらす。

export type Vec2 = { x: number; z: number }

export type CoursePath = {
  xs: Float64Array
  zs: Float64Array
  /** 各点までの、最初の点からの距離。 */
  ss: Float64Array
  /** 中心線の長さ。輪のコースでは1周の長さ。 */
  length: number
  closed: boolean
}

export type PathPoint = Vec2 & {
  /** 進む向き（ラジアン）。 */
  heading: number
}

/** 一様な Catmull-Rom 曲線で、制御点のあいだをなめらかにつなぐ。 */
function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t
  const t3 = t2 * t
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
  return { x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) }
}

/**
 * 制御点から中心線を作る。smooth が false なら点をそのまま結ぶ（すでに細かい点列のとき）。
 * 細かい点列に直してから、点ごとの距離を持たせる。
 */
export function buildPath(points: readonly Vec2[], options: { closed?: boolean; smooth?: boolean; step?: number } = {}): CoursePath {
  const closed = options.closed ?? false
  const step = options.step ?? 0.5
  if (points.length < 2) throw new Error('コースには2つ以上の点が いる')
  const dense: Vec2[] = []
  const n = points.length
  const at = (i: number) => closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]
  const segments = closed ? n : n - 1
  for (let i = 0; i < segments; i++) {
    const a = at(i)
    const b = at(i + 1)
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const parts = Math.max(1, Math.ceil(len / step))
    for (let k = 0; k < parts; k++) {
      const t = k / parts
      dense.push(options.smooth === false || n < 3 ? { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t } : catmullRom(at(i - 1), a, b, at(i + 2), t))
    }
  }
  if (closed) dense.push({ ...dense[0] })
  else dense.push({ ...points[n - 1] })
  const xs = new Float64Array(dense.length)
  const zs = new Float64Array(dense.length)
  const ss = new Float64Array(dense.length)
  let s = 0
  dense.forEach((p, i) => {
    if (i > 0) s += Math.hypot(p.x - dense[i - 1].x, p.z - dense[i - 1].z)
    xs[i] = p.x
    zs[i] = p.z
    ss[i] = s
  })
  return { xs, zs, ss, length: s, closed }
}

/** 陸上競技場のような、2本の直線と2つの半円でできた輪（反時計回り。最初の点は手前の直線のまんなか）。 */
export function stadiumPoints(straight: number, radius: number, step = 0.5): Vec2[] {
  const pts: Vec2[] = []
  const half = straight / 2
  const line = (x0: number, x1: number, z: number) => {
    const parts = Math.ceil(Math.abs(x1 - x0) / step)
    for (let k = 0; k < parts; k++) pts.push({ x: x0 + (x1 - x0) * (k / parts), z })
  }
  const arc = (cx: number, from: number) => {
    const parts = Math.ceil((Math.PI * radius) / step)
    for (let k = 0; k < parts; k++) {
      const a = from + Math.PI * (k / parts)
      pts.push({ x: cx + Math.sin(a) * radius, z: Math.cos(a) * radius })
    }
  }
  line(0, half, radius)
  arc(half, 0)
  line(half, -half, -radius)
  arc(-half, Math.PI)
  line(-half, 0, radius)
  return pts
}

/** s の位置を、中心線の点の番号（とその間の割合）にする。 */
function locate(path: CoursePath, s: number): { i: number; k: number } {
  const { ss } = path
  let lo = 0
  let hi = ss.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (ss[mid] <= s) lo = mid
    else hi = mid
  }
  const span = ss[hi] - ss[lo]
  return { i: lo, k: span > 0 ? (s - ss[lo]) / span : 0 }
}

function wrap(path: CoursePath, s: number): number {
  if (!path.closed) return s
  const L = path.length
  return ((s % L) + L) % L
}

/**
 * 中心線の上で、スタートから s 進んだ所の位置と向き。offset は進む向きの左へずらす量（レーン）。
 * 輪でないコースでは、はじより外は はじの向きのまま まっすぐ のばす（スタートの うしろ・ゴールの さき）。
 */
export function pointAt(path: CoursePath, s: number, offset = 0): PathPoint {
  const { xs, zs } = path
  const last = xs.length - 1
  let x: number
  let z: number
  let heading: number
  const t = wrap(path, s)
  if (!path.closed && t <= 0) {
    heading = Math.atan2(xs[1] - xs[0], zs[1] - zs[0])
    x = xs[0] + Math.sin(heading) * t
    z = zs[0] + Math.cos(heading) * t
  } else if (!path.closed && t >= path.length) {
    heading = Math.atan2(xs[last] - xs[last - 1], zs[last] - zs[last - 1])
    x = xs[last] + Math.sin(heading) * (t - path.length)
    z = zs[last] + Math.cos(heading) * (t - path.length)
  } else {
    const { i, k } = locate(path, t)
    const j = Math.min(last, i + 1)
    x = xs[i] + (xs[j] - xs[i]) * k
    z = zs[i] + (zs[j] - zs[i]) * k
    // 向きは前後の点から決める（点のつなぎ目で向きが飛ばない）
    const a = Math.max(0, i - 1)
    const b = Math.min(last, i + 2)
    heading = Math.atan2(xs[b] - xs[a], zs[b] - zs[a])
  }
  // 進む向きの左（向き 0 で +x）
  return { x: x + Math.cos(heading) * offset, z: z - Math.sin(heading) * offset, heading }
}

/** その位置の曲がり具合（1m 進むあいだに向きが変わる量の大きさ、ラジアン/m）。前後 span m で測る。 */
export function curvatureAt(path: CoursePath, s: number, span = 3): number {
  const a = pointAt(path, s - span).heading
  const b = pointAt(path, s + span).heading
  return Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) / (2 * span)
}

/** 曲がり具合を step m ごとに測っておく（何度も引くときに速い）。 */
export type CurvatureTable = { step: number; values: Float32Array; closed: boolean; length: number }

export function curvatureTable(path: CoursePath, step = 0.5): CurvatureTable {
  const n = Math.ceil(path.length / step) + 1
  const values = new Float32Array(n)
  for (let i = 0; i < n; i++) values[i] = curvatureAt(path, i * step)
  return { step, values, closed: path.closed, length: path.length }
}

export function curvatureFrom(table: CurvatureTable, s: number): number {
  const t = table.closed ? ((s % table.length) + table.length) % table.length : s
  const i = Math.round(t / table.step)
  return table.values[Math.max(0, Math.min(table.values.length - 1, i))]
}
