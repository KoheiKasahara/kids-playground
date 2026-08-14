import ImageQuizPlay from '../image-quiz/ImageQuizPlay'
import ImageQuizResult from '../image-quiz/ImageQuizResult'
import ImageQuizStart from '../image-quiz/ImageQuizStart'
import type { ImageQuizMode } from '../image-quiz/types'
import { fruitQuizConfig } from './config'

export function FruitQuizStart() {
  return <ImageQuizStart config={fruitQuizConfig} />
}

export function FruitQuizPlay({ mode }: { mode: ImageQuizMode }) {
  return <ImageQuizPlay config={fruitQuizConfig} mode={mode} />
}

export function FruitQuizResult({ mode }: { mode: ImageQuizMode }) {
  return <ImageQuizResult config={fruitQuizConfig} mode={mode} />
}
