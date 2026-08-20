import { globeCountryById } from '../data/globeCountries'
import styles from './CountryCard.module.css'

type CountryCardProps = {
  selectedCountryId: string | null
  onCountrySelect: (countryId: string | null) => void
}

export default function CountryCard({
  selectedCountryId,
  onCountrySelect,
}: CountryCardProps) {
  if (selectedCountryId === null) return null

  const country = globeCountryById.get(selectedCountryId)
  if (country === undefined) return null

  return (
    <button
      type="button"
      className={styles.card}
      aria-label={`${country.nameJa}。タップすると とじます`}
      onClick={() => onCountrySelect(null)}
    >
      <img
        className={styles.flag}
        src={import.meta.env.BASE_URL + country.flag}
        alt=""
        draggable={false}
      />
      <span className={styles.text}>
        <span className={styles.name}>{country.nameJa}</span>
        <span className={styles.hint}>タップで とじる</span>
      </span>
    </button>
  )
}
