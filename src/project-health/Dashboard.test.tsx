import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Dashboard from './Dashboard'

function mockHistoryResponse(body: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      text: () => Promise.resolve(JSON.stringify(body)),
    }),
  )
}

describe('Dashboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('正常な履歴データを取得して主要指標・Health・トレンドを表示する', async () => {
    mockHistoryResponse({
      updatedAt: '2026-09-05T03:10:00.000Z',
      entries: [
        {
          date: '2026-09-04',
          games: 41,
          unitTests: 620,
          e2eSmokePassed: 41,
          e2eSmokeTotal: 41,
          bundleKb: 1780,
          lighthousePerformance: 95,
          accessibility: 96,
          vulnerabilities: 0,
          nightly: 'success',
          deploy: 'success',
          recordedAt: '2026-09-04T03:00:00.000Z',
          runId: '4',
        },
        {
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
        },
      ],
    })

    render(<Dashboard />)

    expect(await screen.findByText('Healthy')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('42 / 42')).toBeInTheDocument()
    expect(screen.getByText('1.80 MB')).toBeInTheDocument()
    expect(screen.getByText('▲ 63 KB')).toBeInTheDocument()
    expect(screen.getByText('最終更新: 2026-09-05')).toBeInTheDocument()
  })

  it('履歴取得に失敗しても例外を投げず「データがない」旨を表示する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    render(<Dashboard />)

    expect(await screen.findByText('No data')).toBeInTheDocument()
    expect(screen.getByText(/まだ履歴データがありません/)).toBeInTheDocument()
  })

  it('履歴が1件かつ一部フィールドが欠損していても壊れず「—」でフォールバックする', async () => {
    mockHistoryResponse({
      updatedAt: '2026-09-05T03:00:00.000Z',
      entries: [
        {
          date: '2026-09-05',
          games: 42,
          unitTests: null,
          e2eSmokePassed: null,
          e2eSmokeTotal: null,
          bundleKb: 1843,
          lighthousePerformance: null,
          accessibility: null,
          vulnerabilities: null,
          nightly: null,
          deploy: null,
          recordedAt: '2026-09-05T03:00:00.000Z',
          runId: null,
        },
      ],
    })

    render(<Dashboard />)

    expect(await screen.findByText('1.80 MB')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0)
  })
})
