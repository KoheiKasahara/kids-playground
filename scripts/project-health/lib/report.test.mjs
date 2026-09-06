import { describe, expect, it } from 'vitest'
import { buildProjectHealthRows, renderProjectHealthMarkdown } from './report.mjs'

const findRow = (rows, metric) => rows.find((row) => row.metric === metric)

describe('buildProjectHealthRows', () => {
  it('全指標が揃っている場合、入力データをそのまま反映する（ハードコード無し）', () => {
    const rows = buildProjectHealthRows({
      gamesCount: 25,
      unitTests: { total: 612, passed: 612 },
      bundle: { js: 1_000_000, css: 500_000, total: 1_500_000 },
      dependencies: { total: 0, info: 0, low: 0, moderate: 0, high: 0, critical: 0 },
      nightly: { conclusion: 'success', htmlUrl: 'https://x/nightly' },
      deploy: { conclusion: 'success', htmlUrl: 'https://x/deploy' },
      e2e: { total: 25, passed: 25 },
      lighthouse: { performance: 94, accessibility: 96 },
      thresholds: { lighthousePerformance: 90, accessibility: 90 },
    })

    expect(findRow(rows, 'Games').value).toBe('25')
    expect(findRow(rows, 'Unit tests').value).toBe('612 / 612')
    expect(findRow(rows, 'Unit tests').status).toBe('✅')
    expect(findRow(rows, 'E2E smoke').value).toBe('25 / 25')
    expect(findRow(rows, 'E2E smoke').status).toBe('✅')
    expect(findRow(rows, 'Bundle').value).toBe('1.43 MB')
    expect(findRow(rows, 'Dependencies').value).toBe('0 vulnerable')
    expect(findRow(rows, 'Dependencies').status).toBe('✅')
    expect(findRow(rows, 'Lighthouse Performance').value).toBe('94')
    expect(findRow(rows, 'Lighthouse Performance').status).toBe('✅')
    expect(findRow(rows, 'Accessibility').value).toBe('96')
    expect(findRow(rows, 'Accessibility').status).toBe('✅')
    expect(findRow(rows, 'Nightly').status).toBe('✅')
    expect(findRow(rows, 'Last deploy').status).toBe('✅')
  })

  it('ゲーム数やテスト数の入力が変わると出力も追従する', () => {
    const low = buildProjectHealthRows({ gamesCount: 10, unitTests: { total: 100, passed: 100 } })
    const high = buildProjectHealthRows({ gamesCount: 11, unitTests: { total: 101, passed: 101 } })

    expect(findRow(low, 'Games').value).toBe('10')
    expect(findRow(high, 'Games').value).toBe('11')
    expect(findRow(low, 'Unit tests').value).toBe('100 / 100')
    expect(findRow(high, 'Unit tests').value).toBe('101 / 101')
  })

  it('Nightly / Deploy の失敗を正しく❌で表示する', () => {
    const rows = buildProjectHealthRows({
      nightly: { conclusion: 'failure' },
      deploy: { conclusion: 'failure' },
    })

    expect(findRow(rows, 'Nightly').value).toBe('failure')
    expect(findRow(rows, 'Nightly').status).toBe('❌')
    expect(findRow(rows, 'Last deploy').value).toBe('failure')
    expect(findRow(rows, 'Last deploy').status).toBe('❌')
  })

  it('依存関係の重大度に応じて状態が変わる', () => {
    const clean = buildProjectHealthRows({ dependencies: { total: 0, high: 0, critical: 0 } })
    const moderate = buildProjectHealthRows({ dependencies: { total: 1, moderate: 1, high: 0, critical: 0 } })
    const high = buildProjectHealthRows({ dependencies: { total: 1, high: 1, critical: 0 } })

    expect(findRow(clean, 'Dependencies').status).toBe('✅')
    expect(findRow(moderate, 'Dependencies').status).toBe('⚠️')
    expect(findRow(high, 'Dependencies').status).toBe('❌')
  })

  it('全指標が取得できなくてもクラッシュせず不明状態で表示する', () => {
    expect(() => buildProjectHealthRows()).not.toThrow()
    expect(() => buildProjectHealthRows({})).not.toThrow()

    const rows = buildProjectHealthRows()
    for (const row of rows) {
      expect(row.value).toBeTruthy()
      expect(row.status).toBeDefined()
    }
    expect(findRow(rows, 'Nightly').value).toBe('—')
    expect(findRow(rows, 'Nightly').status).toBe('❓')
    expect(findRow(rows, 'Last deploy').status).toBe('❓')
  })

  it('E2Eレポートが無い場合はGames件数を対象数として使う', () => {
    const rows = buildProjectHealthRows({ gamesCount: 25, e2e: null })
    expect(findRow(rows, 'E2E smoke').value).toBe('? / 25')
  })

  it('Lighthouseが閾値未満でも❌ではなく⚠️（Warning）で表示する', () => {
    const rows = buildProjectHealthRows({
      lighthouse: { performance: 80, accessibility: 85 },
      thresholds: { lighthousePerformance: 90, accessibility: 90 },
    })
    expect(findRow(rows, 'Lighthouse Performance').value).toBe('80')
    expect(findRow(rows, 'Lighthouse Performance').status).toBe('⚠️')
    expect(findRow(rows, 'Accessibility').value).toBe('85')
    expect(findRow(rows, 'Accessibility').status).toBe('⚠️')
  })

  it('Lighthouse計測に失敗してもクラッシュせずN/A相当（—/❓）で表示する', () => {
    const rows = buildProjectHealthRows()
    expect(findRow(rows, 'Lighthouse Performance').value).toBe('—')
    expect(findRow(rows, 'Lighthouse Performance').status).toBe('❓')
    expect(findRow(rows, 'Accessibility').value).toBe('—')
    expect(findRow(rows, 'Accessibility').status).toBe('❓')
  })

  it('前回の履歴があればTrend（増加/減少/変化なし）を算出する（Issue #525）', () => {
    const rows = buildProjectHealthRows({
      unitTests: { total: 650, passed: 650 },
      bundle: { js: 1_900_000, css: 0, total: 1_900_000 },
      dependencies: { total: 0 },
      lighthouse: { performance: 93, accessibility: 96 },
      previous: {
        unitTests: 638,
        bundleKb: Math.round(1_900_000 / 1024) - 32,
        lighthousePerformance: 94,
        accessibility: 96,
        vulnerabilities: 2,
      },
    })

    expect(findRow(rows, 'Unit tests').trend).toBe('▲ 12')
    expect(findRow(rows, 'Bundle').trend).toBe('▲ 32 KB')
    expect(findRow(rows, 'Lighthouse Performance').trend).toBe('▼ 1')
    expect(findRow(rows, 'Accessibility').trend).toBe('→')
    expect(findRow(rows, 'Dependencies').trend).toBe('▼ 2')
  })

  it('前回の有効な履歴が無い場合はTrendがダッシュになる（初回実行）', () => {
    const rows = buildProjectHealthRows({ unitTests: { total: 638, passed: 638 } })
    expect(findRow(rows, 'Unit tests').trend).toBe('—')
    expect(findRow(rows, 'Bundle').trend).toBe('—')
  })

  it('Games / Nightly / Last deploy はTrend対象外', () => {
    const rows = buildProjectHealthRows({ gamesCount: 42 })
    expect(findRow(rows, 'Games').trend).toBe('')
    expect(findRow(rows, 'Nightly').trend).toBe('')
    expect(findRow(rows, 'Last deploy').trend).toBe('')
  })
})

