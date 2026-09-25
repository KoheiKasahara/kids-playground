// 3D の だえんたい（たまご形）を くみあわせた もけいを、クォータービューの ドット絵に やきつける。
// 1ドットずつ 光を とばして あたった 面の むきから あかるさを きめ、
// パレットの だんかい（ランプ）と ベイヤーの あみかけで SFC ふうの 陰影に する。
// さいごに ふちどり（外がわは こい色、手前と おくの さかいめにも 線）を いれて 手で うった ような 絵に しあげる。

import { hash3, hex, makeCanvas, mix, packRgb, rampIndex, valueNoise3, type Rgb } from './pixel'

export type V3 = readonly [number, number, number]
/** 3x3 の 回転行列（行優先）。 */
export type M3 = readonly number[]

export type Prim = {
  /** 中心（もけいの 座標。+X が まえ、+Y が うえ）。 */
  c: V3
  /** 半径（ローカルの x, y, z）。 */
  r: V3
  /** ローカル → もけい の 回転。 */
  m?: M3
  mat: string
  /** はっぱの ような ギザギザの ふち（0〜1）。 */
  fuzz?: number
  /** 面の でこぼこ（0〜1）。 */
  bump?: number
}

export type Decal = {
  p: V3
  kind: 'eye' | 'bigEye' | 'closedEye' | 'dot' | 'shine'
  color?: string
}

export type Material = {
  ramp: readonly string[]
  /** 場所に よって ちがう 色（しまもよう など）を かえす。null なら そのまま。 */
  pattern?: (p: V3, n: V3) => string | null
  /** 光の あたりかたを つよく / よわく する。 */
  flat?: number
}

export type Model = {
  prims: Prim[]
  mats: Record<string, Material>
  decals?: Decal[]
}

export type SpriteImage = {
  canvas: HTMLCanvasElement | null
  w: number
  h: number
  /** もけいの 原点（あしもと）が くる ピクセル。 */
  ox: number
  oy: number
}

/** 1マス（1ユニット）あたりの ピクセル。2:1 の クォータービューに なる 大きさ。 */
export const UNIT = 16 * Math.SQRT2
const SIN = .5
const COS = Math.sqrt(3) / 2
const S2 = Math.SQRT1_2
/** 画面の みぎ・うえ・おく の むき（ワールド）。 */
export const CAM_R: V3 = [S2, 0, -S2]
export const CAM_U: V3 = [-SIN * S2, COS, -SIN * S2]
export const CAM_F: V3 = [-COS * S2, -SIN, -COS * S2]
/** ひだりうえ まえ から さす 光（カメラに たいして いつも 同じ）。 */
const LIGHT: V3 = norm(add(add(scale(CAM_R, -.5), scale(CAM_U, .78)), scale(CAM_F, -.42)))
const INK: Rgb = hex('#1b1226')

export function add(a: V3, b: V3): V3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]] }
export function sub(a: V3, b: V3): V3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]] }
export function scale(a: V3, k: number): V3 { return [a[0] * k, a[1] * k, a[2] * k] }
export function dot(a: V3, b: V3) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] }
export function norm(a: V3): V3 { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l] }

export const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]
export function rotX(a: number): M3 { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c] }
export function rotY(a: number): M3 { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c] }
/** Z じくまわり。+ で まえ（+X）が うえを むく。 */
export function rotZ(a: number): M3 { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1] }
export function mulM(a: M3, b: M3): M3 {
  const o: number[] = []
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o.push(a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j])
  return o
}
export function apply(m: M3, v: V3): V3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]
}
function applyT(m: M3, v: V3): V3 {
  return [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]]
}

/** もけいを まるごと k ばいに する。 */
export function scaleModel(model: Model, k: number): Model {
  const mats: Record<string, Material> = {}
  for (const [key, m] of Object.entries(model.mats)) {
    const pattern = m.pattern
    // もようは もとの 大きさの ざひょうで きめる。
    mats[key] = pattern ? { ...m, pattern: (p, n) => pattern(scale(p, 1 / k), n) } : m
  }
  return {
    ...model,
    mats,
    prims: model.prims.map(p => ({ ...p, c: scale(p.c, k), r: scale(p.r, k) })),
    decals: model.decals?.map(d => ({ ...d, p: scale(d.p, k) })),
  }
}

/** ワールドの 点 → 画面（原点からの ピクセル）。 */
export function project(p: V3): [number, number] {
  return [dot(p, CAM_R) * UNIT, -dot(p, CAM_U) * UNIT]
}

