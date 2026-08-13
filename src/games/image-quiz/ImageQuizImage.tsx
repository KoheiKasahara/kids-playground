import type { ImageQuizItem } from './types'
import styles from './ImageQuiz.module.css'

type ImageQuizImageProps = {
  item: ImageQuizItem
  size: 'large' | 'small' | 'choice'
  alt?: string
}

export default function ImageQuizImage({ item, size, alt = '' }: ImageQuizImageProps) {
  return (
    <img
      className={[styles.image, styles[`image${size[0].toUpperCase()}${size.slice(1)}`]]
        .filter(Boolean)
        .join(' ')}
      src={import.meta.env.BASE_URL + item.image}
      alt={alt}
    />
  )
}
