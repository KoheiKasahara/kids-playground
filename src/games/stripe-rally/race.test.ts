// @vitest-environment node
import { expect, test } from 'vitest'
import { circuitLength, pose } from './circuit'
import { advance, grid, LAPS, RECHARGE, rivals } from './race'

test('3台がコース幅を使い、並走時に間隔を取って進行方向を向く', () => {
  let race = grid()
  const paths = race.offsets.map(() => [] as number[])
  let alongside = false
  while (race.distance < LAPS) {
    const previous = race
    race = advance({ ...race, cooldown: race.cooldown || RECHARGE })
    const laps = [race.distance, ...rivals(race.elapsed)]
    const before = [previous.distance, ...rivals(previous.elapsed)]
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
