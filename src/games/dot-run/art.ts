// けしきの ドット絵を プログラムで つくる ところ（そら・やま・おか・じめん・き など）。
// どれも ステージを ひらいた ときに 1かいだけ つくって、あとは はりつけるだけ に する。

import { bayer, ditherIndex, hash2, hexRgb, loopNoise, makeCanvas, mixHex, rng, spriteCanvas, type Img } from './pixel'
import { ROCK } from './sprites'
import type { Theme } from './theme'

// ---------------- 1ドットずつ ぬる ための バッファ ----------------

const packed = new Map<string, number>()
/** '#rrggbb' → ImageData の Uint32（リトルエンディアンの ABGR）。 */
export function pack(color: string, alpha = 255) {
  const key = `${color}/${alpha}`
  let v = packed.get(key)
  if (v === undefined) {
    const [r, g, b] = hexRgb(color)
    v = ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0
    packed.set(key, v)
  }
  return v
}

export class Pix {
  readonly w: number
  readonly h: number
  readonly data: Uint32Array
  private readonly made: { canvas: Img; ctx: CanvasRenderingContext2D }
  private readonly image: ImageData
  constructor(made: { canvas: Img; ctx: CanvasRenderingContext2D }) {
    this.made = made
    this.w = made.canvas.width
    this.h = made.canvas.height
    this.image = made.ctx.createImageData(this.w, this.h)
    this.data = new Uint32Array(this.image.data.buffer)
  }
  static create(w: number, h: number) {
    const made = makeCanvas(w, h)
    return made ? new Pix(made) : null
  }
  set(x: number, y: number, color: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.data[y * this.w + x] = color
  }
  has(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.data[y * this.w + x] !== 0
  }
  done(): Img {
    this.made.ctx.putImageData(this.image, 0, 0)
    return this.made.canvas
  }
}

// ---------------- そら ----------------

/** そらの たて ながの おび（よこに ならべて つかう）。y は せかいの 高さ。 */
export const SKY_Y0 = -520
export const SKY_H = 800

export function skyStrip(theme: Theme): Img | null {
  const pix = Pix.create(64, SKY_H)
  if (!pix) return null
  const colors = theme.sky.map(c => pack(c))
  for (let y = 0; y < SKY_H; y++) {
    const wy = y + SKY_Y0
    const t = (wy - theme.skyTop) / (theme.horizon - theme.skyTop)
    for (let x = 0; x < 64; x++) pix.set(x, y, colors[ditherIndex(t, colors.length, x, y)])
  }
  return pix.done()
}

export type Star = { x: number; y: number; bright: boolean; phase: number }

/** ほしぞら（よこに くりかえす）。 */
export function starField(theme: Theme, w: number, h: number): { img: Img | null; stars: Star[] } {
  const pix = Pix.create(w, h)
  const r = rng(77)
  const stars: Star[] = []
  if (!pix) return { img: null, stars }
  const dim = [pack('#4a5890'), pack('#6a78b0'), pack('#8e9ad0')]
  for (let i = 0; i < w * h / 55; i++) {
    const x = Math.floor(r() * w), y = Math.floor(Math.pow(r(), 1.4) * h)
    pix.set(x, y, dim[Math.floor(r() * 3)])
  }
  for (let i = 0; i < w * h / 900; i++) {
    const x = 2 + Math.floor(r() * (w - 4)), y = 2 + Math.floor(Math.pow(r(), 1.3) * (h - 30))
    stars.push({ x, y, bright: r() < .45, phase: r() * Math.PI * 2 })
    pix.set(x, y, pack('#ffffff'))
  }
  void theme
  return { img: pix.done(), stars }
}

/** オーロラの カーテン。 */
export function aurora(w: number, h: number): Img | null {
  const pix = Pix.create(w, h)
  if (!pix) return null
  const colors = [pack('#b8ffe0'), pack('#5cf0b0'), pack('#2ec8a0'), pack('#2a8c96'), pack('#34508c')]
  for (let x = 0; x < w; x++) {
    const center = h * .45 + (loopNoise(x / 40, w / 40, 5) - .5) * h * .5
    const streak = .55 + loopNoise(x / 3, w / 3, 9) * .45
    for (let y = 0; y < h; y++) {
      const d = (y - center) / (h * .5)
      // したは くっきり、うえは ふわっと きえる。
      const k = d > 0 ? Math.max(0, 1 - d * 3.2) : Math.max(0, 1 + d * 1.3)
      const v = k * streak
      if (v < .12 + bayer(x, y) * .5) continue
      const idx = Math.min(colors.length - 1, Math.floor((1 - v) * colors.length))
      pix.set(x, y, colors[idx])
    }
  }
  return pix.done()
}

/** おひさま・ゆうひ・おつきさま（ひかりの わ つき）。 */
export function celestial(theme: Theme): Img | null {
  if (theme.celestial === 'none') return null
  if (theme.celestial === 'earth') return earth()
  const size = theme.celestial === 'sunset' ? 76 : theme.celestial === 'crescent' ? 60 : 44
  const pix = Pix.create(size, size)
  if (!pix) return null
  const c = size / 2 - .5
  const glow = theme.celestial === 'sun' ? pack('#fff8d0') : theme.celestial === 'sunset' ? pack('#ffd49a') : theme.celestial === 'crescent' ? pack('#7a5ab0') : pack('#6a7cc0')
  const glow2 = theme.celestial === 'moon' ? pack('#8e9cd8') : theme.celestial === 'crescent' ? pack('#a88ad0') : glow
  const radius = theme.celestial === 'sunset' ? 22 : theme.celestial === 'crescent' ? 14 : 9
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c)
      if (d < radius) {
        let color: string
        if (theme.celestial === 'sun') {
          color = d < radius - 3 ? '#fffbe0' : d < radius - 1.5 ? '#fff0a0' : '#ffd84a'
          if (x - c < -3 && y - c < -3 && d < radius - 2) color = '#ffffff'
        } else if (theme.celestial === 'sunset') {
          const ty = (y - (c - radius)) / (radius * 2)
          const band = Math.floor(ty * 6)
          color = ['#fff4b0', '#ffe070', '#ffc048', '#ff9a40', '#ff6a48', '#f04860'][Math.min(5, band)]
          // したの ほうは よこじまに すきまを あける（レトロな ゆうひ）。
          const rel = y - c
          if (rel > 2) {
            const gap = Math.floor((rel - 2) / 5) + 1
            if ((Math.floor(rel) + 1) % 6 < Math.min(4, gap)) continue
          }
        } else if (theme.celestial === 'crescent') {
          // みかづき：ずらした まるで けずる。
          if (Math.hypot(x - c - 6, y - c + 4) < radius - 1) continue
          color = Math.hypot(x - c - 6, y - c + 4) < radius + 1 ? '#ffe070' : '#fff4c0'
        } else {
          color = '#fff6d8'
          if (x - c > 3) color = '#e8dcb4'
          const craters = [[-3, -2, 2.2], [2, 3, 1.6], [-1, 4, 1.2], [3, -3, 1.2]]
          for (const [cx, cy, r] of craters) if (Math.hypot(x - c - cx, y - c - cy) < r) color = x - c > 3 ? '#cfc09a' : '#e6d8b0'
        }
        pix.set(x, y, pack(color))
      } else {
        const halo = radius + (theme.celestial === 'sunset' ? 14 : 12)
        const k = 1 - (d - radius) / (halo - radius)
        if (k > 0 && k * k * .9 > bayer(x, y)) pix.set(x, y, k > .55 ? glow : glow2)
      }
    }
  }
  return pix.done()
}

