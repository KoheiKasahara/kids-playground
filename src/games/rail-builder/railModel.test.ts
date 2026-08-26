import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SNAP_ANGLE,
  DEPOT_TRACK_SPACING,
  ELEVATED_HEIGHT,
  ELEVATED_LENGTH,
  LOOP_CLOSURE_MAX_ANGLE_DIFFERENCE,
  LOOP_CLOSURE_MAX_DISTANCE,
  LOOP_CLOSURE_MAX_HEIGHT_DIFFERENCE,
  SHORT_STRAIGHT_LENGTH,
  SLOPE_LENGTH,
  applyRailLoopClosure,
  areRailConnectionsSymmetric,
  connectRailPieces,
  createRailPiece,
  deleteRailPiece,
  disconnectRailPiece,
  findRailLoopClosureCandidate,
  findRailSnapCandidate,
  findRailSnapNearMiss,
  getRailConnectorIds,
  moveRailPiece,
  railPathLength,
  sampleRailPath,
  sampleRailPathTangent,
  toggleRailBranch,
  worldConnectorForRailPiece,
  type RailPiece,
} from './railModel'
import { distanceToRailTrainDeadEnd } from './railTrainModel'

const origin = { x: 0, y: 0, z: 0 }

describe('branch rail model', () => {
  it('has three connectors, snaps connector c, keeps links symmetric, and toggles purely', () => {
    const branch = createRailPiece('branch', 'branch', origin)
    expect(getRailConnectorIds(branch)).toEqual(['a', 'b', 'c'])
    expect(branch.connectorC).toBeDefined()
    expect(branch.branchPath).toBeDefined()
    expect(branch.branchDirection).toBe('b')

    const tail = createRailPiece('straight', 'tail', { x: 20, y: 0, z: 20 })
    const connected = connectRailPieces([branch, tail], tail.id, 'a', branch.id, 'c')
    expect(areRailConnectionsSymmetric(connected)).toBe(true)
    expect(connected.find((piece) => piece.id === branch.id)?.connections.c).toEqual({
      pieceId: tail.id,
      connectorId: 'a',
    })

    const detached = disconnectRailPiece(connected, tail.id)
    const detachedTail = detached.find((piece) => piece.id === tail.id)!
    const detachedBranch = detached.find((piece) => piece.id === branch.id)!
    expect(findRailSnapCandidate(detachedTail, [detachedBranch], 'a')?.targetConnectorId).toBe('c')

    const toggled = toggleRailBranch(connected, branch.id)
    expect(toggled.find((piece) => piece.id === branch.id)?.branchDirection).toBe('c')
    expect(connected.find((piece) => piece.id === branch.id)?.branchDirection).toBe('b')
    expect(toggleRailBranch(toggled, branch.id).find((piece) => piece.id === branch.id)?.branchDirection).toBe('b')
  })

  it('keeps the branch path endpoint and connector c aligned', () => {
    const branch = createRailPiece('branch', 'branch', origin)
    const endpoint = sampleRailPath(branch.branchPath!, 1)
    expect(endpoint).toEqual(branch.connectorC?.localPosition)
    expect(railPathLength(branch.branchPath!)).toBeGreaterThan(railPathLength(branch.path))
  })
})

