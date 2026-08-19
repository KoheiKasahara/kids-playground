import { describe, expect, it } from 'vitest'
import { BALL_RADIUS, BOARD_HEIGHT, BOARD_WIDTH, ZONE_TOP } from '../boardLayout'
import { normalBoard } from './normalBoard'
import { spaceBoard } from './spaceBoard'

const REQUIRED_CLEARANCE_MARGIN = 16
const PRACTICAL_MIN_SCALE = 0.7
const MIN_TAP_DIAMETER_PX = 44

/**
 * 宇宙テーマ（spaceBoard）専用の盤面ジオメトリを検証する。
 * 通常テーマ（normalBoard.test.ts）と同じ観点（盤面内に収まる・障害物同士が詰まらない・
 * タップ判定が重ならない）で検証しつつ、宇宙盤面ならではの斜めガイド壁・ジャンプ台も追加で検証する。
 */
describe('spaceBoard.obstacles', () => {
  it('通常盤面よりずっと少ない個数で、idに重複がない（障害物を増やしすぎない）', () => {
    expect(spaceBoard.obstacles.length).toBeGreaterThanOrEqual(8)
    expect(spaceBoard.obstacles.length).toBeLessThan(normalBoard.obstacles.length)
    const ids = spaceBoard.obstacles.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('すべて盤面内（半径ぶん含めて 0..BOARD_WIDTH / 0..ZONE_TOP の内側）にある', () => {
    for (const o of spaceBoard.obstacles) {
      expect(o.x - o.radius).toBeGreaterThanOrEqual(0)
      expect(o.x + o.radius).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(o.y - o.radius).toBeGreaterThanOrEqual(0)
      expect(o.y + o.radius).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('障害物同士の中心距離に16px以上の余裕があり、ボールが詰まらない', () => {
    const obstacles = spaceBoard.obstacles
    let minimumMargin = Number.POSITIVE_INFINITY
    for (let i = 0; i < obstacles.length; i += 1) {
      for (let j = i + 1; j < obstacles.length; j += 1) {
        const a = obstacles[i]
        const b = obstacles[j]
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        const required = a.radius + b.radius + BALL_RADIUS * 2 + REQUIRED_CLEARANCE_MARGIN
        minimumMargin = Math.min(minimumMargin, distance - (a.radius + b.radius + BALL_RADIUS * 2))
        expect(distance).toBeGreaterThanOrEqual(required)
      }
    }
    expect(minimumMargin).toBeGreaterThanOrEqual(REQUIRED_CLEARANCE_MARGIN)
  })
})

describe('spaceBoard.walls', () => {
  it('wall-bottom が存在する', () => {
    expect(spaceBoard.walls.find((w) => w.id === 'wall-bottom')).toBeDefined()
  })

  it('外壁・上壁・射出ガイド壁は通常盤面と同じ形状（安定動作が確認済みの形状を変更しない）', () => {
    const sharedIds = ['wall-left', 'wall-right', 'wall-top', 'wall-guide-left', 'wall-guide-right', 'wall-bottom']
    for (const id of sharedIds) {
      const spaceWall = spaceBoard.walls.find((w) => w.id === id)
      const normalWall = normalBoard.walls.find((w) => w.id === id)
      expect(spaceWall).toEqual(normalWall)
    }
  })

  it('宇宙専用の斜めガイド壁が2枚あり、通常盤面にはない', () => {
    const ramps = spaceBoard.walls.filter((w) => w.id.startsWith('wall-space-ramp'))
    expect(ramps).toHaveLength(2)
    expect(normalBoard.walls.some((w) => w.id.startsWith('wall-space-ramp'))).toBe(false)
  })

  it('2枚の斜めガイド壁は高さ(y)がずれており、交わる隙間（挟まりの罠）を作らない', () => {
    const [rampA, rampB] = spaceBoard.walls.filter((w) => w.id.startsWith('wall-space-ramp'))
    if (!rampA || !rampB) throw new Error('spaceBoard test: 斜めガイド壁が見つかりません')
    expect(Math.abs(rampA.y - rampB.y)).toBeGreaterThan(rampA.height)
  })
})

describe('spaceBoard.cornerEscapeZones', () => {
  it('通常盤面と同じ外壁・射出ガイド壁を使うため、すり抜けゾーンも同じ座標を持つ', () => {
    expect(spaceBoard.cornerEscapeZones).toEqual(normalBoard.cornerEscapeZones)
  })
})

describe('spaceBoard.toys', () => {
  it('おもちゃidが重複しない', () => {
    const ids = spaceBoard.toys.map((toy) => toy.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ジャンプ台（jumppad）が1個存在する', () => {
    expect(spaceBoard.toys.filter((toy) => toy.kind === 'jumppad')).toHaveLength(1)
  })

  it('回転おもちゃ（人工衛星）が存在する', () => {
    expect(spaceBoard.toys.filter((toy) => toy.kind === 'spinner').length).toBeGreaterThanOrEqual(1)
  })

  it('ボール半径ぶんの余裕を持って盤面内にある', () => {
    for (const toy of spaceBoard.toys) {
      expect(toy.x - toy.radius - BALL_RADIUS).toBeGreaterThanOrEqual(0)
      expect(toy.x + toy.radius + BALL_RADIUS).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(toy.y - toy.radius - BALL_RADIUS).toBeGreaterThanOrEqual(0)
      expect(toy.y + toy.radius + BALL_RADIUS).toBeLessThanOrEqual(BOARD_HEIGHT)
    }
  })

  it('障害物との中心距離にボール直径ぶんの余裕がある', () => {
    for (const toy of spaceBoard.toys) {
      for (const obstacle of spaceBoard.obstacles) {
        const distance = Math.hypot(toy.x - obstacle.x, toy.y - obstacle.y)
        const required = toy.radius + obstacle.radius + BALL_RADIUS * 2
        expect(distance).toBeGreaterThanOrEqual(required)
      }
    }
  })

  it('おもちゃ同士のタップ判定円が重ならない', () => {
    const toys = spaceBoard.toys
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
    for (const toy of spaceBoard.toys) {
      expect(toy.y + toy.radius).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('実機スケール0.7倍でもタップ判定の直径が44px以上ある', () => {
    for (const toy of spaceBoard.toys) {
      expect(toy.tapRadius * 2 * PRACTICAL_MIN_SCALE).toBeGreaterThanOrEqual(MIN_TAP_DIAMETER_PX)
    }
  })

  it('おもちゃ（円）が斜めガイド壁と重ならない（ボールが挟まる隙間を作らない）', () => {
    const ramps = spaceBoard.walls.filter((w) => w.id.startsWith('wall-space-ramp'))
    for (const toy of spaceBoard.toys) {
      for (const wall of ramps) {
        const dx = toy.x - wall.x
        const dy = toy.y - wall.y
        const cos = Math.cos(wall.angle)
        const sin = Math.sin(wall.angle)
        const localX = dx * cos + dy * sin
        const localY = -dx * sin + dy * cos
        const halfW = wall.width / 2
        const halfH = wall.height / 2
        const clampedX = Math.min(halfW, Math.max(-halfW, localX))
        const clampedY = Math.min(halfH, Math.max(-halfH, localY))
        const clearance = Math.hypot(localX - clampedX, localY - clampedY)
        expect(clearance).toBeGreaterThanOrEqual(toy.radius + BALL_RADIUS)
      }
    }
  })
})

describe('spaceBoard.launch', () => {
  it('射出口は通常盤面と同じx中心・yを使う（射出タイミングのルール自体は共通のため）', () => {
    expect(spaceBoard.launch.x).toBe(normalBoard.launch.x)
    expect(spaceBoard.launch.y).toBe(normalBoard.launch.y)
  })

  it('通常盤面より横方向の初速レンジが広く、左右に散らばりやすい', () => {
    const spaceRange = spaceBoard.launch.maxVx - spaceBoard.launch.minVx
    const normalRange = normalBoard.launch.maxVx - normalBoard.launch.minVx
    expect(spaceRange).toBeGreaterThan(normalRange)
  })
})
