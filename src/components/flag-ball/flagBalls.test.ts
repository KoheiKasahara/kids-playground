/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { countries } from '../../games/flag-quiz/data/countries'
import { findFlagBall, FLAG_BALL_IDS, flagBalls } from './flagBalls'

describe('FLAG_BALL_IDS / flagBalls', () => {
  it('ちょうど40件ある', () => {
    expect(FLAG_BALL_IDS).toHaveLength(40)
    expect(flagBalls).toHaveLength(40)
  })

  it('idに重複がない', () => {
    expect(new Set(FLAG_BALL_IDS).size).toBe(FLAG_BALL_IDS.length)
  })

  it('全idがcountriesに存在する', () => {
    const countryIds = new Set(countries.map((c) => c.id))
    for (const id of FLAG_BALL_IDS) {
      expect(countryIds.has(id)).toBe(true)
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

  it('調整が要らない国旗は ballPositionX を持たない（CSSのcenterのまま）', () => {
    const adjusted = flagBalls.filter((flag) => flag.ballPositionX !== undefined)
    expect(adjusted.map((flag) => flag.id)).toEqual(['sg'])
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
