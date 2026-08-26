import { describe, expect, it } from 'vitest'
import { connectRailPieces, createRailPiece, railPathLength, type RailPiece } from './railModel'
import {
  MAX_RAIL_FLEET_SIZE,
  addRailFleetTrain,
  createInitialRailFleet,
  moveRailFleetTrainTo,
  removeRailFleetTrain,
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

  it('spawns exactly one train by default', () => {
    const pieces = [createRailPiece('straight', 'rail-1'), createRailPiece('straight', 'rail-2')]
    expect(createInitialRailFleet(pieces)).toHaveLength(1)
  })

  it('prefers a visible ground track over a tunnel, but still spawns when only a tunnel exists', () => {
    const tunnel = createRailPiece('tunnel', 'tunnel')
    const straight = createRailPiece('straight', 'straight', { x: 20, y: 0, z: 20 })
    const preferred = createInitialRailFleet([tunnel, straight], 1)
    expect(preferred).toHaveLength(1)
    expect(preferred[0]?.motion.cursor.pieceId).toBe('straight')

    const tunnelOnly = createInitialRailFleet([tunnel], 1)
    expect(tunnelOnly).toHaveLength(1)
    expect(tunnelOnly[0]?.motion.cursor.pieceId).toBe('tunnel')
  })

  it('removeRailFleetTrain keeps at least one train and reuses a freed id when adding again', () => {
    const pieces = [
      createRailPiece('straight', 'rail-1'),
      createRailPiece('straight', 'rail-2'),
      createRailPiece('straight', 'rail-3'),
    ]
    let fleet = createInitialRailFleet(pieces, 3)
    expect(fleet).toHaveLength(3)

    // 中間の1台(train-2)を消す。
    fleet = removeRailFleetTrain(fleet, 'train-2')
    expect(fleet.map((train) => train.id)).toEqual(['train-1', 'train-3'])

    // 追加すると、空いたtrain-2のidを再利用し、衝突しない。
    fleet = addRailFleetTrain(fleet, pieces)
    expect(fleet.map((train) => train.id).sort()).toEqual(['train-1', 'train-2', 'train-3'])
    expect(new Set(fleet.map((train) => train.id)).size).toBe(3)

    // 最低1台は必ず残る。未知のidを渡しても内容は変わらない。
    const single = removeRailFleetTrain([fleet[0]!])
    expect(single).toHaveLength(1)
    expect(single[0]?.id).toBe(fleet[0]!.id)
    expect(removeRailFleetTrain(fleet, 'unknown-id').map((train) => train.id)).toEqual(
      fleet.map((train) => train.id),
    )
  })

  it('moveRailFleetTrainTo replaces the cursor, stops the train, and clears station state', () => {
    const first = createRailPiece('straight', 'first')
    const second = createRailPiece('straight', 'second', { x: 6, y: 0, z: 0 })
    const moving: RailFleetTrain = {
      id: 'train-1',
      label: '1',
      appearance: { color: '#f97316', frontColor: '#ea580c', roofColor: '#facc15' },
      wantsToRun: true,
      blocked: true,
      motion: {
        cursor: { pieceId: first.id, direction: 'a-to-b', distance: 2 },
        speed: 3,
        status: 'running',
        stationServicedId: 'some-station',
        stationStopElapsed: 0.4,
      },
    }
    const other: RailFleetTrain = {
      id: 'train-2',
      label: '2',
      appearance: { color: '#0ea5e9', frontColor: '#0284c7', roofColor: '#e0f2fe' },
      wantsToRun: true,
      blocked: false,
      motion: { cursor: { pieceId: second.id, direction: 'a-to-b', distance: 0.5 }, speed: 2, status: 'running' },
    }
    const newCursor = { pieceId: second.id, direction: 'a-to-b' as const, distance: 1 }
    const moved = moveRailFleetTrainTo([moving, other], 'train-1', newCursor)

    expect(moved[0]?.motion).toEqual({ cursor: newCursor, speed: 0, status: 'ready' })
    expect(moved[0]?.motion.cursor).not.toBe(newCursor)
    expect(moved[0]?.wantsToRun).toBe(false)
    expect(moved[0]?.blocked).toBe(false)

    // 他の列車はクローンのみで内容は変わらない。
    expect(moved[1]).toEqual(other)
    expect(moved[1]).not.toBe(other)

    // 存在しないidならクローンだけを返す。
    expect(moveRailFleetTrainTo([moving, other], 'missing', newCursor)).toEqual([moving, other])
  })
})
