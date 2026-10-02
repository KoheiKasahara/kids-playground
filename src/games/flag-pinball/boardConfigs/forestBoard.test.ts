import { describe, expect, it } from 'vitest'
import { BALL_RADIUS, BOARD_HEIGHT, BOARD_WIDTH, ZONE_TOP } from '../boardLayout'
import { forestBoard } from './forestBoard'
import { normalBoard } from './normalBoard'

const REQUIRED_CLEARANCE_MARGIN = 16
const PRACTICAL_MIN_SCALE = 0.7
const MIN_TAP_DIAMETER_PX = 44

/**
 * もりテーマ（forestBoard）専用の盤面ジオメトリを検証する。
 * 他テーマと同じ観点（盤面内に収まる・障害物同士が詰まらない・タップ判定が重ならない）に加え、
 * きのこ（jumppad）2個とまるたシーソーの配置を検証する。
 */
describe('forestBoard.obstacles', () => {
  it('idに重複がない', () => {
    const ids = forestBoard.obstacles.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('すべて盤面内（半径ぶん含めて 0..BOARD_WIDTH / 0..ZONE_TOP の内側）にある', () => {
    for (const o of forestBoard.obstacles) {
      expect(o.x - o.radius).toBeGreaterThanOrEqual(0)
      expect(o.x + o.radius).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(o.y - o.radius).toBeGreaterThanOrEqual(0)
      expect(o.y + o.radius).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('障害物同士の中心距離に16px以上の余裕があり、ボールが詰まらない', () => {
    const obstacles = forestBoard.obstacles
    for (let i = 0; i < obstacles.length; i += 1) {
      for (let j = i + 1; j < obstacles.length; j += 1) {
        const a = obstacles[i]
        const b = obstacles[j]
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        const required = a.radius + b.radius + BALL_RADIUS * 2 + REQUIRED_CLEARANCE_MARGIN
        expect(distance).toBeGreaterThanOrEqual(required)
      }
    }
  })

  it('障害物と壁の間にボール半径ぶんの余裕がある', () => {
    for (const o of forestBoard.obstacles) {
      for (const wall of forestBoard.walls) {
        const dx = o.x - wall.x
        const dy = o.y - wall.y
        const cos = Math.cos(wall.angle)
        const sin = Math.sin(wall.angle)
        const localX = dx * cos + dy * sin
        const localY = -dx * sin + dy * cos
        const halfW = wall.width / 2
        const halfH = wall.height / 2
        const clampedX = Math.min(halfW, Math.max(-halfW, localX))
        const clampedY = Math.min(halfH, Math.max(-halfH, localY))
        const clearance = Math.hypot(localX - clampedX, localY - clampedY)
        expect(clearance).toBeGreaterThanOrEqual(o.radius + BALL_RADIUS)
      }
    }
  })
})

describe('forestBoard.walls', () => {
  it('壁一式は通常盤面と同じ形状（安定動作が確認済みの形状を変更しない）', () => {
    expect(forestBoard.walls).toEqual(normalBoard.walls)
  })

  it('すり抜けゾーンも通常盤面と同じ座標を持つ', () => {
    expect(forestBoard.cornerEscapeZones).toEqual(normalBoard.cornerEscapeZones)
  })
})

describe('forestBoard.toys', () => {
  it('おもちゃidが重複しない', () => {
    const ids = forestBoard.toys.map((toy) => toy.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('きのこ（jumppad）が左右対称に2個、シーソーが中央に1個ある', () => {
    const jumppads = forestBoard.toys.filter((toy) => toy.kind === 'jumppad')
    expect(jumppads).toHaveLength(2)
    expect(jumppads[0].x + jumppads[1].x).toBe(BOARD_WIDTH)
    expect(jumppads[0].y).toBe(jumppads[1].y)

    const seesaws = forestBoard.toys.filter((toy) => toy.kind === 'seesaw')
    expect(seesaws).toHaveLength(1)
    expect(seesaws[0].x).toBe(BOARD_WIDTH / 2)
    // きのこで跳ねたボールが最後にシーソーへ落ちる流れにするため、シーソーはきのこより下に置く。
    expect(seesaws[0].y).toBeGreaterThan(jumppads[0].y)
  })

  it('2個のきのこの間はボールが通り抜けられる', () => {
    const [left, right] = forestBoard.toys.filter((toy) => toy.kind === 'jumppad')
    expect(Math.abs(right.x - left.x) - left.radius - right.radius).toBeGreaterThan(BALL_RADIUS * 2)
  })

  it('ボール半径ぶんの余裕を持って盤面内にある', () => {
    for (const toy of forestBoard.toys) {
      expect(toy.x - toy.radius - BALL_RADIUS).toBeGreaterThanOrEqual(0)
      expect(toy.x + toy.radius + BALL_RADIUS).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(toy.y - toy.radius - BALL_RADIUS).toBeGreaterThanOrEqual(0)
      expect(toy.y + toy.radius + BALL_RADIUS).toBeLessThanOrEqual(BOARD_HEIGHT)
    }
  })

  it('障害物との中心距離にボール直径ぶんの余裕がある', () => {
    for (const toy of forestBoard.toys) {
      for (const obstacle of forestBoard.obstacles) {
        const distance = Math.hypot(toy.x - obstacle.x, toy.y - obstacle.y)
        const required = toy.radius + obstacle.radius + BALL_RADIUS * 2
        expect(distance).toBeGreaterThanOrEqual(required)
      }
    }
  })

  it('おもちゃ同士のタップ判定円が重ならない', () => {
    const toys = forestBoard.toys
    for (let i = 0; i < toys.length; i += 1) {
      for (let j = i + 1; j < toys.length; j += 1) {
        const a = toys[i]
        const b = toys[j]
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        expect(distance).toBeGreaterThanOrEqual(a.tapRadius + b.tapRadius)
      }
    }
  })

  it('得点ゾーン領域に入っていない', () => {
    for (const toy of forestBoard.toys) {
      expect(toy.y + toy.radius).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('実機スケール0.7倍でもタップ判定の直径が44px以上ある', () => {
    for (const toy of forestBoard.toys) {
      expect(toy.tapRadius * 2 * PRACTICAL_MIN_SCALE).toBeGreaterThanOrEqual(MIN_TAP_DIAMETER_PX)
    }
  })
})

describe('forestBoard.launch', () => {
  it('射出口・初速レンジは通常盤面と同じ（もりの動きは盤面配置だけで作る）', () => {
    expect(forestBoard.launch).toEqual(normalBoard.launch)
  })
})
