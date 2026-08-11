import { describe, expect, test } from 'vitest'
import { correctCount, createPlacements, isComplete, placePiece, returnPiece } from './puzzleState'

const ids = ['08', '09', '10'] as const

describe('prefecture puzzle placements', () => {
  test('places a piece into an empty target', () => {
    expect(placePiece(createPlacements(ids), '08', '09')).toMatchObject({ '08': null, '09': '08', '10': null })
  })

  test('moves a placed piece and clears its former target', () => {
    const first = placePiece(createPlacements(ids), '08', '08')
    expect(placePiece(first, '08', '09')).toMatchObject({ '08': null, '09': '08' })
  })

  test('swaps two placed pieces', () => {
    let placements = placePiece(createPlacements(ids), '08', '09')
    placements = placePiece(placements, '09', '08')
    expect(placePiece(placements, '08', '08')).toMatchObject({ '08': '08', '09': '09' })
  })

  test('returns a placed piece to the tray', () => {
    const placed = placePiece(createPlacements(ids), '08', '08')
    expect(returnPiece(placed, '08')).toMatchObject({ '08': null })
  })

  test('only enables checking after every piece is placed and counts correct positions', () => {
    let placements = placePiece(createPlacements(ids), '08', '08')
    expect(isComplete(placements, ids)).toBe(false)
    placements = placePiece(placements, '09', '09')
    placements = placePiece(placements, '10', '10')
    expect(isComplete(placements, ids)).toBe(true)
    expect(correctCount(placements, ids)).toBe(3)
  })
})
