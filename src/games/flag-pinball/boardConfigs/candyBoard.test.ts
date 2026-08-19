import { describe, expect, it } from 'vitest'
import { BALL_RADIUS, BOARD_HEIGHT, BOARD_WIDTH, ZONE_TOP } from '../boardLayout'
import { candyBoard } from './candyBoard'
import { normalBoard } from './normalBoard'

const REQUIRED_CLEARANCE_MARGIN = 16
const PRACTICAL_MIN_SCALE = 0.7
const MIN_TAP_DIAMETER_PX = 44

/**
 * おかしテーマ（candyBoard）専用の盤面ジオメトリを検証する。
 * 通常テーマ（normalBoard.test.ts）と同じ観点（盤面内に収まる・障害物同士が詰まらない・
 * タップ判定が重ならない）で検証しつつ、おかし盤面ならではの短いガイド板・ハンマーtoyも
 * 追加で検証する。
 */
describe('candyBoard.obstacles', () => {
  it('通常盤面よりバンパーが多く、idに重複がない', () => {
    expect(candyBoard.obstacles.length).toBeGreaterThanOrEqual(15)
    expect(candyBoard.obstacles.filter((o) => o.kind === 'bumper').length).toBeGreaterThan(
      normalBoard.obstacles.filter((o) => o.kind === 'bumper').length,
    )
    const ids = candyBoard.obstacles.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('すべて盤面内（半径ぶん含めて 0..BOARD_WIDTH / 0..ZONE_TOP の内側）にある', () => {
    for (const o of candyBoard.obstacles) {
      expect(o.x - o.radius).toBeGreaterThanOrEqual(0)
      expect(o.x + o.radius).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(o.y - o.radius).toBeGreaterThanOrEqual(0)
      expect(o.y + o.radius).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('障害物同士の中心距離に16px以上の余裕があり、ボールが詰まらない', () => {
    const obstacles = candyBoard.obstacles
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

  it('障害物と壁（外壁・射出ガイド壁・短いガイド板）の間にボール半径ぶんの余裕がある', () => {
    for (const o of candyBoard.obstacles) {
      for (const wall of candyBoard.walls) {
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

describe('candyBoard.walls', () => {
  it('wall-bottom が存在する', () => {
    expect(candyBoard.walls.find((w) => w.id === 'wall-bottom')).toBeDefined()
  })

  it('外壁・上壁・射出ガイド壁は通常盤面と同じ形状（安定動作が確認済みの形状を変更しない）', () => {
    const sharedIds = ['wall-left', 'wall-right', 'wall-top', 'wall-guide-left', 'wall-guide-right', 'wall-bottom']
    for (const id of sharedIds) {
      const candyWall = candyBoard.walls.find((w) => w.id === id)
      const normalWall = normalBoard.walls.find((w) => w.id === id)
      expect(candyWall).toEqual(normalWall)
    }
  })

  it('おかし専用の短いガイド板が4枚あり、通常盤面にはない', () => {
    const guides = candyBoard.walls.filter((w) => w.id.startsWith('wall-candy-guide'))
    expect(guides).toHaveLength(4)
    expect(normalBoard.walls.some((w) => w.id.startsWith('wall-candy-guide'))).toBe(false)
  })

  it('4枚の短いガイド板は互いに（端点同士の実距離で）ボール直径ぶん以上離れている', () => {
    const guides = candyBoard.walls.filter((w) => w.id.startsWith('wall-candy-guide'))
    function endpoints(wall: (typeof guides)[number]): readonly [{ x: number; y: number }, { x: number; y: number }] {
      const halfW = wall.width / 2
      const cos = Math.cos(wall.angle)
      const sin = Math.sin(wall.angle)
      return [
        { x: wall.x - halfW * cos, y: wall.y - halfW * sin },
        { x: wall.x + halfW * cos, y: wall.y + halfW * sin },
      ]
    }
    for (let i = 0; i < guides.length; i += 1) {
      for (let j = i + 1; j < guides.length; j += 1) {
        const [a1, a2] = endpoints(guides[i])
        const [b1, b2] = endpoints(guides[j])
        let minDistance = Number.POSITIVE_INFINITY
        for (const p of [a1, a2]) {
          for (const q of [b1, b2]) {
            minDistance = Math.min(minDistance, Math.hypot(p.x - q.x, p.y - q.y))
          }
        }
        expect(minDistance).toBeGreaterThanOrEqual(BALL_RADIUS * 2)
      }
    }
  })
})

describe('candyBoard.cornerEscapeZones', () => {
  it('通常盤面と同じ外壁・射出ガイド壁を使うため、すり抜けゾーンも同じ座標を持つ', () => {
    expect(candyBoard.cornerEscapeZones).toEqual(normalBoard.cornerEscapeZones)
  })
})

describe('candyBoard.toys', () => {
  it('おもちゃidが重複しない', () => {
    const ids = candyBoard.toys.map((toy) => toy.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ハンマー（hammer）が1個、回転（spinner）が1個存在する', () => {
    expect(candyBoard.toys.filter((toy) => toy.kind === 'hammer')).toHaveLength(1)
    expect(candyBoard.toys.filter((toy) => toy.kind === 'spinner')).toHaveLength(1)
  })

  it('ボール半径ぶんの余裕を持って盤面内にある', () => {
    for (const toy of candyBoard.toys) {
      expect(toy.x - toy.radius - BALL_RADIUS).toBeGreaterThanOrEqual(0)
      expect(toy.x + toy.radius + BALL_RADIUS).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(toy.y - toy.radius - BALL_RADIUS).toBeGreaterThanOrEqual(0)
      expect(toy.y + toy.radius + BALL_RADIUS).toBeLessThanOrEqual(BOARD_HEIGHT)
    }
  })

  it('障害物との中心距離にボール直径ぶんの余裕がある', () => {
    for (const toy of candyBoard.toys) {
      for (const obstacle of candyBoard.obstacles) {
        const distance = Math.hypot(toy.x - obstacle.x, toy.y - obstacle.y)
        const required = toy.radius + obstacle.radius + BALL_RADIUS * 2
        expect(distance).toBeGreaterThanOrEqual(required)
      }
    }
  })

  it('おもちゃ同士のタップ判定円が重ならない', () => {
    const toys = candyBoard.toys
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
    for (const toy of candyBoard.toys) {
      expect(toy.y + toy.radius).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('実機スケール0.7倍でもタップ判定の直径が44px以上ある', () => {
    for (const toy of candyBoard.toys) {
      expect(toy.tapRadius * 2 * PRACTICAL_MIN_SCALE).toBeGreaterThanOrEqual(MIN_TAP_DIAMETER_PX)
    }
  })

  it('ハンマーはx方向にBOARD_WIDTHの中心に置かれている（左右対称に振れるため）', () => {
    const hammer = candyBoard.toys.find((toy) => toy.kind === 'hammer')
    if (!hammer) throw new Error('candyBoard test: ハンマーtoyが見つかりません')
    expect(hammer.x).toBe(BOARD_WIDTH / 2)
  })
})

describe('candyBoard.launch', () => {
  it('射出口・初速レンジは通常盤面と同じ（おかしの賑やかさは盤面配置だけで作る）', () => {
    expect(candyBoard.launch).toEqual(normalBoard.launch)
  })
})
