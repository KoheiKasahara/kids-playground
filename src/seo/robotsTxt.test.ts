// public/robots.txtが「全面クロール許可＋sitemap.xmlの案内」という意図どおりの
// 内容になっているかを検証する。

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { absoluteUrl } from './siteMeta'

const ROBOTS_TXT_PATH = path.resolve(__dirname, '../../public/robots.txt')
const ROBOTS_TXT = readFileSync(ROBOTS_TXT_PATH, 'utf-8')

describe('public/robots.txt', () => {
  test('User-agent: * が指定されている', () => {
    expect(ROBOTS_TXT).toMatch(/^User-agent: \*$/m)
  })

  test('公開ページを全面ブロックしていない（値を伴うDisallow行が無い）', () => {
    // SPA/PWAはJS/CSS/画像を取得できないと正しくレンダリング評価してもらえないため、
    // 特定パスを狙ったDisallowも含めて一切置かれていないことを確認する。
    expect(ROBOTS_TXT).not.toMatch(/^Disallow:\s*\S/m)
  })

  test('Sitemapがちょうど1つ指定されており、absoluteUrlで組み立てたURLと一致する', () => {
    const sitemapLines = ROBOTS_TXT.split('\n').filter((line) => line.startsWith('Sitemap: '))
    expect(sitemapLines).toHaveLength(1)
    expect(sitemapLines[0]).toBe(`Sitemap: ${absoluteUrl('/sitemap.xml')}`)
  })
})
