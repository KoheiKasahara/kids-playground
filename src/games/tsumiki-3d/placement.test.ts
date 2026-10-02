import { describe, expect, it } from 'vitest'
import { BLOCK_COLORS, BLOCK_SHAPES, AUTO_COLOR, footprint, resolveColor } from './blocks'
import { GRID, goalsReached, HEIGHT_GOALS, heightInCm, MAT_RADIUS, nextGoal, snapPlacement } from './placement'

describe('blocks', () => {
  it('かたち・いろの id が かさならない', () => {
    expect(new Set(BLOCK_SHAPES.map(shape => shape.id)).size).toBe(BLOCK_SHAPES.length)
    expect(new Set(BLOCK_COLORS.map(color => color.id)).size).toBe(BLOCK_COLORS.length)
  })

  it('おまかせ は かたちごとの いろ、えらんだ いろは そのまま', () => {
    expect(resolveColor('cube', AUTO_COLOR)).toBe('red')
    expect(resolveColor('plank', AUTO_COLOR)).toBe('yellow')
    expect(resolveColor('plank', 'pink')).toBe('pink')
  })

  it('90度 まわすと たて・よこの はばが いれかわる', () => {
    expect(footprint('plank', 0)).toEqual({ x: 2, z: 1 })
    expect(footprint('plank', 1)).toEqual({ x: 1, z: 2 })
    expect(footprint('plank', 2)).toEqual({ x: 2, z: 1 })
  })
})

describe('snapPlacement', () => {
  it('こうしに そろえる', () => {
    expect(snapPlacement(0.2, -0.1, 'cube', 0)).toEqual({ x: 0, z: 0 })
    expect(snapPlacement(0.3, 1.26, 'cube', 0)).toEqual({ x: 0.5, z: 1.5 })
  })

  it('マットの そとを さわっても マットの なかに おさめる', () => {
    for (const shape of BLOCK_SHAPES) {
      for (let angle = 0; angle < Math.PI * 2; angle += 0.4) {
        const { x, z } = snapPlacement(Math.cos(angle) * 20, Math.sin(angle) * 20, shape.id, 1)
        const size = footprint(shape.id, 1)
        expect(Math.hypot(x, z) + Math.hypot(size.x, size.z) / 2).toBeLessThanOrEqual(MAT_RADIUS + 1e-9)
        expect(Math.abs(x / GRID - Math.round(x / GRID))).toBeLessThan(1e-9)
        expect(Math.abs(z / GRID - Math.round(z / GRID))).toBeLessThan(1e-9)
      }
    }
  })

  it('-0 を かえさない', () => {
    const { x, z } = snapPlacement(-0.1, -0.2, 'cube', 0)
    expect(Object.is(x, -0)).toBe(false)
    expect(Object.is(z, -0)).toBe(false)
  })
})

describe('たかさの めあて', () => {
  it('めあては ひくい じゅんに ならぶ', () => {
    const heights = HEIGHT_GOALS.map(goal => goal.height)
    expect([...heights].sort((a, b) => a - b)).toEqual(heights)
  })

  it('とどいた かずと つぎの めあて', () => {
    expect(goalsReached(0)).toBe(0)
    expect(nextGoal(0)).toBe(HEIGHT_GOALS[0])
    expect(goalsReached(HEIGHT_GOALS[0].height)).toBe(1)
    expect(goalsReached(HEIGHT_GOALS[1].height + 0.5)).toBe(2)
    expect(goalsReached(99)).toBe(HEIGHT_GOALS.length)
    expect(nextGoal(99)).toBeNull()
  })

  it('つみき 1こ ぶん = 5cm', () => {
    expect(heightInCm(0)).toBe(0)
    expect(heightInCm(3)).toBe(15)
    expect(heightInCm(-1)).toBe(0)
  })
})
