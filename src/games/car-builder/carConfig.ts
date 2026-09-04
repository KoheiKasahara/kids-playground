/**
 * 「3Dクルマづくり」のカスタマイズ状態（CarConfig）と、カテゴリ／選択肢のカタログ。
 *
 * このファイルはUI・3D生成・テストが共通で参照する単一情報源であり、three.jsに依存しない。
 * 後続Issueで各カテゴリの本実装を足すときは、
 *   1. ここの `CarOptionIdMap` に選択肢IDを足す（またはカテゴリを1行足す）
 *   2. `CAR_CATEGORIES` に選択肢の表示定義を足す
 *   3. 見た目を持つカテゴリなら carParts.ts の登録表に生成関数を足す
 * の3か所だけで完結する。カテゴリごとの巨大な条件分岐をUIや3D側に増やさないための構造。
 */

export type BodyType = 'sports' | 'suv' | 'bus' | 'truck' | 'police'
export type WheelType = 'small' | 'big' | 'offroad' | 'racing'
export type CarColorId = 'red' | 'blue' | 'yellow' | 'green' | 'orange' | 'pink' | 'purple' | 'white' | 'black'
export type FrontType = 'round' | 'square' | 'slim'
export type RoofType = 'none' | 'carrier'
export type DecorationType = 'none' | 'star'
export type MarkType = 'none' | 'plate'
export type RideHeight = 'normal' | 'high'

/**
 * カテゴリID → そのカテゴリが取りうる選択肢IDの対応表。
 * CarConfig・カタログ・3D側の登録表がすべてこの1つの型から導出されるため、
 * カテゴリを足すとどれか1つでも書き漏らせば型エラーになる。
 */
export type CarOptionIdMap = {
  body: BodyType
  wheel: WheelType
  color: CarColorId
  front: FrontType
  roof: RoofType
  decoration: DecorationType
  mark: MarkType
  rideHeight: RideHeight
}

export type CarCategoryId = keyof CarOptionIdMap

/**
 * 現在のカスタマイズ内容。値は必ず「カテゴリの選択肢ID」であり、色も hex ではなくIDで持つ。
 * 全カテゴリを同じ形（ID1つ）で表すことで、UIからの更新も3D側の差分検出も
 * カテゴリごとの分岐なしに書ける。hexなど表示用の値はカタログから引く（resolveCarColor）。
 */
export type CarConfig = { readonly [K in CarCategoryId]: CarOptionIdMap[K] }

/** 選択肢ボタンに出す見た目。カテゴリごとに専用のUI分岐を書かずに済ませるための表現。 */
export type CarOptionPreview =
  | { kind: 'emoji'; emoji: string }
  | { kind: 'color'; hex: string }
  | { kind: 'wheel'; variant: WheelType }
  | { kind: 'front'; variant: FrontType }

export type CarOptionDefinition<Id extends string> = {
  id: Id
  /** 詳細選択UIに出す短い日本語（ひらがな中心）ラベル。 */
  label: string
  preview: CarOptionPreview
}

export type CarCategoryDefinition<K extends CarCategoryId> = {
  id: K
  /** カテゴリ一覧のボタンに出す短いラベル。 */
  label: string
  /** カテゴリ一覧のアイコン。 */
  emoji: string
  /** 読み上げ・アクセシブルネーム用の文。 */
  ariaLabel: string
  options: readonly CarOptionDefinition<CarOptionIdMap[K]>[]
}

/** 色カテゴリだけが持つ実際の塗り色。3D側はこのhexを使う。 */
const CAR_COLOR_HEX: Record<CarColorId, string> = {
  red: '#ef4d4d',
  blue: '#3d7bf5',
  yellow: '#ffc531',
  green: '#42ad68',
  orange: '#f28c28',
  pink: '#eb5b8f',
  purple: '#8256c7',
  // 純白／完全な黒を避け、3D上でも陰影を読み取れる値にする。
  white: '#e9edf2',
  black: '#252a31',
}

