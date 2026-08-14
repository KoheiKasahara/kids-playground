/// <reference types="node" />

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { fruits } from './fruits'

describe('fruits', () => {
  test('30種類に一意のID・表示名・画像パスがある', () => {
    expect(fruits).toHaveLength(30)
    expect(new Set(fruits.map((item) => item.id)).size).toBe(30)
    expect(new Set(fruits.map((item) => item.name)).size).toBe(30)
    expect(new Set(fruits.map((item) => item.image)).size).toBe(30)
  })

  test('登録した画像はすべてpublic配下の実ファイルを参照する', () => {
    for (const item of fruits) {
      expect(item.image).toMatch(/^images\/fruits\/[a-z-]+\.png$/)
      expect(existsSync(resolve('public', item.image))).toBe(true)
    }
  })
})
