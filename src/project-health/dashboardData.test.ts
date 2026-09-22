import { describe, expect, it } from 'vitest'
import { buildDashboardViewModel, computeOverallStatus, emptyDashboardViewModel, isHistoryStale, workflowLabel } from './dashboardData'
import type { ProjectHealthHistoryEntry } from '../../scripts/project-health/lib/history.mjs'

const THRESHOLDS = { lighthousePerformance: 90, accessibility: 90 }

function entry(overrides: Partial<ProjectHealthHistoryEntry> = {}): ProjectHealthHistoryEntry {
  return {
    date: '2026-09-05',
    games: 42,
    unitTests: 638,
    unitTestsPassed: 638,
    initialJsGzipKb: 100,
    initialCssGzipKb: 10,
    precacheKb: 10000,
    e2eSmokePassed: 42,
    e2eSmokeTotal: 42,
    bundleKb: 1843,
    lighthousePerformance: 94,
    accessibility: 96,
    vulnerabilities: 0,
    nightly: 'success',
    deploy: 'success',
    recordedAt: '2026-09-05T03:00:00.000Z',
    runId: '5',
    ...overrides,
  }
}

describe('buildDashboardViewModel', () => {
  it('履歴が0件の場合は空のビューモデル（overallStatus: unknown）になる', () => {
    expect(buildDashboardViewModel([], THRESHOLDS, null)).toEqual(emptyDashboardViewModel())
  })

  it('正常な最新データを指標カードへ変換する', () => {
    const view = buildDashboardViewModel([entry({ date: '2026-09-04' }), entry()], THRESHOLDS, '2026-09-05T03:10:00Z')

    expect(view.hasHistory).toBe(true)
    expect(view.latestDate).toBe('2026-09-05')
    expect(view.overallStatus).toBe('healthy')

    const byKey = Object.fromEntries(view.metrics.map((m) => [m.key, m]))
    expect(byKey.games.value).toBe('42')
    expect(byKey.unitTests.value).toBe('638 / 638')
    expect(byKey.e2eSmoke.value).toBe('42 / 42')
    expect(byKey.e2eSmoke.status).toBe('✅')
    expect(byKey.bundle.value).toBe('1.80 MB')
    expect(byKey.lighthousePerformance.status).toBe('✅')
    expect(byKey.accessibility.status).toBe('✅')
    expect(byKey.vulnerabilities.value).toBe('0件')
    expect(byKey.vulnerabilities.status).toBe('✅')
    expect(byKey.nightly.status).toBe('✅')
    expect(byKey.deploy.status).toBe('✅')
  })

  it('履歴が1件のみの場合はtrendが「—」になり、他の表示は成立する', () => {
    const view = buildDashboardViewModel([entry()], THRESHOLDS, null)
    const byKey = Object.fromEntries(view.metrics.map((m) => [m.key, m]))

    expect(view.hasHistory).toBe(true)
    for (const metric of view.metrics) {
      expect(metric.trendText).toBe('—')
    }
    expect(byKey.bundle.value).toBe('1.80 MB')
  })

  it('前回値との差分を指標ごとの方向(higher/lowerIsBetter)で正しく判定する', () => {
    const previous = entry({
      date: '2026-09-04',
      bundleKb: 1780,
      lighthousePerformance: 96,
      accessibility: 95,
      vulnerabilities: 1,
    })
    const latest = entry({
      date: '2026-09-05',
      bundleKb: 1843, // アプリ追加で増える総容量の差分は中立
      lighthousePerformance: 94, // 減少 => higherIsBetterなので悪化
      accessibility: 96, // 増加 => higherIsBetterなので改善
      vulnerabilities: 0, // 減少 => lowerIsBetterなので改善
    })

    const view = buildDashboardViewModel([previous, latest], THRESHOLDS, null)
    const byKey = Object.fromEntries(view.metrics.map((m) => [m.key, m]))

    expect(byKey.bundle.trendText).toBe('▲ 63 KB')
    expect(byKey.bundle.trendJudgement).toBe('neutral')
    expect(byKey.lighthousePerformance.trendText).toBe('▼ 2')
    expect(byKey.lighthousePerformance.trendJudgement).toBe('worsened')
    expect(byKey.accessibility.trendText).toBe('▲ 1')
    expect(byKey.accessibility.trendJudgement).toBe('improved')
    expect(byKey.vulnerabilities.trendText).toBe('▼ 1')
    expect(byKey.vulnerabilities.trendJudgement).toBe('improved')
  })

  it('E2E smoke coverageの前回差分は浮動小数点誤差なく小数第1位までで表示される', () => {
    const previous = entry({ date: '2026-09-04', e2eSmokePassed: 42, e2eSmokeTotal: 42 })
    const latest = entry({ date: '2026-09-05', e2eSmokePassed: 39, e2eSmokeTotal: 42 })

    const view = buildDashboardViewModel([previous, latest], THRESHOLDS, null)
    const e2e = view.metrics.find((m) => m.key === 'e2eSmoke')!

    expect(e2e.status).toBe('❌')
    expect(e2e.trendText).toBe('▼ 7.1 pt')
  })

  it('一部の値が欠損していても他の指標表示やDashboard全体を壊さない', () => {
    const latest = entry({
      lighthousePerformance: null,
      accessibility: null,
      deploy: null,
      unitTests: null,
    })
    const view = buildDashboardViewModel([latest], THRESHOLDS, null)
    const byKey = Object.fromEntries(view.metrics.map((m) => [m.key, m]))

    expect(byKey.lighthousePerformance.value).toBe('—')
    expect(byKey.lighthousePerformance.status).toBe('❓')
    expect(byKey.accessibility.value).toBe('—')
    expect(byKey.deploy.value).toBe('—')
    expect(byKey.deploy.status).toBe('❓')
    expect(byKey.unitTests.value).toBe('—')
  })

  it('閾値未達のLighthouse/Accessibilityは⚠️（Warning）になる', () => {
    const view = buildDashboardViewModel([entry({ lighthousePerformance: 70, accessibility: 80 })], THRESHOLDS, null)
    const byKey = Object.fromEntries(view.metrics.map((m) => [m.key, m]))

    expect(byKey.lighthousePerformance.status).toBe('⚠️')
    expect(byKey.accessibility.status).toBe('⚠️')
    expect(view.overallStatus).toBe('warning')
  })

  it('Nightly失敗はNightlyカードを❌にし、overallStatusをerrorにする', () => {
    const view = buildDashboardViewModel([entry({ nightly: 'failure' })], THRESHOLDS, null)
    expect(view.overallStatus).toBe('error')
  })

  it('直近履歴からsparkline用のポイント列を組み立てる（欠損はnullで穴埋め）', () => {
    const entries = [
      entry({ date: '2026-09-01', bundleKb: 1600 }),
      entry({ date: '2026-09-02', bundleKb: null }),
      entry({ date: '2026-09-03', bundleKb: 1700 }),
    ]
    const view = buildDashboardViewModel(entries, THRESHOLDS, null)
    const bundleSeries = view.sparklines.find((s) => s.key === 'bundle')!

    expect(bundleSeries.points).toEqual([1600, null, 1700])
    expect(bundleSeries.latestText).toBe('1700')
  })
})

