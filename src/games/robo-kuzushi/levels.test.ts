import { describe, expect, test } from 'vitest'
import { balloonAt, BALLOON_R, fanZone, GROUND_Y, LEVELS, pieceBounds, PORTAL_R, SLING, starsFor, type Bounds } from './levels'

const overlaps = (a: Bounds, c: Bounds) => Math.min(a.r, c.r) - Math.max(a.l, c.l) > .5 && Math.min(a.b, c.b) - Math.max(a.t, c.t) > .5

describe('robo-kuzushi levels', () => {
  test('every level has a unique name, a hint, balls and at least one robot', () => {
    expect(new Set(LEVELS.map(l => l.name)).size).toBe(LEVELS.length)
    for (const level of LEVELS) {
      expect(level.hint).not.toBe('')
      expect(level.balls.length).toBeGreaterThanOrEqual(3)
      expect(level.pieces.some(p => p.type === 'robot')).toBe(true)
    }
  })
  test('pieces sit inside the world, right of the slingshot, on or above the ground and below the top of the screen', () => {
    for (const level of LEVELS) {
      for (const piece of level.pieces) {
        for (const b of pieceBounds(piece)) {
          expect(b.l, `${level.name}: ${piece.type}`).toBeGreaterThan(SLING.x + 300)
          expect(b.r, `${level.name}: ${piece.type}`).toBeLessThan(level.width)
          expect(b.b, `${level.name}: ${piece.type}`).toBeLessThanOrEqual(GROUND_Y + .001)
          // ひくい 画面でも 見える たかさ。
          expect(b.t, `${level.name}: ${piece.type}`).toBeGreaterThan(100)
        }
      }
    }
  })
  test('no two solid pieces overlap (towers are built to rest, not to explode)', () => {
    for (const level of LEVELS) {
      const boxes = level.pieces.flatMap((piece, i) => pieceBounds(piece).map(b => ({ b, i })))
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        if (boxes[i].i === boxes[j].i) continue
        expect(overlaps(boxes[i].b, boxes[j].b), `${level.name}: ${boxes[i].i} と ${boxes[j].i} が かさなっている`).toBe(false)
      }
    }
  })
  test('fans blow through open air and portals lead somewhere else', () => {
    for (const level of LEVELS) {
      for (const fan of level.pieces.filter(p => p.type === 'fan')) {
        const zone = fanZone(fan)
        expect(zone.t).toBeLessThan(zone.b)
        const blocked = level.pieces.filter(p => p !== fan && p.type !== 'portal').flatMap(pieceBounds).some(b => overlaps(b, zone))
        expect(blocked, level.name).toBe(false)
      }
      for (const portal of level.pieces.filter(p => p.type === 'portal')) {
        expect(Math.hypot(portal.to.x - portal.x, portal.to.y - portal.y)).toBeGreaterThan(PORTAL_R * 4)
      }
    }
  })
  test('balloons hang right above what they carry', () => {
    const hanging = LEVELS.flatMap(level => level.pieces).flatMap(p => (p.type === 'robot' || p.type === 'box') && p.balloon ? [p] : [])
    expect(hanging.length).toBeGreaterThan(0)
    for (const piece of hanging) {
      const at = balloonAt(piece)!
      expect(at.x).toBe(piece.x)
      expect(at.y + BALLOON_R).toBeLessThan(piece.y)
    }
  })
  test('stars grow with the balls left over', () => {
    expect([0, 1, 2, 3].map(starsFor)).toEqual([1, 2, 3, 3])
  })
})
