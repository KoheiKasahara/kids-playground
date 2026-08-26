/**
 * 経緯度とテクスチャUV・自転角の変換をここへ集約する。
 * `celestialBodies.ts` のクレーター・模様は経度・緯度(度)で定義し、
 * `planetSurface.ts` はそれをテクスチャ座標へ変換して描く。この対応関係が
 * ここ以外の場所で再実装されると、Phase 3で特徴の3D位置を求めるときに
 * 複数の変換式が食い違う恐れがあるため、変換式は必ずここを唯一の正本にする。
 */

/**
 * 経度(度, -180..180) → テクスチャU(0..1)。lon=0 が u=0.5(テクスチャ中央)。
 * 周期的な変換のため、-180と180は同じ点(u=0)を指す。
 */
export function lonToU(lonDeg: number): number {
  const raw = lonDeg / 360 + 0.5
  return raw - Math.floor(raw)
}

/** 緯度(度, +90..-90) → テクスチャV(0..1)。北極 lat=+90 が v=0(Canvasの上端)。 */
export function latToV(latDeg: number): number {
  const v = (90 - latDeg) / 180
  return Math.min(1, Math.max(0, v))
}

/**
 * テクスチャU上の点をカメラ正面(+Z)へ向けるための spinGroup.rotation.y。
 * THREE.SphereGeometry(phiStart=0)ではu=0が-X、u=0.25が+Zを向くため θ = π/2 - 2πu。
 * Phase 3で「特徴の3D位置」を求めるときも、この式が唯一の正本になる。
 */
export function rotationYFacing(u: number): number {
  return Math.PI / 2 - 2 * Math.PI * u
}
