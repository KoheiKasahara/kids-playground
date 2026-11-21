// @vitest-environment node
import { expect, test } from 'vitest'
import { circuitLength, pose, racingLine, roadLimit } from './circuit'
import { advance, grid, LAPS, RECHARGE } from './race'

test('3台がコース幅を使い、並走時に間隔を取って進行方向を向く', () => {
  let race = grid(() => 0.5)
  const paths = race.offsets.map(() => [] as number[])
  let alongside = false
  while (race.distance < LAPS) {
    const previous = race
    race = advance({ ...race, cooldown: race.cooldown || RECHARGE })
    const laps = [race.distance, ...race.rivalDistances]
    const before = [previous.distance, ...previous.rivalDistances]
    laps.forEach((distance, i) => {
      paths[i].push(race.offsets[i])
      const from = pose(before[i], previous.offsets[i])
      const to = pose(distance, race.offsets[i])
      expect(race.headings[i]).toBeCloseTo(Math.atan2(to.y - from.y, to.x - from.x))
      for (let j = 0; j < i; j++) {
        if (Math.abs(distance - laps[j]) * circuitLength < 65) {
          alongside = true
          expect(Math.abs(race.offsets[i] - race.offsets[j])).toBeGreaterThan(32)
        }
      }
    })
  }
  expect(alongside).toBe(true)
  for (const offsets of paths) {
    expect(Math.min(...offsets)).toBeGreaterThanOrEqual(-36)
    expect(Math.max(...offsets)).toBeLessThanOrEqual(36)
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeGreaterThan(25)
  }
})

test('共通の走行ラインは固定した横位置より一周が短く、各車がスタート位置を越えて使う', () => {
  function lapLength(offsetAt: (laps: number) => number) {
    let length = 0
    let previous = pose(0, offsetAt(0))
    for (let i = 1; i <= 512; i++) {
      const laps = i / 512
      const next = pose(laps, offsetAt(laps))
      length += Math.hypot(next.x - previous.x, next.y - previous.y)
      previous = next
    }
    return length
  }
  const plannedLength = lapLength(racingLine)
  for (const offset of [-roadLimit, 0, roadLimit]) {
    expect(plannedLength).toBeLessThan(lapLength(() => offset))
  }
  let race = grid(() => 0.5)
  // With no nearby traffic every car can follow its own cornering plan.
  race.rivalDistances = [0.2, 0.4]
  const secondLap: number[][] = [[], [], []]
  while (race.distance < LAPS) {
    race = advance(race)
    if (race.distance >= 1) race.offsets.forEach((offset, i) => secondLap[i].push(offset))
  }
  for (const path of secondLap) {
    expect(Math.min(...path)).toBeLessThan(-25)
    expect(Math.max(...path)).toBeGreaterThan(5)
  }
})

test('直線の巡航速度は同じで、カーブでは膨らみとペースの差が追い抜きにつながる', () => {
  const start = grid(() => 0.5)
  const fast = { wide: 0, pace: 0.18 }
  const slow = { wide: 20, pace: -0.18 }
  const plans = start.plans.map((laps, car) => laps.map(corners =>
    corners.map(() => car === 0 ? fast : slow)))
  let race = { ...start, plans }
  expect(advance(race).distance).toBe(advance(start).distance)
  expect(advance(race)).toEqual(advance(race))

  const entry = { ...race, distance: 0.20, rivalDistances: [0.48, 0.73], offsets: [-36, 0, 0] }
  const wideCar = { ...entry, plans: [plans[1], plans[0], plans[2]] }
  const tight = advance(entry), wide = advance(wideCar)
  expect(wide.offsets[0]).toBeGreaterThan(tight.offsets[0])
  expect(wide.distance).toBeLessThan(tight.distance)
  while (race.distance < LAPS) race = advance(race)
  expect(race.rivalDistances.every(laps => laps < race.distance)).toBe(true)
})
