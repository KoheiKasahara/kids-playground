// じめんを 1ドットずつ つくる。
// マスの さかいめは ノイズで ゆらして しかくく みえないように し、
// くさの ふち・どての かべ・いしだたみの みぞ など、SFC の マップらしい 立体感を つける。
// みずと なみうちぎわは 毎フレーム うごかすので、ここでは「あな」を あけて じょうほうだけ のこす。

import { bayer, fbm, hash2, pack, rampIndex, unpack, valueNoise } from './pixel'
import type { Level } from './world'
import { TILE } from './world'
import type { GroundPalette } from './theme'

/** 動くピクセルの しゅるい。 */
export const DYN_NONE = 0, DYN_WATER = 1, DYN_WET = 2

export type Terrain = {
  pw: number
  ph: number
  /** うごかない じめん（みずの ところは とうめい）。 */
  pixels: Uint32Array
  /** みずぎわの すなの もとの 色（なみの した）。 */
  base: Uint32Array
  dyn: Uint8Array
  /** みずの ピクセルから 岸までの きょり。 */
  waterDist: Uint8Array
  /** 岸の ピクセルから みずまでの きょり。 */
  landDist: Uint8Array
  /** かげ（木や どての かげ）が みずに おちている つよさ。 */
  waterShade: Uint8Array
  /** さざなみを とぎれとぎれに する ノイズ。 */
  warp: Uint8Array
}

const M_GRASS = 1, M_FLOWER = 2, M_TALL = 3, M_DIRT = 4, M_SAND = 5, M_STONE = 6, M_WATER = 7, M_BRIDGE = 8
const MAT: Record<string, number> = { '.': M_GRASS, ',': M_FLOWER, ':': M_TALL, '=': M_DIRT, s: M_SAND, o: M_STONE, '~': M_WATER, '#': M_BRIDGE }
const isGrass = (m: number) => m === M_GRASS || m === M_FLOWER || m === M_TALL
const isLand = (m: number) => m !== M_WATER && m !== 0

export type TerrainOptions = { palette: GroundPalette; waves: boolean; seed: number }

