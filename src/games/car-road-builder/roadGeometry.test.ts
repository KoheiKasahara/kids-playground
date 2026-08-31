import { describe, expect, test } from 'vitest'
import { connectionsForPart, createPlacedPart } from './partDefinitions'
import { getPathSpec, portPoint } from './roadGeometry'

describe('car road geometry', () => {
  test('every road pose starts and ends at its declared ports', () => {
    for (const kind of ['straight', 'curve', 'gentle-curve'] as const) {
      for (let step = 0; step < 8; step += 1) {
        const part = createPlacedPart(kind, step)
        const ports = connectionsForPart(part)
        const path = getPathSpec(part)
        expect(path.sample(0)).toEqual(portPoint(ports[0]!))
        expect(path.sample(1)).toEqual(portPoint(ports[1]!))
        expect(path.length).toBeGreaterThan(0)
      }
    }
  })

  test('start and goal connect centre to boundary', () => {
    const start = getPathSpec(createPlacedPart('start', 2))
    const goal = getPathSpec(createPlacedPart('goal'), 'W')
    expect(start.sample(0)).toEqual({ x: 0, y: 0 })
    expect(start.sample(1)).toEqual(portPoint('E'))
    expect(goal.sample(0)).toEqual(portPoint('W'))
    expect(goal.sample(1)).toEqual({ x: 0, y: 0 })
  })

  test('curve uses one smooth quadratic and exposes endpoint tangents', () => {
    const path = getPathSpec(createPlacedPart('curve', 0))
    expect(path.segments).toHaveLength(1)
    expect(path.segments[0]!.kind).toBe('quadratic')
    expect(path.tangent(0).y).toBeGreaterThan(0)
    expect(path.tangent(1).x).toBeGreaterThan(0)
  })

  test('gentle curve uses a quadratic from a cardinal port to a diagonal port', () => {
    const path = getPathSpec(createPlacedPart('gentle-curve', 0))
    expect(path.segments).toHaveLength(1)
    expect(path.segments[0]!.kind).toBe('quadratic')
    expect(path.sample(0)).toEqual(portPoint('N'))
    expect(path.sample(1)).toEqual(portPoint('SE'))
    expect(path.tangent(0).y).toBeGreaterThan(0)
    expect(path.tangent(1).x).toBeGreaterThan(0)
    expect(path.tangent(1).y).toBeGreaterThan(0)
  })

  test('crossroad geometry keeps opposite directions on separate straight paths', () => {
    for (const step of [0, 1, 2, 3]) {
      const part = createPlacedPart('crossroad', step)
      const ports = connectionsForPart(part)
      const defaultPath = getPathSpec(part)
      expect(defaultPath.start).toEqual(portPoint(ports[0]!))
      expect(defaultPath.end).toEqual(portPoint(ports[2]!))
    }

    const part = createPlacedPart('crossroad')
    const northSouth = getPathSpec(part, 'N')
    const eastWest = getPathSpec(part, 'E')

    expect(northSouth.start).toEqual(portPoint('N'))
    expect(northSouth.end).toEqual(portPoint('S'))
    expect(northSouth.sample(0.5)).toEqual({ x: 0, y: 0 })
    expect(eastWest.start).toEqual(portPoint('E'))
    expect(eastWest.end).toEqual(portPoint('W'))
    expect(eastWest.sample(0.5)).toEqual({ x: 0, y: 0 })
  })

  test('xroad geometry keeps the two diagonal directions on separate straight paths', () => {
    const part = createPlacedPart('xroad')
    const northWestToSouthEast = getPathSpec(part, 'NW')
    const northEastToSouthWest = getPathSpec(part, 'NE')

    expect(northWestToSouthEast.start).toEqual(portPoint('NW'))
    expect(northWestToSouthEast.end).toEqual(portPoint('SE'))
    expect(northWestToSouthEast.sample(0.5)).toEqual({ x: 0, y: 0 })
    expect(northEastToSouthWest.start).toEqual(portPoint('NE'))
    expect(northEastToSouthWest.end).toEqual(portPoint('SW'))
    expect(northEastToSouthWest.sample(0.5)).toEqual({ x: 0, y: 0 })
  })
})
