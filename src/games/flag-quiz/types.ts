export type Continent =
  | 'asia'
  | 'europe'
  | 'northAmerica'
  | 'southAmerica'
  | 'africa'
  | 'oceania';

/** むずかしさ。easy < normal < hard の順に出題対象の国が増える */
export type QuizLevel = 'easy' | 'normal' | 'hard';

export type Country = {
  /** ISO 3166-1 alpha-2 の小文字コード (例: 'jp') */
  id: string;
  /** 子ども向けの日本語表記。漢字を使わない (例: 'にほん') */
  nameJa: string;
  nameEn: string;
  continent: Continent;
  /** base からの相対パス (例: 'flags/jp.svg')。先頭にスラッシュを付けない */
  flag: string;
  /** この国が最初に出題対象になる むずかしさ */
  level: QuizLevel;
};

export type Question = {
  /** 正解の国 */
  answer: Country;
  /** 選択肢。必ず4件・重複なし・正解をちょうど1つ含む・順序はシャッフル済み */
  choices: Country[];
};

/** 出題形式。flagToName: 国旗を見て国名を選ぶ / nameToFlag: 国名を見て国旗を選ぶ */
export type QuizMode = 'flagToName' | 'nameToFlag';

/** URLのパスセグメントとしてのモード名。ルーティング・画面遷移のパス組み立てで共有する */
export const MODE_PATH: Record<QuizMode, string> = {
  flagToName: 'flag-to-name',
  nameToFlag: 'name-to-flag',
};

/** むずかしさ選択画面・結果画面などで共有する、モードの日本語ラベル */
export const MODE_LABEL: Record<QuizMode, string> = {
  flagToName: 'こっき → なまえ',
  nameToFlag: 'なまえ → こっき',
};

/** 1ゲームの問題数 */
export const QUESTION_COUNT = 10;
/** 1問あたりの選択肢数 */
export const CHOICE_COUNT = 4;

/** むずかしさの順序。出題対象は「指定した むずかしさ 以下のランクすべて」とする */
export const LEVEL_RANK: Record<QuizLevel, number> = {
  easy: 0,
  normal: 1,
  hard: 2,
};

/** 値が QuizLevel かどうかを判定する型ガード。URLパラメータの検証に使う */
export function isQuizLevel(value: unknown): value is QuizLevel {
  return value === 'easy' || value === 'normal' || value === 'hard';
}

/** むずかしさ選択画面・結果画面などで共有する日本語ラベル */
export const LEVEL_LABEL: Record<QuizLevel, string> = {
  easy: 'かんたん',
  normal: 'ふつう',
  hard: 'むずかしい',
};

/** むずかしさ選択画面に表示する、出題対象の国の説明 */
export const LEVEL_DESCRIPTION: Record<QuizLevel, string> = {
  easy: 'よく しってる 20の くに',
  normal: '45の くに',
  hard: 'せかいの 100の くに',
};

/** むずかしさ選択画面に表示する星（アクセシビリティのため aria-hidden で使う） */
export const LEVEL_STARS: Record<QuizLevel, string> = {
  easy: '⭐',
  normal: '⭐⭐',
  hard: '⭐⭐⭐',
};
