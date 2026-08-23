import * as Matter from 'matter-js'

const { Body, Bodies } = Matter

export type LifterCoreOptions = {
  x: number
  y: number
  radius: number
  friction: number
  restitution: number
  label: string
  ballRadius: number
  influenceMargin: number
  upSpeed: number
  maxHorizontalSpeed: number
  randomHorizontalMin: number
  randomHorizontalMax: number
  horizontalRetention: number
  speedCap: number
  cooldownMs: number
}

export type LifterCore = {
  readonly body: Matter.Body
  /** 打ち上げたらtrue。クールダウン・上昇中判定は内部で持つ */
  tryLaunch(nowMs: number, ballKey: number | string, ballBody: Matter.Body, random: () => number): boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 接触したボールを上方向と左右へ直接打ち上げる、常時作動の共通Bodyを作る。 */
export function createLifterCore(options: LifterCoreOptions): LifterCore {
  const body = Bodies.circle(options.x, options.y, options.radius, {
    friction: options.friction,
    isStatic: true,
    label: options.label,
    restitution: options.restitution,
  })
  const influenceRadius = options.radius + options.ballRadius + options.influenceMargin
  const lastLaunchAt = new Map<number | string, number>()
  const alreadyRisingThreshold = options.upSpeed * 0.5

  return {
    body,
    tryLaunch(nowMs, ballKey, ballBody, random) {
      const offsetX = ballBody.position.x - options.x
      const offsetY = ballBody.position.y - options.y
      if (Math.hypot(offsetX, offsetY) > influenceRadius) return false

      const previousLaunchAt = lastLaunchAt.get(ballKey)
      if (previousLaunchAt !== undefined && nowMs - previousLaunchAt < options.cooldownMs) return false
      if (ballBody.velocity.y <= -alreadyRisingThreshold) return false

      // 左右方向はランダムに選び、コース側の斜め板が作る偏りをさらに固定しない。
      const randomHorizontalDirection = random() < 0.5 ? -1 : 1
      const randomHorizontalSpeed =
        options.randomHorizontalMin +
        random() * (options.randomHorizontalMax - options.randomHorizontalMin)
      const dampedHorizontalVelocity = clamp(
        ballBody.velocity.x * options.horizontalRetention,
        -options.maxHorizontalSpeed,
        options.maxHorizontalSpeed,
      )
      const horizontalVelocity = clamp(
        dampedHorizontalVelocity + randomHorizontalDirection * randomHorizontalSpeed,
        -options.maxHorizontalSpeed,
        options.maxHorizontalSpeed,
      )
      const verticalVelocity = -options.upSpeed
      const rawSpeed = Math.hypot(horizontalVelocity, verticalVelocity)
      const speedScale = rawSpeed > options.speedCap ? options.speedCap / rawSpeed : 1

      // applyForceはdeltaの二乗で効き方が変わるため、狙った速度を直接設定する。
      Body.setVelocity(ballBody, {
        x: horizontalVelocity * speedScale,
        y: verticalVelocity * speedScale,
      })
      lastLaunchAt.set(ballKey, nowMs)
      return true
    },
  }
}
