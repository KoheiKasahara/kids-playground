/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { countries } from '../../flag-quiz/data/countries'
import { findPinballFlag, PINBALL_FLAG_IDS, pinballFlags } from './pinballFlags'

describe('PINBALL_FLAG_IDS / pinballFlags', () => {
  it('ちょうど20件ある', () => {
    expect(PINBALL_FLAG_IDS).toHaveLength(20)
    expect(pinballFlags).toHaveLength(20)
  })

  it('idに重複がない', () => {
    expect(new Set(PINBALL_FLAG_IDS).size).toBe(PINBALL_FLAG_IDS.length)
  })

  it('全idがcountriesに存在する', () => {
    const countryIds = new Set(countries.map((c) => c.id))
    for (const id of PINBALL_FLAG_IDS) {
      expect(countryIds.has(id)).toBe(true)
    }
  })

  it('各flagパスが flags/<id>.svg 形式で、public配下に実ファイルがある', () => {
    for (const flag of pinballFlags) {
      expect(flag.flag).toBe(`flags/${flag.id}.svg`)
      expect(existsSync(resolve('public', flag.flag))).toBe(true)
    }
  })

  it('全SVGのviewBoxが4:3（0 0 640 480）で、国旗ボールの補正前提を守る', () => {
    for (const flag of pinballFlags) {
      const svg = readFileSync(resolve('public', flag.flag), 'utf8')
      const viewBox = svg.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)
      const values = viewBox?.[1].trim().split(/\s+/).map(Number)
      expect(values).toEqual([0, 0, 640, 480])
    }
  })
})

describe('findPinballFlag', () => {
  it('既知のidで国旗ボールを引ける', () => {
    expect(findPinballFlag('jp')?.nameJa).toBe('にほん')
  })

  it('未知のidはundefined', () => {
    expect(findPinballFlag('xx')).toBeUndefined()
  })
})
