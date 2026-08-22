import type { CarGimmick } from './mazeGimmicks'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 負の時刻や逆向きでも常に0以上の周期内へ収める剰余。 */
function positiveModulo(value: number, modulus: number): number {
  const remainder = value % modulus
  return remainder < 0 ? remainder + modulus : remainder
}

/**
 * 一定速度の三角波で、車の中心からのX方向オフセットを求める。
 * 前フレームへ加算せず絶対時刻から決めるため、フレーム落ちしても位相ずれが蓄積しない。
 * flag-pinball/carToy.tsが可動域をclampしているのと同じ考え方で、区間ごとの三角波と最後の
 * clampの両方で、車が指定した可動域を絶対に超えないようにする。
 */
export function carOffsetAt(car: CarGimmick, elapsedSeconds: number): number {
  const amplitude = car.amplitude
  if (!Number.isFinite(amplitude) || amplitude <= 0) return 0

  const speed = Number.isFinite(car.speed) ? car.speed : 0
  const phaseOffsetSeconds = Number.isFinite(car.phaseOffsetSeconds)
    ? car.phaseOffsetSeconds
    : 0
  const time = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0
  const direction = car.initialDirection === -1 ? -1 : 1
  const distanceInCycle = positiveModulo(
    (time + phaseOffsetSeconds) * speed * direction,
    amplitude * 4,
  )

  let offset: number
  if (distanceInCycle <= amplitude) {
    offset = distanceInCycle
  } else if (distanceInCycle <= amplitude * 3) {
    offset = amplitude * 2 - distanceInCycle
  } else {
    offset = distanceInCycle - amplitude * 4
  }

  return clamp(offset, -amplitude, amplitude)
}

/** 車体中心の絶対X座標を返し、物理と描画の移動基準を1か所へ集める。 */
export function carXAt(car: CarGimmick, elapsedSeconds: number): number {
  return car.center.x + carOffsetAt(car, elapsedSeconds)
}
