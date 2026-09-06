import { describe, expect, it } from 'vitest'
import { buildDashboardViewModel, computeOverallStatus, emptyDashboardViewModel } from './dashboardData'
import type { ProjectHealthHistoryEntry } from '../../scripts/project-health/lib/history.mjs'

const THRESHOLDS = { lighthousePerformance: 90, accessibility: 90 }

function entry(overrides: Partial<ProjectHealthHistoryEntry> = {}): ProjectHealthHistoryEntry {
  return {
    date: '2026-09-05',
    games: 42,
    unitTests: 638,
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
    expect(byKey.unitTests.value).toBe('638')
    expect(byKey.e2eSmoke.value).toBe('42 / 42')
    expect(byKey.e2eSmoke.status).toBe('✅')
    expect(byKey.bundle.value).toBe('1.80 MB')
    expect(byKey.lighthousePerformance.status).toBe('✅')
    expect(byKey.accessibility.status).toBe('✅')
    expect(byKey.vulnerabilities.value).toBe('0 vulnerable')
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
      bundleKb: 1843, // 増加 => lowerIsBetterなので悪化
      lighthousePerformance: 94, // 減少 => higherIsBetterなので悪化
      accessibility: 96, // 増加 => higherIsBetterなので改善
      vulnerabilities: 0, // 減少 => lowerIsBetterなので改善
    })

    const view = buildDashboardViewModel([previous, latest], THRESHOLDS, null)
    const byKey = Object.fromEntries(view.metrics.map((m) => [m.key, m]))

    expect(byKey.bundle.trendText).toBe('▲ 63 KB')
    expect(byKey.bundle.trendJudgement).toBe('worsened')
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

  it('❌も⚠️も無ければhealthy（❓のみは許容する）', () => {
    expect(
      computeOverallStatus([
        { key: 'a', label: 'A', value: '1', status: '✅', trendText: '—', trendJudgement: null },
        { key: 'b', label: 'B', value: '—', status: '❓', trendText: '—', trendJudgement: null },
      ]),
    ).toBe('healthy')
  })
})
