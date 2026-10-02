import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GAME_CATALOG } from '../games/gameCatalog'
import Dashboard from './Dashboard'

function mockHistoryResponse(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, text: () => Promise.resolve(JSON.stringify(body)) }))
}

const latest = {
  date: '2026-09-05', games: 42, unitTests: 638, unitTestsPassed: 638,
  e2eSmokePassed: 42, e2eSmokeTotal: 42, e2eSmokeFlaky: 0, e2eSmokeSkipped: 0,
  bundleKb: 1843, initialJsGzipKb: 100, initialCssGzipKb: 10, precacheKb: 10000, precacheEntries: 200,
  lighthousePerformance: 94, accessibility: 96, vulnerabilities: 0,
  vulnerabilitiesCritical: 0, vulnerabilitiesHigh: 0, vulnerabilitiesModerate: 0, vulnerabilitiesLow: 0, vulnerabilitiesInfo: 0,
  nightly: 'success', deploy: 'success', recordedAt: '2026-09-05T03:00:00.000Z', runId: '5',
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-05T06:00:00Z'))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('公開中のアプリ構成と計測時の結果を日本語で表示する', async () => {
    mockHistoryResponse({ entries: [{ ...latest, date: '2026-09-04', bundleKb: 1780 }, latest] })
    render(<Dashboard />)

    expect(await screen.findByText('正常です')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'プロジェクトの健康状態' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: '公開中のアプリ' })).getByText(String(GAME_CATALOG.length))).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: '計測時のアプリ数' })).getByText('42')).toBeInTheDocument()
    expect(screen.getByText('638 / 638')).toBeInTheDocument()
    expect(screen.getByText('42 / 42')).toBeInTheDocument()
    expect(screen.getByText('1.80 MB')).toBeInTheDocument()
    expect(screen.getByText('前回比 ▲ 63 KB')).toBeInTheDocument()
    expect(screen.getByText('最終計測日: 2026-09-05（日本時間）')).toBeInTheDocument()
    expect(screen.queryByText(/Healthy|Warning|success|vulnerable/)).not.toBeInTheDocument()
  })

  it('通信エラーを履歴0件と混同せず、再読み込みを案内する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    render(<Dashboard />)
    expect(await screen.findByRole('alert')).toHaveTextContent('計測データを取得できませんでした')
    expect(screen.getByRole('button', { name: '再読み込み' })).toBeInTheDocument()
    expect(screen.queryByText(/まだ履歴データがありません/)).not.toBeInTheDocument()
  })

  it.each([
    [{ entries: [] }, false],
    [{ invalid: true }, true],
    [{ entries: [null, { date: 'invalid' }] }, true],
  ])('HTTPエラーや不正な履歴も取得失敗を伝える: %j', async (body, ok) => {
    mockHistoryResponse(body, ok)
    render(<Dashboard />)
    expect(await screen.findByRole('alert')).toHaveTextContent('計測データを取得できませんでした')
  })

  it('正常に取得できた空履歴は初回計測待ちと表示する', async () => {
    mockHistoryResponse({ entries: [] })
    render(<Dashboard />)
    expect(await screen.findByText(/まだ履歴データがありません/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('古い形式の履歴も表示し、追加指標は未計測にする', async () => {
    mockHistoryResponse({ entries: [{ date: '2026-09-05', games: 42, bundleKb: 1843, unitTests: 638 }] })
    render(<Dashboard />)
    expect(await screen.findByText('1.80 MB')).toBeInTheDocument()
    expect(screen.getByText('? / 638')).toBeInTheDocument()
    expect(screen.getAllByText('未計測').length).toBeGreaterThan(0)
    expect(screen.getByText(/追加した指標は次回/)).toBeInTheDocument()
    expect(screen.queryByText('正常です')).not.toBeInTheDocument()
  })

  it('48時間以上更新が止まると正常表示をやめる', async () => {
    mockHistoryResponse({ entries: [{ ...latest, recordedAt: '2026-09-01T03:00:00Z' }] })
    render(<Dashboard />)
    expect(await screen.findByText('確認が必要です')).toBeInTheDocument()
    expect(screen.getByText(/計測結果が48時間以上/)).toBeInTheDocument()
  })

  it('要対応の脆弱性へのリンクを表示する', async () => {
    mockHistoryResponse({ entries: [{ ...latest, vulnerabilities: 1, vulnerabilitiesHigh: 1 }] })
    render(<Dashboard />)
    expect(await screen.findByText('対応が必要です')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '依存関係の脆弱性: 1件' })).toHaveAttribute('href', '#metric-vulnerabilities')
  })
})
