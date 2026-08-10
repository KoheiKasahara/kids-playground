/** 複数の4択クイズで共有する、むずかしさの段階。 */
export type QuizLevel = 'easy' | 'normal' | 'hard'

/** 共通の問題生成で扱える、安定したIDを持つデータ。 */
export type Identifiable = {
  id: string
}

/** 4択クイズの基本問題型。 */
export type QuizQuestion<T extends Identifiable> = {
  answer: T
  choices: T[]
}

/** 1ゲームの標準問題数。 */
export const QUESTION_COUNT = 10

/** 1問あたりの標準選択肢数。 */
export const CHOICE_COUNT = 4

/** 出題プールを累積させるためのむずかしさ順。 */
export const LEVEL_RANK: Record<QuizLevel, number> = {
  easy: 0,
  normal: 1,
  hard: 2,
}

/** URLなど外部入力の値が正しいむずかしさかを判定する。 */
export function isQuizLevel(value: unknown): value is QuizLevel {
  return value === 'easy' || value === 'normal' || value === 'hard'
}

/** ゲーム間で意味が変わらない、むずかしさの表示名。 */
export const LEVEL_LABEL: Record<QuizLevel, string> = {
  easy: 'かんたん',
  normal: 'ふつう',
  hard: 'むずかしい',
}

/** むずかしさ選択に表示する星。読み上げでは非表示にして使う。 */
export const LEVEL_STARS: Record<QuizLevel, string> = {
  easy: '⭐',
  normal: '⭐⭐',
  hard: '⭐⭐⭐',
}
