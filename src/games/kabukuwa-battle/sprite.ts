// 立体の もけい（model.ts）を、えらんだ むきから みた ドット絵に やきつける。
// 1ドットずつ まっすぐ 光を とばして いちばん てまえの だえんたいを みつけ、
// 面の むきで あかるさを きめて パレットの だんかいと ベイヤーの あみかけで ぬる。
// つやつやの せなかには ひかりの てんを いれ、さいごに ふちどりを つける。

import { buildBeetle, dot, norm, type MatKey, type Pose, type Prim } from './model'
import { bayer, ditherIndex, hash2, hex, makeCanvas, packRgb, type Img, type Rgb } from './pixel'
import type { Ramp, Species, V3 } from './species'

export type Sprite = {
  canvas: Img | null
  w: number
  h: number
  /** もけいの 原点（からだの まんなかの 地面）が くる ドット。 */
  ox: number
  oy: number
}

/** カメラ。yaw は もけいの むき（0 で 画面の みぎを むく）、elevation は みおろす 角度。 */
export type View = { yaw: number; elevation: number }

/** 画面の みぎ・うえ・おく を、もけいの ざひょうで あらわす。 */
export function cameraBasis(view: View) {
  const ce = Math.cos(view.elevation), se = Math.sin(view.elevation)
  const cy = Math.cos(-view.yaw), sy = Math.sin(-view.yaw)
  const rz = (v: V3): V3 => [v[0] * cy - v[1] * sy, v[0] * sy + v[1] * cy, v[2]]
  return { R: rz([1, 0, 0]), U: rz([0, se, ce]), F: rz([0, ce, -se]) }
}

const INK = hex('#0c0806')
const EYE: Ramp = ['#000000', '#141414', '#2c2c2c', '#606060']
const HAIR: Ramp = ['#4a280c', '#7a4618', '#a8682a', '#d0944a']

type Mat = { ramp: Rgb[]; gloss: number }

function rampRgb(ramp: Ramp) { return ramp.map(hex) }

function materialsOf(sp: Species): Record<MatKey, Mat> {
  const look = sp.look
  const shell = look.pattern === 'fuzz' ? .25 : look.pattern === 'metal' ? 1.1 : .85
  return {
    elytra: { ramp: rampRgb(look.elytra), gloss: shell },
    pron: { ramp: rampRgb(look.pronotum), gloss: shell },
    horn: { ramp: rampRgb(look.horn), gloss: .8 },
    leg: { ramp: rampRgb(look.leg), gloss: .3 },
    belly: { ramp: rampRgb(look.leg), gloss: .2 },
    eye: { ramp: rampRgb(EYE), gloss: 1 },
    hair: { ramp: rampRgb(HAIR), gloss: 0 },
  }
}

/** はねの もよう。もようの いろを つかうなら true。lp は だえんたいの なかの ざひょう（-1〜1）。 */
function patternHit(sp: Species, lp: V3, px: number, py: number) {
  switch (sp.look.pattern) {
    case 'spots': {
      // ヘラクレス・グラント: くろい てんてん（ひだり・みぎ おなじ もよう）。
      const gx = lp[0] * 3.1 + 7, gy = Math.abs(lp[1]) * 2.4 + .3
      const cx = Math.floor(gx), cy = Math.floor(gy)
      if (hash2(cx, cy, 11) > .62) return false
      const ox = .5 + (hash2(cx, cy, 12) - .5) * .4, oy = .5 + (hash2(cx, cy, 13) - .5) * .4
      const r = .2 + hash2(cx, cy, 14) * .16
      return (gx - cx - ox) ** 2 + (gy - cy - oy) ** 2 < r * r
    }
    case 'fuzz': return hash2(Math.round(lp[0] * 40), Math.round(lp[1] * 40) + Math.round(lp[2] * 40) * 97, 5) < .34 + bayer(px, py) * .1
    case 'gold': return hash2(Math.round(lp[0] * 30), Math.round(lp[1] * 30) + Math.round(lp[2] * 30) * 61, 9) < .16
    case 'rainbow': return lp[0] * .8 + lp[2] * .35 + (bayer(px, py) - .5) * .35 > .12
    default: return false
  }
}

