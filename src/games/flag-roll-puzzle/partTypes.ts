import type { GridCell } from './grid'

/** 盤面へ保存する向きまで含めたパーツ種類。置き場にはこのうち基本向きだけを出す。 */
export type PartTypeId =
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
  | 'bumper'
  | 'guideLeft'
  | 'guideRight'
  /** 右向きが基本向き。反転した向きは盤面上の回転専用ID。 */
  | 'jumpRampRight'
  | 'jumpRampLeft'
  /** 右向きが基本向き。残りの7方向は盤面上の回転専用ID。 */
  | 'cannon'
  | 'cannonDownRight'
  | 'cannonDown'
  | 'cannonDownLeft'
  | 'cannonLeft'
  | 'cannonUpLeft'
  | 'cannonUp'
  | 'cannonUpRight'
  | 'spinner'
  /** 右向きが基本向き。残りの3方向は盤面上の回転専用ID。 */
  | 'conveyorRight'
  | 'conveyorDown'
  | 'conveyorLeft'
  | 'conveyorUp'
  /** 中央支点で動くため、横向き固定の物理ギミック。 */
  | 'seesaw'

/** パーツを構成する長方形。アンカーセルの中心を原点とした相対位置(px)で表す。 */
export type PartSegment = {
  readonly offsetX: number
  readonly offsetY: number
  readonly width: number
  readonly height: number
  /** 時計回りが正。CSS rotate / Matter.js の angle と同じ画面座標系 */
  readonly angleDeg: number
  /** 円形の物理Bodyとして扱うセグメント。見た目は width / height の円で描画する。 */
  readonly kind?: 'circle'
  /** 特殊パーツの見た目を構成する役割。物理形状は専用ファクトリで作る。 */
  readonly role?: 'chamber' | 'barrel' | 'muzzle' | 'blade' | 'deck' | 'support' | 'base' | 'pivot'
}

/** 木の板以外も、役割を文字に頼らず見分けられるようにするための見た目の種類。 */
export type PartAppearance = 'wood' | 'curve' | 'bumper' | 'guide' | 'jumpRamp' | 'cannon' | 'spinner' | 'conveyor' | 'seesaw'

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
  /** 置き場だけで使う縮小率。盤面の描画・物理・占有マスには一切影響しない。 */
  readonly previewScale?: number
  readonly previewOffsetX?: number
}

const SINGLE_CELL: readonly GridCell[] = [{ col: 0, row: 0 }]

const RAIL_THICKNESS = 12
const SLOPE_ANGLE_DEG = 30
const SLOPE_LENGTH = 62
const JUMP_RAMP_ANGLE_DEG = 24
const JUMP_RAMP_LENGTH = 54
const JUMP_RAMP_THICKNESS = 14
const CONVEYOR_LENGTH = 58
const CONVEYOR_THICKNESS = 16
/** 1マス内に収める、中央支点付きの横長デッキ。 */
const SEESAW_LENGTH = 54
const SEESAW_THICKNESS = 10

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

/** キャノンは右向きを基本向きとし、回転後は盤面専用の向きIDとして保存する。 */
export const CANNON_TYPE_IDS = [
  'cannon',
  'cannonDownRight',
  'cannonDown',
  'cannonDownLeft',
  'cannonLeft',
  'cannonUpLeft',
  'cannonUp',
  'cannonUpRight',
] as const

export const CANNON_DIRECTION_ANGLES: Readonly<Record<(typeof CANNON_TYPE_IDS)[number], number>> = {
  cannon: 0,
  cannonDownRight: 45,
  cannonDown: 90,
  cannonDownLeft: 135,
  cannonLeft: 180,
  cannonUpLeft: 225,
  cannonUp: 270,
  cannonUpRight: 315,
}

/** 任意の角度でセグメントを回し、キャノンの見た目と向きを一致させる。 */
function rotateSegmentsByAngle(segments: readonly PartSegment[], angleDeg: number): readonly PartSegment[] {
  const angle = angleDeg * Math.PI / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return segments.map((segment) => ({
    ...segment,
    offsetX: segment.offsetX * cos - segment.offsetY * sin,
    offsetY: segment.offsetX * sin + segment.offsetY * cos,
    angleDeg: segment.angleDeg + angleDeg,
  }))
}

