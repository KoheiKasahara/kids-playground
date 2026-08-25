import { BALL_RADIUS } from './boardLayout'
import { cellCenter, cellKey, isInsideGrid, type GridCell, type Point } from './grid'
import { partDefinition, type PartTypeId } from './partTypes'

/** 盤面に置かれたパーツ。位置はマス単位（アンカーセル）だけで持つ */
export type PlacedPart = {
  readonly id: string
  readonly typeId: PartTypeId
  readonly cell: GridCell
}

/** 編集中に保持しているボールの中心。null は開始位置にいる状態を表す。 */
export type ParkedBallPosition = Point | null

/** パーツがそのアンカーセルに置かれたときに占有する、絶対座標のマス一覧 */
export function occupiedCells(typeId: PartTypeId, anchor: GridCell): GridCell[] {
  return partDefinition(typeId).cells.map((offset) => ({
    col: anchor.col + offset.col,
    row: anchor.row + offset.row,
  }))
}

/** 置かれている全パーツが占有しているマスのキー集合 */
export function occupiedCellKeys(parts: readonly PlacedPart[]): Set<string> {
  const keys = new Set<string>()
  for (const part of parts) {
    for (const cell of occupiedCells(part.typeId, part.cell)) {
      keys.add(cellKey(cell))
    }
  }
  return keys
}

/** 占有マスがすべてグリッドの内側に収まるか（ボード外への配置を拒否する） */
export function isInsideBoard(typeId: PartTypeId, anchor: GridCell): boolean {
  return occupiedCells(typeId, anchor).every(isInsideGrid)
}

/** 既に置かれているパーツと1マスでも重なるか */
export function overlapsExistingPart(
  parts: readonly PlacedPart[],
  typeId: PartTypeId,
  anchor: GridCell,
): boolean {
  const taken = occupiedCellKeys(parts)
  return occupiedCells(typeId, anchor).some((cell) => taken.has(cellKey(cell)))
}

/**
 * パーツの実際の板（回転した長方形）とボールが重なっているか。
 * マス単位の大きい禁止領域にはせず、各セグメントへ円を当てることで、
 * 停止したボールのすぐ下に板を足して続きを作れる余地を残す。
 */
export function overlapsParkedBall(
  typeId: PartTypeId,
  anchor: GridCell,
  ballPosition: ParkedBallPosition,
): boolean {
  if (ballPosition === null) return false
  const definition = partDefinition(typeId)
  const center = cellCenter(anchor)
  // 触れているだけなら自然な再開の邪魔をしない。明確な食い込みだけを拒否する。
  const protectedRadius = BALL_RADIUS - 1

  return definition.segments.some((segment) => {
    const angle = (segment.angleDeg * Math.PI) / 180
    const dx = ballPosition.x - (center.x + segment.offsetX)
    const dy = ballPosition.y - (center.y + segment.offsetY)
    // 円の中心を板のローカル座標へ戻し、最も近い点との距離を測る。
    const localX = dx * Math.cos(angle) + dy * Math.sin(angle)
    const localY = -dx * Math.sin(angle) + dy * Math.cos(angle)
    const nearestX = Math.max(-segment.width / 2, Math.min(segment.width / 2, localX))
    const nearestY = Math.max(-segment.height / 2, Math.min(segment.height / 2, localY))
    return (localX - nearestX) ** 2 + (localY - nearestY) ** 2 < protectedRadius ** 2
  })
}

/** そのマスへ置けるか。ボード外と、既存パーツとの重なりの両方を弾く */
export function canPlacePart(
  parts: readonly PlacedPart[],
  typeId: PartTypeId,
  anchor: GridCell,
  ballPosition: ParkedBallPosition = null,
): boolean {
  return (
    isInsideBoard(typeId, anchor) &&
    !overlapsExistingPart(parts, typeId, anchor) &&
    !overlapsParkedBall(typeId, anchor, ballPosition)
  )
}

/**
 * パーツを1つ追加した新しい配列を返す。置けない位置なら null を返し、
 * 呼び出し側が「元の場所へ戻す」挙動を選べるようにする（例外にはしない）。
 */
