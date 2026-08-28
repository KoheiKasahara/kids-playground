import { describe, expect, it } from 'vitest'
import {
  TRAIN_CAR_COUNT,
  TRAIN_CAR_SPACING,
  TRAIN_END_STOP_MARGIN,
  TRAIN_STATION_STOP_DURATION,
  advanceRailTrainCursor,
  createInitialRailTrainMotion,
  distanceAheadToRailTrainCursor,
  distanceToRailTrainDeadEnd,
  distanceToRailTrainStation,
  findNextRailTrainStation,
  findNearestRailTrainCursor,
  getOccupiedRailPieceIds,
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
  toggleRailBranch,
  worldConnectorForRailPiece,
  worldRailPathPoint,
  type RailPiece,
} from './railModel'
import type { RailTrainMotion } from './railTrainModel'

describe('railTrainModel', () => {
  function makeBranchLayout(branchDirection: 'b' | 'c') {
    const branch = { ...createRailPiece('branch', 'branch'), branchDirection }
    const incoming = createRailPiece('straight', 'incoming')
    const tailB = createRailPiece('straight', 'tail-b')
    const tailC = createRailPiece('straight', 'tail-c')
    let layout = connectRailPieces([branch, incoming], incoming.id, 'b', branch.id, 'a')
    layout = connectRailPieces([...layout, tailB], tailB.id, 'a', branch.id, 'b')
    return connectRailPieces([...layout, tailC], tailC.id, 'a', branch.id, 'c')
  }

  it('locks the selected branch route on entry and ignores a switch during passage', () => {
    const routeB = makeBranchLayout('b')
    const incoming = routeB.find((piece) => piece.id === 'incoming')!
    const enteredB = advanceRailTrainCursor(routeB, {
      pieceId: incoming.id,
      direction: 'a-to-b',
      distance: railPathLength(incoming.path) - 0.2,
    }, 0.5)
    expect(enteredB.pieceId).toBe('branch')
    expect(enteredB.direction).toBe('a-to-b')

    const switchedWhilePassing = toggleRailBranch(routeB, 'branch')
    const branch = switchedWhilePassing.find((piece) => piece.id === 'branch')!
    const exitedLockedRoute = advanceRailTrainCursor(
      switchedWhilePassing,
      enteredB,
      railPathLength(branch.path),
    )
    expect(exitedLockedRoute.pieceId).toBe('tail-b')

    const routeC = makeBranchLayout('c')
    const incomingC = routeC.find((piece) => piece.id === 'incoming')!
    const enteredC = advanceRailTrainCursor(routeC, {
      pieceId: incomingC.id,
      direction: 'a-to-b',
      distance: railPathLength(incomingC.path) - 0.2,
    }, 0.5)
    expect(enteredC).toMatchObject({ pieceId: 'branch', direction: 'a-to-c' })
    const branchC = routeC.find((piece) => piece.id === 'branch')!
    const cPose = sampleRailTrainPose(routeC, {
      ...enteredC,
      distance: railPathLength(branchC.branchPath!) / 2,
    })
    expect(cPose?.position.z).toBeGreaterThan(0)
    const exitedC = advanceRailTrainCursor(routeC, enteredC, railPathLength(branchC.branchPath!))
    expect(exitedC.pieceId).toBe('tail-c')

    // 先頭がbranchを出た直後も、後続車が残っている間はUI側で
    // occupiedとして扱い、route切替を禁止できる。
    const branchB = routeB.find((piece) => piece.id === 'branch')!
    const leavingBranch = advanceRailTrainCursor(routeB, {
      pieceId: branchB.id,
      direction: 'b-to-a',
      distance: railPathLength(branchB.path) - 0.2,
    }, 0.5)
    expect(leavingBranch.pieceId).toBe('incoming')
    expect(getOccupiedRailPieceIds(routeB, leavingBranch)).toContain(branchB.id)
  })

  it('starts a train placed directly on a branch along its selected route', () => {
    const branch = { ...createRailPiece('branch', 'branch'), branchDirection: 'c' as const }
    const motion = createInitialRailTrainMotion([branch], branch.id)
    expect(motion?.cursor.direction).toBe('a-to-c')
    expect(motion?.cursor.distance).toBeLessThanOrEqual(railPathLength(branch.branchPath!))
  })

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

  it('keeps the existing straight-curve-straight route continuous', () => {
    const first = createRailPiece('straight', 'first')
    const curve = createRailPiece('curve', 'curve')
    const last = createRailPiece('straight', 'last')
    let connected = connectRailPieces([first, curve], curve.id, 'a', first.id, 'b')
    connected = connectRailPieces([...connected, last], last.id, 'a', curve.id, 'b')

    const cursor = advanceRailTrainCursor(connected, {
      pieceId: first.id,
      direction: 'a-to-b',
      distance: 1,
    }, railPathLength(first.path) - 1 + railPathLength(curve.path) + 0.75)
    expect(cursor).toEqual({ pieceId: last.id, direction: 'a-to-b', distance: 0.75 })
    const pose = sampleRailTrainPose(connected, cursor)
    expect(pose?.position.x).toBeTypeOf('number')
    expect(pose?.forward.x).toBeTypeOf('number')
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

  it('samples the reserved three-car formation across a connection and curve', () => {
    const first = createRailPiece('straight', 'first')
    const second = createRailPiece('curve', 'second', { x: 5.8, y: 0, z: 0 })
    const connected = connectRailPieces([first, second], 'second', 'a', 'first', 'b')
    const poses = sampleRailTrainCars(connected, {
      pieceId: second.id,
      direction: 'a-to-b',
      distance: 1,
    })
    expect(TRAIN_CAR_COUNT).toBe(3)
    expect(poses).toHaveLength(TRAIN_CAR_COUNT)
    expect(poses[0]?.cursor.pieceId).toBe(second.id)
    expect(poses[1]?.cursor.pieceId).toBe(first.id)
    expect(poses[1]?.cursor.distance).toBeCloseTo(railPathLength(first.path) - (TRAIN_CAR_SPACING - 1), 5)
    expect(poses[2]?.cursor.pieceId).toBe(first.id)
    expect(poses[2]?.cursor.distance).toBeCloseTo(railPathLength(first.path) - (TRAIN_CAR_SPACING * 2 - 1), 5)
    expect(poses[0]?.forward).not.toEqual(poses[1]?.forward)
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

  it('runs a closed curve loop for several laps without stopping or jumping at the boundary', () => {
    let loop: RailPiece[] = [createRailPiece('curve', 'p1')]
    for (const id of ['p2', 'p3', 'p4']) {
      const previous = loop[loop.length - 1]!
      loop = connectRailPieces([...loop, createRailPiece('curve', id)], id, 'a', previous.id, 'b')
    }
    loop = loop.map((piece) => {
      if (piece.id === 'p1') {
        return { ...piece, connections: { ...piece.connections, a: { pieceId: 'p4', connectorId: 'b' } } }
      }
      if (piece.id === 'p4') {
        return { ...piece, connections: { ...piece.connections, b: { pieceId: 'p1', connectorId: 'a' } } }
      }
      return piece
    })

    const lastPiece = loop.find((piece) => piece.id === 'p4')!
    expect(distanceAheadToRailTrainCursor(
      loop,
      { pieceId: lastPiece.id, direction: 'a-to-b', distance: railPathLength(lastPiece.path) - 0.25 },
      { pieceId: 'p1', direction: 'a-to-b', distance: 0.35 },
      2,
    )).toBeCloseTo(0.6)

    let motion: RailTrainMotion = {
      cursor: { pieceId: 'p1', direction: 'a-to-b', distance: 0.2 },
      speed: 0,
      status: 'running',
    }
    let previousPose = sampleRailTrainPose(loop, motion.cursor)!
    let pieceChanges = 0
    let maximumJump = 0
    for (let tick = 0; tick < 900; tick += 1) {
      const previousPieceId = motion.cursor.pieceId
      motion = updateRailTrainMotion(motion, loop, 0.05)
      const pose = sampleRailTrainPose(loop, motion.cursor)!
      maximumJump = Math.max(maximumJump, Math.hypot(
        pose.position.x - previousPose.position.x,
        pose.position.y - previousPose.position.y,
        pose.position.z - previousPose.position.z,
      ))
      if (motion.cursor.pieceId !== previousPieceId) pieceChanges += 1
      expect(motion.status).not.toBe('waiting')
      previousPose = pose
    }
    expect(pieceChanges).toBeGreaterThan(8)
    expect(maximumJump).toBeLessThan(0.3)
    expect(motion.speed).toBeGreaterThan(0)
  })

  it('measures same-route and opposing leaders, not a nearby disconnected track', () => {
    const first = createRailPiece('straight', 'first')
    const second = createRailPiece('straight', 'second')
    const connected = connectRailPieces([first, second], second.id, 'a', first.id, 'b')
    expect(distanceAheadToRailTrainCursor(
      connected,
      { pieceId: first.id, direction: 'a-to-b', distance: 4 },
      { pieceId: second.id, direction: 'a-to-b', distance: 1 },
      10,
    )).toBeCloseTo(2)

    const headOn = connectRailPieces([first, second], second.id, 'b', first.id, 'b')
    expect(distanceAheadToRailTrainCursor(
      headOn,
      { pieceId: first.id, direction: 'a-to-b', distance: 4 },
      { pieceId: second.id, direction: 'a-to-b', distance: 4 },
      10,
    )).toBeCloseTo(2)

    const overpass = createRailPiece('bridge', 'overpass', { x: 0, y: 0, z: 0 }, Math.PI / 2)
    expect(distanceAheadToRailTrainCursor(
      [first, overpass],
      { pieceId: first.id, direction: 'a-to-b', distance: 2 },
      { pieceId: overpass.id, direction: 'a-to-b', distance: 2 },
      10,
    )).toBeNull()
  })

  it('runs the depot second track along c-to-d and samples its offset position', () => {
    const depot = createRailPiece('depot', 'depot')
    const secondaryLength = railPathLength(depot.secondaryPath!)
    const cursor = advanceRailTrainCursor([depot], {
      pieceId: depot.id,
      direction: 'c-to-d',
      distance: 0,
    }, secondaryLength / 2)
    expect(cursor).toEqual({ pieceId: depot.id, direction: 'c-to-d', distance: secondaryLength / 2 })
    const pose = sampleRailTrainPose([depot], cursor)
    const local = sampleRailPath(depot.secondaryPath!, 0.5)
    expect(pose?.position.x).toBeCloseTo(local.x)
    expect(pose?.position.z).toBeCloseTo(local.z)
  })

  it('crosses between the depot d connector and an attached straight in both directions', () => {
    const depot = createRailPiece('depot', 'depot')
    const worldD = worldConnectorForRailPiece(depot, 'd')
    // tailの'a'がぴったりworldDへ重なる位置に置く(tailの'a'ローカルはx=-2.5)。
    const tail = createRailPiece('straight', 'tail', {
      x: worldD.position.x + 2.5,
      y: worldD.position.y,
      z: worldD.position.z,
    })
    const connected = connectRailPieces([depot, tail], tail.id, 'a', depot.id, 'd')
    const secondaryLength = railPathLength(depot.secondaryPath!)
    const tailLength = railPathLength(tail.path)

    const crossedOnto = advanceRailTrainCursor(connected, {
      pieceId: depot.id,
      direction: 'c-to-d',
      distance: secondaryLength - 0.5,
    }, 1)
    expect(crossedOnto.pieceId).toBe(tail.id)
    expect(crossedOnto.direction).toBe('a-to-b')

    const crossedBack = advanceRailTrainCursor(connected, {
      pieceId: tail.id,
      direction: 'b-to-a',
      distance: tailLength - 0.5,
    }, 1)
    expect(crossedBack.pieceId).toBe(depot.id)
    expect(crossedBack.direction).toBe('d-to-c')
  })

  describe('findNearestRailTrainCursor', () => {
    it('finds the cursor and rail-space distance for the nearest piece', () => {
      const first = createRailPiece('straight', 'first')
      const second = createRailPiece('straight', 'second', { x: 5.8, y: 0, z: 0 })
      const pieces = connectRailPieces([first, second], 'second', 'a', 'first', 'b')
      const secondPiece = pieces.find((piece) => piece.id === 'second')!
      const onPath = worldRailPathPoint(secondPiece, 0.5)
      const nudged = { x: onPath.x, y: onPath.y, z: onPath.z + 0.2 }

      const found = findNearestRailTrainCursor(pieces, nudged)
      expect(found).not.toBeNull()
      if (found === null) return
      expect(found.cursor.pieceId).toBe('second')
      expect(found.cursor.direction).toBe('a-to-b')
      expect(found.distance).toBeCloseTo(0.2, 1)
      const pose = sampleRailTrainPose(pieces, found.cursor)
      expect(pose?.position.x).toBeCloseTo(onPath.x, 1)
      expect(pose?.position.z).toBeCloseTo(onPath.z, 1)
    })

    it('returns null beyond maxDistance and for an empty layout', () => {
      const piece = createRailPiece('straight', 'lone')
      expect(findNearestRailTrainCursor([piece], { x: 0, y: 0, z: 50 })).toBeNull()
      expect(findNearestRailTrainCursor([piece], { x: 0, y: 0, z: 3 }, { maxDistance: 1 })).toBeNull()
      expect(findNearestRailTrainCursor([], { x: 0, y: 0, z: 0 })).toBeNull()
    })

    it('reverses direction when preferForward opposes the tangent, without moving the physical point', () => {
      const piece = createRailPiece('straight', 'straight')
      const midpoint = worldRailPathPoint(piece, 0.5)
      const forward = findNearestRailTrainCursor([piece], midpoint, { preferForward: { x: 1, y: 0, z: 0 } })
      const backward = findNearestRailTrainCursor([piece], midpoint, { preferForward: { x: -1, y: 0, z: 0 } })
      expect(forward?.cursor.direction).toBe('a-to-b')
      expect(backward?.cursor.direction).toBe('b-to-a')
      const forwardPose = sampleRailTrainPose([piece], forward!.cursor)
      const backwardPose = sampleRailTrainPose([piece], backward!.cursor)
      expect(backwardPose?.position.x).toBeCloseTo(forwardPose!.position.x, 3)
      expect(backwardPose?.position.z).toBeCloseTo(forwardPose!.position.z, 3)
    })

    it('finds a cursor on the depot second track', () => {
      const depot = createRailPiece('depot', 'depot')
      const midpoint = worldRailPathPoint(depot, 0.5, depot.secondaryPath)
      const found = findNearestRailTrainCursor([depot], midpoint)
      expect(found?.cursor.pieceId).toBe(depot.id)
      expect(found?.cursor.direction).toBe('c-to-d')
      expect(found?.distance).toBeCloseTo(0, 3)
    })
  })
})
