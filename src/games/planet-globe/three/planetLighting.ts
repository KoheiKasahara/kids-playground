import * as THREE from 'three'
import type { LightingSpec } from '../types'

/**
 * 主光・補助光の向き(天体中心から見た方向、正規化前)。
 *
 * 真正面(0,0,1)に近いほど陰影が消えて平面的に見え、月のクレーターのバンプも
 * ほとんど起伏として読めなくなる。逆に真横に寄せすぎると暗部が広がりすぎて
 * 幼児には見づらい。左斜め前からのやや浅い角度にして、
 * 「はっきりした明暗の境目」と「表面の8割弱が見える明るさ」を両立させる。
 * 土星ではこの角度が、本体の影を輪の横側(カメラから見える位置)へ落とす役目も持つ。
 */
export const KEY_LIGHT_DIRECTION = { x: -0.72, y: 0.34, z: 0.56 } as const
export const FILL_LIGHT_DIRECTION = { x: 0.74, y: -0.16, z: -0.58 } as const
/** ライトの位置(天体中心からの距離)。影カメラのnear/farをこの値を基準に決める。 */
export const KEY_LIGHT_DISTANCE = 400

/** 天体データが `lighting` を省略できないようにするため、既定値そのものは公開しない(全天体が明示指定する)。 */
export const DEFAULT_LIGHTING: LightingSpec = {
  keyIntensity: 2.4,
  ambientIntensity: 0.16,
  hemisphereIntensity: 0.3,
  fillIntensity: 0.22,
}

export type PlanetLights = {
  ambient: THREE.AmbientLight
  hemisphere: THREE.HemisphereLight
  key: THREE.DirectionalLight
  fill: THREE.DirectionalLight
  all: THREE.Light[]
}

/**
 * ライトはエンジン初期化時に1回だけ作る。天体を切り替えるたびに破棄・再生成すると
 * シャドウマップの再確保コストがかかる上、切り替え中に一瞬光量が変わってちらつくため、
 * 天体ごとの違いは `applyLighting` で強度だけを差し替える。
 */
export function createPlanetLights(): PlanetLights {
  const ambient = new THREE.AmbientLight(0xffffff)
  const hemisphere = new THREE.HemisphereLight(0x9fb6ff, 0x1b1f38)
  const key = new THREE.DirectionalLight(0xfff6e8)
  // 補助光は青が強すぎると、月や土星の暗部が青い汚れのように見える。淡い青灰色に留める。
  const fill = new THREE.DirectionalLight(0x9fb0d8)

  key.position
    .set(KEY_LIGHT_DIRECTION.x, KEY_LIGHT_DIRECTION.y, KEY_LIGHT_DIRECTION.z)
    .normalize()
    .multiplyScalar(KEY_LIGHT_DISTANCE)
  fill.position
    .set(FILL_LIGHT_DIRECTION.x, FILL_LIGHT_DIRECTION.y, FILL_LIGHT_DIRECTION.z)
    .normalize()
    .multiplyScalar(KEY_LIGHT_DISTANCE)

  return { ambient, hemisphere, key, fill, all: [ambient, hemisphere, key, fill] }
}

/** 天体データの `lighting` を各ライトの強度へ反映する。ライト自体は作り直さない。 */
export function applyLighting(lights: PlanetLights, spec: LightingSpec): void {
  lights.ambient.intensity = spec.ambientIntensity
  lights.hemisphere.intensity = spec.hemisphereIntensity
  lights.key.intensity = spec.keyIntensity
  lights.fill.intensity = spec.fillIntensity
}

/**
 * 主光の影を有効/無効にする。土星本体の影が輪に落ちることが立体感の決め手になるため、
 * `body.ring` を持つ天体でだけ有効化する(`usePlanetEngine.ts`側の判断)。
 * 輪自体は半透明マスクを影として正しく扱えず不自然になるため影を落とさせない
 * (`ringMesh.castShadow = false` は呼び出し側で設定する)。
 */
export function configureKeyLightShadow(
  key: THREE.DirectionalLight,
  viewRadius: number,
  enabled: boolean,
): void {
  key.castShadow = enabled
  if (!enabled) return

  key.shadow.mapSize.set(1024, 1024)

  const camera = key.shadow.camera
  camera.left = -viewRadius * 1.25
  camera.right = viewRadius * 1.25
  camera.top = viewRadius * 1.25
  camera.bottom = -viewRadius * 1.25
  camera.near = KEY_LIGHT_DISTANCE - viewRadius * 2
  camera.far = KEY_LIGHT_DISTANCE + viewRadius * 2
  camera.updateProjectionMatrix()

  key.shadow.bias = -0.0006
  key.shadow.normalBias = viewRadius * 0.01
}
