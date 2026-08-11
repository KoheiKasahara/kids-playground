import type { PrefectureId } from './data/prefectures'

/** 地図上の県の場所 -> そこに置かれた都道府県ピース。 */
export type PlacementMap = Partial<Record<PrefectureId, PrefectureId | null>>

export function createPlacements(ids: readonly PrefectureId[]): PlacementMap {
  return Object.fromEntries(ids.map((id) => [id, null])) as PlacementMap
}

export function targetForPiece(placements: PlacementMap, pieceId: PrefectureId): PrefectureId | undefined {
  return Object.entries(placements).find(([, placedId]) => placedId === pieceId)?.[0] as PrefectureId | undefined
}

/**
 * ピースを置く。移動先に別のピースがあれば、移動元と自然に入れ替える。
 * 正解判定はここでは一切行わない。
 */
export function placePiece(placements: PlacementMap, pieceId: PrefectureId, targetId: PrefectureId): PlacementMap {
  const sourceId = targetForPiece(placements, pieceId)
  const targetPiece = placements[targetId] ?? null
  const next = { ...placements, [targetId]: pieceId }
  if (sourceId && sourceId !== targetId) next[sourceId] = targetPiece
  return next
}

export function returnPiece(placements: PlacementMap, pieceId: PrefectureId): PlacementMap {
  const sourceId = targetForPiece(placements, pieceId)
  return sourceId ? { ...placements, [sourceId]: null } : placements
}

export function isComplete(placements: PlacementMap, ids: readonly PrefectureId[]): boolean {
  return ids.every((id) => placements[id] !== null && placements[id] !== undefined)
}

export function correctCount(placements: PlacementMap, ids: readonly PrefectureId[]): number {
  return ids.filter((id) => placements[id] === id).length
}
