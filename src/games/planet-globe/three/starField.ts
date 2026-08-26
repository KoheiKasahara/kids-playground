import * as THREE from 'three'
import { createRandom } from './planetSurface'

/**
 * 背景の星。CSSの静止した点描(Phase 1)をやめてWebGL側に置くことで、
 * カメラの向きに応じて星も一緒に回り、宇宙の中にいる感覚を出す。
 * 主役は天体なので、数は控えめ・輝度も抑えて演出は入れない(流れる・瞬く等はしない)。
 */
export const STAR_COUNT = 520
/** `planetCamera.CAMERA_FAR`(3000)の内側に収まる半径。 */
export const STAR_FIELD_RADIUS = 1200

/** 天体データのseedと衝突しない、星専用の固定seed。 */
const STAR_FIELD_SEED = 20260826

export type StarFieldPositions = { positions: Float32Array; colors: Float32Array }

/** jsdomのように2Dコンテキストを持たない環境でも、例外にせずテクスチャ生成を続ける。 */
function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d')
  } catch {
    return null
  }
}

/** 星ひとつぶんの丸いスプライト。角ばった正方形の点に見えないようにする。 */
function createStarSpriteTexture(): THREE.CanvasTexture | null {
  const size = 8
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = get2dContext(canvas)
  if (ctx === null) return null

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.55)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

/**
 * 球面上に一様分布する星の位置と色をseedから決定的に作る。
 * z成分を一様に選んでからθを一様に選ぶ標準的な方法で、極付近に星が偏らないようにする。
 */
export function createStarPositions(seed: number): StarFieldPositions {
  const random = createRandom(seed)
  const positions = new Float32Array(STAR_COUNT * 3)
  const colors = new Float32Array(STAR_COUNT * 3)

  for (let i = 0; i < STAR_COUNT; i += 1) {
    const z = 1 - 2 * random()
    const theta = 2 * Math.PI * random()
    const ringRadius = Math.sqrt(Math.max(0, 1 - z * z))
    const x = ringRadius * Math.cos(theta)
    const y = ringRadius * Math.sin(theta)

    positions[i * 3] = x * STAR_FIELD_RADIUS
    positions[i * 3 + 1] = y * STAR_FIELD_RADIUS
    positions[i * 3 + 2] = z * STAR_FIELD_RADIUS

    // 白基調に、わずかな青み・橙みと明るさのばらつきを与える。
    const warmth = random() * 2 - 1 // -1(青寄り)..1(橙寄り)
    const brightness = 0.35 + random() * 0.65
    colors[i * 3] = THREE.MathUtils.clamp(brightness * (1 + Math.max(0, warmth) * 0.15), 0, 1)
    colors[i * 3 + 1] = THREE.MathUtils.clamp(brightness * (1 - Math.abs(warmth) * 0.08), 0, 1)
    colors[i * 3 + 2] = THREE.MathUtils.clamp(brightness * (1 + Math.max(0, -warmth) * 0.2), 0, 1)
  }

  return { positions, colors }
}

/** scene直下に1つだけ置く星のPoints。天体を切り替えても作り直さない。 */
export function createStarField(pixelRatio: number): THREE.Points {
  const { positions, colors } = createStarPositions(STAR_FIELD_SEED)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  const material = new THREE.PointsMaterial({
    size: 2 * pixelRatio,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    opacity: 0.85,
    alphaTest: 0.02,
  })
  const sprite = createStarSpriteTexture()
  if (sprite !== null) material.map = sprite

  const points = new THREE.Points(geometry, material)
  points.renderOrder = -1
  points.frustumCulled = false
  return points
}

export function disposeStarField(points: THREE.Points): void {
  points.geometry.dispose()
  const material = points.material as THREE.PointsMaterial
  material.map?.dispose()
  material.dispose()
}
