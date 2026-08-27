import * as THREE from 'three'
import type { RingSpec, SurfacePatch, SurfaceSpec } from '../types'
import { drawNaturalEarthLandmasses, withAlpha } from './planetSurface'

/**
 * 太陽系全体表示(Phase 6)専用の軽量な見た目生成。
 *
 * 個別観察(`planetSurface.ts`)は1024×512のCanvasへfbmノイズ・クレーター・極冠を
 * ピクセル単位で焼き込む重い生成器で、9天体ぶん同時に走らせると一覧表示の負荷として
 * 無視できない。全体表示では「並び順・色・大まかな模様が分かる」ことが目的のため、
 * 同じ`SurfaceSpec`(緯度プロファイル・帯・パッチ)を読みつつ、ノイズ・クレーター・
 * 極冠は描かず、小さなCanvasへのグラデーション+パッチ塗りだけで済ませる。
 */
const OVERVIEW_TEXTURE_WIDTH = 128
const OVERVIEW_TEXTURE_HEIGHT = 64

/** jsdomのように2Dコンテキストを持たない環境でも、例外にせずテクスチャ生成を続ける。 */
function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d')
  } catch {
    return null
  }
}

function paintLatitudeGradient(
  ctx: CanvasRenderingContext2D,
  stops: readonly { latDeg: number; color: string }[],
  width: number,
  height: number,
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  for (const stop of stops) {
    const t = THREE.MathUtils.clamp((90 - stop.latDeg) / 180, 0, 1)
    gradient.addColorStop(t, stop.color)
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

/** 経緯度パッチ(大陸・トンボー地域など)を、楕円グラデーションなしの単純な塗りで置く。 */
function paintPatch(ctx: CanvasRenderingContext2D, patch: SurfacePatch, width: number, height: number): void {
  const cx = ((patch.lonDeg + 180) / 360) * width
  const cy = ((90 - patch.latDeg) / 180) * height
  const rx = Math.max(1, (patch.lonRadiusDeg / 360) * width)
  const ry = Math.max(1, (patch.latRadiusDeg / 180) * height)

  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(rx, ry)
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, Math.PI * 2)
  ctx.fillStyle = withAlpha(patch.color, patch.opacity)
  ctx.fill()
  ctx.restore()
}

/**
 * 天体表面の軽量CanvasTexture。rocky/gasどちらも「緯度グラデーション+主要パッチ」だけで表す
 * (ノイズ・クレーター・極冠・ガス惑星の斑点は個別観察側だけの表現に留める)。
 */
export function createOverviewSurfaceTexture(surface: SurfaceSpec): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas')
  canvas.width = OVERVIEW_TEXTURE_WIDTH
  canvas.height = OVERVIEW_TEXTURE_HEIGHT
  const ctx = get2dContext(canvas)
  if (ctx === null) return null

  if (surface.style === 'gas') {
    paintLatitudeGradient(ctx, surface.belts, OVERVIEW_TEXTURE_WIDTH, OVERVIEW_TEXTURE_HEIGHT)
  } else {
    paintLatitudeGradient(ctx, surface.latitudeStops, OVERVIEW_TEXTURE_WIDTH, OVERVIEW_TEXTURE_HEIGHT)
    if (surface.landmasses !== undefined) {
      // 個別観察と同じ海岸線を小さなテクスチャにも使い、全体表示で地球だけ青い球へ戻らないようにする。
      drawNaturalEarthLandmasses(ctx, surface.landmasses, OVERVIEW_TEXTURE_WIDTH, OVERVIEW_TEXTURE_HEIGHT)
    } else {
      // パッチが多い天体(火星など)でも小さなCanvasなので負荷は軽い。目立つ地形だけ乗せれば十分なため、
      // 数が多い場合は前から6件に絞る(データ側の並びは主要な地形ほど先に書かれている)。
      for (const patch of surface.patches.slice(0, 6)) paintPatch(ctx, patch, OVERVIEW_TEXTURE_WIDTH, OVERVIEW_TEXTURE_HEIGHT)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/** 太陽の周囲へ重ねる、低負荷な放射状の発光テクスチャ(individual viewのcreateHaloTextureを全体表示向けに縮小)。 */
export function createOverviewHaloTexture(color: string): THREE.CanvasTexture | null {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = get2dContext(canvas)
  if (ctx === null) return null

  const rgb = new THREE.Color(color)
  const r = Math.round(rgb.r * 255)
  const g = Math.round(rgb.g * 255)
  const b = Math.round(rgb.b * 255)
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.22, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.3)`)
  gradient.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.16)`)
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/**
 * 土星のように複数セグメントの帯が既に太い輪は、全体表示の縮小スケールでもリングらしさが
 * 残るためそのまま使う。天王星のような細く淡い1本だけの輪は縮小するとほぼ見えなくなり、
 * 自転軸の傾きを伝える手がかりを失ってしまうため、「セグメント幅の合計が小さい輪だけ」
 * 全体表示向けに太く・濃くする(天体IDでの分岐ではなく、輪の見た目の細さで判定する)。
 */
const THIN_RING_TOTAL_WIDTH_RATIO = 0.2

export function boostThinRingForOverview(ring: RingSpec): RingSpec {
  const totalWidthRatio = ring.segments.reduce(
    (sum, segment) => sum + (segment.outerRadiusRatio - segment.innerRadiusRatio),
    0,
  )
  if (totalWidthRatio >= THIN_RING_TOTAL_WIDTH_RATIO) return ring

  return {
    segments: ring.segments.map((segment) => {
      const mid = (segment.innerRadiusRatio + segment.outerRadiusRatio) / 2
      const halfWidth = Math.max((segment.outerRadiusRatio - segment.innerRadiusRatio) / 2, 0.03) * 2.4
      return {
        ...segment,
        innerRadiusRatio: mid - halfWidth,
        outerRadiusRatio: mid + halfWidth,
        bands: segment.bands.map((band) => ({ ...band, opacity: Math.min(1, band.opacity + 0.3) })),
      }
    }),
  }
}

const LABEL_TEXTURE_WIDTH = 192
const LABEL_TEXTURE_HEIGHT = 56

/**
 * 天体名の小さなラベル用CanvasTexture。常時表示しても画面を圧迫しないよう控えめな大きさにし、
 * どの背景(宇宙・天体本体)の上でも読めるよう縁取りを付ける。
 */
export function createOverviewLabelTexture(text: string): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas')
  canvas.width = LABEL_TEXTURE_WIDTH
  canvas.height = LABEL_TEXTURE_HEIGHT
  const ctx = get2dContext(canvas)
  if (ctx === null) return null

  ctx.font = '700 32px "Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const x = LABEL_TEXTURE_WIDTH / 2
  const y = LABEL_TEXTURE_HEIGHT / 2

  ctx.lineWidth = 6
  ctx.strokeStyle = 'rgba(6, 10, 28, 0.75)'
  ctx.lineJoin = 'round'
  ctx.strokeText(text, x, y)

  ctx.fillStyle = '#ffffff'
  ctx.fillText(text, x, y)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}
