import { describe, expect, it } from 'vitest'
import {
  appendRailPiece,
  areRailConnectionsSymmetric,
  connectRailPieces,
  createRailPiece,
  distanceBetweenRailPoints,
  DRAG_SNAP_DISTANCE,
  ELEVATED_HEIGHT,
  findRailDragSnapCandidate,
  STRAIGHT_LENGTH,
  turnRailPiece,
  worldConnectorForRailPiece,
  type RailPiece,
} from './railModel'

// 4歳児向けの操作性改善（自動接続・つながったまま回す・向きを問わないドラッグ吸着）。
const origin = { x: 0, y: 0, z: 0 }
const fallback = { x: 12, y: 0, z: 12 }

function byId(pieces: readonly RailPiece[], id: string): RailPiece {
  const piece = pieces.find((candidate) => candidate.id === id)
  if (piece === undefined) throw new Error(`${id}がありません`)
  return piece
}

function jointGap(pieces: readonly RailPiece[], aId: string, bId: string): number {
  const a = byId(pieces, aId)
  const connectorId = Object.entries(a.connections).find(([, connection]) => connection?.pieceId === bId)?.[0]
  if (connectorId === undefined) throw new Error(`${aId}と${bId}がつながっていません`)
  const connection = a.connections[connectorId as 'a']!
  return distanceBetweenRailPoints(
    worldConnectorForRailPiece(a, connectorId as 'a').position,
    worldConnectorForRailPiece(byId(pieces, bId), connection.connectorId).position,
  )
}

describe('appendRailPiece: 坂は つながる向きに自動で変わる', () => {
  it('地面の線路からは上り坂としてつながる', () => {
    const result = appendRailPiece([createRailPiece('straight', 's1', origin)], 'slope', 'added', 's1', {
      fallbackPosition: fallback,
    })
    expect(result.connected).toBe(true)
    expect(result.piece.connections.a).toEqual({ pieceId: 's1', connectorId: 'b' })
    expect(result.piece.position.y).toBeCloseTo(0)
  })

  it('橋の上からは下り坂としてつながり、地面へ降りる', () => {
    const result = appendRailPiece([createRailPiece('bridge', 'br', origin)], 'slope', 'added', 'br', {
      fallbackPosition: fallback,
    })
    expect(result.connected).toBe(true)
    expect(result.piece.connections.b).toEqual({ pieceId: 'br', connectorId: 'b' })
    expect(result.piece.position.y).toBeCloseTo(0)
    expect(worldConnectorForRailPiece(result.piece, 'a').position.y).toBeCloseTo(0)
    expect(worldConnectorForRailPiece(result.piece, 'b').position.y).toBeCloseTo(ELEVATED_HEIGHT)
    expect(jointGap(result.pieces, 'added', 'br')).toBeLessThan(1e-9)
  })

  it('上り坂の上に橋をつなぐと、橋は坂の高さにそろう', () => {
    const up = appendRailPiece([createRailPiece('straight', 's1', origin)], 'slope', 'up', 's1', {
      fallbackPosition: fallback,
    })
    const result = appendRailPiece(up.pieces, 'bridge', 'bridge', 'up', { fallbackPosition: fallback })
    expect(result.connected).toBe(true)
    expect(result.piece.position.y).toBeCloseTo(0)
    expect(jointGap(result.pieces, 'bridge', 'up')).toBeLessThan(1e-9)
  })
})

describe('appendRailPiece: 線路の途中を選んでいても つづきへ のびる', () => {
  function chain(): RailPiece[] {
    let pieces = [
      createRailPiece('straight', 's1', origin),
      createRailPiece('straight', 's2', origin),
      createRailPiece('straight', 's3', origin),
    ]
    pieces = connectRailPieces(pieces, 's2', 'a', 's1', 'b')
    pieces = connectRailPieces(pieces, 's3', 'a', 's2', 'b')
    return pieces
  }

  it('searchConnectedEndsなら、つながった先の空き端へつなぐ', () => {
    const result = appendRailPiece(chain(), 'straight', 'added', 's2', {
      fallbackPosition: fallback,
      searchConnectedEnds: true,
    })
    expect(result.connected).toBe(true)
    expect(result.piece.connections.a).toEqual({ pieceId: 's3', connectorId: 'b' })
    expect(areRailConnectionsSymmetric(result.pieces)).toBe(true)
  })

  it('指定しなければ従来どおり未接続で置く', () => {
    const result = appendRailPiece(chain(), 'straight', 'added', 's2', { fallbackPosition: fallback })
    expect(result.connected).toBe(false)
  })
})

