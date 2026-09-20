import type { QuizLevel as CoreQuizLevel, QuizQuestion } from '../quiz-core/types'
import {
  isQuizLevel as isCoreQuizLevel,
  LEVEL_LABEL as CORE_LEVEL_LABEL,
  LEVEL_RANK as CORE_LEVEL_RANK,
  LEVEL_STARS as CORE_LEVEL_STARS,
} from '../quiz-core/types'

export { CHOICE_COUNT, QUESTION_COUNT } from '../quiz-core/types'

/**
 * こっきクイズの むずかしさ。共通の3段階に、このゲームだけの最上位「おに」を足す。
 * 「おに」は国数がとびぬけて多く、他のクイズには対応するデータがないため、
 * 共通レイヤー (`quiz-core`) の QuizLevel は増やさずここで拡張する。
 */
export type QuizLevel = CoreQuizLevel | 'oni';

/** 出題プールを累積させるためのむずかしさ順。おにが最上位。 */
export const LEVEL_RANK: Record<QuizLevel, number> = {
  ...CORE_LEVEL_RANK,
  oni: 3,
};

/** むずかしさの表示名。 */
export const LEVEL_LABEL: Record<QuizLevel, string> = {
  ...CORE_LEVEL_LABEL,
  oni: 'おに',
};

/** むずかしさ選択に表示する記号。読み上げでは非表示にして使う。 */
export const LEVEL_STARS: Record<QuizLevel, string> = {
  ...CORE_LEVEL_STARS,
  // おにだけは星の数ではなく鬼の顔にして、別格のむずかしさだと一目で分かるようにする。
  oni: '👹',
};

/** URLなど外部入力の値が正しいむずかしさかを判定する。 */
export function isQuizLevel(value: unknown): value is QuizLevel {
  return isCoreQuizLevel(value) || value === 'oni';
}

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
  oni: 'せかいじゅうの 150の くに',
};
