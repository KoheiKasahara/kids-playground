import * as THREE from 'three'
import type { CelestialBody, RingSegment, RingSpec } from '../types'
import { createNoise2D } from './noise'

export const RING_TEXTURE_WIDTH = 512
/** 輪の模様は径方向にしか変化しないため高さは1pxで足りるが、環境差を避けて2px確保しておく。 */
const RING_TEXTURE_HEIGHT = 2

/** '#rrggbb' を [r, g, b](0..255)へ分解する。 */
function hexToRgb(hexColor: string): [number, number, number] {
  const hex = hexColor.replace('#', '')
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
}

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

/**
 * 内(0)→外(1)の位置tにおける帯の色とアルファを線形補間で求める。
 * bandsはat昇順で並んでいる前提で、範囲外(t<最初のat、t>最後のat)は両端でクランプする。
 */
export function sampleRingBands(
  bands: readonly { at: number; color: string; opacity: number }[],
  t: number,
): { r: number; g: number; b: number; a: number } {
  const first = bands[0]
  const last = bands[bands.length - 1]
  if (t <= first.at) {
    const [r, g, b] = hexToRgb(first.color)
    return { r, g, b, a: first.opacity }
  }
  if (t >= last.at) {
    const [r, g, b] = hexToRgb(last.color)
    return { r, g, b, a: last.opacity }
  }

  for (let i = 0; i < bands.length - 1; i += 1) {
    const a = bands[i]
    const b = bands[i + 1]
    if (t >= a.at && t <= b.at) {
      const span = b.at - a.at
      const localT = span === 0 ? 0 : (t - a.at) / span
      const [ar, ag, ab] = hexToRgb(a.color)
      const [br, bg, bb] = hexToRgb(b.color)
      return {
        r: ar + (br - ar) * localT,
        g: ag + (bg - ag) * localT,
        b: ab + (bb - ab) * localT,
        a: a.opacity + (b.opacity - a.opacity) * localT,
      }
    }
  }

  const [r, g, b] = hexToRgb(last.color)
  return { r, g, b, a: last.opacity }
}

/** jsdomのように2Dコンテキストを持たない環境でも、例外にせずテクスチャ生成を続ける。 */
function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d')
  } catch {
    return null
  }
}

/**
 * 輪の1セグメントぶんのテクスチャ(内→外、512×2)。`createLinearGradient`ではなく
 * ImageDataへ直接書き込むのは、リングレット(細いリングの濃淡)をピクセル単位のノイズで
 * 変調するため。プリマルチプライはしない(three側で扱う)。
 */
export function createRingSegmentTexture(segment: RingSegment): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas')
  canvas.width = RING_TEXTURE_WIDTH
  canvas.height = RING_TEXTURE_HEIGHT

  const ctx = get2dContext(canvas)
  if (ctx === null) return null

  const imageData = ctx.createImageData(RING_TEXTURE_WIDTH, RING_TEXTURE_HEIGHT)
  const data = imageData.data
  const ringlets = segment.ringlets
  const ringletNoise = ringlets !== undefined ? createNoise2D(ringlets.seed) : null

  for (let x = 0; x < RING_TEXTURE_WIDTH; x += 1) {
    const t = x / (RING_TEXTURE_WIDTH - 1)
    const { r, g, b, a } = sampleRingBands(segment.bands, t)

    let alpha = a
    if (ringlets !== undefined && ringletNoise !== null) {
      // 輪はテクスチャの径方向にだけ変化する1次元的な模様なので、周期(タイル)は不要。
      // periodXはcountより大きい値にして、この範囲内でwrapが起きないようにする。
      const n = ringletNoise(t * ringlets.count, 0, ringlets.count + 2)
      alpha *= 1 + ringlets.amount * (n * 2 - 1)
    }
    alpha = THREE.MathUtils.clamp(alpha, 0, 1)

    for (let y = 0; y < RING_TEXTURE_HEIGHT; y += 1) {
      const idx = (y * RING_TEXTURE_WIDTH + x) * 4
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = alpha * 255
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true
  return texture
}

/**
 * 輪のメッシュ群。セグメント(C環・B環・A環・F環など)ごとに1枚のRingGeometryを作る。
 * カッシーニ間隙のような大きなすき間は、テクスチャの暗い帯ではなくセグメント間の
 * 実際の幾何的すき間として表現する(`celestialBodies.ts`のinner/outerRadiusRatioの差)。
 *
 * `getTexture` は既定で `createRingSegmentTexture` を使うが、`usePlanetEngine.ts` は
 * ここへキャッシュ付きの関数を渡すことで、天体を切り替えるたびにテクスチャ生成
 * (ピクセルループ)をやり直さないようにする。ジオメトリ・マテリアル・メッシュ自体は
 * 天体切り替えのたびに作り直して構わない軽いオブジェクトなので、キャッシュ対象はテクスチャだけにする。
 */
export function createRingMeshes(
  body: CelestialBody,
  ring: RingSpec,
  getTexture: (segment: RingSegment, index: number) => THREE.CanvasTexture | null = createRingSegmentTexture,
): THREE.Mesh[] {
  return ring.segments.map((segment, index) => {
    const innerRadius = body.radius * segment.innerRadiusRatio
    const outerRadius = body.radius * segment.outerRadiusRatio

    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 192, 1)
    applyRadialRingUv(geometry, innerRadius, outerRadius)

    const map = getTexture(segment, index)
    // 暗部でも輪が真っ黒に沈まないよう、最も濃く塗られる帯の色をわずかな自己発光にする。
    const brightestBand = segment.bands.reduce(
      (brightest, band) => (band.opacity > brightest.opacity ? band : brightest),
      segment.bands[0],
    )

    const material = new THREE.MeshStandardMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
      emissive: new THREE.Color(brightestBand.color),
      emissiveIntensity: 0.06,
    })
    if (map !== null) {
      material.map = map
    } else {
      // Canvas 2Dが使えない環境でも輪が透明にならないよう、その帯の代表色で塗る。
      material.color = new THREE.Color(brightestBand.color)
    }

    const mesh = new THREE.Mesh(geometry, material)
    // RingGeometryはXY平面に作られるため、天体の赤道面(XZ平面)へ寝かせる。
    mesh.rotation.x = -Math.PI / 2
    mesh.renderOrder = 2
    // 土星本体の影を輪が受け止めることが立体感の決め手。輪自体は半透明マスクを
    // 影として正しく扱えないため、影は落とさせない。
    mesh.receiveShadow = true
    mesh.castShadow = false
    mesh.name = segment.id
    return mesh
  })
}

/** 輪の最も外側のセグメントの外周半径比。カメラが輪全体を画面に収めるための基準に使う。 */
export function ringOuterRadiusRatio(ring: RingSpec): number {
  return ring.segments.reduce((max, segment) => Math.max(max, segment.outerRadiusRatio), 0)
}

/**
 * 天体の軸傾きを表すZ軸まわりの回転(ラジアン)。
 * 輪の姿勢もこの回転で決まるため、3Dエンジンと回帰テストが同じ値を使えるようここに置く。
 */
export function axialTiltRotationZ(body: CelestialBody): number {
  return -(body.axialTiltDegrees * Math.PI) / 180
}