const CANNON_SEGMENTS: readonly PartSegment[] = [
  { offsetX: -8, offsetY: 0, width: 18, height: 18, angleDeg: 0, kind: 'circle', role: 'chamber' },
  { offsetX: 9, offsetY: 0, width: 28, height: 10, angleDeg: 0, role: 'barrel' },
  { offsetX: 25, offsetY: 0, width: 8, height: 14, angleDeg: 0, kind: 'circle', role: 'muzzle' },
]

function cannonDefinition(
  id: (typeof CANNON_TYPE_IDS)[number],
  angleDeg: number,
  inTray = false,
): PartDefinition {
  const directionName: Readonly<Record<(typeof CANNON_TYPE_IDS)[number], string>> = {
    cannon: 'みぎ',
    cannonDownRight: 'みぎした',
    cannonDown: 'した',
    cannonDownLeft: 'ひだりした',
    cannonLeft: 'ひだり',
    cannonUpLeft: 'ひだりうえ',
    cannonUp: 'うえ',
    cannonUpRight: 'みぎうえ',
  }
  return {
    id,
    label: `たいほう ${directionName[id]}`,
    inTray,
    appearance: 'cannon',
    cells: SINGLE_CELL,
    segments: rotateSegmentsByAngle(CANNON_SEGMENTS, angleDeg),
    restitution: 0.2,
    friction: 0.02,
  }
}

const SPINNER_SEGMENTS: readonly PartSegment[] = [
  { offsetX: 0, offsetY: 0, width: 48, height: 10, angleDeg: 0, role: 'blade' },
  { offsetX: 0, offsetY: 0, width: 10, height: 48, angleDeg: 0, role: 'blade' },
  { offsetX: 0, offsetY: 0, width: 16, height: 16, angleDeg: 0, kind: 'circle', role: 'chamber' },
]

export const CONVEYOR_TYPE_IDS = ['conveyorRight', 'conveyorDown', 'conveyorLeft', 'conveyorUp'] as const

function conveyorDefinition(
  id: (typeof CONVEYOR_TYPE_IDS)[number],
  quarterTurns: number,
  inTray = false,
): PartDefinition {
  return {
    id,
    label: 'ベルトコンベア',
    inTray,
    appearance: 'conveyor',
    cells: SINGLE_CELL,
    segments: rotateSegments([{ offsetX: 0, offsetY: 0, width: CONVEYOR_LENGTH, height: CONVEYOR_THICKNESS, angleDeg: 0 }], quarterTurns),
    restitution: 0.2,
    friction: 0.04,
  }
}

