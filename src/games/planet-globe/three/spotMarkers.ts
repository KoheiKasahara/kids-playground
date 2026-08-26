import * as THREE from 'three'
import type { CelestialBody, FeatureSpotTarget } from '../types'
import { surfaceDirection } from './planetCoords'

/** マーカーの見た目の半径(天体半径に対する比)。小さく控えめにして天体の観察を邪魔しない。 */
export const MARKER_RADIUS_RATIO = 0.045
/**
 * マーカーを表面から浮かせる量(天体半径に対する比)。
 * マーカーのmaterialは`depthTest: false`なので、球に埋もれないための浮かせ量は本来不要
 * (裏側に回ったマーカーは可視判定で非表示にするため、深度に頼らなくてよい)。
 * それでも0にしないのは、球の表面とまったく同じ位置だと視差が無く貼り付いて見えるため。
 * 大きくすると縁付近のマーカーが球のシルエットの外側へはみ出して浮いて見えるので、
 * 「わずかに手前」と分かる最小限に留める。
 */
export const MARKER_SURFACE_OFFSET_RATIO = 0.01
/** 輪ハイライトの最大不透明度。輪の模様が消える単色べた塗りにしないための上限。 */
export const RING_HIGHLIGHT_MAX_OPACITY = 0.22
/** 輪ハイライトの色。天体本体の色に依らず、暖色系の淡い白で統一する。 */
export const RING_HIGHLIGHT_COLOR = '#fff2d8'

/**
 * 球面スポットの、天体ローカル(spinGroup基準・自転前)の位置。
 * `surfaceDirection`が返す単位ベクトルへ、扁平(Y方向のみ)を反映した半径をかけたうえで、
 * ベクトル全体を(1+MARKER_SURFACE_OFFSET_RATIO)倍することで表面からわずかに浮かせる
 * (楕円体の法線方向ではなく原点からの拡大なので、極付近でもマーカーが軸から傾かない)。
 */
export function surfaceSpotLocalPosition(
  body: CelestialBody,
  target: { lonDeg: number; latDeg: number },
): { x: number; y: number; z: number } {
  const direction = surfaceDirection(target.lonDeg, target.latDeg)
  const flattening = body.flattening ?? 0
  const scale = body.radius * (1 + MARKER_SURFACE_OFFSET_RATIO)
  return {
    x: direction.x * scale,
    y: direction.y * scale * (1 - flattening),
    z: direction.z * scale,
  }
}

/** 輪スポットの、tiltGroupローカルの位置(赤道面 y=0)。 */
export function ringSpotLocalPosition(
  body: CelestialBody,
  target: { radiusRatio: number; angleDeg: number },
): { x: number; y: number; z: number } {
  const angleRad = (target.angleDeg * Math.PI) / 180
  const radius = body.radius * target.radiusRatio
  return {
    x: radius * Math.cos(angleRad),
    y: 0,
    z: radius * Math.sin(angleRad),
  }
}

/**
 * ハイライトする輪の帯を解決する。`highlightSegmentIds`は`body.ring.segments`から
 * inner/outerRadiusRatioを引き(存在しないidは無視する)、`highlightRadiusBand`があれば
 * それをそのまま足す。どちらも無ければ空配列を返す(輪の無い天体でも安全に呼べる)。
 */
export function resolveRingHighlightBands(
  body: CelestialBody,
  target: FeatureSpotTarget & { kind: 'ring' },
): readonly { innerRatio: number; outerRatio: number }[] {
  const bands: { innerRatio: number; outerRatio: number }[] = []

  if (target.highlightSegmentIds !== undefined && body.ring !== undefined) {
    for (const id of target.highlightSegmentIds) {
      const segment = body.ring.segments.find((candidate) => candidate.id === id)
      if (segment === undefined) continue
      bands.push({ innerRatio: segment.innerRadiusRatio, outerRatio: segment.outerRadiusRatio })
    }
  }

  if (target.highlightRadiusBand !== undefined) {
    bands.push(target.highlightRadiusBand)
  }

  return bands
}

/** jsdomのように2Dコンテキストを持たない環境でも、例外にせずテクスチャ生成を続ける。 */
function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d')
  } catch {
    return null
  }
}

const MARKER_TEXTURE_SIZE = 128

/**
 * マーカー用のCanvasTexture(やわらかい輪＋ごく淡い芯)。原色べた塗り・巨大ピン・強い発光は使わない。
 * 白(無彩色)で描き、Spriteのmaterial.colorで通常時/選択時の色を掛け合わせて使う。
 */
export function createMarkerTexture(): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas')
  canvas.width = MARKER_TEXTURE_SIZE
  canvas.height = MARKER_TEXTURE_SIZE
  const ctx = get2dContext(canvas)
  if (ctx === null) return null

  const center = MARKER_TEXTURE_SIZE / 2

  // 細くやわらかい輪。内外どちらへもぼかして、くっきりしたドーナツにしない。
  const ring = ctx.createRadialGradient(center, center, MARKER_TEXTURE_SIZE * 0.16, center, center, MARKER_TEXTURE_SIZE * 0.5)
  ring.addColorStop(0, 'rgba(255,255,255,0)')
  ring.addColorStop(0.56, 'rgba(255,255,255,0.9)')
  ring.addColorStop(0.74, 'rgba(255,255,255,0.9)')
  ring.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = ring
  ctx.fillRect(0, 0, MARKER_TEXTURE_SIZE, MARKER_TEXTURE_SIZE)

  // ごく淡い芯。輪の内側をうっすら光らせ、「ここにある」ことだけを伝える。
  const core = ctx.createRadialGradient(center, center, 0, center, center, MARKER_TEXTURE_SIZE * 0.32)
  core.addColorStop(0, 'rgba(255,255,255,0.5)')
  core.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = core
  ctx.fillRect(0, 0, MARKER_TEXTURE_SIZE, MARKER_TEXTURE_SIZE)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/** 選択時に一度だけ広がる細いリング用のCanvasTexture(芯は持たない、輪だけ)。 */
export function createPulseTexture(): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas')
  canvas.width = MARKER_TEXTURE_SIZE
  canvas.height = MARKER_TEXTURE_SIZE
  const ctx = get2dContext(canvas)
  if (ctx === null) return null

  const center = MARKER_TEXTURE_SIZE / 2
  const ring = ctx.createRadialGradient(center, center, MARKER_TEXTURE_SIZE * 0.34, center, center, MARKER_TEXTURE_SIZE * 0.5)
  ring.addColorStop(0, 'rgba(255,255,255,0)')
  ring.addColorStop(0.5, 'rgba(255,255,255,0.95)')
  ring.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = ring
  ctx.fillRect(0, 0, MARKER_TEXTURE_SIZE, MARKER_TEXTURE_SIZE)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/**
 * 輪ハイライト用の加算合成メッシュ群。帯ごとに1枚のRingGeometryを作り、赤道面(XZ平面)へ
 * 寝かせて返す(呼び出し側がtiltGroupへ追加する)。不透明度は0・非表示で作り、
 * 選択・解除のフェードは`usePlanetEngine.ts`のtickが進める。
 */
export function createRingHighlightMeshes(
  body: CelestialBody,
  bands: readonly { innerRatio: number; outerRatio: number }[],
  color: string,
): THREE.Mesh[] {
  return bands.map((band) => {
    const innerRadius = body.radius * band.innerRatio
    const outerRadius = body.radius * band.outerRatio
    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 192, 1)
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2
    mesh.renderOrder = 3
    mesh.visible = false
    return mesh
  })
}
