/**
 * ぴたっと じしゃく に でてくる もの。
 * 大きさは ワールドの 単位（スマホの たて画面で だいたい 1単位 = 1px）。
 * 「じしゃくに くっつくか」は ほんものの そざいに あわせる（てつ・はがね は くっつく、
 * き・ゴム・ガラス・どう・アルミ・プラスチック は くっつかない）。
 */

export type Vec = { x: number; y: number }

export type Shape =
  | { type: 'rect'; w: number; h: number; chamfer?: number }
  | { type: 'circle'; r: number }
  | { type: 'poly'; points: readonly Vec[] }

/** ぶつかった ときの おとの ちがい。 */
export type Material = 'metal' | 'wood' | 'soft' | 'glass' | 'plastic'

export type KindId =
  | 'clip' | 'nail' | 'screw' | 'nut' | 'bolt' | 'pin' | 'spring' | 'gear' | 'ball' | 'steelcan' | 'star' | 'fish' | 'anchor'
  | 'pencil' | 'eraser' | 'crayon' | 'block' | 'marble' | 'acorn' | 'alcan' | 'coin' | 'shell' | 'pebble' | 'shovel'
  | 'duck' | 'boot' | 'starfish' | 'jelly'

export type ItemKind = {
  id: KindId
  /** ひらがなの なまえ（けっか がめんで つかう）。 */
  name: string
  /** なにで できているか（けっか がめんの ひとこと）。 */
  made: string
  magnetic: boolean
  material: Material
  shape: Shape
  density: number
  friction: number
  restitution: number
  /** じしゃくの ちからが かかる ばしょ（ものの なかの てん）。 */
  hot: readonly Vec[]
  /** hot から ものの ふちまでの きょり。 */
  hotR: number
  /** ひっぱられやすさ（かるい ものほど おおきい）。 */
  pull: number
  /** みずの なかでの うきやすさ（1より おおきいと うく）。 */
  buoyancy: number
  /** いろちがいの かず。 */
  variants: number
}

function rectCorners(w: number, h: number): Vec[] {
  return [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }]
}

function ngon(n: number, r: number, start = -Math.PI / 2): Vec[] {
  return Array.from({ length: n }, (_, i) => {
    const a = start + (i / n) * Math.PI * 2
    return { x: Math.cos(a) * r, y: Math.sin(a) * r }
  })
}

/** おもさの まんなか（面積の重心）が (0, 0) に くるように ずらす。物理の からだと 絵を そろえるため。 */
function centered(points: readonly Vec[]): Vec[] {
  let area = 0, cx = 0, cy = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    const cross = a.x * b.y - b.x * a.y
    area += cross
    cx += (a.x + b.x) * cross
    cy += (a.y + b.y) * cross
  }
  area /= 2
  if (Math.abs(area) < 1e-6) return [...points]
  cx /= 6 * area
  cy /= 6 * area
  return points.map((p) => ({ x: p.x - cx, y: p.y - cy }))
}

const base = { friction: 0.6, restitution: 0.12, buoyancy: 0.45, variants: 1 }

