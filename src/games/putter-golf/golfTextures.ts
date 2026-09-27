/**
 * パターゴルフの もよう（芝・ラフ・こな・すな・こおり・木の いた・いわ）を コードで かく。
 *
 * どれも 灰色に ちかい もようで、明るさの むらと こまかい すじだけを 持つ。色は 見た目の側で
 * コースごとの色を かけあわせるので、1まいの もようを どのコースでも 使える。
 * はしと はしが つながる（くりかえしても つなぎ目が 見えない）ように かく。
 * 外部の 画像ファイルは 使わない。
 */
import * as THREE from 'three'

export type GolfTextures = {
  grass: THREE.Texture
  rough: THREE.Texture
  powder: THREE.Texture
  sand: THREE.Texture
  ice: THREE.Texture
  wood: THREE.Texture
  rock: THREE.Texture
}

/** 決まった たねから つくる 0〜1 の数。同じ たねなら いつも 同じ もようになる。 */
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** くりかえしても つながる なめらかな むら（0〜1）。period マスで 1しゅう する。 */
function tiledNoise(period: number, seed: number) {
  const next = random(seed)
  const grid = Array.from({ length: period * period }, () => next())
  const at = (i: number, j: number) => grid[(((j % period) + period) % period) * period + (((i % period) + period) % period)]!
  return (u: number, v: number) => {
    const x = u * period
    const y = v * period
    const i = Math.floor(x)
    const j = Math.floor(y)
    const fx = x - i
    const fy = y - j
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const a = at(i, j)
    const b = at(i + 1, j)
    const c = at(i, j + 1)
    const d = at(i + 1, j + 1)
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
}

type Paint = { ctx: CanvasRenderingContext2D; size: number; next: () => number }

function makeTexture(size: number, seed: number, paint: (paint: Paint) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) paint({ ctx, size, next: random(seed) })
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** 1がそ ずつ 明るさ（0〜1）を きめて ぬる。tint は 赤・緑・青 それぞれに かける 色み。 */
function fillPixels({ ctx, size }: Paint, tint: readonly [number, number, number], shade: (u: number, v: number) => number) {
  const image = ctx.createImageData(size, size)
  const [r, g, b] = tint
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = shade(x / size, y / size) * 255
      const i = (y * size + x) * 4
      image.data[i] = value * r
      image.data[i + 1] = value * g
      image.data[i + 2] = value * b
      image.data[i + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
}

/** 線を かく。はしに かかったら 反対がわにも かいて、くりかえしの つなぎ目を かくす。 */
function wrappedStroke({ ctx, size }: Paint, x: number, y: number, dx: number, dy: number) {
  for (const ox of [-size, 0, size]) {
    for (const oy of [-size, 0, size]) {
      const ax = x + ox
      const ay = y + oy
      if (Math.max(ax, ax + dx) < -2 || Math.min(ax, ax + dx) > size + 2 || Math.max(ay, ay + dy) < -2 || Math.min(ay, ay + dy) > size + 2) continue
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(ax + dx, ay + dy)
      ctx.stroke()
    }
  }
}

/** かりこんだ 芝。こまかい はの すじと、ところどころの 明るさの むら。 */
function paintGrass(paint: Paint) {
  const broad = tiledNoise(6, 11)
  const fine = tiledNoise(24, 12)
  fillPixels(paint, [0.98, 1, 0.93], (u, v) => {
    const value = 0.86 + 0.07 * broad(u, v) + 0.05 * fine(u, v) + 0.07 * (paint.next() - 0.5)
    return value
  })
  const { ctx, size, next } = paint
  ctx.lineCap = 'round'
  for (let i = 0; i < 6000; i++) {
    const light = next() < 0.6
    ctx.strokeStyle = light ? `rgba(255,255,230,${0.16 + next() * 0.2})` : `rgba(30,60,15,${0.08 + next() * 0.1})`
    ctx.lineWidth = 0.8 + next() * 0.9
    const angle = -Math.PI / 2 + (next() - 0.5) * 1.3
    const length = 2.5 + next() * 4.5
    wrappedStroke(paint, next() * size, next() * size, Math.cos(angle) * length, Math.sin(angle) * length)
  }
}

/** のびた ラフの 草。ながい はが たおれて かさなり、かげが できる。どの色の ラフにも あうよう、かげは 色みの ない 黒にする。 */
function paintRough(paint: Paint) {
  const broad = tiledNoise(5, 21)
  fillPixels(paint, [0.98, 1, 0.94], (u, v) => {
    const value = 0.8 + 0.12 * broad(u, v) + 0.06 * (paint.next() - 0.5)
    return value
  })
  const { ctx, size, next } = paint
  ctx.lineCap = 'round'
  for (let i = 0; i < 2600; i++) {
    const light = next() < 0.55
    ctx.strokeStyle = light ? `rgba(255,255,235,${0.25 + next() * 0.3})` : `rgba(0,0,0,${0.1 + next() * 0.14})`
    ctx.lineWidth = 1.2 + next() * 1.6
    const angle = next() * Math.PI * 2
    const length = 7 + next() * 12
    wrappedStroke(paint, next() * size, next() * size, Math.cos(angle) * length, Math.sin(angle) * length)
  }
}

/** こなの ような じめん（ゆき・月の すな・おさとう）。やわらかい むらと、きらきらの つぶ。 */
function paintPowder(paint: Paint) {
  const broad = tiledNoise(5, 71)
  const fine = tiledNoise(20, 72)
  fillPixels(paint, [0.98, 0.99, 1], (u, v) => {
    const value = 0.88 + 0.07 * broad(u, v) + 0.04 * fine(u, v) + 0.03 * (paint.next() - 0.5)
    return value
  })
  const { ctx, size, next } = paint
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = next() < 0.7 ? 'rgba(255,255,255,0.8)' : 'rgba(80,90,120,0.25)'
    ctx.fillRect(next() * size, next() * size, 1.5, 1.5)
  }
}

/** すなばの すな。こまかい つぶと、くまでで ならした なみの すじ。 */
function paintSand(paint: Paint) {
  const broad = tiledNoise(4, 31)
  fillPixels(paint, [1, 0.98, 0.94], (u, v) => {
    const rake = Math.sin((v * 18 + broad(u, v) * 0.8) * Math.PI * 2) * 0.03
    const value = 0.9 + 0.05 * broad(u, v) + rake + 0.12 * (paint.next() - 0.5)
    return value
  })
  const { ctx, size, next } = paint
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = next() < 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(90,70,40,0.35)'
    ctx.fillRect(next() * size, next() * size, 1.5, 1.5)
  }
}

