// たたかいの 画面を ちいさな ドットの キャンバスに かく。
//   えだ: よこから（よるの もり。カメラは たたかいに ついていく）
//   まるた: ななめから（ひるの もりの じめん）
//   きりかぶ: うえから
// せいしした はいけいは いちど だけ つくって とっておく。

import type { Battle, Fighter } from './battle'
import type { Fx, Particle } from './fx'
import { bayer, ditherIndex, hash2, hex, makeCanvas, packRgb, type Img, type Rgb } from './pixel'
import { beetleSprite, type Sprite } from './sprite'
import { LOG_HALF, LOG_RADIUS, STUMP_RADIUS, type Stage } from './stages'

type G = CanvasRenderingContext2D

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

/** チームの いろ（じぶん・あいて）。 */
export const TEAM_COLORS = ['#ff4a4a', '#3a9aff'] as const

// ---------------- うつしかた ----------------

type Cam = { cx: number; cy: number; ca: number; sa: number; ce: number; se: number; shiftU: number }

function makeCam(stage: Stage, cx: number, cy: number, shiftU = 0): Cam {
  return { cx, cy, ca: Math.cos(stage.axis), sa: Math.sin(stage.axis), ce: Math.cos(stage.elevation), se: Math.sin(stage.elevation), shiftU }
}

/** ばしょの ざひょう → 画面（x, y, おくゆき）。 */
function project(cam: Cam, u: number, v: number, z: number): [number, number, number] {
  const uu = u - cam.shiftU
  const X = uu * cam.ca - v * cam.sa
  const Y = uu * cam.sa + v * cam.ca
  return [cam.cx + X, cam.cy - (Y * cam.se + z * cam.ce), Y * cam.ce - z * cam.se]
}

// ---------------- どうぐ ----------------

/** ImageData に 1ドットずつ かく ための ちいさな いれもの。 */
class Pixels {
  data: Uint32Array
  image: ImageData
  constructor(public g: G, public w: number, public h: number) {
    this.image = g.createImageData(w, h)
    this.data = new Uint32Array(this.image.data.buffer)
  }
  set(x: number, y: number, c: Rgb) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.data[(y | 0) * this.w + (x | 0)] = packRgb(c)
  }
  done() { this.g.putImageData(this.image, 0, 0) }
}

const rgb = (ramp: readonly string[]) => ramp.map(hex)

// ---------------- えだ（よこから） ----------------

const NIGHT = rgb(['#070a22', '#0c1230', '#131a40', '#1c2050', '#272660', '#33306c'])
const BARK = rgb(['#1c120a', '#2c1c10', '#402a18', '#563a22', '#6e4c2e', '#8a6440'])
const BRANCH_T = 13
const TILE = 96

function makeNightSky(w: number, h: number) {
  const made = makeCanvas(w, h)
  if (!made) return null
  const px = new Pixels(made.ctx, w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = Math.min(1, y / (h * .85))
      px.set(x, y, NIGHT[ditherIndex(t, NIGHT.length, x, y)])
      const star = hash2(x, y, 3)
      if (y < h * .6 && star > .9965) px.set(x, y, star > .9993 ? [255, 250, 220] : [150, 160, 210])
    }
  }
  // おつきさま。
  const mx = Math.round(w * .8), my = Math.round(h * .16), mr = Math.max(9, Math.round(Math.min(w, h) * .05))
  for (let y = -mr - 6; y <= mr + 6; y++) {
    for (let x = -mr - 6; x <= mr + 6; x++) {
      const d = Math.hypot(x, y)
      if (d <= mr) {
        const crater = hash2(Math.floor((x + 40) / 3), Math.floor((y + 40) / 3), 21) > .78
        const shade = x + y > mr * .6
        px.set(mx + x, my + y, crater ? [220, 214, 170] : shade ? [232, 226, 186] : [250, 246, 214])
      } else if (d <= mr + 5 && bayer(mx + x, my + y) < (1 - (d - mr) / 5) * .45) {
        px.set(mx + x, my + y, [70, 72, 120])
      }
    }
  }
  px.done()
  return made.canvas
}

