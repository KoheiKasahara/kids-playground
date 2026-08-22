import { describe, expect, it } from 'vitest'
import {
  CAR_BODY_HEIGHT,
  CAR_CABIN_RADIUS,
  CAR_DEPTH,
  CAR_WIDTH,
} from './mazePhysics'
import { carOffsetAt, carXAt } from './mazeCarToy'
import type { CarGimmick } from './mazeGimmicks'

const car: CarGimmick = {
  id: 'test-car',
  center: { x: 4, y: CAR_BODY_HEIGHT / 2, z: -2 },
  amplitude: 5,
  speed: 2.2,
  phaseOffsetSeconds: 0,
  initialDirection: 1,
  halfWidth: CAR_WIDTH / 2,
  halfHeight: CAR_BODY_HEIGHT / 2,
  halfDepth: CAR_DEPTH / 2,
  cabinRadius: CAR_CABIN_RADIUS,
}

describe('carOffsetAt', () => {
  it('多数の時刻でも指定した可動域を超えない', () => {
    for (let index = -500; index <= 5000; index += 1) {
      const offset = carOffsetAt(car, index * 0.037)
      expect(offset).toBeGreaterThanOrEqual(-car.amplitude)
      expect(offset).toBeLessThanOrEqual(car.amplitude)
    }
  })

  it('端で折り返し、端以外では一定速度で動く', () => {
    const edgeSeconds = car.amplitude / car.speed
    expect(carOffsetAt(car, edgeSeconds)).toBeCloseTo(car.amplitude, 8)
    expect(carOffsetAt(car, edgeSeconds - 0.1)).toBeCloseTo(
      car.amplitude - car.speed * 0.1,
      8,
    )
    expect(carOffsetAt(car, edgeSeconds + 0.1)).toBeCloseTo(
      car.amplitude - car.speed * 0.1,
      8,
    )

    const offsets = [0.1, 0.2, 0.3, 0.4, 0.5].map((time) =>
      carOffsetAt(car, time),
    )
    for (let index = 1; index < offsets.length; index += 1) {
      expect(offsets[index]! - offsets[index - 1]!).toBeCloseTo(
        car.speed * 0.1,
        8,
      )
    }
  })

  it('微小な時間差で瞬間移動せず、端をまたいでも連続する', () => {
    const deltaSeconds = 0.001
    let previous = carOffsetAt(car, 0)
    for (let index = 1; index <= 5000; index += 1) {
      const next = carOffsetAt(car, index * deltaSeconds)
      expect(Math.abs(next - previous)).toBeLessThanOrEqual(
        car.speed * deltaSeconds + 1e-10,
      )
      previous = next
    }
  })

  it('開始位相と最初の向きが反映される', () => {
    expect(
      carOffsetAt({ ...car, phaseOffsetSeconds: 0.5 }, 0),
    ).toBeCloseTo(car.speed * 0.5, 8)
    expect(
      carOffsetAt({ ...car, initialDirection: -1 }, 0.5),
    ).toBeCloseTo(-car.speed * 0.5, 8)
  })

  it('同じ絶対時刻なら常に同じ値を返し、中心Xへ足す', () => {
    const elapsedSeconds = 3.7
    const first = carOffsetAt(car, elapsedSeconds)
    expect(carOffsetAt(car, elapsedSeconds)).toBe(first)
    expect(carXAt(car, elapsedSeconds)).toBeCloseTo(car.center.x + first, 10)
  })
})