describe('depot rail model', () => {
  it('has four connectors on two parallel tracks, and clone/rotate/world transforms keep connector d intact', () => {
    const depot = createRailPiece('depot', 'depot', origin)
    expect(getRailConnectorIds(depot)).toEqual(['a', 'b', 'c', 'd'])
    expect(depot.connectorC).toBeDefined()
    expect(depot.connectorD).toBeDefined()
    expect(depot.secondaryPath).toBeDefined()
    expect(depot.branchPath).toBeUndefined()
    expect(depot.branchDirection).toBeUndefined()

    // 1番線(path)と2番線(secondaryPath)はDEPOT_TRACK_SPACINGだけ離れた平行線。
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const primary = sampleRailPath(depot.path, t)
      const secondary = sampleRailPath(depot.secondaryPath!, t)
      expect(secondary.x).toBeCloseTo(primary.x)
      expect(secondary.y).toBeCloseTo(primary.y)
      expect(secondary.z - primary.z).toBeCloseTo(DEPOT_TRACK_SPACING)
    }

    // clone(rotateRailPiece経由)・回転・world変換を経てもconnectorDが壊れない。
    const rotated = createRailPiece('depot', 'depot-r', { x: 5, y: 0, z: -2 }, Math.PI / 4)
    const spun = moveRailPiece([rotated], rotated.id, { position: { x: 8, y: 0, z: 3 } })
    const spunDepot = spun.find((piece) => piece.id === rotated.id)!
    expect(spunDepot.connectorD).toBeDefined()
    const worldD = worldConnectorForRailPiece(spunDepot, 'd')
    expect(Number.isFinite(worldD.position.x)).toBe(true)
    expect(Number.isFinite(worldD.position.z)).toBe(true)
    expect(Math.hypot(worldD.outward.x, worldD.outward.z)).toBeCloseTo(1)
  })

  it('lets another piece snap-connect to the depot d endpoint', () => {
    const depot = createRailPiece('depot', 'depot', origin)
    const worldD = worldConnectorForRailPiece(depot, 'd')
    // tailの'a'がぴったりworldDへ重なる位置に置く(tailの'a'ローカルはx=-2.5)。
    const tail = createRailPiece('straight', 'tail', {
      x: worldD.position.x + 2.5,
      y: worldD.position.y,
      z: worldD.position.z,
    })
    const candidate = findRailSnapCandidate(tail, [depot])
    expect(candidate).not.toBeNull()
    if (candidate === null) return
    expect(candidate.targetConnectorId).toBe('d')

    const connected = connectRailPieces(
      [depot, tail],
      tail.id,
      candidate.movingConnectorId,
      depot.id,
      'd',
      candidate.transform,
    )
    expect(areRailConnectionsSymmetric(connected)).toBe(true)
    expect(connected.find((piece) => piece.id === depot.id)?.connections.d).toEqual({
      pieceId: tail.id,
      connectorId: candidate.movingConnectorId,
    })
  })

  it('excludes depot pieces and connector d from loop closure auto-correction', () => {
    const fixedPiece = createRailPiece('straight', 'fixed', origin)
    // 通常しきい値の外、ループ用しきい値の内側になる距離だけ離す(branchのテストと同じ考え方)。
    // depot.aのローカルzオフセット(-DEPOT_TRACK_SPACING/2)を、position.zで打ち消してある。
    const farDepot = createRailPiece('depot', 'far', { x: 7.6, y: 0, z: DEPOT_TRACK_SPACING / 2 })
    const { anchorId, targets } = anchorFarPiece(farDepot, 'b')

    expect(findRailSnapCandidate(farDepot, targets, 'a')).toBeNull()
    // depot自体は、通常なら候補になり得る距離・向きでもループ閉鎖の相手にならない。
    expect(findRailLoopClosureCandidate(fixedPiece, 'b', targets, anchorId)).toBeNull()

    // depot自身の端点(a/d)を固定側にした場合も、常に候補探索そのものをしない。
    const depotFixed = createRailPiece('depot', 'depot-fixed', origin)
    const other = createRailPiece('straight', 'other', { x: 10, y: 0, z: -DEPOT_TRACK_SPACING / 2 })
    expect(findRailLoopClosureCandidate(depotFixed, 'd', [other], 'other')).toBeNull()
    expect(findRailLoopClosureCandidate(depotFixed, 'a', [other], 'other')).toBeNull()
  })
})

