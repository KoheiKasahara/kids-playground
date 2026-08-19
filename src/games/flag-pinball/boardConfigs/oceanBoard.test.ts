import { describe, expect, it } from 'vitest'
import { BALL_RADIUS, BOARD_HEIGHT, BOARD_WIDTH, ZONE_TOP } from '../boardLayout'
import { normalBoard } from './normalBoard'
import { oceanBoard } from './oceanBoard'

const REQUIRED_CLEARANCE_MARGIN = 16
const REQUIRED_CLEARANCE = BALL_RADIUS * 2 + REQUIRED_CLEARANCE_MARGIN
const PRACTICAL_MIN_SCALE = 0.7
const MIN_TAP_DIAMETER_PX = 44

type Point = { readonly x: number; readonly y: number }
type Wall = { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly angle: number }

function closestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const lenSq = abx * abx + aby * aby
  if (lenSq === 0) return a
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq))
  return { x: a.x + t * abx, y: a.y + t * aby }
}

/** 2つの線分の最短距離。両端点から相手の線分への垂線の足の総当たりで求める標準的な方法。 */
function segmentToSegmentDistance(a1: Point, a2: Point, b1: Point, b2: Point): number {
  const candidates = [
    [a1, closestPointOnSegment(a1, b1, b2)],
    [a2, closestPointOnSegment(a2, b1, b2)],
    [b1, closestPointOnSegment(b1, a1, a2)],
    [b2, closestPointOnSegment(b2, a1, a2)],
  ] as const
  return Math.min(...candidates.map(([p, q]) => Math.hypot(p.x - q.x, p.y - q.y)))
}

function wallEndpoints(wall: Wall): [Point, Point] {
  const half = wall.width / 2
  const dx = half * Math.cos(wall.angle)
  const dy = half * Math.sin(wall.angle)
  return [
    { x: wall.x - dx, y: wall.y - dy },
    { x: wall.x + dx, y: wall.y + dy },
  ]
}

/** 円の中心から壁面（回転する矩形）までの最短距離。壁の厚みぶんはこの中で考慮済み。 */
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

const RAMP_IDS = oceanBoard.walls.filter((w) => w.id.startsWith('wall-ocean-ramp')).map((w) => w.id)
const RAMPS = oceanBoard.walls.filter((w) => RAMP_IDS.includes(w.id))
const OUTER_WALLS = oceanBoard.walls.filter((w) => !w.id.startsWith('wall-ocean-ramp') && !w.id.startsWith('wall-guide'))
const RAMP_HALF_THICKNESS = 8 // RAMP_THICKNESS(16)/2。oceanBoard.ts の定数と揃える。

