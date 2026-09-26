// 木・いわ・しげみ・スライム などを「たかさの 地図」から つくる。
// まるい かたまり（ボール）を かさね、ひかりの むき（ひだり上）から 明るさを きめて、
// パレットの 段に わける。りんかくは ひかりの がわだけ すこし あかるい 色に する（SFC の ぬりかた）。

import { bayer, canvasFromPixels, fbm, hash2, pack, rampIndex, valueNoise } from './pixel'

export type Ball = { x: number; y: number; r: number; ry?: number; z?: number }

const LIGHT = (() => {
  const v = [-.55, -.75, .62]
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l] as const
})()

export type BlobOptions = {
  ramp: readonly string[]
  outline: string
  /** ひかりの がわの りんかく。なければ ramp[0]。 */
  outlineLight?: string
  /** はっぱの ような こまかい でこぼこ。 */
  texture?: { scale: number; amount: number; seed: number }
  ambient?: number
  /** かたまりの さかいめを こく する（木の はっぱの かたまり）。 */
  seams?: boolean
  /** つやの 色（スライムなど）。 */
  spec?: string
  /** 下がわの はんしゃ光（すきとおった かんじ）。 */
  rim?: string
  /** ひかりを うける 上の めんに のせる 色（こけ・ゆき）。 */
  cap?: { ramp: readonly string[]; threshold: number; seed: number }
}

type Layer = { w: number; h: number; pixels: Uint32Array }

function newLayer(w: number, h: number): Layer {
  return { w, h, pixels: new Uint32Array(w * h) }
}

/** ボールを かさねた かたまりを layer に かきこむ。 */
export function paintBlobs(layer: Layer, balls: readonly Ball[], o: BlobOptions) {
  const { w, h } = layer
  const topZ = new Float32Array(w * h).fill(-1)
  const topBall = new Int16Array(w * h).fill(-1)
  const nx = new Float32Array(w * h), ny = new Float32Array(w * h), nz = new Float32Array(w * h)
  balls.forEach((b, i) => {
    const ry = b.ry ?? b.r
    const x0 = Math.max(0, Math.floor(b.x - b.r)), x1 = Math.min(w - 1, Math.ceil(b.x + b.r))
    const y0 = Math.max(0, Math.floor(b.y - ry)), y1 = Math.min(h - 1, Math.ceil(b.y + ry))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + .5 - b.x) / b.r, dy = (y + .5 - b.y) / ry
      const d2 = dx * dx + dy * dy
      if (d2 >= 1) continue
      const zz = Math.sqrt(1 - d2)
      const z = zz * Math.min(b.r, ry) + (b.z ?? 0)
      const k = y * w + x
      if (z > topZ[k]) {
        topZ[k] = z; topBall[k] = i
        const l = Math.hypot(dx, dy, zz)
        nx[k] = dx / l; ny[k] = dy / l; nz[k] = zz / l
      }
    }
  })
  const ramp = o.ramp.map(c => pack(c))
  const capRamp = o.cap?.ramp.map(c => pack(c))
  const spec = o.spec ? pack(o.spec) : 0
  const rim = o.rim ? pack(o.rim) : 0
  const ambient = o.ambient ?? .22
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x
    if (topBall[k] < 0) continue
    let t = ambient + (1 - ambient) * Math.max(0, nx[k] * LIGHT[0] + ny[k] * LIGHT[1] + nz[k] * LIGHT[2])
    if (o.texture) {
      const n = valueNoise(x / o.texture.scale, y / o.texture.scale, o.texture.seed) - .5
      const n2 = hash2(x, y, o.texture.seed) - .5
      t += n * o.texture.amount + n2 * o.texture.amount * .35
    }
    if (o.seams) {
      // となりの ボールが 手前（より 高い）なら、その ふちの かげに なる。
      for (const [ox, oy] of [[1, 1], [0, 1], [-1, 1], [0, 2]] as const) {
        const xx = x + ox, yy = y + oy
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
        const kk = yy * w + xx
        if (topBall[kk] >= 0 && topBall[kk] !== topBall[k] && topZ[kk] > topZ[k] + 1.2) { t -= oy === 2 ? .12 : .28; break }
      }
    }
    let color = ramp[rampIndex(t, ramp.length, x, y, .55)]
    if (capRamp && o.cap && ny[k] < -.25) {
      const c = fbm(x / 4, y / 4, o.cap.seed, 2)
      if (c > o.cap.threshold - ny[k] * .35) color = capRamp[rampIndex(t, capRamp.length, x, y, .5)]
    }
    if (spec) {
      // つやは ひかりの むきに いちばん 近い ところに 小さく。
      const d = nx[k] * LIGHT[0] + ny[k] * LIGHT[1] + nz[k] * LIGHT[2]
      if (d > .965) color = spec
    }
    if (rim && ny[k] > .55 && nz[k] < .55 && ((x + y) & 1) === 0) color = rim
    layer.pixels[k] = color
  }
  outline(layer, o.outline, o.outlineLight ?? o.ramp[0])
}

