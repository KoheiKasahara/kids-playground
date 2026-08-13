import ImageQuizPlay from '../image-quiz/ImageQuizPlay'
import ImageQuizResult from '../image-quiz/ImageQuizResult'
import ImageQuizStart from '../image-quiz/ImageQuizStart'
import type { ImageQuizMode } from '../image-quiz/types'
import { vegetableQuizConfig } from './config'

export function VegetableQuizStart() {
  return <ImageQuizStart config={vegetableQuizConfig} />
}

export function VegetableQuizPlay({ mode }: { mode: ImageQuizMode }) {
  return <ImageQuizPlay config={vegetableQuizConfig} mode={mode} />
}

export function VegetableQuizResult({ mode }: { mode: ImageQuizMode }) {
  return <ImageQuizResult config={vegetableQuizConfig} mode={mode} />
}