describe('oceanBoard.obstacles', () => {
  it('通常盤面よりずっと少ない個数で、idに重複がない（障害物を増やしすぎない）', () => {
    expect(oceanBoard.obstacles.length).toBeGreaterThanOrEqual(5)
    expect(oceanBoard.obstacles.length).toBeLessThan(normalBoard.obstacles.length)
    const ids = oceanBoard.obstacles.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('すべて盤面内（半径ぶん含めて 0..BOARD_WIDTH / 0..ZONE_TOP の内側）にある', () => {
    for (const o of oceanBoard.obstacles) {
      expect(o.x - o.radius).toBeGreaterThanOrEqual(0)
      expect(o.x + o.radius).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(o.y - o.radius).toBeGreaterThanOrEqual(0)
      expect(o.y + o.radius).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('ゴール手前のピンは、静止したボールの下端がゾーン仕切りへ届かない高さに置かれている', () => {
    // y + radius + ボール直径 < ZONE_TOP を満たせば、このピンにボールが直接寄りかかって
    // 静止しても、ボールの下端がy=875から始まるゾーン仕切りへ届くことはない
    // （届くと仕切りとピンに同時接触して挟まる罠になることが実機シミュレーションで分かった）。
    for (const o of oceanBoard.obstacles.filter((obstacle) => obstacle.id.startsWith('peg-ocean-goal'))) {
      expect(o.y + o.radius + BALL_RADIUS * 2).toBeLessThan(ZONE_TOP)
    }
  })

  it('障害物同士の中心距離に16px以上の余裕があり、ボールが詰まらない', () => {
    const obstacles = oceanBoard.obstacles
    for (let i = 0; i < obstacles.length; i += 1) {
      for (let j = i + 1; j < obstacles.length; j += 1) {
        const a = obstacles[i]
        const b = obstacles[j]
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        const required = a.radius + b.radius + REQUIRED_CLEARANCE
        expect(distance).toBeGreaterThanOrEqual(required)
      }
    }
  })

  it('半径20px以上の障害物は外壁からもボール直径ぶん以上離れている（壁際の挟まりを防ぐ）', () => {
    for (const o of oceanBoard.obstacles.filter((obstacle) => obstacle.radius >= 20)) {
      for (const wall of OUTER_WALLS) {
        const clearance = distanceToWallSurface(o, wall) - o.radius
        expect(clearance).toBeGreaterThanOrEqual(REQUIRED_CLEARANCE)
      }
    }
  })

  it('障害物は斜めガイド壁からもボール直径ぶん以上離れている', () => {
    for (const o of oceanBoard.obstacles) {
      for (const ramp of RAMPS) {
        const clearance = distanceToWallSurface(o, ramp) - o.radius
        expect(clearance).toBeGreaterThanOrEqual(REQUIRED_CLEARANCE)
      }
    }
  })
})

describe('oceanBoard.walls', () => {
  it('wall-bottom が存在する', () => {
    expect(oceanBoard.walls.find((w) => w.id === 'wall-bottom')).toBeDefined()
  })

  it('外壁・上壁・射出ガイド壁は通常盤面と同じ形状（安定動作が確認済みの形状を変更しない）', () => {
    const sharedIds = ['wall-left', 'wall-right', 'wall-top', 'wall-guide-left', 'wall-guide-right', 'wall-bottom']
    for (const id of sharedIds) {
      const oceanWall = oceanBoard.walls.find((w) => w.id === id)
      const normalWall = normalBoard.walls.find((w) => w.id === id)
      expect(oceanWall).toEqual(normalWall)
    }
  })

  it('海専用の斜めガイド壁が4枚あり、通常盤面にはない', () => {
    expect(RAMPS).toHaveLength(4)
    expect(normalBoard.walls.some((w) => w.id.startsWith('wall-ocean-ramp'))).toBe(false)
  })

  it('斜めガイド壁は互いにボール直径ぶん以上の間隔があり、挟まりの罠を作らない（線分同士の実距離で検証）', () => {
    for (let i = 0; i < RAMPS.length; i += 1) {
      for (let j = i + 1; j < RAMPS.length; j += 1) {
        const [a1, a2] = wallEndpoints(RAMPS[i])
        const [b1, b2] = wallEndpoints(RAMPS[j])
        const centerDistance = segmentToSegmentDistance(a1, a2, b1, b2)
        const clearance = centerDistance - RAMP_HALF_THICKNESS * 2
        expect(clearance).toBeGreaterThanOrEqual(REQUIRED_CLEARANCE)
      }
    }
  })

  it('斜めガイド壁の端点は外壁からもボール直径ぶん以上離れている（壁の端と外壁が作る隅の罠を防ぐ）', () => {
    for (const ramp of RAMPS) {
      for (const endpoint of wallEndpoints(ramp)) {
        for (const wall of OUTER_WALLS) {
          const clearance = distanceToWallSurface(endpoint, wall) - RAMP_HALF_THICKNESS
          expect(clearance).toBeGreaterThanOrEqual(REQUIRED_CLEARANCE)
        }
      }
    }
  })
})

describe('oceanBoard.cornerEscapeZones', () => {
  it('通常盤面と同じ外壁・射出ガイド壁を使うため、すり抜けゾーンも同じ座標を持つ', () => {
    expect(oceanBoard.cornerEscapeZones).toEqual(normalBoard.cornerEscapeZones)
  })
})

describe('oceanBoard.toys', () => {
  it('おもちゃidが重複しない', () => {
    const ids = oceanBoard.toys.map((toy) => toy.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('シーソー（seesaw）が1個存在する', () => {
    expect(oceanBoard.toys.filter((toy) => toy.kind === 'seesaw')).toHaveLength(1)
  })

  it('シーソーは通常・宇宙盤面には存在しない（海テーマ専用）', () => {
    expect(normalBoard.toys.some((toy) => toy.kind === 'seesaw')).toBe(false)
  })

  it('潮流toy（launcher、launcherTide付き）が2個、左右逆向きで存在する', () => {
    const tideToys = oceanBoard.toys.filter((toy) => toy.kind === 'launcher' && toy.launcherTide !== undefined)
    expect(tideToys).toHaveLength(2)
    const directions = tideToys.map((toy) => toy.launcherTide!.biasDirection).sort()
    expect(directions).toEqual([-1, 1])
  })

  it('ボール半径ぶんの余裕を持って盤面内にある', () => {
    for (const toy of oceanBoard.toys) {
      expect(toy.x - toy.radius - BALL_RADIUS).toBeGreaterThanOrEqual(0)
      expect(toy.x + toy.radius + BALL_RADIUS).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(toy.y - toy.radius - BALL_RADIUS).toBeGreaterThanOrEqual(0)
      expect(toy.y + toy.radius + BALL_RADIUS).toBeLessThanOrEqual(BOARD_HEIGHT)
    }
  })

  it('円形のtoy（seesaw以外）は障害物との中心距離にボール直径ぶんの余裕がある', () => {
    for (const toy of oceanBoard.toys.filter((t) => t.kind !== 'seesaw')) {
      for (const obstacle of oceanBoard.obstacles) {
        const distance = Math.hypot(toy.x - obstacle.x, toy.y - obstacle.y)
        const required = toy.radius + obstacle.radius + BALL_RADIUS * 2
        expect(distance).toBeGreaterThanOrEqual(required)
      }
    }
  })

  it('円形のtoy（seesaw以外）は斜めガイド壁からもボール直径ぶん以上離れている', () => {
    for (const toy of oceanBoard.toys.filter((t) => t.kind !== 'seesaw')) {
      for (const ramp of RAMPS) {
        const clearance = distanceToWallSurface(toy, ramp) - toy.radius
        expect(clearance).toBeGreaterThanOrEqual(REQUIRED_CLEARANCE)
      }
    }
  })

  it('半径20px以上のtoy（潮流toyなど）は外壁からもボール直径ぶん以上離れている', () => {
    for (const toy of oceanBoard.toys.filter((t) => t.kind !== 'seesaw' && t.radius >= 14)) {
      for (const wall of OUTER_WALLS) {
        const clearance = distanceToWallSurface(toy, wall) - toy.radius
        expect(clearance).toBeGreaterThanOrEqual(REQUIRED_CLEARANCE)
      }
    }
  })

  it('シーソー（横長の板）は、最大傾斜時の見た目の広がりを含めても斜めガイド壁と十分離れている', () => {
    const seesaw = oceanBoard.toys.find((t) => t.kind === 'seesaw')
    if (!seesaw) throw new Error('oceanBoard test: シーソーが見つかりません')
    // 実装（seesawToy.ts）の定数と揃えた近似値。板の全長ぶんの線分として扱い、
    // 最大傾斜角ぶんの垂直方向の広がり（半厚み＋半長×sin(最大角)）を厚みとみなす。
    const plankThickness = 22
    const maxAngle = 0.32
    const seesawHalfThickness = (plankThickness / 2) * Math.cos(maxAngle) + seesaw.radius * Math.sin(maxAngle)
    const s1: Point = { x: seesaw.x - seesaw.radius, y: seesaw.y }
    const s2: Point = { x: seesaw.x + seesaw.radius, y: seesaw.y }
    for (const ramp of RAMPS) {
      const [r1, r2] = wallEndpoints(ramp)
      const centerDistance = segmentToSegmentDistance(s1, s2, r1, r2)
      const clearance = centerDistance - seesawHalfThickness - RAMP_HALF_THICKNESS
      expect(clearance).toBeGreaterThanOrEqual(REQUIRED_CLEARANCE)
    }
  })

  it('おもちゃ同士のタップ判定円が重ならない', () => {
    const toys = oceanBoard.toys
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
    for (const toy of oceanBoard.toys) {
      expect(toy.y + toy.radius).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('実機スケール0.7倍でもタップ判定の直径が44px以上ある', () => {
    for (const toy of oceanBoard.toys) {
      expect(toy.tapRadius * 2 * PRACTICAL_MIN_SCALE).toBeGreaterThanOrEqual(MIN_TAP_DIAMETER_PX)
    }
  })
})

describe('oceanBoard.launch', () => {
  it('射出口は通常盤面と同じx中心・y・初速レンジを使う（横方向の違いは盤面配置だけで作るため）', () => {
    expect(oceanBoard.launch).toEqual(normalBoard.launch)
  })
})