/** とうめいの となりに りんかくを つける。ひかりの がわ（ひだり上）は すこし あかるく。 */
export function outline(layer: Layer, dark: string, light: string) {
  const { w, h, pixels } = layer
  const src = pixels.slice()
  const D = pack(dark), L = pack(light)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x
    if (src[k]) continue
    const right = x + 1 < w && src[k + 1] !== 0, down = y + 1 < h && src[k + w] !== 0
    const left = x > 0 && src[k - 1] !== 0, up = y > 0 && src[k - w] !== 0
    if (left || up) pixels[k] = D
    else if (right || down) pixels[k] = L
  }
}

function toCanvas(layer: Layer) {
  return canvasFromPixels(layer.w, layer.h, layer.pixels)
}

/** たてに ながい つつ（みき・はしら）を ぬる。 */
function paintCylinder(layer: Layer, cx: number, top: number, bottom: number, r: number, ramp: readonly string[], seed: number, bark = .18, stripe = 0) {
  const pr = ramp.map(c => pack(c))
  for (let y = Math.max(0, Math.floor(top)); y < Math.min(layer.h, bottom); y++) {
    for (let x = Math.floor(cx - r); x < Math.ceil(cx + r); x++) {
      if (x < 0 || x >= layer.w) continue
      const dx = (x + .5 - cx) / r
      if (Math.abs(dx) >= 1) continue
      const nz = Math.sqrt(1 - dx * dx)
      let t = .15 + .85 * Math.max(0, dx * LIGHT[0] + nz * LIGHT[2] * .9)
      t += (hash2(x, Math.floor(y / 3), seed) - .5) * bark
      if (stripe && Math.floor(x - cx + 64) % stripe === 0) t -= .15
      layer.pixels[y * layer.w + x] = pr[rampIndex(t, pr.length, x, y, .5)]
    }
  }
}

// ---------------- 木 ----------------

export type TreeStyle = {
  leaves: readonly string[]
  leafOutline: string
  trunk: readonly string[]
  trunkOutline: string
  fruit?: string
}

