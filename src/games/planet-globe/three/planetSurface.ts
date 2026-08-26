import * as THREE from 'three'
import type {
  GasSpot,
  GasSurfaceSpec,
  LatitudeStop,
  PolarCaps,
  RockySurfaceSpec,
  ScatteredCraters,
  SurfaceCrater,
  SurfacePatch,
  SurfaceSpec,
} from '../types'
import { createNoise2D, fbm2D } from './noise'
import { latToV } from './planetCoords'

/**
 * 天体表面のテクスチャは新規画像を使わず、Canvas 2Dで手続き的に生成する。
 * 2:1(緯度経度)のUVに合わせて幅を高さの2倍にする。これ以上は解像度を上げない
 * (パフォーマンス予算については本ファイル末尾のコメント、および設計書を参照)。
 */
export const SURFACE_TEXTURE_WIDTH = 1024
export const SURFACE_TEXTURE_HEIGHT = 512

/**
 * 経度(度)からテクスチャ幅と同じ比率でピクセル半径を出すための定数。
 * 1024/360 と 512/180 がちょうど一致するため、この1つの定数で経度方向・緯度方向
 * どちらの半径換算にも使え、クレーターのような円形の模様が(赤道付近では)真円になる。
 */
const DEG_TO_PX = SURFACE_TEXTURE_WIDTH / 360

/** '#rrggbb' を [r, g, b](0..255)へ分解する。 */
function hexToRgb(hexColor: string): [number, number, number] {
  const hex = hexColor.replace('#', '')
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
}

/** '#rrggbb' と 0..1 のアルファから 'rgba(r, g, b, a)' を作る。 */
export function withAlpha(hexColor: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hexColor)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * seedから決定的な0..1の乱数列を作る(mulberry32)。
 * 同じ天体は毎回同じ配置になるようにする(再マウントのたびに模様が変わると違和感がある)。
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type RgbStop = { latDeg: number; r: number; g: number; b: number }

function toRgbStops(stops: readonly LatitudeStop[]): RgbStop[] {
  return stops.map((stop) => {
    const [r, g, b] = hexToRgb(stop.color)
    return { latDeg: stop.latDeg, r, g, b }
  })
}

/** rgbStopsは緯度降順(北→南)である前提で、latDegの位置の色を線形補間する。範囲外は両端でクランプする。 */
function interpolateRgbStops(rgbStops: readonly RgbStop[], latDeg: number): [number, number, number] {
  const first = rgbStops[0]
  const last = rgbStops[rgbStops.length - 1]
  if (latDeg >= first.latDeg) return [first.r, first.g, first.b]
  if (latDeg <= last.latDeg) return [last.r, last.g, last.b]

  for (let i = 0; i < rgbStops.length - 1; i += 1) {
    const a = rgbStops[i]
    const b = rgbStops[i + 1]
    if (latDeg <= a.latDeg && latDeg >= b.latDeg) {
      const span = a.latDeg - b.latDeg
      const t = span === 0 ? 0 : (a.latDeg - latDeg) / span
      return [a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t]
    }
  }
  return [last.r, last.g, last.b]
}

/**
 * 緯度方向の色プロファイル(月の弱い明暗、火星の南北差、木星・土星の帯)から
 * 指定した緯度の色を求める。stopsはlatDeg降順(北→南)で並んでいる前提。
 */
export function sampleLatitudeColor(
  stops: readonly LatitudeStop[],
  latDeg: number,
): [number, number, number] {
  return interpolateRgbStops(toRgbStops(stops), latDeg)
}

