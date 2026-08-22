import {
  createFlagGrid,
  type DominoFlagId,
  type FlagCellColor,
} from './flagDefinitions'
import { createBigFlagGrid } from './bigFlagRenderer'
export type { FlagCellColor } from './flagDefinitions'

/**
 * ワールド座標はXが右、Yが上、Zがカメラへ向かう手前。
 * 連鎖は奥の小さいZから手前の大きいZへ進み、薄いZ軸を持つドミノは
 * 倒れたあとに立っている間はカメラから見えない−Z面を上へ向ける。
 */
/** ドミノ1個の大きさ。高さを1ユニットに揃え、物理パラメータを決めやすくする。 */
export const DOMINO_HEIGHT = 1.0
export const DOMINO_WIDTH = 0.6
export const DOMINO_DEPTH = 0.14

/** 国旗を16列×10行にし、ドットでも日の丸の形が読み取れる解像度にする。 */
export const FLAG_COLS = 16
export const FLAG_ROWS = 10

export type FlagLayoutSpec = {
  cols: number
  rows: number
  /** 扇状分岐の1グループあたりのchainIndex重み。省略時は通常値の1。 */
  chainGroupWeight?: number
}

export const NORMAL_FLAG_LAYOUT: FlagLayoutSpec = {
  cols: FLAG_COLS,
  rows: FLAG_ROWS,
  chainGroupWeight: 1,
}
export const BIG_FLAG_LAYOUT: FlagLayoutSpec = {
  cols: 50,
  rows: 32,
  chainGroupWeight: 2,
}

/** 国旗の横幅を日本国旗の比率へ近づける、列方向のドミノ間隔。 */
export const FLAG_PITCH_X = 0.66
/** 国旗の縦幅を日本国旗の比率へ近づける、行方向のドミノ間隔。 */
export const FLAG_PITCH_Z = 0.7

/** 直線は短くしすぎず、最初の一押しから旗までの流れが見える12個にする。 */
export const LINE_COUNT = 12
/** 直線と分岐の間隔を、ドミノの高さの0.7倍で揃える。 */
export const LINE_PITCH_Z = 0.7

export type DominoPlacement = {
  id: string
  kind: 'line' | 'branch' | 'flag' | 'approach'
  x: number
  z: number
  width: number
  /** Y軸周りの回転角（ラジアン）。0は表面の法線が+Zを向く。 */
  yaw?: number
  /** 連鎖が進む方向。未指定の既存配置は+Zとして扱う。 */
  chainYaw?: number
  /** この配置経路から求めた、倒伏が到達する順番の目安。 */
  chainIndex: number
  color?: FlagCellColor
  row?: number
  col?: number
  /** ドミノが立つ台の高さ。未指定は地面(0)。階段区間だけ正の値を持つ。 */
  baseY?: number
}

const FLAG_Z0 = -((FLAG_ROWS - 1) / 2) * FLAG_PITCH_Z
/** フィーダーを国旗の最奥行より0.3奥（小さいZ側）に置き、最初の行へ接触させる。 */
const FEEDER_Z = FLAG_Z0 - 0.3

/**
 * 直線の終端から2.8ユニット奥へ根を下げ、左右へ分かれるための深さを確保する。
 * この深さで曲線と横向きの腕を同じ通常サイズのドミノで接続する。
 */