export const KINDS: Record<KindId, ItemKind> = {
  // ---------------- てつ・はがね（くっつく） ----------------
  clip: {
    ...base, id: 'clip', name: 'クリップ', made: 'てつ', magnetic: true, material: 'metal',
    shape: { type: 'rect', w: 26, h: 9, chamfer: 4 }, density: 0.004, hot: [{ x: -9, y: 0 }, { x: 9, y: 0 }], hotR: 4.5, pull: 1.25, variants: 4,
  },
  nail: {
    ...base, id: 'nail', name: 'くぎ', made: 'てつ', magnetic: true, material: 'metal',
    shape: { type: 'rect', w: 34, h: 6, chamfer: 2 }, density: 0.006, hot: [{ x: -14, y: 0 }, { x: 0, y: 0 }, { x: 14, y: 0 }], hotR: 3.5, pull: 1.05,
  },
  screw: {
    ...base, id: 'screw', name: 'ねじ', made: 'てつ', magnetic: true, material: 'metal',
    shape: { type: 'rect', w: 26, h: 9, chamfer: 2 }, density: 0.006, hot: [{ x: -9, y: 0 }, { x: 9, y: 0 }], hotR: 4.5, pull: 1.1,
  },
  nut: {
    ...base, id: 'nut', name: 'ナット', made: 'てつ', magnetic: true, material: 'metal',
    shape: { type: 'poly', points: ngon(6, 9, 0) }, density: 0.006, hot: [{ x: 0, y: 0 }], hotR: 8, pull: 1.1,
  },
  bolt: {
    ...base, id: 'bolt', name: 'ボルト', made: 'てつ', magnetic: true, material: 'metal',
    shape: { type: 'rect', w: 32, h: 11, chamfer: 2 }, density: 0.006, hot: [{ x: -11, y: 0 }, { x: 10, y: 0 }], hotR: 5, pull: 0.95,
  },
  pin: {
    ...base, id: 'pin', name: 'あんぜんピン', made: 'てつ', magnetic: true, material: 'metal',
    shape: { type: 'rect', w: 30, h: 9, chamfer: 4 }, density: 0.004, hot: [{ x: -11, y: 0 }, { x: 11, y: 0 }], hotR: 4.5, pull: 1.2, variants: 3,
  },
  spring: {
    ...base, id: 'spring', name: 'ばね', made: 'てつ', magnetic: true, material: 'metal',
    shape: { type: 'rect', w: 24, h: 12, chamfer: 5 }, density: 0.005, hot: [{ x: -8, y: 0 }, { x: 8, y: 0 }], hotR: 6, pull: 1.1, restitution: 0.4,
  },
  gear: {
    ...base, id: 'gear', name: 'はぐるま', made: 'てつ', magnetic: true, material: 'metal',
    shape: { type: 'circle', r: 11 }, density: 0.006, hot: [{ x: 0, y: 0 }], hotR: 11, pull: 1.05, friction: 0.5,
  },
  ball: {
    ...base, id: 'ball', name: 'てっきゅう', made: 'てつ', magnetic: true, material: 'metal',
    shape: { type: 'circle', r: 7 }, density: 0.008, hot: [{ x: 0, y: 0 }], hotR: 7, pull: 1.2, friction: 0.08, restitution: 0.3,
  },
  steelcan: {
    ...base, id: 'steelcan', name: 'スチールかん', made: 'てつ', magnetic: true, material: 'metal',
    shape: { type: 'rect', w: 26, h: 40, chamfer: 3 }, density: 0.0025, hot: [{ x: 0, y: -13 }, { x: 0, y: 13 }], hotR: 13, pull: 0.85, buoyancy: 0.7,
  },
  star: {
    ...base, id: 'star', name: 'ほしバッジ', made: 'てつ', magnetic: true, material: 'metal',
    shape: { type: 'poly', points: ngon(5, 12) }, density: 0.004, hot: [{ x: 0, y: 0 }], hotR: 9, pull: 1.3,
  },
  fish: {
    ...base, id: 'fish', name: 'さかな', made: 'くちに てつの わ', magnetic: true, material: 'plastic',
    shape: { type: 'rect', w: 38, h: 18, chamfer: 8 }, density: 0.0018, hot: [{ x: 19, y: 0 }], hotR: 4, pull: 1.35, buoyancy: 0.9, variants: 4,
  },
  anchor: {
    ...base, id: 'anchor', name: 'いかり', made: 'てつ', magnetic: true, material: 'metal',
    shape: { type: 'rect', w: 26, h: 30, chamfer: 6 }, density: 0.005, hot: [{ x: 0, y: -11 }, { x: 0, y: 11 }], hotR: 5, pull: 0.95,
  },

  // ---------------- くっつかない もの ----------------
  pencil: {
    ...base, id: 'pencil', name: 'えんぴつ', made: 'き', magnetic: false, material: 'wood',
    shape: { type: 'rect', w: 54, h: 8, chamfer: 2 }, density: 0.0012, hot: [], hotR: 0, pull: 0, variants: 3, buoyancy: 1.6,
  },
  eraser: {
    ...base, id: 'eraser', name: 'けしゴム', made: 'ゴム', magnetic: false, material: 'soft',
    shape: { type: 'rect', w: 26, h: 14, chamfer: 3 }, density: 0.0016, hot: [], hotR: 0, pull: 0, friction: 0.9, restitution: 0.25,
  },
  crayon: {
    ...base, id: 'crayon', name: 'クレヨン', made: 'ろう', magnetic: false, material: 'soft',
    shape: { type: 'rect', w: 34, h: 9, chamfer: 3 }, density: 0.0012, hot: [], hotR: 0, pull: 0, variants: 3,
  },
  block: {
    ...base, id: 'block', name: 'つみき', made: 'き', magnetic: false, material: 'wood',
    shape: { type: 'rect', w: 24, h: 24, chamfer: 3 }, density: 0.0011, hot: [], hotR: 0, pull: 0, variants: 3, buoyancy: 1.8,
  },
  marble: {
    ...base, id: 'marble', name: 'ビーだま', made: 'ガラス', magnetic: false, material: 'glass',
    shape: { type: 'circle', r: 7.5 }, density: 0.0025, hot: [], hotR: 0, pull: 0, friction: 0.06, restitution: 0.35, variants: 2,
  },
  acorn: {
    ...base, id: 'acorn', name: 'どんぐり', made: 'きのみ', magnetic: false, material: 'wood',
    shape: { type: 'circle', r: 8 }, density: 0.0012, hot: [], hotR: 0, pull: 0, friction: 0.3,
  },
  alcan: {
    ...base, id: 'alcan', name: 'アルミかん', made: 'アルミ', magnetic: false, material: 'metal',
    shape: { type: 'rect', w: 26, h: 40, chamfer: 3 }, density: 0.0008, hot: [], hotR: 0, pull: 0, buoyancy: 0.55,
  },
  coin: {
    ...base, id: 'coin', name: 'どうの コイン', made: 'どう', magnetic: false, material: 'metal',
    shape: { type: 'rect', w: 22, h: 5, chamfer: 2 }, density: 0.006, hot: [], hotR: 0, pull: 0,
  },
  shell: {
    ...base, id: 'shell', name: 'かいがら', made: 'かい', magnetic: false, material: 'glass',
    shape: { type: 'poly', points: centered([{ x: -12, y: 6 }, { x: -9, y: -3 }, { x: -3, y: -8 }, { x: 3, y: -8 }, { x: 9, y: -3 }, { x: 12, y: 6 }]) }, density: 0.002, hot: [], hotR: 0, pull: 0, variants: 2,
  },
  pebble: {
    ...base, id: 'pebble', name: 'いし', made: 'いし', magnetic: false, material: 'glass',
    shape: { type: 'poly', points: centered([{ x: -12, y: 5 }, { x: -10, y: -3 }, { x: -3, y: -7 }, { x: 6, y: -6 }, { x: 12, y: 0 }, { x: 10, y: 6 }]) }, density: 0.003, hot: [], hotR: 0, pull: 0, variants: 2,
  },
  shovel: {
    ...base, id: 'shovel', name: 'スコップ', made: 'プラスチック', magnetic: false, material: 'plastic',
    shape: { type: 'rect', w: 46, h: 12, chamfer: 4 }, density: 0.0009, hot: [], hotR: 0, pull: 0, variants: 2,
  },
  duck: {
    ...base, id: 'duck', name: 'ゴムの アヒル', made: 'ゴム', magnetic: false, material: 'soft',
    shape: { type: 'poly', points: centered([{ x: -14, y: 10 }, { x: -15, y: 0 }, { x: 2, y: -15 }, { x: 11, y: -12 }, { x: 15, y: 2 }, { x: 12, y: 10 }]) }, density: 0.0006, hot: [], hotR: 0, pull: 0, buoyancy: 3,
  },
  boot: {
    ...base, id: 'boot', name: 'ながぐつ', made: 'ゴム', magnetic: false, material: 'soft',
    shape: { type: 'poly', points: centered([{ x: -10, y: -17 }, { x: 6, y: -17 }, { x: 16, y: 6 }, { x: 16, y: 17 }, { x: -10, y: 17 }]) }, density: 0.0016, hot: [], hotR: 0, pull: 0, buoyancy: 0.5,
  },
  starfish: {
    ...base, id: 'starfish', name: 'ひとで', made: 'いきもの', magnetic: false, material: 'soft',
    shape: { type: 'poly', points: ngon(5, 12) }, density: 0.0016, hot: [], hotR: 0, pull: 0, buoyancy: 0.4,
  },
  jelly: {
    ...base, id: 'jelly', name: 'くらげ', made: 'いきもの', magnetic: false, material: 'soft',
    shape: { type: 'circle', r: 13 }, density: 0.0008, hot: [], hotR: 0, pull: 0, buoyancy: 1,
  },
}

/** かたちの かどの てん（ローカル）。ひっかかり・かげ・ゆかの あたりに つかう。 */
export function shapePoints(shape: Shape): Vec[] {
  if (shape.type === 'rect') return rectCorners(shape.w, shape.h)
  if (shape.type === 'circle') return ngon(8, shape.r)
  return [...shape.points]
}

/** かたちの ちょっけいの はんぶん（だいたい）。 */
export function shapeRadius(shape: Shape): number {
  if (shape.type === 'circle') return shape.r
  return Math.max(...shapePoints(shape).map((p) => Math.hypot(p.x, p.y)))
}

/** かたちの たかさ（おいた ときの）。 */
export function shapeHeight(shape: Shape): number {
  if (shape.type === 'rect') return shape.h
  if (shape.type === 'circle') return shape.r * 2
  const ys = shape.points.map((p) => p.y)
  return Math.max(...ys) - Math.min(...ys)
}
