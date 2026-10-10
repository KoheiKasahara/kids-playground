// たたかいの 画面を ちいさな ドットの キャンバスに かく。
//   えだ: よこから（よるの もり）
//   まるた: ななめから（ひるの もりの じめん）
//   きりかぶ: うえから
// カメラは たたかって いる 2ひきに ちかよって ついていく。むしは ZOOM ばいの こまかさで かく。
// せいしした はいけい（そら・じめんの もよう・まるた・きりかぶ）は いちど だけ つくって とっておく。

import type { Battle, Fighter } from './battle'
import type { Fx, Particle } from './fx'
import { lengthPx } from './model'
import { bayer, ditherIndex, hash2, hex, makeCanvas, packRgb, type Img, type Rgb } from './pixel'
import type { Species } from './species'
import { beetleSprite, type Sprite } from './sprite'
import { LOG_HALF, LOG_RADIUS, STUMP_RADIUS, type Stage } from './stages'

type G = CanvasRenderingContext2D

/** ばしょの 1 が なんドットか（むしの 絵の こまかさ）。 */
export const ZOOM = 1.5

/**
 * ドットの キャンバスの 大きさを きめる。minW × minH が かならず はいる いちばん 大きな ばいりつに する。
 * こまかい 画面（ばいりつ 3 いじょう）は せいすうばいで くっきり、あらい 画面では はんぱな ばいりつも つかって
 * どの 画面でも おなじくらいの 大きさに みえるように する。
 */
export function viewSize(cssW: number, cssH: number, dpr: number, minW: number, minH: number) {
  const dw = Math.max(1, Math.round(cssW * dpr)), dh = Math.max(1, Math.round(cssH * dpr))
  const fit = Math.min(dw / minW, dh / minH)
  const scale = fit >= 3 ? Math.floor(fit) : Math.max(1, fit)
  return { w: Math.ceil(dw / scale), h: Math.ceil(dh / scale), scale, dw, dh }
}

export type ViewSize = ReturnType<typeof viewSize>

/** ステージの カメラの まど（ばしょの 大きさ）を ドットに した 大きさ。 */
export function stageDots(stage: Stage) {
  return { w: Math.round(stage.viewW * ZOOM), h: Math.round(stage.viewH * ZOOM) }
}

/** チームの いろ（じぶん・あいて）。 */
export const TEAM_COLORS = ['#ff4a4a', '#3a9aff'] as const

// ---------------- うつしかた ----------------

type Cam = { cx: number; cy: number; ca: number; sa: number; ce: number; se: number; camU: number; camV: number }

function makeCam(stage: Stage, cx: number, cy: number, camU = 0, camV = 0): Cam {
  return { cx, cy, ca: Math.cos(stage.axis), sa: Math.sin(stage.axis), ce: Math.cos(stage.elevation), se: Math.sin(stage.elevation), camU, camV }
}

/** ばしょの ざひょう → 画面（x, y, おくゆき）。 */
function project(cam: Cam, u: number, v: number, z: number): [number, number, number] {
  const uu = u - cam.camU, vv = v - cam.camV
  const X = uu * cam.ca - vv * cam.sa
  const Y = uu * cam.sa + vv * cam.ca
  return [cam.cx + X * ZOOM, cam.cy - (Y * cam.se + z * cam.ce) * ZOOM, Y * cam.ce - z * cam.se]
}

// ---------------- どうぐ ----------------

/** ImageData に 1ドットずつ かく ための ちいさな いれもの。wrap なら はみだした ぶんを はんたいがわへ（くりかえし もよう）。 */
class Pixels {
  data: Uint32Array
  image: ImageData
  constructor(public g: G, public w: number, public h: number, private wrap = false) {
    this.image = g.createImageData(w, h)
    this.data = new Uint32Array(this.image.data.buffer)
  }
  set(x: number, y: number, c: Rgb) {
    let ix = Math.floor(x), iy = Math.floor(y)
    if (this.wrap) { ix = ((ix % this.w) + this.w) % this.w; iy = ((iy % this.h) + this.h) % this.h }
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return
    this.data[iy * this.w + ix] = packRgb(c)
  }
  done() { this.g.putImageData(this.image, 0, 0) }
}

const rgb = (ramp: readonly string[]) => ramp.map(hex)

function pixelCanvas(w: number, h: number, paint: (px: Pixels) => void, wrap = false) {
  const made = makeCanvas(w, h)
  if (!made) return null
  const px = new Pixels(made.ctx, made.canvas.width, made.canvas.height, wrap)
  paint(px)
  px.done()
  return made.canvas
}

// ---------------- えだ（よこから） ----------------

const NIGHT = rgb(['#070a22', '#0c1230', '#131a40', '#1c2050', '#272660', '#33306c'])
const BARK = rgb(['#1c120a', '#2c1c10', '#402a18', '#563a22', '#6e4c2e', '#8a6440'])
const BRANCH_T = Math.round(13 * ZOOM)
const TILE = 128

