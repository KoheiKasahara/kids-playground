import * as THREE from 'three'
import type { SurfaceSpec, SurfaceSpeckles } from '../types'

/**
 * 天体表面のテクスチャは新規画像を使わず、Canvas 2Dで手続き的に生成する。
 * 2:1(緯度経度)のUVに合わせて幅を高さの2倍にする。
 */
export const SURFACE_TEXTURE_WIDTH = 1024
export const SURFACE_TEXTURE_HEIGHT = 512

/** 斑点のy座標(極付近の強い歪みを避ける範囲)。テクスチャ比率(0..1)。 */
const SPECKLE_MIN_Y = 0.14
const SPECKLE_MAX_Y = 0.86

/** クレーターの縁を描くときの、本体半径に対する倍率。 */
const SPECKLE_RIM_RADIUS_SCALE = 1.35

/** '#rrggbb' と 0..1 のアルファから 'rgba(r, g, b, a)' を作る。 */
export function withAlpha(hexColor: string, alpha: number): string {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * seed から決定的な 0..1 の乱数列を作る(mulberry32)。
 * 同じ天体は毎回同じクレーター配置になるようにする(再マウントのたびに模様が変わると違和感がある)。
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

export type SpeckleLayout = { x: number; y: number; radius: number }

/**
 * 斑点の配置を決める。テクスチャ比率(0..1)で返す。
 * - y は極付近の強い歪みを避けるため 0.14〜0.86 に収める
 * - 左右端をまたぐ斑点は x を ±1 ずらした複製も返し、経度0度の継ぎ目を作らない
 */
export function layoutSpeckles(speckles: SurfaceSpeckles): SpeckleLayout[] {
  const random = createRandom(speckles.seed)
  const layouts: SpeckleLayout[] = []
  const radiusRange = speckles.maxRadius - speckles.minRadius
  // radiusはテクスチャ「高さ」に対する比のため、幅方向の継ぎ目判定にはアスペクト比で換算する。
  const heightToWidthRatio = SURFACE_TEXTURE_HEIGHT / SURFACE_TEXTURE_WIDTH

  for (let i = 0; i < speckles.count; i += 1) {
    const x = random()
    const y = SPECKLE_MIN_Y + random() * (SPECKLE_MAX_Y - SPECKLE_MIN_Y)
    const radius = speckles.minRadius + random() * radiusRange
    layouts.push({ x, y, radius })

    const radiusInWidthRatio = radius * heightToWidthRatio
    if (x - radiusInWidthRatio < 0) layouts.push({ x: x + 1, y, radius })
    if (x + radiusInWidthRatio > 1) layouts.push({ x: x - 1, y, radius })
  }

  return layouts
}

/** jsdomのように2Dコンテキストを持たない環境でも、例外にせずテクスチャ生成を続ける。 */
function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d')
  } catch {
    return null
  }
}

/** 天体表面のCanvasTextureを作る。Canvas 2Dが使えない環境（テスト等）では null を返す。 */
export function createSurfaceTexture(surface: SurfaceSpec): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas')
  canvas.width = SURFACE_TEXTURE_WIDTH
  canvas.height = SURFACE_TEXTURE_HEIGHT

  const ctx = get2dContext(canvas)
  if (ctx === null) return null

  ctx.fillStyle = surface.baseColor
  ctx.fillRect(0, 0, SURFACE_TEXTURE_WIDTH, SURFACE_TEXTURE_HEIGHT)

  if (surface.bands !== undefined && surface.bands.length > 0) {
    const gradient = ctx.createLinearGradient(0, 0, 0, SURFACE_TEXTURE_HEIGHT)
    for (const band of surface.bands) {
      gradient.addColorStop(band.at, band.color)
    }
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, SURFACE_TEXTURE_WIDTH, SURFACE_TEXTURE_HEIGHT)
  }

  if (surface.speckles !== undefined) {
    const { speckles } = surface
    for (const speckle of layoutSpeckles(speckles)) {
      const centerX = speckle.x * SURFACE_TEXTURE_WIDTH
      const centerY = speckle.y * SURFACE_TEXTURE_HEIGHT
      const radiusPx = speckle.radius * SURFACE_TEXTURE_HEIGHT

      if (speckles.rimColor !== undefined) {
        ctx.fillStyle = withAlpha(speckles.rimColor, speckles.opacity)
        ctx.beginPath()
        ctx.arc(centerX, centerY, radiusPx * SPECKLE_RIM_RADIUS_SCALE, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.fillStyle = withAlpha(speckles.color, speckles.opacity)
      ctx.beginPath()
      ctx.arc(centerX, centerY, radiusPx, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.needsUpdate = true
  return texture
}
