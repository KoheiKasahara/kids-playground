import { parseProjectHealthConfig } from '../../scripts/project-health/lib/projectHealthConfig.mjs'
import projectHealthConfigRaw from '../../.project-health.json?raw'
import { GAME_CATALOG, GAME_CATEGORIES, type GameCategoryId } from '../games/gameCatalog'
import { buildDashboardViewModel, emptyDashboardViewModel, isHistoryStale } from './dashboardData'
import { useProjectHealthHistory } from './useProjectHealthHistory'
import OverallStatusBanner from './components/OverallStatusBanner'
import MetricCard from './components/MetricCard'
import TrendSection from './components/TrendSection'

const projectHealthConfig = parseProjectHealthConfig(projectHealthConfigRaw)
const groups = [
  { key: 'quality', title: 'テストと安全性', description: 'アプリ全体を対象にした定期チェックの結果です。' },
  { key: 'loading', title: '表示品質と読み込み容量', description: 'アプリが増えたときの総容量と、最初に遊び始めるための読み込み量を分けて確認できます。' },
  { key: 'delivery', title: '運用状況', description: '以下は計測時点の結果です。最新の実行状況はGitHubで確認できます。' },
] as const
const categories = (Object.keys(GAME_CATEGORIES) as GameCategoryId[]).map((id) => ({
  id, label: GAME_CATEGORIES[id].label, count: GAME_CATALOG.filter((game) => game.category === id).length,
}))

export default function Dashboard() {
  const historyState = useProjectHealthHistory()
  const view = historyState.status === 'ready'
    ? buildDashboardViewModel(historyState.entries, projectHealthConfig.thresholds, historyState.updatedAt)
    : emptyDashboardViewModel()
  const stale = view.hasHistory && isHistoryStale(view.updatedAt)
  const overallStatus = stale && view.overallStatus === 'healthy' ? 'warning' : view.overallStatus
  const concerns = view.metrics.filter((metric) => ['⚠️', '❌', '⏭️'].includes(metric.status))
  const missing = view.metrics.some((metric) => metric.status === '❓')

  return (
    <main className="ph-page">
      <nav className="ph-nav" aria-label="関連ページ">
        <a href="/">← あそびの一覧へ</a>
        <a href="https://github.com/KoheiKasahara/kids-playground/actions">GitHubの実行履歴 ↗</a>
      </nav>
      <header className="ph-header">
        <p className="ph-header__eyebrow">Kids Playground</p>
        <h1 className="ph-header__title">プロジェクトの健康状態</h1>
        <p className="ph-header__description">アプリの品質・安全性・公開状況をまとめて確認</p>
        <OverallStatusBanner status={overallStatus} />
        <p className="ph-header__meta">
          {historyState.status === 'loading' ? 'データを読み込み中…' : view.latestDate ? `最終計測日: ${view.latestDate}（日本時間）` : '計測データなし'}
        </p>
      </header>

      <section className="ph-catalog" aria-labelledby="catalog-title">
        <div>
          <h2 id="catalog-title" className="ph-section__title">公開中のアプリ</h2>
          <p className="ph-catalog__total"><strong>{GAME_CATALOG.length}</strong> アプリ</p>
          <p className="ph-section__description">このサイトのアプリ一覧から自動集計</p>
        </div>
        <dl className="ph-categories">
          {categories.map((category) => (
            <div key={category.id}>
              <dt>{category.label}</dt>
              <dd>{category.count}<span> アプリ</span></dd>
            </div>
          ))}
        </dl>
      </section>

      {historyState.status === 'loading' ? (
        <p className="ph-loading" role="status">計測結果を読み込み中…</p>
      ) : historyState.status === 'error' ? (
        <div className="ph-notice" role="alert">
          <p>計測データを取得できませんでした。通信状況を確認して再読み込みしてください。</p>
          <button type="button" onClick={() => window.location.reload()}>再読み込み</button>
        </div>
      ) : !view.hasHistory ? (
        <p className="ph-empty">まだ履歴データがありません。毎日の定期チェックが完了すると表示されます。</p>
      ) : (
        <>
          {(stale || concerns.length > 0 || missing) && (
            <aside className="ph-notice" aria-labelledby="notice-title">
              <h2 id="notice-title" className="ph-section__title">確認が必要な項目</h2>
              {stale && <p>計測結果が48時間以上更新されていないか、更新日時を確認できません。現在の状態とは異なる可能性があります。</p>}
              {concerns.length > 0 && <ul>{concerns.map((metric) => <li key={metric.key}><a href={`#metric-${metric.key}`}>{metric.label}: {metric.value}</a></li>)}</ul>}
              {missing && <p>未計測の項目があります。追加した指標は次回の定期チェックから記録されます。「—」「?」は未取得を表し、0件や正常とは判定しません。</p>}
            </aside>
          )}
          {groups.map((group) => (
            <section key={group.key} className="ph-section" aria-labelledby={`group-${group.key}`}>
              <h2 id={`group-${group.key}`} className="ph-section__title">{group.title}</h2>
              <p className="ph-section__description">{group.description}</p>
              <div className="ph-card-grid">
                {view.metrics.filter((metric) => metric.group === group.key).map((metric) => <MetricCard key={metric.key} metric={metric} />)}
              </div>
            </section>
          ))}
          <TrendSection series={view.sparklines} />
        </>
      )}

      <footer className="ph-footer">
        <p>計測結果は毎日午前3時（日本時間）に開始する定期チェックで更新されます。ページを開いても再計測は行いません。</p>
        <p>前回比は直前の有効な計測との差です。全アプリの容量とオフライン保存容量は、アプリ追加でも増加します。gzipはローカルでの圧縮換算値です。</p>
      </footer>
    </main>
  )
}
