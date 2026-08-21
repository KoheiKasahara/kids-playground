import * as THREE from 'three'
import type { FlagBallData } from './flagBalls'

/** flag-icons の配布物はすべて 4:3 の viewBox を持つため、パネルも同じ比率にする。 */
export const FLAG_PANEL_FLAG_ASPECT_RATIO = 4 / 3

/** 球半径 R を基準に寸法を決め、国旗の比率を保ったまま十分な大きさで見せる。 */
export const FLAG_PANEL_WIDTH_IN_RADII = 1.24
export const FLAG_PANEL_HEIGHT_IN_RADII =
  FLAG_PANEL_WIDTH_IN_RADII / FLAG_PANEL_FLAG_ASPECT_RATIO

/** 白地の国旗が球本体へ溶け込まないよう、外周へ一定幅の濃色パッチを敷く。 */
export const FLAG_PANEL_BORDER_IN_RADII = 0.06
export const FLAG_PANEL_BORDER_COLOR = 0x2b3440
export const FLAG_PANEL_BALL_COLOR = 0xecf0f3

/** 球面パッチはこの半径へ置く。球本体との深度競合を避けるため、どちらも R より外側にする。 */
export const FLAG_PANEL_BORDER_RADIUS_IN_RADII = 1.004
export const FLAG_PANEL_FLAG_RADIUS_IN_RADII = 1.012

/** 12×9 程度の格子で、平面ではなく球面に沿ったパッチの曲率を表現する。 */
export const FLAG_PANEL_SEGMENTS_X = 12
export const FLAG_PANEL_SEGMENTS_Y = 9

const FLAG_PANEL_SPHERE_SEGMENTS_X = 28
const FLAG_PANEL_SPHERE_SEGMENTS_Y = 20
const FLAG_PANEL_TEXTURE_REPEAT = 1
const FLAG_PANEL_TEXTURE_OFFSET = 0

/** パネルの正面を +Z、上を +Y とする。レイアウトはこの正面を水平に回して作る。 */
export type FlagPanelDirection = readonly [number, number, number]

export const FLAG_PANEL_LAYOUTS = {
  two: [
    [0, 0, 1],
    [0, 0, -1],
  ],
  four: [
    [0, 0, 1],
    [0, 0, -1],
    [1, 0, 0],
    [-1, 0, 0],
  ],
} as const satisfies Record<string, readonly FlagPanelDirection[]>

export type FlagPanelLayoutName = keyof typeof FLAG_PANEL_LAYOUTS

/** 見下ろしカメラから読める時間を優先し、4方向を初期配置にする。 */
export const DEFAULT_FLAG_PANEL_LAYOUT: FlagPanelLayoutName = 'four'

export type FlagPanelTextureConfig = {
  readonly url: string
  readonly repeatX: number
  readonly repeatY: number
  readonly offsetX: number
  readonly offsetY: number
  readonly wrapS: THREE.Wrapping
  readonly wrapT: THREE.Wrapping
  readonly minFilter: THREE.MinificationTextureFilter
  readonly magFilter: THREE.MagnificationTextureFilter
  readonly generateMipmaps: boolean
  readonly colorSpace: THREE.ColorSpace
  readonly anisotropy: number
}

/** 端末の GPU 負荷を抑えつつ、斜めから見たパネルの文字や細部を読みやすくする。 */
export const FLAG_PANEL_DEFAULT_ANISOTROPY = 2
export const FLAG_PANEL_MAX_ANISOTROPY = 4

export type FlagPanelTextureOptions = {
  /** Vite の base URL をテストや別の配信先から差し替えられるようにする。 */
  readonly baseUrl?: string
  /** renderer の最大値が小さい端末では、その値まで異方性を下げる。 */
  readonly anisotropy?: number
  readonly maxAnisotropy?: number
}

/** TextureLoader と同じ最小形にし、テストではネットワークを使わず差し替える。 */
export type FlagPanelTextureLoader = {
  load: (url: string) => THREE.Texture
}

export type FlagPanelBallResource = {
  readonly group: THREE.Group
  readonly texture: THREE.Texture
  readonly geometries: readonly THREE.BufferGeometry[]
  readonly materials: readonly THREE.Material[]
}