function makeNightSky(w: number, h: number) {
  return pixelCanvas(w, h, px => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = Math.min(1, y / (h * .85))
        px.set(x, y, NIGHT[ditherIndex(t, NIGHT.length, x, y)])
        const star = hash2(x, y, 3)
        if (y < h * .6 && star > .9965) px.set(x, y, star > .9993 ? [255, 250, 220] : [150, 160, 210])
      }
    }
    // おつきさま。
    const mx = Math.round(w * .82), my = Math.round(h * .17), mr = Math.max(10, Math.round(Math.min(w, h) * .07))
    for (let y = -mr - 7; y <= mr + 7; y++) {
      for (let x = -mr - 7; x <= mr + 7; x++) {
        const d = Math.hypot(x, y)
        if (d <= mr) {
          const crater = hash2(Math.floor((x + 40) / 4), Math.floor((y + 40) / 4), 21) > .78
          const shade = x + y > mr * .6
          px.set(mx + x, my + y, crater ? [220, 214, 170] : shade ? [232, 226, 186] : [250, 246, 214])
        } else if (d <= mr + 6 && bayer(mx + x, my + y) < (1 - (d - mr) / 6) * .45) {
          px.set(mx + x, my + y, [70, 72, 120])
        }
      }
    }
  })
}

/** くりかえし つかえる もりの かげ（はばは TILE の ばいすう）。 */
function makeForestStrip(h: number, color: Rgb, seed: number, top: number, bumpy: number) {
  const W = TILE * 4
  return pixelCanvas(W, h, px => {
    for (let x = 0; x < W; x++) {
      // しゅうきてきな なみ（はじと はじが つながる）。
      const a = x / W * Math.PI * 2
      const crown = Math.sin(a * 3 + seed) * .5 + Math.sin(a * 7 + seed * 2) * .3 + Math.sin(a * 13 + seed * 3) * .2
      const y0 = Math.round(top + crown * bumpy)
      for (let y = Math.max(0, y0); y < h; y++) {
        if (y === y0 && hash2(x, seed, 7) < .5) continue
        px.set(x, y, color)
      }
      // みき。
      if ((x + seed * 37) % 97 < 8) for (let y = Math.max(0, y0 - 6); y < h; y++) px.set(x, y, color)
    }
  })
}

function makeBarkTile() {
  return pixelCanvas(TILE, BRANCH_T + 6, px => {
    for (let x = 0; x < TILE; x++) {
      const crack = hash2(x >> 1, 0, 41) < .14
      for (let y = 0; y < BRANCH_T; y++) {
        const round = 1 - Math.abs((y - BRANCH_T * .38) / (BRANCH_T * .62))
        let t = .15 + round * .7 + (hash2(x >> 1, y >> 1, 43) - .5) * .25
        if (y <= 1) t = 1
        if (crack && y > 2 && y < BRANCH_T - 3) t -= .35
        px.set(x, y, BARK[ditherIndex(t, BARK.length, x, y)])
      }
      // したの かげ。
      for (let y = BRANCH_T; y < BRANCH_T + 6; y++) if (bayer(x, y) < .5 - (y - BRANCH_T) * .09) px.set(x, y, [10, 8, 20])
    }
  })
}

// ---------------- じめん（ななめ・うえ） ----------------

const MOSS = rgb(['#24361a', '#2e4620', '#3a5626', '#4a6a2e', '#5c7e36'])
const DIRT = rgb(['#3a2c1c', '#4a3824', '#5a462c'])
const GROUND_TILE = 128

/** くりかえし しきつめる もりの じめん。 */
function makeGroundTile(seed: number) {
  const n = GROUND_TILE
  return pixelCanvas(n, n, px => {
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const k = hash2(x >> 2, y >> 2, seed) * .5 + hash2(x >> 3, y >> 3, seed + 1) * .5
        const t = .3 + k * .6
        px.set(x, y, k < .22 ? DIRT[ditherIndex(t, DIRT.length, x, y)] : MOSS[ditherIndex(t, MOSS.length, x, y)])
      }
    }
    // おちば と こいし。
    for (let i = 0; i < n * n / 300; i++) {
      const x = Math.floor(hash2(i, 1, seed + 5) * n), y = Math.floor(hash2(i, 2, seed + 5) * n)
      const kind = hash2(i, 3, seed + 5)
      const color: Rgb = kind < .35 ? [176, 110, 44] : kind < .6 ? [150, 70, 36] : kind < .8 ? [200, 160, 60] : [120, 116, 104]
      const big = kind < .8 ? 3 : 2
      for (let dy = 0; dy < big; dy++) for (let dx = 0; dx < big + 1; dx++) if (dx + dy < big + 1) px.set(x + dx, y + dy, color)
      if (kind < .8) px.set(x + big, y + big - 1, [color[0] * .6, color[1] * .6, color[2] * .6])
    }
    // くさ。
    for (let i = 0; i < n * n / 420; i++) {
      const x = Math.floor(hash2(i, 9, seed) * n), y = Math.floor(hash2(i, 8, seed) * n)
      for (let k = 0; k < 4; k++) px.set(x + k - 1, y - (k === 1 || k === 2 ? 4 : 2), [110, 160, 60])
      px.set(x, y - 1, [80, 130, 50]); px.set(x + 1, y - 1, [80, 130, 50])
      px.set(x, y - 2, [96, 146, 56])
    }
  }, true)
}