/** 2じげんの なめらかな ノイズ（0〜1）。 */
function noise2(x: number, y: number, seed: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const sx = x - x0, sy = y - y0
  const fx = sx * sx * (3 - 2 * sx), fy = sy * sy * (3 - 2 * sy)
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed), c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

/** つきから みた ちきゅう（あおい うみ・みどりの りく・しろい くも。みぎがわは よる）。 */
function earth(): Img | null {
  const size = 48
  const pix = Pix.create(size, size)
  if (!pix) return null
  const c = size / 2 - .5
  const radius = 13
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c, dy = y - c
      const d = Math.hypot(dx, dy)
      if (d < radius) {
        // まるい ほしに みえるように、ふちほど もようを ちぢめる。
        const nz = Math.sqrt(Math.max(0, 1 - (d / radius) ** 2))
        const u = dx / (radius * (.6 + nz * .4)), v = dy / radius
        const land = noise2(u * 2.4 + 3, v * 2.4 + 1, 41) * .7 + noise2(u * 6, v * 6, 42) * .3
        const cloudN = noise2(u * 3 + 7, v * 7, 43) * .6 + noise2(u * 8, v * 8, 44) * .4
        const lightK = -dx / radius * .8 - dy / radius * .35 + nz * .5
        const night = lightK < -.05 + (bayer(x, y) - .5) * .25
        let color: string
        if (cloudN > .66) color = night ? '#6a7aa0' : '#ffffff'
        else if (land > .58) color = night ? '#1c3a2a' : land > .7 ? '#b8a060' : land > .64 ? '#5ab04a' : '#3a8a3e'
        else color = night ? '#102654' : lightK > .55 ? '#5aa8f4' : '#2a6ad8'
        if (d > radius - 1.2) color = night ? '#0c1a40' : '#8ad0ff'
        pix.set(x, y, pack(color))
      } else {
        const halo = radius + 9
        const k = 1 - (d - radius) / (halo - radius)
        if (k > 0 && k * k * .85 > bayer(x, y)) pix.set(x, y, pack(k > .6 ? '#4a7ad0' : '#24407a'))
      }
    }
  }
  return pix.done()
}

/** うちゅうふくの ヘルメット（つきの ステージで うさぎに かぶせる）。 */
export function helmetSprite(): Img | null {
  const size = 22
  const pix = Pix.create(size, size)
  if (!pix) return null
  const c = size / 2 - .5
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c)
      if (d > 10.5) continue
      const ang = Math.atan2(y - c, x - c)
      if (d > 9.6) pix.set(x, y, pack('#3a4a6a'))
      else if (d > 8.7) pix.set(x, y, pack(ang > -.4 && ang < 2.2 ? '#9ab0d0' : '#e8f4ff'))
      else if (d > 5.5 && d < 7.8 && ang > -2.7 && ang < -1.9) pix.set(x, y, pack('#ffffff', 220))
      else pix.set(x, y, pack('#bfe4ff', 46))
    }
  }
  pix.set(Math.round(c + 5), Math.round(c + 4), pack('#ffffff'))
  return pix.done()
}

// ---------------- くも ----------------

export function cloud(theme: Theme, seed: number): Img | null {
  if (!theme.cloud) return null
  const r = rng(seed)
  const w = 44 + Math.floor(r() * 36), h = 24
  const pix = Pix.create(w, h)
  if (!pix) return null
  const base = h - 4
  // したが たいらで、うえが もこもこの くも。
  const count = Math.floor(w / 8)
  const puffs = Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1)
    const lift = Math.sin(t * Math.PI)
    return { x: 7 + (w - 14) * t, y: base - 3 - lift * 6 - r() * 2, r: 5 + lift * 5 + r() * 2 }
  })
  const [light, mid, dark] = theme.cloud.map(c => pack(c))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y > base) continue
      let shade = -1
      for (const p of puffs) {
        const d = Math.hypot(x - p.x, y - p.y)
        if (d < p.r) shade = Math.max(shade, (p.y - y) / p.r + (p.x - x) / p.r * .3)
      }
      if (shade < -.9) continue
      const fromBottom = base - y
      const color = fromBottom < 2 ? dark : fromBottom < 4 ? (bayer(x, y) < .5 ? dark : mid) : shade > .15 ? light : shade > -.25 ? (bayer(x, y) < .55 ? light : mid) : mid
      pix.set(x, y, color)
    }
  }
  return pix.done()
}

// ---------------- とおくの けしき（よこに くりかえす おび） ----------------

export const FAR_W = 512
export const FAR_H = 96

export function farStrip(theme: Theme): Img | null {
  const pix = Pix.create(FAR_W, FAR_H)
  if (!pix) return null
  const { colors, snow, kind } = theme.far
  const pc = colors.map(c => pack(c))
  const haze = pack(mixHex(colors[0], theme.sky.at(-1)!, .55))
  if (kind === 'sea') {
    // ちへいせんから したは うみ。ところどころに とおくの しま。
    const top = 30
    for (let x = 0; x < FAR_W; x++) {
      const island = Math.max(0, loopNoise(x / 28, FAR_W / 28, 3) - .62) * 40
      for (let y = Math.floor(top - island); y < top; y++) pix.set(x, y, y > top - 2 ? pc[3] : pc[4])
      for (let y = top; y < FAR_H; y++) {
        const t = (y - top) / (FAR_H - top)
        pix.set(x, y, pc[ditherIndex(.1 + t * .9, 4, x, y) + 1])
        // なみの きらめき（よこ ながの せん）。
        if (hash2(x >> 3, y, 4) < .05 * (1 - t) && (x & 7) < 4 + (y & 1)) pix.set(x, y, pack(snow[1]))
      }
      pix.set(x, top, pack(snow[1]))
    }
    return pix.done()
  }
  if (kind === 'reef') return reefStrip(pix, pc, snow.map(c => pack(c)), haze)
  const peaks = kind === 'peaks'
  const lunar = kind === 'lunar'
  const ridge = new Float32Array(FAR_W)
  if (kind === 'mesas') {
    // てっぺんが たいらな いわの だいち。
    for (let x = 0; x < FAR_W; x++) {
      const n = loopNoise(x / 70, FAR_W / 70, 3)
      const h = n > .56 ? 56 + loopNoise(x / 9, FAR_W / 9, 4) * 2 : n > .44 ? 18 + (n - .44) / .12 * 38 : 16 + loopNoise(x / 20, FAR_W / 20, 5) * 6
      ridge[x] = FAR_H - h
    }
  } else if (kind === 'cloudsea') {
    // もこもこの くもの うみ。
    for (let x = 0; x < FAR_W; x++) {
      const k = ((x % 32) - 16) / 16
      ridge[x] = FAR_H - (26 + loopNoise(x / 60, FAR_W / 60, 3) * 22 + Math.sqrt(Math.max(0, 1 - k * k)) * 7)
    }
  } else if (lunar) {
    // まるく なだらかな つきの やま。
    const r = rng(13)
    const list = Array.from({ length: 8 }, () => ({ x: r() * FAR_W, h: 26 + r() * 40, w: 50 + r() * 60 }))
    for (let x = 0; x < FAR_W; x++) {
      let h = 14 + loopNoise(x / 24, FAR_W / 24, 3) * 6
      for (const p of list) {
        const dx = Math.min(Math.abs(x - p.x), FAR_W - Math.abs(x - p.x)) / p.w
        if (dx < 1) h = Math.max(h, p.h * (1 - dx * dx) + loopNoise(x / 7, FAR_W / 7, 4) * 3)
      }
      ridge[x] = FAR_H - h
    }
  } else if (peaks) {
    const r = rng(11)
    const list = Array.from({ length: 9 }, () => ({ x: r() * FAR_W, h: 38 + r() * 46, s: .8 + r() * .6 }))
    for (let x = 0; x < FAR_W; x++) {
      let h = 12
      for (const p of list) {
        const dx = Math.min(Math.abs(x - p.x), FAR_W - Math.abs(x - p.x))
        h = Math.max(h, p.h - dx * p.s + loopNoise(x / 6, FAR_W / 6, 2) * 4)
      }
      ridge[x] = FAR_H - h
    }
  } else {
    for (let x = 0; x < FAR_W; x++) {
      ridge[x] = FAR_H - (20 + loopNoise(x / 64, FAR_W / 64, 1) * 44 + loopNoise(x / 16, FAR_W / 16, 2) * 9)
    }
  }
  // なだらかな かたむきで ひなた・ひかげを きめる（こまかい でこぼこで しまもように ならないように）。
  const smoothRidge = (x: number) => {
    let sum = 0
    for (let k = -6; k <= 6; k++) sum += ridge[(x + k + FAR_W) % FAR_W]
    return sum / 13
  }
  for (let x = 0; x < FAR_W; x++) {
    const top = Math.round(ridge[x])
    const slope = smoothRidge((x + 3) % FAR_W) - smoothRidge((x - 3 + FAR_W) % FAR_W)
    // ひかりは ひだり うえ（ゆきやまは つきの ある みぎ）から。
    const lit = peaks ? slope < 0 : slope > 0
    for (let y = Math.max(0, top); y < FAR_H; y++) {
      const depth = y - top
      let color = lit ? (depth < 2 ? pc[0] : bayer(x, y) < .3 ? pc[0] : pc[1]) : depth < 1 ? pc[1] : bayer(x, y) < .25 ? pc[1] : pc[2]
      const snowLine = peaks ? FAR_H * .62 : FAR_H * .52
      const capDepth = (snowLine - top) * (peaks ? .7 : .35) + loopNoise(x / 5, FAR_W / 5, 7) * 5
      if (lunar) {
        if (lit && depth < 1) color = pack(snow[0])
      } else if (top < snowLine && depth < capDepth) {
        color = pack(lit ? snow[0] : snow[1])
        if (peaks && !lit && depth > capDepth - 3 && bayer(x, y) > .5) color = pack(snow[2])
      }
      if (y > FAR_H - 16) {
        const k = (y - (FAR_H - 16)) / 16
        if (k > bayer(x, y)) color = haze
      }
      pix.set(x, y, color)
    }
  }
  if (lunar) {
    // やまはだの クレーター。
    const r = rng(17)
    for (let i = 0; i < 26; i++) {
      const cx = Math.floor(r() * FAR_W), rx = 3 + r() * 6
      const cy = Math.round(ridge[cx] + rx * .6 + 2 + r() * 20)
      paintCrater(pix, cx, cy, rx, rx * .4, pc[3], pack(snow[1]), FAR_W)
    }
  }
  return pix.done()
}

