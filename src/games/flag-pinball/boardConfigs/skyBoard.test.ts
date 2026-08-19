import { describe, expect, it } from 'vitest'
import { BALL_RADIUS, BOARD_HEIGHT, BOARD_WIDTH, ZONE_TOP } from '../boardLayout'
import { normalBoard } from './normalBoard'
import { skyBoard } from './skyBoard'

const REQUIRED_CLEARANCE_MARGIN = 16
const REQUIRED_CLEARANCE = BALL_RADIUS * 2 + REQUIRED_CLEARANCE_MARGIN
const PRACTICAL_MIN_SCALE = 0.7
const MIN_TAP_DIAMETER_PX = 44

type Point = { readonly x: number; readonly y: number }
type Wall = { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly angle: number }

function distanceToWallSurface(point: Point, wall: Wall): number {
  const dx = point.x - wall.x
  const dy = point.y - wall.y
  const cos = Math.cos(wall.angle)
  const sin = Math.sin(wall.angle)
  const localX = dx * cos + dy * sin
  const localY = -dx * sin + dy * cos
  const halfW = wall.width / 2
  const halfH = wall.height / 2
  const clampedX = Math.min(halfW, Math.max(-halfW, localX))
  const clampedY = Math.min(halfH, Math.max(-halfH, localY))
  return Math.hypot(localX - clampedX, localY - clampedY)
}

const OUTER_WALLS = skyBoard.walls.filter((w) => !w.id.startsWith('wall-guide'))
const CIRCULAR_TOYS = skyBoard.toys.filter((toy) => toy.kind !== 'wind')
const WIND_TOYS = skyBoard.toys.filter((toy) => toy.kind === 'wind')

/**
 * 空テーマ（skyBoard）専用の盤面ジオメトリを検証する。宇宙・海・おかし盤面のテストと
 * 同じ観点（盤面内に収まる・障害物同士が詰まらない・タップ判定が重ならない）に加え、
 * 風toyならではの観点（wind設定を持つこと・向きが偏りすぎないこと）を検証する。
 * 風toyは物理的な当たり判定Bodyを持たない透明なセンサーのため、シーソーと同じ理由で
 * 「円形のtoyと障害物の間にボール直径ぶんの余裕がある」検証の対象からは除外する。
 */
