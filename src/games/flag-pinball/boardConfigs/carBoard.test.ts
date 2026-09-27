import { describe, expect, it } from 'vitest'
import { BALL_RADIUS, BOARD_HEIGHT, BOARD_WIDTH, ZONE_TOP } from '../boardLayout'
import { CAR_ROAD_YS, carBoard } from './carBoard'
import { normalBoard } from './normalBoard'

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

const OUTER_WALLS = carBoard.walls.filter((w) => !w.id.startsWith('wall-guide'))
const CAR_TOYS = carBoard.toys.filter((toy) => toy.kind === 'car')
/** carToy.tsの複合Colliderの外形（胴体の半幅・中心yからの上端/下端）。 */
const CAR_BODY_HALF_WIDTH = 50
const CAR_COLLIDER_TOP_OFFSET = -16 - 22 // 円形キャビンの上端
const CAR_COLLIDER_BOTTOM_OFFSET = 8 + 17 // 胴体の下端
/** 動く車と固定物の間を、ボールが押しつぶされずに通り抜けられる最小の縦の隙間。 */
const CAR_VERTICAL_CLEARANCE = BALL_RADIUS * 2 + 8

describe('carBoard.obstacles', () => {
  it('通常盤面よりずっと少ない個数で、idに重複がない（車toyとの遭遇そのものを主役にする）', () => {
    expect(carBoard.obstacles.length).toBeGreaterThanOrEqual(5)
    expect(carBoard.obstacles.length).toBeLessThan(normalBoard.obstacles.length)
    const ids = carBoard.obstacles.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('すべて盤面内（半径ぶん含めて 0..BOARD_WIDTH / 0..ZONE_TOP の内側）にある', () => {
    for (const o of carBoard.obstacles) {
      expect(o.x - o.radius).toBeGreaterThanOrEqual(0)
      expect(o.x + o.radius).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(o.y - o.radius).toBeGreaterThanOrEqual(0)
      expect(o.y + o.radius).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('障害物同士の中心距離に16px以上の余裕があり、ボールが詰まらない', () => {
    const obstacles = carBoard.obstacles
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
    for (const o of carBoard.obstacles.filter((obstacle) => obstacle.id.startsWith('peg-car-goal'))) {
      expect(o.y + o.radius + BALL_RADIUS * 2).toBeLessThan(ZONE_TOP)
    }
  })

  it('半径15px以上の障害物は外壁からもボール直径ぶん以上離れている（壁際の挟まりを防ぐ）', () => {
    for (const o of carBoard.obstacles.filter((obstacle) => obstacle.radius >= 15)) {
      for (const wall of OUTER_WALLS) {
        const clearance = distanceToWallSurface(o, wall) - o.radius
        expect(clearance).toBeGreaterThanOrEqual(REQUIRED_CLEARANCE)
      }
    }
  })

  it('車の通り道（可動範囲の横幅）にある障害物は、車のColliderから上下にボール直径＋8px以上離れている', () => {
    for (const car of CAR_TOYS) {
      const sweepLeft = car.car!.leftX - CAR_BODY_HALF_WIDTH - BALL_RADIUS
      const sweepRight = car.car!.rightX + CAR_BODY_HALF_WIDTH + BALL_RADIUS
      const colliderTop = car.y + CAR_COLLIDER_TOP_OFFSET
      const colliderBottom = car.y + CAR_COLLIDER_BOTTOM_OFFSET
      for (const o of carBoard.obstacles) {
        if (o.x + o.radius < sweepLeft || o.x - o.radius > sweepRight) continue
        const gap = o.y < car.y ? colliderTop - (o.y + o.radius) : o.y - o.radius - colliderBottom
        expect(gap, `${o.id} と ${car.id}`).toBeGreaterThanOrEqual(CAR_VERTICAL_CLEARANCE)
      }
    }
  })
})

describe('carBoard.walls', () => {
  it('wall-bottom が存在する', () => {
    expect(carBoard.walls.find((w) => w.id === 'wall-bottom')).toBeDefined()
  })

  it('外壁・上壁・射出ガイド壁は通常盤面と同じ形状（安定動作が確認済みの形状を変更しない）', () => {
    const sharedIds = ['wall-left', 'wall-right', 'wall-top', 'wall-guide-left', 'wall-guide-right', 'wall-bottom']
    for (const id of sharedIds) {
      const carWall = carBoard.walls.find((w) => w.id === id)
      const normalWall = normalBoard.walls.find((w) => w.id === id)
      expect(carWall).toEqual(normalWall)
    }
  })

  it('外壁と射出ガイド壁のほかに固定壁を置かない（道路の間で車と壁にボールが挟まらない）', () => {
    expect(carBoard.walls.map((w) => w.id).sort()).toEqual(
      ['wall-bottom', 'wall-guide-left', 'wall-guide-right', 'wall-left', 'wall-right', 'wall-top'],
    )
  })
})

describe('carBoard.cornerEscapeZones', () => {
  it('通常盤面と同じ外壁・射出ガイド壁を使うため、すり抜けゾーンも同じ座標を持つ', () => {
    expect(carBoard.cornerEscapeZones).toEqual(normalBoard.cornerEscapeZones)
  })
})

describe('carBoard.toys', () => {
  it('おもちゃidが重複しない', () => {
    const ids = carBoard.toys.map((toy) => toy.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('車toy（car）が3台あり、3本の道路に1台ずつ走る', () => {
    expect(CAR_TOYS).toHaveLength(3)
    expect(CAR_TOYS.map((toy) => toy.y)).toEqual([...CAR_ROAD_YS])
  })

  it('3台は車種がすべて違う', () => {
    const variants = CAR_TOYS.map((toy) => toy.car?.variant)
    expect(variants.every((variant) => variant !== undefined)).toBe(true)
    expect(new Set(variants).size).toBe(3)
  })

  it('隣り合う道路の車のColliderどうしは、上下にボール直径＋8px以上離れている', () => {
    for (let i = 1; i < CAR_TOYS.length; i += 1) {
      const upperBottom = CAR_TOYS[i - 1].y + CAR_COLLIDER_BOTTOM_OFFSET
      const lowerTop = CAR_TOYS[i].y + CAR_COLLIDER_TOP_OFFSET
      expect(lowerTop - upperBottom).toBeGreaterThanOrEqual(CAR_VERTICAL_CLEARANCE)
    }
  })

  it('各車toyはcar設定を持ち、leftX < rightX、speedは正の値', () => {
    for (const toy of CAR_TOYS) {
      expect(toy.car).toBeDefined()
      expect(toy.car!.leftX).toBeLessThan(toy.car!.rightX)
      expect(toy.car!.speed).toBeGreaterThan(0)
    }
  })

  it('車の初期位置(placement.x)は可動範囲(leftX〜rightX)の内側にある', () => {
    for (const toy of CAR_TOYS) {
      expect(toy.x).toBeGreaterThanOrEqual(toy.car!.leftX)
      expect(toy.x).toBeLessThanOrEqual(toy.car!.rightX)
    }
  })

  it('3台は速さがそろっておらず、上下の車が同じ動きにならない', () => {
    expect(new Set(CAR_TOYS.map((toy) => toy.car!.speed)).size).toBe(3)
  })

  it('車の可動範囲は数秒で横断できる程度の速さで、極端に速すぎない', () => {
    // STEP_MSは1000/60msなので、1秒 ≈ 60step。speedはpx/stepなので60倍がpx/秒。
    for (const toy of CAR_TOYS) {
      const pxPerSecond = toy.car!.speed * 60
      expect(pxPerSecond).toBeGreaterThan(30)
      expect(pxPerSecond).toBeLessThan(200)
    }
  })

  it('車の可動範囲は、車体の胴体半幅(50px)を足しても外壁の内側面から64px以上離れている（壁との挟まり対策）', () => {
    const WALL_INNER_MARGIN = 15 // wall-left/right の厚み30の半分
    for (const toy of CAR_TOYS) {
      const leftEdge = toy.car!.leftX - CAR_BODY_HALF_WIDTH
      const rightEdge = toy.car!.rightX + CAR_BODY_HALF_WIDTH
      expect(leftEdge - WALL_INNER_MARGIN).toBeGreaterThanOrEqual(REQUIRED_CLEARANCE)
      expect(BOARD_WIDTH - WALL_INNER_MARGIN - rightEdge).toBeGreaterThanOrEqual(REQUIRED_CLEARANCE)
    }
  })

  it('ボール半径ぶんの余裕を持って盤面内にある', () => {
    for (const toy of carBoard.toys) {
      expect(toy.x - toy.radius - BALL_RADIUS).toBeGreaterThanOrEqual(-1e-6)
      expect(toy.x + toy.radius + BALL_RADIUS).toBeLessThanOrEqual(BOARD_WIDTH + 1e-6)
      expect(toy.y - toy.radius - BALL_RADIUS).toBeGreaterThanOrEqual(0)
      expect(toy.y + toy.radius + BALL_RADIUS).toBeLessThanOrEqual(BOARD_HEIGHT)
    }
  })

  it('得点ゾーン領域に入っていない', () => {
    for (const toy of carBoard.toys) {
      expect(toy.y + toy.radius).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('実機スケール0.7倍でもタップ判定の直径が44px以上ある', () => {
    for (const toy of carBoard.toys) {
      expect(toy.tapRadius * 2 * PRACTICAL_MIN_SCALE).toBeGreaterThanOrEqual(MIN_TAP_DIAMETER_PX)
    }
  })
})

describe('carBoard.launch', () => {
  it('射出口は通常盤面と同じx中心・y・初速レンジを使う（くるまテーマらしさは盤面配置だけで作るため）', () => {
    expect(carBoard.launch).toEqual(normalBoard.launch)
  })
})