/** だえんの クレーター（ひだりうえが かげ、みぎしたの ふちが ひかる）。 */
function paintCrater(pix: Pix, cx: number, cy: number, rx: number, ry: number, shadow: number, rim: number, wrap = 0) {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const wx = wrap ? (x + wrap) % wrap : x
      if (!pix.has(wx, y)) continue
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry)
      if (d < 1) {
        if ((x - cx) / rx + (y - cy) / ry * .6 < .25) pix.set(wx, y, shadow)
      } else if (d < 1 + 1.4 / ry && y > cy) pix.set(wx, y, rim)
    }
  }
}

/** うみの そこの いわの さんごしょう（うえから ひかりが さす）。 */
function reefStrip(pix: Pix, pc: number[], light: number[], haze: number): Img {
  const r = rng(19)
  const ridge = new Float32Array(FAR_W)
  for (let x = 0; x < FAR_W; x++) {
    ridge[x] = FAR_H - (16 + loopNoise(x / 46, FAR_W / 46, 5) * 26 + loopNoise(x / 11, FAR_W / 11, 6) * 6)
  }
  // ところどころに たかい いわの はしら。
  for (let i = 0; i < 6; i++) {
    const px = Math.floor(r() * FAR_W), half = 5 + r() * 7, h = 50 + r() * 34
    for (let dx = -Math.ceil(half) - 3; dx <= half + 3; dx++) {
      const x = (px + dx + FAR_W) % FAR_W
      const k = Math.abs(dx) / half
      const top = FAR_H - h * (k < 1 ? 1 - k * k * .35 : Math.max(0, .65 - (k - 1) * .5))
      ridge[x] = Math.min(ridge[x], top + loopNoise(x / 3, FAR_W / 3, 8) * 3)
    }
  }
  for (let x = 0; x < FAR_W; x++) {
    const top = Math.round(ridge[x])
    for (let y = Math.max(0, top); y < FAR_H; y++) {
      const depth = y - top
      let color = depth < 1 ? light[0] : depth < 3 ? (bayer(x, y) < .5 ? light[1] : pc[0]) : pc[Math.min(3, ditherIndex(depth / 50, 3, x, y))]
      // あなぼこ。
      if (depth > 6 && hash2(x >> 2, y >> 2, 3) < .06 && ((x & 3) + (y & 3)) % 3 === 0) color = pc[3]
      if (y > FAR_H - 18 && (y - (FAR_H - 18)) / 18 > bayer(x, y)) color = haze
      pix.set(x, y, color)
    }
  }
  return pix.done()
}

export const MID_W = 480
export const MID_H = 104

