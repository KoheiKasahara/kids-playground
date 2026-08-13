/// <reference types="node" />

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { vehicles, vehiclesForLevel } from './vehicles'

describe('vehicles', () => {
  test('15種類あり、ID・日本語名・写真パスが重複しない', () => {
    expect(vehicles).toHaveLength(15)
    expect(new Set(vehicles.map((vehicle) => vehicle.id)).size).toBe(15)
    expect(new Set(vehicles.map((vehicle) => vehicle.nameJa)).size).toBe(15)
    expect(new Set(vehicles.map((vehicle) => vehicle.photo)).size).toBe(15)
  })

  test('写真パスは images/working-vehicles/<id>.png で、public配下に実ファイルがある', () => {
    for (const vehicle of vehicles) {
      expect(vehicle.photo).toBe(`images/working-vehicles/${vehicle.id}.png`)
      expect(existsSync(resolve('public', vehicle.photo))).toBe(true)
    }
  })
})

describe('vehiclesForLevel', () => {
  test.each([
    ['easy', 10],
    ['normal', 13],
    ['hard', 15],
  ] as const)('%sは累積で%d種類', (level, count) => {
    expect(vehiclesForLevel(level)).toHaveLength(count)
  })

  test('かんたん ⊂ ふつう ⊂ むずかしい', () => {
    const easy = new Set(vehiclesForLevel('easy').map((vehicle) => vehicle.id))
    const normal = new Set(vehiclesForLevel('normal').map((vehicle) => vehicle.id))
    const hard = new Set(vehiclesForLevel('hard').map((vehicle) => vehicle.id))

    for (const id of easy) expect(normal.has(id)).toBe(true)
    for (const id of normal) expect(hard.has(id)).toBe(true)
  })

  test('かんたんレベルだけで1ゲーム分(10問)の出題に必要な種類数を満たす', () => {
    expect(vehiclesForLevel('easy').length).toBeGreaterThanOrEqual(10)
  })
})
