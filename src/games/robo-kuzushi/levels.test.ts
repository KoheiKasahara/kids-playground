import { describe, expect, test } from 'vitest'
import { GROUND_Y, LEVELS, SLING, starsFor, type Piece } from './levels'

function box(piece: Piece) {
  const w = piece.type === 'robot' ? piece.size : piece.type === 'box' ? 40 : piece.w
  const h = piece.type === 'robot' ? piece.size : piece.type === 'box' ? 40 : piece.h
  return { l: piece.x - w / 2, r: piece.x + w / 2, t: piece.y - h / 2, b: piece.y + h / 2 }
}

describe('robo-kuzushi levels', () => {
  test('every level has a unique name, a hint, balls and at least one robot', () => {
    expect(new Set(LEVELS.map(l => l.name)).size).toBe(LEVELS.length)
    for (const level of LEVELS) {
      expect(level.hint).not.toBe('')
      expect(level.balls.length).toBeGreaterThanOrEqual(3)
      expect(level.pieces.some(p => p.type === 'robot')).toBe(true)
    }
  })
  test('pieces sit inside the world, right of the slingshot, on or above the ground', () => {
    for (const level of LEVELS) {
      for (const piece of level.pieces) {
        const b = box(piece)
        expect(b.l).toBeGreaterThan(SLING.x + 300)
        expect(b.r).toBeLessThan(level.width)
        expect(b.b).toBeLessThanOrEqual(GROUND_Y + .001)
      }
    }
  })
  test('no two solid pieces overlap (towers are built to rest, not to explode)', () => {
    for (const level of LEVELS) {
      const boxes = level.pieces.map(box)
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], c = boxes[j]
        const overlapX = Math.min(a.r, c.r) - Math.max(a.l, c.l)
        const overlapY = Math.min(a.b, c.b) - Math.max(a.t, c.t)
        expect(overlapX > .5 && overlapY > .5, `${level.name}: ${i} と ${j} が かさなっている`).toBe(false)
      }
    }
  })
  test('stars grow with the balls left over', () => {
    expect([0, 1, 2, 3].map(starsFor)).toEqual([1, 2, 3, 3])
  })
})