const FAN_ROOT_Z = FEEDER_Z - 2.8
/** 根と直線の最後のドミノを、通常の0.7ピッチで接続する終端位置。 */
const LINE_END_Z = FAN_ROOT_Z - LINE_PITCH_Z
/** 曲線の終点と横向きの腕を同じZ面に揃える、扇状アームの高さ。 */
const FAN_ARM_Z = -4.58
/** 根から左右へ曲がる4段の向き。30度ずつ曲げて90度の横向きへ移る。 */
const FAN_CURVE_YAWS = [0, Math.PI / 6, Math.PI / 3, Math.PI / 2] as const
/** 曲線4段のXオフセット。根からアームへ接触を切らさず広げる実測位置。 */
const FAN_CURVE_X = [0.3, 0.6, 1.12, 1.7] as const
/** 曲線4段のZ位置。最後の2段をアーム面に揃え、横向きの列へ渡す。 */
const FAN_CURVE_Z = [-5.4, -4.88, -4.58, -4.58] as const
/** 中央2列用の分岐を、曲線からフィーダーへ渡す位置。 */
const FAN_CENTRAL_SPUR_Z = -4.15
/** 外側グループのspurを、アームからコネクターへ渡す位置。 */
const FAN_OUTER_SPUR_Z = -4.15
/** 外側spurと最終フィーダーを斜めに結ぶコネクターの位置。 */
const FAN_OUTER_CONNECTOR_Z = -3.8
/** コネクターを担当列の中心から外側へ0.25ずらし、隣の分岐と干渉しないようにする。 */
const FAN_CONNECTOR_OFFSET_X = 0.25
/** アームをフィーダー中心から0.28内側へ置き、spurへ向かう余白を作る。 */
const FAN_ARM_INSET_X = 0.28
/** 片側8列を2列ずつ担当する4グループ（左右合わせて8フィーダー）。 */
function validateLayout(layout: FlagLayoutSpec): void {
  if (
    !Number.isInteger(layout.cols) ||
    layout.cols < FLAG_COLS ||
    layout.cols % 2 !== 0
  ) {
    throw new Error(`国旗レイアウトの列数は16以上の偶数である必要があります: ${layout.cols}`)
  }
  if (
    !Number.isInteger(layout.rows) ||
    layout.rows < FLAG_ROWS ||
    layout.rows % 2 !== 0
  ) {
    throw new Error(`国旗レイアウトの行数は10以上の偶数である必要があります: ${layout.rows}`)
  }
  if (
    layout.chainGroupWeight !== undefined &&
    (!Number.isInteger(layout.chainGroupWeight) || layout.chainGroupWeight <= 0)
  ) {
    throw new Error(
      `chainIndexのグループ重みは正の整数である必要があります: ${layout.chainGroupWeight}`,
    )
  }
}

function chainGroupWeight(layout: FlagLayoutSpec): number {
  return layout.chainGroupWeight ?? 1
}

/** 行数が増えても、通常モードの扇状分岐と国旗の相対間隔を保つためのZ移動量。 */
function layoutZOffset(layout: FlagLayoutSpec): number {
  return -((layout.rows - FLAG_ROWS) / 2) * FLAG_PITCH_Z
}

function flagZ0(layout: FlagLayoutSpec): number {
  return FLAG_Z0 + layoutZOffset(layout)
}

function feederZ(layout: FlagLayoutSpec): number {
  return FEEDER_Z + layoutZOffset(layout)
}

function fanZ(baseZ: number, layout: FlagLayoutSpec): number {
  return baseZ + layoutZOffset(layout)
}

function fanSpurGroupCount(cols: number): number {
  return Math.ceil(cols / 4)
}
/** 直線12個の後に根1個と曲線4段を置いた、左右共通の最終曲線の到達順位。 */
const FAN_BRANCH_BASE_CHAIN_INDEX = LINE_COUNT + 4

function flagX(col: number, cols = FLAG_COLS): number {
  return (col - (cols - 1) / 2) * FLAG_PITCH_X
}

/** フィーダーが担当する隣接2列を、中央側から外側へ向かう順で返す。 */
export function feederColumns(
  side: -1 | 1,
  group: number,
  cols = FLAG_COLS,
): number[] {
  const groupCount = fanSpurGroupCount(cols)
  if (group < 0 || group >= groupCount) {
    throw new Error(`扇状分岐のグループ番号が範囲外です: ${group}`)
  }

  const halfCols = cols / 2
  const firstCol =
    side < 0 ? halfCols - 2 - group * 2 : halfCols + group * 2
  if (side < 0 && firstCol < 0) return [0]
  if (side > 0 && firstCol + 1 >= cols) return [cols - 1]
  return [firstCol, firstCol + 1]
}