// ---------------- まるた（ななめから） ----------------

const LOG_BARK = rgb(['#24160c', '#382414', '#4e341c', '#664426', '#7e5832', '#9a7044'])
const LOG_WOOD = rgb(['#7a5432', '#966a40', '#b0844e', '#c89c62', '#dcb478'])
const LOG_MOSS = rgb(['#3a5a22', '#4e722a', '#669034'])

type Prop = { canvas: Img; ox: number; oy: number }

/** まるたの はんいを 画面に うつした ときの わく（原点が 0,0）。 */
function logBox(cam: Cam, pad: number) {
  const R = LOG_RADIUS, L = LOG_HALF + 6
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const u of [-L, L]) for (const v of [-R * 2.2, R * 1.2]) for (const z of [0, -2 * R]) {
    const [x, y] = project(cam, u, v, z)
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
  }
  return { x0: Math.floor(x0) - pad, y0: Math.floor(y0) - pad, w: Math.ceil(x1 - x0) + pad * 2, h: Math.ceil(y1 - y0) + pad * 2 }
}

/** まるたの かげ（じめんの うえ、てまえがわへ のびる）。 */
function makeLogShadow(stage: Stage): Prop | null {
  const cam = makeCam(stage, 0, 0)
  const box = logBox(cam, 8)
  const canvas = pixelCanvas(box.w, box.h, px => {
    for (let s = -LOG_HALF - 8; s <= LOG_HALF + 8; s += .4) {
      for (let v = -LOG_RADIUS * 1.9; v <= LOG_RADIUS * .4; v += .4) {
        const [x, y] = project(cam, s, v, -LOG_RADIUS * 2)
        const ix = Math.round(x - box.x0), iy = Math.round(y - box.y0)
        const edge = Math.min(LOG_HALF + 8 - Math.abs(s), v + LOG_RADIUS * 1.9) / 8
        if (bayer(ix, iy) < Math.min(.6, edge)) px.set(ix, iy, [22, 32, 14])
      }
    }
  })
  return canvas ? { canvas, ox: -box.x0, oy: -box.y0 } : null
}

/** まるたを ひかりの せんで かく（ななめから みた つつ）。 */
function makeLog(stage: Stage): Prop | null {
  const cam = makeCam(stage, 0, 0)
  const box = logBox(cam, 2)
  const R = LOG_RADIUS, L = LOG_HALF + 4
  const A = [cam.ca, cam.sa, 0] as const
  const Uv = [0, cam.se, cam.ce] as const, Fv = [0, cam.ce, -cam.se] as const
  const light = norm3([-.4, -.2, .9])
  const canvas = pixelCanvas(box.w, box.h, px => {
    for (let sy = 0; sy < box.h; sy++) {
      for (let sx = 0; sx < box.w; sx++) {
        // 画面の 点 → せかいの ひかりの すじ（まるたの じくは z = -R）。
        const X = (sx + box.x0 + .5) / ZOOM, Y = -(sy + box.y0 + .5) / ZOOM
        const o = [X - Fv[0] * 400, Uv[1] * Y - Fv[1] * 400, Uv[2] * Y - Fv[2] * 400 + R]
        // じくに すいちょくな せいぶん。
        const od = o[0] * A[0] + o[1] * A[1], fd = Fv[0] * A[0] + Fv[1] * A[1]
        const op = [o[0] - A[0] * od, o[1] - A[1] * od, o[2]]
        const fp = [Fv[0] - A[0] * fd, Fv[1] - A[1] * fd, Fv[2]]
        const a = fp[0] * fp[0] + fp[1] * fp[1] + fp[2] * fp[2]
        const b = 2 * (op[0] * fp[0] + op[1] * fp[1] + op[2] * fp[2])
        const c = op[0] * op[0] + op[1] * op[1] + op[2] * op[2] - R * R
        let best = Infinity, normal: number[] | null = null, cap = false, rr = 0, along = 0
        const disc = b * b - 4 * a * c
        if (disc >= 0) {
          const t = (-b - Math.sqrt(disc)) / (2 * a)
          const s = od + fd * t
          if (Math.abs(s) <= L) {
            best = t
            normal = norm3([op[0] + fp[0] * t, op[1] + fp[1] * t, op[2] + fp[2] * t])
            along = s
          }
        }
        // はしの まるい きりくち。
        for (const end of [L, -L]) {
          if (Math.abs(fd) < 1e-6) continue
          const t = (end - od) / fd
          if (t >= best) continue
          const p = [op[0] + fp[0] * t, op[1] + fp[1] * t, op[2] + fp[2] * t]
          const r = Math.hypot(p[0], p[1], p[2])
          if (r <= R) { best = t; normal = [A[0] * Math.sign(end), A[1] * Math.sign(end), 0]; cap = true; rr = r }
        }
        if (!normal) continue
        const lit = Math.max(0, normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2])
        if (cap) {
          const ring = Math.floor(rr / 3.2 + hash2(Math.floor(rr), 0, 5) * .6) % 2
          if (rr > R - 2.2) px.set(sx, sy, LOG_BARK[1])
          else px.set(sx, sy, LOG_WOOD[ditherIndex(.25 + lit * .6 + ring * .2 - (rr < 2 ? .3 : 0), LOG_WOOD.length, sx, sy)])
          continue
        }
        // かわの すじ（まわりの かくど と ながさの むき）。
        const ang = Math.atan2(normal[2], normal[0] * -A[1] + normal[1] * A[0])
        const ridge = hash2(Math.floor(ang * 9 + hash2(Math.floor(along / 7), 1, 2) * 1.2), 3, 31) < .3
        const moss = normal[2] > .55 && hash2(Math.floor(along / 5), Math.floor(ang * 6), 77) < .28
        const t = .12 + lit * .8 - (ridge ? .22 : 0)
        px.set(sx, sy, moss ? LOG_MOSS[ditherIndex(t, LOG_MOSS.length, sx, sy)] : LOG_BARK[ditherIndex(t, LOG_BARK.length, sx, sy)])
      }
    }
  })
  return canvas ? { canvas, ox: -box.x0, oy: -box.y0 } : null
}

