import type { SparklineSeries } from '../dashboardData'
import Sparkline from './Sparkline'

export default function TrendSection({ series }: { series: SparklineSeries[] }) {
  const withData = series.filter((entry) => entry.points.some((point) => point !== null))
  if (withData.length === 0) {
    return null
  }

  return (
    <section className="ph-section">
      <h2 className="ph-section__title">直近のトレンド</h2>
      <div className="ph-trend-grid">
        {withData.map((entry) => (
          <div className="ph-trend-item" key={entry.key}>
            <div className="ph-trend-item__header">
              <span className="ph-trend-item__label">{entry.label}</span>
              <span className="ph-trend-item__value">{entry.latestText}</span>
            </div>
            <Sparkline points={entry.points} />
          </div>
        ))}
      </div>
    </section>
  )
}