export function midStrip(theme: Theme): Img | null {
  const pix = Pix.create(MID_W, MID_H)
  if (!pix) return null
  const { colors, accent, kind } = theme.mid
  const pc = colors.map(c => pack(c))
  const r = rng(21)
  if (kind === 'hills') {
    const hill = (x: number) => MID_H - (26 + loopNoise(x / 90, MID_W / 90, 4) * 34 + loopNoise(x / 30, MID_W / 30, 6) * 8)
    for (let x = 0; x < MID_W; x++) {
      const top = Math.round(hill(x))
      const slope = hill(x + 1) - hill(x - 1)
      for (let y = top; y < MID_H; y++) {
        const d = y - top
        const idx = d < 2 ? (slope > 0 ? 0 : 1) : ditherIndex(Math.min(1, d / 50) * .7 + (slope > 0 ? 0 : .25), 4, x, y) + 1
        pix.set(x, y, pc[Math.min(4, idx)])
      }
    }
    // おかの うえの まるい き。
    for (let i = 0; i < 16; i++) {
      const cx = Math.floor(r() * MID_W), rad = 5 + r() * 6
      const base = hill(cx)
      const cy = base - rad * .6
      for (let y = Math.floor(cy - rad); y <= base + 1; y++) {
        for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
          const wx = (x + MID_W) % MID_W
          const d = Math.hypot(x - cx, (y - cy) * 1.1)
          if (d < rad) {
            const lightK = ((x - cx) + (y - cy)) / rad
            const idx = lightK < -.6 ? 0 : lightK < .1 ? (bayer(x, y) < .5 ? 1 : 2) : lightK < .7 ? 2 : 3
            pix.set(wx, y, pc[idx + 1])
          } else if (Math.abs(x - cx) < 1 && y > cy) pix.set(wx, y, pack('#6a4a2a'))
        }
      }
    }
    for (let i = 0; i < 140; i++) {
      const x = Math.floor(r() * MID_W)
      const y = Math.round(hill(x)) + 2 + Math.floor(r() * 30)
      if (y < MID_H) pix.set(x, y, pack(accent[Math.floor(r() * accent.length)]))
    }
    return pix.done()
  }
  if (kind === 'palms') {
    const dune = (x: number) => MID_H - (18 + loopNoise(x / 70, MID_W / 70, 8) * 16)
    for (let x = 0; x < MID_W; x++) {
      for (let y = Math.round(dune(x)); y < MID_H; y++) pix.set(x, y, y - dune(x) < 1.5 ? pc[0] : pc[ditherIndex((y - dune(x)) / 30, 3, x, y) + 1])
    }
    for (let i = 0; i < 7; i++) {
      const bx = Math.floor(r() * MID_W), lean = (r() - .5) * .5, height = 44 + r() * 26
      const base = dune(bx) + 2
      let tx = bx
      for (let k = 0; k < height; k++) {
        tx = bx + lean * k + Math.sin(k / height * 2.2) * 4
        const y = Math.round(base - k)
        for (let dx = -1; dx <= 1; dx++) pix.set((Math.round(tx) + dx + MID_W) % MID_W, y, dx === 1 ? pc[2] : pc[1])
      }
      const topY = base - height
      for (let f = 0; f < 7; f++) {
        const ang = Math.PI * (1.05 + f * .15) + (r() - .5) * .2
        const len = 16 + r() * 8
        for (let k = 0; k < len; k++) {
          const t = k / len
          const x = tx + Math.cos(ang) * k * 1.1
          const y = topY + Math.sin(ang) * k * .55 + t * t * 12
          const thick = t < .7 ? 2 : 1
          for (let d = 0; d < thick; d++) pix.set((Math.round(x) + MID_W) % MID_W, Math.round(y) + d, d === 0 && f < 3 ? pc[0] : pc[1])
        }
      }
      // ゆうひの ふちどり。
      for (let k = 0; k < height; k += 2) pix.set((Math.round(bx + lean * k + Math.sin(k / height * 2.2) * 4) + 2 + MID_W) % MID_W, Math.round(base - k), pack(accent[0]))
    }
    return pix.done()
  }
  if (kind === 'spires') {
    // にょきにょき たつ いわの はしら。
    for (let x = 0; x < MID_W; x++) {
      for (let y = MID_H - 18; y < MID_H; y++) pix.set(x, y, pc[ditherIndex((y - (MID_H - 18)) / 18, 3, x, y) + 2])
    }
    const spires = Array.from({ length: 14 }, () => ({ x: Math.floor(r() * MID_W), w: 7 + Math.floor(r() * 9), h: 30 + r() * 56 }))
    spires.sort((a, b) => b.h - a.h)
    for (const sp of spires) {
      const base = MID_H - 12
      const top = Math.round(base - sp.h)
      for (let y = top; y < base; y++) {
        // うえは まるく、ところどころ くびれる。
        const k = (y - top) / sp.h
        const pinch = Math.sin(k * 9 + sp.x) * .12
        const half = sp.w / 2 * (k < .12 ? Math.sqrt(k / .12) : 1) * (1 + pinch)
        for (let dx = -Math.floor(half); dx <= half; dx++) {
          const x = (sp.x + dx + MID_W) % MID_W
          const band = (y + Math.round(sp.x * .3)) % 7 === 0
          const color = dx < -half * .3 ? pc[0] : dx < half * .4 ? pc[band ? 2 : 1] : pc[band ? 3 : 2]
          pix.set(x, y, color)
        }
      }
    }
    for (let i = 0; i < 60; i++) {
      const x = Math.floor(r() * MID_W), y = MID_H - 14 + Math.floor(r() * 10)
      pix.set(x, y, pack(accent[1]))
      pix.set(x, y - 1, pack(accent[1]))
    }
    return pix.done()
  }
  if (kind === 'puffs') {
    // よぞらに うかぶ おおきな くも。
    const puffs = Array.from({ length: 26 }, () => ({ x: r() * MID_W, y: MID_H - 10 - r() * 34, r: 9 + r() * 14 }))
    for (let y = 0; y < MID_H; y++) {
      for (let x = 0; x < MID_W; x++) {
        let best = -1
        for (const p of puffs) {
          for (const off of [-MID_W, 0, MID_W]) {
            const d = Math.hypot(x - p.x - off, (y - p.y) * 1.3)
            if (d < p.r) best = Math.max(best, 1 - d / p.r + (y < p.y ? .2 : -.1))
          }
        }
        if (y > MID_H - 14) best = Math.max(best, .05)
        if (best < 0) continue
        pix.set(x, y, pc[best > .8 ? 0 : best > .55 ? (bayer(x, y) < .5 ? 0 : 1) : best > .3 ? 2 : best > .12 ? 3 : 4])
      }
    }
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(r() * MID_W), y = Math.floor(r() * (MID_H - 50))
      if (!pix.has(x, y)) pix.set(x, y, pack(accent[i % 2]))
    }
    return pix.done()
  }
  if (kind === 'kelp') {
    // うみの そこの すなと、ゆらゆら のびる こんぶ・まるい さんご。
    const floor = (x: number) => MID_H - (12 + loopNoise(x / 50, MID_W / 50, 3) * 10)
    const water = theme.sky.at(-1)!
    const kelp = Array.from({ length: 22 }, () => ({ x: r() * MID_W, h: 30 + r() * 56, phase: r() * 6, lean: (r() - .5) * .3 }))
    kelp.sort((a, b) => b.h - a.h)
    for (const k of kelp) {
      const base = floor(k.x) + 2
      for (let i = 0; i < k.h; i++) {
        const y = Math.round(base - i)
        const x = k.x + Math.sin(i * .12 + k.phase) * 3 + i * k.lean
        const wide = i % 9 < 4 && i > 6 ? 2 : 1
        for (let dx = -wide; dx <= wide; dx++) pix.set((Math.round(x) + dx + MID_W) % MID_W, y, dx < 0 ? pc[1] : dx > 0 ? pc[3] : pc[2])
      }
    }
    const corals = Array.from({ length: 12 }, () => ({ x: r() * MID_W, rad: 5 + r() * 7, color: accent[Math.floor(r() * accent.length)] }))
    for (const c of corals) {
      const base = floor(c.x)
      const shades = [mixHex(c.color, water, .35), mixHex(c.color, water, .55), mixHex(c.color, water, .72)].map(v => pack(v))
      for (let y = Math.floor(base - c.rad * 1.4); y <= base + 1; y++) {
        for (let x = Math.floor(c.x - c.rad); x <= c.x + c.rad; x++) {
          const d = Math.hypot(x - c.x, (y - base) * .75)
          if (d > c.rad) continue
          const lightK = (c.x - x) / c.rad * .4 + (base - y) / c.rad
          const idx = lightK > .9 ? 0 : lightK > .4 ? (bayer(x, y) < .5 ? 0 : 1) : lightK > 0 ? 1 : 2
          pix.set((x + MID_W) % MID_W, y, (x + y * 3) % 5 === 0 && d < c.rad - 1 ? shades[2] : shades[idx])
        }
      }
    }
    for (let x = 0; x < MID_W; x++) {
      const top = Math.round(floor(x))
      for (let y = top; y < MID_H; y++) pix.set(x, y, y - top < 1 ? pc[1] : pc[Math.min(4, ditherIndex((y - top) / 16, 3, x, y) + 2)])
    }
    return pix.done()
  }
  if (kind === 'craters') {
    // なだらかな つきの じめんと、たくさんの クレーター。
    const hill = (x: number) => MID_H - (18 + loopNoise(x / 80, MID_W / 80, 4) * 22 + loopNoise(x / 24, MID_W / 24, 6) * 5)
    for (let x = 0; x < MID_W; x++) {
      const top = Math.round(hill(x))
      const slope = hill(x + 2) - hill(x - 2)
      for (let y = top; y < MID_H; y++) {
        const d = y - top
        const idx = d < 1 ? 0 : ditherIndex(Math.min(1, d / 40) * .75 + (slope > 0 ? 0 : .2), 4, x, y) + 1
        pix.set(x, y, pc[Math.min(4, idx)])
      }
    }
    for (let i = 0; i < 22; i++) {
      const cx = Math.floor(r() * MID_W), rx = 3 + r() * 9
      const cy = Math.round(hill(cx) + rx * .35 + 2 + r() * 14)
      paintCrater(pix, cx, cy, rx, Math.max(1.5, rx * .32), pc[4], pack(accent[0]), MID_W)
    }
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(r() * MID_W)
      const y = Math.round(hill(x)) + 3 + Math.floor(r() * 30)
      if (y < MID_H) pix.set(x, y, pack(accent[1]))
    }
    return pix.done()
  }
  // pines
  for (let x = 0; x < MID_W; x++) {
    for (let y = MID_H - 20; y < MID_H; y++) pix.set(x, y, pc[ditherIndex((y - (MID_H - 20)) / 20, 3, x, y) + 1])
  }
  const trees = Array.from({ length: 34 }, () => ({ x: Math.floor(r() * MID_W), h: 26 + r() * 40, w: .42 + r() * .12 }))
  trees.sort((a, b) => b.h - a.h)
  for (const t of trees) {
    const base = MID_H - 14
    const top = base - t.h
    for (let y = Math.floor(top); y < base; y++) {
      const k = (y - top) / t.h
      // ぎざぎざの だんに する。
      const tier = (k * 4) % 1
      const half = Math.max(1, (k * .75 + tier * .35) * t.h * t.w * .5)
      for (let dx = -Math.floor(half); dx <= half; dx++) {
        const x = (t.x + dx + MID_W) % MID_W
        const snowy = tier < .22 && dx < half - 1 && bayer(x, y) < .75
        pix.set(x, y, snowy ? pack(accent[dx < 0 ? 0 : 1]) : dx > half * .3 ? pc[1] : pc[0])
      }
    }
  }
  return pix.done()
}

