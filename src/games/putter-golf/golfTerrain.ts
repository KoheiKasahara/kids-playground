/**
 * コースの まわりの じめんの おかと、いけ・かわの くぼみの 形（見た目だけ）。
 *
 * 物理の床（golfGeometry）には さわらない。ボールが ころがる床は これまでどおり たいらで、
 * ここで作る高さは 景色と みずの 見た目だけに使う。Three.js にも DOM にも依存しないので、
 * 「コースの 下や すぐそばは もりあがらない」「みずの ふちは 床と つながる」をテストで確かめられる。
 */
import type { Vec2, WaterHazard } from './golfCourses'

/** コースを かこむ 四角（上から見た わく）。 */
export type Frame = { minX: number; maxX: number; minZ: number; maxZ: number }

export type TerrainStyle =
  /** なだらかな おか。channel を わたすと、その z の まわりだけ たいらに のこす（大きな かわの ながれる ところ）。 */
  | { kind: 'rolling'; hills: number; channel?: { z: number; halfWidth: number } }
  /** たにま。コースの よこ（x の そと）に だんだんの がけが そびえる。コースの 下と まえ・うしろは たにの そこ。 */
  | { kind: 'canyon'; wall: number }

const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function lattice(i: number, j: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** 決まった でこぼこ（0〜1）。同じ場所なら いつも 同じ値になる。 */
export function valueNoise(x: number, z: number): number {
  const i = Math.floor(x)
  const j = Math.floor(z)
  const fx = x - i
  const fz = z - j
  const u = fx * fx * (3 - 2 * fx)
  const v = fz * fz * (3 - 2 * fz)
  const a = lattice(i, j)
  const b = lattice(i + 1, j)
  const c = lattice(i, j + 1)
  const d = lattice(i + 1, j + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/** 大きな でこぼこに 小さな でこぼこを かさねた値（0〜1）。 */
export function layeredNoise(x: number, z: number): number {
  return (valueNoise(x, z) * 4 + valueNoise(x * 2.03 + 17.1, z * 2.03 - 5.3) * 2 + valueNoise(x * 4.1 - 3.7, z * 4.1 + 9.2)) / 7
}

/** わくの そとへ どれだけ はなれているか。わくの 中は 0。 */
function outside(frame: Frame, x: number, z: number): number {
  const dx = Math.max(frame.minX - x, 0, x - frame.maxX)
  const dz = Math.max(frame.minZ - z, 0, z - frame.maxZ)
  return Math.hypot(dx, dz)
}

/**
 * まわりの じめんの 高さ（じめんの 基準から 上へ 何m か）。
 * コースの わくから margin までは 0 のまま（コースの 台に めりこまない）で、その先で もりあがる。
 */
export function createTerrainHeight(frame: Frame, style: TerrainStyle, margin = 2.5): (x: number, z: number) => number {
  if (style.kind === 'canyon') {
    const center = (frame.minX + frame.maxX) / 2
    const half = (frame.maxX - frame.minX) / 2 + margin
    return (x, z) => {
      // がけの ふちは まっすぐに しない。前後に すこし うねらせる。
      const wobble = (valueNoise(z * 0.12 + 3.1, x > center ? 7.7 : 1.3) - 0.5) * 3
      const away = Math.max(0, Math.abs(x - center) - half - 1.5 + wobble)
      // 3だんの だんだん。だんの きわで 急に 上がり、だんの 上は ほぼ たいら。
      const t = smoothstep(0, 16, away) * 3
      const step = Math.floor(Math.min(2.999, t))
      const rise = (step + smoothstep(0.35, 0.95, t - step)) / 3
      return style.wall * rise * (0.92 + 0.16 * layeredNoise(x * 0.07, z * 0.07))
    }
  }
  return (x, z) => {
    const away = outside(frame, x, z) - margin
    if (away <= 0) return 0
    const near = smoothstep(0, 12, away) * style.hills * (0.45 + 0.55 * layeredNoise(x * 0.09, z * 0.09))
    const far = smoothstep(14, 70, away) * style.hills * 4 * (0.55 + 0.45 * layeredNoise(x * 0.035 + 11, z * 0.035 - 4))
    const height = near + far
    if (!style.channel) return height
    return height * smoothstep(style.channel.halfWidth, style.channel.halfWidth + 6, Math.abs(z - style.channel.z))
  }
}

function segmentDistance(x: number, z: number, from: Vec2, to: Vec2): number {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const t = Math.min(1, Math.max(0, ((x - from.x) * dx + (z - from.z) * dz) / (dx * dx + dz * dz || 1)))
  return Math.hypot(x - (from.x + dx * t), z - (from.z + dz * t))
}

function insidePolygon(x: number, z: number, points: readonly Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!
    const b = points[j]!
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

/**
 * みずの 中へ どれだけ 入っているか（ふちで 0、中ほど 大きい。そとは 負）。
 * 物理の「みずの上か」（golfGeometry の waterAt）と 同じ形を使う。はしは 見た目では みずの 上に かかる。
 */
export function waterInside(water: readonly WaterHazard[], x: number, z: number): number {
  let best = -Infinity
  for (const item of water) {
    if (item.kind === 'pond') {
      best = Math.max(best, item.radius - Math.hypot(x - item.x, z - item.z))
      continue
    }
    const dx = item.to.x - item.from.x
    const dz = item.to.z - item.from.z
    const length = Math.hypot(dx, dz) || 1
    const along = ((x - item.from.x) * dx + (z - item.from.z) * dz) / length
    const side = Math.abs((x - item.from.x) * dz - (z - item.from.z) * dx) / length
    best = Math.max(best, Math.min(item.halfWidth - side, along, length - along))
  }
  return best
}

/**
 * いけ・かわの くぼみの ふかさ（0〜depth）。みずの ふちと 床の はし（かべの ねもと）では 0 で、
 * bank の はばで なだらかに ふかくなる。くぼみの ふちが 床と すきまなく つながるようにするため。
 */
export function createWaterDepth(water: readonly WaterHazard[], outlines: readonly (readonly Vec2[])[], depth: number, bank: number): (x: number, z: number) => number {
  return (x, z) => {
    const inWater = waterInside(water, x, z)
    if (inWater <= 0) return 0
    const outline = outlines.find(points => insidePolygon(x, z, points))
    if (!outline) return 0
    let edge = Infinity
    for (let i = 0; i < outline.length; i++) edge = Math.min(edge, segmentDistance(x, z, outline[i]!, outline[(i + 1) % outline.length]!))
    return depth * smoothstep(0, bank, Math.min(inWater, edge))
  }
}