function feederX(side: -1 | 1, group: number, cols: number): number {
  const columns = feederColumns(side, group, cols)
  return columns.reduce((sum, col) => sum + flagX(col, cols), 0) / columns.length
}

function createLinePlacements(layout: FlagLayoutSpec): DominoPlacement[] {
  return Array.from({ length: LINE_COUNT }, (_, index) => ({
    id: `line-${index}`,
    kind: 'line' as const,
    x: 0,
    z: fanZ(LINE_END_Z, layout) - (LINE_COUNT - 1 - index) * LINE_PITCH_Z,
    width: DOMINO_WIDTH,
    yaw: 0,
    chainIndex: index,
  }))
}

function createBranch(
  id: string,
  x: number,
  z: number,
  chainIndex: number,
  yaw = 0,
): DominoPlacement {
  return {
    id,
    kind: 'branch',
    x,
    z,
    width: DOMINO_WIDTH,
    yaw,
    chainIndex,
  }
}

/**
 * 通常サイズのドミノだけで扇状分岐を作る。
 * 左右それぞれの曲線の後ろに通常ピッチの横向きアームを置き、
 * 最終フィーダーはすべてyaw 0として国旗の正面向きと接触を保つ。
 */
function createFanPlacements(layout: FlagLayoutSpec): DominoPlacement[] {
  const layoutFeederZ = feederZ(layout)
  const groupCount = fanSpurGroupCount(layout.cols)
  const groupWeight = chainGroupWeight(layout)
  const placements: DominoPlacement[] = [
    createBranch('fan-root', 0, fanZ(FAN_ROOT_Z, layout), LINE_COUNT, 0),
  ]

  for (const side of [-1, 1] as const) {
    const sideName = side < 0 ? 'left' : 'right'
    const curveChainIndexes = [
      LINE_COUNT + 1,
      LINE_COUNT + 2,
      LINE_COUNT + 3,
      FAN_BRANCH_BASE_CHAIN_INDEX,
    ]
    for (let index = 0; index < FAN_CURVE_X.length; index += 1) {
      placements.push(
        createBranch(
          `fan-${sideName}-curve-${index}`,
          side * FAN_CURVE_X[index],
          fanZ(FAN_CURVE_Z[index], layout),
          curveChainIndexes[index],
          side * FAN_CURVE_YAWS[index],
        ),
      )
    }

    const centralTargetX = feederX(side, 0, layout.cols)
    placements.push(
      createBranch(
        `fan-${sideName}-central-spur`,
        centralTargetX,
        fanZ(FAN_CENTRAL_SPUR_Z, layout),
        FAN_BRANCH_BASE_CHAIN_INDEX,
        side * (Math.PI / 4),
      ),
      createBranch(
        `fan-${sideName}-feeder-0`,
        centralTargetX,
        layoutFeederZ,
        FAN_BRANCH_BASE_CHAIN_INDEX,
        0,
      ),
    )

    // 最初のアームはcurve-3を兼ね、以降のアームは0.66ピッチで並べる。
    for (let group = 1; group < groupCount; group += 1) {
      const targetX = feederX(side, group, layout.cols)
      const armChainIndex = FAN_BRANCH_BASE_CHAIN_INDEX + group * groupWeight
      const armX = targetX - side * FAN_ARM_INSET_X
      const spur = { x: targetX, z: fanZ(FAN_OUTER_SPUR_Z, layout) }
      const connector = {
        x: targetX + side * FAN_CONNECTOR_OFFSET_X,
        z: fanZ(FAN_OUTER_CONNECTOR_Z, layout),
      }

      if (group > 1) {
        const previousArmX =
          feederX(side, group - 1, layout.cols) - side * FAN_ARM_INSET_X
        placements.push(
          createBranch(
            `fan-${sideName}-arm-gap-${group - 2}`,
            previousArmX + side * FLAG_PITCH_X,
            fanZ(FAN_ARM_Z, layout),
            armChainIndex,
            side * (Math.PI / 2),
          ),
        )
      }
      if (group > 1) {
        placements.push(
          createBranch(
            `fan-${sideName}-arm-${group}`,
            armX,
            fanZ(FAN_ARM_Z, layout),
            armChainIndex,
            side * (Math.PI / 2),
          ),
        )
      }
      placements.push(
        createBranch(
          `fan-${sideName}-spur-${group}`,
          spur.x,
          spur.z,
          armChainIndex,
          side * (65 * Math.PI / 180),
        ),
        createBranch(
          `fan-${sideName}-connector-${group}`,
          connector.x,
          connector.z,
          armChainIndex,
          side * (45 * Math.PI / 180),
        ),
        // 最終フィーダーは常に国旗の列へ直角（yaw 0）にする。
        createBranch(
          `fan-${sideName}-feeder-${group}`,
          targetX,
          layoutFeederZ,
          armChainIndex,
          0,
        ),
      )
    }
  }

  return placements
}

