import { BALL_RADIUS } from './mazePhysics'
import { type MazePoint } from './mazeGrid'

export type MazeStar = { id: string; center: MazePoint }

/** ボール中心がこの水平距離まで近づいたら取得。球半径+星の見た目半径ぶん。 */
export const STAR_PICKUP_RADIUS = BALL_RADIUS * 1.4

export type StarTracker = { collected: ReadonlySet<string> }

export function createStarTracker(): StarTracker {
  return { collected: new Set<string>() }
}

/**
 * 取得済みは二度と返さない。新規取得が無ければ「同じtrackerオブジェクトそのもの」を返し、
 * 呼び出し側が参照比較だけで再描画の要否を判断できるようにする。
 */
export function updateStarTracker(
  tracker: StarTracker,
  position: { x: number; z: number },
  stars: readonly MazeStar[],
  radius = STAR_PICKUP_RADIUS,
): { tracker: StarTracker; collectedIds: string[] } {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) {
    return { tracker, collectedIds: [] }
  }

  const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : STAR_PICKUP_RADIUS
  const radiusSquared = safeRadius ** 2
  // 毎フレーム呼ばれるので、実際に取れた星が無い限りSetも配列も新しく作らない。
  let newlyCollected: string[] | null = null

  for (const star of stars) {
    if (tracker.collected.has(star.id)) continue
    if (newlyCollected !== null && newlyCollected.includes(star.id)) continue
    const distanceX = position.x - star.center.x
    const distanceZ = position.z - star.center.z
    if (
      !Number.isFinite(distanceX) ||
      !Number.isFinite(distanceZ) ||
      distanceX ** 2 + distanceZ ** 2 > radiusSquared
    ) {
      continue
    }
    if (newlyCollected === null) newlyCollected = []
    newlyCollected.push(star.id)
  }

  if (newlyCollected === null) return { tracker, collectedIds: [] }
  const collected = new Set(tracker.collected)
  for (const id of newlyCollected) collected.add(id)
  return { tracker: { collected }, collectedIds: newlyCollected }
}

export function collectedStarCount(tracker: StarTracker): number {
  return tracker.collected.size
}

export function isStarCollected(tracker: StarTracker, id: string): boolean {
  return tracker.collected.has(id)
}
