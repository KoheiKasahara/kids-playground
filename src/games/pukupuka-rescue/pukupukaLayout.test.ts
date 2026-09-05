import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { PUKUPUKA_STAGE } from './stageDefinitions'

// スマホ縦画面での破綻（横スクロール・画面外へ出る操作ボタン・小さすぎるタップ領域）は
// jsdomでは実寸を測れないため、レイアウトの前提そのものをCSSソースで固定する。
// 既存の src/styles/global.test.ts と同じ考え方の回帰テスト。
const CSS_PATH = path.join(__dirname, 'PukupukaRescuePlay.module.css')
const CSS_SOURCE = readFileSync(CSS_PATH, 'utf-8')

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = CSS_SOURCE.match(new RegExp(`(?<!\\S)${escaped}\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`${selector} {...} ルールが見つかりません`)
  return match[1]
}

describe('ぷかぷかレスキューのスマホ縦レイアウト', () => {
  test('画面全体は1画面（dvh）に収まる高さで組む', () => {
    const page = ruleBody('.page')
    expect(page).toMatch(/min-height:\s*100dvh/)
    expect(page).toMatch(/box-sizing:\s*border-box/)
  })

  test('列は minmax(0, 1fr) で、縦長ステージが横幅を押し広げない', () => {
    expect(ruleBody('.page')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/)
  })

  test('セーフエリアぶんの余白を内側のpaddingで持つ', () => {
    const page = ruleBody('.page')
    expect(page).toMatch(/--safe-top/)
    expect(page).toMatch(/--safe-bottom/)
  })

  test('ステージSVGは幅・高さとも親に収まる', () => {
    const svg = ruleBody('.stageSvg')
    expect(svg).toMatch(/width:\s*100%/)
    expect(svg).toMatch(/max-height:\s*100%/)
  })

  test('主要操作のタップ領域が十分に大きい（幼児向け規約）', () => {
    const reset = ruleBody('.reset')
    const resetHeight = Number(reset.match(/min-height:\s*(\d+)px/)?.[1])
    expect(resetHeight).toBeGreaterThanOrEqual(44)

    const home = ruleBody('.home')
    expect(home).toMatch(/min-height:\s*var\(--tap-target-min\)/)
  })

  test('じゃぐち・せんのタップ領域は見た目より広めに取ってある（幼児向け規約）', () => {
    const faucetSource = readFileSync(path.join(__dirname, 'PukupukaFaucet.tsx'), 'utf-8')
    const drainSource = readFileSync(path.join(__dirname, 'PukupukaDrain.tsx'), 'utf-8')

    // ステージ座標（幅100）に対して、指先ぶんの余裕を確保できているかを見る。
    for (const source of [faucetSource, drainSource]) {
      const width = Number(source.match(/HIT_WIDTH = (\d+)/)?.[1])
      const height = Number(source.match(/HIT_HEIGHT = (\d+)/)?.[1])
      expect(width).toBeGreaterThanOrEqual(15)
      expect(height).toBeGreaterThanOrEqual(15)
    }
  })

  test('じゃぐち・せんのタップ領域はタップ中にページをスクロールさせない/誤操作を防ぐ', () => {
    expect(ruleBody('.faucetHit')).toMatch(/touch-action:\s*none/)
    expect(ruleBody('.drainHit')).toMatch(/touch-action:\s*manipulation/)
  })

  test('ゲートのタップ領域は横方向も見た目より広く、縦方向も十分な大きさがある（幼児向け規約）', () => {
    const gateSource = readFileSync(path.join(__dirname, 'PukupukaGate.tsx'), 'utf-8')
    const hitWidth = Number(gateSource.match(/HIT_WIDTH = (\d+)/)?.[1])
    const topMargin = Number(gateSource.match(/HIT_TOP_MARGIN = (\d+)/)?.[1])
    const bottomMargin = Number(gateSource.match(/HIT_BOTTOM_MARGIN = (\d+)/)?.[1])
    expect(hitWidth).toBeGreaterThanOrEqual(15)
    // タップの高さは、じゃぐち・せんのタップ領域と重ならないよう上下に余白を残した
    // ゲート矩形の高さ（stage.gate.height）から余白ぶんを引いた値になる。
    expect(PUKUPUKA_STAGE.gate.height - topMargin - bottomMargin).toBeGreaterThanOrEqual(15)

    expect(ruleBody('.gateHit')).toMatch(/touch-action:\s*manipulation/)
  })

  test('prefers-reduced-motion で演出アニメーションを止める', () => {
    expect(CSS_SOURCE).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
    const reduced = CSS_SOURCE.slice(CSS_SOURCE.indexOf('@media (prefers-reduced-motion: reduce)'))
    for (const animated of ['waveBack', 'waveFront', 'bubble', 'floaterBob', 'goalGlow', 'drainSwirl', 'gateOpenMark']) {
      expect(reduced).toContain(`.${animated}`)
    }
    expect(reduced).toContain('.gateDoor')
  })
})