/** もけいを ドット絵に する。 */
export function renderModel(sp: Species, prims: readonly Prim[], view: View): Sprite {
  const { R, U, F } = cameraBasis(view)
  const light = norm([-.45 * R[0] + .78 * U[0] - .48 * F[0], -.45 * R[1] + .78 * U[1] - .48 * F[1], -.45 * R[2] + .78 * U[2] - .48 * F[2]])
  const half = norm([light[0] - F[0], light[1] - F[1], light[2] - F[2]])
  const mats = materialsOf(sp)
  const accent = sp.look.accent ? rampRgb(sp.look.accent) : null

  // だえんたいごとに、画面での はんいと、光の しきの けいすうを まえもって けいさん。
  type Pre = { x0: number; x1: number; y0: number; y1: number; A: V3; BX: V3; BY: V3; D: V3; a: number }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const pre: Pre[] = prims.map(p => {
    const sx = dot(p.c, R), sy = -dot(p.c, U)
    const rad = Math.max(p.r[0], p.r[1], p.r[2]) + .5
    const local = (v: V3): V3 => {
      // もけい → ローカル（回転の ぎゃく）→ はんけいで わる。
      const x = p.m[0] * v[0] + p.m[3] * v[1] + p.m[6] * v[2]
      const y = p.m[1] * v[0] + p.m[4] * v[1] + p.m[7] * v[2]
      const z = p.m[2] * v[0] + p.m[5] * v[1] + p.m[8] * v[2]
      return [x / p.r[0], y / p.r[1], z / p.r[2]]
    }
    const far = 1000
    const A = local([-F[0] * far - p.c[0], -F[1] * far - p.c[1], -F[2] * far - p.c[2]])
    const BX = local(R)
    const BY = local([-U[0], -U[1], -U[2]])
    const D = local(F)
    const entry: Pre = { x0: sx - rad, x1: sx + rad, y0: sy - rad, y1: sy + rad, A, BX, BY, D, a: dot(D, D) }
    minX = Math.min(minX, entry.x0); maxX = Math.max(maxX, entry.x1); minY = Math.min(minY, entry.y0); maxY = Math.max(maxY, entry.y1)
    return entry
  })
  if (!pre.length) return { canvas: null, w: 1, h: 1, ox: 0, oy: 0 }
  const ox = Math.ceil(-minX) + 2, oy = Math.ceil(-minY) + 2
  const w = Math.ceil(maxX) + ox + 3, h = Math.ceil(maxY) + oy + 3
  // canvas が つかえない ところ（テスト）では 大きさだけ かえす。
  const made = makeCanvas(w, h)
  if (!made) return { canvas: null, w, h, ox, oy }
  const n = w * h
  const depth = new Float32Array(n).fill(Infinity)
  const owner = new Int16Array(n).fill(-1)

  pre.forEach((e, index) => {
    const i0 = Math.max(0, Math.floor(e.x0 + ox)), i1 = Math.min(w - 1, Math.ceil(e.x1 + ox))
    const j0 = Math.max(0, Math.floor(e.y0 + oy)), j1 = Math.min(h - 1, Math.ceil(e.y1 + oy))
    for (let j = j0; j <= j1; j++) {
      const Y = j - oy + .5
      for (let i = i0; i <= i1; i++) {
        const X = i - ox + .5
        const o0 = e.A[0] + e.BX[0] * X + e.BY[0] * Y
        const o1 = e.A[1] + e.BX[1] * X + e.BY[1] * Y
        const o2 = e.A[2] + e.BX[2] * X + e.BY[2] * Y
        const b = 2 * (o0 * e.D[0] + o1 * e.D[1] + o2 * e.D[2])
        const c = o0 * o0 + o1 * o1 + o2 * o2 - 1
        const disc = b * b - 4 * e.a * c
        if (disc < 0) continue
        const t = (-b - Math.sqrt(disc)) / (2 * e.a)
        const k = j * w + i
        if (t < depth[k]) { depth[k] = t; owner[k] = index }
      }
    }
  })

  const image = made.ctx.createImageData(w, h)
  const out = new Uint32Array(image.data.buffer)
  for (let k = 0; k < n; k++) {
    const index = owner[k]
    if (index < 0) continue
    const i = k % w, j = (k - i) / w
    const e = pre[index], p = prims[index]
    const X = i - ox + .5, Y = j - oy + .5, t = depth[k]
    const lp: V3 = [
      e.A[0] + e.BX[0] * X + e.BY[0] * Y + e.D[0] * t,
      e.A[1] + e.BX[1] * X + e.BY[1] * Y + e.D[1] * t,
      e.A[2] + e.BX[2] * X + e.BY[2] * Y + e.D[2] * t,
    ]
    // だえんたいの 面の むき（ローカル → もけい）。
    const nl: V3 = [lp[0] / p.r[0], lp[1] / p.r[1], lp[2] / p.r[2]]
    const nm = norm([
      p.m[0] * nl[0] + p.m[1] * nl[1] + p.m[2] * nl[2],
      p.m[3] * nl[0] + p.m[4] * nl[1] + p.m[5] * nl[2],
      p.m[6] * nl[0] + p.m[7] * nl[1] + p.m[8] * nl[2],
    ])
    const mat = mats[p.mat]
    let ramp = mat.ramp
    let gloss = mat.gloss
    if (p.pattern) {
      const seam = sp.look.pattern !== 'fuzz' && Math.abs(lp[1]) < .05 && lp[2] > 0
      if (accent && patternHit(sp, lp, i, j)) {
        ramp = accent
        if (sp.look.pattern === 'fuzz' || sp.look.pattern === 'gold') gloss = 0
      }
      if (seam) { out[k] = packRgb(ramp[0]); continue }
    }
    const lambert = Math.max(0, dot(nm, light))
    const rim = Math.max(0, 1 - Math.abs(dot(nm, F))) * .12
    const value = .16 + .78 * lambert + rim
    let color = ramp[ditherIndex(value, ramp.length, i, j)]
    const spec = Math.pow(Math.max(0, dot(nm, half)), 26) * gloss
    if (spec > .5) color = [Math.min(255, color[0] + 120), Math.min(255, color[1] + 120), Math.min(255, color[2] + 120)]
    else if (spec > .3 && bayer(i, j) < .5) color = ramp[ramp.length - 1]
    out[k] = packRgb(color)
  }
  // ふちどり: そとがわは こい いろ。てまえの ものの うしろがわ（おくゆきが とぶ ところ）も くらく する。
  const ink = packRgb(INK)
  const result = new Uint32Array(out)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i
      if (owner[k] < 0) {
        if ((i > 0 && owner[k - 1] >= 0) || (i < w - 1 && owner[k + 1] >= 0) || (j > 0 && owner[k - w] >= 0) || (j < h - 1 && owner[k + w] >= 0)) result[k] = ink
        continue
      }
      const d = depth[k]
      const gap = Math.max(1.5, Math.abs(prims[owner[k]].r[1]) * .6)
      const behind = (q: number) => owner[q] >= 0 && owner[q] !== owner[k] && depth[q] < d - gap
      if ((i > 0 && behind(k - 1)) || (i < w - 1 && behind(k + 1)) || (j > 0 && behind(k - w)) || (j < h - 1 && behind(k + w))) {
        result[k] = ink
      }
    }
  }
  image.data.set(new Uint8ClampedArray(result.buffer))
  made.ctx.putImageData(image, 0, 0)
  return { canvas: made.canvas, w, h, ox, oy }
}

