import { expect, it } from 'vitest'
import { applyTool, COLS, createEmptyTown, DIRS, ROWS, type Dir } from '../town'
import { facingAngle, facingOf, farDistance, fitDistance, tileAt, tileCenter, tileNoise } from './townLayout'

it('maps every tile center back to its tile and ignores points off the map', () => {
  for (let index = 0; index < COLS * ROWS; index += 1) {
    const center = tileCenter(index)
    expect(tileAt(center.x, center.z)).toBe(index)
    expect(tileAt(center.x + 0.49, center.z - 0.49)).toBe(index)
  }
  // ちずの まんなかが 0、きた（うえの ぎょう）が -z。
  expect(tileCenter(0)).toEqual({ x: 0.5 - COLS / 2, z: 0.5 - ROWS / 2 })
  expect(tileAt(-COLS / 2 - 0.01, 0)).toBeNull()
  expect(tileAt(0, ROWS / 2 + 0.01)).toBeNull()
})

it('turns buildings toward a neighbouring road, trying south first', () => {
  const index = 5 * COLS + 5
  let town = applyTool(createEmptyTown(), index, 'house')
  expect(facingOf(town, index)).toBe(2)
  town = applyTool(town, index - COLS, 'road')
  expect(facingOf(town, index)).toBe(0)
  town = applyTool(town, index - 1, 'road')
  expect(facingOf(town, index)).toBe(3)
  town = applyTool(town, index + 1, 'road')
  expect(facingOf(town, index)).toBe(1)
  // せんろだけでは むかないが、ふみきりは みちと して むく。
  town = applyTool(town, index + COLS, 'rail')
  expect(facingOf(town, index)).toBe(1)
  town = applyTool(town, index + COLS, 'road')
  expect(facingOf(town, index)).toBe(2)
  expect(facingOf(createEmptyTown(), COLS * ROWS - 1)).toBe(2)
})

it('rotates the local front (+z) to face each direction', () => {
  for (const dir of [0, 1, 2, 3] as Dir[]) {
    const angle = facingAngle(dir)
    expect(Math.sin(angle)).toBeCloseTo(DIRS[dir][0])
    expect(Math.cos(angle)).toBeCloseTo(DIRS[dir][1])
  }
})

it('gives every tile a stable number between 0 and 1', () => {
  const values = Array.from({ length: COLS * ROWS }, (_, index) => tileNoise(index, 3))
  expect(values.every((value) => value >= 0 && value < 1)).toBe(true)
  expect(tileNoise(42, 3)).toBe(values[42])
  expect(tileNoise(42, 4)).not.toBe(values[42])
  expect(new Set(values.map((value) => Math.floor(value * 10))).size).toBeGreaterThan(6)
})

it('backs the camera further away on a tall phone than on a wide screen, within limits', () => {
  expect(fitDistance(0.5, 42)).toBeGreaterThan(fitDistance(1.6, 42))
  expect(fitDistance(0.01, 42)).toBeLessThanOrEqual(46)
  expect(fitDistance(10, 42)).toBeGreaterThanOrEqual(14)
  // ひろい ちず ぜんたいを みる ときは、もっと はなれられる。
  for (const aspect of [0.5, 1, 1.6]) {
    expect(farDistance(aspect, 42)).toBeGreaterThan(fitDistance(aspect, 42))
    expect(farDistance(aspect, 42)).toBeLessThanOrEqual(150)
  }
})