/** まるい はっぱの 大きな 木（48x60）。足もとは (24, 56)。 */
export function treeCanvas(style: TreeStyle, seed: number) {
  const layer = newLayer(48, 60)
  // みき と ねっこ。
  const trunk = newLayer(48, 60)
  paintCylinder(trunk, 24, 30, 56, 5, style.trunk, seed, .3)
  paintBlobs(trunk, [{ x: 18, y: 55, r: 4, ry: 2.2 }, { x: 30, y: 55, r: 4, ry: 2.2 }, { x: 24, y: 56, r: 5, ry: 2 }], { ramp: style.trunk, outline: style.trunkOutline, ambient: .3 })
  for (let y = 30; y < 56; y++) for (let x = 18; x < 31; x++) {
    const k = y * 48 + x
    if (!trunk.pixels[k]) {
      const dx = Math.abs(x + .5 - 24)
      if (dx < 5) trunk.pixels[k] = pack(style.trunk[1])
    }
  }
  paintCylinder(trunk, 24, 30, 54, 5, style.trunk, seed, .3)
  outline(trunk, style.trunkOutline, style.trunk[0])
  layer.pixels.set(trunk.pixels)
  const r = (n: number) => (hash2(n, seed, 7) - .5)
  const balls: Ball[] = [
    { x: 24 + r(1) * 3, y: 9 + r(2) * 2, r: 8, z: 0 },
    { x: 15 + r(3) * 2, y: 15 + r(4) * 2, r: 8.5, z: 1 },
    { x: 33 + r(5) * 2, y: 15 + r(6) * 2, r: 8.5, z: 1 },
    { x: 24, y: 20 + r(7) * 2, r: 10, z: 3 },
    { x: 9 + r(8) * 2, y: 26 + r(9), r: 8, z: 4 },
    { x: 39 + r(10) * 2, y: 26 + r(11), r: 8, z: 4 },
    { x: 18 + r(12) * 2, y: 32, r: 9, ry: 7.5, z: 6 },
    { x: 31 + r(13) * 2, y: 32, r: 9, ry: 7.5, z: 6 },
  ]
  const canopy = newLayer(48, 60)
  paintBlobs(canopy, balls, {
    ramp: style.leaves, outline: style.leafOutline, outlineLight: style.leaves[1],
    texture: { scale: 2.2, amount: .42, seed }, seams: true, ambient: .12,
  })
  if (style.fruit) {
    const fruit = pack(style.fruit), shine = pack('#ffffff')
    for (let i = 0; i < 5; i++) {
      const fx = Math.floor(10 + hash2(i, seed, 3) * 28), fy = Math.floor(12 + hash2(i, seed, 4) * 22)
      if (canopy.pixels[fy * 48 + fx] && canopy.pixels[(fy + 1) * 48 + fx + 1]) {
        canopy.pixels[fy * 48 + fx] = shine
        canopy.pixels[fy * 48 + fx + 1] = fruit
        canopy.pixels[(fy + 1) * 48 + fx] = fruit
        canopy.pixels[(fy + 1) * 48 + fx + 1] = fruit
      }
    }
  }
  for (let k = 0; k < canopy.pixels.length; k++) if (canopy.pixels[k]) layer.pixels[k] = canopy.pixels[k]
  return toCanvas(layer)
}

// ---------------- しげみ・いわ ----------------

export function bushCanvas(style: TreeStyle, seed: number) {
  const layer = newLayer(22, 18)
  const r = (n: number) => (hash2(n, seed, 11) - .5) * 2
  paintBlobs(layer, [
    { x: 11 + r(1), y: 6, r: 5.5, z: 0 },
    { x: 6, y: 9 + r(2), r: 5, z: 1 },
    { x: 16, y: 9 + r(3), r: 5, z: 1 },
    { x: 11, y: 11.5, r: 6.5, ry: 5, z: 3 },
  ], { ramp: style.leaves, outline: style.leafOutline, outlineLight: style.leaves[1], texture: { scale: 2, amount: .38, seed }, seams: true, ambient: .15 })
  if (style.fruit) {
    const fruit = pack(style.fruit), shine = pack('#ffffff')
    for (const [fx, fy] of [[7, 7], [14, 6], [11, 11], [16, 11]]) {
      if (!layer.pixels[fy * 22 + fx] || hash2(fx, fy, seed) < .25) continue
      layer.pixels[fy * 22 + fx] = shine
      layer.pixels[fy * 22 + fx + 1] = fruit
      layer.pixels[(fy + 1) * 22 + fx] = fruit
    }
  }
  return toCanvas(layer)
}

export type RockStyle = { ramp: readonly string[]; outline: string; moss?: readonly string[] }

export function rockCanvas(style: RockStyle, seed: number) {
  const layer = newLayer(22, 17)
  const r = (n: number) => (hash2(n, seed, 21) - .5) * 2
  paintBlobs(layer, [
    { x: 10 + r(1), y: 9, r: 8, ry: 6.5, z: 0 },
    { x: 14 + r(2), y: 10.5, r: 6, ry: 5, z: 1.5 },
    { x: 7, y: 11.5 + r(3) * .5, r: 5, ry: 4, z: 2 },
  ], {
    ramp: style.ramp, outline: style.outline, texture: { scale: 3, amount: .3, seed }, ambient: .2, seams: true,
    cap: style.moss ? { ramp: style.moss, threshold: .55, seed } : undefined,
  })
  return toCanvas(layer)
}

