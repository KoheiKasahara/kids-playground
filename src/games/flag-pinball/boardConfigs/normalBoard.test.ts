import { describe, expect, it } from 'vitest'
import { BALL_RADIUS, BOARD_HEIGHT, BOARD_WIDTH, ZONE_TOP } from '../boardLayout'
import { normalBoard } from './normalBoard'

const REQUIRED_CLEARANCE_MARGIN = 16
const PRACTICAL_MIN_SCALE = 0.7
const MIN_TAP_DIAMETER_PX = 44

/**
 * 通常テーマ（normalBoard）の盤面ジオメトリを検証する。
 * ここは「テーマ別分離を行う前の boardLayout.test.ts / toyLayout.test.ts」から
 * 内容を移したもので、通常テーマのプレイ感（障害物の個数・配置・余裕）が
 * リファクタ前後で変わっていないことを保証する。
 */
describe('normalBoard.obstacles', () => {
  it('30〜40個で、バンパー3個・十分な数のピン、idに重複がない', () => {
    expect(normalBoard.obstacles.length).toBeGreaterThanOrEqual(30)
    expect(normalBoard.obstacles.length).toBeLessThanOrEqual(40)
    expect(normalBoard.obstacles.filter((obstacle) => obstacle.kind === 'bumper')).toHaveLength(3)
    expect(normalBoard.obstacles.filter((obstacle) => obstacle.kind === 'peg').length).toBeGreaterThanOrEqual(27)
    const ids = normalBoard.obstacles.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ピンは複数段の半ピッチ千鳥配置で、盤面全体に分散している', () => {
    const pegs = normalBoard.obstacles.filter((obstacle) => obstacle.kind === 'peg')
    const rows = new Map<number, number[]>()
    for (const peg of pegs) rows.set(peg.y, [...(rows.get(peg.y) ?? []), peg.x])
    const sortedRows = [...rows.entries()].sort(([a], [b]) => a - b)
    expect(sortedRows.length).toBeGreaterThanOrEqual(6)
    expect(sortedRows.length).toBeLessThanOrEqual(9)
    for (const [, xs] of sortedRows) {
      expect(xs.length).toBeGreaterThanOrEqual(3)
      expect(xs.length).toBeLessThanOrEqual(5)
      expect(xs).toEqual([...xs].sort((a, b) => a - b))
    }
    for (let i = 1; i < sortedRows.length; i += 1) {
      const [previousY, previousXs] = sortedRows[i - 1]
      const [currentY, currentXs] = sortedRows[i]
      expect(currentY).toBeGreaterThan(previousY)
      if (currentXs.length !== 3 && previousXs.length !== 3) {
        expect(Math.abs(currentXs[0] - previousXs[0])).toBeCloseTo(42.5, 5)
      }
    }
  })

  it('すべて盤面内（半径ぶん含めて 0..BOARD_WIDTH / 0..ZONE_TOP の内側）にある', () => {
    for (const o of normalBoard.obstacles) {
      expect(o.x - o.radius).toBeGreaterThanOrEqual(0)
      expect(o.x + o.radius).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(o.y - o.radius).toBeGreaterThanOrEqual(0)
      expect(o.y + o.radius).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('障害物同士の中心距離に16px以上の余裕があり、ボールが詰まらない', () => {
    const obstacles = normalBoard.obstacles
    let minimumMargin = Number.POSITIVE_INFINITY
    for (let i = 0; i < obstacles.length; i += 1) {
      for (let j = i + 1; j < obstacles.length; j += 1) {
        const a = obstacles[i]
        const b = obstacles[j]
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        const required = a.radius + b.radius + BALL_RADIUS * 2 + REQUIRED_CLEARANCE_MARGIN
        minimumMargin = Math.min(
          minimumMargin,
          distance - (a.radius + b.radius + BALL_RADIUS * 2),
        )
        expect(distance).toBeGreaterThanOrEqual(required)
      }
    }
    expect(minimumMargin).toBeGreaterThanOrEqual(REQUIRED_CLEARANCE_MARGIN)
  })
})

describe('normalBoard.walls', () => {
  it('wall-bottom が存在する（底の壁がないとボールが盤外へ落ち続けてしまう）', () => {
    const bottom = normalBoard.walls.find((w) => w.id === 'wall-bottom')
    expect(bottom).toBeDefined()
  })
})

describe('normalBoard.toys', () => {
  it('おもちゃidが重複しない', () => {
    const ids = normalBoard.toys.map((toy) => toy.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ボール半径ぶんの余裕を持って盤面内にある', () => {
    for (const toy of normalBoard.toys) {
      expect(toy.x - toy.radius - BALL_RADIUS).toBeGreaterThanOrEqual(0)
      expect(toy.x + toy.radius + BALL_RADIUS).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(toy.y - toy.radius - BALL_RADIUS).toBeGreaterThanOrEqual(0)
      expect(toy.y + toy.radius + BALL_RADIUS).toBeLessThanOrEqual(BOARD_HEIGHT)
    }
  })

  it('障害物との中心距離にボール直径ぶんの余裕がある', () => {
    for (const toy of normalBoard.toys) {
      for (const obstacle of normalBoard.obstacles) {
        const distance = Math.hypot(toy.x - obstacle.x, toy.y - obstacle.y)
        const required = toy.radius + obstacle.radius + BALL_RADIUS * 2
        expect(distance).toBeGreaterThanOrEqual(required)
      }
    }
  })

  it('おもちゃ同士のタップ判定円が重ならない', () => {
    const toys = normalBoard.toys
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
    for (const toy of normalBoard.toys) {
      expect(toy.y + toy.radius).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('実機スケール0.7倍でもタップ判定の直径が44px以上ある', () => {
    for (const toy of normalBoard.toys) {
      expect(toy.tapRadius * 2 * PRACTICAL_MIN_SCALE).toBeGreaterThanOrEqual(MIN_TAP_DIAMETER_PX)
    }
  })

  describe('左右の回転Toy', () => {
    const spinners = normalBoard.toys.filter((toy) => toy.kind === 'spinner')

    it('左右2個の回転Toyが存在する', () => {
      expect(spinners).toHaveLength(2)
    })

    it('右Toyが左Toyの盤面中心に対する鏡写しの位置にある（yは共通）', () => {
      const left = spinners.find((toy) => toy.id === 'toy-spinner-left')
      const right = spinners.find((toy) => toy.id === 'toy-spinner-right')
      if (!left || !right) throw new Error('normalBoard test: 左右の回転Toyが見つかりません')

      expect(right.x).toBe(BOARD_WIDTH - left.x)
      expect(right.y).toBe(left.y)
      // 盤面中心から見て左右等距離であること（対称配置の直接的な確認）
      expect(Math.abs(left.x - BOARD_WIDTH / 2)).toBeCloseTo(Math.abs(right.x - BOARD_WIDTH / 2), 8)
    })

    it('左右で見た目・当たり判定のサイズに差がない（性能差を付けない）', () => {
      const [first, second] = spinners
      expect(second.radius).toBe(first.radius)
      expect(second.tapRadius).toBe(first.tapRadius)
    })

    it('idとラベルが左右で別々（スクリーンリーダー上も区別でき、idの重複もない）', () => {
      const ids = spinners.map((toy) => toy.id)
      const labels = spinners.map((toy) => toy.labelJa)
      expect(new Set(ids).size).toBe(2)
      expect(new Set(labels).size).toBe(2)
    })
  })
})
