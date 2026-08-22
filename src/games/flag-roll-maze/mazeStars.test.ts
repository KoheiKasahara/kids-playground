import { describe, expect, it } from 'vitest'
import {
  collectedStarCount,
  createStarTracker,
  isStarCollected,
  STAR_PICKUP_RADIUS,
  updateStarTracker,
  type MazeStar,
} from './mazeStars'

const stars: readonly MazeStar[] = [
  { id: 'star-1', center: { x: 0, z: 0 } },
  { id: 'star-2', center: { x: 2, z: 0 } },
  { id: 'star-3', center: { x: 0, z: 2 } },
]

describe('mazeStars', () => {
  it('範囲内の星だけを取得する', () => {
    const tracker = createStarTracker()
    const result = updateStarTracker(
      tracker,
      { x: STAR_PICKUP_RADIUS, z: 0 },
      stars,
    )

    expect(result.collectedIds).toEqual(['star-1'])
    expect(isStarCollected(result.tracker, 'star-1')).toBe(true)
    expect(isStarCollected(result.tracker, 'star-2')).toBe(false)
  })

  it('同じ位置で二度呼んでも二重取得せずtracker参照を保つ', () => {
    const first = updateStarTracker(createStarTracker(), { x: 0, z: 0 }, stars)
    const second = updateStarTracker(first.tracker, { x: 0, z: 0 }, stars)

    expect(first.collectedIds).toEqual(['star-1'])
    expect(second.collectedIds).toEqual([])
    expect(second.tracker).toBe(first.tracker)
  })

  it('1フレームに複数入った星をstars配列順で返す', () => {
    const result = updateStarTracker(
      createStarTracker(),
      { x: 0, z: 0 },
      stars,
      3,
    )

    expect(result.collectedIds).toEqual(['star-1', 'star-2', 'star-3'])
    expect(collectedStarCount(result.tracker)).toBe(3)
  })

  it('星が0件でも安全に同じtrackerを返す', () => {
    const tracker = createStarTracker()
    const result = updateStarTracker(tracker, { x: 0, z: 0 }, [])

    expect(result.collectedIds).toEqual([])
    expect(result.tracker).toBe(tracker)
    expect(collectedStarCount(result.tracker)).toBe(0)
  })
})