/** しかけの おおきな いわ（28x24）。足もとは (14, 22)。 */
export function boulderCanvas(style: RockStyle) {
  const layer = newLayer(28, 24)
  paintBlobs(layer, [
    { x: 14, y: 12, r: 11.5, ry: 10.5, z: 0 },
    { x: 18.5, y: 15.5, r: 7, ry: 6, z: 3 },
    { x: 8.5, y: 16, r: 6.5, ry: 5.5, z: 3 },
  ], {
    ramp: style.ramp, outline: style.outline, texture: { scale: 3.5, amount: .28, seed: 7 }, ambient: .2, seams: true,
    cap: style.moss ? { ramp: style.moss, threshold: .5, seed: 7 } : undefined,
  })
  return toCanvas(layer)
}

// ---------------- スライム ----------------

export type SlimeStyle = { ramp: readonly string[]; outline: string; rim: string }

/** はねる スライムの コマ。w×h は からだの 大きさ（つぶれる・のびる）。 */
export function slimeCanvas(style: SlimeStyle, w: number, h: number, blink = false) {
  const W = 20, H = 18
  const layer = newLayer(W, H)
  const cx = W / 2, by = H - 1
  const top = by - h
  // したが たいらな しずくの かたち。
  paintBlobs(layer, [
    { x: cx, y: top + h * .62, r: w / 2, ry: h * .62, z: 0 },
    { x: cx - w * .05, y: top + h * .45, r: w * .36, ry: h * .45, z: 1.5 },
  ], { ramp: style.ramp, outline: style.outline, outlineLight: style.ramp[1], spec: '#ffffff', rim: style.rim, ambient: .28 })
  // ゆかに ふれる ところは まっすぐに する。
  for (let x = 0; x < W; x++) for (let y = by; y < H; y++) layer.pixels[y * W + x] = 0
  for (let x = 0; x < W; x++) {
    if (layer.pixels[(by - 1) * W + x]) layer.pixels[(by - 1) * W + x] = pack(style.outline)
  }
  // め と くち。
  const eyeY = Math.round(top + h * .5)
  const eye = pack('#1a1030'), white = pack('#ffffff')
  const ex = [Math.round(cx - w * .2) - 1, Math.round(cx + w * .16)]
  for (const x of ex) {
    if (blink) { layer.pixels[(eyeY + 1) * W + x] = eye; layer.pixels[(eyeY + 1) * W + x + 1] = eye; continue }
    layer.pixels[eyeY * W + x] = eye
    layer.pixels[(eyeY + 1) * W + x] = eye
    layer.pixels[eyeY * W + x + 1] = white
    layer.pixels[(eyeY + 1) * W + x + 1] = eye
  }
  const my = eyeY + 3
  if (my < by - 1) {
    layer.pixels[my * W + Math.round(cx) - 1] = pack(style.outline)
    layer.pixels[my * W + Math.round(cx)] = pack(style.outline)
  }
  // ほっぺ。
  const blush = pack('#ff8aa8')
  if (eyeY + 2 < by - 1) {
    layer.pixels[(eyeY + 2) * W + ex[0] - 1] = blush
    layer.pixels[(eyeY + 2) * W + ex[1] + 2] = blush
  }
  return toCanvas(layer)
}

// ---------------- ヤシの木 ----------------

export type PalmStyle = { trunk: readonly string[]; trunkOutline: string; leaves: readonly string[]; leafOutline: string }

