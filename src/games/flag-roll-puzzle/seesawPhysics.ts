import * as Matter from 'matter-js'

const { Body } = Matter

/** シーソーは、動きが見える一方でボールを勢いよく射出しない範囲に抑える。 */
export const SEESAW_MAX_ANGLE_DEG = 28
export const SEESAW_MAX_ANGLE = (SEESAW_MAX_ANGLE_DEG * Math.PI) / 180
export const SEESAW_MAX_ANGULAR_VELOCITY = 0.12

/** ボールと同じ座標系で、板が軽すぎて跳ね回らないようにした密度。 */
export const SEESAW_DENSITY = 0.0035
export const SEESAW_FRICTION_AIR = 0.12
export const SEESAW_CONSTRAINT_STIFFNESS = 0.92
export const SEESAW_CONSTRAINT_DAMPING = 0.16
export const SEESAW_PIVOT_POSITION_TOLERANCE = 0.75

const FULL_TURN = Math.PI * 2

/** Matter.jsの角度を -π〜πへ戻す。自由回転した値をそのまま比較しないために使う。 */
export function normalizeSeesawAngle(angle: number): number {
  return ((angle + Math.PI) % FULL_TURN + FULL_TURN) % FULL_TURN - Math.PI
}

export function clampSeesawAngle(angle: number): number {
  const normalized = normalizeSeesawAngle(angle)
  return Math.min(SEESAW_MAX_ANGLE, Math.max(-SEESAW_MAX_ANGLE, normalized))
}

/** シーソーの角度・角速度・支点位置を、1物理stepぶんの安全域へ戻す。 */
export function stabilizeSeesawBody(
  body: Matter.Body,
  pivot: { readonly x: number; readonly y: number },
): void {
  const angle = clampSeesawAngle(body.angle)
  if (Math.abs(angle - body.angle) > 0.0001) {
    Body.setAngle(body, angle)
    Body.setAngularVelocity(body, 0)
  } else if (Math.abs(body.angularVelocity) > SEESAW_MAX_ANGULAR_VELOCITY) {
    Body.setAngularVelocity(body, Math.sign(body.angularVelocity) * SEESAW_MAX_ANGULAR_VELOCITY)
  }

  if (
    Math.abs(body.position.x - pivot.x) > SEESAW_PIVOT_POSITION_TOLERANCE
    || Math.abs(body.position.y - pivot.y) > SEESAW_PIVOT_POSITION_TOLERANCE
  ) {
    // Constraintの補正でごく小さくずれた場合だけ戻す。角度・角速度は維持する。
    Body.setPosition(body, pivot)
  }
}
