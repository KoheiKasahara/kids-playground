import {
  BALL_START,
  CELL_SIZE,
  GRID_BOTTOM,
  GOAL_AREA,
  GOAL_HEIGHT,
  type GoalArea,
} from './boardLayout'
import type { Point } from './grid'
import { TRAY_PART_DEFINITIONS, type PartTypeId } from './partTypes'
import type { PlacedPart } from './placement'

/** Phase 5 の3つのステージ。ゲーム内だけで使う小さな定義なので共通エンジンにはしない。 */
export type PuzzleStageId = 'easy' | 'normal' | 'hard'
export type PuzzleDifficulty = PuzzleStageId

export type PuzzleStageBallDefinition = {
  readonly id: string
  readonly startPosition: Point
  /** 将来の個別国旗選択用。未指定なら現在選択中の国旗を使う。 */
  readonly flagId?: string
}

export type PuzzleStageDefinition = {
  readonly id: PuzzleStageId
  readonly nameJa: string
  readonly difficulty: PuzzleDifficulty
  readonly emoji: string
  readonly description: string
  readonly balls: readonly PuzzleStageBallDefinition[]
  readonly goalArea: GoalArea
  readonly availablePartTypeIds: readonly PartTypeId[]
  readonly partLimits?: Partial<Record<PartTypeId, number>>
  readonly fixedParts?: readonly PlacedPart[]
}

const ALL_TRAY_PART_TYPE_IDS: readonly PartTypeId[] = TRAY_PART_DEFINITIONS.map(({ id }) => id)

const wideEasyGoal: GoalArea = {
  x: GOAL_AREA.x,
  y: GRID_BOTTOM,
  width: 180,
  height: GOAL_HEIGHT,
}

const normalGoal: GoalArea = {
  x: 240,
  y: GRID_BOTTOM,
  width: 120,
  height: GOAL_HEIGHT,
}

// むずかしいは、ふつうの2球ぶんの難しさに加えて、ゴール自体も左右半マスずつ狭くする。
const hardGoal: GoalArea = {
  x: 90 + CELL_SIZE / 2,
  y: GRID_BOTTOM,
  width: 180 - CELL_SIZE,
  height: GOAL_HEIGHT,
}

const easyBall: PuzzleStageBallDefinition = { id: 'ball-a', startPosition: BALL_START }

/**
 * ステージ条件はここにまとめる。各ステージの違いをコンポーネント内の
 * difficulty 分岐に散らさないことで、幼児向けの調整を読みやすく保つ。
 */
export const PUZZLE_STAGES: readonly PuzzleStageDefinition[] = [
  {
    id: 'easy',
    nameJa: 'かんたん',
    difficulty: 'easy',
    emoji: '🌱',
    description: 'ボール1こ・ひろいゴール',
    balls: [easyBall],
    goalArea: wideEasyGoal,
    availablePartTypeIds: ALL_TRAY_PART_TYPE_IDS,
  },
  {
    id: 'normal',
    nameJa: 'ふつう',
    difficulty: 'normal',
    emoji: '🌼',
    description: 'スタートからよこへ はこぼう',
    balls: [{ id: 'ball-a', startPosition: { x: 90, y: BALL_START.y } }],
    goalArea: normalGoal,
    // バンパーを外して、道を考える違いだけを加える。個数制限は設けない。
    availablePartTypeIds: ALL_TRAY_PART_TYPE_IDS.filter((id) => id !== 'bumper'),
  },
  {
    id: 'hard',
    nameJa: 'むずかしい',
    difficulty: 'hard',
    emoji: '⭐',
    description: 'ボール2こ・いっしょにゴール',
    balls: [
      { id: 'ball-a', startPosition: { x: 90, y: BALL_START.y } },
      { id: 'ball-b', startPosition: { x: 270, y: BALL_START.y } },
    ],
    goalArea: hardGoal,
    availablePartTypeIds: ALL_TRAY_PART_TYPE_IDS,
  },
]

export const DEFAULT_PUZZLE_STAGE_ID: PuzzleStageId = 'easy'

export function puzzleStage(stageId: PuzzleStageId = DEFAULT_PUZZLE_STAGE_ID): PuzzleStageDefinition {
  return PUZZLE_STAGES.find((stage) => stage.id === stageId) ?? PUZZLE_STAGES[0]
}

export function isPuzzleStageId(value: string): value is PuzzleStageId {
  return PUZZLE_STAGES.some((stage) => stage.id === value)
}

/** ボールidを開始位置マーカーや国旗ボタンに出す短い目印（A/B）へ変換する。 */
export function ballLetter(ballId: string): string {
  return ballId === 'ball-a' ? 'A' : 'B'
}
