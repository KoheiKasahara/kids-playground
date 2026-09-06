import type { MetricViewModel } from '../dashboardData'

const STATUS_LABEL: Record<string, string> = {
  '✅': 'OK',
  '⚠️': 'Warning',
  '❌': 'Error',
  '❓': 'Unknown',
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
    <div className={`ph-card ph-card--${statusToTone(metric.status)}`}>
      <div className="ph-card__header">
        <span className="ph-card__label">{metric.label}</span>
        {metric.status ? (
          <span className="ph-card__status" title={statusLabel}>
            {metric.status}
            <span className="ph-card__status-text">{statusLabel}</span>
          </span>
        ) : null}
      </div>
      <div className="ph-card__value">{metric.value}</div>
      <div className={`ph-card__trend ${trendClass}`}>{metric.trendText}</div>
    </div>
  )
}

function statusToTone(status: string): 'ok' | 'warning' | 'error' | 'neutral' {
  if (status === '❌') return 'error'
  if (status === '⚠️') return 'warning'
  if (status === '✅') return 'ok'
  return 'neutral'
}
