import type { GridCell } from './grid'

/** 盤面へ保存する向きまで含めたパーツ種類。置き場にはこのうち基本向きだけを出す。 */
export type PartTypeId =
  | 'plank'
  | 'slopeLeft'
  | 'slopeRight'
  | 'curveLeft'
  | 'curveLeft90'
  | 'curveLeft180'
  | 'curveLeft270'
  | 'curveRight'
  | 'curveRight90'
  | 'curveRight180'
  | 'curveRight270'
  | 'bounceBoard'
  | 'bounceBoardVertical'
  | 'guideLeft'
  | 'guideRight'
  | 'longPlank'
  | 'longPlankVertical'

/** パーツを構成する長方形。アンカーセルの中心を原点とした相対位置(px)で表す。 */
export type PartSegment = {
  readonly offsetX: number
  readonly offsetY: number
  readonly width: number
  readonly height: number
  /** 時計回りが正。CSS rotate / Matter.js の angle と同じ画面座標系 */
  readonly angleDeg: number
}

/** 木の板以外も、役割を文字に頼らず見分けられるようにするための見た目の種類。 */
export type PartAppearance = 'wood' | 'curve' | 'bounce' | 'guide'

export type PartDefinition = {
  readonly id: PartTypeId
  readonly label: string
  /** パーツ置き場へ出す基本向きか。回転後の向きは盤面専用にする。 */
  readonly inTray: boolean
  readonly appearance: PartAppearance
  /** アンカーセルからの相対で占有するマス */
  readonly cells: readonly GridCell[]
  /** 描画と物理Bodyで共通に使う形 */
  readonly segments: readonly PartSegment[]
  readonly restitution: number
  readonly friction: number
}

const SINGLE_CELL: readonly GridCell[] = [{ col: 0, row: 0 }]
const HORIZONTAL_TWO_CELLS: readonly GridCell[] = [{ col: 0, row: 0 }, { col: 1, row: 0 }]
const VERTICAL_TWO_CELLS: readonly GridCell[] = [{ col: 0, row: 0 }, { col: 0, row: 1 }]

const PLANK_THICKNESS = 12
const PLANK_LENGTH = 54
const SLOPE_ANGLE_DEG = 30
const SLOPE_LENGTH = 62
const LONG_PLANK_LENGTH = 114

/** 一つの曲線を3枚の短い板で近似する。完全な円弧より、滑らかに向きが変わることを優先する。 */
const CURVE_LEFT_SEGMENTS: readonly PartSegment[] = [
  // 隣り合う板の端を重ね、ボールが継ぎ目へ落ちない連続したレールにしている。
  { offsetX: 16.5, offsetY: -16, width: 23.4, height: 10, angleDeg: -50 },
  { offsetX: 1, offsetY: 0.5, width: 21.9, height: 10, angleDeg: -43 },
  { offsetX: -15.5, offsetY: 13, width: 19.7, height: 10, angleDeg: -30 },
]

const CURVE_RIGHT_SEGMENTS: readonly PartSegment[] = CURVE_LEFT_SEGMENTS.map((segment) => ({
  ...segment,
  offsetX: -segment.offsetX,
  angleDeg: -segment.angleDeg,
}))

/** セグメントの集合を90度単位で回す。曲線の見た目と物理形状を必ず同じ向きへ回す。 */
function rotateSegments(segments: readonly PartSegment[], quarterTurns: number): readonly PartSegment[] {
  const turns = ((quarterTurns % 4) + 4) % 4
  return segments.map((segment) => {
    let { offsetX, offsetY } = segment
    for (let turn = 0; turn < turns; turn += 1) {
      ;[offsetX, offsetY] = [-offsetY, offsetX]
    }
    return { ...segment, offsetX, offsetY, angleDeg: segment.angleDeg + turns * 90 }
  })
}

function curveDefinition(
  id: PartTypeId,
  label: string,
  segments: readonly PartSegment[],
  quarterTurns: number,
  inTray = false,
): PartDefinition {
  return {
    id,
    label,
    inTray,
    appearance: 'curve',
    cells: SINGLE_CELL,
    segments: rotateSegments(segments, quarterTurns),
    restitution: 0.16,
    friction: 0.025,
  }
}