function norm3(v: number[]) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

// ---------------- きりかぶ（うえから） ----------------

const STUMP_WOOD = rgb(['#8a6038', '#a07046', '#b88454', '#cc9a64', '#dcb07a', '#e8c48e'])
const STUMP_BARK = rgb(['#2a1a0e', '#3c2614', '#52341c', '#684426'])

function makeStump(): Prop | null {
  const R = STUMP_RADIUS * ZOOM
  const half = Math.ceil(R + 26)
  const size = half * 2
  const canvas = pixelCanvas(size, size, px => {
    // かげ。
    for (let y = -half; y < half; y++) {
      for (let x = -half; x < half; x++) {
        const d = Math.hypot(x - 10, y - 13)
        if (d < R + 14 && bayer(x + half, y + half) < .55) px.set(x + half, y + half, [20, 26, 14])
      }
    }
    for (let y = -half; y < half; y++) {
      for (let x = -half; x < half; x++) {
        const d = Math.hypot(x, y)
        const ang = Math.atan2(y, x)
        const edge = R + 10 + Math.sin(ang * 23) * 1.8 + (hash2(Math.floor(ang * 50), 1, 9) - .5) * 3.5
        if (d > edge) continue
        const sx = x + half, sy = y + half
        const lit = .5 - (x + y) / (R * 4)
        if (d > R) {
          const ridge = hash2(Math.floor(ang * 80), 2, 13) < .35
          px.set(sx, sy, STUMP_BARK[ditherIndex(lit + .1 - (ridge ? .25 : 0), STUMP_BARK.length, sx, sy)])
          continue
        }
        // ねんりん。
        const wob = Math.sin(ang * 5 + d * .04) * 2 + Math.sin(ang * 11) * .9
        const ring = (d + wob) / (6.5 * ZOOM)
        const line = ring - Math.floor(ring) < .16
        const crack = Math.abs(Math.sin(ang * 3 + 1.1)) < .01 * (d / R) * 3 && d > 24 && d < R * .9
        let t = .45 + lit * .5 + (line ? -.3 : 0) + (hash2(sx >> 1, sy >> 1, 4) - .5) * .12
        if (d > R - 4) t -= .25
        if (d < 7) t -= .35
        if (crack) t = 0
        px.set(sx, sy, STUMP_WOOD[ditherIndex(t, STUMP_WOOD.length, sx, sy)])
      }
    }
  })
  return canvas ? { canvas, ox: half, oy: half } : null
}

// ---------------- かげ ----------------

