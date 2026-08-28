// index.html（初回ロード時に読まれる静的なtitle/description）と、
// HOME_SEO（SPA遷移時にSeoManagerが書き込む値）がズレていないかを検証する。
// ここがズレると、初回アクセス時とクライアント側遷移後でトップページの文言が
// 変わってしまう（SNSシェアやリロード時の見え方が不安定になる）。

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { HOME_SEO } from './pageSeo'

const INDEX_HTML_PATH = path.resolve(__dirname, '../../index.html')
const INDEX_HTML = readFileSync(INDEX_HTML_PATH, 'utf-8')

describe('index.html と HOME_SEO の整合性', () => {
  test('<title> が HOME_SEO.title と一致する', () => {
    const match = INDEX_HTML.match(/<title>([\s\S]*?)<\/title>/)
    expect(match?.[1]).toBe(HOME_SEO.title)
  })

  test('meta[name="description"] が HOME_SEO.description と一致する', () => {
    const match = INDEX_HTML.match(/<meta\s+name="description"\s+content="([^"]*)"/)
    expect(match?.[1]).toBe(HOME_SEO.description)
  })

  test('link[rel="canonical"] が HOME_SEO.canonicalUrl と一致する', () => {
    const match = INDEX_HTML.match(/<link\s+rel="canonical"\s+href="([^"]*)"/)
    expect(match?.[1]).toBe(HOME_SEO.canonicalUrl)
  })
})
