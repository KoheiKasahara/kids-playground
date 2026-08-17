/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { countries } from '../../games/flag-quiz/data/countries'
import { findFlagBall, FLAG_BALL_IDS, flagBalls } from './flagBalls'

/** flag-quizのcountriesマスターに存在しない国旗id。国旗ボール専用の追加国。 */
const idsWithoutFlagQuizMaster = new Set(['mk', 'bg'])

describe('FLAG_BALL_IDS / flagBalls', () => {
  it('ちょうど75件ある', () => {
    expect(FLAG_BALL_IDS).toHaveLength(75)
    expect(flagBalls).toHaveLength(75)
  })

  it('idに重複がない', () => {
    expect(new Set(FLAG_BALL_IDS).size).toBe(FLAG_BALL_IDS.length)
  })

  it('全idがcountriesかSUPPLEMENTAL_COUNTRIES(北マケドニア・ブルガリア)のいずれかに存在する', () => {
    const countryIds = new Set(countries.map((c) => c.id))
    for (const id of FLAG_BALL_IDS) {
      expect(countryIds.has(id) || idsWithoutFlagQuizMaster.has(id)).toBe(true)
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

describe('円形クロップの表示調整', () => {
  it('シンガポールだけ左端寄せにして、三日月が円のふちで欠けないようにしている', () => {
    expect(findFlagBall('sg')?.ballPositionX).toBe(0)
  })

  it('ネパール・モンゴル・トンガも左端寄せにして、主要な意匠が欠けないようにしている', () => {
    expect(findFlagBall('np')?.ballPositionX).toBe(0)
    expect(findFlagBall('mn')?.ballPositionX).toBe(0)
    expect(findFlagBall('to')?.ballPositionX).toBe(0)
  })

  it('調整が要らない国旗は ballPositionX を持たない（CSSのcenterのまま）', () => {
    const adjusted = flagBalls.filter((flag) => flag.ballPositionX !== undefined)
    expect(adjusted.map((flag) => flag.id)).toEqual(['sg', 'mn', 'np', 'to'])
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

describe('75か国への追加(既存40か国 + 新規35か国)', () => {
  const originalIds = [
    'jp', 'kr', 'cn', 'in', 'bd', 'th', 'vn', 'id', 'ph', 'sg', 'pk',
    'gb', 'fr', 'de', 'it', 'es', 'pt', 'nl', 'be', 'ch', 'se',
    'fi', 'no', 'dk', 'gr', 'tr', 'pl', 'ua', 'at', 'ie',
    'us', 'ca', 'mx', 'br', 'ar',
    'za', 'eg', 'ke',
    'au', 'nz',
  ]
  const addedIds = [
    'my', 'mn', 'np', 'kz', 'il', 'sa', 'lk', 'kh',
    'cz', 'is', 'hr', 'mk', 'ro', 'hu', 'bg',
    'cl', 'co', 'jm', 'uy', 'cu', 'pe', 've', 'cr',
    'ma', 'ng', 'et', 'tz', 'gh', 'sn', 'cm', 'dz',
    'pg', 'ws', 'fj', 'to',
  ]

  it('既存40か国が欠落していない', () => {
    expect(originalIds).toHaveLength(40)
    for (const id of originalIds) {
      expect(FLAG_BALL_IDS).toContain(id)
    }
  })

  it('新規35か国がすべて追加されている', () => {
    expect(addedIds).toHaveLength(35)
    for (const id of addedIds) {
      expect(FLAG_BALL_IDS).toContain(id)
    }
  })

  it('既存40か国 + 新規35か国で過不足なく75件になる', () => {
    expect(new Set([...originalIds, ...addedIds])).toEqual(new Set(FLAG_BALL_IDS))
  })

  it('ラオス・アルバニア・セルビアは追加されていない', () => {
    for (const id of ['la', 'al', 'rs']) {
      expect(FLAG_BALL_IDS).not.toContain(id)
    }
  })
})
