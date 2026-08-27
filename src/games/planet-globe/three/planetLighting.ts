import * as THREE from 'three'
import type { LightingSpec } from '../types'

/**
 * 主光・補助光の向き(天体中心から見た方向、正規化前)。
 *
 * 学習用の観察画面では、正確な昼夜境界より表面模様の読みやすさを優先する。
 * 主光・補助光ともカメラ側に寄せ、画面中央から外周へ向かってだけ緩やかに暗くなる
 * 方向にする。これにより、大陸や縞を暗部で失わずに球体感を残せる。
 * 土星ではこの角度でも、本体の影を輪の横側へごく弱く落とせる。
 */
export const KEY_LIGHT_DIRECTION = { x: -0.48, y: 0.3, z: 0.82 } as const
export const FILL_LIGHT_DIRECTION = { x: 0.48, y: -0.12, z: 0.72 } as const
/** ライトの位置(天体中心からの距離)。影カメラのnear/farをこの値を基準に決める。 */
export const KEY_LIGHT_DISTANCE = 400

/** 天体データが `lighting` を省略できないようにするため、既定値そのものは公開しない(全天体が明示指定する)。 */
export const DEFAULT_LIGHTING: LightingSpec = {
  keyIntensity: 1,
  ambientIntensity: 0.82,
  hemisphereIntensity: 0.52,
  fillIntensity: 0.46,
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
