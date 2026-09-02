// いろぬりパズルの塗り状態を扱う純ロジック。DOM APIに触れない。
// すべての関数は非破壊（引数のstateを変更せず、新しいオブジェクトを返す）。
import { UNPAINTED_FILL, type PaintColorId, findPaintColor } from './paintColors'
import type { PaintAreaId } from './paintPictures'

/** 1つの絵における、エリアID→塗り色ID。 */
export type PaintedAreas = Readonly<Record<PaintAreaId, PaintColorId>>

/** 絵ID→その絵の塗り状態。題材を切り替えても他の絵の塗りは保持する。 */
export type PaintingsState = Readonly<Record<string, PaintedAreas>>

export function createEmptyPaintings(): PaintingsState {
  return {}
}

export function getPaintedAreas(state: PaintingsState, pictureId: string): PaintedAreas {
  return state[pictureId] ?? {}
}

export function paintArea(
  state: PaintingsState,
  pictureId: string,
  areaId: PaintAreaId,
  colorId: PaintColorId,
): PaintingsState {
  const current = getPaintedAreas(state, pictureId)
  return {
    ...state,
    [pictureId]: { ...current, [areaId]: colorId },
  }
}

export function resetPicture(state: PaintingsState, pictureId: string): PaintingsState {
  if (!(pictureId in state)) return state
  const next = { ...state }
  delete next[pictureId]
  return next
}

/** 未塗り時は UNPAINTED_FILL（ぬりえの紙の色）を返す。 */
export function areaFillColor(painted: PaintedAreas, areaId: PaintAreaId): string {
  const colorId = painted[areaId]
  if (!colorId) return UNPAINTED_FILL
  return findPaintColor(colorId)?.hex ?? UNPAINTED_FILL
}
