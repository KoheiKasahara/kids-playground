import type { QuizLevel } from '../quiz-core/types'

export type { QuizLevel } from '../quiz-core/types'
export {
  CHOICE_COUNT,
  isQuizLevel,
  LEVEL_LABEL,
  LEVEL_RANK,
  LEVEL_STARS,
  QUESTION_COUNT,
} from '../quiz-core/types'

/** さんすうクイズであつかう四則演算。 */
export type MathOperation = 'add' | 'sub' | 'mul' | 'div'

/** 1問分の計算。id は「同じ計算を1ゲーム内で重複させない」ための安定キー。 */
export type MathProblem = {
  id: string
  operation: MathOperation
  left: number
  right: number
  answer: number
}

/** さんすうクイズの1問。選択肢は数値そのものなので quiz-core の QuizQuestion<T> は使わない。 */
export type MathQuestion = {
  problem: MathProblem
  choices: number[]
}

/** さんすうクイズのモードは演算そのもの。 */
export type MathQuizMode = MathOperation

/** URLのパスセグメントとしてのモード名。ルーティング・画面遷移のパス組み立てで共有する。 */
export const MODE_PATH: Record<MathQuizMode, string> = {
  add: 'add',
  sub: 'sub',
  mul: 'mul',
  div: 'div',
}

/** むずかしさ選択画面・結果画面などで共有する、モードの日本語ラベル。 */
export const MODE_LABEL: Record<MathQuizMode, string> = {
  add: 'たしざん',
  sub: 'ひきざん',
  mul: 'かけざん',
  div: 'わりざん',
}

/** モード選択画面に表示する絵文字。装飾のため読み上げでは非表示にして使う。 */
export const MODE_EMOJI: Record<MathQuizMode, string> = {
  add: '➕',
  sub: '➖',
  mul: '✖️',
  div: '➗',
}

/** 画面で式を表示するための演算記号。全角で統一する。 */
export const OPERATION_SIGN: Record<MathOperation, string> = {
  add: '＋',
  sub: '−',
  mul: '×',
  div: '÷',
}

/** 問題文よみあげ用の、演算記号の読み上げ形。「＋」等の記号は TTS が読み上げると不自然なため、
 *  よみあげテキストの組み立てにはこちらを使う（画面表示には OPERATION_SIGN を使い続ける）。 */
export const OPERATION_SPEECH_WORD: Record<MathOperation, string> = {
  add: 'たす',
  sub: 'ひく',
  mul: 'かける',
  div: 'わる',
}

/** むずかしさ選択画面に表示する、出題対象の計算の説明。 */
export const LEVEL_DESCRIPTION: Record<MathQuizMode, Record<QuizLevel, string>> = {
  add: {
    easy: '1けたの けいさん',
    normal: '20までの けいさん',
    hard: '2けたの けいさん',
  },
  sub: {
    easy: '1けたの けいさん',
    normal: '20までの けいさん',
    hard: '2けたの けいさん',
  },
  mul: {
    easy: '1から5の かけざん',
    normal: 'くく ぜんぶ',
    hard: '2けた × 1けた',
  },
  div: {
    easy: '1から5で わる',
    normal: 'くくの ぎゃく',
    hard: '2けた ÷ 1けた',
  },
}