function normalizedBaseUrl(baseUrl: string): string {
  if (baseUrl.length === 0) return '/'
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

/** FlagBallData の既存パスを Vite の base 配下の URL へ解決する。 */
export function getFlagPanelTextureUrl(
  flag: Pick<FlagBallData, 'flag'>,
  baseUrl = import.meta.env.BASE_URL,
): string {
  return `${normalizedBaseUrl(baseUrl)}${flag.flag.replace(/^\/+/, '')}`
}

function boundedAnisotropy(
  requested: number | undefined,
  rendererMaximum: number | undefined,
): number {
  const requestedValue =
    requested !== undefined && Number.isFinite(requested)
      ? requested
      : FLAG_PANEL_DEFAULT_ANISOTROPY
  const maximumValue =
    rendererMaximum !== undefined && Number.isFinite(rendererMaximum)
      ? rendererMaximum
      : FLAG_PANEL_MAX_ANISOTROPY
  return Math.max(1, Math.min(requestedValue, maximumValue, FLAG_PANEL_MAX_ANISOTROPY))
}

/** パネルは国旗 SVG を1枚まるごと使うため、UV の繰り返しとオフセットを常に無効にする。 */
export function getFlagPanelTextureConfig(
  flag: Pick<FlagBallData, 'flag'>,
  options: FlagPanelTextureOptions = {},
): FlagPanelTextureConfig {
  return {
    url: getFlagPanelTextureUrl(flag, options.baseUrl),
    repeatX: FLAG_PANEL_TEXTURE_REPEAT,
    repeatY: FLAG_PANEL_TEXTURE_REPEAT,
    offsetX: FLAG_PANEL_TEXTURE_OFFSET,
    offsetY: FLAG_PANEL_TEXTURE_OFFSET,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    // 640×480 の SVG を斜めから見るため、mipmap と線形フィルタを組み合わせる。
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
    colorSpace: THREE.SRGBColorSpace,
    anisotropy: boundedAnisotropy(options.anisotropy, options.maxAnisotropy),
  }
}

/** 設定値を同じ Texture へ適用し、engine の tracking 対象を増やさない。 */
export function configureFlagPanelTexture(
  texture: THREE.Texture,
  config: FlagPanelTextureConfig,
): THREE.Texture {
  texture.wrapS = config.wrapS
  texture.wrapT = config.wrapT
  texture.repeat.set(config.repeatX, config.repeatY)
  texture.offset.set(config.offsetX, config.offsetY)
  texture.minFilter = config.minFilter
  texture.magFilter = config.magFilter
  texture.generateMipmaps = config.generateMipmaps
  texture.colorSpace = config.colorSpace
  texture.anisotropy = config.anisotropy
  texture.needsUpdate = true
  return texture
}

/** TextureLoader へ渡す前に設定を完成させ、同期的な読み込み失敗は呼び出し側へ伝える。 */
export function createFlagPanelTexture(
  flag: Pick<FlagBallData, 'flag'>,
  options: FlagPanelTextureOptions & { readonly loader?: FlagPanelTextureLoader } = {},
): THREE.Texture {
  const textureLoader = options.loader ?? new THREE.TextureLoader()
  const texture = textureLoader.load(getFlagPanelTextureUrl(flag, options.baseUrl))
  return configureFlagPanelTexture(texture, getFlagPanelTextureConfig(flag, options))
}

export function createFlagPanelFlagMaterial(
  texture: THREE.Texture,
): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color: 0xffffff,
    map: texture,
  })
}

export function createFlagPanelBorderMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: FLAG_PANEL_BORDER_COLOR })
}

export function createFlagPanelBallMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: FLAG_PANEL_BALL_COLOR })
}

/**
 * パネル平面の座標を、pitch → yaw の2回転で球面上へ写像する。
 * 中心の縦横線では u/Rs と v/Rs がそのまま中心角になるため、国旗の比率を崩しにくい。
 */