const shadowCache = new Map<string, Img | null>()
function shadowSprite(rx: number, ry: number) {
  const key = `${rx}|${ry}`
  let img = shadowCache.get(key)
  if (img === undefined) {
    const made = makeCanvas(rx * 2 + 1, ry * 2 + 1)
    img = null
    if (made) {
      made.ctx.fillStyle = 'rgba(8,10,6,.55)'
      for (let y = -ry; y <= ry; y++) {
        for (let x = -rx; x <= rx; x++) {
          const d = (x * x) / (rx * rx) + (y * y) / (ry * ry)
          if (d <= 1 && bayer(x + rx, y + ry) < 1.05 - d * .55) made.ctx.fillRect(x + rx, y + ry, 1, 1)
        }
      }
      img = made.canvas
    }
    shadowCache.set(key, img)
  }
  return img
}

// ---------------- シーン ----------------

type Layers = {
  w: number; h: number
  sky?: Img | null; far?: Img | null; mid?: Img | null; bark?: Img | null
}

/** 1ドットの つぶを ZOOM に あわせた 大きさで。 */
const DOT = Math.max(1, Math.round(ZOOM))

export class Scene {
  private layers: Layers | null = null
  private ground: Img | null | undefined
  private props: { shadow?: Prop | null; body?: Prop | null } | null = null
  /** カメラが みている ばしょ（u, v）。 */
  camU = 0
  camV = 0
  private camReady = false
  private lastCam: Cam | null = null
  private lastW = 1
  private lastH = 1

  constructor(public stage: Stage) {}

  private center(w: number, h: number): [number, number] {
    switch (this.stage.id) {
      case 'branch': return [Math.round(w / 2), Math.round(h * .56)]
      case 'log': return [Math.round(w / 2), Math.round(h * .5)]
      case 'stump': return [Math.round(w / 2), Math.round(h / 2)]
    }
  }

  private ensure(w: number, h: number) {
    if (!this.layers || this.layers.w !== w || this.layers.h !== h) {
      this.layers = this.stage.id === 'branch'
        ? {
          w, h,
          sky: makeNightSky(w, h),
          far: makeForestStrip(h, [16, 22, 52], 1.3, h * .4, h * .08),
          mid: makeForestStrip(h, [12, 26, 34], 4.1, h * .74, h * .05),
          bark: makeBarkTile(),
        }
        : { w, h }
    }
    if (this.ground === undefined && this.stage.id !== 'branch') this.ground = makeGroundTile(this.stage.id === 'log' ? 3 : 8)
    if (!this.props) {
      this.props = this.stage.id === 'log' ? { shadow: makeLogShadow(this.stage), body: makeLog(this.stage) }
        : this.stage.id === 'stump' ? { body: makeStump() } : {}
    }
    return this.layers
  }

  /** ばしょの 点が 画面の どこに あるか（キャンバスの はば・たかさに たいする わりあい）。 */
  toScreen(u: number, v: number, z: number): [number, number] | null {
    if (!this.lastCam) return null
    const [x, y] = project(this.lastCam, u, v, z)
    return [x / this.lastW, y / this.lastH]
  }

  draw(g: G, battle: Battle, fx: Fx, time: number, w: number, h: number, dt: number, labels = true) {
    const layers = this.ensure(w, h)
    const [cx, cy] = this.center(w, h)
    this.follow(battle, dt, w, h)
    const cam = makeCam(this.stage, cx, cy, this.camU, this.camV)
    this.lastCam = cam
    this.lastW = w
    this.lastH = h
    if (this.stage.id === 'branch') this.drawBranchBackground(g, layers, cam, time)
    else this.drawGround(g, cam, w, h)
    const fighters = [...battle.f].sort((a, b) => project(cam, a.u, a.v, a.z)[2] < project(cam, b.u, b.v, b.z)[2] ? 1 : -1)
    // まるたの むこうがわへ おちた むしは、まるたより さきに かく。
    const behind = (f: Fighter) => this.stage.id === 'log' && f.z < -4 && f.v > 0
    this.drawProp(g, cam, this.props?.shadow)
    for (const f of fighters) if (behind(f)) this.drawFighter(g, cam, f, time, labels)
    this.drawProp(g, cam, this.props?.body)
    this.drawShadows(g, cam, battle)
    this.drawParticles(g, cam, fx.parts, true, w, h)
    for (const f of fighters) if (!behind(f)) this.drawFighter(g, cam, f, time, labels)
    this.drawParticles(g, cam, fx.parts, false, w, h)
    if (this.stage.id === 'branch') this.drawBranchFront(g, cam, w)
  }