export function buildTerrain(level: Level, opts: TerrainOptions): Terrain {
  const { palette: pal, seed } = opts
  const pw = level.w * TILE, ph = level.h * TILE
  const N = pw * ph
  const mat = new Uint8Array(N)
  const tileMat = (tx: number, ty: number) => {
    const cx = Math.max(0, Math.min(level.w - 1, tx)), cy = Math.max(0, Math.min(level.h - 1, ty))
    return MAT[level.ground[cy * level.w + cx]] ?? M_GRASS
  }
  // 1) ざいしつ。さかいめを ノイズで ずらして しぜんな かたちに する。
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const m0 = tileMat(Math.floor(x / TILE), Math.floor(y / TILE))
    const ox = (valueNoise(x / 7, y / 7, seed + 1) - .5) * 7
    const oy = (valueNoise(x / 7, y / 7, seed + 2) - .5) * 7
    const m1 = tileMat(Math.floor((x + ox) / TILE), Math.floor((y + oy) / TILE))
    // はし と、いしだたみの いけ は まっすぐな ふちの まま。
    const crisp = m0 === M_BRIDGE || m1 === M_BRIDGE || ((m0 === M_STONE || m1 === M_STONE) && (m0 === M_WATER || m1 === M_WATER))
    mat[y * pw + x] = crisp ? m0 : m1
  }
  // ふかい くさ と ふつうの くさ の あいだは もっと なだらかに まぜる。
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= pw || y >= ph ? 0 : mat[y * pw + x])

  // 2) きょり（みず⇔きし）。
  const waterDist = new Uint8Array(N)
  const landDist = new Uint8Array(N)
  distance(mat, pw, ph, m => m === M_WATER, waterDist, 60)
  distance(mat, pw, ph, m => m !== M_WATER, landDist, 14)

  const pixels = new Uint32Array(N)
  const base = new Uint32Array(N)
  const dyn = new Uint8Array(N)
  const waterShade = new Uint8Array(N)
  const warp = new Uint8Array(N)
  const P = (list: readonly string[]) => list.map(c => pack(c))
  const grass = P(pal.grass), dirt = P(pal.dirt), sand = P(pal.sand), stone = P(pal.stone)
  const bank = P(pal.bank), wall = P(pal.stoneWall), moss = P(pal.moss), wood = P(pal.wood)

  // 3) もとの 色。
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const k = y * pw + x
    const m = mat[k]
    warp[k] = Math.floor(valueNoise(x / 9, y / 5, seed + 9) * 255)
    if (m === M_WATER) { dyn[k] = DYN_WATER; continue }
    let c = 0
    if (isGrass(m)) {
      const n1 = fbm(x / 18, y / 18, seed + 3, 3)
      const n2 = valueNoise(x / 3.2, y / 3.2, seed + 4)
      let t = .5 + (n1 - .5) * 1.1 + (n2 - .5) * .32
      if (m === M_TALL) t -= .2
      c = grass[rampIndex(t, grass.length, x, y, .5)]
    } else if (m === M_DIRT) {
      const n = fbm(x / 11, y / 11, seed + 5, 3)
      const t = .56 + (n - .5) * .8 + (hash2(x, y, seed) - .5) * .18
      c = dirt[rampIndex(t, dirt.length, x, y, .4)]
    } else if (m === M_SAND) {
      const n = fbm(x / 26, y / 26, seed + 6, 3)
      const ripple = Math.sin(x * .22 + y * .95 + n * 7)
      let t = .6 + (n - .5) * .32
      if (ripple > .82) t += .16
      else if (ripple < -.9) t -= .1
      if (hash2(x, y, seed + 7) < .035) t += hash2(x, y, seed + 8) < .5 ? .25 : -.25
      c = sand[rampIndex(t, sand.length, x, y, .35)]
    } else if (m === M_STONE) {
      c = stonePixel(x, y, seed, stone, moss, at)
    } else if (m === M_BRIDGE) {
      c = bridgePixel(x, y, level, wood)
    }
    pixels[k] = c
  }

  // 4) さかいめの たちあがり。くさは すこし 高い ので、したの つちに かげを おとす。
  const out = pixels.slice()
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const k = y * pw + x
    const m = mat[k]
    if (m === M_WATER || m === M_BRIDGE) continue
    if (m === M_DIRT || m === M_SAND || m === M_STONE) {
      const up1 = at(x, y - 1), up2 = at(x, y - 2), left = at(x - 1, y), right = at(x + 1, y)
      const ramp = m === M_DIRT ? dirt : m === M_SAND ? sand : stone
      if (isGrass(up1)) out[k] = ramp[0]
      else if (isGrass(up2)) out[k] = ramp[1]
      else if (isGrass(left) || isGrass(right)) out[k] = ramp[Math.max(0, indexOf(ramp, pixels[k]) - 1)]
    } else if (isGrass(m)) {
      const down = at(x, y + 1), up = at(x, y - 1)
      if (down === M_DIRT || down === M_SAND || down === M_STONE) out[k] = grass[1]
      else if (up === M_DIRT || up === M_SAND || up === M_STONE) out[k] = grass[grass.length - 1]
      else if (!isGrass(at(x - 1, y)) && at(x - 1, y) !== M_WATER && at(x - 1, y)) out[k] = grass[grass.length - 2]
    }
  }
  pixels.set(out)

  // 5) くさの ほさき・はな・こいし。
  stampDecor(pixels, mat, pw, ph, seed, pal, grass, dirt)

  // 6) みずぎわ。上に きしが ある ところは どての かべに し、その したは かげの みず。
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const k = y * pw + x
    if (mat[k] !== M_WATER) continue
    // 上に なんドットで きしが あるか。
    let up = 0
    while (up < 6 && at(x, y - up - 1) === M_WATER) up++
    const landAbove = at(x, y - up - 1)
    if (!landAbove || up >= 6) continue
    const sandy = landAbove === M_SAND
    if (landAbove === M_BRIDGE) {
      if (up < 3) waterShade[k] = 3 - up
      continue
    }
    if (opts.waves && sandy) continue
    const wallH = landAbove === M_STONE ? 5 : 4
    if (up < wallH) {
      dyn[k] = DYN_NONE
      const ramp = landAbove === M_STONE ? wall : bank
      const t = 1 - up / wallH
      let c = ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length * .95 + bayer(x, y) * .5))]
      if (landAbove === M_STONE && (x + Math.floor(up / 3) * 4) % 8 === 0) c = ramp[0]
      else if (landAbove !== M_STONE && hash2(x, y, seed + 21) < .08) c = ramp[Math.min(ramp.length - 1, indexOf(ramp, c) + 1)]
      pixels[k] = c
    } else if (up < wallH + 3) {
      waterShade[k] = wallH + 3 - up
    }
  }
  // どての うえの ふちを あかるく する。
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const k = y * pw + x
    if (!isLand(mat[k]) || mat[k] === M_BRIDGE) continue
    if (at(x, y + 1) === M_WATER && dyn[k + pw] === DYN_NONE) {
      const m = mat[k]
      pixels[k] = m === M_STONE ? stone[stone.length - 1] : isGrass(m) ? grass[grass.length - 1] : m === M_SAND ? sand[sand.length - 1] : dirt[dirt.length - 1]
    }
  }

  // 7) なみうちぎわ（すなはま）は なみが かかるので うごかす がわへ。
  if (opts.waves) {
    for (let k = 0; k < N; k++) {
      if (mat[k] === M_SAND && landDist[k] > 0 && landDist[k] <= 12) { dyn[k] = DYN_WET; base[k] = pixels[k] }
    }
  }

  for (let k = 0; k < N; k++) if (dyn[k] !== DYN_NONE) pixels[k] = 0
  return { pw, ph, pixels, base, dyn, waterDist, landDist, waterShade, warp }
}

