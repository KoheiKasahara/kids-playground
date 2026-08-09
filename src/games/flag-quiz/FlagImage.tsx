import type { Country } from './types'
import styles from './FlagImage.module.css'

type FlagImageProps = {
  country: Country
  size?: 'large' | 'small' | 'choice'
}

const sizeClass: Record<NonNullable<FlagImageProps['size']>, string> = {
  large: styles.large,
  small: styles.small,
  choice: styles.choice,
}

export default function FlagImage({ country, size = 'large' }: FlagImageProps) {
  return (
    <img
      className={`${styles.flag} ${sizeClass[size]}`}
      src={import.meta.env.BASE_URL + country.flag}
      alt=""
    />
  )
}
