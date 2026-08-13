import type { QuizLevel, QuizQuestion } from '../quiz-core/types'

/** イラスト（または写真）と名前を対応付ける、画像クイズ共通のデータ形式。 */
export type ImageQuizItem = {
  /** 問題判定・選択肢の重複防止に使う安定したID。 */
  id: string
  /** 子ども向けの表示名。 */
  name: string
  /** BASE_URLからの相対画像パス。先頭にスラッシュを付けない。 */
  image: string
}

/** 「画像を見て名前」または「名前を見て画像」の回答方式。 */
export type ImageQuizMode = 'imageToName' | 'nameToImage'

export const IMAGE_QUIZ_MODE_PATH: Record<ImageQuizMode, string> = {
  imageToName: 'image-to-name',
  nameToImage: 'name-to-image',
}

export const IMAGE_QUIZ_MODE_LABEL: Record<ImageQuizMode, string> = {
  imageToName: 'イラスト → なまえ',
  nameToImage: 'なまえ → イラスト',
}

export type ImageQuizQuestion = QuizQuestion<ImageQuizItem>

/**
 * 将来、問題プールの多いカテゴリだけが持てる難易度定義。
 *
 * 今回のように難易度なしのカテゴリは ImageQuizConfig.difficulties を設定しない。
 * 難易度の選び方・累積方式などはカテゴリごとに決められるため、共通画面に
 * 未使用の難易度UIを持たせず、設定の受け皿だけをここに置く。
 */
export type ImageQuizDifficulty = {
  id: QuizLevel
  label: string
  description?: string
}

export type ImageQuizConfig = {
  id: string
  basePath: string
  title: string
  hero: string
  itemLabel: string
  items: readonly ImageQuizItem[]
  difficulties?: readonly ImageQuizDifficulty[]
}