/** 散らばった小クレーターの配置。半径は小さいものほど多くなるよう分布を偏らせる。 */
export function layoutScatteredCraters(
  spec: ScatteredCraters,
): { lonDeg: number; latDeg: number; radiusDeg: number }[] {
  const random = createRandom(spec.seed)
  const radiusRange = spec.maxRadiusDeg - spec.minRadiusDeg
  const results: { lonDeg: number; latDeg: number; radiusDeg: number }[] = []

  for (let i = 0; i < spec.count; i += 1) {
    const lonDeg = random() * 360 - 180
    const latDeg = (random() * 2 - 1) * spec.latLimitDeg
    // rand^2.2で小さい半径側に寄せ、大きなクレーターが少数・小さなクレーターが多数になるようにする。
    const radiusDeg = spec.minRadiusDeg + radiusRange * random() ** 2.2
    results.push({ lonDeg, latDeg, radiusDeg })

    // 経度-180/180の継ぎ目にかかるクレーターは反対側にも複製し、
    // 継ぎ目でクレーターが半分だけ表示される見た目を防ぐ。
    if (lonDeg - radiusDeg < -180) results.push({ lonDeg: lonDeg + 360, latDeg, radiusDeg })
    if (lonDeg + radiusDeg > 180) results.push({ lonDeg: lonDeg - 360, latDeg, radiusDeg })
  }

  return results
}

/**
 * 経度をテクスチャの横ピクセル位置へ変換する(このファイル内の描画専用)。
 * `planetCoords.lonToU` は周期的な変換(-180と180が同じ点)だが、ここでは継ぎ目をまたぐ
 * 図形を両端に複製して描くために、あえて周期を掛けない線形変換を使う
 * (通常範囲 -180..180 では lonToU と同じ値になる)。
 */
function toPixelX(lonDeg: number): number {
  return ((lonDeg + 180) / 360) * SURFACE_TEXTURE_WIDTH
}

function toPixelY(latDeg: number): number {
  return latToV(latDeg) * SURFACE_TEXTURE_HEIGHT
}

/** 経度の継ぎ目をまたぐ図形は、反対側にも複製して描く。marginDegは図形の経度方向半径。 */
function forEachWrappedLon(lonDeg: number, marginDeg: number, draw: (lonDeg: number) => void): void {
  draw(lonDeg)
  if (lonDeg - marginDeg < -180) draw(lonDeg + 360)
  if (lonDeg + marginDeg > 180) draw(lonDeg - 360)
}

/** jsdomのように2Dコンテキストを持たない環境でも、例外にせずテクスチャ生成を続ける。 */
function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d')
  } catch {
    return null
  }
}

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = SURFACE_TEXTURE_WIDTH
  canvas.height = SURFACE_TEXTURE_HEIGHT
  return canvas
}

function toColorTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true
  return texture
}

function toBumpTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas)
  // バンプは明るさだけを高さとして読むため、sRGBの階調補正をかけてはいけない。
  texture.colorSpace = THREE.NoColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true
  return texture
}

export type SurfaceMaps = { map: THREE.CanvasTexture | null; bumpMap: THREE.CanvasTexture | null }

// ---------------------------------------------------------------------------
// 岩石天体(rocky): 月・火星
// ---------------------------------------------------------------------------