// ---------------- キャッシュ ----------------

/** 32ほうこうに まるめる。 */
export const YAW_STEPS = 32
export function yawBucket(yaw: number) {
  const step = Math.PI * 2 / YAW_STEPS
  return ((Math.round(yaw / step) % YAW_STEPS) + YAW_STEPS) % YAW_STEPS
}

export type PoseKey = { leg: number; lift: number; jaw: number; flipped: boolean }

/** ポーズを だんかいに まるめる（あし 4コマ・ツノ 3だん・あご 2だん）。 */
export function quantizePose(pose: Pose): PoseKey {
  return {
    leg: ((Math.floor(pose.leg * 4) % 4) + 4) % 4,
    lift: Math.max(0, Math.min(2, Math.round(pose.lift * 2))),
    jaw: pose.jaw > .4 ? 1 : 0,
    flipped: pose.flipped,
  }
}

const cache = new Map<string, Sprite>()
const CACHE_LIMIT = 900
let budget = Infinity

/** 1フレームに あたらしく つくる 絵の かずを きめる（つくりすぎて カクカク しないように）。 */
export function setSpriteBudget(count: number) { budget = count }

function keyOf(sp: Species, q: PoseKey, bucket: number, elevation: number, px: number) {
  return `${sp.id}|${bucket}|${Math.round(elevation * 100)}|${q.leg}${q.lift}${q.jaw}${q.flipped ? 1 : 0}|${Math.round(px * 10)}`
}

function renderKey(sp: Species, q: PoseKey, bucket: number, elevation: number, px?: number) {
  const pose: Pose = { leg: q.leg / 4, lift: q.lift / 2, jaw: q.jaw, flipped: q.flipped }
  const model = buildBeetle(sp, pose, px)
  return renderModel(sp, model.prims, { yaw: bucket * Math.PI * 2 / YAW_STEPS, elevation })
}

/**
 * むし の 絵を とりだす（なければ つくって しまっておく）。
 * 1フレームの よさんを つかいきったら、ちかい ポーズの できている 絵で まにあわせる。
 */
export function beetleSprite(sp: Species, pose: Pose, yaw: number, elevation: number, px?: number, always = false): Sprite | null {
  const q = quantizePose(pose)
  const bucket = yawBucket(yaw)
  const size = px ?? 0
  const key = keyOf(sp, q, bucket, elevation, size)
  const hit = cache.get(key)
  if (hit) return hit
  if (budget <= 0 && !always) {
    for (const fallback of [{ ...q, leg: 0 }, { ...q, leg: 0, lift: 0, jaw: 0 }]) {
      const near = cache.get(keyOf(sp, fallback, bucket, elevation, size))
      if (near) return near
    }
    return null
  }
  if (!always) budget--
  const sprite = renderKey(sp, q, bucket, elevation, px)
  if (cache.size >= CACHE_LIMIT) {
    const first = cache.keys().next().value
    if (first !== undefined) cache.delete(first)
  }
  cache.set(key, sprite)
  return sprite
}

export function clearSpriteCache() { cache.clear() }