/** こおり。白い すじと、ひびの 線。 */
function paintIce(paint: Paint) {
  const broad = tiledNoise(5, 41)
  fillPixels(paint, [0.97, 0.99, 1], (u, v) => {
    const value = 0.9 + 0.08 * broad(u, v) + 0.02 * (paint.next() - 0.5)
    return value
  })
  const { ctx, size, next } = paint
  ctx.lineCap = 'round'
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.35 + next() * 0.35})`
    ctx.lineWidth = 1 + next() * 3
    const angle = next() * Math.PI
    const length = 20 + next() * 60
    wrappedStroke(paint, next() * size, next() * size, Math.cos(angle) * length, Math.sin(angle) * length)
  }
  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = 'rgba(120,160,190,0.35)'
    ctx.lineWidth = 1
    let x = next() * size
    let y = next() * size
    for (let k = 0; k < 5; k++) {
      const angle = next() * Math.PI * 2
      const length = 6 + next() * 16
      wrappedStroke(paint, x, y, Math.cos(angle) * length, Math.sin(angle) * length)
      x += Math.cos(angle) * length
      y += Math.sin(angle) * length
    }
  }
}

/** 木の いた。よこに ならんだ いたと、もくめ。v の 1しゅうに いたが 4まい。 */
function paintWood(paint: Paint) {
  const { size, next } = paint
  const grain = tiledNoise(8, 51)
  const tones = Array.from({ length: 4 }, () => 0.86 + next() * 0.14)
  fillPixels(paint, [1, 0.97, 0.93], (u, v) => {
    const board = Math.floor(v * 4)
    const inBoard = v * 4 - board
    const lines = Math.sin((v * 4 * 9 + grain(u * 0.5, v) * 3 + board * 1.7) * Math.PI) * 0.035
    const seam = inBoard < 0.05 || inBoard > 0.96 ? -0.28 : inBoard < 0.12 ? 0.05 : 0
    const value = tones[board]! + lines + seam + 0.03 * (next() - 0.5)
    return value
  })
  const { ctx } = paint
  // いたの つなぎ目（たての すきま）を ずらして入れる。
  ctx.fillStyle = 'rgba(40,25,10,0.35)'
  for (let board = 0; board < 4; board++) {
    const x = ((board * 0.37 + 0.2) % 1) * size
    ctx.fillRect(x, (board * size) / 4, 2, size / 4)
  }
}

/** いわはだ。ごつごつした むらと ひび。 */
function paintRock(paint: Paint) {
  const broad = tiledNoise(4, 61)
  const mid = tiledNoise(12, 62)
  fillPixels(paint, [1, 0.98, 0.96], (u, v) => {
    const value = 0.78 + 0.14 * broad(u, v) + 0.1 * mid(u, v) + 0.08 * (paint.next() - 0.5)
    return value
  })
  const { ctx, size, next } = paint
  ctx.lineCap = 'round'
  for (let i = 0; i < 30; i++) {
    ctx.strokeStyle = `rgba(40,25,15,${0.12 + next() * 0.14})`
    ctx.lineWidth = 1 + next() * 1.5
    let x = next() * size
    let y = next() * size
    for (let k = 0; k < 4; k++) {
      const angle = next() * Math.PI * 2
      const length = 8 + next() * 20
      wrappedStroke(paint, x, y, Math.cos(angle) * length, Math.sin(angle) * length)
      x += Math.cos(angle) * length
      y += Math.sin(angle) * length
    }
  }
}

/**
 * もようを まとめて つくる。ホールが かわっても 作りなおさない。
 * anisotropy は ななめから 見た 芝が ぼやけないように するための 値。
 */
export function createGolfTextures(anisotropy: number): GolfTextures {
  const textures: GolfTextures = {
    grass: makeTexture(512, 1, paintGrass),
    rough: makeTexture(256, 2, paintRough),
    powder: makeTexture(256, 7, paintPowder),
    sand: makeTexture(256, 3, paintSand),
    ice: makeTexture(256, 4, paintIce),
    wood: makeTexture(256, 5, paintWood),
    rock: makeTexture(256, 6, paintRock),
  }
  for (const texture of Object.values(textures)) texture.anisotropy = anisotropy
  return textures
}
