// しんけいすいじゃくの絵柄（テーマ）データ。山札の組み立て・判定は cardDeck.ts が持ち、
// ここはデータだけを持つ。
// 画像はpublic配下の既存素材（はたらくくるまのイラスト・flag-iconsの国旗SVG）を
// パスで参照するだけなので、新しい素材もPWAキャッシュの増加もない。

export type ShinkeisuijakuTheme = 'animal' | 'vehicle' | 'number' | 'flag'

/**
 * カードの表面。文字（絵文字・すうじ）で表すものと、画像で表すものがある。
 * idはペア判定のキーで、テーマの中で重複しない。nameは読み上げ・aria-labelに使う。
 */
export type CardFace =
  | { id: string; name: string; symbol: string }
  | { id: string; name: string; image: string }

export type ThemeDefinition = {
  /** 絵柄えらびのボタンに出す名前。 */
  label: string
  /** いちばん多いペア数ぶん以上を並べ、先頭から必要な数だけ使う。 */
  faces: readonly CardFace[]
}

export const THEMES: Record<ShinkeisuijakuTheme, ThemeDefinition> = {
  animal: {
    label: 'どうぶつ',
    faces: [
      { id: 'dog', name: 'いぬ', symbol: '🐶' },
      { id: 'cat', name: 'ねこ', symbol: '🐱' },
      { id: 'rabbit', name: 'うさぎ', symbol: '🐰' },
      { id: 'bear', name: 'くま', symbol: '🐻' },
      { id: 'panda', name: 'パンダ', symbol: '🐼' },
      { id: 'koala', name: 'コアラ', symbol: '🐨' },
      { id: 'tiger', name: 'とら', symbol: '🐯' },
      { id: 'lion', name: 'ライオン', symbol: '🦁' },
    ],
  },
  vehicle: {
    label: 'はたらくくるま',
    faces: [
      { id: 'fire-engine', name: 'しょうぼうしゃ', image: 'images/working-vehicles/fire-engine.webp' },
      { id: 'ambulance', name: 'きゅうきゅうしゃ', image: 'images/working-vehicles/ambulance.webp' },
      { id: 'police-car', name: 'パトカー', image: 'images/working-vehicles/police-car.webp' },
      { id: 'excavator', name: 'ショベルカー', image: 'images/working-vehicles/excavator.webp' },
      { id: 'dump-truck', name: 'ダンプカー', image: 'images/working-vehicles/dump-truck.webp' },
      { id: 'route-bus', name: 'ろせんバス', image: 'images/working-vehicles/route-bus.webp' },
      { id: 'crane-truck', name: 'クレーンしゃ', image: 'images/working-vehicles/crane-truck.webp' },
      { id: 'garbage-truck', name: 'ごみしゅうしゅうしゃ', image: 'images/working-vehicles/garbage-truck.webp' },
    ],
  },
  number: {
    label: 'すうじ',
    faces: [
      { id: 'number-1', name: 'いち', symbol: '1' },
      { id: 'number-2', name: 'に', symbol: '2' },
      { id: 'number-3', name: 'さん', symbol: '3' },
      { id: 'number-4', name: 'よん', symbol: '4' },
      { id: 'number-5', name: 'ご', symbol: '5' },
      { id: 'number-6', name: 'ろく', symbol: '6' },
      { id: 'number-7', name: 'なな', symbol: '7' },
      { id: 'number-8', name: 'はち', symbol: '8' },
    ],
  },
  flag: {
    label: 'こっき',
    faces: [
      { id: 'jp', name: 'にほん', image: 'flags/jp.svg' },
      { id: 'us', name: 'アメリカ', image: 'flags/us.svg' },
      { id: 'gb', name: 'イギリス', image: 'flags/gb.svg' },
      { id: 'fr', name: 'フランス', image: 'flags/fr.svg' },
      { id: 'de', name: 'ドイツ', image: 'flags/de.svg' },
      { id: 'br', name: 'ブラジル', image: 'flags/br.svg' },
      { id: 'kr', name: 'かんこく', image: 'flags/kr.svg' },
      { id: 'ca', name: 'カナダ', image: 'flags/ca.svg' },
    ],
  },
}

/** 絵柄えらびに並べる順番。 */
export const THEME_ORDER: readonly ShinkeisuijakuTheme[] = ['animal', 'vehicle', 'number', 'flag']
