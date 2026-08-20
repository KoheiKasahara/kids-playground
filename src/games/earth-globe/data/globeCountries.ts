import { countries } from '../../flag-quiz/data/countries'
import type { GlobeCountry } from '../types'
import { countryNumericIds } from './countryNumericIds'
import { worldFeatures } from './worldFeatures'

const worldFeatureIds = new Set(worldFeatures.map((worldFeature) => worldFeature.id))

export const globeCountries: readonly GlobeCountry[] = countries.flatMap((country) => {
  const numericId = countryNumericIds[country.id]
  if (numericId === undefined || !worldFeatureIds.has(numericId)) return []

  return [{
    id: country.id,
    nameJa: country.nameJa,
    flag: country.flag,
    numericId,
  }]
})

export const globeCountryByNumericId: ReadonlyMap<number, GlobeCountry> = new Map(
  globeCountries.map((country) => [country.numericId, country]),
)

export const globeCountryById: ReadonlyMap<string, GlobeCountry> = new Map(
  globeCountries.map((country) => [country.id, country]),
)