describe('turnRailPiece: つながったまま向きを切りかえる', () => {
  function straightWith(kind: 'curve' | 'slope' | 'straight' | 'branch'): RailPiece[] {
    return appendRailPiece([createRailPiece('straight', 's1', origin)], kind, 'p', 's1', {
      fallbackPosition: fallback,
    }).pieces
  }

  it('カーブは左曲がりと右曲がりを行き来し、接続は切れない', () => {
    const start = straightWith('curve')
    const first = turnRailPiece(start, 'p')
    expect(first.changed).toBe(true)
    const turned = byId(first.pieces, 'p')
    expect(turned.connections.b).toEqual({ pieceId: 's1', connectorId: 'b' })
    expect(jointGap(first.pieces, 'p', 's1')).toBeLessThan(1e-9)
    expect(areRailConnectionsSymmetric(first.pieces)).toBe(true)
    // 左右で出口の位置が反対側になる
    const beforeExit = worldConnectorForRailPiece(byId(start, 'p'), 'b').position
    const afterExit = worldConnectorForRailPiece(turned, 'a').position
    expect(Math.sign(afterExit.z)).toBe(-Math.sign(beforeExit.z))

    const second = turnRailPiece(first.pieces, 'p')
    const back = byId(second.pieces, 'p')
    expect(back.connections.a).toEqual({ pieceId: 's1', connectorId: 'b' })
    expect(back.rotationY).toBeCloseTo(byId(start, 'p').rotationY)
  })

  it('坂は上りと下りを切りかえる', () => {
    const start = straightWith('slope')
    const result = turnRailPiece(start, 'p')
    expect(result.changed).toBe(true)
    const slope = byId(result.pieces, 'p')
    expect(slope.connections.b).toEqual({ pieceId: 's1', connectorId: 'b' })
    expect(jointGap(result.pieces, 'p', 's1')).toBeLessThan(1e-9)
  })

  it('分岐は3つの入口を順にまわる', () => {
    const start = straightWith('branch')
    const seen = new Set<string>()
    let pieces = start
    for (let index = 0; index < 3; index += 1) {
      const piece = byId(pieces, 'p')
      const connectorId = Object.entries(piece.connections).find(([, connection]) => connection?.pieceId === 's1')?.[0]
      seen.add(connectorId ?? 'none')
      pieces = turnRailPiece(pieces, 'p').pieces
    }
    expect([...seen].sort()).toEqual(['a', 'b', 'c'])
  })

  it('直線のように見た目が変わらないものは、そのまま（接続も保つ）', () => {
    const start = straightWith('straight')
    const result = turnRailPiece(start, 'p')
    expect(result.changed).toBe(false)
    expect(byId(result.pieces, 'p').connections.a).toEqual({ pieceId: 's1', connectorId: 'b' })
  })

  it('つながっていないpieceは90°回り、回した先で向き合えばつながる', () => {
    // s1のBの先に、縦向き(90°)の直線を置く。回すとs1へ向き合う。
    const loose = createRailPiece('straight', 'p', origin, Math.PI / 2)
    const target = createRailPiece('straight', 's1', origin)
    // pを回したあとの中心がs1のBの先(x=5)になるように置く
    const placed: RailPiece = { ...loose, position: { x: STRAIGHT_LENGTH, y: 0, z: 0 } }
    const result = turnRailPiece([target, placed], 'p')
    expect(result.changed).toBe(true)
    expect(result.connected.length).toBeGreaterThan(0)
    expect(areRailConnectionsSymmetric(result.pieces)).toBe(true)
    expect(Object.keys(byId(result.pieces, 'p').connections)).toHaveLength(1)
  })
})