export const NEAR_W = 256
export const NEAR_H = 40

export function nearStrip(theme: Theme): Img | null {
  const pix = Pix.create(NEAR_W, NEAR_H)
  if (!pix) return null
  const pc = theme.near.colors.map(c => pack(c))
  const r = rng(31)
  if (theme.topKind === 'grass' || theme.topKind === 'cloud') {
    const bushes = Array.from({ length: 22 }, () => ({ x: r() * NEAR_W, r: 7 + r() * 9 }))
    for (let y = 0; y < NEAR_H; y++) {
      for (let x = 0; x < NEAR_W; x++) {
        let best = -1
        for (const b of bushes) {
          for (const off of [-NEAR_W, 0, NEAR_W]) {
            const d = Math.hypot(x - b.x - off, (y - (NEAR_H - 4)) * 1.2)
            if (d < b.r) best = Math.max(best, 1 - d / b.r + ((x - b.x - off) < 0 ? .15 : 0))
          }
        }
        if (best < 0) continue
        pix.set(x, y, pc[best > .75 ? 0 : best > .45 ? (bayer(x, y) < .5 ? 0 : 1) : best > .2 ? 2 : 3])
        if (best > .5 && hash2(x, y, 3) < .02) pix.set(x, y, pack('#ffffff'))
      }
    }
    return pix.done()
  }
  for (let x = 0; x < NEAR_W; x++) {
    const top = NEAR_H - (10 + loopNoise(x / 40, NEAR_W / 40, 12) * 18)
    const slope = loopNoise((x + 1) / 40, NEAR_W / 40, 12) - loopNoise((x - 1) / 40, NEAR_W / 40, 12)
    for (let y = Math.round(top); y < NEAR_H; y++) {
      const d = y - top
      pix.set(x, y, d < 1.5 ? pc[0] : pc[Math.min(3, ditherIndex(d / 26 + (slope < 0 ? .25 : 0), 3, x, y) + 1)])
    }
    if (theme.topKind === 'sand' && hash2(x, 0, 5) < .08) {
      for (let k = 1; k < 5; k++) pix.set(x + (k > 2 ? 1 : 0), Math.round(top) - k, pack('#6a8a3a'))
    }
    // うみくさの しげみ。
    if (theme.topKind === 'seabed' && hash2(x >> 1, 0, 6) < .16) {
      const len = 4 + Math.floor(hash2(x, 1, 6) * 9)
      for (let k = 1; k < len; k++) pix.set(x + Math.round(Math.sin(k * .5 + x) * 1), Math.round(top) - k, pack(k > len - 3 ? '#5ad08a' : '#2a8a5a'))
    }
  }
  if (theme.topKind === 'moon') {
    for (let i = 0; i < 18; i++) {
      const cx = Math.floor(r() * NEAR_W), rx = 2.5 + r() * 5
      const top = NEAR_H - (10 + loopNoise(cx / 40, NEAR_W / 40, 12) * 18)
      paintCrater(pix, cx, Math.round(top + rx * .5 + 2 + r() * 6), rx, Math.max(1.2, rx * .35), pc[3], pack('#e4e4ee'), NEAR_W)
    }
  }
  return pix.done()
}

// ---------------- あしば・いわ・かざり ----------------

/** のれる あしば 1マスぶん（part: ひだりはし・まんなか・みぎはし・1こだけ）。 */
export function platformTile(theme: Theme, part: 'l' | 'm' | 'r' | 's', seed: number): Img | null {
  const pix = Pix.create(16, 16)
  if (!pix) return null
  const p = theme.platform
  const [top, light, main, dark, outline] = [p.top, p.light, p.main, p.dark, p.outline].map(c => pack(c))
  const leftEnd = part === 'l' || part === 's', rightEnd = part === 'r' || part === 's'
  const r = rng(seed)
  for (let x = 0; x < 16; x++) {
    const inset = (leftEnd && x < 2 ? 2 - x : 0) + (rightEnd && x > 13 ? x - 13 : 0)
    for (let y = inset; y < 8 - Math.max(0, inset - 1); y++) {
      let c = y === inset ? top : y === 1 + inset ? light : y >= 6 ? dark : main
      if ((leftEnd && x === 0) || (rightEnd && x === 15) || y === 7 - Math.max(0, inset - 1)) c = outline
      if (y === 0 && inset === 0) c = outline
      if (p.kind === 'wood' && (x === 7 || x === 15) && y > 1 && y < 7) c = dark
      if (p.kind === 'wood' && (x === 3 || x === 11) && y === 3) c = outline
      if (p.kind === 'drift' && y > 1 && y < 7 && hash2(x, y, seed) < .18) c = light
      if (p.kind === 'drift' && (x === 5 || x === 12) && y > 0 && y < 7) c = y % 2 ? pack('#e8c880') : pack('#a88050')
      if (p.kind === 'ice' && y > 1 && y < 6 && (x + y * 2) % 9 === 0) c = top
      if (p.kind === 'stone' && y > 1 && y < 6 && hash2(x, y, seed) < .12) c = dark
      if (p.kind === 'stone' && x === 8 && y > 1 && y < 7) c = dark
      if (p.kind === 'star' && y > 1 && y < 6 && ((x === 7 && y > 1) || (y === 3 && x > 5 && x < 10))) c = top
      // さんごの ぶつぶつ。
      if (p.kind === 'coral' && y > 1 && y < 6 && (x * 3 + y * 5 + seed) % 7 === 0) c = c === main ? dark : light
      if (p.kind === 'coral' && y > 1 && y < 6 && (x * 3 + y * 5 + seed) % 7 === 1 && c === main) c = top
      // てつの いたと ネジ、したに きいろと くろの しましま。
      if (p.kind === 'metal' && y === 3 && (x === 3 || x === 12)) c = outline
      if (p.kind === 'metal' && y === 2 && (x === 3 || x === 12)) c = top
      if (p.kind === 'metal' && x === 8 && y > 1 && y < 5) c = dark
      if (p.kind === 'metal' && (y === 5 || y === 6) && c !== outline) c = ((x + y) >> 1) % 2 ? pack('#ffc830') : pack('#2a2a3a')
      pix.set(x, y, c)
    }
    if (p.kind === 'coral' && x > 1 && x < 15 && hash2(x, seed, 4) < .22) {
      const len = 1 + Math.floor(hash2(x, seed, 5) * 3)
      for (let k = 0; k < len; k++) pix.set(x, 8 + k, k === len - 1 ? light : main)
      pix.set(x, 8 + len, outline)
    }
    if (p.kind === 'ice' && x > 1 && x < 15 && r() < .35) {
      const len = 1 + Math.floor(r() * 5)
      for (let k = 0; k < len; k++) pix.set(x, 8 + k, k === len - 1 ? light : main)
      pix.set(x, 8 + len, outline)
    }
  }
  if (p.kind !== 'ice' && p.kind !== 'coral') for (let x = 1; x < 15; x++) if (hash2(x, 1, seed) < .5) pix.set(x, 8, pack(mixHex(p.outline, '#000000', .2), 90))
  return pix.done()
}