/** くりかえし つかえる もりの かげ（はばは TILE の ばいすう）。 */
function makeForestStrip(h: number, color: Rgb, seed: number, top: number, bumpy: number) {
  const W = TILE * 4
  const made = makeCanvas(W, h)
  if (!made) return null
  const px = new Pixels(made.ctx, W, h)
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
    if ((x + seed * 37) % 97 < 6) for (let y = Math.max(0, y0 - 4); y < h; y++) px.set(x, y, color)
  }
  px.done()
  return made.canvas
}

function makeBarkTile() {
  const made = makeCanvas(TILE, BRANCH_T + 4)
  if (!made) return null
  const px = new Pixels(made.ctx, TILE, BRANCH_T + 4)
  for (let x = 0; x < TILE; x++) {
    const crack = hash2(x, 0, 41) < .14
    for (let y = 0; y < BRANCH_T; y++) {
      const round = 1 - Math.abs((y - BRANCH_T * .38) / (BRANCH_T * .62))
      let t = .15 + round * .7 + (hash2(x >> 1, y, 43) - .5) * .25
      if (y === 0) t = 1
      if (crack && y > 1 && y < BRANCH_T - 2) t -= .35
      px.set(x, y, BARK[ditherIndex(t, BARK.length, x, y)])
    }
    // したの かげ。
    for (let y = BRANCH_T; y < BRANCH_T + 4; y++) if (bayer(x, y) < .5 - (y - BRANCH_T) * .12) px.set(x, y, [10, 8, 20])
  }
  px.done()
  return made.canvas
}

// ---------------- まるた（ななめから） ----------------

const MOSS = rgb(['#24361a', '#2e4620', '#3a5626', '#4a6a2e', '#5c7e36'])
const DIRT = rgb(['#3a2c1c', '#4a3824', '#5a462c'])
const LOG_BARK = rgb(['#24160c', '#382414', '#4e341c', '#664426', '#7e5832', '#9a7044'])
const LOG_WOOD = rgb(['#7a5432', '#966a40', '#b0844e', '#c89c62', '#dcb478'])
const LOG_MOSS = rgb(['#3a5a22', '#4e722a', '#669034'])

function forestFloor(px: Pixels, w: number, h: number, seed: number) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = hash2(x >> 2, y >> 2, seed) * .5 + hash2(x >> 3, y >> 3, seed + 1) * .5
      const t = .25 + n * .6 + (y / h) * .15
      px.set(x, y, n < .22 ? DIRT[ditherIndex(t, DIRT.length, x, y)] : MOSS[ditherIndex(t, MOSS.length, x, y)])
    }
  }
  // おちば と こいし。
  for (let i = 0; i < w * h / 260; i++) {
    const x = Math.floor(hash2(i, 1, seed + 5) * w), y = Math.floor(hash2(i, 2, seed + 5) * h)
    const kind = hash2(i, 3, seed + 5)
    const color: Rgb = kind < .35 ? [176, 110, 44] : kind < .6 ? [150, 70, 36] : kind < .8 ? [200, 160, 60] : [120, 116, 104]
    const big = kind < .8 ? 2 : 1
    for (let dy = 0; dy < big; dy++) for (let dx = 0; dx < big + 1; dx++) px.set(x + dx, y + dy, color)
    if (kind < .8) px.set(x + big, y + big, [color[0] * .6, color[1] * .6, color[2] * .6])
  }
  // くさ。
  for (let i = 0; i < w * h / 500; i++) {
    const x = Math.floor(hash2(i, 9, seed) * w), y = Math.floor(hash2(i, 8, seed) * h)
    for (let k = 0; k < 3; k++) px.set(x + k - 1, y - (k === 1 ? 3 : 2), [110, 160, 60])
    px.set(x, y - 1, [80, 130, 50])
  }
}