type Prepared = {
  prim: Prim
  m: M3
  bx0: number; bx1: number; by0: number; by1: number
  mat: number
}

/**
 * もけいを yaw（Y じくまわりの むき。0 で +X が 画面の みぎした）で やきつける。
 * canvas が つかえない ところでは canvas が null に なる（大きさだけ わかる）。
 */
export function renderModel(model: Model, yaw: number): SpriteImage {
  // カメラの むきを もけいの 座標へ もっていく（もけいを まわす かわり）。
  const toObj = rotY(-yaw)
  const R = apply(toObj, CAM_R), U = apply(toObj, CAM_U), F = apply(toObj, CAM_F), L = apply(toObj, LIGHT)
  const matKeys = Object.keys(model.mats)
  const matIndex = new Map(matKeys.map((k, i) => [k, i]))
  const ramps = matKeys.map(k => model.mats[k].ramp.map(hex))

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const prepared: Prepared[] = model.prims.map(prim => {
    const rad = Math.max(prim.r[0], prim.r[1], prim.r[2]) * UNIT
    const sx = dot(prim.c, R) * UNIT, sy = -dot(prim.c, U) * UNIT
    const p: Prepared = { prim, m: prim.m ?? I3, bx0: sx - rad - 1, bx1: sx + rad + 1, by0: sy - rad - 1, by1: sy + rad + 1, mat: matIndex.get(prim.mat) ?? 0 }
    minX = Math.min(minX, p.bx0); maxX = Math.max(maxX, p.bx1); minY = Math.min(minY, p.by0); maxY = Math.max(maxY, p.by1)
    return p
  })
  const ox = Math.ceil(-minX) + 2, oy = Math.ceil(-minY) + 2
  const w = Math.max(1, Math.ceil(maxX) + ox + 2), h = Math.max(1, Math.ceil(maxY) + oy + 2)

  const n = w * h
  const depth = new Float32Array(n).fill(Infinity)
  const mats = new Int16Array(n).fill(-1)
  const color = new Uint32Array(n)

  for (let j = 0; j < h; j++) {
    const sy = j - oy + .5
    for (let i = 0; i < w; i++) {
      const sx = i - ox + .5
      // 画面の この ドットを とおる 光線（まっすぐ おくへ）。
      const o: V3 = [
        R[0] * sx / UNIT - U[0] * sy / UNIT - F[0] * 20,
        R[1] * sx / UNIT - U[1] * sy / UNIT - F[1] * 20,
        R[2] * sx / UNIT - U[2] * sy / UNIT - F[2] * 20,
      ]
      let best = Infinity, bestP: Prepared | null = null, bestN: V3 = [0, 1, 0], bestHit: V3 = [0, 0, 0]
      for (const pp of prepared) {
        if (sx < pp.bx0 || sx > pp.bx1 || sy < pp.by0 || sy > pp.by1) continue
        const { prim, m } = pp
        const lo = applyT(m, sub(o, prim.c))
        const ld = applyT(m, F)
        const oo: V3 = [lo[0] / prim.r[0], lo[1] / prim.r[1], lo[2] / prim.r[2]]
        const dd: V3 = [ld[0] / prim.r[0], ld[1] / prim.r[1], ld[2] / prim.r[2]]
        const a = dot(dd, dd), b = 2 * dot(oo, dd), c = dot(oo, oo) - 1
        const disc = b * b - 4 * a * c
        if (disc < 0) continue
        const sq = Math.sqrt(disc)
        let t = (-b - sq) / (2 * a)
        if (t >= best) continue
        let q: V3 = add(oo, scale(dd, t))
        let nrm = norm(apply(m, [q[0] / prim.r[0], q[1] / prim.r[1], q[2] / prim.r[2]]))
        if (prim.fuzz) {
          // ふちの ほうを ところどころ ぬいて、はっぱの ギザギザに する。
          const facing = -dot(nrm, F)
          const hit = add(o, scale(F, t))
          const k = hash3(Math.floor(hit[0] * 9), Math.floor(hit[1] * 9), Math.floor(hit[2] * 9), 7)
          if (facing < .5 && k < prim.fuzz * (1 - facing * 1.6)) {
            // うらがわ（おくの 面）を つかう。
            t = (-b + sq) / (2 * a)
            if (t >= best) continue
            q = add(oo, scale(dd, t))
            nrm = scale(norm(apply(m, [q[0] / prim.r[0], q[1] / prim.r[1], q[2] / prim.r[2]])), -1)
            if (k < prim.fuzz * .45) continue
          }
        }
        best = t
        bestP = pp
        bestN = nrm
        bestHit = add(o, scale(F, t))
      }
      if (!bestP) continue
      const idx = j * w + i
      depth[idx] = best
      let matId = bestP.mat
      const material = model.mats[matKeys[matId]]
      if (material?.pattern) {
        const other = material.pattern(bestHit, bestN)
        if (other && matIndex.has(other)) matId = matIndex.get(other)!
      }
      mats[idx] = matId
      let nn = bestN
      if (bestP.prim.bump) {
        const k = bestP.prim.bump, f = 7
        nn = norm([
          nn[0] + (valueNoise3(bestHit[0] * f, bestHit[1] * f, bestHit[2] * f, 11) - .5) * k * 2,
          nn[1] + (valueNoise3(bestHit[0] * f + 9, bestHit[1] * f, bestHit[2] * f, 12) - .5) * k * 2,
          nn[2] + (valueNoise3(bestHit[0] * f, bestHit[1] * f + 5, bestHit[2] * f, 13) - .5) * k * 2,
        ])
      }
      const flat = model.mats[matKeys[matId]]?.flat ?? 1
      const lit = Math.max(0, dot(nn, L))
      const v = .5 + (lit * 1.05 - .42 + nn[1] * .12) * flat
      const ri = rampIndex(v, 5, i, j, .38)
      color[idx] = packRgb(ramps[matId][ri])
    }
  }

  // ---- ふちどり ----
  const out = new Uint32Array(color)
  const THRESH = .3
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = j * w + i
      if (mats[idx] < 0) {
        // 外がわ：となりに 絵が あれば こい 線。ひかりの あたる がわ（うえ・ひだり）は すこし あかるく。
        let nb = -1, nbD = Infinity, lit = false
        const check = (x: number, y: number, fromLit: boolean) => {
          if (x < 0 || y < 0 || x >= w || y >= h) return
          const k = y * w + x
          if (mats[k] >= 0 && depth[k] < nbD) { nb = k; nbD = depth[k]; lit = fromLit }
        }
        check(i, j + 1, true); check(i + 1, j, true); check(i, j - 1, false); check(i - 1, j, false)
        if (nb >= 0) {
          const base = ramps[mats[nb]][0]
          out[idx] = packRgb(lit ? mix(base, INK, .45) : mix(base, INK, .72))
        }
        continue
      }
      // 内がわ：手前に ある ものとの さかいめに 線を いれる。
      const d = depth[idx]
      let edge = false
      for (const [x, y] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue
        const k = y * w + x
        if (mats[k] >= 0 && depth[k] < d - THRESH) { edge = true; break }
      }
      if (edge) out[idx] = packRgb(mix(ramps[mats[idx]][0], INK, .35))
    }
  }

  // ---- め・はな などの こまかい ドット ----
  for (const decal of model.decals ?? []) {
    const sx = dot(decal.p, R) * UNIT, sy = -dot(decal.p, U) * UNIT
    const px = Math.floor(sx + ox), py = Math.floor(sy + oy)
    if (px < 0 || py < 0 || px >= w || py >= h) continue
    const idx = py * w + px
    const eyeDepth = dot(decal.p, F) + 20
    if (mats[idx] < 0 || eyeDepth > depth[idx] + .1) continue
    const ink = packRgb(decal.color ? hex(decal.color) : INK)
    const put = (x: number, y: number, c: number) => { if (x >= 0 && y >= 0 && x < w && y < h && mats[y * w + x] >= 0) out[y * w + x] = c }
    if (decal.kind === 'eye') { put(px, py, ink); put(px, py + 1, ink) }
    else if (decal.kind === 'bigEye') { put(px, py, ink); put(px, py + 1, ink); put(px + 1, py, ink); put(px + 1, py + 1, ink); put(px, py, packRgb([255, 255, 255])) }
    else if (decal.kind === 'closedEye') { put(px, py + 1, ink); put(px + 1, py + 1, ink); put(px - 1, py, ink) }
    else if (decal.kind === 'shine') put(px, py, ink)
    else put(px, py, ink)
  }

  const made = makeCanvas(w, h)
  if (made) {
    const img = made.ctx.createImageData(w, h)
    new Uint32Array(img.data.buffer).set(out)
    made.ctx.putImageData(img, 0, 0)
  }
  return { canvas: made?.canvas ?? null, w, h, ox, oy }
}