/** ヤシの木（64x72）。足もとは (32, 68)。 */
export function palmCanvas(style: PalmStyle, seed: number) {
  const W = 64, H = 72
  const layer = newLayer(W, H)
  const lean = hash2(seed, 1, 31) > .5 ? 1 : -1
  // みきは ふしの ある わを つみかさねる。
  const trunkBalls: Ball[] = []
  for (let i = 0; i <= 10; i++) {
    const t = i / 10
    trunkBalls.push({ x: 32 + lean * (Math.sin(t * 1.4) * 7), y: 67 - t * 38, r: 3.6 - t * .8, ry: 2.6, z: i * .01 })
  }
  paintBlobs(layer, trunkBalls, { ramp: style.trunk, outline: style.trunkOutline, seams: true, ambient: .25 })
  const crownX = 32 + lean * Math.sin(1.4) * 7, crownY = 27
  // はっぱは 大きな カーブに そって 小さな ボールを ならべる。
  const leaves = newLayer(W, H)
  const balls: Ball[] = []
  // はっぱは かんむりから まわりへ ひろがり、さきが したへ たれる。
  const fronds = [-2.75, -2.2, -1.62, -1.05, -.45, .15, .75, 2.4, 3.0]
  fronds.forEach((a, i) => {
    const len = 16 + hash2(i, seed, 5) * 5
    const back = Math.sin(a) < 0
    for (let s = 0; s <= 1.001; s += .06) {
      const x = crownX + Math.cos(a) * len * s
      const y = crownY + Math.sin(a) * len * s * .6 + s * s * (back ? 13 : 8)
      const r = .9 + 3 * Math.sin(Math.PI * (s * .8 + .2))
      balls.push({ x, y, r, ry: r * .62, z: (back ? 1 : 5) - s * 2 })
    }
  })
  balls.push({ x: crownX, y: crownY + 1, r: 4, ry: 3, z: 5 })
  paintBlobs(leaves, balls, { ramp: style.leaves, outline: style.leafOutline, outlineLight: style.leaves[1], texture: { scale: 1.6, amount: .45, seed }, seams: true, ambient: .15 })
  for (let k = 0; k < leaves.pixels.length; k++) if (leaves.pixels[k]) layer.pixels[k] = leaves.pixels[k]
  // ココナッツ。
  const nut = newLayer(W, H)
  paintBlobs(nut, [{ x: crownX - 3, y: crownY + 5, r: 2.4 }, { x: crownX + 2, y: crownY + 6, r: 2.4 }], { ramp: ['#3a2410', '#6a4020', '#9a6030', '#c89050'], outline: '#1c1008', spec: '#ffe0b0' })
  for (let k = 0; k < nut.pixels.length; k++) if (nut.pixels[k]) layer.pixels[k] = nut.pixels[k]
  return toCanvas(layer)
}

// ---------------- いせきの はしら・たいまつ ----------------

export type StoneStyle = { ramp: readonly string[]; outline: string; moss: readonly string[] }

/** はしら（20x48）。broken で おれた はしら。足もとは (10, 46)。 */
export function pillarCanvas(style: StoneStyle, seed: number, broken: boolean) {
  const W = 20, H = 48
  const layer = newLayer(W, H)
  const top = broken ? 24 + Math.floor(hash2(seed, 2, 9) * 6) : 7
  // だいざ。
  paintBlobs(layer, [{ x: 10, y: 43, r: 9, ry: 4 }], { ramp: style.ramp, outline: style.outline, ambient: .25 })
  for (let y = 40; y < 46; y++) for (let x = 1; x < 19; x++) {
    const t = x < 3 ? .8 : x > 16 ? .25 : .55 - (y - 40) * .05
    layer.pixels[y * W + x] = pack(style.ramp[rampIndex(t, style.ramp.length, x, y)])
  }
  paintCylinder(layer, 10, top, 41, 6.5, style.ramp, seed, .12, 3)
  if (!broken) {
    // うえの かざり。
    for (let y = 2; y < 8; y++) for (let x = 1; x < 19; x++) {
      const t = y < 4 ? .9 - x * .02 : x < 3 ? .7 : x > 16 ? .2 : .45
      layer.pixels[y * W + x] = pack(style.ramp[rampIndex(t, style.ramp.length, x, y)])
    }
  } else {
    // おれた ところは ぎざぎざ。
    for (let x = 3; x < 17; x++) {
      const cut = Math.floor(hash2(x, seed, 17) * 4)
      for (let y = top; y < top + cut; y++) layer.pixels[y * W + x] = 0
      const k = (top + cut) * W + x
      if (layer.pixels[k]) layer.pixels[k] = pack(style.ramp[style.ramp.length - 2])
    }
  }
  // こけ と つた。
  const moss = style.moss.map(c => pack(c))
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x
    if (!layer.pixels[k]) continue
    const v = fbm(x / 3, y / 5, seed + 3, 2)
    const lower = y / H
    if (v > .72 - lower * .22) layer.pixels[k] = moss[rampIndex(.35 + (x < 10 ? .3 : 0) + (v - .6), moss.length, x, y)]
  }
  // ひび。
  const crack = pack(style.outline)
  let cx = 6 + Math.floor(hash2(seed, 5, 1) * 8), cy = top + 6
  for (let i = 0; i < 9 && cy < 38; i++) {
    layer.pixels[cy * W + cx] = crack
    cy++
    cx += hash2(i, seed, 8) < .33 ? -1 : hash2(i, seed, 8) > .66 ? 1 : 0
    cx = Math.max(5, Math.min(14, cx))
  }
  outline(layer, style.outline, style.ramp[0])
  return toCanvas(layer)
}

