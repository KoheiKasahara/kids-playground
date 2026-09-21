import { describe, expect, test } from 'vitest'
import { GOLF_COURSES, type HoleDefinition } from './golfCourses'
import { buildHoleGeometry, insideOutline, roundOutline, signedArea } from './golfGeometry'
import { BALL_RADIUS, BIG_CUP_RADIUS, CUP_RADIUS } from './golfPhysics'

const HOLES = GOLF_COURSES.flatMap(course => course.holes)

function triangleArea(positions: Float32Array, indices: Uint32Array): { area: number; minNormalY: number } {
  let area = 0
  let minNormalY = 1
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i]!, indices[i + 1]!, indices[i + 2]!].map(index => [positions[index * 3]!, positions[index * 3 + 1]!, positions[index * 3 + 2]!])
    const u = [b![0]! - a![0]!, b![1]! - a![1]!, b![2]! - a![2]!]
    const v = [c![0]! - a![0]!, c![1]! - a![1]!, c![2]! - a![2]!]
    const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!]
    const length = Math.hypot(n[0]!, n[1]!, n[2]!)
    area += Math.hypot(n[0]!, n[2]!) === 0 ? length / 2 : Math.abs(n[1]!) / 2
    minNormalY = Math.min(minNormalY, n[1]! / length)
  }
  return { area, minNormalY }
}

describe('角を丸めた外周', () => {
  test('どの向きで書いても面積が正になり、ジャンプの切れ目だけ壁がない', () => {
    const hole = HOLES.find(item => item.id === 'beach-2')!
    for (const piece of hole.floors) {
      const outline = roundOutline(piece)
      expect(signedArea(outline.points)).toBeGreaterThan(0)
      const open = outline.walled.filter(walled => !walled).length
      expect(open).toBe(1)
      // 切れ目の辺は角を丸めない。コースの幅いっぱいが開いている。
      const index = outline.walled.indexOf(false)
      const a = outline.points[index]!
      const b = outline.points[(index + 1) % outline.points.length]!
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(1.9)
    }
  })
  test('外向きの法線は多角形の外を向く', () => {
    const outline = roundOutline({ corners: [{ x: 0, z: 0 }, { x: 0, z: 2 }, { x: 2, z: 2 }, { x: 2, z: 0 }] })
    outline.points.forEach((point, index) => {
      const next = outline.points[(index + 1) % outline.points.length]!
      const length = Math.hypot(next.x - point.x, next.z - point.z)
      const mid = { x: (point.x + next.x) / 2 + ((next.z - point.z) / length) * 0.1, z: (point.z + next.z) / 2 - ((next.x - point.x) / length) * 0.1 }
      expect(insideOutline(mid.x, mid.z, outline.points)).toBe(false)
    })
  })
})

describe.each(HOLES.map(hole => [hole.id, hole] as [string, HoleDefinition]))('%s の床', (_, hole) => {
  const geometry = buildHoleGeometry(hole)
  test('床は外周の面積からカップの穴を引いた広さで、すべて上を向く', () => {
    const expected = geometry.outlines.reduce((sum, outline) => sum + signedArea(outline.points), 0) - Math.PI * CUP_RADIUS ** 2
    const { area, minNormalY } = triangleArea(geometry.floor.positions, geometry.floor.indices)
    // 坂のぶん実際の面積は少し広い。上から見た面積で比べる。
    expect(area).toBeGreaterThan(expected * 0.985)
    expect(area).toBeLessThan(expected * 1.015)
    expect(minNormalY).toBeGreaterThan(0.2)
  })
  test('カップの穴の縁はちょうど円く、縁の高さは平ら', () => {
    const { positions } = geometry.floor
    const rim: number[] = []
    for (let i = 0; i < positions.length; i += 3) {
      const d = Math.hypot(positions[i]! - hole.cup.x, positions[i + 2]! - hole.cup.z)
      expect(d).toBeGreaterThan(CUP_RADIUS - 1e-4)
      if (d < CUP_RADIUS + 1e-4) rim.push(positions[i + 1]!)
    }
    expect(rim.length).toBe(48)
    expect(Math.max(...rim) - Math.min(...rim)).toBeLessThan(1e-6)
    expect(rim[0]).toBeCloseTo(geometry.cup.y, 6)
  })
  test('ティーとカップのまわりは平らで、カップは壁から離れている', () => {
    for (const point of [hole.tee, hole.cup]) {
      const center = geometry.heightAt(point.x, point.z)!
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
        const around = geometry.heightAt(point.x + Math.cos(angle) * 0.4, point.z + Math.sin(angle) * 0.4)
        expect(around).not.toBeNull()
        expect(Math.abs(around! - center)).toBeLessThan(0.004)
      }
    }
    for (const outline of geometry.outlines) {
      if (!insideOutline(hole.cup.x, hole.cup.z, outline.points)) continue
      for (const point of outline.points) expect(Math.hypot(point.x - hole.cup.x, point.z - hole.cup.z)).toBeGreaterThan(BIG_CUP_RADIUS + 0.35)
    }
  })
  test('壁の箱は外周の外側にあり、ボールが通れるすき間を残さない', () => {
    for (const wall of geometry.walls) {
      // 床が2まい以上あるホールもあるので、外周ごとに見る（点をつなげて1つの多角形にはできない）。
      for (const outline of geometry.outlines) expect(insideOutline(wall.x, wall.z, outline.points)).toBe(false)
      expect(wall.hy * 2).toBeGreaterThan(0.3)
    }
    for (const outline of geometry.outlines) {
      const xs = outline.points.map(point => point.x)
      const zs = outline.points.map(point => point.z)
      // 外周は、そのホールの大きさに収まるまっすぐな線分でつながる（長いホールでは壁も長い）。
      const span = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs))
      outline.points.forEach((point, index) => {
        const next = outline.points[(index + 1) % outline.points.length]!
        if (outline.walled[index]) expect(Math.hypot(next.x - point.x, next.z - point.z)).toBeLessThanOrEqual(span)
        expect(Math.hypot(next.x - point.x, next.z - point.z)).toBeGreaterThan(BALL_RADIUS * 0.01)
      })
    }
  })
})

