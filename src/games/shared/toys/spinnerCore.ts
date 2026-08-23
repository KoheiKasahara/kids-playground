import * as Matter from 'matter-js'

const { Body, Bodies } = Matter

export type SpinnerCoreOptions = {
  x: number
  y: number
  /** 羽根の長さの半分 */
  radius: number
  bladeThickness: number
  friction: number
  restitution: number
  label: string
  /** ボールへ許す速度上限(px/step) */
  ballSpeedCap: number
  /** 接触判定に足す余白 */
  influenceMargin: number
  ballRadius: number
  stepMs: number
}

export type SpinnerCore = {
  readonly body: Matter.Body
  readonly influenceRadius: number
  /** 角速度(rad/step)を指定して角度を進める。dtMsはstepMs基準でスケールされる */
  advance(dtMs: number, angularVelocity: number): void
  /** 影響範囲内のボールの速度を上限へ丸める */
  capBallSpeed(ballBody: Matter.Body): void
  /** 影響範囲内で止まりかけたボールへ接線方向の一押しを与える。与えたらtrue */
  nudgeIfStalled(ballBody: Matter.Body, stallSpeed: number, nudgeSpeed: number): boolean
  readonly angle: number
}

function speedOf(body: Matter.Body): number {
  return Math.hypot(body.velocity.x, body.velocity.y)
}

function isWithinInfluence(body: Matter.Body, x: number, y: number, influenceRadius: number): boolean {
  return Math.hypot(body.position.x - x, body.position.y - y) <= influenceRadius
}

/** 回転する十字の静的Bodyを作る。ピンボールと冒険の両方で同じ形状を使う。 */
export function createSpinnerCore(options: SpinnerCoreOptions): SpinnerCore {
  const bladeLength = options.radius * 2
  /**
   * 厚さの半分で羽根の短辺を完全な半円にする。先端に平らな帯を残すと、
   * 無回転時にボールがその上でちょうど静止してしまう罠になるため、この面取りを崩さない。
   */
  const bladeChamferRadius = options.bladeThickness / 2
  const bladeOptions = {
    chamfer: { radius: bladeChamferRadius },
    friction: options.friction,
    label: options.label,
    restitution: options.restitution,
  }
  const horizontalBlade = Bodies.rectangle(
    options.x,
    options.y,
    bladeLength,
    options.bladeThickness,
    bladeOptions,
  )
  const verticalBlade = Bodies.rectangle(
    options.x,
    options.y,
    options.bladeThickness,
    bladeLength,
    bladeOptions,
  )
  const body = Body.create({
    isStatic: true,
    label: options.label,
    parts: [horizontalBlade, verticalBlade],
  })

  // Body.create({ isStatic: true }) はデフォルトの摩擦・反発を上書きするため、
  // 呼び出し側が指定した値へ戻し、羽根の角速度が接線速度として伝わるようにする。
  for (const part of body.parts) {
    part.friction = options.friction
    part.frictionStatic = options.friction
    part.restitution = options.restitution
    part.label = options.label
  }
  body.friction = options.friction
  body.frictionStatic = options.friction
  body.restitution = options.restitution

  const influenceRadius = options.radius + options.ballRadius + options.influenceMargin

  return {
    body,
    influenceRadius,
    advance(dtMs, angularVelocity) {
      const safeDtMs = Math.max(0, dtMs)
      if (angularVelocity !== 0 && safeDtMs !== 0) {
        Body.setAngle(body, body.angle + angularVelocity * (safeDtMs / options.stepMs))
      }
      // 静的BodyはEngine.updateの積分対象外だが、衝突計算はanglePrevとの差を速度として使う。
      Body.setAngularVelocity(body, angularVelocity)
    },
    capBallSpeed(ballBody) {
      if (!isWithinInfluence(ballBody, options.x, options.y, influenceRadius)) return
      const speed = speedOf(ballBody)
      if (speed <= options.ballSpeedCap) return

      const factor = options.ballSpeedCap / speed
      Body.setVelocity(ballBody, {
        x: ballBody.velocity.x * factor,
        y: ballBody.velocity.y * factor,
      })
    },
    nudgeIfStalled(ballBody, stallSpeed, nudgeSpeed) {
      if (!isWithinInfluence(ballBody, options.x, options.y, influenceRadius)) return false
      if (speedOf(ballBody) >= stallSpeed) return false

      const offsetX = ballBody.position.x - options.x
      const offsetY = ballBody.position.y - options.y
      const distance = Math.hypot(offsetX, offsetY)
      const tangent =
        distance < 0.001
          ? { x: 1, y: 0 }
          : { x: -offsetY / distance, y: offsetX / distance }
      Body.setVelocity(ballBody, {
        x: tangent.x * nudgeSpeed,
        y: tangent.y * nudgeSpeed,
      })
      return true
    },
    get angle() {
      return body.angle
    },
  }
}
