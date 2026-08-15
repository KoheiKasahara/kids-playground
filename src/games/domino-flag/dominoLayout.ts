/**
 * ワールド座標はXが右、Yが上、Zがカメラへ向かう手前。
 * 連鎖は奥の小さいZから手前の大きいZへ進み、薄いZ軸を持つドミノは
 * 倒れたあとに立っている間はカメラから見えない−Z面を上へ向ける。
 */
/**
 * ドミノ1個の大きさ。高さを1ユニットに揃え、後続の物理パラメータを決めやすくする。
 */
export const DOMINO_HEIGHT = 1.0
export const DOMINO_WIDTH = 0.6
export const DOMINO_DEPTH = 0.14

/** 国旗を16列×10行にし、ドットでも日の丸の形が読み取れる解像度にする。 */
export const FLAG_COLS = 16
export const FLAG_ROWS = 10

/**
 * 旗の横幅と縦幅の見た目を日本国旗の3:2へ近づけるピッチ。
 * 16×0.66=10.56、10×0.7=7.0で、比は約1.51になる。
 */
export const FLAG_PITCH_X = 0.66
export const FLAG_PITCH_Z = 0.7

/** 直線は短くしすぎず、最初の一押しから旗までの流れが見える12個にする。 */
export const LINE_COUNT = 12
export const LINE_PITCH_Z = 0.7

/** 全16列へ同時に倒れた力を伝える、旗の横幅に合わせたトリガーバー。 */
export const TRIGGER_BAR_WIDTH = FLAG_COLS * FLAG_PITCH_X

export type FlagCellColor = 'red' | 'white'

/** 16×10の日本国旗ドット絵。row 0が最も奥（カメラから遠い）。 */
export function createJapanFlagGrid(): FlagCellColor[][] {
  const radius = FLAG_ROWS * FLAG_PITCH_Z * 0.3

  return Array.from({ length: FLAG_ROWS }, (_, row) =>
    Array.from({ length: FLAG_COLS }, (_, col) => {
      const x = (col - (FLAG_COLS - 1) / 2) * FLAG_PITCH_X
      const z = (row - (FLAG_ROWS - 1) / 2) * FLAG_PITCH_Z
      return Math.hypot(x, z) <= radius ? 'red' : 'white'
    }),
  )
}

export type DominoPlacement = {
  id: string
  kind: 'line' | 'trigger' | 'flag'
  x: number
  z: number
  width: number
  /** flagのときだけ持つ。倒れた後に上を向く面の色。 */
  color?: FlagCellColor
  /** flagのときだけ持つ。 */
  row?: number
  col?: number
}

const FLAG_Z0 = -((FLAG_ROWS - 1) / 2) * FLAG_PITCH_Z
const TRIGGER_Z = FLAG_Z0 - LINE_PITCH_Z

/** 直線から旗までの間隔を、ドミノの高さの0.7倍で揃える。 */
function createLinePlacements(): DominoPlacement[] {
  return Array.from({ length: LINE_COUNT }, (_, index) => ({
    id: `line-${index}`,
    kind: 'line',
    x: 0,
    z: TRIGGER_Z - (LINE_COUNT - index) * LINE_PITCH_Z,
    width: DOMINO_WIDTH,
  }))
}

function createFlagPlacements(grid: FlagCellColor[][]): DominoPlacement[] {
  return grid.flatMap((row, rowIndex) =>
    row.map((color, col) => ({
      id: `flag-${rowIndex}-${col}`,
      kind: 'flag' as const,
      x: (col - (FLAG_COLS - 1) / 2) * FLAG_PITCH_X,
      z: FLAG_Z0 + rowIndex * FLAG_PITCH_Z,
      width: DOMINO_WIDTH,
      color,
      row: rowIndex,
      col,
    })),
  )
}

/** 直線 → トリガーバー → 国旗エリアの順に並んだ全ドミノ配置。 */
export function createDominoPlacements(): DominoPlacement[] {
  return [
    ...createLinePlacements(),
    {
      id: 'trigger-bar',
      kind: 'trigger',
      x: 0,
      z: TRIGGER_Z,
      width: TRIGGER_BAR_WIDTH,
    },
    ...createFlagPlacements(createJapanFlagGrid()),
  ]
}

/** カメラのフィッティングに使う、ドミノの幅と厚みを含むX/Z境界。 */
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
    (bounds, placement) => ({
      minX: Math.min(bounds.minX, placement.x - placement.width / 2),
      maxX: Math.max(bounds.maxX, placement.x + placement.width / 2),
      minZ: Math.min(bounds.minZ, placement.z - halfDepth),
      maxZ: Math.max(bounds.maxZ, placement.z + halfDepth),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
    },
  )
}
