import * as THREE from 'three'
import type { FlagBallData } from './flagBalls'

/** 国旗SVGの配布物（flag-icons）はすべて4:3のviewBoxを持つ。 */
export const FLAG_SPHERE_FLAG_ASPECT_RATIO = 4 / 3

/**
 * SphereGeometryのUVは、赤道でU方向が球の一周(2πr)、V方向が極から極(πr)に
 * 対応する。4:3の画像をそのまま一周に伸ばすと横に広がりすぎるため、
 * 2 / (4 / 3) = 1.5枚ぶんを横へ繰り返し、赤道付近で旗の比率を保つ。
 */
export const FLAG_SPHERE_HORIZONTAL_REPEAT =
  2 / FLAG_SPHERE_FLAG_ASPECT_RATIO

/** SphereGeometry (phiStart=0) の正面(+Z)に対応するU座標。 */
export const FLAG_SPHERE_FRONT_U = 0.25

/**
 * CSSのobject-positionと同じ意味で、0=左寄せ / 0.5=中央 / 1=右寄せとする。
 * undefinedの国旗は中央扱いにする。
 */
export const FLAG_SPHERE_DEFAULT_POSITION_X = 0.5

/** 4:3画像を正方形へcoverしたときに見える画像中心の範囲(3/8〜5/8)。 */
const FLAG_SPHERE_VISIBLE_CENTER_MIN = 3 / 8
const FLAG_SPHERE_VISIBLE_CENTER_RANGE = 1 / 4

/**
 * 1枚の旗を球の赤道へ貼るための設定。
 *
 * TextureLoaderは非同期に画像を埋めるので、この設定は画像ロード前にも適用できる
 * ように純粋な値として分離している。テストや別のローダーからも再利用できる。
 */
