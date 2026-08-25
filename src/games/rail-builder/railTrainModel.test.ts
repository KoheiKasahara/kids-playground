import { describe, expect, it } from 'vitest'
import {
  TRAIN_CAR_SPACING,
  TRAIN_END_STOP_MARGIN,
  advanceRailTrainCursor,
  distanceToRailTrainDeadEnd,
  sampleRailTrainCars,
  sampleRailTrainPose,
  startRailTrain,
  updateRailTrainMotion,
} from './railTrainModel'
import {
  connectRailPieces,
  createRailPiece,
  railPathLength,
  sampleRailPath,
  type RailPiece,
} from './railModel'
import type { RailTrainMotion } from './railTrainModel'

describe('railTrainModel', () => {
  it('samples straight position and tangent in travel direction', () => {
    const piece = createRailPiece('straight', 'straight', { x: 3, y: 0, z: 4 }, Math.PI / 2)
    const pose = sampleRailTrainPose([piece], {
      pieceId: piece.id,
      direction: 'a-to-b',
      distance: railPathLength(piece.path) / 2,
    })
    expect(pose?.position.x).toBeCloseTo(3)
    expect(pose?.position.z).toBeCloseTo(4)
    expect(pose?.forward.x).toBeCloseTo(0)
    expect(pose?.forward.z).toBeCloseTo(-1)

    const reverse = sampleRailTrainPose([piece], {
      pieceId: piece.id,
      direction: 'b-to-a',
      distance: railPathLength(piece.path) / 2,
    })
    expect(reverse?.forward.z).toBeCloseTo(1)
  })

  it('samples a curve tangent and keeps a car on the curved path', () => {
    const piece = createRailPiece('curve', 'curve')
    const pose = sampleRailTrainPose([piece], {
      pieceId: piece.id,
      direction: 'a-to-b',
      distance: railPathLength(piece.path) / 2,
    })
    const local = sampleRailPath(piece.path, 0.5)
    expect(pose?.position.x).toBeCloseTo(local.x)
    expect(pose?.position.z).toBeCloseTo(local.z)
    expect(pose?.forward.x).toBeCloseTo(Math.SQRT1_2)
    expect(pose?.forward.z).toBeCloseTo(Math.SQRT1_2)
  })

  it('crosses a symmetric connection and carries overflow distance', () => {
    const first = createRailPiece('straight', 'first')
    const second = createRailPiece('straight', 'second', { x: 5.8, y: 0, z: 0 })
    const connected = connectRailPieces([first, second], 'second', 'a', 'first', 'b')
    const cursor = advanceRailTrainCursor(connected, {
      pieceId: first.id,
      direction: 'a-to-b',
      distance: 4.5,
    }, 1)
    expect(cursor).toEqual({ pieceId: 'second', direction: 'a-to-b', distance: 0.5 })
  })

  it('stops before a dead end without overshooting the margin', () => {
    // 現在の先頭車は中心から前端まで約1.23。停止位置で車体が端を越えない。
    expect(TRAIN_END_STOP_MARGIN).toBeGreaterThan(1.23)
    const piece = createRailPiece('straight', 'end')
    let motion: RailTrainMotion = {
      cursor: { pieceId: piece.id, direction: 'a-to-b' as const, distance: 0 },
      speed: 0,
      status: 'running' as const,
    }
    for (let tick = 0; tick < 160 && motion.status === 'running'; tick += 1) {
      motion = updateRailTrainMotion(motion, [piece], 0.1)
    }
    expect(motion.status).toBe('waiting')
    expect(distanceToRailTrainDeadEnd([piece], motion.cursor)).toBeCloseTo(TRAIN_END_STOP_MARGIN, 3)
  })

  it('restarts from the same cursor after a new connection is added', () => {
    const first = createRailPiece('straight', 'first')
    const second = createRailPiece('straight', 'second', { x: 5.8, y: 0, z: 0 })
    const waiting = {
      cursor: { pieceId: first.id, direction: 'a-to-b' as const, distance: 4.1 },
      speed: 0,
      status: 'waiting' as const,
    }
    const connected = connectRailPieces([first, second], 'second', 'a', 'first', 'b')
    const restarted = startRailTrain(waiting)
    expect(restarted.cursor).toEqual(waiting.cursor)
    const moved = updateRailTrainMotion(restarted, connected, 0.25)
    expect(moved.status).toBe('running')
    expect(moved.cursor.distance).toBeGreaterThan(waiting.cursor.distance)
  })

  it('retreats followers across a connection and curves', () => {
    const first = createRailPiece('straight', 'first')
    const second = createRailPiece('curve', 'second', { x: 5.8, y: 0, z: 0 })
    const connected = connectRailPieces([first, second], 'second', 'a', 'first', 'b')
    const poses = sampleRailTrainCars(connected, {
      pieceId: second.id,
      direction: 'a-to-b',
      distance: 1,
    })
    expect(poses).toHaveLength(2)
    expect(poses[0]?.cursor.pieceId).toBe(second.id)
    expect(poses[1]?.cursor.pieceId).toBe(first.id)
    expect(poses[1]?.cursor.distance).toBeCloseTo(railPathLength(first.path) - (TRAIN_CAR_SPACING - 1), 5)
  })

  it('treats a closed oriented topology as a loop and malformed links safely', () => {
    const first = createRailPiece('straight', 'first')
    const second = createRailPiece('straight', 'second', { x: 5, y: 0, z: 0 })
    const loop: RailPiece[] = [
      {
        ...first,
        connections: {
          a: { pieceId: second.id, connectorId: 'b' },
          b: { pieceId: second.id, connectorId: 'a' },
        },
      },
      {
        ...second,
        connections: {
          a: { pieceId: first.id, connectorId: 'b' },
          b: { pieceId: first.id, connectorId: 'a' },
        },
      },
    ]
    expect(distanceToRailTrainDeadEnd(loop, {
      pieceId: first.id,
      direction: 'a-to-b',
      distance: 1,
    })).toBe(Infinity)

    const malformed: RailPiece[] = [{
      ...first,
      connections: { b: { pieceId: 'missing', connectorId: 'a' as const } },
    }]
    expect(() => advanceRailTrainCursor(malformed, {
      pieceId: first.id,
      direction: 'a-to-b',
      distance: 1,
    }, 100)).not.toThrow()
    expect(distanceToRailTrainDeadEnd(malformed, {
      pieceId: first.id,
      direction: 'a-to-b',
      distance: 1,
    })).toBeCloseTo(4)
  })
})