describe('skyBoard.obstacles', () => {
  it('通常盤面よりずっと少ない個数で、idに重複がない（空間の広さを優先する）', () => {
    expect(skyBoard.obstacles.length).toBeGreaterThanOrEqual(5)
    expect(skyBoard.obstacles.length).toBeLessThan(normalBoard.obstacles.length)
    const ids = skyBoard.obstacles.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('すべて盤面内（半径ぶん含めて 0..BOARD_WIDTH / 0..ZONE_TOP の内側）にある', () => {
    for (const o of skyBoard.obstacles) {
      expect(o.x - o.radius).toBeGreaterThanOrEqual(0)
      expect(o.x + o.radius).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(o.y - o.radius).toBeGreaterThanOrEqual(0)
      expect(o.y + o.radius).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('障害物同士の中心距離に16px以上の余裕があり、ボールが詰まらない', () => {
    const obstacles = skyBoard.obstacles
    let minimumMargin = Number.POSITIVE_INFINITY
    for (let i = 0; i < obstacles.length; i += 1) {
      for (let j = i + 1; j < obstacles.length; j += 1) {
        const a = obstacles[i]
        const b = obstacles[j]
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        const required = a.radius + b.radius + REQUIRED_CLEARANCE
        minimumMargin = Math.min(minimumMargin, distance - (a.radius + b.radius + BALL_RADIUS * 2))
        expect(distance).toBeGreaterThanOrEqual(required)
      }
    }
    expect(minimumMargin).toBeGreaterThanOrEqual(REQUIRED_CLEARANCE_MARGIN)
  })

  it('ゴール手前のピンは、静止したボールの下端がゾーン仕切りへ届かない高さに置かれている', () => {
    // y + radius + ボール直径 < ZONE_TOP を満たせば、このピンにボールが直接寄りかかって
    // 静止しても、ボールの下端がy=875から始まるゾーン仕切りへ届くことはない
    // （届くと仕切りとピンに同時接触して挟まる罠になる。海盤面で見つかったのと同種の問題）。
    for (const o of skyBoard.obstacles.filter((obstacle) => obstacle.id.startsWith('peg-sky-goal'))) {
      expect(o.y + o.radius + BALL_RADIUS * 2).toBeLessThan(ZONE_TOP)
    }
  })

  it('半径20px以上の障害物（雲バンパーなど）は外壁からもボール直径ぶん以上離れている（壁際の挟まりを防ぐ）', () => {
    for (const o of skyBoard.obstacles.filter((obstacle) => obstacle.radius >= 20)) {
      for (const wall of OUTER_WALLS) {
        const clearance = distanceToWallSurface(o, wall) - o.radius
        expect(clearance).toBeGreaterThanOrEqual(REQUIRED_CLEARANCE)
      }
    }
  })
})

describe('skyBoard.walls', () => {
  it('wall-bottom が存在する', () => {
    expect(skyBoard.walls.find((w) => w.id === 'wall-bottom')).toBeDefined()
  })

  it('外壁・上壁・射出ガイド壁は通常盤面と同じ形状（安定動作が確認済みの形状を変更しない）', () => {
    const sharedIds = ['wall-left', 'wall-right', 'wall-top', 'wall-guide-left', 'wall-guide-right', 'wall-bottom']
    for (const id of sharedIds) {
      const skyWall = skyBoard.walls.find((w) => w.id === id)
      const normalWall = normalBoard.walls.find((w) => w.id === id)
      expect(skyWall).toEqual(normalWall)
    }
  })
})

describe('skyBoard.cornerEscapeZones', () => {
  it('通常盤面と同じ外壁・射出ガイド壁を使うため、すり抜けゾーンも同じ座標を持つ', () => {
    expect(skyBoard.cornerEscapeZones).toEqual(normalBoard.cornerEscapeZones)
  })
})

describe('skyBoard.toys', () => {
  it('おもちゃidが重複しない', () => {
    const ids = skyBoard.toys.map((toy) => toy.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('風toy（wind）が2個以上、回転（spinner、プロペラ）が1個存在する', () => {
    expect(skyBoard.toys.filter((toy) => toy.kind === 'wind').length).toBeGreaterThanOrEqual(2)
    expect(skyBoard.toys.filter((toy) => toy.kind === 'spinner')).toHaveLength(1)
  })

  it('風toyは通常・宇宙・海・おかし盤面には存在しない（空テーマ専用）', () => {
    expect(normalBoard.toys.some((toy) => toy.kind === 'wind')).toBe(false)
  })

  it('すべての風toyがwind設定を持ち、halfWidth・halfHeightが正の値になっている', () => {
    for (const toy of WIND_TOYS) {
      expect(toy.wind).toBeDefined()
      expect(toy.wind!.halfWidth).toBeGreaterThan(0)
      expect(toy.wind!.halfHeight).toBeGreaterThan(0)
    }
  })

  it('風toyの向きがすべて同じにはなっていない（一方向へ固定しない）', () => {
    const directions = new Set(WIND_TOYS.map((toy) => toy.wind!.directionX))
    expect(directions.size).toBeGreaterThanOrEqual(2)
  })

  it('風の横方向の目標速度は、盤面の最大速度よりずっと弱い（強すぎる風にしない）', () => {
    // MAX_SPEED(24px/step)よりずっと弱く、「気づくと少し横へ流されている」程度に留める上限チェック。
    const WEAK_WIND_UPPER_BOUND = 6
    for (const toy of WIND_TOYS) {
      const speed = toy.wind!.horizontalTargetSpeed ?? 3.2
      expect(speed).toBeLessThanOrEqual(WEAK_WIND_UPPER_BOUND)
    }
  })

  it('上向き成分を持つ風があっても、重力を打ち消すほど強くはない', () => {
    for (const toy of WIND_TOYS) {
      const upward = toy.wind!.upwardTargetVy
      if (upward === undefined) continue
      expect(upward).toBeLessThan(0)
      expect(upward).toBeGreaterThan(-2)
    }
  })

  it('ボール半径ぶんの余裕を持って盤面内にある', () => {
    for (const toy of skyBoard.toys) {
      expect(toy.x - toy.radius - BALL_RADIUS).toBeGreaterThanOrEqual(0)
      expect(toy.x + toy.radius + BALL_RADIUS).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(toy.y - toy.radius - BALL_RADIUS).toBeGreaterThanOrEqual(0)
      expect(toy.y + toy.radius + BALL_RADIUS).toBeLessThanOrEqual(BOARD_HEIGHT)
    }
  })

  it('円形のtoy（プロペラ）は障害物との中心距離にボール直径ぶんの余裕がある', () => {
    for (const toy of CIRCULAR_TOYS) {
      for (const obstacle of skyBoard.obstacles) {
        const distance = Math.hypot(toy.x - obstacle.x, toy.y - obstacle.y)
        const required = toy.radius + obstacle.radius + BALL_RADIUS * 2
        expect(distance).toBeGreaterThanOrEqual(required)
      }
    }
  })

  it('おもちゃ同士のタップ判定円が重ならない', () => {
    const toys = skyBoard.toys
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
    for (const toy of skyBoard.toys) {
      expect(toy.y + toy.radius).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('風エリア（wind.halfHeight含む）も得点ゾーン領域へは入っていない', () => {
    for (const toy of WIND_TOYS) {
      expect(toy.y + toy.wind!.halfHeight).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('実機スケール0.7倍でもタップ判定の直径が44px以上ある', () => {
    for (const toy of skyBoard.toys) {
      expect(toy.tapRadius * 2 * PRACTICAL_MIN_SCALE).toBeGreaterThanOrEqual(MIN_TAP_DIAMETER_PX)
    }
  })
})

describe('skyBoard.launch', () => {
  it('射出口は通常盤面と同じx中心・y・初速レンジを使う（空テーマらしさは盤面配置だけで作るため）', () => {
    expect(skyBoard.launch).toEqual(normalBoard.launch)
  })
})
