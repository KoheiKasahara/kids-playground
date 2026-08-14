import type { ImageQuizConfig } from '../image-quiz/types'
import { fruits } from './data/fruits'

/**
 * 難易度を必要としないカテゴリの設定例。
 * 将来のカテゴリは difficulties を任意で追加し、出題時に対象itemsを渡せる。
 */
export const fruitQuizConfig: ImageQuizConfig = {
  id: 'fruit',
  basePath: '/games/fruit-quiz',
  title: 'くだものクイズ',
  hero: '🍎',
  itemLabel: 'くだもの',
  items: fruits,
}
