export type Continent =
  | 'asia'
  | 'europe'
  | 'northAmerica'
  | 'southAmerica'
  | 'africa'
  | 'oceania';

export type Country = {
  /** ISO 3166-1 alpha-2 の小文字コード (例: 'jp') */
  id: string;
  /** 子ども向けの日本語表記。漢字を使わない (例: 'にほん') */
  nameJa: string;
  nameEn: string;
  continent: Continent;
  /** base からの相対パス (例: 'flags/jp.svg')。先頭にスラッシュを付けない */
  flag: string;
};

export type Question = {
  /** 正解の国 */
  answer: Country;
  /** 選択肢。必ず4件・重複なし・正解をちょうど1つ含む・順序はシャッフル済み */
  choices: Country[];
};

/** 出題形式。flagToName: 国旗を見て国名を選ぶ / nameToFlag: 国名を見て国旗を選ぶ */
export type QuizMode = 'flagToName' | 'nameToFlag';

/** 1ゲームの問題数 */
export const QUESTION_COUNT = 10;
/** 1問あたりの選択肢数 */
export const CHOICE_COUNT = 4;