export function rockTile(theme: Theme, seed: number): Img | null {
  const { cap, ...pal } = theme.rock
  const base = spriteCanvas(ROCK, pal)
  const made = base && makeCanvas(16, 16)
  if (!made || !base) return base
  const { ctx } = made
  ctx.drawImage(base, 0, 0)
  const r = rng(seed)
  if (cap === 'snow' || cap === 'moss') {
    const colors = cap === 'snow' ? ['#ffffff', '#dcecff', '#a8c0e8'] : ['#a8f070', '#6cc846', '#3a8a30']
    for (let x = 1; x < 15; x++) {
      let top = 0
      while (top < 16 && ROCK[top][x] === '.') top++
      if (top >= 15) continue
      const depth = (cap === 'snow' ? 3 : 2) + Math.floor(r() * 2)
      for (let k = 0; k < depth; k++) {
        ctx.fillStyle = k === 0 ? colors[0] : k === depth - 1 ? colors[2] : colors[1]
        ctx.fillRect(x, top + k, 1, 1)
      }
    }
  } else if (cap === 'weed') {
    // いわの うえから のびる うみくさ。
    for (const [x0, len] of [[4, 5 + Math.floor(r() * 3)], [7, 7 + Math.floor(r() * 3)], [11, 4 + Math.floor(r() * 3)]]) {
      let top = 0
      while (top < 16 && ROCK[top][x0] === '.') top++
      for (let k = 0; k < len; k++) {
        const y = top - 1 - k
        if (y < 0) break
        const sx = x0 + (Math.floor(k / 2) % 2)
        ctx.fillStyle = '#0e3a2a'
        ctx.fillRect(sx + 1, y, 1, 1)
        ctx.fillStyle = k >= len - 2 ? '#8af0a0' : '#3ab86a'
        ctx.fillRect(sx, y, 1, 1)
      }
    }
    ctx.fillStyle = '#ff8ab0'
    ctx.fillRect(10, 9, 2, 1)
    ctx.fillRect(11, 8, 1, 1)
  } else if (cap === 'crater') {
    for (const [cx, cy, rr] of [[5, 7, 2], [10, 11, 1.5]]) {
      ctx.fillStyle = theme.rock.d
      ctx.fillRect(cx - Math.floor(rr), cy - 1, Math.ceil(rr * 2), 1)
      ctx.fillRect(cx - Math.floor(rr) + 1, cy, Math.ceil(rr * 2) - 1, 1)
      ctx.fillStyle = theme.rock.L
      ctx.fillRect(cx - Math.floor(rr) + 1, cy + 1, Math.ceil(rr * 2) - 1, 1)
    }
  } else if (cap === 'star') {
    const star = ['..o..', '.oyo.', 'oyyyo', '.oyo.', 'o...o']
    const img = spriteCanvas(star, { o: '#c04a2a', y: '#ff9a4a' })
    if (img) ctx.drawImage(img, 9, 8)
  }
  return made.canvas
}

/** じめんの うえの ちいさな かざり（はな・かいがら・ゆきの かたまり）。 */
export function decoSprites(theme: Theme): Img[] {
  const list: (readonly string[])[] = []
  const pals: Record<string, string>[] = []
  if (theme.deco === 'flowers') {
    for (const petal of ['#ff6a8a', '#fff070', '#ffffff', '#b890ff']) {
      list.push(['.p.', 'pyp', '.p.', '.g.', 'gg.'])
      pals.push({ p: petal, y: petal === '#fff070' ? '#ff9a3a' : '#ffd23a', g: '#3a9a3a' })
    }
    list.push(['g.g', 'g.g', '.g.'])
    pals.push({ g: '#3a9a3a' })
  } else if (theme.deco === 'shells') {
    list.push(['.oo.', 'owWo', 'oWWo', '.oo.'])
    pals.push({ o: '#c4708a', w: '#fff0f4', W: '#ffc8d8' })
    list.push(['..o..', '.oyo.', 'oyyyo', '.o.o.'])
    pals.push({ o: '#c05a2a', y: '#ff9a4a' })
    list.push(['.w.', 'wWw'])
    pals.push({ w: '#ffffff', W: '#d8e8f0' })
  } else if (theme.deco === 'pebbles') {
    list.push(['.oo.', 'oLlo', 'olmo'])
    pals.push({ o: '#3a2418', L: '#f0dcc4', l: '#c8a488', m: '#9a7458' })
    list.push(['..ooo..', '.oLllo.', 'oLllmmo', 'olmmmmo'])
    pals.push({ o: '#3a2418', L: '#f0dcc4', l: '#c8a488', m: '#9a7458' })
    list.push(['g.g', '.g.'])
    pals.push({ g: '#6a9a44' })
  } else if (theme.deco === 'stars') {
    list.push(['.y.', 'yWy', '.y.'])
    pals.push({ y: '#ffe070', W: '#ffffff' })
    list.push(['..y..', '..y..', 'yyWyy', '..y..', '..y..'])
    pals.push({ y: '#fff4b0', W: '#ffffff' })
    list.push(['.c.', 'cCc', 'cCc', '.c.'])
    pals.push({ c: '#8ae0ff', C: '#e0f8ff' })
  } else if (theme.deco === 'reef') {
    list.push(['g..g.', 'g.g.g', '.gg.g', '.g.g.', '..g..'])
    pals.push({ g: '#2a9a5a' })
    list.push(['p.p.p', 'ppPpp', '.pPp.', '..P..'])
    pals.push({ p: '#ff7aa0', P: '#c84a7a' })
    list.push(['..o..', '.oyo.', 'oyyyo', '.o.o.'])
    pals.push({ o: '#b8302a', y: '#ff6a4a' })
    list.push(['.oo.', 'owWo', 'oWWo', '.oo.'])
    pals.push({ o: '#8a7aa8', w: '#fff0f4', W: '#e0d0f0' })
  } else if (theme.deco === 'moonrocks') {
    list.push(['.oo.', 'oLlo', 'olmo'])
    pals.push({ o: '#2a2a3c', L: '#f0f0f6', l: '#c4c4d4', m: '#8a8aa2' })
    list.push(['..ooo..', '.oLllo.', 'oLllmmo', 'olmmmmo'])
    pals.push({ o: '#2a2a3c', L: '#f0f0f6', l: '#c4c4d4', m: '#8a8aa2' })
    list.push(['.c.', 'cCc', 'cCc', 'oco'])
    pals.push({ c: '#7ae0ff', C: '#e0fbff', o: '#3a5a8a' })
  } else {
    list.push(['.ww.', 'wwWw', 'WWWW'])
    pals.push({ w: '#ffffff', W: '#c4d8f4' })
    list.push(['..g..', '.gwg.', 'gwgwg', '..b..'])
    pals.push({ g: '#2a6a5a', w: '#ffffff', b: '#5a3a2a' })
  }
  return list.map((rows, i) => spriteCanvas(rows, pals[i])).filter((c): c is Img => !!c)
}