function indexOf(ramp: readonly number[], c: number) {
  const i = ramp.indexOf(c)
  return i < 0 ? Math.floor(ramp.length / 2) : i
}

/** 2パスの きょり変換（チェス盤きょりの ちかい もの）。 */
function distance(mat: Uint8Array, w: number, h: number, inside: (m: number) => boolean, out: Uint8Array, cap: number) {
  const INF = 255
  for (let k = 0; k < w * h; k++) out[k] = inside(mat[k]) ? INF : 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x
    if (!out[k]) continue
    let v = out[k]
    if (x > 0) v = Math.min(v, out[k - 1] + 1)
    if (y > 0) v = Math.min(v, out[k - w] + 1)
    if (x > 0 && y > 0) v = Math.min(v, out[k - w - 1] + 1)
    if (x < w - 1 && y > 0) v = Math.min(v, out[k - w + 1] + 1)
    out[k] = v
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const k = y * w + x
    if (!out[k]) continue
    let v = out[k]
    if (x < w - 1) v = Math.min(v, out[k + 1] + 1)
    if (y < h - 1) v = Math.min(v, out[k + w] + 1)
    if (x < w - 1 && y < h - 1) v = Math.min(v, out[k + w + 1] + 1)
    if (x > 0 && y < h - 1) v = Math.min(v, out[k + w - 1] + 1)
    out[k] = v
  }
  for (let k = 0; k < w * h; k++) if (out[k] > cap) out[k] = cap
}