export const CAR_CATEGORIES: { [K in CarCategoryId]: CarCategoryDefinition<K> } = {
  body: {
    id: 'body',
    label: 'ボディ',
    emoji: '🚗',
    ariaLabel: 'ボディを えらぶ',
    options: [
      { id: 'sports', label: 'スポーツカー', preview: { kind: 'emoji', emoji: '🏎️' } },
      { id: 'suv', label: 'SUV', preview: { kind: 'emoji', emoji: '🚙' } },
      { id: 'bus', label: 'バス', preview: { kind: 'emoji', emoji: '🚌' } },
      { id: 'truck', label: 'トラック', preview: { kind: 'emoji', emoji: '🚚' } },
      { id: 'police', label: 'パトカー風', preview: { kind: 'emoji', emoji: '🚓' } },
    ],
  },
  wheel: {
    id: 'wheel',
    label: 'タイヤ',
    emoji: '🛞',
    ariaLabel: 'タイヤを えらぶ',
    options: [
      { id: 'small', label: 'ちいさい', preview: { kind: 'wheel', variant: 'small' } },
      { id: 'big', label: 'おおきい', preview: { kind: 'wheel', variant: 'big' } },
      { id: 'offroad', label: 'オフロード', preview: { kind: 'wheel', variant: 'offroad' } },
      { id: 'racing', label: 'レーシング', preview: { kind: 'wheel', variant: 'racing' } },
    ],
  },
  color: {
    id: 'color',
    label: 'カラー',
    emoji: '🎨',
    ariaLabel: 'カラーを えらぶ',
    options: [
      { id: 'red', label: 'あか', preview: { kind: 'color', hex: CAR_COLOR_HEX.red } },
      { id: 'blue', label: 'あお', preview: { kind: 'color', hex: CAR_COLOR_HEX.blue } },
      { id: 'yellow', label: 'きいろ', preview: { kind: 'color', hex: CAR_COLOR_HEX.yellow } },
      { id: 'green', label: 'みどり', preview: { kind: 'color', hex: CAR_COLOR_HEX.green } },
      { id: 'orange', label: 'オレンジ', preview: { kind: 'color', hex: CAR_COLOR_HEX.orange } },
      { id: 'pink', label: 'ピンク', preview: { kind: 'color', hex: CAR_COLOR_HEX.pink } },
      { id: 'purple', label: 'むらさき', preview: { kind: 'color', hex: CAR_COLOR_HEX.purple } },
      { id: 'white', label: 'しろ', preview: { kind: 'color', hex: CAR_COLOR_HEX.white } },
      { id: 'black', label: 'くろ', preview: { kind: 'color', hex: CAR_COLOR_HEX.black } },
    ],
  },
  front: {
    id: 'front',
    label: 'フロント',
    emoji: '💡',
    ariaLabel: 'フロントを えらぶ',
    options: [
      { id: 'round', label: '丸ライト', preview: { kind: 'front', variant: 'round' } },
      { id: 'square', label: '四角ライト', preview: { kind: 'front', variant: 'square' } },
      { id: 'slim', label: '細目ライト', preview: { kind: 'front', variant: 'slim' } },
    ],
  },
  roof: {
    id: 'roof',
    label: 'やね',
    emoji: '🏠',
    ariaLabel: 'やねを えらぶ',
    options: [
      { id: 'none', label: 'なし', preview: { kind: 'emoji', emoji: '🚫' } },
      { id: 'carrier', label: 'キャリア', preview: { kind: 'emoji', emoji: '🧳' } },
    ],
  },
  decoration: {
    id: 'decoration',
    label: 'かざり',
    emoji: '⭐',
    ariaLabel: 'かざりを えらぶ',
    options: [
      { id: 'none', label: 'なし', preview: { kind: 'emoji', emoji: '🚫' } },
      { id: 'star', label: 'ほし', preview: { kind: 'emoji', emoji: '⭐' } },
    ],
  },
  mark: {
    id: 'mark',
    label: 'ナンバー',
    emoji: '🔢',
    ariaLabel: 'ナンバーや マークを えらぶ',
    options: [
      { id: 'none', label: 'なし', preview: { kind: 'emoji', emoji: '🚫' } },
      { id: 'plate', label: 'ナンバー', preview: { kind: 'emoji', emoji: '🔢' } },
    ],
  },
  rideHeight: {
    id: 'rideHeight',
    label: 'たかさ',
    emoji: '↕️',
    ariaLabel: 'くるまの たかさを えらぶ',
    options: [
      { id: 'normal', label: 'ふつう', preview: { kind: 'emoji', emoji: '🚗' } },
      { id: 'high', label: 'たかい', preview: { kind: 'emoji', emoji: '⬆️' } },
    ],
  },
}

/**
 * 画面に並べる順。Issue #401 の8カテゴリの並びをそのまま持つ。
 * `CAR_CATEGORIES` の全キーを重複なく含むことは carConfig.test.ts で保証する。
 */
export const CAR_CATEGORY_ORDER: readonly CarCategoryId[] = [
  'body',
  'wheel',
  'color',
  'front',
  'roof',
  'decoration',
  'mark',
  'rideHeight',
]

export const DEFAULT_CAR_CONFIG: CarConfig = {
  body: 'sports',
  wheel: 'small',
  color: 'red',
  // 既存の標準形を四角ライトとして引き継ぎ、初期見た目を不用意に変えない。
  front: 'square',
  roof: 'none',
  decoration: 'none',
  mark: 'none',
  rideHeight: 'normal',
}

export function carCategoryOrder(): readonly CarCategoryDefinition<CarCategoryId>[] {
  return CAR_CATEGORY_ORDER.map((id) => CAR_CATEGORIES[id] as CarCategoryDefinition<CarCategoryId>)
}

/** カタログ上の選択肢定義を引く。未知のIDなら undefined。 */
export function findCarOption(
  categoryId: CarCategoryId,
  optionId: string,
): CarOptionDefinition<string> | undefined {
  const options = CAR_CATEGORIES[categoryId].options as readonly CarOptionDefinition<string>[]
  return options.find((option) => option.id === optionId)
}

/**
 * 1カテゴリだけを更新した新しいCarConfigを返す。
 *
 * UI側は「カテゴリID + 選択肢ID(string)」しか持たないため、ここでカタログに実在するIDかを
 * 検証する。未知のIDや現在値と同じIDのときは同じ参照をそのまま返し、Reactの再描画と
 * 3D側の作り直しを不要に発生させない。
 */
export function selectCarOption(
  config: CarConfig,
  categoryId: CarCategoryId,
  optionId: string,
): CarConfig {
  if (findCarOption(categoryId, optionId) === undefined) return config
  if (config[categoryId] === optionId) return config
  return { ...config, [categoryId]: optionId } as CarConfig
}

/** 現在のCarConfigの、あるカテゴリの選択肢定義を引く。 */
export function currentCarOption(
  config: CarConfig,
  categoryId: CarCategoryId,
): CarOptionDefinition<string> {
  const option = findCarOption(categoryId, config[categoryId])
  // CarConfigの値は型でカタログのIDに縛られているため、通常ここには来ない。
  // 万一カタログとdefaultがずれても画面が落ちないように先頭の選択肢へ倒す。
  return option ?? (CAR_CATEGORIES[categoryId].options[0] as CarOptionDefinition<string>)
}

/** ボディカラーの実際の塗り色（hex）。3D側はCarConfigからこれを引いて使う。 */
export function resolveCarColor(config: CarConfig): string {
  return CAR_COLOR_HEX[config.color]
}
