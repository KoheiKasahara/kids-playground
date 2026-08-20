import { describe, expect, it } from 'vitest'
import { countries } from '../../flag-quiz/data/countries'
import { countryNumericIds } from './countryNumericIds'
import {
  globeCountries,
  globeCountryById,
  globeCountryByNumericId,
} from './globeCountries'
import { worldFeatures } from './worldFeatures'

const worldFeatureIds = new Set(worldFeatures.map((worldFeature) => worldFeature.id))

describe('earth-globe data', () => {
  it('worldFeaturesは国IDとPolygon系のgeometryを持つ', () => {
    expect(worldFeatures.length).toBeGreaterThan(0)

    for (const worldFeature of worldFeatures) {
      expect(typeof worldFeature.id).toBe('number')
      expect(['Polygon', 'MultiPolygon']).toContain(worldFeature.geometry.type)
    }
  })

  it('flag-quizの105か国すべてにnumeric IDがある', () => {
    expect(Object.keys(countryNumericIds)).toHaveLength(countries.length)

    for (const country of countries) {
      expect(countryNumericIds[country.id]).toEqual(expect.any(Number))
    }
  })

  it('countryNumericIdsをworld-atlasの実データと照合し、未存在の国は除外する', () => {
    const missing = Object.entries(countryNumericIds).filter(
      ([, numericId]) => !worldFeatureIds.has(numericId),
    )

    console.info(
      '[earth-globe] world-atlasに存在しないnumeric ID:',
      missing.length === 0 ? 'なし' : missing.map(([id, numericId]) => `${id}:${numericId}`).join(', '),
    )

    for (const [countryId, numericId] of missing) {
      expect(globeCountries.some((country) => country.id === countryId)).toBe(false)
      expect(globeCountryById.has(countryId)).toBe(false)
      expect(globeCountryByNumericId.has(numericId)).toBe(false)
    }

    for (const country of globeCountries) {
      expect(worldFeatureIds.has(country.numericId)).toBe(true)
    }
  })

  it('必須10か国を正しいマスターデータとnumeric IDで含む', () => {
    const requiredNumericIds: Record<string, number> = {
      jp: 392,
      kr: 410,
      cn: 156,
      ru: 643,
      in: 356,
      us: 840,
      ca: 124,
      br: 76,
      fr: 250,
      de: 276,
    }

    for (const [id, numericId] of Object.entries(requiredNumericIds)) {
      const sourceCountry = countries.find((country) => country.id === id)
      const globeCountry = globeCountryById.get(id)

      expect(sourceCountry).toBeDefined()
      expect(globeCountry).toBeDefined()

      if (sourceCountry === undefined || globeCountry === undefined) {
        throw new Error(`必須国が見つかりません: ${id}`)
      }

      expect(globeCountry.nameJa).toBe(sourceCountry.nameJa)
      expect(globeCountry.flag).toBe(sourceCountry.flag)
      expect(globeCountry.numericId).toBe(numericId)
    }
  })

  it('globeCountriesの国IDに重複がない', () => {
    const ids = globeCountries.map((country) => country.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('globeCountriesは60か国以上ある', () => {
    expect(globeCountries.length).toBeGreaterThanOrEqual(60)
  })

  it('検索MapはglobeCountriesと同じ要素を参照する', () => {
    expect(globeCountryByNumericId.size).toBe(globeCountries.length)
    expect(globeCountryById.size).toBe(globeCountries.length)

    for (const country of globeCountries) {
      expect(globeCountryByNumericId.get(country.numericId)).toBe(country)
      expect(globeCountryById.get(country.id)).toBe(country)
    }
  })
})
