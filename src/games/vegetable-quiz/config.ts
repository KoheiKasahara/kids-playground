import type { ImageQuizConfig } from '../image-quiz/types'
import { vegetables } from './data/vegetables'

/**
 * 難易度を必要としないカテゴリの設定例。
 * 将来のカテゴリは difficulties を任意で追加し、出題時に対象itemsを渡せる。
 */
export const vegetableQuizConfig: ImageQuizConfig = {
  id: 'vegetable',
  basePath: '/games/vegetable-quiz',
  title: 'おやさいクイズ',
  hero: '🥕',
  itemLabel: 'やさい',
  items: vegetables,
}
