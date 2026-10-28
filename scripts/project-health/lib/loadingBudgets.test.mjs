import { expect, test } from 'vitest'
import { evaluateLoadingBudgets, parseLoadingBudgets, renderLoadingBudgetMarkdown } from './loadingBudgets.mjs'

const budgets = { initialJsGzipKb: 100, initialCssGzipKb: 10, precacheWarnKb: 1000, precacheBaselineKb: 800, precacheGrowthWarnKb: 100 }
const metrics = (js = 100, css = 10, precache = 800) => ({ initial: { js: { gzip: js * 1024 }, css: { gzip: css * 1024 } }, precache: { bytes: precache * 1024 } })

test('予算ちょうどは成功し、初期JS/CSSの超過は独立して失敗する', () => {
  expect(evaluateLoadingBudgets(metrics(), budgets)).toEqual({ errors: [], warnings: [] })
  const result = evaluateLoadingBudgets(metrics(101, 11), budgets)
  expect(result.errors).toHaveLength(2)
  expect(result.warnings).toEqual([])
})
test('PWA総量・増加は警告にして、ゲーム追加だけでbuildを止めない', () => {
  const result = evaluateLoadingBudgets(metrics(100, 10, 1001), budgets)
  expect(result.errors).toEqual([])
  expect(result.warnings).toHaveLength(2)
  expect(evaluateLoadingBudgets(metrics(100, 10, 899), budgets).warnings).toEqual([])
  expect(renderLoadingBudgetMarkdown(metrics(101, 10, 1001), budgets)).toContain('❌')
  expect(renderLoadingBudgetMarkdown(metrics(100, 10, 1001), budgets)).toContain('⚠️')
})
test('設定や計測が欠損している場合を成功扱いにしない', () => {
  expect(parseLoadingBudgets(JSON.stringify({ loadingBudgets: budgets }))).toEqual(budgets)
  for (const raw of ['{}', 'null', '{broken', JSON.stringify({ loadingBudgets: { ...budgets, initialJsGzipKb: -1 } })]) {
    expect(() => parseLoadingBudgets(raw)).toThrow()
  }
  expect(() => evaluateLoadingBudgets(metrics(NaN), budgets)).toThrow('Missing loading measurement')
})