test('おおきい カップを選ぶと穴が広がる', () => {
  const hole = HOLES[0]!
  const geometry = buildHoleGeometry(hole, BIG_CUP_RADIUS)
  expect(geometry.cup.radius).toBe(BIG_CUP_RADIUS)
  const { positions } = geometry.floor
  for (let i = 0; i < positions.length; i += 3) {
    expect(Math.hypot(positions[i]! - hole.cup.x, positions[i + 2]! - hole.cup.z)).toBeGreaterThan(BIG_CUP_RADIUS - 1e-4)
  }
})

test('さかは from から to まで下がり、その先はずっと下がったまま', () => {
  const hole = HOLES.find(item => item.id === 'downhill-1')!
  const geometry = buildHoleGeometry(hole)
  // さかの手前は 平ら。
  expect(geometry.heightAt(0, 4.6)).toBeCloseTo(0, 5)
  // さかの とちゅうは その あいだの 高さ。
  expect(geometry.heightAt(0, 3.8)).toBeLessThan(-0.1)
  expect(geometry.heightAt(0, 3.8)).toBeGreaterThan(-0.4)
  // さかを おりきったら、その先は ずっと 同じ 高さ。
  expect(geometry.heightAt(0, 3.0)).toBeCloseTo(-0.5, 5)
  expect(geometry.heightAt(0, 0)).toBeCloseTo(-0.5, 5)
  // ふたつめの さかの あとは、ふたつぶん 下がっている。
  expect(geometry.heightAt(0, -3.0)).toBeCloseTo(-0.95, 5)
})

test('台は、坂で下がった床よりも下まである', () => {
  for (const hole of HOLES) {
    const geometry = buildHoleGeometry(hole)
    let floorLow = Infinity
    for (let i = 1; i < geometry.floor.positions.length; i += 3) floorLow = Math.min(floorLow, geometry.floor.positions[i]!)
    let wallLow = Infinity
    for (let i = 1; i < geometry.wallBody.positions.length; i += 3) wallLow = Math.min(wallLow, geometry.wallBody.positions[i]!)
    expect(wallLow, hole.id).toBeLessThan(floorLow)
  }
})

test('ジャンプ台は切れ目に向かって上がり、向こう岸は持ち上げない', () => {
  const hole = HOLES.find(item => item.id === 'beach-2')!
  const geometry = buildHoleGeometry(hole)
  expect(geometry.heightAt(0, 1.02)).toBeGreaterThan(0.28)
  expect(geometry.heightAt(0, 1.5)).toBeCloseTo(0.15, 2)
  expect(geometry.heightAt(0, 2.6)).toBeCloseTo(0, 5)
  expect(geometry.heightAt(0, -1.3)).toBeCloseTo(-0.3, 5)
  expect(geometry.heightAt(0, 0.4)).toBeNull()
})