  /** たたかって いる 2ひきの まんなかへ カメラを よせる。 */
  private follow(battle: Battle, dt: number, w: number, h: number) {
    const [a, c] = battle.f
    const gone = (f: Fighter) => f.state === 'flee' || f.state === 'out' || f.state === 'fall'
    let tu = (a.u + c.u) / 2, tv = (a.v + c.v) / 2
    if (battle.state === 'over' && battle.winner !== null) { tu = battle.f[battle.winner].u; tv = battle.f[battle.winner].v }
    else if (gone(a) && !gone(c)) { tu = c.u; tv = c.v }
    else if (gone(c) && !gone(a)) { tu = a.u; tv = a.v }
    // ばしょの そとを うつしすぎない。
    const halfU = w / 2 / ZOOM
    if (this.stage.id === 'branch') tv = 0
    if (this.stage.id === 'log') {
      const room = Math.max(0, LOG_HALF + 40 - halfU * .9)
      tu = Math.max(-room, Math.min(room, tu))
      tv = 0
    }
    if (this.stage.id === 'stump') {
      const room = Math.max(0, STUMP_RADIUS + 30 - Math.min(halfU, h / 2 / ZOOM))
      const d = Math.hypot(tu, tv)
      if (d > room) { tu = tu / d * room; tv = tv / d * room }
    }
    if (!this.camReady) {
      this.camU = tu; this.camV = tv; this.camReady = true
      return
    }
    const k = Math.min(1, dt * 3)
    this.camU += (tu - this.camU) * k
    this.camV += (tv - this.camV) * k
  }

  private drawGround(g: G, cam: Cam, w: number, h: number) {
    const tile = this.ground
    if (!tile) {
      g.fillStyle = '#3a5626'
      g.fillRect(0, 0, w, h)
      return
    }
    // じめんの もようは せかいに くっついて うごく。
    const groundZ = this.stage.id === 'log' ? -LOG_RADIUS * 2 : 0
    const [ox, oy] = project(cam, 0, 0, groundZ)
    const n = GROUND_TILE
    const sx = ((Math.round(ox) % n) + n) % n, sy = ((Math.round(oy) % n) + n) % n
    for (let y = sy - n; y < h; y += n) for (let x = sx - n; x < w; x += n) g.drawImage(tile, x, y)
  }

  private drawProp(g: G, cam: Cam, prop: Prop | null | undefined) {
    if (!prop) return
    const [x, y] = project(cam, 0, 0, 0)
    g.drawImage(prop.canvas, Math.round(x - prop.ox), Math.round(y - prop.oy))
  }

