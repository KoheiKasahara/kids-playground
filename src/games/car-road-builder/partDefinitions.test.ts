import { describe, expect, test } from 'vitest'
import { connectionsForPart, createPlacedPart, PART_DEFINITIONS } from './partDefinitions'

describe('car road parts', () => {
  test('straight has four unique poses and curves have eight', () => {
    expect(PART_DEFINITIONS.straight.rotationSteps).toEqual([0, 1, 2, 3])
    expect(PART_DEFINITIONS.curve.rotationSteps).toHaveLength(8)
    expect(PART_DEFINITIONS['gentle-curve'].rotationSteps).toHaveLength(8)
    expect(new Set(PART_DEFINITIONS.straight.rotationSteps.map((step) => connectionsForPart(createPlacedPart('straight', step)).join('-'))).size).toBe(4)
  })

  test('gentle curve exposes cardinal/diagonal ports for every 45-degree pose', () => {
    expect(connectionsForPart(createPlacedPart('gentle-curve', 0))).toEqual(['N', 'SE'])
    expect(connectionsForPart(createPlacedPart('gentle-curve', 3))).toEqual(['SE', 'W'])
    expect(new Set(
      PART_DEFINITIONS['gentle-curve'].rotationSteps
        .map((step) => connectionsForPart(createPlacedPart('gentle-curve', step)).join('-')),
    ).size).toBe(8)
  })

  test('goal accepts every direction without rotating', () => {
    expect(connectionsForPart(createPlacedPart('goal', 5))).toEqual(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])
    expect(createPlacedPart('goal', 5).rotationStep).toBe(0)
  })
})
