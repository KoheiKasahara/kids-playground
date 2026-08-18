import type { DominoPlacement } from './dominoLayout'

/** Phase 6は1球だけ。ドミノより十分重いが、極端な質量にはしない。 */
export const BALL_RADIUS = 0.42
export const BALL_MASS = 0.38
export const BALL_FRICTION = 0.34
export const BALL_RESTITUTION = 0.03

/** ボールの左右に確保する内寸と、見えるガイド壁の高さ。 */
export const BALL_RAIL_WIDTH = 1.18
export const BALL_RAIL_THICKNESS = 0.1
export const BALL_RAIL_WALL_THICKNESS = 0.09
export const BALL_RAIL_WALL_HEIGHT = 0.24
export const BALL_RAIL_FRICTION = 0.62

/** スタート台は水平にして、前段ドミノが押すまで球が動かないようにする。 */
export const BALL_START_DECK_LENGTH = 0.3
export const BALL_START_DECK_SURFACE_Y = 0.22
/** 約10.8ユニットの区間で0.18下げる、見た目にも急すぎない坂。 */
export const BALL_EXIT_SURFACE_Y = 0.04

export type BallRailSegment = {
  start: { x: number; y: number; z: number }
  end: { x: number; y: number; z: number }
}

export type BallRailPiece = {
  kind: 'deck' | 'ramp'
  center: { x: number; y: number; z: number }
  yaw: number
  /** ローカルX軸まわり。正なら+Zへ進むほど下がる。 */
  pitch: number
  length: number
  surfaceY: number
}

export type DominoBallSection = {
  /** このドミノが倒れて球を直接押し始める。 */
  triggerDominoId: string
  /** 坂を下った球が最初に当てる、後段の先頭ドミノ。 */
  receiverDominoId: string
  /** 既存ロング道中からボール区間へ置き換える連番の範囲。 */
  replacedApproachIndexes: readonly number[]
  start: { x: number; y: number; z: number }
  railSegments: readonly BallRailSegment[]
  /** テストで坂出口の到達を判断するための、最後のレール中心。 */
  exitPoint: { x: number; z: number }
}

function pointAt(path: readonly { x: number; z: number; yaw: number }[], index: number) {
  const point = path[index]
  if (!point) throw new Error(`ボール区間の道中点 approach-${index} がありません`)
  return point
}

