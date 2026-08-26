import { describe, expect, it } from 'vitest'
import { connectRailPieces, createRailPiece, railPathLength, type RailPiece } from './railModel'
import {
  MAX_RAIL_FLEET_SIZE,
  addRailFleetTrain,
  createInitialRailFleet,
  setRailFleetTrainRunning,
  updateRailFleet,
  type RailFleetTrain,
} from './railFleetModel'

function makeCurveLoop(): RailPiece[] {
  let loop: RailPiece[] = [createRailPiece('curve', 'p1')]
  for (const id of ['p2', 'p3', 'p4']) {
    loop = connectRailPieces(
      [...loop, createRailPiece('curve', id)],
      id,
      'a',
      loop[loop.length - 1]!.id,
      'b',
    )
  }
  return loop.map((piece) => {
    if (piece.id === 'p1') return { ...piece, connections: { ...piece.connections, a: { pieceId: 'p4', connectorId: 'b' } } }
    if (piece.id === 'p4') return { ...piece, connections: { ...piece.connections, b: { pieceId: 'p1', connectorId: 'a' } } }
    return piece
  })
}

function runningTrain(train: RailFleetTrain, pieceId: string, distance: number): RailFleetTrain {
  return {
    ...train,
    wantsToRun: true,
    blocked: false,
    motion: {
      cursor: { pieceId, direction: 'a-to-b', distance },
      speed: 1,
      status: 'running',
    },
  }
}

