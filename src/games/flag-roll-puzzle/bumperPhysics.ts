import { MAX_SPEED } from './puzzlePhysics'

export const BUMPER_BOOST_SPEED = 6

type Point = { readonly x: number; readonly y: number }

/**
 * バンパーの中心からボールへ向かう外向き成分を足す。
 * 反発係数だけに任せず、板とは違う「ポン」と押し出される感触を作る一方、
 * この場でも最大速度で丸めて連続衝突時の加速を抑える。
 */
export function bumperBoostVelocity(ball: Point, bumper: Point, velocity: Point): Point {
  let dx = ball.x - bumper.x
  let dy = ball.y - bumper.y
  let length = Math.hypot(dx, dy)

  // ちょうど中心で重なった稀なフレームは、今の進行方向を使う。
  if (length === 0) {
    dx = velocity.x
    dy = velocity.y
    length = Math.hypot(dx, dy)
  }
  if (length === 0) {
    dx = 0
    dy = -1
    length = 1
  }

  const x = velocity.x + (dx / length) * BUMPER_BOOST_SPEED
  const y = velocity.y + (dy / length) * BUMPER_BOOST_SPEED
  const speed = Math.hypot(x, y)
  if (speed <= MAX_SPEED) return { x, y }
  const factor = MAX_SPEED / speed
  return { x: x * factor, y: y * factor }
}
