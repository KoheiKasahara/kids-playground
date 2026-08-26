/**
 * 特徴スポットの「タップ判定」に関わる純粋関数だけを集める。three(Vector3等)には依存させず、
 * `usePlanetEngine.ts` からプレーンな数値・オブジェクトを渡して使う(unit testしやすくするため)。
 *
 * 可視判定はすべて「楕円体を単位球にした正規化空間」(§1参照)で行う。単位球に対する
 * 遮蔽計算は式が単純で済み、扁平した天体でも正しい結果になる(アフィン変換は直線・交差関係を保つため)。
 */

export type Vec3 = { x: number; y: number; z: number }

/** タップとみなす最大移動量(CSSピクセル)。earth-globeの8pxより少し緩め(幼児は指がぶれる)。 */
export const POINTER_TAP_MOVE_PX = 10

/** 球面スポットを「縁ぎりぎり」で拾わないための余裕。 */
export const SURFACE_VISIBILITY_MARGIN = 0.06

/** 輪スポットが天体本体に隠れているかを判定するときの余裕。 */
const RING_VISIBILITY_MARGIN = 0.03

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function lengthSq(v: Vec3): number {
  return dot(v, v)
}

/** pointerdownからの移動量が、タップとみなせる範囲を超えたか。 */
export function exceedsTapMovement(dx: number, dy: number, thresholdPx: number = POINTER_TAP_MOVE_PX): boolean {
  return Math.hypot(dx, dy) > thresholdPx
}

/**
 * 正規化空間(楕円体を単位球にした空間)で、球面上の点がカメラから見えるか。
 * カメラ位置c、単位球上の点pのとき、pが見える条件は dot(p, c) > 1（厳密解:
 * 点pでの外向き法線＝p自身と、pからカメラへ向かうベクトルのなす角が90度未満）。
 * marginを足して、輪郭ぎりぎりの押しにくい点は拾わないようにする。
 */
export function isSurfacePointVisible(camera: Vec3, point: Vec3, margin: number = SURFACE_VISIBILITY_MARGIN): boolean {
  return dot(point, camera) > 1 + margin
}

/**
 * 正規化空間で、単位球の外にある点(輪の上のマーカー)が天体に隠されていないか。
 * カメラと点を結ぶ「線分」(全体を通る直線ではない)が単位球と交わるかどうかで判定する。
 * 線分上で原点(球の中心)にいちばん近づく点までの距離を求め、それが 1+margin 未満なら
 * 球の内部を通過している＝隠れている とみなす。
 */
export function isRingPointVisible(camera: Vec3, point: Vec3, margin: number = RING_VISIBILITY_MARGIN): boolean {
  const segment: Vec3 = { x: point.x - camera.x, y: point.y - camera.y, z: point.z - camera.z }
  const segmentLengthSq = lengthSq(segment)
  // カメラと点がほぼ同じ位置(実運用では起こらない)なら、線分は点そのものとして扱う。
  const t = segmentLengthSq === 0
    ? 0
    : Math.min(1, Math.max(0, -dot(camera, segment) / segmentLengthSq))

  const closest: Vec3 = {
    x: camera.x + segment.x * t,
    y: camera.y + segment.y * t,
    z: camera.z + segment.z * t,
  }
  const distanceToCenter = Math.sqrt(lengthSq(closest))
  return distanceToCenter >= 1 + margin
}

/** NDC(-1..1、Y上向き) → キャンバス左上基準のCSSピクセル座標(Y下向き)。 */
export function ndcToScreen(ndcX: number, ndcY: number, width: number, height: number): { x: number; y: number } {
  return {
    x: ((ndcX + 1) / 2) * width,
    y: ((1 - ndcY) / 2) * height,
  }
}

export type SpotHitCandidate = { id: string; x: number; y: number; hitRadiusPx: number }

/** ポインタ位置からhitRadiusPx以内にある候補のうち、最も近いもののidを返す。無ければnull。 */
export function pickNearestSpot(
  candidates: readonly SpotHitCandidate[],
  pointerX: number,
  pointerY: number,
): string | null {
  let nearestId: string | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    const distance = Math.hypot(candidate.x - pointerX, candidate.y - pointerY)
    if (distance > candidate.hitRadiusPx) continue
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestId = candidate.id
    }
  }

  return nearestId
}