describe('railFleetModel', () => {
  it('creates two independent trains, pauses one, and caps additions at three', () => {
    const pieces = [
      createRailPiece('straight', 'rail-1'),
      createRailPiece('straight', 'rail-2'),
      createRailPiece('straight', 'rail-3'),
    ]
    let fleet = createInitialRailFleet(pieces, 2)
    expect(fleet).toHaveLength(2)
    expect(fleet[0]?.motion.cursor.pieceId).not.toBe(fleet[1]?.motion.cursor.pieceId)

    fleet = setRailFleetTrainRunning(fleet, 'train-1', true)
    fleet = setRailFleetTrainRunning(fleet, 'train-2', true)
    fleet = setRailFleetTrainRunning(fleet, 'train-1', false)
    const firstCursor = { ...fleet[0]!.motion.cursor }
    const secondCursor = { ...fleet[1]!.motion.cursor }
    const updated = updateRailFleet(fleet, pieces, 0.5)
    expect(updated[0]?.motion.cursor).toEqual(firstCursor)
    expect(updated[0]?.motion.status).toBe('paused')
    expect(updated[1]?.motion.cursor.distance).toBeGreaterThan(secondCursor.distance)

    fleet = addRailFleetTrain(updated, pieces)
    fleet = addRailFleetTrain(fleet, pieces)
    expect(fleet).toHaveLength(MAX_RAIL_FLEET_SIZE)
    expect(new Set(fleet.map((train) => train.id)).size).toBe(MAX_RAIL_FLEET_SIZE)
  })

  it('does not add an overlapping train when no safe spawn route exists', () => {
    const piece = createRailPiece('straight', 'only')
    let fleet = createInitialRailFleet([piece], 2)
    expect(fleet).toHaveLength(1)
    expect(fleet.every((train) => Number.isFinite(train.motion.cursor.distance))).toBe(true)
    fleet = addRailFleetTrain(fleet, [piece])
    expect(fleet).toHaveLength(1)

    const next = createRailPiece('straight', 'next')
    const connected = connectRailPieces([piece, next], next.id, 'a', piece.id, 'b')
    expect(addRailFleetTrain(fleet, connected)).toHaveLength(1)

    const safe = createRailPiece('straight', 'safe-route')
    expect(addRailFleetTrain(fleet, [piece, safe])).toHaveLength(2)
  })

  it('returns the individual run intent to stopped after a dead end and restarts after extension', () => {
    const first = createRailPiece('straight', 'first')
    let fleet = setRailFleetTrainRunning(createInitialRailFleet([first], 1), 'train-1', true)
    for (let tick = 0; tick < 120 && fleet[0]?.wantsToRun; tick += 1) {
      fleet = updateRailFleet(fleet, [first], 0.1)
    }
    expect(fleet[0]?.motion.status).toBe('waiting')
    expect(fleet[0]?.wantsToRun).toBe(false)
    const waitingCursor = { ...fleet[0]!.motion.cursor }

    const extension = createRailPiece('straight', 'extension')
    const extended = connectRailPieces([first, extension], extension.id, 'a', first.id, 'b')
    fleet = setRailFleetTrainRunning(fleet, 'train-1', true)
    fleet = updateRailFleet(fleet, extended, 0.25)
    expect(fleet[0]?.wantsToRun).toBe(true)
    expect(fleet[0]?.motion.status).toBe('running')
    expect(fleet[0]?.motion.cursor.distance).toBeGreaterThan(waitingCursor.distance)
  })

  it('blocks a close follower on the same loop and resumes after the route gap opens', () => {
    const loop = makeCurveLoop()
    const base = createInitialRailFleet(loop, 2)
    const closeFleet = [
      runningTrain(base[0]!, 'p1', 1),
      runningTrain(base[1]!, 'p1', 5),
    ]
    const blocked = updateRailFleet(closeFleet, loop, 0.1)
    expect(blocked[0]?.blocked).toBe(true)
    expect(blocked[0]?.motion.speed).toBe(0)
    expect(blocked[1]?.blocked).toBe(false)

    const opened = blocked.map((train, index) => index === 1
      ? runningTrain(train, 'p2', 3)
      : train)
    const resumed = updateRailFleet(opened, loop, 0.2)
    expect(resumed[0]?.blocked).toBe(false)
    expect(resumed[0]?.motion.cursor.distance).toBeGreaterThan(blocked[0]!.motion.cursor.distance)
  })

  it('protects the loop boundary and resolves an identical-cursor recovery deterministically', () => {
    const loop = makeCurveLoop()
    const base = createInitialRailFleet(loop, 2)
    const last = loop.find((piece) => piece.id === 'p4')!
    const boundaryFleet = [
      runningTrain(base[0]!, last.id, railPathLength(last.path) - 0.25),
      runningTrain(base[1]!, 'p1', 0.35),
    ]
    const boundaryUpdated = updateRailFleet(boundaryFleet, loop, 0.1)
    expect(boundaryUpdated[0]?.blocked).toBe(true)
    expect(boundaryUpdated[1]?.blocked).toBe(false)

    const identical = base.map((train) => runningTrain(train, 'p1', 1.2))
    const recovered = updateRailFleet(identical, loop, 0.1)
    expect(recovered.filter((train) => train.blocked)).toHaveLength(1)
    expect(recovered.find((train) => train.id === 'train-1')?.blocked).toBe(false)
    expect(recovered.find((train) => train.id === 'train-2')?.blocked).toBe(true)
  })

  it('stops both trains before a head-on meeting on a B-B connection', () => {
    const first = createRailPiece('straight', 'first')
    const second = createRailPiece('straight', 'second')
    const base = createInitialRailFleet([first, second], 2)
    const connected = connectRailPieces([first, second], second.id, 'b', first.id, 'b')
    const approaching = [
      runningTrain(base[0]!, first.id, 4),
      runningTrain(base[1]!, second.id, 4),
    ]
    const updated = updateRailFleet(approaching, connected, 0.1)
    expect(updated.every((train) => train.blocked)).toBe(true)
    expect(updated.every((train) => train.motion.speed === 0)).toBe(true)
  })

  it('does not stop trains on spatially close but disconnected routes', () => {
    const lower = createRailPiece('straight', 'lower')
    const upper = createRailPiece('bridge', 'upper', { x: 0, y: 0, z: 0 }, Math.PI / 2)
    const base = createInitialRailFleet([lower, upper], 2)
    const fleet = [
      runningTrain(base[0]!, lower.id, 2),
      runningTrain(base[1]!, upper.id, 2),
    ]
    const updated = updateRailFleet(fleet, [lower, upper], 0.1)
    expect(updated.every((train) => !train.blocked)).toBe(true)
    expect(updated.every((train) => train.motion.speed > 0)).toBe(true)
  })
})
