export type FlagCellColor =
  | 'red'
  | 'white'
  | 'blue'
  | 'black'
  | 'yellow'
  | 'green'
  | 'orange'

/** ドミノが倒れたときに見える国旗面で使う、共通の7色。 */
export const FLAG_COLOR_HEX: Readonly<Record<FlagCellColor, string>> = {
  red: '#bc002d',
  white: '#fffdf5',
  blue: '#1f4aa8',
  black: '#252525',
  yellow: '#f2c94c',
  green: '#1f7a3d',
  orange: '#f28c28',
}

export type DominoFlagId =
  | 'jp'
  | 'fr'
  | 'us'
  | 'gb'
  | 'it'
  | 'de'
  | 'nl'
  | 'be'
  | 'pl'
  | 'ua'
  | 'id'
  | 'ch'
  | 'se'
  | 'fi'
  | 'bd'
  | 'ca'
  | 'br'
  | 'kr'
  | 'in'
  | 'tr'

export type DominoFlagDefinition = {
  id: DominoFlagId
  nameJa: string
  /** BASE_URLを含めず、選択画面から参照できる相対パスにする。 */
  imagePath: string
  /** R/W/B/K/Y/G/Oの1文字を16個並べた行を10行持つ。 */
  rows: readonly string[]
}

export type FlagCellCharacter = 'R' | 'W' | 'B' | 'K' | 'Y' | 'G' | 'O'

/** 文字列の旗データを、Three.jsで使う色IDへ変換する表。 */
export const FLAG_CELL_COLOR_BY_CHAR: Readonly<
  Record<FlagCellCharacter, FlagCellColor>
