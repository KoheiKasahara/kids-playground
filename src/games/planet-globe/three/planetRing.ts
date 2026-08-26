import * as THREE from 'three'
import type { CelestialBody, RingSpec } from '../types'
import { withAlpha } from './planetSurface'

export const RING_TEXTURE_WIDTH = 256
/** 幅1pxの帯だとcreateLinearGradientの塗り自体はできるが、念のため数px確保しておく。 */
const RING_TEXTURE_HEIGHT = 4

/**
 * RingGeometry の既定UVは半径方向に対応しないため、u=内→外の位置(0..1)・v=0.5 に貼り替える。
 * これで1本のグラデーション画像を輪の帯として使える。
 */
export function applyRadialRingUv(
  geometry: THREE.BufferGeometry,
  innerRadius: number,
  outerRadius: number,
): void {
  const position = geometry.getAttribute('position')
  const uv = new Float32Array(position.count * 2)
  const range = outerRadius - innerRadius

  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const y = position.getY(i)
    const radius = Math.sqrt(x * x + y * y)
    const u = range === 0 ? 0 : THREE.MathUtils.clamp((radius - innerRadius) / range, 0, 1)
    uv[i * 2] = u
    uv[i * 2 + 1] = 0.5
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

/** jsdomのように2Dコンテキストを持たない環境でも、例外にせずテクスチャ生成を続ける。 */
function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d')
  } catch {
    return null
  }
}

/** 輪のグラデーション（内→外）テクスチャ。Canvas 2Dが使えない環境では null。 */
export function createRingTexture(ring: RingSpec): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas')
  canvas.width = RING_TEXTURE_WIDTH
  canvas.height = RING_TEXTURE_HEIGHT

  const ctx = get2dContext(canvas)
  if (ctx === null) return null

  const gradient = ctx.createLinearGradient(0, 0, RING_TEXTURE_WIDTH, 0)
  for (const band of ring.bands) {
    gradient.addColorStop(band.at, withAlpha(band.color, band.opacity))
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, RING_TEXTURE_WIDTH, RING_TEXTURE_HEIGHT)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/** 輪のメッシュ。天体の赤道面に寝かせた状態で返す。 */
export function createRingMesh(body: CelestialBody, ring: RingSpec): THREE.Mesh {
  const innerRadius = body.radius * ring.innerRadiusRatio
  const outerRadius = body.radius * ring.outerRadiusRatio

  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 128, 1)
  applyRadialRingUv(geometry, innerRadius, outerRadius)

  const map = createRingTexture(ring)
  // 暗部でも輪が真っ黒に沈まないよう、最も濃く塗られる帯の色をわずかな自己発光にする。
  const brightestBand = ring.bands.reduce(
    (brightest, band) => (band.opacity > brightest.opacity ? band : brightest),
    ring.bands[0],
  )

  const material = new THREE.MeshStandardMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 1,
    metalness: 0,
    emissive: new THREE.Color(brightestBand.color),
    emissiveIntensity: 0.25,
  })
  if (map !== null) {
    material.map = map
  } else {
    // Canvas 2Dが使えない環境でも輪が透明にならないよう、淡い黄褐色で塗る。
    material.color = new THREE.Color('#d9c9a4')
  }

  const mesh = new THREE.Mesh(geometry, material)
  // RingGeometryはXY平面に作られるため、天体の赤道面(XZ平面)へ寝かせる。
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = 1
  return mesh
}

/**
 * 天体の軸傾きを表すZ軸まわりの回転(ラジアン)。
 * 輪の姿勢もこの回転で決まるため、3Dエンジンと回帰テストが同じ値を使えるようここに置く。
 */
export function axialTiltRotationZ(body: CelestialBody): number {
  return -(body.axialTiltDegrees * Math.PI) / 180
}
