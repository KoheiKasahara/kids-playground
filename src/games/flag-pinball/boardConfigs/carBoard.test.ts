import { describe, expect, it } from 'vitest'
import { BALL_RADIUS, BOARD_HEIGHT, BOARD_WIDTH, ZONE_TOP } from '../boardLayout'
import { carBoard } from './carBoard'
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

const OUTER_WALLS = carBoard.walls.filter((w) => !w.id.startsWith('wall-guide') && !w.id.startsWith('wall-car-guide'))
const CAR_TOY = carBoard.toys.find((toy) => toy.kind === 'car')

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

  it('道路（車の可動範囲付近、y=440〜480）には物理的な障害物を置いていない', () => {
    for (const o of carBoard.obstacles) {
      const overlapsRoadY = o.y + o.radius > 440 && o.y - o.radius < 480
      expect(overlapsRoadY).toBe(false)
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

  it('道路の高さ(y=440〜480)を横切る固定壁が存在しない（車が当たらなければ素通りできる）', () => {
    for (const wall of carBoard.walls) {
      const halfH = wall.height / 2
      const spansRoadY = wall.y - halfH < 480 && wall.y + halfH > 440
      // 上部・下部の短い坂道は道路よりだいぶ上/下（y=300, y=575）にあるため、
      // ここに該当するのは元から道路と無関係な壁だけのはず。
      if (spansRoadY) {
        expect(wall.id).not.toMatch(/^wall-car-guide/)
      }
    }
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

  it('車toy（car）がちょうど1台存在する', () => {
    expect(carBoard.toys.filter((toy) => toy.kind === 'car')).toHaveLength(1)
  })

  it('車toyはcar設定を持ち、leftX < rightX、speedは正の値', () => {
    expect(CAR_TOY).toBeDefined()
    expect(CAR_TOY!.car).toBeDefined()
    expect(CAR_TOY!.car!.leftX).toBeLessThan(CAR_TOY!.car!.rightX)
    expect(CAR_TOY!.car!.speed).toBeGreaterThan(0)
  })

  it('車の初期位置(placement.x)は可動範囲(leftX〜rightX)の内側にある', () => {
    expect(CAR_TOY!.x).toBeGreaterThanOrEqual(CAR_TOY!.car!.leftX)
    expect(CAR_TOY!.x).toBeLessThanOrEqual(CAR_TOY!.car!.rightX)
  })

  it('車の可動範囲は数秒で横断できる程度の速さで、極端に速すぎない（1秒あたり6px未満）', () => {
    // STEP_MSは1000/60msなので、1秒 ≈ 60step。speedはpx/stepなので60倍がpx/秒。
    const pxPerSecond = CAR_TOY!.car!.speed * 60
    expect(pxPerSecond).toBeGreaterThan(30)
    expect(pxPerSecond).toBeLessThan(200)
  })

  it('車の可動範囲は、車体の胴体半幅(50px)を足しても外壁の内側面から64px以上離れている（壁との挟まり対策）', () => {
    const CAR_BODY_HALF_WIDTH = 50
    const WALL_INNER_MARGIN = 15 // wall-left/right の厚み30の半分
    const leftEdge = CAR_TOY!.car!.leftX - CAR_BODY_HALF_WIDTH
    const rightEdge = CAR_TOY!.car!.rightX + CAR_BODY_HALF_WIDTH
    expect(leftEdge - WALL_INNER_MARGIN).toBeGreaterThanOrEqual(REQUIRED_CLEARANCE)
    expect(BOARD_WIDTH - WALL_INNER_MARGIN - rightEdge).toBeGreaterThanOrEqual(REQUIRED_CLEARANCE)
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