  private drawBranchBackground(g: G, layers: Layers, cam: Cam, time: number) {
    const { w, h } = layers
    const cy = cam.cy
    if (layers.sky) g.drawImage(layers.sky, 0, 0)
    else { g.fillStyle = '#131a40'; g.fillRect(0, 0, w, h) }
    // ほしの またたき。
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(hash2(i, 1, 99) * w), y = Math.floor(hash2(i, 2, 99) * h * .45)
      if (Math.sin(time * 2 + i * 1.7) > .6) { g.fillStyle = '#fffbe0'; g.fillRect(x, y, 1, 1); g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3) }
    }
    const scroll = cam.camU * ZOOM
    const tile = (img: Img | null | undefined, k: number) => {
      if (!img) return
      const W = img.width
      const off = ((-scroll * k) % W + W) % W
      for (let x = off - W; x < w; x += W) g.drawImage(img, Math.floor(x), 0)
    }
    tile(layers.far, .2)
    tile(layers.mid, .45)
    // えだ。
    if (layers.bark) {
      const off = ((-scroll) % TILE + TILE) % TILE
      for (let x = off - TILE; x < w; x += TILE) g.drawImage(layers.bark, Math.floor(x), cy)
    } else {
      g.fillStyle = '#563a22'
      g.fillRect(0, cy, w, BRANCH_T)
    }
    // えだの こえだ と はっぱ（おくがわ）。
    const span = w / ZOOM
    const first = Math.floor((cam.camU - span) / 40), last = Math.ceil((cam.camU + span) / 40)
    for (let k = first; k <= last; k++) {
      if (hash2(k, 5, 61) > .45 || Math.abs(k * 40) < 30) continue
      const x = Math.round(cam.cx + (k * 40 + hash2(k, 6, 61) * 20 - cam.camU) * ZOOM)
      const up = hash2(k, 7, 61) < .5
      const len = Math.round((8 + hash2(k, 8, 61) * 10) * ZOOM)
      g.fillStyle = '#3a2616'
      for (let i = 0; i < len; i++) g.fillRect(x + Math.floor(i * .7), up ? cy - i : cy + BRANCH_T - 3 + i, 3, 1)
      const lx = x + Math.floor(len * .7), ly = up ? cy - len : cy + BRANCH_T + len - 3
      g.fillStyle = '#1f4a26'
      g.fillRect(lx - 3, ly - 3, 9, 6)
      g.fillStyle = '#2e6a32'
      g.fillRect(lx - 2, ly - 3, 6, 3)
    }
    // じゅえき（まんなか）。
    const sapX = Math.round(cam.cx - cam.camU * ZOOM)
    if (sapX > -30 && sapX < w + 30) {
      const drip = Math.floor((Math.sin(time * 1.3) + 1) * 2.5)
      g.fillStyle = '#7a3c0a'; g.fillRect(sapX - 9, cy + 1, 18, 8)
      g.fillStyle = '#c8701a'; g.fillRect(sapX - 8, cy + 1, 16, 6); g.fillRect(sapX - 2, cy + 7, 4, 4 + drip)
      g.fillStyle = '#f0a83a'; g.fillRect(sapX - 6, cy + 1, 9, 3)
      g.fillStyle = '#ffe08a'; g.fillRect(sapX - 5, cy + 1, 3, 1); g.fillRect(sapX, cy + 9 + drip, 1, 1)
    }
  }

  private drawBranchFront(g: G, cam: Cam, w: number) {
    // てまえの はっぱ（ときどき）。
    const span = w / ZOOM
    const first = Math.floor((cam.camU - span) / 70), last = Math.ceil((cam.camU + span) / 70)
    for (let k = first; k <= last; k++) {
      if (hash2(k, 1, 71) > .35) continue
      const x = Math.round(cam.cx + (k * 70 + 30 - cam.camU) * ZOOM)
      const y = cam.cy + BRANCH_T + 6 + Math.floor(hash2(k, 2, 71) * 14)
      g.fillStyle = '#0e2414'
      g.fillRect(x - 8, y, 17, 7)
      g.fillRect(x - 5, y - 3, 11, 13)
      g.fillStyle = '#183a1e'
      g.fillRect(x - 5, y, 9, 3)
    }
  }

  private drawShadows(g: G, cam: Cam, battle: Battle) {
    if (this.stage.id === 'branch') return
    const top = this.stage.id === 'stump'
    for (const f of battle.f) {
      if (f.state === 'out' || f.state === 'fall') continue
      const ground = this.stage.id === 'log' ? Math.min(0, f.z) : 0
      const [x, y] = project(cam, f.u, f.v, ground)
      const air = Math.max(0, f.z - ground)
      const k = Math.max(.4, 1 - air / 120)
      // からだ（ツノ・あごを のぞく）くらいの まるい かげ。
      const body = f.rear * 1.15 * k * ZOOM
      const rx = Math.max(3, Math.round(body)), ry = Math.max(2, Math.round(body * (top ? .8 : .45)))
      const img = shadowSprite(rx, ry)
      if (img) g.drawImage(img, Math.round(x - rx + (top ? 4 : 0)), Math.round(y - ry + (top ? 6 : 1)))
    }
  }

  private drawFighter(g: G, cam: Cam, f: Fighter, time: number, labels: boolean) {
    const top = this.stage.id === 'stump'
    const yaw = f.heading + this.stage.axis + (top ? f.pose.spin : 0)
    const sprite = beetleSprite(f.sp, f.pose, yaw, this.stage.elevation, lengthPx(f.sp) * ZOOM)
    if (!sprite?.canvas) return
    const [x, y] = project(cam, f.u, f.v, f.z)
    let scale = 1
    if (top) {
      if (f.z > 0) scale = 1 + f.z / 160
      else if (f.z < 0) scale = Math.max(.35, 1 + f.z / 90)
    }
    if (f.pose.hang) {
      // えだの したに さかさに ぶらさがる。
      drawSprite(g, sprite, x - sprite.ox, y + BRANCH_T - Math.round(5 * ZOOM), 1, 0, 0, 0)
    } else {
      drawSprite(g, sprite, x, y, scale, top ? 0 : f.pose.spin, sprite.ox, sprite.oy)
    }
    if (!labels || f.state === 'out') return
    // チームの めじるし（▼）。
    const [, headY] = project(cam, f.u, f.v, f.z + (f.pose.flipped ? 16 : 26))
    const bob = Math.round(Math.sin(time * 5 + f.side) * 2)
    const mx = Math.round(x), my = Math.round((top ? y - (f.rear + 16) * ZOOM : headY - 6) + bob)
    g.fillStyle = '#0c0806'
    for (let i = 0; i < 6; i++) g.fillRect(mx - 6 + i, my - 1 + i, 13 - i * 2, 1)
    g.fillRect(mx - 6, my - 1, 13, 2)
    g.fillStyle = TEAM_COLORS[f.side]
    for (let i = 0; i < 5; i++) g.fillRect(mx - 5 + i, my + i, 11 - i * 2, 1)
    g.fillStyle = 'rgba(255,255,255,.55)'
    g.fillRect(mx - 4, my, 3, 1)
  }

  private drawParticles(g: G, cam: Cam, parts: readonly Particle[], back: boolean, w: number, h: number) {
    for (const p of parts) {
      const isBack = p.kind === 'dust' || p.kind === 'ring'
      if (isBack !== back) continue
      const [x, y] = project(cam, p.u, p.v, p.z)
      const a = p.life / p.max
      const ix = Math.round(x), iy = Math.round(y)
      switch (p.kind) {
        case 'ring': {
          const r = Math.round(p.size * ZOOM * (1.6 - a))
          g.fillStyle = p.color
          const steps = 12 + r * 2
          for (let i = 0; i < steps; i++) {
            const t = i / steps * Math.PI * 2
            g.fillRect(Math.round(x + Math.cos(t) * r), Math.round(y + Math.sin(t) * r * .7), DOT, DOT)
          }
          break
        }
        case 'burst': {
          // どーんと ひろがる ひかりの すじ。
          const grow = 1 - a
          const r0 = p.size * ZOOM * grow * .4, r1 = p.size * ZOOM * (.5 + grow)
          g.fillStyle = p.color
          for (let i = 0; i < 8; i++) {
            const t = i / 8 * Math.PI * 2 + .2
            const long = i % 2 ? .65 : 1
            line(g, x + Math.cos(t) * r0, y + Math.sin(t) * r0, x + Math.cos(t) * r1 * long, y + Math.sin(t) * r1 * long, DOT)
          }
          break
        }
        case 'lines': {
          // しゅうちゅうせん（まわりから まんなかへ）。
          const far = Math.hypot(w, h)
          const near = p.size * ZOOM * (1.4 + (1 - a))
          g.fillStyle = p.color
          for (let i = 0; i < 28; i++) {
            const t = hash2(i, Math.floor(p.max * 100), 5) * Math.PI * 2
            const r = near + hash2(i, 3, 7) * p.size * ZOOM
            line(g, x + Math.cos(t) * far, y + Math.sin(t) * far, x + Math.cos(t) * r, y + Math.sin(t) * r, 1)
          }
          break
        }
        case 'flash':
          g.fillStyle = `rgba(255,255,240,${(a * .35).toFixed(3)})`
          g.fillRect(0, 0, w, h)
          break
        case 'star':
          g.fillStyle = p.color
          g.fillRect(ix - DOT, iy, DOT * 3, DOT); g.fillRect(ix, iy - DOT, DOT, DOT * 3)
          break
        case 'glow':
          if (Math.sin(p.life * 4) > -.2) { g.fillStyle = p.color; g.fillRect(ix, iy, DOT, DOT); if (a > .3 && bayer(ix, iy) < .5) { g.fillStyle = 'rgba(200,255,120,.35)'; g.fillRect(ix - 1, iy - 1, DOT + 2, DOT + 2) } }
          break
        case 'dust': {
          const s = (a > .5 ? 2 : 1) * DOT
          g.fillStyle = p.color
          g.fillRect(ix, iy, s, s)
          break
        }
        case 'leaf':
          g.fillStyle = p.color
          g.fillRect(ix, iy, DOT * 2, DOT)
          if (Math.sin(p.life * 6) > 0) g.fillRect(ix + DOT, iy - DOT, DOT, DOT)
          break
        default:
          g.fillStyle = p.color
          g.fillRect(ix, iy, p.size * DOT, p.size * DOT)
      }
    }
  }
}