/** 地色(緯度プロファイル)にfbmノイズを混ぜた基本色を1パスのImageDataへ直接書き込む。 */
function paintRockyColorBase(ctx: CanvasRenderingContext2D, surface: RockySurfaceSpec): void {
  const width = SURFACE_TEXTURE_WIDTH
  const height = SURFACE_TEXTURE_HEIGHT
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data
  const noise = createNoise2D(surface.noise.seed)
  const latitudeRgbStops = toRgbStops(surface.latitudeStops)
  const darkRgb = hexToRgb(surface.noise.darkColor)
  const lightRgb = hexToRgb(surface.noise.lightColor)
  const { periodX, frequencyY, octaves, amount } = surface.noise
  const contrast = surface.noise.contrast ?? 1

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height
    const latDeg = 90 - v * 180
    const [baseR, baseG, baseB] = interpolateRgbStops(latitudeRgbStops, latDeg)

    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width
      const raw = fbm2D(noise, u * periodX, v * frequencyY, periodX, octaves)
      const n = THREE.MathUtils.clamp((raw - 0.5) * contrast + 0.5, 0, 1)

      const nr = darkRgb[0] + (lightRgb[0] - darkRgb[0]) * n
      const ng = darkRgb[1] + (lightRgb[1] - darkRgb[1]) * n
      const nb = darkRgb[2] + (lightRgb[2] - darkRgb[2]) * n

      const idx = (y * width + x) * 4
      data[idx] = baseR + (nr - baseR) * amount
      data[idx + 1] = baseG + (ng - baseG) * amount
      data[idx + 2] = baseB + (nb - baseB) * amount
      data[idx + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

/** 楕円領域を「楕円座標系へ変形してから単位円の放射グラデーションを描く」手法で塗る(patch・gas spot共通)。 */
function fillEllipseGradient(
  ctx: CanvasRenderingContext2D,
  centerXPx: number,
  centerYPx: number,
  radiusXPx: number,
  radiusYPx: number,
  rotationDeg: number | undefined,
  paintUnitCircle: (ctx: CanvasRenderingContext2D) => void,
): void {
  ctx.save()
  ctx.translate(centerXPx, centerYPx)
  if (rotationDeg !== undefined) ctx.rotate((rotationDeg * Math.PI) / 180)
  ctx.scale(Math.max(radiusXPx, 0.0001), Math.max(radiusYPx, 0.0001))
  paintUnitCircle(ctx)
  ctx.restore()
}

function drawPatch(ctx: CanvasRenderingContext2D, patch: SurfacePatch): void {
  const cyPx = toPixelY(patch.latDeg)
  const rxPx = (patch.lonRadiusDeg / 360) * SURFACE_TEXTURE_WIDTH
  const ryPx = (patch.latRadiusDeg / 180) * SURFACE_TEXTURE_HEIGHT

  forEachWrappedLon(patch.lonDeg, patch.lonRadiusDeg, (lonDeg) => {
    fillEllipseGradient(ctx, toPixelX(lonDeg), cyPx, rxPx, ryPx, patch.rotationDeg, (c) => {
      const gradient = c.createRadialGradient(0, 0, 0, 0, 0, 1)
      // softness: 0=くっきり(内側stopがほぼ縁) 1=ふんわり(内側stopが中心寄り)
      const innerStop = THREE.MathUtils.clamp(1 - patch.softness, 0, 0.98)
      gradient.addColorStop(0, withAlpha(patch.color, patch.opacity))
      gradient.addColorStop(innerStop, withAlpha(patch.color, patch.opacity))
      gradient.addColorStop(1, withAlpha(patch.color, 0))
      c.fillStyle = gradient
      c.beginPath()
      c.arc(0, 0, 1, 0, Math.PI * 2)
      c.fill()
    })
  })
}

/** 極冠の縁のうねり。経度の周期関数の和にすることで、経度-180/180の継ぎ目でも必ず連続になる。 */
const POLAR_EDGE_LOBES = [3, 5, 8] as const

/**
 * 極冠の縁の緯度(度)。
 *
 * 縁を経度ごとの独立した乱数でギザギザにすると、極付近ほどテクスチャの横方向が
 * 球面上で圧縮されるため、放射状のトゲ(太陽のフレアのような見た目)になってしまう。
 * そのため揺らぎは「少数の低い周波数の正弦波の和」にして、大きくうねる縁だけを作る。
 */
export function polarCapEdgeLatDeg(
  edgeLatDeg: number,
  raggednessDeg: number,
  phases: readonly number[],
  lonDeg: number,
): number {
  const lonRad = (lonDeg * Math.PI) / 180
  let wave = 0
  let weight = 0
  for (let i = 0; i < POLAR_EDGE_LOBES.length; i += 1) {
    const amplitude = 1 / (i + 1)
    wave += amplitude * Math.sin(POLAR_EDGE_LOBES[i] * lonRad + (phases[i] ?? 0))
    weight += amplitude
  }
  return edgeLatDeg + (wave / weight) * raggednessDeg
}

/** 極冠を1層ぶん塗る。`expandDeg`だけ縁を外へ広げた形を薄い色で重ねると、境界が霜のようにぼける。 */
function fillPolarCapLayer(
  ctx: CanvasRenderingContext2D,
  edgeLatDeg: number,
  isNorth: boolean,
  fillStyle: string,
  raggednessDeg: number,
  phases: readonly number[],
  expandDeg: number,
): void {
  const segments = 96
  const poleY = isNorth ? 0 : SURFACE_TEXTURE_HEIGHT
  const outward = isNorth ? -expandDeg : expandDeg

  ctx.beginPath()
  ctx.moveTo(0, poleY)
  for (let i = 0; i <= segments; i += 1) {
    const lonDeg = -180 + (i / segments) * 360
    const latDeg = polarCapEdgeLatDeg(edgeLatDeg, raggednessDeg, phases, lonDeg) + outward
    ctx.lineTo(toPixelX(lonDeg), toPixelY(latDeg))
  }
  ctx.lineTo(SURFACE_TEXTURE_WIDTH, poleY)
  ctx.closePath()
  ctx.fillStyle = fillStyle
  ctx.fill()
}

/** 極冠の縁のうねりの位相をseedから決める(同じ天体は毎回同じ形になる)。 */
function polarCapPhases(seed: number): number[] {
  const random = createRandom(seed)
  return POLAR_EDGE_LOBES.map(() => random() * Math.PI * 2)
}

function drawPolarCap(
  ctx: CanvasRenderingContext2D,
  edgeLatDeg: number,
  isNorth: boolean,
  caps: PolarCaps,
  seed: number,
): void {
  const phases = polarCapPhases(seed)
  // 外側の薄い層から内側へ少しずつ広い不透明度で重ね、境界に霜のようなぼけを作る。
  // 層が少ないと等高線のような段が見えてしまうため、薄い層を多めに重ねる。
  const layerCount = 9
  for (let i = 0; i < layerCount; i += 1) {
    const t = i / (layerCount - 1)
    fillPolarCapLayer(
      ctx,
      edgeLatDeg,
      isNorth,
      // 1層あたりの不透明度は低く保ち、重ね合わせで中心へ向かって滑らかに濃くする。
      withAlpha(caps.color, i === layerCount - 1 ? 0.85 : 0.18),
      caps.raggednessDeg,
      phases,
      caps.raggednessDeg * 2.2 * (1 - t),
    )
  }
}

function drawPolarCaps(ctx: CanvasRenderingContext2D, caps: PolarCaps): void {
  drawPolarCap(ctx, caps.northEdgeLatDeg, true, caps, caps.seed)
  drawPolarCap(ctx, caps.southEdgeLatDeg, false, caps, caps.seed + 1)
}

/** クレーター本体: 明るい縁→暗い底の同心円グラデーションと、縁の外の薄いエジェクタ(明るいハロ)。 */
function drawCraterColorShape(
  ctx: CanvasRenderingContext2D,
  xPx: number,
  yPx: number,
  radiusPx: number,
  depth: number,
): void {
  const haloRadiusPx = radiusPx * 1.6

  const halo = ctx.createRadialGradient(xPx, yPx, radiusPx * 0.9, xPx, yPx, haloRadiusPx)
  halo.addColorStop(0, withAlpha('#ffffff', depth * 0.14))
  halo.addColorStop(1, withAlpha('#ffffff', 0))
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(xPx, yPx, haloRadiusPx, 0, Math.PI * 2)
  ctx.fill()

  const body = ctx.createRadialGradient(xPx, yPx, 0, xPx, yPx, radiusPx)
  body.addColorStop(0, withAlpha('#000000', depth * 0.55))
  body.addColorStop(0.72, withAlpha('#000000', depth * 0.3))
  body.addColorStop(0.86, withAlpha('#ffffff', depth * 0.45))
  body.addColorStop(1, withAlpha('#ffffff', 0))
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(xPx, yPx, radiusPx, 0, Math.PI * 2)
  ctx.fill()
}

/** クレーター固有の数値から光条の揺らぎ用seedを作る(craterに専用seedフィールドは持たせない)。 */
function craterSeed(crater: SurfaceCrater): number {
  return (
    Math.round(crater.lonDeg * 131 + crater.latDeg * 977 + crater.radiusDeg * 7919) >>> 0
  )
}

/** ティコのような光条。中心から放射状に伸びる細い明帯を先端に向けて透明にフェードさせる。 */
function drawCraterRays(
  ctx: CanvasRenderingContext2D,
  crater: SurfaceCrater,
  xPx: number,
  yPx: number,
  radiusPx: number,
): void {
  const rays = crater.rays
  if (rays === undefined) return

  const lengthPx = rays.lengthDeg * DEG_TO_PX
  const random = createRandom(craterSeed(crater))

  for (let i = 0; i < rays.count; i += 1) {
    const baseAngle = (i / rays.count) * Math.PI * 2
    const jitter = (random() - 0.5) * ((Math.PI * 2) / rays.count) * 0.6
    const angle = baseAngle + jitter
    const rayLength = lengthPx * (0.7 + random() * 0.3)

    ctx.save()
    ctx.translate(xPx, yPx)
    ctx.rotate(angle)
    const gradient = ctx.createLinearGradient(radiusPx * 0.6, 0, rayLength, 0)
    gradient.addColorStop(0, withAlpha(rays.color, rays.opacity))
    gradient.addColorStop(1, withAlpha(rays.color, 0))
    ctx.strokeStyle = gradient
    ctx.lineWidth = Math.max(1, radiusPx * 0.12)
    ctx.beginPath()
    ctx.moveTo(radiusPx * 0.6, 0)
    ctx.lineTo(rayLength, 0)
    ctx.stroke()
    ctx.restore()
  }
}

function drawNamedCraterColor(ctx: CanvasRenderingContext2D, crater: SurfaceCrater): void {
  const cyPx = toPixelY(crater.latDeg)
  const radiusPx = crater.radiusDeg * DEG_TO_PX
  const rayMarginDeg = crater.rays !== undefined ? crater.rays.lengthDeg : crater.radiusDeg * 1.6

  forEachWrappedLon(crater.lonDeg, crater.radiusDeg * 1.6, (lonDeg) => {
    drawCraterColorShape(ctx, toPixelX(lonDeg), cyPx, radiusPx, crater.depth)
  })
  if (crater.rays !== undefined) {
    forEachWrappedLon(crater.lonDeg, rayMarginDeg, (lonDeg) => {
      drawCraterRays(ctx, crater, toPixelX(lonDeg), cyPx, radiusPx)
    })
  }
}

function drawScatteredCraterColor(
  ctx: CanvasRenderingContext2D,
  crater: { lonDeg: number; latDeg: number; radiusDeg: number },
  depth: number,
): void {
  // 小さなクレーターが密集しすぎて岩の粒のように潰れないよう、named craterより深さをやや弱める。
  drawCraterColorShape(ctx, toPixelX(crater.lonDeg), toPixelY(crater.latDeg), crater.radiusDeg * DEG_TO_PX, depth * 0.85)
}

/** バンプ用の低振幅な全体のざらつき。色パスとは別seedの粗いfbmを直接ImageDataへ書き込む。 */
function paintRockyBumpBase(ctx: CanvasRenderingContext2D, surface: RockySurfaceSpec): void {
  const width = SURFACE_TEXTURE_WIDTH
  const height = SURFACE_TEXTURE_HEIGHT
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data
  // 色用ノイズと全く同じ模様が凹凸にも出ると不自然なため、seedをずらして別系列にする。
  const noise = createNoise2D(surface.noise.seed + 101)
  const { periodX, frequencyY } = surface.noise
  const amplitude = 26 // 128±26程度の弱いざらつき("globalAlpha 0.25相当"を直接ピクセル値で表現)

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height
    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width
      const n = fbm2D(noise, u * periodX, v * frequencyY, periodX, 3)
      const gray = 128 + (n - 0.5) * 2 * amplitude

      const idx = (y * width + x) * 4
      data[idx] = gray
      data[idx + 1] = gray
      data[idx + 2] = gray
      data[idx + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

function drawPatchReliefBump(ctx: CanvasRenderingContext2D, patch: SurfacePatch): void {
  if (patch.relief === undefined || patch.relief === 0) return

  const cyPx = toPixelY(patch.latDeg)
  const rxPx = (patch.lonRadiusDeg / 360) * SURFACE_TEXTURE_WIDTH
  const ryPx = (patch.latRadiusDeg / 180) * SURFACE_TEXTURE_HEIGHT
  const magnitude = Math.min(1, Math.abs(patch.relief))
  const centerGray = patch.relief > 0 ? 128 + 110 * magnitude : 128 - 90 * magnitude

  forEachWrappedLon(patch.lonDeg, patch.lonRadiusDeg, (lonDeg) => {
    fillEllipseGradient(ctx, toPixelX(lonDeg), cyPx, rxPx, ryPx, patch.rotationDeg, (c) => {
      const gradient = c.createRadialGradient(0, 0, 0, 0, 0, 1)
      gradient.addColorStop(0, `rgba(${centerGray}, ${centerGray}, ${centerGray}, 1)`)
      // 縁は必ず中間グレー(凹凸なし)へ戻す。
      gradient.addColorStop(1, 'rgba(128, 128, 128, 0)')
      c.fillStyle = gradient
      c.beginPath()
      c.arc(0, 0, 1, 0, Math.PI * 2)
      c.fill()
    })
  })
}

/** クレーターのバンプ: 底が暗く、縁が明るい同心円グラデーション。 */
function drawCraterBumpShape(
  ctx: CanvasRenderingContext2D,
  xPx: number,
  yPx: number,
  radiusPx: number,
  depth: number,
): void {
  const gradient = ctx.createRadialGradient(xPx, yPx, 0, xPx, yPx, radiusPx)
  gradient.addColorStop(0, `rgba(72, 72, 72, ${depth})`)
  gradient.addColorStop(0.66, `rgba(84, 84, 84, ${depth})`)
  gradient.addColorStop(0.84, `rgba(214, 214, 214, ${depth})`)
  gradient.addColorStop(1, 'rgba(128, 128, 128, 0)')
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(xPx, yPx, radiusPx, 0, Math.PI * 2)
  ctx.fill()
}

function createRockySurfaceMaps(surface: RockySurfaceSpec): SurfaceMaps {
  const colorCanvas = createCanvas()
  const bumpCanvas = createCanvas()
  const colorCtx = get2dContext(colorCanvas)
  const bumpCtx = get2dContext(bumpCanvas)
  if (colorCtx === null || bumpCtx === null) return { map: null, bumpMap: null }

  const scattered = layoutScatteredCraters(surface.scatteredCraters)

  // --- 色マップ ---
  paintRockyColorBase(colorCtx, surface)
  for (const patch of surface.patches) drawPatch(colorCtx, patch)
  if (surface.polarCaps !== undefined) drawPolarCaps(colorCtx, surface.polarCaps)
  for (const crater of surface.craters) drawNamedCraterColor(colorCtx, crater)
  for (const crater of scattered) {
    drawScatteredCraterColor(colorCtx, crater, surface.scatteredCraters.depth)
  }

  // --- バンプマップ ---
  paintRockyBumpBase(bumpCtx, surface)
  for (const patch of surface.patches) drawPatchReliefBump(bumpCtx, patch)
  for (const crater of surface.craters) {
    const radiusPx = crater.radiusDeg * DEG_TO_PX
    forEachWrappedLon(crater.lonDeg, crater.radiusDeg * 1.2, (lonDeg) => {
      drawCraterBumpShape(bumpCtx, toPixelX(lonDeg), toPixelY(crater.latDeg), radiusPx, crater.depth)
    })
  }
  for (const crater of scattered) {
    const radiusPx = crater.radiusDeg * DEG_TO_PX
    drawCraterBumpShape(
      bumpCtx,
      toPixelX(crater.lonDeg),
      toPixelY(crater.latDeg),
      radiusPx,
      surface.scatteredCraters.depth,
    )
  }

  return { map: toColorTexture(colorCanvas), bumpMap: toBumpTexture(bumpCanvas) }
}

// ---------------------------------------------------------------------------
// ガス惑星(gas): 木星・土星
// ---------------------------------------------------------------------------

/** 帯(belts)をturbulenceで波打たせ、mottleで細かい明暗を足した基本色を1パスで書き込む。 */
function paintGasColorBase(ctx: CanvasRenderingContext2D, surface: GasSurfaceSpec): void {
  const width = SURFACE_TEXTURE_WIDTH
  const height = SURFACE_TEXTURE_HEIGHT
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data
  const beltRgbStops = toRgbStops(surface.belts)
  const turbNoise = createNoise2D(surface.turbulence.seed)
  const mottleNoise = createNoise2D(surface.mottle.seed)
  const turb = surface.turbulence
  const mottle = surface.mottle

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height
    const latDeg = 90 - v * 180

    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width

      // X方向に長く伸びたfbmで緯度をずらし、帯の境界を横に流れるガスの筋として波打たせる。
      const warp =
        (fbm2D(turbNoise, u * turb.periodX, v * turb.frequencyY, turb.periodX, turb.octaves) - 0.5) * 2
      const latW = latDeg + warp * turb.amplitudeDeg
      const [r0, g0, b0] = interpolateRgbStops(beltRgbStops, latW)

      const m =
        (fbm2D(mottleNoise, u * mottle.periodX, v * mottle.frequencyY, mottle.periodX, mottle.octaves) -
          0.5) *
        2
      const factor = 1 + m * mottle.amount

      const idx = (y * width + x) * 4
      data[idx] = r0 * factor
      data[idx + 1] = g0 * factor
      data[idx + 2] = b0 * factor
      data[idx + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

function drawGasSpot(ctx: CanvasRenderingContext2D, spot: GasSpot): void {
  const cyPx = toPixelY(spot.latDeg)
  const rxPx = (spot.lonRadiusDeg / 360) * SURFACE_TEXTURE_WIDTH
  const ryPx = (spot.latRadiusDeg / 180) * SURFACE_TEXTURE_HEIGHT

  forEachWrappedLon(spot.lonDeg, spot.lonRadiusDeg, (lonDeg) => {
    fillEllipseGradient(ctx, toPixelX(lonDeg), cyPx, rxPx, ryPx, spot.rotationDeg, (c) => {
      const gradient = c.createRadialGradient(0, 0, 0, 0, 0, 1)
      for (const stop of spot.stops) {
        gradient.addColorStop(stop.at, withAlpha(stop.color, stop.opacity))
      }
      c.fillStyle = gradient
      c.beginPath()
      c.arc(0, 0, 1, 0, Math.PI * 2)
      c.fill()

      const swirl = spot.swirl
      if (swirl === undefined) return

      // 大赤斑らしい渦を、楕円座標系(単位円)上のアルキメデス螺旋として描く。
      c.strokeStyle = withAlpha(swirl.color, swirl.opacity)
      c.lineWidth = swirl.width / Math.max((rxPx + ryPx) / 2, 0.0001)
      c.beginPath()
      const steps = 96
      const maxAngle = swirl.turns * Math.PI * 2
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps
        const angle = t * maxAngle
        const radius = t * 0.82
        const px = Math.cos(angle) * radius
        const py = Math.sin(angle) * radius
        if (i === 0) c.moveTo(px, py)
        else c.lineTo(px, py)
      }
      c.stroke()
    })
  })
}

function createGasSurfaceMaps(surface: GasSurfaceSpec): SurfaceMaps {
  const colorCanvas = createCanvas()
  const colorCtx = get2dContext(colorCanvas)
  if (colorCtx === null) return { map: null, bumpMap: null }

  paintGasColorBase(colorCtx, surface)
  for (const spot of surface.spots) drawGasSpot(colorCtx, spot)

  // ガス惑星は岩石質感になってしまうため、バンプマップは作らない。
  return { map: toColorTexture(colorCanvas), bumpMap: null }
}

/**
 * 天体表面のCanvasTextureを作る。Canvas 2Dが使えない環境(テスト等)では両方nullを返す。
 * `style`の判別だけがこのゲームで唯一許可された天体別分岐で、岩石天体とガス惑星は
 * 生成アルゴリズムが本質的に別物なので「2つの生成器」として実装している。
 */
export function createSurfaceMaps(surface: SurfaceSpec): SurfaceMaps {
  return surface.style === 'rocky' ? createRockySurfaceMaps(surface) : createGasSurfaceMaps(surface)
}
