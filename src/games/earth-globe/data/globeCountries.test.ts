/// <reference types="node" />

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
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
const legacyCountryIds = new Set(countries.map((country) => country.id))
const maxDisplayNameLength = 14
const recommendedGeneratedNameLength = 10
const cjkPattern = /[\u4E00-\u9FFF]/u
const formalSuffixPattern = /(人民民主共和国|民主共和国|共和国|王国|連邦)$/u

describe('earth-globe data', () => {
  it('worldFeaturesは国IDとPolygon系のgeometryを持つ', () => {
    expect(worldFeatures.length).toBeGreaterThan(0)

    for (const worldFeature of worldFeatures) {
      expect(typeof worldFeature.id).toBe('number')
      expect(['Polygon', 'MultiPolygon']).toContain(worldFeature.geometry.type)
    }
  })

  it('対応国が全世界規模に拡張されている', () => {
    expect(globeCountries.length).toBeGreaterThan(200)
  })

  it('表示名に漢字を含まない', () => {
    // 既存105か国も実測で漢字0件のため、例外は設けない。
    for (const country of globeCountries) {
      expect(country.nameJa).not.toMatch(cjkPattern)
    }
  })

  it('表示名は上限内で、新規生成名は10文字以内である', () => {
    for (const country of globeCountries) {
      const nameLength = [...country.nameJa].length
      expect(nameLength).toBeLessThanOrEqual(maxDisplayNameLength)

      if (!legacyCountryIds.has(country.id)) {
        expect(nameLength).toBeLessThanOrEqual(recommendedGeneratedNameLength)
      }
    }
  })

  it('表示名に重複がない', () => {
    const names = globeCountries.map((country) => country.nameJa)
    expect(new Set(names).size).toBe(names.length)
  })

  it('正式名称の漢字接尾辞を残していない', () => {
    for (const country of globeCountries) {
      expect(country.nameJa).not.toMatch(formalSuffixPattern)
    }
  })

  it('alpha-2 IDに重複がない', () => {
    const ids = globeCountries.map((country) => country.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('numeric IDに重複がない', () => {
    const numericIds = globeCountries.map((country) => country.numericId)
    expect(new Set(numericIds).size).toBe(numericIds.length)
  })

  it('全globeCountries要素に対応するworld featureがある', () => {
    for (const country of globeCountries) {
      expect(worldFeatureIds.has(country.numericId)).toBe(true)
    }
  })

  it('全globeCountries要素に日本語名と国旗パスがある', () => {
    for (const country of globeCountries) {
      expect(country.nameJa.trim()).not.toBe('')
      expect(country.flag).toBe(`flags/${country.id}.svg`)
      expect(existsSync(resolve('public', country.flag))).toBe(true)
    }
  })

  it('flag-quizの既存国にはnumeric IDがある', () => {
    for (const country of countries) {
      expect(countryNumericIds[country.id]).toEqual(expect.any(Number))
    }
  })

  it('既存105か国の幼児向け国名と国旗を維持している', () => {
    for (const sourceCountry of countries) {
      const globeCountry = globeCountryById.get(sourceCountry.id)
      expect(globeCountry).toBeDefined()

      if (globeCountry === undefined) continue
      expect(globeCountry.nameJa).toBe(sourceCountry.nameJa)
      expect(globeCountry.flag).toBe(sourceCountry.flag)
    }

    expect(globeCountryById.get('jp')?.nameJa).toBe('にほん')
    expect(globeCountryById.get('za')?.nameJa).toBe('みなみアフリカ')
    expect(globeCountryById.get('kr')?.nameJa).toBe('かんこく')
    expect(globeCountryById.get('ae')?.nameJa).toBe('アラブしゅちょうこくれんぽう')
  })

  it('南極(010)を対応国に含めない', () => {
    expect(worldFeatureIds.has(10)).toBe(true)
    expect(globeCountryByNumericId.has(10)).toBe(false)
    expect(globeCountries.some((country) => country.id === 'aq')).toBe(false)
  })

  it('負のIDを持つ特殊featureを対応国に含めない', () => {
    const specialFeatureIds = worldFeatures
      .map((worldFeature) => worldFeature.id)
      .filter((id) => id < 0)

    expect(specialFeatureIds.length).toBeGreaterThan(0)
    for (const specialFeatureId of specialFeatureIds) {
      expect(globeCountryByNumericId.has(specialFeatureId)).toBe(false)
    }
  })

  it('既存105か国にない国も日本語名と国旗付きで含める', () => {
    const addedCountries: ReadonlyArray<readonly [string, number, string]> = [
      ['no', 578, 'ノルウェー'],
      ['is', 352, 'アイスランド'],
      ['ls', 426, 'レソト'],
    ]

    for (const [id, numericId, nameJa] of addedCountries) {
      const country = globeCountryById.get(id)
      expect(country).toBeDefined()
      expect(country?.numericId).toBe(numericId)
      expect(country?.nameJa).toBe(nameJa)
      expect(country?.flag).toBe(`flags/${id}.svg`)
      expect(existsSync(resolve('public', `flags/${id}.svg`))).toBe(true)
    }

    expect(globeCountryById.get('cg')?.nameJa).toBe('コンゴ')
    expect(globeCountryById.get('cd')?.nameJa).toBe('コンゴみんしゅ')
  })

  it('countryNumericIdsはglobeCountriesのnumeric IDと一致する', () => {
    for (const country of globeCountries) {
      expect(countryNumericIds[country.id]).toBe(country.numericId)
    }
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