/** はいけいの おおきな もの（き・やしの き・もみの き）。 */
export function propSprite(theme: Theme, seed: number): Img | null {
  const r = rng(seed)
  if (theme.prop === 'tree') {
    const w = 34, h = 46
    const pix = Pix.create(w, h)
    if (!pix) return null
    const leaf = ['#b4ec70', '#7cd452', '#52b040', '#348838', '#22602c'].map(c => pack(c))
    const trunk = [pack('#a8703c'), pack('#7a4a26'), pack('#4a2a14')]
    for (let y = 26; y < h; y++) for (let x = 14; x < 20; x++) pix.set(x, y, x === 14 ? trunk[0] : x === 19 ? trunk[2] : trunk[1])
    const blobs = [{ x: 17, y: 16, r: 12 }, { x: 9, y: 22, r: 8 }, { x: 25, y: 21, r: 8.5 }, { x: 17, y: 8, r: 8 }]
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let best = -9
        for (const b of blobs) {
          const d = Math.hypot(x - b.x, y - b.y)
          if (d < b.r) best = Math.max(best, (b.x - x + b.y - y) / b.r - d / b.r * .6)
        }
        if (best === -9) continue
        const edge = !blobs.some(b => Math.hypot(x - b.x, y - b.y) < b.r - 1.2)
        const idx = edge ? 4 : best > .55 ? 0 : best > .15 ? (bayer(x, y) < .5 ? 0 : 1) : best > -.3 ? (bayer(x, y) < .5 ? 1 : 2) : best > -.7 ? 2 : 3
        pix.set(x, y, leaf[idx])
      }
    }
    for (let i = 0; i < 5; i++) {
      const x = 6 + Math.floor(r() * 22), y = 8 + Math.floor(r() * 18)
      if (pix.has(x, y)) { pix.set(x, y, pack('#ff4a5a')); pix.set(x + 1, y, pack('#c02a3a')); pix.set(x, y - 1, pack('#ffa0a0')) }
    }
    return pix.done()
  }
  if (theme.prop === 'none') return null
  if (theme.prop === 'seaweed') return seed % 3 === 0 ? coralSprite(r) : kelpSprite(r)
  if (theme.prop === 'space') return seed % 2 === 0 ? landerSprite() : flagSprite()
  if (theme.prop === 'cactus') {
    const w = 22, h = 40
    const pix = Pix.create(w, h)
    if (!pix) return null
    const green = [pack('#a8e070'), pack('#6ab448'), pack('#3e8a38'), pack('#1c4a24')]
    const trunk = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const edge = x === x0 || x === x1 || y === y0
          pix.set(x, y, edge ? green[3] : x === x0 + 1 ? green[0] : x === x1 - 1 ? green[2] : (x - x0) % 2 ? green[1] : green[2])
        }
      }
    }
    const armL = 8 + Math.floor(r() * 8), armR = 6 + Math.floor(r() * 8)
    trunk(8, 2, 14, h - 1)
    trunk(2, armL, 6, armL + 12)
    trunk(3, armL + 10, 9, armL + 14)
    trunk(16, armR, 20, armR + 10)
    trunk(13, armR + 8, 19, armR + 12)
    for (let i = 0; i < 3; i++) pix.set(10 + i, 1, pack(['#ff6a8a', '#ffe070', '#ff6a8a'][i]))
    return pix.done()
  }
  if (theme.prop === 'palm') {
    const w = 44, h = 60
    const pix = Pix.create(w, h)
    if (!pix) return null
    const bark = [pack('#e0a060'), pack('#b07040'), pack('#7a4a2a'), pack('#4a2a1a')]
    const lean = r() < .5 ? -1 : 1
    let tx = 22
    for (let k = 0; k < 42; k++) {
      tx = 22 + lean * Math.pow(k / 42, 1.6) * 9
      const y = h - 1 - k
      for (let dx = -2; dx <= 2; dx++) {
        const ring = k % 4 === 0
        pix.set(Math.round(tx) + dx, y, dx === -2 || dx === 2 ? bark[3] : ring ? bark[2] : dx < 0 ? bark[0] : bark[1])
      }
    }
    const leaf = [pack('#8ad060'), pack('#4a9a44'), pack('#2a6a34'), pack('#1a4424')]
    const cx = Math.round(tx), cy = h - 44
    for (let f = 0; f < 6; f++) {
      const dir = f < 3 ? -1 : 1
      const spread = (f % 3) / 2
      const len = 17 + r() * 4
      for (let k = 0; k < len; k++) {
        const t = k / len
        const x = cx + dir * k
        const y = cy - (1 - spread) * 7 * Math.sin(t * Math.PI * .8) + spread * t * 10 + t * t * 8
        const thick = Math.max(1, Math.round(3 * (1 - t)))
        for (let d = -1; d < thick; d++) pix.set(Math.round(x), Math.round(y) + d, d === -1 ? leaf[3] : d === 0 ? leaf[0] : leaf[d === thick - 1 ? 2 : 1])
      }
    }
    for (const [dx, dy] of [[-2, 2], [1, 3], [3, 1]]) {
      pix.set(cx + dx, cy + dy, pack('#6a4a2a'))
      pix.set(cx + dx + 1, cy + dy, pack('#4a2a14'))
    }
    return pix.done()
  }
  const w = 30, h = 50
  const pix = Pix.create(w, h)
  if (!pix) return null
  const green = [pack('#3a8a78'), pack('#2a6a60'), pack('#1c4a4a'), pack('#123236')]
  const snow = [pack('#ffffff'), pack('#d4e4fa'), pack('#9ab4dc')]
  for (let y = h - 8; y < h; y++) for (let x = 13; x < 17; x++) pix.set(x, y, x === 13 ? pack('#8a5a3a') : pack('#5a3420'))
  const tiers = 4
  for (let t = 0; t < tiers; t++) {
    const top = 2 + t * 9, bottom = top + 14
    for (let y = top; y < bottom; y++) {
      const k = (y - top) / (bottom - top)
      const half = 3 + k * (5 + t * 2.4)
      for (let x = Math.round(15 - half); x <= 15 + half; x++) {
        const edge = y === bottom - 1 || Math.abs(x - 15) > half - 1
        const snowy = y - top < 3 + (hash2(x, t, seed) < .5 ? 1 : 0) - Math.abs(x - 15) * .15
        pix.set(x, y, snowy ? snow[x < 15 ? 0 : 1] : edge ? green[3] : x < 15 - half * .3 ? green[0] : x < 15 + half * .3 ? green[1] : green[2])
      }
    }
    for (let x = Math.round(15 - (8 + t * 2.4)); x < 15 + 8 + t * 2.4; x++) if (hash2(x, t, 9) < .3) pix.set(x, bottom, snow[2])
  }
  return pix.done()
}