export type FlagSphereTextureConfig = {
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

/**
 * 異方性フィルタは斜めから見た赤道の細かい模様を読みやすくする一方、モバイルGPU
 * では高い値が負荷になる。既定値は2、上限も4に留める。
 */
export const FLAG_SPHERE_DEFAULT_ANISOTROPY = 2
export const FLAG_SPHERE_MAX_ANISOTROPY = 4

export type FlagSphereTextureOptions = {
  /** Viteのbase（既定は import.meta.env.BASE_URL）。テストや別配信先で上書きできる。 */
  readonly baseUrl?: string
  /** 既定2。rendererの最大値を下回るよう maxAnisotropy も適用する。 */
  readonly anisotropy?: number
  readonly maxAnisotropy?: number
}

/** TextureLoaderと同じ最小の形。テストではネットワークを使わず差し替えられる。 */
export type FlagSphereTextureLoader = {
  load: (url: string) => THREE.Texture
}

export type FlagSphereResource = {
  readonly texture: THREE.Texture
  readonly material: THREE.MeshLambertMaterial
}

function normalizedBaseUrl(baseUrl: string): string {
  if (baseUrl.length === 0) return '/'
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
}

/** FlagBallDataが持つ既存の相対パスを、PWAのbase配下のURLへ解決する。 */
export function getFlagSphereTextureUrl(
  flag: Pick<FlagBallData, 'flag'>,
  baseUrl = import.meta.env.BASE_URL,
): string {
  return `${normalizedBaseUrl(baseUrl)}${flag.flag.replace(/^\/+/, '')}`
}

function normalizedPositionX(positionX: number | undefined): number {
  if (positionX === undefined || !Number.isFinite(positionX)) {
    return FLAG_SPHERE_DEFAULT_POSITION_X
  }
  return Math.min(1, Math.max(0, positionX))
}

/**
 * 正面に見せる旗の画像中心からU offsetを求める。
 *
 * 正面U=1/4では、repeat=1.5のとき画像中心が offset=1/8になる。これにより、
 * 日本・韓国・バングラデシュの中央意匠や、ブラジルの中央のひし形を球の正面へ
 * 置きやすい。ballPositionX=0の旗は画像中心を3/8へ寄せ、左側の意匠を残す。
 */
export function getFlagSphereTextureOffsetX(
  flag: Pick<FlagBallData, 'ballPositionX'>,
): number {
  const positionX = normalizedPositionX(flag.ballPositionX)
  const desiredImageCenter =
    FLAG_SPHERE_VISIBLE_CENTER_MIN +
    positionX * FLAG_SPHERE_VISIBLE_CENTER_RANGE
  return desiredImageCenter - FLAG_SPHERE_HORIZONTAL_REPEAT * FLAG_SPHERE_FRONT_U
}

function boundedAnisotropy(
  requested: number | undefined,
  rendererMaximum: number | undefined,
): number {
  const requestedValue =
    requested !== undefined && Number.isFinite(requested)
      ? requested
      : FLAG_SPHERE_DEFAULT_ANISOTROPY
  const maximumValue =
    rendererMaximum !== undefined && Number.isFinite(rendererMaximum)
      ? rendererMaximum
      : FLAG_SPHERE_MAX_ANISOTROPY
  return Math.max(1, Math.min(requestedValue, maximumValue, FLAG_SPHERE_MAX_ANISOTROPY))
}

/** TextureLoaderへ渡す前に検証できる、国旗球のテクスチャ設定。 */
export function getFlagSphereTextureConfig(
  flag: Pick<FlagBallData, 'flag' | 'ballPositionX'>,
  options: FlagSphereTextureOptions = {},
): FlagSphereTextureConfig {
  return {
    url: getFlagSphereTextureUrl(flag, options.baseUrl),
    repeatX: FLAG_SPHERE_HORIZONTAL_REPEAT,
    repeatY: 1,
    offsetX: getFlagSphereTextureOffsetX(flag),
    offsetY: 0,
    // 横は球を一周して継ぎ目をつなぎ、縦は極で旗を折り返さない。
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    // 640x480のSVGを球へ貼る。mipmap + 軽い異方性で、斜めの赤道でも読めるようにする。
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
    colorSpace: THREE.SRGBColorSpace,
    anisotropy: boundedAnisotropy(options.anisotropy, options.maxAnisotropy),
  }
}

/** 設定値をTextureへ反映する。戻り値はengineのtrackへ渡しやすいよう同じTexture。 */
export function configureFlagSphereTexture(
  texture: THREE.Texture,
  config: FlagSphereTextureConfig,
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

/**
 * 既存のpublic/flags/*.svgから国旗球用Textureを作る。
 * Textureはmaterial.dispose()では解放されないため、engineは戻り値を明示的にtrackする。
 */
export function createFlagSphereTexture(
  flag: Pick<FlagBallData, 'flag' | 'ballPositionX'>,
  options: FlagSphereTextureOptions & { readonly loader?: FlagSphereTextureLoader } = {},
): THREE.Texture {
  const textureLoader = options.loader ?? new THREE.TextureLoader()
  const texture = textureLoader.load(getFlagSphereTextureUrl(flag, options.baseUrl))
  return configureFlagSphereTexture(texture, getFlagSphereTextureConfig(flag, options))
}

/** LambertはMazeの既存照明に対応し、Standardよりモバイル向けに軽い。 */
export function createFlagSphereMaterial(
  texture: THREE.Texture,
): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color: 0xffffff,
    map: texture,
  })
}

/** Textureとmaterialを同じ寿命で扱いたいengine向けの小さなファクトリ。 */
export function createFlagSphereResource(
  flag: Pick<FlagBallData, 'flag' | 'ballPositionX'>,
  options: FlagSphereTextureOptions & { readonly loader?: FlagSphereTextureLoader } = {},
): FlagSphereResource {
  const texture = createFlagSphereTexture(flag, options)
  return {
    texture,
    material: createFlagSphereMaterial(texture),
  }
}

/** MeshLambertMaterial.dispose()はmapを解放しないため、両方を明示的に破棄する。 */
export function disposeFlagSphereResource(resource: FlagSphereResource): void {
  resource.material.dispose()
  resource.texture.dispose()
}
