/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { countries } from '../../games/flag-quiz/data/countries'
import type { Continent } from '../../games/flag-quiz/types'
import { findFlagBall, FLAG_BALL_IDS, flagBalls } from './flagBalls'

/** flag-quizのcountriesマスターに存在しない国旗id。国旗ボール専用の追加国。 */
const supplementalIds = ['mk', 'bg']

/** flagBalls.ts が並べ替えに使う大陸の順。 */
const continentOrder: readonly Continent[] = [
  'asia',
  'europe',
  'northAmerica',
  'southAmerica',
  'africa',
  'oceania',
]

describe('FLAG_BALL_IDS / flagBalls', () => {
  it('クイズの全出題国 + 専用追加2か国ぶんある', () => {
    expect(flagBalls).toHaveLength(countries.length + supplementalIds.length)
    expect(FLAG_BALL_IDS).toHaveLength(flagBalls.length)
    // マスターが150か国になったことに気付けるよう、実数でも固定する。
    expect(flagBalls).toHaveLength(152)
  })

  it('idに重複がない', () => {
    expect(new Set(FLAG_BALL_IDS).size).toBe(FLAG_BALL_IDS.length)
  })

  it('クイズのマスターにある国がすべて並ぶ', () => {
    const ballIds = new Set(FLAG_BALL_IDS)
    for (const country of countries) {
      expect(ballIds.has(country.id)).toBe(true)
    }
  })

  it('専用追加国(北マケドニア・ブルガリア)も並ぶ', () => {
    for (const id of supplementalIds) {
      expect(findFlagBall(id)).toBeDefined()
    }
    expect(findFlagBall('mk')?.nameJa).toBe('きたマケドニア')
    expect(findFlagBall('bg')?.nameJa).toBe('ブルガリア')
  })

  it('全idがcountriesかSUPPLEMENTAL_COUNTRIES(北マケドニア・ブルガリア)のいずれかに存在する', () => {
    const countryIds = new Set(countries.map((c) => c.id))
    for (const id of FLAG_BALL_IDS) {
      expect(countryIds.has(id) || supplementalIds.includes(id)).toBe(true)
    }
  })

  it('各flagパスが flags/<id>.svg 形式で、public配下に実ファイルがある', () => {
    for (const flag of flagBalls) {
      expect(flag.flag).toBe(`flags/${flag.id}.svg`)
      expect(existsSync(resolve('public', flag.flag))).toBe(true)
    }
  })

  // FlagBall は 4:3 の絵を正方形へ object-fit: cover で入れる。
  // 「左右が各1/6だけ切れる」というクロップ量の前提は全SVGが4:3であることに依存するため、ここで守る。
  it('全SVGのviewBoxが4:3（0 0 640 480）で、国旗ボールのクロップ前提を守る', () => {
    for (const flag of flagBalls) {
      const svg = readFileSync(resolve('public', flag.flag), 'utf8')
      const viewBox = svg.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)
      const values = viewBox?.[1].trim().split(/\s+/).map(Number)
      expect(values).toEqual([0, 0, 640, 480])
    }
  })
})

describe('選択画面での並び', () => {
  it('大陸ごとにまとまって、アジア→ヨーロッパ→北米→南米→アフリカ→オセアニアの順に並ぶ', () => {
    const ranks = flagBalls.map((flag) => continentOrder.indexOf(flag.continent))
    expect(ranks).not.toContain(-1)
    for (let index = 1; index < ranks.length; index += 1) {
      expect(ranks[index]).toBeGreaterThanOrEqual(ranks[index - 1])
    }
  })

  it('同じ大陸の中ではマスターの並び（よく知られた国が先）を保つ', () => {
    const masterOrder = new Map(countries.map((country, index) => [country.id, index]))
    for (const continent of continentOrder) {
      const indexes = flagBalls
        .filter((flag) => flag.continent === continent)
        .map((flag) => masterOrder.get(flag.id))
        .filter((index): index is number => index !== undefined)
      expect(indexes).toEqual([...indexes].sort((left, right) => left - right))
    }
    expect(FLAG_BALL_IDS[0]).toBe('jp')
  })
})

describe('円形クロップの表示調整', () => {
  it('シンガポールだけ左端寄せにして、三日月が円のふちで欠けないようにしている', () => {
    expect(findFlagBall('sg')?.ballPositionX).toBe(0)
  })

  it('ネパール・モンゴル・トンガも左端寄せにして、主要な意匠が欠けないようにしている', () => {
    expect(findFlagBall('np')?.ballPositionX).toBe(0)
    expect(findFlagBall('mn')?.ballPositionX).toBe(0)
    expect(findFlagBall('to')?.ballPositionX).toBe(0)
  })

  it('150か国へ広げて足した、旗竿側に意匠がある国旗も左端寄せにしている', () => {
    for (const id of ['om', 'by', 'mt', 'si', 'mz', 'vu', 'zw']) {
      expect(findFlagBall(id)?.ballPositionX).toBe(0)
    }
  })

  it('旗尾側に意匠がある国旗は右端寄せにしている', () => {
    expect(findFlagBall('zm')?.ballPositionX).toBe(1)
    expect(findFlagBall('va')?.ballPositionX).toBe(1)
  })

  it('調整が要らない国旗は ballPositionX を持たない（CSSのcenterのまま）', () => {
    const adjusted = flagBalls.filter((flag) => flag.ballPositionX !== undefined)
    expect([...adjusted.map((flag) => flag.id)].sort()).toEqual(
      ['by', 'mn', 'mt', 'mz', 'np', 'om', 'sg', 'si', 'to', 'va', 'vu', 'zm', 'zw'].sort(),
    )
    expect(findFlagBall('jp')?.ballPositionX).toBeUndefined()
  })
})

describe('findFlagBall', () => {
  it('既知のidで国旗ボールを引ける', () => {
    expect(findFlagBall('jp')?.nameJa).toBe('にほん')
  })

  it('未知のidはundefined', () => {
    expect(findFlagBall('xx')).toBeUndefined()
  })
})

describe('152か国への拡張', () => {
  /** 75件だったころの一覧。広げたことで既存の選択肢が消えていないことを守る。 */
  const previousIds = [
    'jp', 'kr', 'cn', 'in', 'bd', 'th', 'vn', 'id', 'ph', 'sg', 'pk',
    'my', 'mn', 'np', 'kz', 'il', 'sa', 'lk', 'kh',
    'gb', 'fr', 'de', 'it', 'es', 'pt', 'nl', 'be', 'ch', 'se',
    'fi', 'no', 'dk', 'gr', 'tr', 'pl', 'ua', 'at', 'ie',
    'cz', 'is', 'hr', 'mk', 'ro', 'hu', 'bg',
    'us', 'ca', 'mx', 'br', 'ar', 'cl', 'co', 'jm', 'uy', 'cu', 'pe', 've', 'cr',
    'za', 'eg', 'ke', 'ma', 'ng', 'et', 'tz', 'gh', 'sn', 'cm', 'dz',
    'au', 'nz', 'pg', 'ws', 'fj', 'to',
  ]

  it('もとの75か国が1つも欠けていない', () => {
    expect(previousIds).toHaveLength(75)
    for (const id of previousIds) {
      expect(FLAG_BALL_IDS).toContain(id)
    }
  })

  it('ラオス・アルバニア・セルビアなど、以前は入れていなかった国も選べる', () => {
    for (const id of ['la', 'al', 'rs', 'ru', 'ag', 'kn', 'vc', 'tt']) {
      expect(FLAG_BALL_IDS).toContain(id)
    }
  })
})
