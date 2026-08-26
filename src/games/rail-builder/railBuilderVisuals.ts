/** Rail Builder の描画品質と短い演出で共有する副作用のない値。 */

/** 線路・施設で共通に使う小さな玩具スケールの visual palette。 */
export const RAIL_VISUAL_CONFIG = {
  gauge: 0.46,
  baseHeight: 0.14,
  sleeperHeight: 0.16,
  railHeight: 0.16,
  roughness: 0.78,
  metalness: 0.18,
  palette: {
    rail: '#6b7280',
    base: '#eab308',
    sleeper: '#b45309',
    connector: '#fb923c',
  },
} as const

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