/** ゆらゆら のびる こんぶ（3〜4ほん）。 */
function kelpSprite(r: () => number): Img | null {
  const w = 26, h = 56
  const pix = Pix.create(w, h)
  if (!pix) return null
  const green = ['#8af0a0', '#4ac070', '#2a9058', '#1a6040', '#0e3a2a'].map(c => pack(c))
  const count = 3 + Math.floor(r() * 2)
  for (let s = 0; s < count; s++) {
    const bx = 6 + s * (14 / (count - 1)), len = 30 + r() * 24, phase = r() * 6
    for (let i = 0; i < len; i++) {
      const y = h - 1 - i
      const x = Math.round(bx + Math.sin(i * .14 + phase) * 3)
      pix.set(x - 1, y, green[4])
      pix.set(x, y, green[2])
      pix.set(x + 1, y, green[4])
      // は（ひだりと みぎに こうごに）。
      if (i > 5 && i % 7 === 0) {
        const dir = (i / 7) % 2 ? 1 : -1
        for (let k = 1; k < 5; k++) {
          pix.set(x + dir * k, y - Math.floor(k / 2), k === 4 ? green[3] : green[1])
          pix.set(x + dir * k, y - Math.floor(k / 2) + 1, green[3])
        }
        pix.set(x + dir, y - 1, green[0])
      }
    }
    const top = Math.round(h - len)
    pix.set(Math.round(bx + Math.sin(len * .14 + phase) * 3), top, green[0])
  }
  return pix.done()
}

/** えだわかれした さんご。 */
function coralSprite(r: () => number): Img | null {
  const w = 34, h = 38
  const pix = Pix.create(w, h)
  if (!pix) return null
  const palettes = [['#ffd0e0', '#ff8ab0', '#e05a8a', '#8a2a50'], ['#ffe0a0', '#ffb04a', '#e07a20', '#8a3a10'], ['#e8d8ff', '#b890ff', '#8a5ad8', '#4a2a8a']]
  const [L, m, d, o] = palettes[Math.floor(r() * palettes.length)].map(c => pack(c))
  const branch = (x: number, y: number, ang: number, len: number, depth: number) => {
    for (let i = 0; i < len; i++) {
      const px = Math.round(x + Math.cos(ang) * i), py = Math.round(y + Math.sin(ang) * i)
      const thick = depth === 0 ? 2 : 1
      for (let t = -thick; t <= thick; t++) pix.set(px + t, py, t === -thick || t === thick ? o : t < 0 ? L : t > 0 ? d : m)
    }
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len
    if (depth < 2) {
      branch(ex, ey, ang - .5 - r() * .3, len * .7, depth + 1)
      branch(ex, ey, ang + .5 + r() * .3, len * .7, depth + 1)
    } else {
      pix.set(Math.round(ex), Math.round(ey) - 1, o)
      pix.set(Math.round(ex), Math.round(ey), L)
    }
  }
  branch(17, h - 1, -Math.PI / 2, 11, 0)
  return pix.done()
}

/** つきに おりた ちいさな ちゃくりくせん。 */
function landerSprite(): Img | null {
  return spriteCanvas([
    '...........o..........',
    '..........oyo.........',
    '...........o..........',
    '........ooooooo.......',
    '.......oCccccCCo......',
    '......oCcwcccCCCo.....',
    '......occcccccCCo.....',
    '....oooooooooooooo....',
    '...oGgggYgggYgggGGo...',
    '...oGggygggygggGGGo...',
    '...oGgggggggggggGGo...',
    '...oGGGGGGGGGGGGGGo...',
    '....oooooooooooooo....',
    '....o.o...oo...o.o....',
    '...o..o..oddo..o..o...',
    '..o...o..oddo..o...o..',
    '.o....o...oo...o....o.',
    'ooo...o........o...ooo',
  ], { o: '#1a1a2a', y: '#ff5a6a', c: '#c8f0ff', C: '#7ab0d8', w: '#ffffff', G: '#c08a10', g: '#ffd23c', Y: '#fff0a0', d: '#4a4a62' })
}

/** つきに たてた うさぎの はた（にんじんの もよう）。 */
function flagSprite(): Img | null {
  return spriteCanvas([
    '.oo............',
    'oYyoooooooooooo',
    'oSsowwwwwwwwwWo',
    'oSsowwwwgGwwwWo',
    'oSsowwwwwgwwwWo',
    'oSsowwwOOOwwwWo',
    'oSsowwwOOqwwwWo',
    'oSsowwwwOOwwwWo',
    'oSsowwwwOqwwwWo',
    'oSsowwwwwOwwwWo',
    'oSsoWWWWWWWWWWo',
    'oSsooooooooooo.',
    'oSso...........',
    'oSso...........',
    'oSso...........',
    'oSso...........',
    'oSso...........',
    'oSso...........',
    'oSso...........',
    'oSso...........',
    'oSso...........',
    'oSso...........',
    'oSso...........',
    'oSso...........',
    'oSso...........',
    'oSso...........',
    'oooooo.........',
  ], { o: '#1e2230', S: '#f0f4fa', s: '#8a94a8', Y: '#fff0a0', y: '#ffc830', w: '#ffffff', W: '#c8d0e4', O: '#ff8a1e', q: '#d8560c', g: '#1f7a32', G: '#5ed05a' })
}

// ---------------- メダル・あわ ----------------

/** まわる ほしメダル（6コマ）。 */
export function medalFrames(): Img[] {
  const frames: Img[] = []
  for (let f = 0; f < 6; f++) {
    const pix = Pix.create(16, 16)
    if (!pix) return []
    const k = Math.abs(Math.cos(f / 6 * Math.PI))
    const rx = Math.max(1.2, 7.5 * k), ry = 7.5
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const nx = (x - 7.5) / rx, ny = (y - 7.5) / ry
        const d = Math.hypot(nx, ny)
        if (d > 1) continue
        let color = d > .82 ? '#8a4a00' : d > .64 ? '#e89a10' : '#ffd23c'
        if (k < .3) color = d > .8 ? '#8a4a00' : '#ffb020'
        if (d <= .64 && nx < -.1 && ny < -.1 && k > .3) color = '#fff09a'
        if (d > .64 && d <= .82 && nx + ny > .4) color = '#b86a00'
        // まんなかの ほし。
        if (k > .5) {
          const sx = nx / .6, sy = ny / .6
          const ang = Math.atan2(sy, sx) + Math.PI / 2
          const rr = Math.hypot(sx, sy)
          const star = .45 + .45 * Math.pow(Math.abs(Math.cos(ang * 2.5)), 3)
          if (rr < star) color = rr < star - .25 || nx < 0 ? '#ffffff' : '#ffe8a0'
        }
        pix.set(x, y, pack(color))
      }
    }
    frames.push(pix.done())
  }
  return frames
}

export function bubbleSprite(): Img | null {
  const size = 30
  const pix = Pix.create(size, size)
  if (!pix) return null
  const c = size / 2 - .5
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c)
      if (d > 14) continue
      const ang = Math.atan2(y - c, x - c)
      if (d > 12.8) pix.set(x, y, pack('#e8fbff'))
      else if (d > 11.6) pix.set(x, y, pack('#9ee0ff', 200))
      else if (d > 7 && ang > -2.6 && ang < -1.7 && d < 10) pix.set(x, y, pack('#ffffff'))
      else if ((x + y) % 2 === 0 && d > 9) pix.set(x, y, pack('#bfefff', 110))
      else pix.set(x, y, pack('#8ad8ff', 50))
    }
  }
  pix.set(Math.round(c + 6), Math.round(c + 5), pack('#ffffff'))
  pix.set(Math.round(c + 7), Math.round(c + 4), pack('#ffffff'))
  return pix.done()
}