/** targets内でanchorとfarPieceだけをつなぎ、他は動かさない最小の「既存チェーン」を作る。 */
function anchorFarPiece(
  farPiece: RailPiece,
  farAnchorConnectorId: 'a' | 'b',
): { anchorId: string; targets: RailPiece[] } {
  const anchor = createRailPiece('straight', 'anchor', { x: 999, y: 0, z: 999 })
  const connected = connectRailPieces(
    [farPiece, anchor],
    'anchor',
    'a',
    farPiece.id,
    farAnchorConnectorId,
  )
  return { anchorId: 'anchor', targets: connected }
}

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

  describe('loop closure assist', () => {
    it('connects a slightly offset endpoint that is out of normal snap range', () => {
      const fixedPiece = createRailPiece('straight', 'fixed', origin)
      // 通常しきい値(1.15)の外、ループ用しきい値の内側になる距離だけ離す。
      const farPiece = createRailPiece('straight', 'far', { x: 6.6, y: 0, z: 0 })
      const { anchorId, targets } = anchorFarPiece(farPiece, 'b')

      expect(findRailSnapCandidate(farPiece, targets, 'a')).toBeNull()

      const candidate = findRailLoopClosureCandidate(fixedPiece, 'b', targets, anchorId)
      expect(candidate).not.toBeNull()
      if (candidate === null) return
      expect(candidate.movingPieceId).toBe('far')
      expect(candidate.distance).toBeGreaterThan(1.15)
      expect(candidate.distance).toBeLessThanOrEqual(LOOP_CLOSURE_MAX_DISTANCE)

      const closed = applyRailLoopClosure([fixedPiece, ...targets], candidate)
      expect(areRailConnectionsSymmetric(closed)).toBe(true)
      const closedFixed = closed.find((piece) => piece.id === 'fixed')
      const closedFar = closed.find((piece) => piece.id === 'far')
      expect(closedFixed?.connections.b).toEqual({ pieceId: 'far', connectorId: 'a' })
      expect(closedFar?.connections.a).toEqual({ pieceId: 'fixed', connectorId: 'b' })
      const fixedConnector = worldConnectorForRailPiece(closedFixed!, 'b')
      const farConnector = worldConnectorForRailPiece(closedFar!, 'a')
      expect(farConnector.position.x).toBeCloseTo(fixedConnector.position.x, 5)
      expect(farConnector.position.z).toBeCloseTo(fixedConnector.position.z, 5)
    })

    it('rejects endpoints that are too far away', () => {
      const fixedPiece = createRailPiece('straight', 'fixed', origin)
      const farPiece = createRailPiece('straight', 'far', { x: 12, y: 0, z: 0 })
      const { anchorId, targets } = anchorFarPiece(farPiece, 'b')
      expect(findRailLoopClosureCandidate(fixedPiece, 'b', targets, anchorId)).toBeNull()
    })

    it('rejects endpoints facing the wrong direction', () => {
      const fixedPiece = createRailPiece('straight', 'fixed', origin)
      // 通常しきい値付近の距離だが、90度ずれた向き。
      const farPiece = createRailPiece('straight', 'far', { x: 4.2, y: 0, z: 2 }, Math.PI / 2)
      const { anchorId, targets } = anchorFarPiece(farPiece, 'b')
      expect(findRailLoopClosureCandidate(fixedPiece, 'b', targets, anchorId)).toBeNull()
    })

    it('rejects endpoints facing directly opposite (reversed) direction', () => {
      const fixedPiece = createRailPiece('straight', 'fixed', origin)
      const farPiece = createRailPiece('straight', 'far', { x: 4.2, y: 0, z: 0 }, Math.PI)
      const { anchorId, targets } = anchorFarPiece(farPiece, 'b')
      expect(findRailLoopClosureCandidate(fixedPiece, 'b', targets, anchorId)).toBeNull()
    })

    it('rejects endpoints with a large height difference', () => {
      const fixedPiece = createRailPiece('straight', 'fixed', origin)
      const farPiece = createRailPiece('straight', 'far', { x: 6.6, y: 1.4, z: 0 })
      const { anchorId, targets } = anchorFarPiece(farPiece, 'b')
      expect(LOOP_CLOSURE_MAX_HEIGHT_DIFFERENCE).toBeLessThan(1.4)
      expect(findRailLoopClosureCandidate(fixedPiece, 'b', targets, anchorId)).toBeNull()
    })

    it('does not connect to an unrelated endpoint that is not part of the same chain', () => {
      const fixedPiece = createRailPiece('straight', 'fixed', origin)
      const farPiece = createRailPiece('straight', 'far', { x: 6.6, y: 0, z: 0 })
      // farPieceが接続されているのはunrelatedAnchorだけで、fixedPiece側の
      // 継ぎ目とは無関係な、閉路を作らない組み合わせ。
      const unrelatedAnchor = createRailPiece('straight', 'unrelated-anchor', { x: 999, y: 0, z: 999 })
      const connected = connectRailPieces([farPiece, unrelatedAnchor], 'unrelated-anchor', 'a', 'far', 'b')
      expect(findRailLoopClosureCandidate(fixedPiece, 'b', connected, 'some-other-piece-not-in-chain')).toBeNull()
    })

    it('keeps normal, well-aligned connections unaffected (loop closure is not needed)', () => {
      const fixedPiece = createRailPiece('straight', 'fixed', origin)
      const farPiece = createRailPiece('straight', 'far', { x: 5.05, y: 0, z: 0 })
      // 通常しきい値で十分つながる距離では、findRailSnapCandidate側で解決できる。
      expect(findRailSnapCandidate(farPiece, [fixedPiece], 'a')).not.toBeNull()
    })

    it('spreads a small accumulated gap over the last few pieces to close a big loop, and the train can lap it', () => {
      const p1 = createRailPiece('curve', 'p1', origin, 0, 'left')
      let layout: RailPiece[] = [p1]
      for (const id of ['p2', 'p3', 'p4']) {
        const previousId = layout[layout.length - 1]!.id
        const draft = createRailPiece('curve', id, origin, 0, 'left')
        layout = connectRailPieces([...layout, draft], id, 'a', previousId, 'b')
      }

      // 摂動なしなら4つの90度カーブがちょうど1周して閉じることを確認する。
      const openStart = worldConnectorForRailPiece(layout.find((p) => p.id === 'p1')!, 'a')
      const openEnd = worldConnectorForRailPiece(layout.find((p) => p.id === 'p4')!, 'b')
      expect(openEnd.position.x).toBeCloseTo(openStart.position.x, 5)
      expect(openEnd.position.z).toBeCloseTo(openStart.position.z, 5)

      // p4だけを、通常のsnapでは届かない程度に少しだけずらす
      // （現実には複数パーツの誤差が積み重なって生じるズレを1箇所に凝縮して再現）。
      const originalP4 = layout.find((p) => p.id === 'p4')!
      const originalP1 = layout.find((p) => p.id === 'p1')!
      const originalP2 = layout.find((p) => p.id === 'p2')!
      const originalP3 = layout.find((p) => p.id === 'p3')!
      const perturbedP4: RailPiece = {
        ...originalP4,
        position: {
          x: originalP4.position.x + 1.8,
          y: originalP4.position.y,
          z: originalP4.position.z + 0.8,
        },
        rotationY: originalP4.rotationY + (8 * Math.PI) / 180,
      }
      const perturbedLayout = layout.map((piece) => (piece.id === 'p4' ? perturbedP4 : piece))
      const targets = perturbedLayout.filter((piece) => piece.id !== 'p4')

      expect(findRailSnapCandidate(perturbedP4, targets, 'b')).toBeNull()

      const candidate = findRailLoopClosureCandidate(perturbedP4, 'b', targets, 'p3')
      expect(candidate).not.toBeNull()
      if (candidate === null) return
      expect(candidate.movingPieceId).toBe('p1')

      const closed = applyRailLoopClosure(perturbedLayout, candidate)
      expect(areRailConnectionsSymmetric(closed)).toBe(true)

      const closedP4 = closed.find((piece) => piece.id === 'p4')!
      const closedP1 = closed.find((piece) => piece.id === 'p1')!
      const closedP2 = closed.find((piece) => piece.id === 'p2')!
      const closedP3 = closed.find((piece) => piece.id === 'p3')!

      // 閉じた継ぎ目はぴったり一致する（隙間ゼロ）。
      const p4Open = worldConnectorForRailPiece(closedP4, 'b')
      const p1Open = worldConnectorForRailPiece(closedP1, 'a')
      expect(p4Open.position.x).toBeCloseTo(p1Open.position.x, 5)
      expect(p4Open.position.z).toBeCloseTo(p1Open.position.z, 5)
      expect(p4Open.outward.x).toBeCloseTo(-p1Open.outward.x, 5)
      expect(p4Open.outward.z).toBeCloseTo(-p1Open.outward.z, 5)

      // p4(ドラッグ確定済みの側)はそのままの位置を保つ。
      expect(closedP4.position).toEqual(perturbedP4.position)
      expect(closedP4.rotationY).toBe(perturbedP4.rotationY)

      // 補正はp1だけに集中せず、p2・p3にも分散し、かつ奥ほど小さい。
      const rotationChange = (piece: RailPiece, original: RailPiece) => Math.abs(piece.rotationY - original.rotationY)
      const p1Change = rotationChange(closedP1, originalP1)
      const p2Change = rotationChange(closedP2, originalP2)
      const p3Change = rotationChange(closedP3, originalP3)
      expect(p1Change).toBeGreaterThan(0)
      expect(p2Change).toBeGreaterThan(0)
      expect(p3Change).toBeGreaterThan(0)
      expect(p2Change).toBeLessThan(p1Change)
      expect(p3Change).toBeLessThan(p2Change)
      // 補正量そのものが安全上限の角度以内に収まっている。
      expect(p1Change).toBeLessThanOrEqual(LOOP_CLOSURE_MAX_ANGLE_DIFFERENCE)

      // 走行Pathは閉路として扱われる（行き止まりまでの距離が無限大）。
      expect(distanceToRailTrainDeadEnd(closed, { pieceId: 'p1', direction: 'a-to-b', distance: 0 })).toBe(Infinity)
      expect(distanceToRailTrainDeadEnd(closed, { pieceId: 'p3', direction: 'b-to-a', distance: 1 })).toBe(Infinity)
    })

    it('does not touch facility pieces near the closing end (station/tunnel/bridge/slope are skipped)', () => {
      // p1 - station - p3 という並び（station.bとp3.aが接続済み）で、
      // p3.bがp1.aへループを閉じようとしている状況を、接続グラフだけ
      // 手で配線して再現する（stationの実際の位置は補正対象外なので任意でよい）。
      const p1: RailPiece = {
        ...createRailPiece('straight', 'p1', origin),
        connections: { b: { pieceId: 'station', connectorId: 'a' } },
      }
      const originalStation: RailPiece = {
        ...createRailPiece('station', 'station', { x: 40, y: 0, z: 40 }),
        connections: {
          a: { pieceId: 'p1', connectorId: 'b' },
          b: { pieceId: 'p3', connectorId: 'a' },
        },
      }
      // rotationY=0・position=(-5,0,0)は、p3.bがp1.aへ隙間ゼロで一致する位置。
      const originalP3: RailPiece = {
        ...createRailPiece('straight', 'p3', { x: -5, y: 0, z: 0 }),
        connections: { a: { pieceId: 'station', connectorId: 'b' } },
      }
      const perturbedP3: RailPiece = {
        ...originalP3,
        position: {
          x: originalP3.position.x + 1.6,
          y: originalP3.position.y,
          z: originalP3.position.z + 0.6,
        },
        rotationY: originalP3.rotationY + (10 * Math.PI) / 180,
      }
      const targets = [p1, originalStation]

      expect(findRailSnapCandidate(perturbedP3, targets, 'b')).toBeNull()

      const candidate = findRailLoopClosureCandidate(perturbedP3, 'b', targets, 'station')
      expect(candidate).not.toBeNull()
      if (candidate === null) return
      // 施設(station)自身がループを閉じる相手側になることはない。
      expect(candidate.movingPieceId).not.toBe('station')
      expect(candidate.movingPieceId).toBe('p1')

      const closed = applyRailLoopClosure([...targets, perturbedP3], candidate)
      const closedStation = closed.find((piece) => piece.id === 'station')!
      expect(closedStation.position).toEqual(originalStation.position)
      expect(closedStation.rotationY).toBe(originalStation.rotationY)
    })
  })
})