describe('findRailDragSnapCandidate: 向きが合っていなくても近づければつながる', () => {
  it('直角に置いた直線の端を近づけると、向きを変えてつながる', () => {
    const target = createRailPiece('straight', 's1', origin)
    // s1のB(x=2.5)の近くに、縦向きの直線のAが来るように置く
    const moving = createRailPiece('straight', 'm', { x: 2.5 + 0.3, y: 0, z: STRAIGHT_LENGTH / 2 }, -Math.PI / 2)
    const aPos = worldConnectorForRailPiece(moving, 'a').position
    expect(Math.hypot(aPos.x - 2.5, aPos.z)).toBeLessThan(DRAG_SNAP_DISTANCE)

    const candidate = findRailDragSnapCandidate(moving, [target])
    expect(candidate).not.toBeNull()
    expect(candidate!.targetConnectorId).toBe('b')
    const snapped = connectRailPieces([target, moving], 'm', candidate!.movingConnectorId, 's1', 'b', candidate!.transform)
    expect(jointGap(snapped, 'm', 's1')).toBeLessThan(1e-9)
    // つないだあとは一直線（s1から+X方向へ伸びる）
    expect(byId(snapped, 'm').position.z).toBeCloseTo(0)
  })

  it('坂の上の端を地面の線路へ近づけると、坂が反転して上り口がつながる', () => {
    const target = createRailPiece('straight', 's1', origin)
    // 坂のB(高さ2)がs1のBの近くに来る置き方。高さが合わないのでAでつながる。
    const slope = createRailPiece('slope', 'm', { x: 2.5 + 5 + 0.2, y: 0, z: 0 }, Math.PI)
    const candidate = findRailDragSnapCandidate(slope, [target])
    expect(candidate).not.toBeNull()
    expect(candidate!.movingConnectorId).toBe('a')
    const snapped = connectRailPieces([target, slope], 'm', 'a', 's1', 'b', candidate!.transform)
    expect(jointGap(snapped, 'm', 's1')).toBeLessThan(1e-9)
    expect(worldConnectorForRailPiece(byId(snapped, 'm'), 'b').position.x).toBeGreaterThan(5)
  })

  it('遠ければつながらない', () => {
    const target = createRailPiece('straight', 's1', origin)
    const moving = createRailPiece('straight', 'm', { x: 12, y: 0, z: 6 }, Math.PI / 3)
    expect(findRailDragSnapCandidate(moving, [target])).toBeNull()
  })

  it('一度吸いついた相手は、少し離れても保つ', () => {
    const target = createRailPiece('straight', 's1', origin)
    const near = createRailPiece('straight', 'm', { x: STRAIGHT_LENGTH + 0.5, y: 0, z: 0 })
    const first = findRailDragSnapCandidate(near, [target])
    expect(first).not.toBeNull()
    const farther: RailPiece = { ...near, position: { x: STRAIGHT_LENGTH + DRAG_SNAP_DISTANCE * 1.15, y: 0, z: 0 } }
    expect(findRailDragSnapCandidate(farther, [target])).toBeNull()
    expect(findRailDragSnapCandidate(farther, [target], first)).not.toBeNull()
  })

  it('既存パーツの真上に重なる向きは選ばない', () => {
    const target = createRailPiece('straight', 's1', origin)
    const blocker = createRailPiece('straight', 'blocker', { x: STRAIGHT_LENGTH, y: 0, z: 0 })
    const moving = createRailPiece('straight', 'm', { x: 2.5 + 0.3, y: 0, z: STRAIGHT_LENGTH / 2 }, -Math.PI / 2)
    const candidate = findRailDragSnapCandidate(moving, [target, blocker])
    if (candidate !== null) expect(candidate.targetPieceId).not.toBe('s1')
  })
})