export function createFlagPanelGeometry(
  radius: number,
  width: number,
  height: number,
  segmentsX = FLAG_PANEL_SEGMENTS_X,
  segmentsY = FLAG_PANEL_SEGMENTS_Y,
): THREE.BufferGeometry {
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new RangeError('flag-panel: radius must be positive')
  }
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new RangeError('flag-panel: width and height must be positive')
  }

  const horizontalSegments = Math.max(1, Math.floor(segmentsX))
  const verticalSegments = Math.max(1, Math.floor(segmentsY))
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const direction = new THREE.Vector3()
  // 頂点ごとに軸ベクトルを作らず、格子全体で使い回す。
  const pitchAxis = new THREE.Vector3(1, 0, 0)
  const yawAxis = new THREE.Vector3(0, 1, 0)

  for (let yIndex = 0; yIndex <= verticalSegments; yIndex += 1) {
    const v = -height / 2 + (height * yIndex) / verticalSegments
    const pitch = v / radius

    for (let xIndex = 0; xIndex <= horizontalSegments; xIndex += 1) {
      const u = -width / 2 + (width * xIndex) / horizontalSegments
      const yaw = u / radius

      // +Z の正面を pitch（上下）してから yaw（左右）し、法線も球中心からの方向に揃える。
      direction
        .set(0, 0, 1)
        .applyAxisAngle(pitchAxis, -pitch)
        .applyAxisAngle(yawAxis, yaw)
        .normalize()

      positions.push(direction.x * radius, direction.y * radius, direction.z * radius)
      normals.push(direction.x, direction.y, direction.z)
      uvs.push(xIndex / horizontalSegments, yIndex / verticalSegments)
    }
  }

  for (let yIndex = 0; yIndex < verticalSegments; yIndex += 1) {
    for (let xIndex = 0; xIndex < horizontalSegments; xIndex += 1) {
      const row = horizontalSegments + 1
      const lowerLeft = yIndex * row + xIndex
      const lowerRight = lowerLeft + 1
      const upperLeft = lowerLeft + row
      const upperRight = upperLeft + 1
      indices.push(lowerLeft, lowerRight, upperRight, lowerLeft, upperRight, upperLeft)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

function panelQuaternion(direction: FlagPanelDirection): THREE.Quaternion {
  const normal = new THREE.Vector3(direction[0], direction[1], direction[2]).normalize()
  return new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    normal,
  )
}

function createPanelMeshes(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  directions: readonly FlagPanelDirection[],
  name: string,
): void {
  for (const [index, direction] of directions.entries()) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = `${name}-${index}`
    mesh.quaternion.copy(panelQuaternion(direction))
    group.add(mesh)
  }
}

export type FlagPanelBallOptions = FlagPanelTextureOptions & {
  readonly loader?: FlagPanelTextureLoader
  readonly ballRadius?: number
  readonly layout?: FlagPanelLayoutName
}

/** 球本体と複数の曲面パネルを一つの resource として生成し、engine からまとめて解放できるようにする。 */
export function createFlagPanelBallResource(
  flag: Pick<FlagBallData, 'flag'>,
  options: FlagPanelBallOptions = {},
): FlagPanelBallResource {
  const ballRadius = options.ballRadius ?? 1
  if (!Number.isFinite(ballRadius) || ballRadius <= 0) {
    throw new RangeError('flag-panel: ballRadius must be positive')
  }

  const texture = createFlagPanelTexture(flag, options)
  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []

  try {
    const flagWidth = ballRadius * FLAG_PANEL_WIDTH_IN_RADII
    const flagHeight = ballRadius * FLAG_PANEL_HEIGHT_IN_RADII
    const borderWidth = flagWidth + ballRadius * FLAG_PANEL_BORDER_IN_RADII * 2
    const borderHeight = flagHeight + ballRadius * FLAG_PANEL_BORDER_IN_RADII * 2
    const borderGeometry = createFlagPanelGeometry(
      ballRadius * FLAG_PANEL_BORDER_RADIUS_IN_RADII,
      borderWidth,
      borderHeight,
    )
    const flagGeometry = createFlagPanelGeometry(
      ballRadius * FLAG_PANEL_FLAG_RADIUS_IN_RADII,
      flagWidth,
      flagHeight,
    )
    const sphereGeometry = new THREE.SphereGeometry(
      ballRadius,
      FLAG_PANEL_SPHERE_SEGMENTS_X,
      FLAG_PANEL_SPHERE_SEGMENTS_Y,
    )
    geometries.push(sphereGeometry, borderGeometry, flagGeometry)

    const sphereMaterial = createFlagPanelBallMaterial()
    const borderMaterial = createFlagPanelBorderMaterial()
    const flagMaterial = createFlagPanelFlagMaterial(texture)
    materials.push(sphereMaterial, borderMaterial, flagMaterial)

    const group = new THREE.Group()
    group.name = 'flag-panel-ball'
    group.add(new THREE.Mesh(sphereGeometry, sphereMaterial))

    const layoutName = options.layout ?? DEFAULT_FLAG_PANEL_LAYOUT
    const directions = FLAG_PANEL_LAYOUTS[layoutName]
    createPanelMeshes(group, borderGeometry, borderMaterial, directions, 'flag-panel-border')
    createPanelMeshes(group, flagGeometry, flagMaterial, directions, 'flag-panel-flag')

    return { group, texture, geometries, materials }
  } catch (error) {
    // TextureLoader 後にジオメトリ生成が失敗しても、resource を返せないテクスチャを残さない。
    for (const geometry of geometries) geometry.dispose()
    for (const material of materials) material.dispose()
    texture.dispose()
    throw error
  }
}

/** MeshLambertMaterial.dispose() では map が解放されないため、全 resource を明示的に破棄する。 */
export function disposeFlagPanelBallResource(resource: FlagPanelBallResource): void {
  for (const material of resource.materials) material.dispose()
  for (const geometry of resource.geometries) geometry.dispose()
  resource.texture.dispose()
}
