export type KomaScreenTarget = {
  index: number
  x: number
  y: number
}

/**
 * 画面上でタップ位置に最も近いコマを1体だけ返す。
 * Three.jsの細い見た目MeshではなくCSS pxの広い円で拾うため、指で隠れても狙いやすい。
 */
export function findNearestKomaTapTarget(
  tap: { x: number; y: number },
  targets: readonly KomaScreenTarget[],
  hitRadiusPx: number,
): number | null {
  if (
    !Number.isFinite(tap.x) ||
    !Number.isFinite(tap.y) ||
    !Number.isFinite(hitRadiusPx) ||
    hitRadiusPx <= 0
  ) {
    return null
  }

  const radiusSquared = hitRadiusPx * hitRadiusPx
  let closestIndex: number | null = null
  let closestDistanceSquared = Number.POSITIVE_INFINITY
  for (const target of targets) {
    if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) continue
    const distanceSquared = (tap.x - target.x) ** 2 + (tap.y - target.y) ** 2
    if (distanceSquared <= radiusSquared && distanceSquared < closestDistanceSquared) {
      closestIndex = target.index
      closestDistanceSquared = distanceSquared
    }
  }
  return closestIndex
}