export const PART_DEFINITIONS: readonly PartDefinition[] = [
  {
    id: 'plank', label: 'よこいた', inTray: true, appearance: 'wood', cells: SINGLE_CELL,
    segments: [{ offsetX: 0, offsetY: 0, width: PLANK_LENGTH, height: PLANK_THICKNESS, angleDeg: 0 }],
    restitution: 0.2, friction: 0.04,
  },
  {
    id: 'slopeLeft', label: 'ひだりへ', inTray: true, appearance: 'wood', cells: SINGLE_CELL,
    segments: [{ offsetX: 0, offsetY: 0, width: SLOPE_LENGTH, height: PLANK_THICKNESS, angleDeg: -SLOPE_ANGLE_DEG }],
    restitution: 0.2, friction: 0.03,
  },
  {
    id: 'slopeRight', label: 'みぎへ', inTray: true, appearance: 'wood', cells: SINGLE_CELL,
    segments: [{ offsetX: 0, offsetY: 0, width: SLOPE_LENGTH, height: PLANK_THICKNESS, angleDeg: SLOPE_ANGLE_DEG }],
    restitution: 0.2, friction: 0.03,
  },

  curveDefinition('curveLeft', 'カーブ ひだり', CURVE_LEFT_SEGMENTS, 0, true),
  curveDefinition('curveLeft90', 'カーブ ひだり', CURVE_LEFT_SEGMENTS, 1),
  curveDefinition('curveLeft180', 'カーブ ひだり', CURVE_LEFT_SEGMENTS, 2),
  curveDefinition('curveLeft270', 'カーブ ひだり', CURVE_LEFT_SEGMENTS, 3),
  curveDefinition('curveRight', 'カーブ みぎ', CURVE_RIGHT_SEGMENTS, 0, true),
  curveDefinition('curveRight90', 'カーブ みぎ', CURVE_RIGHT_SEGMENTS, 1),
  curveDefinition('curveRight180', 'カーブ みぎ', CURVE_RIGHT_SEGMENTS, 2),
  curveDefinition('curveRight270', 'カーブ みぎ', CURVE_RIGHT_SEGMENTS, 3),

  {
    id: 'bounceBoard', label: 'バインいた', inTray: true, appearance: 'bounce', cells: SINGLE_CELL,
    segments: [{ offsetX: 0, offsetY: 0, width: PLANK_LENGTH, height: PLANK_THICKNESS, angleDeg: 0 }],
    // ボール(0.28)との合成でも通常板との差が見え、MAX_SPEEDで上限も保たれる値。
    restitution: 0.82, friction: 0.025,
  },
  {
    id: 'bounceBoardVertical', label: 'バインいた', inTray: false, appearance: 'bounce', cells: SINGLE_CELL,
    segments: [{ offsetX: 0, offsetY: 0, width: PLANK_LENGTH, height: PLANK_THICKNESS, angleDeg: 90 }],
    restitution: 0.82, friction: 0.025,
  },

  {
    id: 'guideLeft', label: 'ひだりへ おす', inTray: true, appearance: 'guide',
    // 「<」の矢印形。上側の斜面で受けて左へ流し、既存の長い斜め板とは役割を分ける。
    segments: [
      { offsetX: 8, offsetY: -12, width: 34, height: 10, angleDeg: -42 },
      { offsetX: 8, offsetY: 12, width: 34, height: 10, angleDeg: 42 },
    ],
    cells: SINGLE_CELL, restitution: 0.3, friction: 0.02,
  },
  {
    id: 'guideRight', label: 'みぎへ おす', inTray: true, appearance: 'guide',
    // 「>」の矢印形。guideLeftの180度回転と同じ形なので、回転操作でも相互に切り替わる。
    segments: [
      { offsetX: -8, offsetY: -12, width: 34, height: 10, angleDeg: 42 },
      { offsetX: -8, offsetY: 12, width: 34, height: 10, angleDeg: -42 },
    ],
    cells: SINGLE_CELL, restitution: 0.3, friction: 0.02,
  },

  {
    id: 'longPlank', label: 'ながい いた', inTray: true, appearance: 'wood', cells: HORIZONTAL_TWO_CELLS,
    segments: [{ offsetX: 30, offsetY: 0, width: LONG_PLANK_LENGTH, height: PLANK_THICKNESS, angleDeg: 0 }],
    restitution: 0.2, friction: 0.04,
  },
  {
    id: 'longPlankVertical', label: 'ながい いた', inTray: false, appearance: 'wood', cells: VERTICAL_TWO_CELLS,
    segments: [{ offsetX: 0, offsetY: 30, width: LONG_PLANK_LENGTH, height: PLANK_THICKNESS, angleDeg: 90 }],
    restitution: 0.2, friction: 0.04,
  },
]

/** 実際のパーツ置き場へ出すのは、各パーツの基本向きだけ。 */
export const TRAY_PART_DEFINITIONS = PART_DEFINITIONS.filter((definition) => definition.inTray)

const definitionsById = new Map(PART_DEFINITIONS.map((definition) => [definition.id, definition]))

export function partDefinition(id: PartTypeId): PartDefinition {
  const definition = definitionsById.get(id)
  if (!definition) throw new Error(`flag-roll-puzzle: 不明なパーツ種類です: ${id}`)
  return definition
}

/** パーツごとに意味のある固定向きだけを循環する。 */
const NEXT_ROTATION_TYPE: Readonly<Record<PartTypeId, PartTypeId>> = {
  plank: 'slopeLeft', slopeLeft: 'slopeRight', slopeRight: 'plank',
  curveLeft: 'curveLeft90', curveLeft90: 'curveLeft180', curveLeft180: 'curveLeft270', curveLeft270: 'curveLeft',
  curveRight: 'curveRight90', curveRight90: 'curveRight180', curveRight180: 'curveRight270', curveRight270: 'curveRight',
  bounceBoard: 'bounceBoardVertical', bounceBoardVertical: 'bounceBoard',
  guideLeft: 'guideRight', guideRight: 'guideLeft',
  longPlank: 'longPlankVertical', longPlankVertical: 'longPlank',
}

export function nextRotationType(id: PartTypeId): PartTypeId {
  return NEXT_ROTATION_TYPE[id]
}
