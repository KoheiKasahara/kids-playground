import { parseProjectHealthConfig } from '../../scripts/project-health/lib/projectHealthConfig.mjs'
import projectHealthConfigRaw from '../../.project-health.json?raw'
import { buildDashboardViewModel, emptyDashboardViewModel } from './dashboardData'
import { useProjectHealthHistory } from './useProjectHealthHistory'
import OverallStatusBanner from './components/OverallStatusBanner'
import MetricCard from './components/MetricCard'
import TrendSection from './components/TrendSection'

// 閾値は `.project-health.json` を唯一の情報源とし、CIと同じ
// parseProjectHealthConfig でパースする（Issue #526: Health判定を二重管理しない）。
const projectHealthConfig = parseProjectHealthConfig(projectHealthConfigRaw)

export default function Dashboard() {
  const historyState = useProjectHealthHistory()

  const view =
    historyState.status === 'ready'
      ? buildDashboardViewModel(historyState.entries, projectHealthConfig.thresholds, historyState.updatedAt)
      : emptyDashboardViewModel()

  return (
    <div className="ph-page">
      <header className="ph-header">
        <p className="ph-header__eyebrow">Kids Playground</p>
        <h1 className="ph-header__title">PROJECT HEALTH</h1>
        <OverallStatusBanner status={historyState.status === 'loading' ? 'unknown' : view.overallStatus} />
        <p className="ph-header__meta">{renderMeta(historyState.status, view.latestDate)}</p>
      </header>

      {historyState.status === 'loading' ? (
        <p className="ph-loading">読み込み中…</p>
      ) : !view.hasHistory ? (
        <p className="ph-empty">まだ履歴データがありません（Nightly実行後に表示されます）。</p>
      ) : (
        <>
          <section className="ph-section">
            <div className="ph-card-grid">
              {view.metrics.map((metric) => (
                <MetricCard key={metric.key} metric={metric} />
              ))}
            </div>
          </section>
          <TrendSection series={view.sparklines} />
        </>
      )}

      <footer className="ph-footer">
        <p>
          データは Nightly 実行時に更新される <code>project-health/history.json</code>{' '}
          を再利用しています。数値の再計測は行っていません。
        </p>
      </footer>
    </div>
  )
}

function renderMeta(status: 'loading' | 'ready', latestDate: string | null): string {
  if (status === 'loading') {
    return ''
  }
  return latestDate ? `最終更新: ${latestDate}` : 'データなし'
}
