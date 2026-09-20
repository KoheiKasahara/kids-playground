/// <reference types="node" />

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { THEMES, THEME_ORDER, type ShinkeisuijakuTheme } from './cardFaces'
import { DIFFICULTY_PAIR_COUNT } from './cardDeck'

const themes = Object.keys(THEMES) as ShinkeisuijakuTheme[]

describe('THEMES', () => {
  test.each(themes)('%sは、いちばん多いペア数ぶんの絵柄を持つ', (theme) => {
    expect(THEMES[theme].faces.length).toBeGreaterThanOrEqual(DIFFICULTY_PAIR_COUNT.hard)
  })

  test.each(themes)('%sの絵柄idは重複しない', (theme) => {
    const ids = THEMES[theme].faces.map((face) => face.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test.each(themes)('%sの絵柄は名前を持ち、文字か画像のどちらか一方で表される', (theme) => {
    for (const face of THEMES[theme].faces) {
      expect(face.name.length).toBeGreaterThan(0)
      expect('image' in face ? face.image : face.symbol).toBeTruthy()
    }
  })

  test('画像の絵柄は、public配下に実ファイルがある', () => {
    const images = themes.flatMap((theme) =>
      THEMES[theme].faces.flatMap((face) => ('image' in face ? [face.image] : [])),
    )
    // はたらくくるま・こっきの2テーマぶんの画像を見落とさないための下限。
    expect(images.length).toBeGreaterThanOrEqual(DIFFICULTY_PAIR_COUNT.hard * 2)
    for (const image of images) {
      expect(existsSync(resolve('public', image))).toBe(true)
    }
  })
})

describe('THEME_ORDER', () => {
  test('全テーマを重複なく並べる', () => {
    expect([...THEME_ORDER].sort()).toEqual([...themes].sort())
  })
})
