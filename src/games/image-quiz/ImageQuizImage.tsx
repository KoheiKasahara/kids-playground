import type { ImageQuizItem } from './types'
import styles from './ImageQuiz.module.css'

type ImageQuizImageProps = {
  item: ImageQuizItem
  size: 'large' | 'small' | 'choice'
  alt?: string
}

const sizeClass = {
  large: styles.imageLarge,
  small: styles.imageSmall,
  choice: styles.imageChoiceMedia,
}

export default function ImageQuizImage({ item, size, alt = '' }: ImageQuizImageProps) {
  return (
    <img
      className={`${styles.image} ${sizeClass[size]}`}
      src={import.meta.env.BASE_URL + item.image}
      alt={alt}
    />
  )
}