/** いしだたみ。大きさの ちがう しかくい いしを ずらして しき、ふちに ひかりと かげ、みぞに こけ。 */
function stonePixel(x: number, y: number, seed: number, stone: number[], moss: number[], at: (x: number, y: number) => number) {
  const row = Math.floor(y / 12)
  const off = (row & 1) * 10
  const bw = 20
  const bx = Math.floor((x + off) / bw), lx = (x + off) % bw, ly = y % 12
  const hb = hash2(bx, row, seed + 11)
  let t = .5 + (hb - .5) * .4 + (valueNoise(x / 6, y / 6, seed + 12) - .5) * .22
  if (lx === bw - 1 || ly === 11) {
    // みぞ。くさの ちかくは こけが はえる。
    const near = isGrass(at(x, y - 7)) || isGrass(at(x, y + 7)) || isGrass(at(x - 7, y)) || isGrass(at(x + 7, y))
    if (near || hash2(x, y, seed + 13) < .22) return moss[hash2(x, y, seed + 14) < .5 ? 0 : 1]
    return stone[0]
  }
  // かどは まるく かける。
  const corner = (lx === 0 || lx === bw - 2) && (ly === 0 || ly === 10)
  if (corner) return stone[1]
  if (lx === 0 || ly === 0) t += .26
  else if (lx === bw - 2 || ly === 10) t -= .24
  // ひび。
  if (hb > .8) {
    const cx = 5 + Math.floor(hash2(bx, row, seed + 15) * 9)
    if (Math.abs(lx - cx - (ly - 5) * (hb > .9 ? 1 : -1) * .7) < .5 && ly > 1 && ly < 10) return stone[1]
  }
  // すりへった くぼみ・しみ。
  const stain = valueNoise(x / 4, y / 4, seed + 18)
  if (stain > .78) t -= .14
  const mossy = fbm(x / 12, y / 12, seed + 16, 2)
  if (mossy > .66 && hash2(x, y, seed + 17) < (mossy - .66) * 3.5) return moss[rampIndex(t, moss.length, x, y)]
  return stone[rampIndex(t, stone.length, x, y, .4)]
}

/** はしの いた。ながれに そって いたを ならべ、てすりの ふちを つける。 */
function bridgePixel(x: number, y: number, level: Level, wood: number[]) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE)
  const g = (ax: number, ay: number) => (ax < 0 || ay < 0 || ax >= level.w || ay >= level.h ? '~' : level.ground[ay * level.w + ax])
  const horizontal = g(tx - 1, ty) !== '~' || g(tx + 1, ty) !== '~'
  const lx = x % TILE, ly = y % TILE
  const along = horizontal ? lx : ly
  const across = horizontal ? ly : lx
  const vertEdge = !horizontal
  // てすり（はしの りょうがわ）。
  const up = horizontal ? g(tx, ty - 1) : g(tx - 1, ty)
  const down = horizontal ? g(tx, ty + 1) : g(tx + 1, ty)
  if (across <= 1 && up === '~') return across === 0 ? wood[0] : wood[4]
  if (across >= 14 && down === '~') return across === 15 ? wood[0] : wood[1]
  if (across === 2 && up === '~') return wood[1]
  const plank = Math.floor(along / 4)
  if (along % 4 === 3) return wood[0]
  const t = .55 + (hash2(tx * 4 + plank, ty, 3) - .5) * .4 + (across < 4 ? .12 : 0) - (vertEdge ? 0 : 0)
  // くぎ。
  if (along % 4 === 1 && (across === 3 || across === 12)) return wood[1]
  return wood[Math.max(1, rampIndex(t, wood.length, x, y, .3))]
}