const SEESAW_SEGMENTS: readonly PartSegment[] = [
  { offsetX: 0, offsetY: 0, width: SEESAW_LENGTH, height: SEESAW_THICKNESS, angleDeg: 0, role: 'deck' },
  // 支点はデッキの下に置き、ボールが乗るデッキと見た目が重なるようにする。
  { offsetX: 0, offsetY: 10, width: 22, height: 20, angleDeg: 0, role: 'support' },
  { offsetX: 0, offsetY: 22, width: 28, height: 6, angleDeg: 0, role: 'base' },
  { offsetX: 0, offsetY: 0, width: 14, height: 14, angleDeg: 0, kind: 'circle', role: 'pivot' },
]

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
    id: 'slopeLeft', label: 'ひだりへ', inTray: true, appearance: 'wood', cells: SINGLE_CELL,
    segments: [{ offsetX: 0, offsetY: 0, width: SLOPE_LENGTH, height: RAIL_THICKNESS, angleDeg: -SLOPE_ANGLE_DEG }],
    restitution: 0.2, friction: 0.03,
  },
  {
    id: 'slopeRight', label: 'みぎへ', inTray: true, appearance: 'wood', cells: SINGLE_CELL,
    segments: [{ offsetX: 0, offsetY: 0, width: SLOPE_LENGTH, height: RAIL_THICKNESS, angleDeg: SLOPE_ANGLE_DEG }],
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
    id: 'bumper', label: 'バンパー', inTray: true, appearance: 'bumper', cells: SINGLE_CELL,
    // 円形Bodyなので、どの方向から当たっても自然に外向きへ弾ける。
    segments: [{ offsetX: 0, offsetY: 0, width: 42, height: 42, angleDeg: 0, kind: 'circle' }],
    restitution: 0.98, friction: 0.01,
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
    // ジャンプ台固有の向きへ球を飛ばす短い斜面。実際のジャンプ補正は
    // usePuzzleEngine 側で接触方向にかかわらず適用し、台の向きを発射方向として優先する。
    id: 'jumpRampRight', label: 'ジャンプ台', inTray: true, appearance: 'jumpRamp', cells: SINGLE_CELL,
    segments: [{ offsetX: 0, offsetY: 0, width: JUMP_RAMP_LENGTH, height: JUMP_RAMP_THICKNESS, angleDeg: -JUMP_RAMP_ANGLE_DEG }],
    restitution: 0.25, friction: 0.015,
  },
  {
    id: 'jumpRampLeft', label: 'ジャンプ台', inTray: false, appearance: 'jumpRamp', cells: SINGLE_CELL,
    segments: [{ offsetX: 0, offsetY: 0, width: JUMP_RAMP_LENGTH, height: JUMP_RAMP_THICKNESS, angleDeg: JUMP_RAMP_ANGLE_DEG }],
    restitution: 0.25, friction: 0.015,
  },

  cannonDefinition('cannon', 0, true),
  cannonDefinition('cannonDownRight', 45),
  cannonDefinition('cannonDown', 90),
  cannonDefinition('cannonDownLeft', 135),
  cannonDefinition('cannonLeft', 180),
  cannonDefinition('cannonUpLeft', 225),
  cannonDefinition('cannonUp', 270),
  cannonDefinition('cannonUpRight', 315),

  {
    id: 'spinner', label: 'かいてんばん', inTray: true, appearance: 'spinner', cells: SINGLE_CELL,
    segments: SPINNER_SEGMENTS,
    restitution: 0.55, friction: 0.03,
  },

  conveyorDefinition('conveyorRight', 0, true),
  conveyorDefinition('conveyorDown', 1),
  conveyorDefinition('conveyorLeft', 2),
  conveyorDefinition('conveyorUp', 3),

  {
    id: 'seesaw', label: 'シーソー', inTray: true, appearance: 'seesaw', cells: SINGLE_CELL,
    segments: SEESAW_SEGMENTS,
    restitution: 0.08, friction: 0.08,
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
const NEXT_ROTATION_TYPE: Readonly<Partial<Record<PartTypeId, PartTypeId>>> = {
  slopeLeft: 'slopeRight', slopeRight: 'slopeLeft',
  curveLeft: 'curveLeft90', curveLeft90: 'curveLeft180', curveLeft180: 'curveLeft270', curveLeft270: 'curveLeft',
  curveRight: 'curveRight90', curveRight90: 'curveRight180', curveRight180: 'curveRight270', curveRight270: 'curveRight',
  guideLeft: 'guideRight', guideRight: 'guideLeft',
  jumpRampRight: 'jumpRampLeft', jumpRampLeft: 'jumpRampRight',
  cannon: 'cannonDownRight',
  cannonDownRight: 'cannonDown',
  cannonDown: 'cannonDownLeft',
  cannonDownLeft: 'cannonLeft',
  cannonLeft: 'cannonUpLeft',
  cannonUpLeft: 'cannonUp',
  cannonUp: 'cannonUpRight',
  cannonUpRight: 'cannon',
  conveyorRight: 'conveyorDown',
  conveyorDown: 'conveyorLeft',
  conveyorLeft: 'conveyorUp',
  conveyorUp: 'conveyorRight',
}

export function nextRotationType(id: PartTypeId): PartTypeId | null {
  return NEXT_ROTATION_TYPE[id] ?? null
}

export function isRotatablePart(id: PartTypeId): boolean {
  return NEXT_ROTATION_TYPE[id] !== undefined
}

export function isCannonPart(id: PartTypeId): id is (typeof CANNON_TYPE_IDS)[number] {
  return (CANNON_TYPE_IDS as readonly string[]).includes(id)
}

export function isSpinnerPart(id: PartTypeId): id is 'spinner' {
  return id === 'spinner'
}

export function isJumpRampPart(id: string): id is 'jumpRampRight' | 'jumpRampLeft' {
  return id === 'jumpRampRight' || id === 'jumpRampLeft'
}

export function isConveyorPart(id: string): id is (typeof CONVEYOR_TYPE_IDS)[number] {
  return (CONVEYOR_TYPE_IDS as readonly string[]).includes(id)
}

export function isSeesawPart(id: string): id is 'seesaw' {
  return id === 'seesaw'
}
