import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SNAP_ANGLE,
  areRailConnectionsSymmetric,
  connectRailPieces,
  createRailPiece,
  deleteRailPiece,
  disconnectRailPiece,
  findRailSnapCandidate,
  moveRailPiece,
  sampleRailPath,
  sampleRailPathTangent,
  worldConnectorForRailPiece,
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
