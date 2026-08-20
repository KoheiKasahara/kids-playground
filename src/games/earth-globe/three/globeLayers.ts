import { GLOBE_RADIUS } from './zoomLevels'

/**
 * 地球の上に重なる層の高さを1か所にまとめる。
 * 海（半径100） < 陸のcap < 国境線 < 選択国のcap < 選択国のアウトライン、の順に重なる。
 */

/**
 * 陸ポリゴンの高さ。three-conic-polygon-geometryは陸を押し出した立体として作るため、
 * この高さぶんの側面の壁が海岸線に沿って生まれる。高くすると立体感は出るが、
 * 地球全体表示のように海岸線を斜めから見る場面では、壁が細かいギザつきとして見える。
 * 0.002なら壁の高さは0.2 world unit（縦画面の最小ズームで1px未満）に収まり、
 * 最大ズームでは約4pxとして立体感が残る。
 */
export const BASE_POLYGON_ALTITUDE = 0.002
/** 選択中の国だけは、はっきり浮き上がって見える高さにする。 */
export const SELECTED_POLYGON_ALTITUDE = 0.024

/** 海の球体の曲面分割（度）。粗いほど球が多角形に近づき、内側へ沈み込む。 */
export const GLOBE_CURVATURE_RESOLUTION_DEGREES = 5
/** 陸のcapの曲面分割（度）。 */
export const POLYGON_CAP_CURVATURE_RESOLUTION_DEGREES = 3

/**
 * capの上面から国境線までの隙間。深度バッファの分解能より十分大きく、
 * かつ外周から見たときに線が地表から浮いて見えない値にする。
 */
const BORDER_HEIGHT_ABOVE_CAP = 0.01

function borderRadiusFor(altitude: number): number {
  return GLOBE_RADIUS * (1 + altitude) + BORDER_HEIGHT_ABOVE_CAP
}

export const BASE_BORDER_RADIUS = borderRadiusFor(BASE_POLYGON_ALTITUDE)
export const SELECTED_BORDER_RADIUS = borderRadiusFor(SELECTED_POLYGON_ALTITUDE)
