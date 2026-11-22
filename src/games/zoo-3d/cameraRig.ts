// カメラの決め方（純粋な計算）。描画側は OrbitControls と組み合わせて使う。
// - 俯瞰: 斜め上から園全体を眺める。縦長の画面では視野角を広げ、近づきすぎない範囲で収める。
// - 追従: 選んだ動物を中心に、向きはそのまま距離と高さだけ動物に合わせる。
// - めり込み防止: 仰角の下限・上限で地面より下へ回り込ませず、木の葉の中に入ったら外へ押し出す。

export const CAMERA_LIMITS = {
  minPolar: 0.42,
  maxPolar: 1.18,
  minDistance: 4.5,
  maxDistance: 70,
  minHeight: 1.2,
}

/** 縦長ほど縦の視野角を広げ、横方向に見える範囲を確保する。 */
export function fovFor(aspect: number): number {
  if (aspect >= 1.2) return 42
  if (aspect <= 0.5) return 58
  return 58 - ((aspect - 0.5) / 0.7) * 16
}

/** 半径 radius の範囲が横方向に収まる距離（近すぎ・遠すぎは制限）。 */
export function overviewDistance(aspect: number, radius: number): number {
  const vfov = (fovFor(aspect) * Math.PI) / 180
  const half = Math.atan(Math.tan(vfov / 2) * aspect)
  const fit = radius / Math.sin(half)
  return Math.max(18, Math.min(56, fit))
}

export type Pose = { target: [number, number, number]; distance: number; polar: number; azimuth: number }

export function overviewPose(aspect: number): Pose {
  // 園の中心と、まわりの輪の手前側が収まる広さ（奥の輪は回して見る）
  return { target: [0, 0.4, 3], distance: overviewDistance(aspect, 22), polar: 0.8, azimuth: 0 }
}

export function cameraPosition(pose: Pose): [number, number, number] {
  const [tx, ty, tz] = pose.target
  const s = Math.sin(pose.polar) * pose.distance
  return [tx + Math.sin(pose.azimuth) * s, ty + Math.cos(pose.polar) * pose.distance, tz + Math.cos(pose.azimuth) * s]
}

/** なめらかに近づける係数（フレームの長さに依存しない指数減衰）。 */
export function follow(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt)
}

/** カメラ位置が球（木の葉）の中なら、球の表面まで押し出した位置を返す。 */
export function pushOutOfSpheres(position: [number, number, number],
  spheres: readonly { center: { x: number; y: number; z: number }; radius: number }[]): [number, number, number] {
  let [x, y, z] = position
  for (const s of spheres) {
    const dx = x - s.center.x
    const dy = y - s.center.y
    const dz = z - s.center.z
    const d = Math.hypot(dx, dy, dz)
    if (d < s.radius && d > 1e-6) {
      const k = s.radius / d
      x = s.center.x + dx * k
      y = s.center.y + dy * k
      z = s.center.z + dz * k
    }
  }
  return [x, Math.max(CAMERA_LIMITS.minHeight, y), z]
}

type SphereLike = { center: { x: number; y: number; z: number }; radius: number }

/** 線分 a→b が球を横切るか。 */
export function segmentHitsSphere(a: [number, number, number], b: [number, number, number], s: SphereLike): boolean {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const len2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2]
  const f = [a[0] - s.center.x, a[1] - s.center.y, a[2] - s.center.z]
  const t = len2 > 0 ? Math.max(0, Math.min(1, -(f[0] * d[0] + f[1] * d[1] + f[2] * d[2]) / len2)) : 0
  const p = [f[0] + d[0] * t, f[1] + d[1] * t, f[2] + d[2] * t]
  return p[0] * p[0] + p[1] * p[1] + p[2] * p[2] < s.radius * s.radius
}

/**
 * 追いかけるときに回り込む方向（方位角）。動物の斜め前を優先し、木や竹が間に入る方向は避ける。
 * どの方向もさえぎられるときは、最初の候補（斜め前）を返す。
 */
export function followAzimuth(target: [number, number, number], heading: number, distance: number, polar: number,
  occluders: readonly SphereLike[]): number {
  const offsets = [0.75, -0.75, 1.4, -1.4, 0.2, 2.2, -2.2, Math.PI]
  for (const o of offsets) {
    const az = heading + o
    const cam = cameraPosition({ target, distance, polar, azimuth: az })
    if (!occluders.some(s => segmentHitsSphere(cam, target, s))) return az
  }
  return heading + offsets[0]
}
