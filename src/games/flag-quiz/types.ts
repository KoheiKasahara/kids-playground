import type { QuizLevel, QuizQuestion } from '../quiz-core/types'

export type { QuizLevel } from '../quiz-core/types'
export {
  CHOICE_COUNT,
  isQuizLevel,
  LEVEL_LABEL,
  LEVEL_RANK,
  LEVEL_STARS,
  QUESTION_COUNT,
} from '../quiz-core/types'

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
  /** この国が最初に出題対象になる むずかしさ */
  level: QuizLevel;
};

export type Question = QuizQuestion<Country>;

/**
 * 出題形式。
 * flagToName: 国旗を見て国名を選ぶ / nameToFlag: 国名を見て国旗を選ぶ /
 * panelFlag: 国旗を覆う16枚のパネルを少しずつめくって国名を選ぶ
 *
 * panelFlag は `FlagQuizLevelSelect` / `FlagQuizResult` をそのまま再利用するが、
 * プレイ画面だけは既存の `FlagQuizPlay`（flagToName/nameToFlagの二分岐）とは
 * 表示・状態管理が大きく異なるため `PanelFlagQuizPlay` に分離する
 * （`FlagQuizPlay` の props は `Exclude<QuizMode, 'panelFlag'>` に絞り、
 * panelFlag が誤って渡らないよう型で防ぐ）。
 */
export type QuizMode = 'flagToName' | 'nameToFlag' | 'panelFlag';

/** URLのパスセグメントとしてのモード名。ルーティング・画面遷移のパス組み立てで共有する */
export const MODE_PATH: Record<QuizMode, string> = {
  flagToName: 'flag-to-name',
  nameToFlag: 'name-to-flag',
  panelFlag: 'panel-flag',
};

/** むずかしさ選択画面・結果画面などで共有する、モードの日本語ラベル */
export const MODE_LABEL: Record<QuizMode, string> = {
  flagToName: 'こっき → なまえ',
  nameToFlag: 'なまえ → こっき',
  panelFlag: 'パネルめくり',
};

/** むずかしさ選択画面に表示する、出題対象の国の説明 */
export const LEVEL_DESCRIPTION: Record<QuizLevel, string> = {
  easy: 'よく しってる 20の くに',
  normal: '45の くに',
  hard: 'せかいの 105の くに',
};
