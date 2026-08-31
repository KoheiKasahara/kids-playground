import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

// html要素のtouch-actionはブラウザのページピンチズームを止めるための最重要設定（Issue #166）。
// manipulation（pan-x pan-y pinch-zoom相当）に戻ってしまうとピンチズームが復活してしまうため、
// ソースの文字列を直接検証して回帰を防ぐ。
const CSS_PATH = path.join(__dirname, 'global.css')
const CSS_SOURCE = readFileSync(CSS_PATH, 'utf-8')

function htmlRuleBody(source: string): string {
  const match = source.match(/(?<!\S)html\s*\{([^}]*)\}/)
  if (!match) throw new Error('html {...} ルールが見つかりません')
  return match[1]
}

describe('src/styles/global.css のhtml要素touch-action(Issue #166)', () => {
  test('html要素はtouch-action: pan-x pan-y になっている（ブラウザのページピンチズームを止める）', () => {
    const htmlRule = htmlRuleBody(CSS_SOURCE)
    expect(htmlRule).toMatch(/touch-action:\s*pan-x pan-y\s*;/)
  })

  test('html要素にはピンチズームを許してしまうmanipulationが残っていない', () => {
    const htmlRule = htmlRuleBody(CSS_SOURCE)
    expect(htmlRule).not.toMatch(/touch-action:\s*manipulation/)
  })
})