export function feederEntryRank(col: number, cols = FLAG_COLS): number {
  for (let group = 0; group < fanSpurGroupCount(cols); group += 1) {
    for (const side of [-1, 1] as const) {
      if (feederColumns(side, group, cols).includes(col)) return group
    }
  }
  throw new Error(`国旗列${col}のフィーダーがありません`)
}

function createFlagPlacements(
  grid: FlagCellColor[][],
  layout: FlagLayoutSpec,
): DominoPlacement[] {
  const layoutFlagZ0 = flagZ0(layout)
  const groupWeight = chainGroupWeight(layout)
  return grid.flatMap((row, rowIndex) =>
    row.map((color, col) => ({
      id: `flag-${rowIndex}-${col}`,
      kind: 'flag' as const,
      x: flagX(col, layout.cols),
      z: layoutFlagZ0 + rowIndex * FLAG_PITCH_Z,
      width: DOMINO_WIDTH,
      yaw: 0,
      // V字に広がる経路の順位。フィーダーまでの距離に行方向の深さを加える。
      chainIndex:
        FAN_BRANCH_BASE_CHAIN_INDEX +
        feederEntryRank(col, layout.cols) * groupWeight +
        rowIndex,
      color,
      row: rowIndex,
      col,
    })),
  )
}

/** 直線 → 扇状分岐 → 16×10の国旗、という全ドミノ配置を作る。 */
export function createDominoPlacements(
  flagId: DominoFlagId = 'jp',
  layout: FlagLayoutSpec = NORMAL_FLAG_LAYOUT,
): DominoPlacement[] {
  validateLayout(layout)
  return [
    ...createLinePlacements(layout),
    ...createFanPlacements(layout),
    ...createFlagPlacements(
      layout.cols === FLAG_COLS && layout.rows === FLAG_ROWS
        ? createFlagGrid(flagId)
        : createBigFlagGrid(flagId, { cols: layout.cols, rows: layout.rows }),
      layout,
    ),
  ]
}

/** カメラのフィッティングに使う、回転後ドミノのX/Z投影を含む境界。 */
export function getLayoutBounds(placements: DominoPlacement[]): {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
} {
  if (placements.length === 0) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }
  }

  const halfDepth = DOMINO_DEPTH / 2
  return placements.reduce(
    (bounds, placement) => {
      const yaw = placement.yaw ?? 0
      const halfWidth = placement.width / 2
      const xRadius =
        Math.abs(halfWidth * Math.cos(yaw)) + Math.abs(halfDepth * Math.sin(yaw))
      const zRadius =
        Math.abs(halfWidth * Math.sin(yaw)) + Math.abs(halfDepth * Math.cos(yaw))
      return {
        minX: Math.min(bounds.minX, placement.x - xRadius),
        maxX: Math.max(bounds.maxX, placement.x + xRadius),
        minZ: Math.min(bounds.minZ, placement.z - zRadius),
        maxZ: Math.max(bounds.maxZ, placement.z + zRadius),
      }
    },
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
    },
  )
}