export function placePart(
  parts: readonly PlacedPart[],
  typeId: PartTypeId,
  anchor: GridCell,
  id: string,
  ballPosition: ParkedBallPosition = null,
): PlacedPart[] | null {
  if (!canPlacePart(parts, typeId, anchor, ballPosition)) return null
  return [...parts, { id, typeId, cell: anchor }]
}

/** そのマスを占有しているパーツ。無ければ null（盤面のパーツを選ぶときに使う） */
export function partAtCell(parts: readonly PlacedPart[], cell: GridCell): PlacedPart | null {
  const key = cellKey(cell)
  for (const part of parts) {
    if (occupiedCells(part.typeId, part.cell).some((occupied) => cellKey(occupied) === key)) {
      return part
    }
  }
  return null
}

/** パーツを1つ外した新しい配列を返す。見つからない場合は同じ内容の配列を返す */
export function removePart(parts: readonly PlacedPart[], id: string): PlacedPart[] {
  return parts.filter((part) => part.id !== id)
}

/**
 * 置いてあるパーツを別のマスへ動かせるか。
 * 自分自身とは当然重なるので、判定からは自分を除く（同じ場所へ戻す操作も許す）。
 */
export function canMovePart(
  parts: readonly PlacedPart[],
  partId: string,
  anchor: GridCell,
  ballPosition: ParkedBallPosition = null,
): boolean {
  const target = parts.find((part) => part.id === partId)
  if (!target) return false
  return canPlacePart(removePart(parts, partId), target.typeId, anchor, ballPosition)
}

/**
 * パーツを別のマスへ動かした新しい配列を返す。動かせない位置なら null を返し、
 * 呼び出し側が「元の場所へ戻す」挙動を選べるようにする（配置と同じ約束）。
 * 並び順とidは変えないので、選択状態やReactのkeyはそのまま保たれる。
 */
export function movePart(
  parts: readonly PlacedPart[],
  partId: string,
  anchor: GridCell,
  ballPosition: ParkedBallPosition = null,
): PlacedPart[] | null {
  if (!canMovePart(parts, partId, anchor, ballPosition)) return null
  return parts.map((part) => (part.id === partId ? { ...part, cell: anchor } : part))
}

/**
 * 選んだパーツの向きだけを変えられるか。移動と同じ配置判定を通すため、
 * 後から複数マスのパーツが増えても重なり・盤外を安全に拒否できる。
 */
export function canRotatePart(
  parts: readonly PlacedPart[],
  partId: string,
  nextTypeId: PartTypeId,
  ballPosition: ParkedBallPosition = null,
): boolean {
  const target = parts.find((part) => part.id === partId)
  if (!target) return false
  return canPlacePart(removePart(parts, partId), nextTypeId, target.cell, ballPosition)
}

/** 向きを変えた新しい配列。置けない向きなら null を返して元の向きを保つ。 */
export function rotatePart(
  parts: readonly PlacedPart[],
  partId: string,
  nextTypeId: PartTypeId,
  ballPosition: ParkedBallPosition = null,
): PlacedPart[] | null {
  if (!canRotatePart(parts, partId, nextTypeId, ballPosition)) return null
  return parts.map((part) => (part.id === partId ? { ...part, typeId: nextTypeId } : part))
}

/**
 * 画面上のポインタ座標を盤面の論理座標へ変換する。
 * 盤面は transform-origin: top left の scale() で拡縮しているため、
 * 矩形の左上が論理原点、倍率が scale にそのまま対応する。
 */
export function boardPointFromClient(
  clientX: number,
  clientY: number,
  boardRect: { readonly left: number; readonly top: number },
  scale: number,
): Point {
  // scale は useBoardScale が計測前に返す 1 を下回らない想定だが、
  // 0 が渡っても NaN / Infinity を盤面座標へ持ち込まないようにする。
  if (scale <= 0) return { x: 0, y: 0 }
  return {
    x: (clientX - boardRect.left) / scale,
    y: (clientY - boardRect.top) / scale,
  }
}