/** くさの ほさき・はな・こいしを ちらす。 */
function stampDecor(pixels: Uint32Array, mat: Uint8Array, pw: number, ph: number, seed: number, pal: GroundPalette, grass: number[], dirt: number[]) {
  const set = (x: number, y: number, c: number, need?: (m: number) => boolean) => {
    if (x < 0 || y < 0 || x >= pw || y >= ph) return
    const k = y * pw + x
    if (need && !need(mat[k])) return
    pixels[k] = c
  }
  const shade = (x: number, y: number, d: number) => {
    const k = y * pw + x
    const i = indexOf(grass, pixels[k])
    return grass[Math.max(0, Math.min(grass.length - 1, i + d))]
  }
  // くさの ほさき。
  for (let cy = 0; cy < ph; cy += 6) for (let cx = 0; cx < pw; cx += 7) {
    const h = hash2(cx, cy, seed + 31)
    const x = cx + Math.floor(hash2(cx, cy, seed + 32) * 6), y = cy + Math.floor(hash2(cx, cy, seed + 33) * 5) + 2
    if (x < 2 || y < 3 || x >= pw - 2 || y >= ph) continue
    const m = mat[y * pw + x]
    if (!isGrass(m)) continue
    const dense = m === M_TALL ? .62 : m === M_FLOWER ? .22 : .24
    if (h > dense) continue
    const tall = m === M_TALL
    const g = isGrass
    set(x - 1, y, shade(x - 1, y, -2), g); set(x, y, shade(x, y, -2), g); set(x + 1, y, shade(x + 1, y, -2), g)
    set(x - 2, y - 1, shade(x - 2, y - 1, 1), g); set(x, y - 1, shade(x, y - 1, 2), g); set(x + 2, y - 1, shade(x + 2, y - 1, 1), g)
    set(x - 1, y - 2, shade(x - 1, y - 2, 2), g); set(x + 1, y - 2, shade(x + 1, y - 2, 2), g)
    if (tall) { set(x, y - 2, grass[grass.length - 1], g); set(x - 1, y - 3, shade(x - 1, y - 3, 2), g); set(x + 2, y - 3, shade(x + 2, y - 3, 2), g) }
  }
  // はな。
  const flowers = pal.flowers.map(([p, c]) => [pack(p), pack(c)] as const)
  for (let cy = 0; cy < ph; cy += 5) for (let cx = 0; cx < pw; cx += 6) {
    const x = cx + 1 + Math.floor(hash2(cx, cy, seed + 41) * 4), y = cy + 1 + Math.floor(hash2(cx, cy, seed + 42) * 3)
    if (x < 1 || y < 1 || x >= pw - 2 || y >= ph - 2) continue
    const m = mat[y * pw + x]
    const chance = m === M_FLOWER ? .5 : m === M_GRASS ? .014 : 0
    if (hash2(cx, cy, seed + 43) >= chance) continue
    const [petal, center] = flowers[Math.floor(hash2(cx, cy, seed + 44) * flowers.length)]
    const g = isGrass
    set(x + 1, y + 2, shade(x + 1, y + 2, -3), g)
    set(x, y + 1, shade(x, y + 1, -2), g)
    set(x, y - 1, petal, g); set(x - 1, y, petal, g); set(x + 1, y, petal, g); set(x, y + 1, petal, g)
    set(x, y, center, g)
  }
  // こいし。
  for (let cy = 0; cy < ph; cy += 5) for (let cx = 0; cx < pw; cx += 5) {
    const x = cx + Math.floor(hash2(cx, cy, seed + 51) * 4), y = cy + Math.floor(hash2(cx, cy, seed + 52) * 4)
    if (x >= pw - 2 || y >= ph - 2) continue
    if (mat[y * pw + x] !== M_DIRT || hash2(cx, cy, seed + 53) > .2) continue
    const need = (m: number) => m === M_DIRT
    set(x, y, dirt[5], need); set(x + 1, y, dirt[4], need)
    set(x, y + 1, dirt[3], need); set(x + 1, y + 1, dirt[1], need); set(x + 2, y + 1, dirt[1], need)
  }
}

/** 地面へ まるい かげを おとす（木・いわ など）。みずの うえは waterShade に しるす。 */
export function castShadow(t: Terrain, cx: number, cy: number, rx: number, ry: number, strength = .6) {
  const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(t.pw - 1, Math.ceil(cx + rx))
  const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(t.ph - 1, Math.ceil(cy + ry))
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry
    const d = dx * dx + dy * dy
    if (d > 1) continue
    // ふちは ディザで ぼかす。
    if (d > .78 && bayer(x, y) < (d - .78) / .22) continue
    const k = y * t.pw + x
    if (t.dyn[k] === DYN_WATER) { t.waterShade[k] = Math.max(t.waterShade[k], 3); continue }
    const c = t.dyn[k] === DYN_WET ? t.base[k] : t.pixels[k]
    if (!c) continue
    const [r, g, b] = unpack(c)
    const dark = pack(`#${[r * strength, g * strength, b * (strength + .12)].map(v => Math.min(255, Math.round(v)).toString(16).padStart(2, '0')).join('')}`)
    if (t.dyn[k] === DYN_WET) t.base[k] = dark
    else t.pixels[k] = dark
  }
}
