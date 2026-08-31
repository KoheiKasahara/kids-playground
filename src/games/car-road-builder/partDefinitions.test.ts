import { describe, expect, test } from 'vitest'
import { connectionsForPart, createPlacedPart, PART_DEFINITIONS } from './partDefinitions'

describe('car road parts', () => {
  test('straight has four unique poses and curve has eight', () => {
    expect(PART_DEFINITIONS.straight.rotationSteps).toEqual([0, 1, 2, 3])
    expect(PART_DEFINITIONS.curve.rotationSteps).toHaveLength(8)
    expect(new Set(PART_DEFINITIONS.straight.rotationSteps.map((step) => connectionsForPart(createPlacedPart('straight', step)).join('-'))).size).toBe(4)
  })

  test('goal accepts every direction without rotating', () => {
    expect(connectionsForPart(createPlacedPart('goal', 5))).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])
    expect(createPlacedPart('goal', 5).rotationStep).toBe(0)
  })
})