/** ドットの せん。 */
function line(g: G, x0: number, y0: number, x1: number, y1: number, size: number) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0
    g.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), size, size)
  }
}

function drawSprite(g: G, s: Sprite, x: number, y: number, scale: number, rot: number, ox: number, oy: number) {
  if (!s.canvas) return
  if (!rot && scale === 1) {
    g.drawImage(s.canvas, Math.round(x - ox), Math.round(y - oy))
    return
  }
  g.save()
  // まわすときは からだの まんなか あたりを ささえに する。
  const pivotY = s.h * .5
  g.translate(Math.round(x), Math.round(y - (oy - pivotY) * scale))
  g.rotate(Math.round(rot / (Math.PI / 8)) * (Math.PI / 8))
  g.drawImage(s.canvas, -ox * scale, -pivotY * scale, s.w * scale, s.h * scale)
  g.restore()
}

// ---------------- ずかん・サムネイル ----------------

/** えらぶ がめんの むしの 絵（ななめ まえから）。たたかいより こまかく かく。 */
export const PORTRAIT_ZOOM = 2
export function portraitSprite(sp: Species, leg = 0, lift = 0) {
  return beetleSprite(sp, { leg, lift, jaw: sp.group === 'kuwagata' ? lift : 0, flipped: false }, -.42, .38, lengthPx(sp) * PORTRAIT_ZOOM, true)
}

/** はじまる まえに よく つかう 絵を つくって おく（たたかいの とちゅうで カクカク しないように）。 */
export function warmSprites(stage: Stage, battle: Battle, count: number) {
  let made = 0
  for (const f of battle.f) {
    const yaw = f.heading + stage.axis
    for (let leg = 0; leg < 4 && made < count; leg++) {
      for (const lift of [0, .5, 1]) {
        for (const jaw of f.sp.group === 'kuwagata' ? [0, 1] : [0]) {
          if (beetleSprite(f.sp, { leg: leg / 4, lift, jaw, flipped: false }, yaw, stage.elevation, lengthPx(f.sp) * ZOOM)) made++
        }
      }
    }
  }
  return made
}