> = {
  R: 'red',
  W: 'white',
  B: 'blue',
  K: 'black',
  Y: 'yellow',
  G: 'green',
  O: 'orange',
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

const italyRows = [
  'GGGGGWWWWWWRRRRR',
  'GGGGGWWWWWWRRRRR',
  'GGGGGWWWWWWRRRRR',
  'GGGGGWWWWWWRRRRR',
  'GGGGGWWWWWWRRRRR',
  'GGGGGWWWWWWRRRRR',
  'GGGGGWWWWWWRRRRR',
  'GGGGGWWWWWWRRRRR',
  'GGGGGWWWWWWRRRRR',
  'GGGGGWWWWWWRRRRR',
] as const

const germanyRows = [
  'KKKKKKKKKKKKKKKK',
  'KKKKKKKKKKKKKKKK',
  'KKKKKKKKKKKKKKKK',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'YYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYYY',
] as const

const netherlandsRows = [
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
] as const

const belgiumRows = [
  'KKKKKYYYYYYRRRRR',
  'KKKKKYYYYYYRRRRR',
  'KKKKKYYYYYYRRRRR',
  'KKKKKYYYYYYRRRRR',
  'KKKKKYYYYYYRRRRR',
  'KKKKKYYYYYYRRRRR',
  'KKKKKYYYYYYRRRRR',
  'KKKKKYYYYYYRRRRR',
  'KKKKKYYYYYYRRRRR',
  'KKKKKYYYYYYRRRRR',
] as const

const polandRows = [
  'WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
] as const

const ukraineRows = [
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
  'YYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYYY',
] as const

const indonesiaRows = [
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWW',
] as const

// 腕を2列・2行にして、16×10の面でも正方形に近い十字として見せる。
const switzerlandRows = [
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRWWRRRRRRR',
  'RRRRRRRWWRRRRRRR',
  'RRRRRWWWWWWRRRRR',
  'RRRRRWWWWWWRRRRR',
  'RRRRRRRWWRRRRRRR',
  'RRRRRRRWWRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
] as const

const swedenRows = [
  'BBBBBYYBBBBBBBBB',
  'BBBBBYYBBBBBBBBB',
  'BBBBBYYBBBBBBBBB',
  'BBBBBYYBBBBBBBBB',
  'YYYYYYYYYYYYYYYY',
  'YYYYYYYYYYYYYYYY',
  'BBBBBYYBBBBBBBBB',
  'BBBBBYYBBBBBBBBB',
  'BBBBBYYBBBBBBBBB',
  'BBBBBYYBBBBBBBBB',
] as const

const finlandRows = [
  'WWWWWBBWWWWWWWWW',
  'WWWWWBBWWWWWWWWW',
  'WWWWWBBWWWWWWWWW',
  'WWWWWBBWWWWWWWWW',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
  'WWWWWBBWWWWWWWWW',
  'WWWWWBBWWWWWWWWW',
  'WWWWWBBWWWWWWWWW',
  'WWWWWBBWWWWWWWWW',
] as const

// 日本の円と同じ半径を使い、バングラデシュ国旗の赤い円を中央より左へ寄せる。
const bangladeshRows = [
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGRRRRGGGGGGG',
  'GGGGRRRRRRGGGGGG',
  'GGGGRRRRRRGGGGGG',
  'GGGGRRRRRRGGGGGG',
  'GGGGRRRRRRGGGGGG',
  'GGGGGRRRRGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
] as const

// 左右の赤帯と列4,11の白い境界を保ち、中央6列で葉と茎を作る。
const canadaRows = [
  'RRRRWWWWWWWWRRRR',
  'RRRRWWWRRWWWRRRR',
  'RRRRWRWRRWRWRRRR',
  'RRRRWRRRRRRWRRRR',
  'RRRRWRRRRRRWRRRR',
  'RRRRWWRRRRWWRRRR',
  'RRRRWWWRRWWWRRRR',
  'RRRRWWWRRWWWRRRR',
  'RRRRWWWRRWWWRRRR',
  'RRRRWWWWWWWWRRRR',
] as const

// 黄色の外形は上下に2,4,6,8,10,10,8,6,4,2セルと広がり、中央に青い円を重ねる。
const brazilRows = [
  'GGGGGGGYYGGGGGGG',
  'GGGGGGYYYYGGGGGG',
  'GGGGGYYYYYYGGGGG',
  'GGGGYYYBBYYYGGGG',
  'GGGYYYBBBBYYYGGG',
  'GGGYYYBBBBYYYGGG',
  'GGGGYYYBBYYYGGGG',
  'GGGGGYYYYYYGGGGG',
  'GGGGGGYYYYGGGGGG',
  'GGGGGGGYYGGGGGGG',
] as const

// 中央の赤青を4×4の円にし、黒い卦は各隅に2行×3列の平行線として置く。
const koreaRows = [
  'WWWWWWWWWWWWWWWW',
  'WKKKWWWWWWWWKKKW',
  'WKKKWWWWWWWWKKKW',
  'WWWWWWWRRWWWWWWW',
  'WWWWWWRRRRWWWWWW',
  'WWWWWWBBBBWWWWWW',
  'WWWWWWWBBWWWWWWW',
  'WKKKWWWWWWWWKKKW',
  'WKKKWWWWWWWWKKKW',
  'WWWWWWWWWWWWWWWW',
] as const

// 白帯いっぱいの青い輪を、中央2×2を白のまま残してチャクラとして見せる。
const indiaRows = [
  'OOOOOOOOOOOOOOOO',
  'OOOOOOOOOOOOOOOO',
  'OOOOOOOOOOOOOOOO',
  'WWWWWWWBBWWWWWWW',
  'WWWWWWBWWBWWWWWW',
  'WWWWWWBWWBWWWWWW',
  'WWWWWWWBBWWWWWWW',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGGG',
] as const

// 大きく右へずらした赤い内円で削り、左側の太い弧と上下の角を作る。
const turkeyRows = [
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'RRRRWWWWRRRRRRRR',
  'RRRWWWWRRRRRRRRR',
  'RRRWWWRRRRWRRRRR',
  'RRRWWWRRRWWWRRRR',
  'RRRWWWWRRRWRRRRR',
  'RRRRWWWWRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
  'RRRRRRRRRRRRRRRR',
] as const

/** こっきドミノで使う20か国。次の選択画面でもこの順序をそのまま使える。 */
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
  {
    id: 'it',
    nameJa: 'イタリア',
    imagePath: 'flags/it.svg',
    rows: italyRows,
  },
  {
    id: 'de',
    nameJa: 'ドイツ',
    imagePath: 'flags/de.svg',
    rows: germanyRows,
  },
  {
    id: 'nl',
    nameJa: 'オランダ',
    imagePath: 'flags/nl.svg',
    rows: netherlandsRows,
  },
  {
    id: 'be',
    nameJa: 'ベルギー',
    imagePath: 'flags/be.svg',
    rows: belgiumRows,
  },
  {
    id: 'pl',
    nameJa: 'ポーランド',
    imagePath: 'flags/pl.svg',
    rows: polandRows,
  },
  {
    id: 'ua',
    nameJa: 'ウクライナ',
    imagePath: 'flags/ua.svg',
    rows: ukraineRows,
  },
  {
    id: 'id',
    nameJa: 'インドネシア',
    imagePath: 'flags/id.svg',
    rows: indonesiaRows,
  },
  {
    id: 'ch',
    nameJa: 'スイス',
    imagePath: 'flags/ch.svg',
    rows: switzerlandRows,
  },
  {
    id: 'se',
    nameJa: 'スウェーデン',
    imagePath: 'flags/se.svg',
    rows: swedenRows,
  },
  {
    id: 'fi',
    nameJa: 'フィンランド',
    imagePath: 'flags/fi.svg',
    rows: finlandRows,
  },
  {
    id: 'bd',
    nameJa: 'バングラデシュ',
    imagePath: 'flags/bd.svg',
    rows: bangladeshRows,
  },
  {
    id: 'ca',
    nameJa: 'カナダ',
    imagePath: 'flags/ca.svg',
    rows: canadaRows,
  },
  {
    id: 'br',
    nameJa: 'ブラジル',
    imagePath: 'flags/br.svg',
    rows: brazilRows,
  },
  {
    id: 'kr',
    nameJa: 'かんこく',
    imagePath: 'flags/kr.svg',
    rows: koreaRows,
  },
  {
    id: 'in',
    nameJa: 'インド',
    imagePath: 'flags/in.svg',
    rows: indiaRows,
  },
  {
    id: 'tr',
    nameJa: 'トルコ',
    imagePath: 'flags/tr.svg',
    rows: turkeyRows,
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

/** R/W/B/K/Y/G/Oの行データを、配置生成と描画が使う10行×16列の色IDへ変換する。 */
export function createFlagGrid(id: string): FlagCellColor[][] {
  const definition = getDominoFlagDefinition(id)
  return convertFlagRows(definition.id, definition.rows)
}
