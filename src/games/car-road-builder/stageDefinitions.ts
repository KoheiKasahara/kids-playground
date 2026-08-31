import { createPlacedPart } from './partDefinitions'
import { createBoard, placePartAt, type Board } from './boardModel'

export type StageId = 'normal' | 'wide'

export type StageDefinition = Readonly<{
  label: string
  sizeLabel: string
  size: Readonly<{ rows: number; cols: number }>
}>

export const STAGES: Readonly<Record<StageId, StageDefinition>> = {
  normal: { label: 'ふつう', sizeLabel: '4×4', size: { rows: 4, cols: 4 } },
  wide: { label: 'ひろい', sizeLabel: '5×5', size: { rows: 5, cols: 5 } },
}

export const STAGE_ORDER: readonly StageId[] = ['normal', 'wide']

/** Create a fresh stage with only the fixed starting markers shown initially. */
export function createStageBoard(stageId: StageId): Board {
  const size = STAGES[stageId].size
  let board = createBoard(size)
  board = placePartAt(board, 0, 0, createPlacedPart('start', 2))
  board = placePartAt(board, size.rows - 1, size.cols - 1, createPlacedPart('goal'))
  return board
}

