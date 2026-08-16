export type FlagCellColor = 'red' | 'white' | 'blue'

/** ドミノが倒れたときに見える国旗面で使う、共通の3色。 */
export const FLAG_COLOR_HEX: Readonly<Record<FlagCellColor, string>> = {
  red: '#bc002d',
  white: '#fffdf5',
  blue: '#1f4aa8',
}

export type DominoFlagId = 'jp' | 'fr' | 'us' | 'gb'

export type DominoFlagDefinition = {
  id: DominoFlagId
  nameJa: string
  /** BASE_URLを含めず、選択画面から参照できる相対パスにする。 */
  imagePath: string
  /** R/W/Bの1文字を16個並べた行を10行持つ。 */
  rows: readonly string[]
}

export type FlagCellCharacter = 'R' | 'W' | 'B'

/** 文字列の旗データを、Three.jsで使う色IDへ変換する表。 */
export const FLAG_CELL_COLOR_BY_CHAR: Readonly<
  Record<FlagCellCharacter, FlagCellColor>
> = {
  R: 'red',
  W: 'white',
  B: 'blue',
}

const japanRows = [
  'WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
  'WWWWWWRRRRWWWWWW',
  'WWWWWRRRRRRWWWWW',
  'WWWWWRRRRRRWWWWW',
  'WWWWWRRRRRRWWWWW',
  'WWWWWRRRRRRWWWWW',
  'WWWWWWRRRRWWWWWW',
  'WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
] as const

const franceRows = [
  'BBBBBWWWWWWRRRRR',
  'BBBBBWWWWWWRRRRR',
  'BBBBBWWWWWWRRRRR',
  'BBBBBWWWWWWRRRRR',
  'BBBBBWWWWWWRRRRR',
  'BBBBBWWWWWWRRRRR',
  'BBBBBWWWWWWRRRRR',
  'BBBBBWWWWWWRRRRR',
  'BBBBBWWWWWWRRRRR',
  'BBBBBWWWWWWRRRRR',
] as const

// 縞は全幅で赤白交互10本にし、13本の厳密再現より小さな画面での視認性を優先する。
// カントンは左上7列×5行で、白い星相当の6セルを置き、右側の白い縞とは青で隔てる。
const usaRows = [
  'BBBBBBBRRRRRRRRR',
  'BWBWBWBWWWWWWWWW',
  'BBBBBBBRRRRRRRRR',
  'BWBWBWBWWWWWWWWW',
  'BBBBBBBRRRRRRRRR',
  'WWWWWWWWWWWWWWWW',
  'RRRRRRRRRRRRRRRR',
  'WWWWWWWWWWWWWWWW',
  'RRRRRRRRRRRRRRRR',
  'WWWWWWWWWWWWWWWW',
] as const

// 中央の赤十字は列7,8・行4,5、その外側の列6,9・行3,6を白のフィンブリエーションにする。
// 四隅の3行×6列は隅から中心へ向かう赤の斜線を2セル刻みで置き、その上側だけに白を添えて青地を残す。
// 16×10では白を斜線の両側に置くと青地が減るため、実物に近いcounterchangeの片側配置を選ぶ。
const unitedKingdomRows = [
  'RRWWBBWRRWBBWWRR',
  'BBRRWWWRRWWWRRBB',
  'BBBBRRWRRWRRBBBB',
  'WWWWWWWRRWWWWWWW',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'WWWWWWWRRWWWWWWW',
  'BBBBRRWRRWRRBBBB',
  'BBRRWWWRRWWWRRBB',
  'RRWWBBWRRWBBWWRR',
] as const

/** こっきドミノで使う4か国。次の選択画面でもこの順序をそのまま使える。 */
export const dominoFlags: readonly DominoFlagDefinition[] = [
  {
    id: 'jp',
    nameJa: 'にほん',
    imagePath: 'flags/jp.svg',
    rows: japanRows,
  },
  {
    id: 'fr',
    nameJa: 'フランス',
    imagePath: 'flags/fr.svg',
    rows: franceRows,
  },
  {
    id: 'us',
    nameJa: 'アメリカ',
    imagePath: 'flags/us.svg',
    rows: usaRows,
  },
  {
    id: 'gb',
    nameJa: 'イギリス',
    imagePath: 'flags/gb.svg',
    rows: unitedKingdomRows,
  },
]

export const DEFAULT_DOMINO_FLAG_ID: DominoFlagId = 'jp'

/** 国旗IDをデータ定義へ解決し、未知のIDは呼び出し時に知らせる。 */
export function getDominoFlagDefinition(id: string): DominoFlagDefinition {
  const definition = dominoFlags.find((flag) => flag.id === id)
  if (!definition) throw new Error(`未知の国旗IDです: ${id}`)
  return definition
}

function convertFlagRows(id: DominoFlagId, rows: readonly string[]): FlagCellColor[][] {
  if (rows.length !== 10) {
    throw new Error(`国旗${id}の行数が10ではありません: ${rows.length}`)
  }

  return rows.map((row, rowIndex) => {
    const characters = [...row]
    if (characters.length !== 16) {
      throw new Error(
        `国旗${id}の${rowIndex}行目が16文字ではありません: ${characters.length}`,
      )
    }

    return characters.map((character, colIndex) => {
      const color = FLAG_CELL_COLOR_BY_CHAR[character as FlagCellCharacter]
      if (color === undefined) {
        throw new Error(
          `国旗${id}の${rowIndex}行${colIndex}列に不正な文字があります: ${character}`,
        )
      }
      return color
    })
  })
}

/** R/W/Bの行データを、配置生成と描画が使う10行×16列の色IDへ変換する。 */
export function createFlagGrid(id: string): FlagCellColor[][] {
  const definition = getDominoFlagDefinition(id)
  return convertFlagRows(definition.id, definition.rows)
}
