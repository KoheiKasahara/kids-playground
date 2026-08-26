import { describe, expect, it } from 'vitest'
import {
  TRAIN_CAR_SPACING,
  TRAIN_END_STOP_MARGIN,
  TRAIN_STATION_STOP_DURATION,
  advanceRailTrainCursor,
  distanceToRailTrainDeadEnd,
  distanceToRailTrainStation,
  findNextRailTrainStation,
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

  it('samples a slope height and pitch in both travel directions', () => {
    const slope = createRailPiece('slope', 'slope')
    const midpoint = railPathLength(slope.path) / 2
    const uphill = sampleRailTrainPose([slope], {
      pieceId: slope.id,
      direction: 'a-to-b',
      distance: midpoint,
    })
    const downhill = sampleRailTrainPose([slope], {
      pieceId: slope.id,
      direction: 'b-to-a',
      distance: midpoint,
    })
    expect(uphill?.position.y).toBeGreaterThan(0)
    expect(uphill?.forward.y).toBeGreaterThan(0)
    expect(downhill?.position.y).toBeGreaterThan(0)
    expect(downhill?.forward.y).toBeLessThan(0)
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

  it('approaches a station, stops at its center, waits, and departs once', () => {
    const station = createRailPiece('station', 'station')
    expect(findNextRailTrainStation([station], {
      pieceId: station.id,
      direction: 'a-to-b',
      distance: 0,
    })?.distance).toBeCloseTo(railPathLength(station.path) / 2, 4)
    expect(distanceToRailTrainStation([station], {
      pieceId: station.id,
      direction: 'a-to-b',
      distance: 0,
    })).toBeCloseTo(railPathLength(station.path) / 2, 4)

    let motion: RailTrainMotion = {
      cursor: { pieceId: station.id, direction: 'a-to-b', distance: 0 },
      speed: 0,
      status: 'running',
    }
    for (let tick = 0; tick < 240 && motion.status !== 'stoppedAtStation'; tick += 1) {
      motion = updateRailTrainMotion(motion, [station], 0.1)
    }
    expect(motion.status).toBe('stoppedAtStation')
    expect(motion.cursor.distance).toBeCloseTo(railPathLength(station.path) / 2, 3)
    expect(motion.stationServicedId).toBe(station.id)

    const heldOnce = updateRailTrainMotion(motion, [station], 1)
    const held = updateRailTrainMotion(heldOnce, [station], TRAIN_STATION_STOP_DURATION - 1 - 0.1)
    expect(held.status).toBe('stoppedAtStation')
    const departing = updateRailTrainMotion(held, [station], 0.1)
    expect(departing.status).toBe('departing')
    const moved = updateRailTrainMotion(departing, [station], 0.3)
    expect(moved.cursor.distance).toBeGreaterThan(motion.cursor.distance)
    expect(moved.status).not.toBe('stoppedAtStation')
  })

  it('continues to the dead end after a station without stopping there again', () => {
    const station = createRailPiece('station', 'station')
    const tail = createRailPiece('short-straight', 'tail', { x: 6, y: 0, z: 0 })
    const connected = connectRailPieces([station, tail], 'tail', 'a', 'station', 'b')
    let motion: RailTrainMotion = {
      cursor: { pieceId: station.id, direction: 'a-to-b', distance: 0 },
      speed: 0,
      status: 'running',
    }
    for (let tick = 0; tick < 240 && motion.status !== 'stoppedAtStation'; tick += 1) {
      motion = updateRailTrainMotion(motion, connected, 0.1)
    }
    expect(motion.status).toBe('stoppedAtStation')
    motion = updateRailTrainMotion(motion, connected, 1)
    motion = updateRailTrainMotion(motion, connected, 0.6)
    expect(motion.status).toBe('departing')
    let sawStationStopAgain = false
    for (let tick = 0; tick < 240 && motion.status !== 'waiting'; tick += 1) {
      motion = updateRailTrainMotion(motion, connected, 0.1)
      if (motion.status === 'stoppedAtStation') sawStationStopAgain = true
    }
    expect(sawStationStopAgain).toBe(false)
    expect(motion.status).toBe('waiting')
    expect(motion.cursor.pieceId).toBe(tail.id)
  })

  it('restarts from the same station-route cursor after adding a new tail', () => {
    const station = createRailPiece('station', 'station')
    const tail = createRailPiece('short-straight', 'tail', { x: 6, y: 0, z: 0 })
    const connected = connectRailPieces([station, tail], tail.id, 'a', station.id, 'b')
    let motion: RailTrainMotion = {
      cursor: { pieceId: station.id, direction: 'a-to-b', distance: 0 },
      speed: 0,
      status: 'running',
    }
    for (let tick = 0; tick < 240 && motion.status !== 'stoppedAtStation'; tick += 1) {
      motion = updateRailTrainMotion(motion, connected, 0.1)
    }
    expect(motion.status).toBe('stoppedAtStation')
    motion = updateRailTrainMotion(motion, connected, 1)
    motion = updateRailTrainMotion(motion, connected, 0.6)
    for (let tick = 0; tick < 240 && motion.status !== 'waiting'; tick += 1) {
      motion = updateRailTrainMotion(motion, connected, 0.1)
    }
    expect(motion.status).toBe('waiting')
    const waitingCursor = { ...motion.cursor }

    const extension = createRailPiece('short-straight', 'extension', { x: 8, y: 0, z: 0 })
    const extended = connectRailPieces(connected.concat(extension), extension.id, 'a', tail.id, 'b')
    const restarted = startRailTrain(motion)
    expect(restarted.cursor).toEqual(waitingCursor)
    const moved = updateRailTrainMotion(restarted, extended, 0.25)
    expect(moved.status).toBe('running')
    expect(moved.cursor.distance).toBeGreaterThan(waitingCursor.distance)
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