describe('computeOverallStatus', () => {
  it('指標が無ければunknown', () => {
    expect(computeOverallStatus([])).toBe('unknown')
  })

  it('❌が1つでもあればerrorを最優先する', () => {
    expect(
      computeOverallStatus([
        { key: 'a', label: 'A', value: '1', status: '⚠️', trendText: '—', trendJudgement: null },
        { key: 'b', label: 'B', value: '1', status: '❌', trendText: '—', trendJudgement: null },
      ]),
    ).toBe('error')
  })

  it('❌が無く⚠️があればwarning', () => {
    expect(
      computeOverallStatus([
        { key: 'a', label: 'A', value: '1', status: '✅', trendText: '—', trendJudgement: null },
        { key: 'b', label: 'B', value: '1', status: '⚠️', trendText: '—', trendJudgement: null },
      ]),
    ).toBe('warning')
  })

  it('欠測があると正常ではなくunknownになる', () => {
    expect(
      computeOverallStatus([
        { key: 'a', label: 'A', value: '1', status: '✅', trendText: '—', trendJudgement: null },
        { key: 'b', label: 'B', value: '—', status: '❓', trendText: '—', trendJudgement: null },
      ]),
    ).toBe('unknown')
  })
})

describe('計測結果の正確な判定', () => {
  it('高・重大の脆弱性は件数だけの警告でなく要対応にする', () => {
    for (const severity of ['vulnerabilitiesHigh', 'vulnerabilitiesCritical']) {
      const view = buildDashboardViewModel([entry({ vulnerabilities: 1, [severity]: 1 })], THRESHOLDS, null)
      expect(view.overallStatus).toBe('error')
      expect(view.metrics.find((metric) => metric.key === 'vulnerabilities')?.status).toBe('❌')
    }
  })

  it('単体テスト失敗と再試行で成功したE2Eを見落とさない', () => {
    const failed = buildDashboardViewModel([entry({ unitTestsPassed: 637 })], THRESHOLDS, null)
    expect(failed.overallStatus).toBe('error')
    const flaky = buildDashboardViewModel([entry({ e2eSmokeFlaky: 1, e2eSmokeSkipped: 0 })], THRESHOLDS, null)
    expect(flaky.overallStatus).toBe('warning')
    expect(flaky.metrics.find((metric) => metric.key === 'e2eSmoke')?.description).toContain('再試行で成功 1件')
  })

  it('古い履歴の成功数や初期読込量を補完して正常にしない', () => {
    const view = buildDashboardViewModel([entry({ unitTestsPassed: undefined, initialJsGzipKb: undefined })], THRESHOLDS, null)
    expect(view.overallStatus).toBe('unknown')
    expect(view.metrics.find((metric) => metric.key === 'unitTests')?.value).toBe('? / 638')
    expect(view.metrics.find((metric) => metric.key === 'initialJsGzipKb')?.value).toBe('—')
  })

  it('初期読込量の増加を判定し、総容量の増加とは区別する', () => {
    const view = buildDashboardViewModel([entry({ date: '2026-09-04' }), entry({ initialJsGzipKb: 110, bundleKb: 2000 })], THRESHOLDS, null)
    expect(view.metrics.find((metric) => metric.key === 'initialJsGzipKb')?.trendJudgement).toBe('worsened')
    expect(view.metrics.find((metric) => metric.key === 'bundle')?.trendJudgement).toBe('neutral')
  })

  it('E2Eの前回比は同じ計測日の成功数と総数から計算する', () => {
    const view = buildDashboardViewModel([
      entry({ date: '2026-09-03', e2eSmokePassed: 30, e2eSmokeTotal: 40 }),
      entry({ date: '2026-09-04', e2eSmokePassed: null, e2eSmokeTotal: 80 }),
      entry({ e2eSmokePassed: 80, e2eSmokeTotal: 80 }),
    ], THRESHOLDS, null)
    expect(view.metrics.find((metric) => metric.key === 'e2eSmoke')?.trendText).toBe('▲ 25 pt')
  })

  it('最新の欠測値を過去の値にすり替えない', () => {
    const view = buildDashboardViewModel([entry({ date: '2026-09-04' }), entry({ bundleKb: null })], THRESHOLDS, null)
    expect(view.sparklines.find((series) => series.key === 'bundle')?.latestText).toBe('—')
  })

  it('中止・未実行は正常にせず日本語で区別する', () => {
    for (const state of ['cancelled', 'skipped']) {
      expect(buildDashboardViewModel([entry({ nightly: state })], THRESHOLDS, null).overallStatus).toBe('warning')
    }
    expect(workflowLabel('cancelled')).toBe('中止')
    expect(workflowLabel('skipped')).toBe('未実行')
    expect(workflowLabel('unexpected')).toBe('状態不明')
  })

  it('48時間以上の古いデータ・日時欠損・未来の日時を見分ける', () => {
    const now = Date.parse('2026-09-22T09:00:00Z')
    expect(isHistoryStale('2026-09-22T03:00:00Z', now)).toBe(false)
    expect(isHistoryStale('2026-09-20T09:00:00Z', now)).toBe(true)
    expect(isHistoryStale('2026-09-25T03:00:00Z', now)).toBe(true)
    expect(isHistoryStale(null, now)).toBe(true)
    expect(isHistoryStale('invalid', now)).toBe(true)
  })
})
