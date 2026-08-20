import type { GlobeCountry } from '../types'
import { generatedGlobeCountries } from './globeCountries.generated'
import { worldFeatures } from './worldFeatures'

const worldFeatureIds = new Set(worldFeatures.map((worldFeature) => worldFeature.id))

// worldFeaturesは描画データ側で差し替わるため、実行時に対応するfeatureだけを採用する。
export const globeCountries: readonly GlobeCountry[] = generatedGlobeCountries.filter(
  (country) => worldFeatureIds.has(country.numericId),
)

export const globeCountryByNumericId: ReadonlyMap<number, GlobeCountry> = new Map(
  globeCountries.map((country) => [country.numericId, country]),
)

export const globeCountryById: ReadonlyMap<string, GlobeCountry> = new Map(
  globeCountries.map((country) => [country.id, country]),
)