/** まるたを ひかりの せんで かく（ななめから みた つつ）。 */
function drawLog(px: Pixels, cam: Cam) {
  const R = LOG_RADIUS, L = LOG_HALF + 4
  // せかいの むき。
  const A = [cam.ca, cam.sa, 0] as const
  const Rv = [1, 0, 0] as const, Uv = [0, cam.se, cam.ce] as const, Fv = [0, cam.ce, -cam.se] as const
  const light = norm3([-.4, -.2, .9])
  // まるたが うつる はんいだけ しらべる。
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const u of [-L, L]) for (const v of [-R, R]) for (const z of [0, -2 * R]) {
    const [x, y] = project(cam, u, v, z)
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
  }
  for (let sy = Math.max(0, Math.floor(y0) - 2); sy < Math.min(px.h, Math.ceil(y1) + 2); sy++) {
    for (let sx = Math.max(0, Math.floor(x0) - 2); sx < Math.min(px.w, Math.ceil(x1) + 2); sx++) {
      // 画面の 点 → せかいの ひかりの すじ（まるたの じくは z = -R）。
      const X = sx + .5 - cam.cx, Y = cam.cy - (sy + .5)
      const o = [Rv[0] * X + Uv[0] * Y - Fv[0] * 400, Rv[1] * X + Uv[1] * Y - Fv[1] * 400, Rv[2] * X + Uv[2] * Y - Fv[2] * 400 + R]
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
}

function norm3(v: number[]) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

// ---------------- きりかぶ（うえから） ----------------

const STUMP_WOOD = rgb(['#8a6038', '#a07046', '#b88454', '#cc9a64', '#dcb07a', '#e8c48e'])
const STUMP_BARK = rgb(['#2a1a0e', '#3c2614', '#52341c', '#684426'])

function drawStumpTop(px: Pixels, cx: number, cy: number) {
  const R = STUMP_RADIUS
  // かげ。
  for (let y = -R - 14; y <= R + 14; y++) {
    for (let x = -R - 14; x <= R + 14; x++) {
      const d = Math.hypot(x - 7, y - 9)
      if (d < R + 10 && bayer(cx + x, cy + y) < .55) px.set(cx + x, cy + y, [20, 26, 14])
    }
  }
  for (let y = -R - 10; y <= R + 10; y++) {
    for (let x = -R - 10; x <= R + 10; x++) {
      const d = Math.hypot(x, y)
      const ang = Math.atan2(y, x)
      const edge = R + 7 + Math.sin(ang * 23) * 1.2 + (hash2(Math.floor(ang * 40), 1, 9) - .5) * 2.5
      if (d > edge) continue
      const sx = cx + x, sy = cy + y
      const lit = .5 - (x + y) / (R * 4)
      if (d > R) {
        const ridge = hash2(Math.floor(ang * 60), 2, 13) < .35
        px.set(sx, sy, STUMP_BARK[ditherIndex(lit + .1 - (ridge ? .25 : 0), STUMP_BARK.length, sx, sy)])
        continue
      }
      // ねんりん。
      const wob = Math.sin(ang * 5 + d * .05) * 1.4 + Math.sin(ang * 11) * .6
      const ring = (d + wob) / 6.5
      const line = ring - Math.floor(ring) < .18
      const crack = Math.abs(Math.sin(ang * 3 + 1.1)) < .012 * (d / R) * 3 && d > 18 && d < R * .9
      let t = .45 + lit * .5 + (line ? -.3 : 0) + (hash2(sx >> 1, sy >> 1, 4) - .5) * .12
      if (d > R - 3) t -= .25
      if (d < 5) t -= .35
      if (crack) t = 0
      px.set(sx, sy, STUMP_WOOD[ditherIndex(t, STUMP_WOOD.length, sx, sy)])
    }
  }
}

// ---------------- かげ・ちいさな かざり ----------------

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

type Layers = { w: number; h: number; base: Img | null; front: Img | null; sky?: Img | null; far?: Img | null; mid?: Img | null; bark?: Img | null }

export class Scene {
  private layers: Layers | null = null
  /** えだの カメラ（u）。 */
  camU = 0

  constructor(public stage: Stage) {}

  private center(w: number, h: number): [number, number] {
    switch (this.stage.id) {
      case 'branch': return [Math.round(w / 2), Math.round(h * .58)]
      case 'log': return [Math.round(w / 2), Math.round(h * .52)]
      case 'stump': return [Math.round(w / 2), Math.round(h / 2)]
    }
  }

  private build(w: number, h: number): Layers {
    const [cx, cy] = this.center(w, h)
    if (this.stage.id === 'branch') {
      return {
        w, h, base: null, front: null,
        sky: makeNightSky(w, h),
        far: makeForestStrip(h, [16, 22, 52], 1.3, h * .42, h * .08),
        mid: makeForestStrip(h, [12, 26, 34], 4.1, h * .7, h * .06),
        bark: makeBarkTile(),
      }
    }
    const made = makeCanvas(w, h)
    if (!made) return { w, h, base: null, front: null }
    const px = new Pixels(made.ctx, w, h)
    forestFloor(px, w, h, this.stage.id === 'log' ? 3 : 8)
    if (this.stage.id === 'stump') {
      drawStumpTop(px, cx, cy)
      px.done()
      return { w, h, base: made.canvas, front: null }
    }
    // まるたの かげ（じめんの うえ、てまえがわへ のびる）。
    const cam = makeCam(this.stage, cx, cy)
    for (let s = -LOG_HALF - 6; s <= LOG_HALF + 6; s += .5) {
      for (let v = -LOG_RADIUS * 1.9; v <= LOG_RADIUS * .4; v += .5) {
        const [x, y] = project(cam, s, v, -LOG_RADIUS * 2)
        const ix = Math.round(x), iy = Math.round(y)
        const edge = Math.min(LOG_HALF + 6 - Math.abs(s), v + LOG_RADIUS * 1.9) / 8
        if (bayer(ix, iy) < Math.min(.6, edge)) px.set(ix, iy, [22, 32, 14])
      }
    }
    px.done()
    const logMade = makeCanvas(w, h)
    let front: Img | null = null
    if (logMade) {
      const lp = new Pixels(logMade.ctx, w, h)
      drawLog(lp, cam)
      lp.done()
      front = logMade.canvas
    }
    return { w, h, base: made.canvas, front }
  }

  private ensure(w: number, h: number) {
    if (!this.layers || this.layers.w !== w || this.layers.h !== h) this.layers = this.build(w, h)
    return this.layers
  }

  draw(g: G, battle: Battle, fx: Fx, time: number, w: number, h: number, dt: number, labels = true) {
    const layers = this.ensure(w, h)
    const [cx, cy] = this.center(w, h)
    if (this.stage.id === 'branch') {
      this.followCamera(battle, dt)
      this.drawBranchBackground(g, layers, cy, time)
    } else if (layers.base) {
      g.drawImage(layers.base, 0, 0)
    } else {
      g.fillStyle = '#3a5626'
      g.fillRect(0, 0, w, h)
    }
    const cam = makeCam(this.stage, cx, cy, this.stage.id === 'branch' ? this.camU : 0)
    const fighters = [...battle.f].sort((a, b) => project(cam, a.u, a.v, a.z)[2] < project(cam, b.u, b.v, b.z)[2] ? 1 : -1)
    // まるたの むこうがわへ おちた むしは、まるたより さきに かく。
    const behind = (f: Fighter) => this.stage.id === 'log' && f.z < -4 && f.v > 0
    for (const f of fighters) if (behind(f)) this.drawFighter(g, cam, f, time, labels)
    if (layers.front) g.drawImage(layers.front, 0, 0)
    this.drawShadows(g, cam, battle)
    this.drawParticles(g, cam, fx.parts, true)
    for (const f of fighters) if (!behind(f)) this.drawFighter(g, cam, f, time, labels)
    this.drawParticles(g, cam, fx.parts, false)
    if (this.stage.id === 'branch') this.drawBranchFront(g, cy, w)
  }

  private followCamera(battle: Battle, dt: number) {
    const [a, c] = battle.f
    let target = (a.u + c.u) / 2
    if (battle.state === 'over' && battle.winner !== null) target = battle.f[battle.winner].u
    else if (a.state === 'flee' || a.state === 'out') target = c.u
    else if (c.state === 'flee' || c.state === 'out') target = a.u
    this.camU += (target - this.camU) * Math.min(1, dt * 2.5)
  }

  private drawBranchBackground(g: G, layers: Layers, cy: number, time: number) {
    const { w, h } = layers
    if (layers.sky) g.drawImage(layers.sky, 0, 0)
    else { g.fillStyle = '#131a40'; g.fillRect(0, 0, w, h) }
    // ほしの またたき。
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(hash2(i, 1, 99) * w), y = Math.floor(hash2(i, 2, 99) * h * .5)
      if (Math.sin(time * 2 + i * 1.7) > .6) { g.fillStyle = '#fffbe0'; g.fillRect(x, y, 1, 1); g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3) }
    }
    const tile = (img: Img | null | undefined, k: number) => {
      if (!img) return
      const W = img.width
      const off = ((-this.camU * k) % W + W) % W
      for (let x = off - W; x < w; x += W) g.drawImage(img, Math.floor(x), 0)
    }
    tile(layers.far, .2)
    tile(layers.mid, .45)
    // えだ。
    if (layers.bark) {
      const off = ((-this.camU) % TILE + TILE) % TILE
      for (let x = off - TILE; x < w; x += TILE) g.drawImage(layers.bark, Math.floor(x), cy)
    } else {
      g.fillStyle = '#563a22'
      g.fillRect(0, cy, w, BRANCH_T)
    }
    // えだの こえだ と はっぱ（おくがわ）。
    const first = Math.floor((this.camU - w) / 40), last = Math.ceil((this.camU + w) / 40)
    for (let k = first; k <= last; k++) {
      if (hash2(k, 5, 61) > .45) continue
      const x = Math.round(w / 2 + k * 40 + hash2(k, 6, 61) * 20 - this.camU)
      if (Math.abs(k * 40) < 30) continue
      const up = hash2(k, 7, 61) < .5
      const len = 8 + Math.floor(hash2(k, 8, 61) * 10)
      g.fillStyle = '#3a2616'
      for (let i = 0; i < len; i++) g.fillRect(x + Math.floor(i * .7), up ? cy - i : cy + BRANCH_T - 2 + i, 2, 1)
      const lx = x + Math.floor(len * .7), ly = up ? cy - len : cy + BRANCH_T + len - 2
      g.fillStyle = '#1f4a26'
      g.fillRect(lx - 2, ly - 2, 6, 4)
      g.fillStyle = '#2e6a32'
      g.fillRect(lx - 1, ly - 2, 4, 2)
    }
    // じゅえき（まんなか）。
    const sapX = Math.round(w / 2 - this.camU)
    if (sapX > -20 && sapX < w + 20) {
      const drip = (Math.sin(time * 1.3) + 1) * 1.5
      g.fillStyle = '#7a3c0a'; g.fillRect(sapX - 6, cy + 1, 12, 5)
      g.fillStyle = '#c8701a'; g.fillRect(sapX - 5, cy + 1, 10, 4); g.fillRect(sapX - 1, cy + 5, 3, 3 + Math.floor(drip))
      g.fillStyle = '#f0a83a'; g.fillRect(sapX - 4, cy + 1, 6, 2)
      g.fillStyle = '#ffe08a'; g.fillRect(sapX - 3, cy + 1, 2, 1); g.fillRect(sapX, cy + 6 + Math.floor(drip), 1, 1)
    }
  }

  private drawBranchFront(g: G, cy: number, w: number) {
    // てまえの はっぱ（ときどき）。
    const first = Math.floor((this.camU - w) / 70), last = Math.ceil((this.camU + w) / 70)
    for (let k = first; k <= last; k++) {
      if (hash2(k, 1, 71) > .35) continue
      const x = Math.round(w / 2 + k * 70 + 30 - this.camU)
      const y = cy + BRANCH_T + 4 + Math.floor(hash2(k, 2, 71) * 10)
      g.fillStyle = '#0e2414'
      g.fillRect(x - 5, y, 11, 5)
      g.fillRect(x - 3, y - 2, 7, 9)
      g.fillStyle = '#183a1e'
      g.fillRect(x - 3, y, 6, 2)
    }
  }

  private drawShadows(g: G, cam: Cam, battle: Battle) {
    if (this.stage.id === 'branch') return
    for (const f of battle.f) {
      if (f.state === 'out' || f.state === 'fall') continue
      const ground = this.stage.id === 'log' ? Math.min(0, f.z) : 0
      const [x, y] = project(cam, f.u, f.v, ground)
      const air = Math.max(0, f.z - ground)
      const k = Math.max(.4, 1 - air / 120)
      // からだ（ツノ・あごを のぞく）くらいの まるい かげ。
      const body = f.rear * 1.15 * k
      const top = this.stage.id === 'stump'
      const rx = Math.max(3, Math.round(body)), ry = Math.max(2, Math.round(body * (top ? .8 : .45)))
      const img = shadowSprite(rx, ry)
      if (img) g.drawImage(img, Math.round(x - rx + (top ? 3 : 0)), Math.round(y - ry + (top ? 4 : 1)))
    }
  }

  private drawFighter(g: G, cam: Cam, f: Fighter, time: number, labels: boolean) {
    const top = this.stage.id === 'stump'
    const yaw = f.heading + this.stage.axis + (top ? f.pose.spin : 0)
    const sprite = beetleSprite(f.sp, f.pose, yaw, this.stage.elevation)
    if (!sprite?.canvas) return
    let [x, y] = project(cam, f.u, f.v, f.z)
    let scale = 1
    if (top) {
      if (f.z > 0) scale = 1 + f.z / 160
      else if (f.z < 0) scale = Math.max(.35, 1 + f.z / 90)
    }
    if (f.pose.hang) {
      // えだの したに さかさに ぶらさがる。
      drawSprite(g, sprite, x - sprite.ox, y + BRANCH_T - 5, 1, 0, 0, 0)
    } else {
      const spin = top ? 0 : f.pose.spin
      drawSprite(g, sprite, x, y, scale, spin, sprite.ox, sprite.oy)
    }
    if (!labels || f.state === 'out') return
    // チームの めじるし（▼）。
    const [, headY] = project(cam, f.u, f.v, f.z + (f.pose.flipped ? 18 : 30) * (this.stage.id === 'stump' ? 0 : 1))
    const bob = Math.round(Math.sin(time * 5 + f.side) * 1.5)
    x = Math.round(x); y = Math.round((top ? y - 22 - f.front * .1 : headY) - 6 + bob)
    g.fillStyle = '#0c0806'
    g.fillRect(x - 4, y - 1, 9, 2); g.fillRect(x - 3, y + 1, 7, 2); g.fillRect(x - 2, y + 3, 5, 1); g.fillRect(x - 1, y + 4, 3, 1)
    g.fillStyle = TEAM_COLORS[f.side]
    g.fillRect(x - 3, y, 7, 1); g.fillRect(x - 2, y + 1, 5, 1); g.fillRect(x - 1, y + 2, 3, 1); g.fillRect(x, y + 3, 1, 1)
  }

  private drawParticles(g: G, cam: Cam, parts: readonly Particle[], back: boolean) {
    for (const p of parts) {
      const isBack = p.kind === 'dust' || p.kind === 'ring'
      if (isBack !== back) continue
      const [x, y] = project(cam, p.u, p.v, p.z)
      const a = p.life / p.max
      const ix = Math.round(x), iy = Math.round(y)
      switch (p.kind) {
        case 'ring': {
          const r = Math.round(p.size * (1.6 - a))
          g.fillStyle = p.color
          for (let i = 0; i < 16; i++) {
            const t = i / 16 * Math.PI * 2
            g.fillRect(Math.round(x + Math.cos(t) * r), Math.round(y + Math.sin(t) * r * .7), 1, 1)
          }
          break
        }
        case 'star':
          g.fillStyle = p.color
          g.fillRect(ix - 1, iy, 3, 1); g.fillRect(ix, iy - 1, 1, 3)
          break
        case 'glow':
          if (Math.sin(p.life * 4) > -.2) { g.fillStyle = p.color; g.fillRect(ix, iy, 1, 1); if (a > .3 && bayer(ix, iy) < .5) { g.fillStyle = 'rgba(200,255,120,.35)'; g.fillRect(ix - 1, iy - 1, 3, 3) } }
          break
        case 'dust':
          g.fillStyle = p.color
          g.fillRect(ix, iy, a > .5 ? 2 : 1, a > .5 ? 2 : 1)
          break
        case 'leaf':
          g.fillStyle = p.color
          g.fillRect(ix, iy, 2, 1)
          if (Math.sin(p.life * 6) > 0) g.fillRect(ix + 1, iy - 1, 1, 1)
          break
        default:
          g.fillStyle = p.color
          g.fillRect(ix, iy, p.size, p.size)
      }
    }
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

/** えらぶ がめんの むしの 絵（ななめ まえから）。 */
export function portraitSprite(sp: Battle['f'][0]['sp'], leg = 0, lift = 0) {
  return beetleSprite(sp, { leg, lift, jaw: sp.group === 'kuwagata' ? lift : 0, flipped: false }, -.42, .38, undefined, true)
}