/** いしの だいに のった たいまつ（16x22）。火は べつに うごかす。足もとは (8, 21)。 */
export function brazierCanvas(style: StoneStyle) {
  const layer = newLayer(16, 22)
  paintBlobs(layer, [{ x: 8, y: 19, r: 5, ry: 2.5 }], { ramp: style.ramp, outline: style.outline })
  paintCylinder(layer, 8, 11, 19, 2.6, style.ramp, 4, .1)
  paintBlobs(layer, [{ x: 8, y: 10, r: 7, ry: 3.4 }], { ramp: style.ramp, outline: style.outline, ambient: .25 })
  // うつわの なかは こげた いろ。
  for (let x = 3; x < 13; x++) for (let y = 8; y < 10; y++) {
    const dx = (x + .5 - 8) / 5.5, dy = (y + .5 - 9) / 1.6
    if (dx * dx + dy * dy < 1) layer.pixels[y * 16 + x] = pack(y === 8 ? '#2a1408' : '#5a2a0c')
  }
  outline(layer, style.outline, style.ramp[0])
  return toCanvas(layer)
}

/** ゆらめく 火の コマ（12x16）。 */
export function flameCanvas(frame: number) {
  const W = 12, H = 16
  const layer = newLayer(W, H)
  const cols = ['#9a1c10', '#e04a14', '#ff9a1c', '#ffe060', '#fffbe0'].map(c => pack(c))
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = (H - y) / H
    const sway = Math.sin(v * 5 + frame * 1.7) * v * 1.6
    const dx = (x + .5 - 6 - sway) / (4.6 * Math.sqrt(1 - v) + .4)
    const n = valueNoise(x / 2.2, y / 2.2 + frame * 1.3, 77) * .5
    const heat = 1 - Math.abs(dx) - v * .55 + n - .12
    if (heat <= 0) continue
    layer.pixels[y * W + x] = cols[Math.min(4, Math.floor(heat * 5.2 + bayer(x, y) * .6))]
  }
  return toCanvas(layer)
}

// ---------------- ほしの かけら ----------------

/** くるくる まわる ほしの かけら（15x15）。angle は 0〜2π。 */
export function shardCanvas(angle: number, ramp: readonly string[], outlineColor: string) {
  const W = 15, H = 15
  const layer = newLayer(W, H)
  const sx = Math.max(.22, Math.abs(Math.cos(angle)))
  const face = Math.cos(angle) >= 0 ? 1 : -1
  const cx = 7.5, cy = 7.8
  const pr = ramp.map(c => pack(c))
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px = (x + .5 - cx) / sx, py = y + .5 - cy
    const a = Math.atan2(py, px)
    const d = Math.hypot(px, py)
    // 5つの とがりを もつ ほし。
    const spike = Math.cos((a + Math.PI / 2) * 5)
    const radius = 3.2 + (spike > 0 ? spike * 3.8 : spike * .4)
    if (d > radius) continue
    // めんの むきで あかるさを かえる（きりこの かがやき）。
    const sector = Math.floor(((a + Math.PI / 2) / (Math.PI * 2 / 10)) + 20) % 2
    let t = .95 - d / radius * .55 + (sector ? .12 : -.12) * face - px * .03
    t += Math.sin(angle) * .1 * Math.sign(px)
    layer.pixels[y * W + x] = pr[rampIndex(t, pr.length, x, y, .4)]
  }
  outline(layer, outlineColor, outlineColor)
  if (sx > .6) layer.pixels[5 * W + 6] = pack('#ffffff')
  return toCanvas(layer)
}