function distance(a: { x: number; z: number }, b: { x: number; z: number }) {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/**
 * 既存の180度折り返し15枚を、5枚の緩いCuboid坂とガイド壁へ置き換える。
 * 前後のドミノ位置・向きはそのまま残すため、ロング全体の経路は作り直さない。
 */
export function createDominoBallSection(
  approachPath: readonly { x: number; z: number; yaw: number }[],
): DominoBallSection {
  const trigger = pointAt(approachPath, 14)
  const startPoint = pointAt(approachPath, 15)
  const receiver = pointAt(approachPath, 30)
  const railIndexes = [18, 21, 24, 27, 29] as const
  // 最初の坂を少し前から始め、前段ドミノが坂の垂直な端で止まらないようにする。
  const railPoints = [
    {
      x: startPoint.x + Math.sin(startPoint.yaw) * 0.5,
      z: startPoint.z + Math.cos(startPoint.yaw) * 0.5,
      yaw: startPoint.yaw,
    },
    ...railIndexes.map((index) => pointAt(approachPath, index)),
  ]
  const totalLength = railPoints.slice(1).reduce(
    (total, point, index) => total + distance(railPoints[index]!, point),
    0,
  )
  let consumedLength = 0
  const railSegments: BallRailSegment[] = railPoints.slice(1).map((point, index) => {
    const start = railPoints[index]!
    const segmentLength = distance(start, point)
    const startRatio = consumedLength / totalLength
    consumedLength += segmentLength
    const endRatio = consumedLength / totalLength
    const surfaceY = (ratio: number) =>
      BALL_START_DECK_SURFACE_Y +
      (BALL_EXIT_SURFACE_Y - BALL_START_DECK_SURFACE_Y) * ratio
    return {
      start: { x: start.x, y: surfaceY(startRatio), z: start.z },
      end: { x: point.x, y: surfaceY(endRatio), z: point.z },
    }
  })

  // 前段の連鎖方向とスタート台の向きが一致していることを早期に保証する。
  if (Math.abs(trigger.yaw - startPoint.yaw) > (20 * Math.PI) / 180) {
    throw new Error('ボール区間の始点が前段ドミノの向きとつながっていません')
  }
  // 出口は後段ドミノの直前に置き、球が複数枚を直接なぎ倒さないようにする。
  if (distance(railPoints.at(-1)!, receiver) > 1) {
    throw new Error('ボール区間の出口が後段ドミノから離れすぎています')
  }

  return {
    triggerDominoId: 'approach-14',
    receiverDominoId: 'approach-30',
    replacedApproachIndexes: Array.from({ length: 15 }, (_, index) => index + 15),
    start: {
      // 前段の倒伏中に直接接触する位置。坂端とは干渉しないよう元の1枚ぶんより少し前へ置く。
      x: startPoint.x + Math.sin(startPoint.yaw) * 0.4,
      y: BALL_START_DECK_SURFACE_Y + BALL_RADIUS,
      z: startPoint.z + Math.cos(startPoint.yaw) * 0.4,
    },
    railSegments,
    exitPoint: railPoints.at(-1)!,
  }
}

/** 取り除くのはロング道中だけ。通常コースにはボール関連の配置を一切持ち込まない。 */
export function withoutBallSectionApproachPlacements(
  placements: DominoPlacement[],
  section: DominoBallSection,
): DominoPlacement[] {
  const replacedIds = new Set(
    section.replacedApproachIndexes.map((index) => `approach-${index}`),
  )
  return placements.filter((placement) => !replacedIds.has(placement.id))
}

/** 物理ColliderとThree.js表示で共有する、床の中心・姿勢・長さを求める。 */
export function getBallRailPieces(section: DominoBallSection): BallRailPiece[] {
  const first = section.railSegments[0]
  if (!first) throw new Error('ボール区間に坂がありません')
  const firstDx = first.end.x - first.start.x
  const firstDz = first.end.z - first.start.z
  const firstYaw = Math.atan2(firstDx, firstDz)
  const deckForward = { x: Math.sin(firstYaw), z: Math.cos(firstYaw) }
  const pieces: BallRailPiece[] = [
    {
      kind: 'deck',
      center: {
        x: section.start.x,
        y: BALL_START_DECK_SURFACE_Y,
        z: section.start.z,
      },
      yaw: firstYaw,
      pitch: 0,
      length: BALL_START_DECK_LENGTH,
      surfaceY: BALL_START_DECK_SURFACE_Y,
    },
  ]
  for (const segment of section.railSegments) {
    const dx = segment.end.x - segment.start.x
    const dy = segment.end.y - segment.start.y
    const dz = segment.end.z - segment.start.z
    const horizontalLength = Math.hypot(dx, dz)
    const length = Math.hypot(horizontalLength, dy)
    if (length <= 0) continue
    pieces.push({
      kind: 'ramp',
      center: {
        x: (segment.start.x + segment.end.x) / 2,
        y: (segment.start.y + segment.end.y) / 2,
        z: (segment.start.z + segment.end.z) / 2,
      },
      yaw: Math.atan2(dx, dz),
      pitch: Math.atan2(-dy, horizontalLength),
      length,
      surfaceY: (segment.start.y + segment.end.y) / 2,
    })
  }
  // deckForwardは意図を明示するためにここで読んでおく。浮動小数の不正値も早期に弾く。
  if (!Number.isFinite(deckForward.x) || !Number.isFinite(deckForward.z)) {
    throw new Error('ボール区間のスタート台の向きが不正です')
  }
  return pieces
}

/**
 * 球の位置をレール中心線へ投影した0〜1の進行度。
 * カメラはこの値をレール上の演出進行度に使うだけで、球へ直接追尾しない。
 */
export function ballRailProgress(
  section: DominoBallSection,
  position: { x: number; z: number },
): number {
  const segments = section.railSegments
  const lengths = segments.map((segment) =>
    Math.hypot(segment.end.x - segment.start.x, segment.end.z - segment.start.z),
  )
  const totalLength = lengths.reduce((total, length) => total + length, 0)
  if (totalLength <= 0) return 0

  let bestDistanceSquared = Number.POSITIVE_INFINITY
  let bestProgress = 0
  let consumed = 0
  for (const [index, segment] of segments.entries()) {
    const dx = segment.end.x - segment.start.x
    const dz = segment.end.z - segment.start.z
    const length = lengths[index]!
    const rawProjection =
      length <= 0
        ? 0
        : ((position.x - segment.start.x) * dx + (position.z - segment.start.z) * dz) /
          (length * length)
    const projection = Math.min(1, Math.max(0, rawProjection))
    const closestX = segment.start.x + dx * projection
    const closestZ = segment.start.z + dz * projection
    const distanceSquared = (position.x - closestX) ** 2 + (position.z - closestZ) ** 2
    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared
      bestProgress = (consumed + length * projection) / totalLength
    }
    consumed += length
  }
  return Math.min(1, Math.max(0, bestProgress))
}