describe('renderProjectHealthMarkdown', () => {
  it('Markdownテーブルとして出力する', () => {
    const markdown = renderProjectHealthMarkdown(buildProjectHealthRows({ gamesCount: 3 }))
    expect(markdown).toContain('## Project Health')
    expect(markdown).toContain('| Games | 3 |')
  })

  it('Trend列を含み、前回値との差分を表示する（Issue #525）', () => {
    const rows = buildProjectHealthRows({
      lighthouse: { performance: 93, accessibility: 96 },
      previous: { lighthousePerformance: 94, accessibility: 96 },
    })
    const markdown = renderProjectHealthMarkdown(rows)
    expect(markdown).toContain('| Metric | Value | Status | Trend')
    expect(markdown).toContain('▼ 1')
    expect(markdown).toContain('→')
  })

  it('リンクが無ければDetailsを出さない', () => {
    const markdown = renderProjectHealthMarkdown(buildProjectHealthRows({}))
    expect(markdown).not.toContain('<details>')
  })

  it('リンクがあればDetailsに含める', () => {
    const markdown = renderProjectHealthMarkdown(buildProjectHealthRows({}), {
      links: ['Nightly: https://x/nightly'],
    })
    expect(markdown).toContain('<details>')
    expect(markdown).toContain('https://x/nightly')
  })
})