/** カットされた まるい ほうせき（13x12）。 */
export function gemCanvas(ramp: readonly string[], outlineColor: string) {
  const W = 13, H = 12
  const layer = newLayer(W, H)
  const pr = ramp.map(c => pack(c))
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px = x + .5 - 6.5, py = y + .5 - 6
    // うえは たいらな テーブル、したは とがった パビリオン。
    const inTop = py < -1.5 && Math.abs(px) < 3.5 + (py + 5) * .9 && py > -5
    const inBottom = py >= -1.5 && Math.abs(px) < (5.5 - (py + 1.5) * 1.05)
    if (!inTop && !inBottom) continue
    let t = inTop ? .8 - px * .04 : .5 - px * .06 - (py + 1.5) * .05
    const facet = Math.floor((Math.atan2(py, px) + Math.PI) / (Math.PI / 4))
    t += facet % 2 ? .12 : -.08
    if (Math.abs(py + 1.5) < .6) t = .95
    layer.pixels[y * W + x] = pr[rampIndex(t, pr.length, x, y, .3)]
  }
  outline(layer, outlineColor, outlineColor)
  layer.pixels[2 * W + 4] = pack('#ffffff')
  return toCanvas(layer)
}

/** ぼんやりした かげ（ディザで ふちを ぼかした だえん）。 */
export function shadowCanvas(w: number, h: number) {
  const layer = newLayer(w, h)
  const c = pack('#101028')
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x + .5 - w / 2) / (w / 2), dy = (y + .5 - h / 2) / (h / 2)
    const d = dx * dx + dy * dy
    if (d > 1) continue
    if (d > .6 && bayer(x, y) < (d - .6) / .4) continue
    layer.pixels[y * w + x] = c
  }
  return toCanvas(layer)
}

const DOOR_STAR = [
  '...#...',
  '...#...',
  '#######',
  '.#####.',
  '..###..',
  '.##.##.',
  '.#...#.',
]

/** いせきの いしの とびら（20x32）。まんなかに ほしの もよう。足もとは (10, 30)。 */
export function doorCanvas(style: StoneStyle) {
  const W = 20, H = 32
  const layer = newLayer(W, H)
  const ramp = style.ramp.map(c => pack(c))
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    // 上は まるい アーチ。
    if (y < 6) {
      const dx = (x + .5 - W / 2) / (W / 2 - 1), dy = (6 - y) / 5
      if (dx * dx + dy * dy > 1) continue
    }
    let t = x < 3 ? .82 : x > W - 4 ? .2 : .5 + (fbm(x / 4, y / 4, 31, 2) - .5) * .35
    if (y > H - 5) t -= .15
    // いしを つんだ めじ。
    if (y % 8 === 0 && y > 4) t -= .25
    layer.pixels[y * W + x] = ramp[rampIndex(t, ramp.length, x, y, .4)]
  }
  const gold = pack('#ffe070'), dark = pack('#e0a030')
  DOOR_STAR.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== '#') return
    layer.pixels[(y + 11) * W + x + 7] = y < 4 ? gold : dark
  }))
  outline(layer, style.outline, style.ramp[0])
  return toCanvas(layer)
}

/** ふむ スイッチ（16x12）。まわりの いしと まんなかの かいがらいろの ボタン。 */
export function switchCanvas(pressed: boolean) {
  const layer = newLayer(16, 12)
  paintBlobs(layer, [{ x: 8, y: 7.5, r: 7.5, ry: 4 }], { ramp: ['#3a3040', '#5a5064', '#7c748a', '#a49cb0'], outline: '#1a1420', ambient: .3 })
  const button = newLayer(16, 12)
  paintBlobs(button, [{ x: 8, y: pressed ? 7.5 : 6, r: 5, ry: pressed ? 2.2 : 3.5 }], {
    ramp: pressed ? ['#7a3050', '#a04a70', '#c86c90'] : ['#a02460', '#d44488', '#f076a8', '#ffa8c8', '#ffd8e8'],
    outline: '#4a0c28', spec: pressed ? undefined : '#ffffff',
  })
  for (let i = 0; i < button.pixels.length; i++) if (button.pixels[i]) layer.pixels[i] = button.pixels[i]
  return toCanvas(layer)
}
