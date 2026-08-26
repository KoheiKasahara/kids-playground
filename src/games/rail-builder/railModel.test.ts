import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SNAP_ANGLE,
  ELEVATED_HEIGHT,
  ELEVATED_LENGTH,
  SHORT_STRAIGHT_LENGTH,
  SLOPE_LENGTH,
  areRailConnectionsSymmetric,
  connectRailPieces,
  createRailPiece,
  deleteRailPiece,
  disconnectRailPiece,
  findRailSnapCandidate,
  findRailSnapNearMiss,
  moveRailPiece,
  railPathLength,
  sampleRailPath,
  sampleRailPathTangent,
  worldConnectorForRailPiece,
  type RailPiece,
} from './railModel'

const origin = { x: 0, y: 0, z: 0 }

describe('railModel', () => {
  it('creates straight connectors and samples its path', () => {
    const piece = createRailPiece('straight', 's1', origin)
    expect(piece.connectorA.localPosition).toEqual({ x: -2.5, y: 0, z: 0 })
    expect(piece.connectorA.outward).toEqual({ x: -1, y: 0, z: 0 })
    expect(piece.connectorB.localPosition).toEqual({ x: 2.5, y: 0, z: 0 })
    expect(sampleRailPath(piece.path, 0)).toEqual({ x: -2.5, y: 0, z: 0 })
    expect(sampleRailPath(piece.path, 0.5)).toEqual({ x: 0, y: 0, z: 0 })
    expect(sampleRailPath(piece.path, 1)).toEqual({ x: 2.5, y: 0, z: 0 })
    expect(sampleRailPathTangent(piece.path, 0.5)).toEqual({ x: 1, y: 0, z: 0 })
  })

  it('creates short, slope, and elevated pieces with 3D path endpoints', () => {
    const short = createRailPiece('short-straight', 'short', origin)
    expect(short.path.kind).toBe('straight')
    if (short.path.kind === 'straight') expect(short.path.length).toBe(SHORT_STRAIGHT_LENGTH)

    const slope = createRailPiece('slope', 'slope', origin)
    expect(sampleRailPath(slope.path, 0).y).toBeCloseTo(0)
    expect(sampleRailPath(slope.path, 1).y).toBeCloseTo(ELEVATED_HEIGHT)
    expect(sampleRailPath(slope.path, 0.5).y).toBeGreaterThan(0)
    expect(sampleRailPathTangent(slope.path, 0).y).toBeCloseTo(0)
    expect(sampleRailPathTangent(slope.path, 1).y).toBeCloseTo(0)
    expect(sampleRailPathTangent(slope.path, 0.5).y).toBeGreaterThan(0)
    expect(slope.connectorA.localPosition.y).toBeCloseTo(0)
    expect(slope.connectorB.localPosition.y).toBeCloseTo(ELEVATED_HEIGHT)
    expect(railPathLength(slope.path)).toBeGreaterThan(SLOPE_LENGTH)

    const bridge = createRailPiece('bridge', 'bridge', origin)
    expect(bridge.connectorA.localPosition.y).toBeCloseTo(ELEVATED_HEIGHT)
    expect(bridge.connectorB.localPosition.y).toBeCloseTo(ELEVATED_HEIGHT)
    if (bridge.path.kind === 'straight') expect(bridge.path.length).toBe(ELEVATED_LENGTH)
  })

  it('creates a quarter curve whose endpoint tangents match outward directions', () => {
    const piece = createRailPiece('curve', 'c1', origin)
    const start = sampleRailPath(piece.path, 0)
    const end = sampleRailPath(piece.path, 1)
    expect(start).toEqual(piece.connectorA.localPosition)
    expect(end).toEqual(piece.connectorB.localPosition)
    expect(sampleRailPathTangent(piece.path, 0)).toEqual({ x: 1, y: 0, z: 0 })
    expect(sampleRailPathTangent(piece.path, 1)).toEqual({ x: 0, y: 0, z: 1 })
    expect(piece.connectorA.outward).toEqual({ x: -1, y: 0, z: 0 })
    expect(piece.connectorB.outward).toEqual({ x: 0, y: 0, z: 1 })
  })

  it('converts connector position and outward through world rotation', () => {
    const piece = createRailPiece('straight', 's1', { x: 3, y: 1, z: 4 }, Math.PI / 2)
    expect(worldConnectorForRailPiece(piece, 'a').position.x).toBeCloseTo(3)
    expect(worldConnectorForRailPiece(piece, 'a').position.y).toBeCloseTo(1)
    expect(worldConnectorForRailPiece(piece, 'a').position.z).toBeCloseTo(6.5)
    expect(worldConnectorForRailPiece(piece, 'a').outward.x).toBeCloseTo(0)
    expect(worldConnectorForRailPiece(piece, 'a').outward.z).toBeCloseTo(1)
  })

  it('rejects snap candidates by distance, height, and angle', () => {
    const target = createRailPiece('straight', 'target', origin)
    const tooFar = createRailPiece('straight', 'far', { x: 0, y: 0, z: 8 })
    expect(findRailSnapCandidate(tooFar, [target])).toBeNull()

    const tooHigh = createRailPiece('straight', 'high', { x: 0, y: 1, z: 0 })
    expect(findRailSnapCandidate(tooHigh, [target])).toBeNull()

    // A quarter turn makes the closest connector face sideways rather than opposite.
    const wrongAngle = createRailPiece('straight', 'angle', { x: 2.5, y: 0, z: -2.5 }, Math.PI / 2)
    expect(findRailSnapCandidate(wrongAngle, [target])).toBeNull()
  })

  it('connects ground to slope and rejects an elevated endpoint at ground height', () => {
    const ground = createRailPiece('straight', 'ground', origin)
    const slope = createRailPiece('slope', 'slope', { x: 6, y: 0, z: 0 })
    const groundToSlope = findRailSnapCandidate(slope, [ground])
    expect(groundToSlope?.movingConnectorId).toBe('a')
    expect(groundToSlope?.heightDifference).toBeCloseTo(0)

    const bridge = createRailPiece('bridge', 'bridge', { x: 6, y: 0, z: 0 })
    expect(findRailSnapCandidate(bridge, [ground])).toBeNull()
    expect(findRailSnapNearMiss(bridge, [ground])?.heightDifference).toBeCloseTo(ELEVATED_HEIGHT)
  })

  it('builds a ground-slope-bridge-downslope-ground network with matching heights', () => {
    const ground = createRailPiece('straight', 'ground', origin)
    const slope = createRailPiece('slope', 'slope', { x: 6, y: 0, z: 0 })
    const bridge = createRailPiece('bridge', 'bridge', { x: 12.75, y: 0, z: 0 })
    // 180度回した坂はB端が高架側、A端が地上側になる。
    const secondSlope = createRailPiece('slope', 'second-slope', { x: 19.5, y: 0, z: 0 }, Math.PI)
    const finalGround = createRailPiece('straight', 'final-ground', { x: 25.5, y: 0, z: 0 })

    const connectMoving = (
      pieces: RailPiece[],
      moving: RailPiece,
      targetPieceId: string,
      targetConnectorId: 'a' | 'b',
    ) => {
      const candidate = findRailSnapCandidate(moving, pieces, undefined)
      expect(candidate).not.toBeNull()
      if (candidate === null) return pieces
      expect(candidate.targetPieceId).toBe(targetPieceId)
      expect(candidate.targetConnectorId).toBe(targetConnectorId)
      return connectRailPieces(
        [...pieces, moving],
        moving.id,
        candidate.movingConnectorId,
        targetPieceId,
        targetConnectorId,
        candidate.transform,
      )
    }

    const withSlope = connectMoving([ground], slope, ground.id, 'b')
    const withBridge = connectMoving(withSlope, bridge, slope.id, 'b')
    const withSecondSlope = connectMoving(withBridge, secondSlope, bridge.id, 'b')
    const network = connectMoving(withSecondSlope, finalGround, secondSlope.id, 'a')

    expect(areRailConnectionsSymmetric(network)).toBe(true)
    const connections: Array<['ground' | 'slope' | 'bridge' | 'second-slope' | 'final-ground', 'a' | 'b', string, 'a' | 'b']> = [
      ['ground', 'b', 'slope', 'a'],
      ['slope', 'b', 'bridge', 'a'],
      ['bridge', 'b', 'second-slope', 'b'],
      ['second-slope', 'a', 'final-ground', 'a'],
    ]
    for (const [pieceId, connectorId, otherPieceId, otherConnectorId] of connections) {
      const piece = network.find((candidate) => candidate.id === pieceId)
      const other = network.find((candidate) => candidate.id === otherPieceId)
      expect(piece?.connections[connectorId]).toEqual({ pieceId: otherPieceId, connectorId: otherConnectorId })
      expect(other?.connections[otherConnectorId]).toEqual({ pieceId, connectorId })
      if (piece === undefined || other === undefined) continue
      const point = worldConnectorForRailPiece(piece, connectorId).position
      const otherPoint = worldConnectorForRailPiece(other, otherConnectorId).position
      expect(point.x).toBeCloseTo(otherPoint.x, 5)
      expect(point.y).toBeCloseTo(otherPoint.y, 5)
      expect(point.z).toBeCloseTo(otherPoint.z, 5)
    }
  })

  it('finds a natural snap and aligns connector positions and outward directions', () => {
    const target = createRailPiece('straight', 'target', origin)
    const moving = createRailPiece('straight', 'moving', { x: 5.8, y: 0, z: 0 })
    const candidate = findRailSnapCandidate(moving, [target])
    expect(candidate).not.toBeNull()
    if (candidate === null) return
    expect(candidate.distance).toBeLessThan(1.15)
    const moved = { ...moving, position: candidate.transform.position, rotationY: candidate.transform.rotationY }
    const movingConnector = worldConnectorForRailPiece(moved, candidate.movingConnectorId)
    const targetConnector = worldConnectorForRailPiece(target, candidate.targetConnectorId)
    expect(movingConnector.position).toEqual(targetConnector.position)
    expect(movingConnector.outward.x).toBeCloseTo(-targetConnector.outward.x)
    expect(movingConnector.outward.z).toBeCloseTo(-targetConnector.outward.z)
  })

  it('connects both sides and keeps the relation symmetric', () => {
    const target = createRailPiece('straight', 'target', origin)
    const moving = createRailPiece('straight', 'moving', { x: 5.8, y: 0, z: 0 })
    const candidate = findRailSnapCandidate(moving, [target])
    expect(candidate).not.toBeNull()
    if (candidate === null) return
    const connected = connectRailPieces(
      [target, moving],
      'moving',
      candidate.movingConnectorId,
      'target',
      candidate.targetConnectorId,
      candidate.transform,
    )
    expect(areRailConnectionsSymmetric(connected)).toBe(true)
    const connectedMoving = connected.find((piece) => piece.id === 'moving')
    const connectedTarget = connected.find((piece) => piece.id === 'target')
    expect(connectedMoving?.connections[candidate.movingConnectorId]).toEqual({
      pieceId: 'target',
      connectorId: candidate.targetConnectorId,
    })
    expect(connectedTarget?.connections[candidate.targetConnectorId]).toEqual({
      pieceId: 'moving',
      connectorId: candidate.movingConnectorId,
    })
  })

  it('snaps a curve endpoint to a straight endpoint with continuous direction', () => {
    const target = createRailPiece('straight', 'target', origin)
    const moving = createRailPiece('curve', 'curve', { x: 2.5, y: 0, z: 4 })
    const candidate = findRailSnapCandidate(moving, [target])
    expect(candidate).not.toBeNull()
    if (candidate === null) return
    const snapped = {
      ...moving,
      position: candidate.transform.position,
      rotationY: candidate.transform.rotationY,
    }
    const movingConnector = worldConnectorForRailPiece(snapped, candidate.movingConnectorId)
    const targetConnector = worldConnectorForRailPiece(target, candidate.targetConnectorId)
    expect(movingConnector.position).toEqual(targetConnector.position)
    expect(movingConnector.outward.x).toBeCloseTo(-targetConnector.outward.x)
    expect(movingConnector.outward.z).toBeCloseTo(-targetConnector.outward.z)
    // 曲線の入口の接線は outward の反対向きなので、接続点で自然に続く。
    expect(sampleRailPathTangent(moving.path, 0)).toEqual({ x: 1, y: 0, z: 0 })
  })

  it('disconnects safely when moving or deleting a connected piece', () => {
    const target = createRailPiece('straight', 'target', origin)
    const moving = createRailPiece('straight', 'moving', { x: 5.8, y: 0, z: 0 })
    const connected = connectRailPieces([target, moving], 'moving', 'a', 'target', 'b')
    expect(areRailConnectionsSymmetric(connected)).toBe(true)
    const moved = moveRailPiece(connected, 'moving', { position: { x: 8, y: 0, z: 0 } })
    expect(areRailConnectionsSymmetric(moved)).toBe(true)
    expect(moved.find((piece) => piece.id === 'target')?.connections).toEqual({})
    expect(moved.find((piece) => piece.id === 'moving')?.connections).toEqual({})

    const reconnected = connectRailPieces([target, moving], 'moving', 'a', 'target', 'b')
    const deleted = deleteRailPiece(reconnected, 'target')
    expect(deleted).toHaveLength(1)
    expect(deleted[0]?.connections).toEqual({})
    expect(disconnectRailPiece(reconnected, 'unknown')).toEqual(reconnected)
  })

  it('does not allow a snap angle wider than the configured tolerance', () => {
    expect(DEFAULT_SNAP_ANGLE).toBeCloseTo((58 * Math.PI) / 180)
  })
})
