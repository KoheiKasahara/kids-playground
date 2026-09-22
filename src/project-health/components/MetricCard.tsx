import type { MetricViewModel } from '../dashboardData'

const STATUS_LABEL: Record<string, string> = {
  '✅': '正常',
  '⚠️': '要確認',
  '❌': '要対応',
  '❓': '未計測',
  '⏭️': '未完了',
  '': '',
}

const TREND_ARROW_CLASS: Record<'improved' | 'worsened' | 'neutral', string> = {
  improved: 'ph-trend--improved',
  worsened: 'ph-trend--worsened',
  neutral: 'ph-trend--neutral',
}

/**
 * 指標カード。色だけに依存せず、アイコン＋テキストのstatus labelでも
 * Success/Warning/Errorを区別できるようにする（Issue #526の視覚方針）。
 */
export default function MetricCard({ metric }: { metric: MetricViewModel }) {
  const statusLabel = STATUS_LABEL[metric.status] ?? ''
  const trendClass = metric.trendJudgement ? TREND_ARROW_CLASS[metric.trendJudgement] : ''

  return (
    <article id={`metric-${metric.key}`} className={`ph-card ph-card--${statusToTone(metric.status)}`} aria-label={metric.label}>
      <div className="ph-card__header">
        <h3 className="ph-card__label">{metric.label}</h3>
        {metric.status ? (
          <span className="ph-card__status" title={statusLabel}>
            <span aria-hidden="true">{metric.status}</span>
            <span className="ph-card__status-text">{statusLabel}</span>
          </span>
        ) : null}
      </div>
      <div className="ph-card__value">{metric.value}</div>
      <div className={`ph-card__trend ${trendClass}`}>前回比 {metric.trendText === '→' ? '変化なし' : metric.trendText}</div>
      {metric.description && <p className="ph-card__description">{metric.description}</p>}
    </article>
  )
}

function statusToTone(status: string): 'ok' | 'warning' | 'error' | 'neutral' {
  if (status === '❌') return 'error'
  if (status === '⚠️' || status === '⏭️') return 'warning'
  if (status === '✅') return 'ok'
  return 'neutral'
}
