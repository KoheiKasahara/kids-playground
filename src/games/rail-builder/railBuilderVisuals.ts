import type { RailPieceKind } from './railModel'

/** Rail Builder の描画品質と短い演出で共有する副作用のない値。 */

/** 線路・施設で共通に使う小さな玩具スケールの visual palette。 */
/**
 * Raycast専用の透明hit areaの横幅倍率。描画geometryには適用しない。
 * 細く見えるパーツだけを広げ、施設の大きな外形は従来幅に留める。
 */
export const RAIL_HIT_AREA_WIDTH_SCALE_BY_KIND: Readonly<Record<RailPieceKind, number>> = {
  straight: 2.4,
  'short-straight': 2.2,
  curve: 2.4,
  branch: 2.4,
  slope: 2.2,
  bridge: 2.0,
  station: 1.8,
  tunnel: 1.8,
  depot: 1.8,
}

export function getRailHitAreaWidthScale(kind: RailPieceKind): number {
  return RAIL_HIT_AREA_WIDTH_SCALE_BY_KIND[kind]
}

export const RAIL_VISUAL_CONFIG = {
  gauge: 0.46,
  /** Shared path-relative Y layers. Path centerlines remain owned by railModel. */
  baseCenterY: 0.1,
  sleeperCenterY: 0.2,
  railCenterY: 0.34,
  baseLength: 1.04,
  baseWidth: 0.94,
  baseHeight: 0.16,
  sleeperLength: 0.66,
  sleeperWidth: 1.08,
  sleeperHeight: 0.18,
  sleeperSpacing: 1,
  railLength: 1,
  railWidth: 0.16,
  railHeight: 0.18,
  roughness: 0.72,
  metalness: 0.24,
  railRoughness: 0.58,
  railMetalness: 0.28,
  palette: {
    rail: '#778496',
    base: '#eab308',
    sleeper: '#b45309',
    connector: '#fb923c',
  },
} as const

/**
 * Station-only dressing metrics. These are intentionally separate from the
 * canonical STATION_LENGTH and rail connector data in railModel so visual
 * iteration cannot silently change placement or train routing.
 */
export const RAIL_STATION_VISUAL_CONFIG = {
  platform: {
    lengthRatio: 0.98,
    depth: 1.16,
    height: 0.34,
    centerY: 0.2,
    centerOffsetZ: 1.12,
  },
  safetyLine: {
    lengthRatio: 0.94,
    depth: 0.08,
    height: 0.07,
  },
  roof: {
    lengthRatio: 0.96,
    depth: 3.4,
    height: 0.26,
    centerY: 2.5,
  },
  column: {
    height: 2.48,
    centerY: 1.24,
    centerOffsetZ: 1.18,
    endInset: 0.8,
  },
} as const

/** Track-facing safety-line center, measured in station-local Z. */
export function getRailStationSafetyLineCenterOffset(): number {
  const { depth, centerOffsetZ } = RAIL_STATION_VISUAL_CONFIG.platform
  return centerOffsetZ - depth / 2 + RAIL_STATION_VISUAL_CONFIG.safetyLine.depth / 2
}

/** Keep sleeper cadence independent from the path's rendering tessellation. */
export function getRailSleeperCount(pathLength: number): number {
  const safeLength = Number.isFinite(pathLength) ? Math.max(0, pathLength) : 0
  const spacing = Math.max(0.25, RAIL_VISUAL_CONFIG.sleeperSpacing)
  return Math.max(1, Math.ceil(safeLength / spacing))
}

/**
 * 端末の短辺に合わせた DPR 上限。
 * 高密度ディスプレイでも、Three.js のフレームバッファが過大にならないようにする。
 */
export function getRailBuilderDevicePixelRatio(
  devicePixelRatio: number,
  width: number,
  height: number,
): number {
  const safeDpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  const shortSide = Math.min(Math.max(1, width), Math.max(1, height))
  return Math.min(safeDpr, shortSide <= 640 ? 1.5 : 1.75)
}

/** シャドウマップの一辺。小画面では fill-rate を抑える。 */
export function getRailBuilderShadowMapSize(width: number, height: number): 512 | 1024 {
  const shortSide = Math.min(Math.max(1, width), Math.max(1, height))
  return shortSide <= 640 ? 512 : 1024
}

export const getRailBuilderDpr = getRailBuilderDevicePixelRatio
export const getRailBuilderShadowResolution = getRailBuilderShadowMapSize

/** reduced-motion 時に、走行そのもの以外の短い演出を無効化するか。 */
export function shouldReduceRailBuilderMotion(
  prefersReducedMotion: boolean | undefined,
): boolean {
  return prefersReducedMotion === true
}
