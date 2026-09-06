import type { OverallStatus } from '../dashboardData'

const CONTENT: Record<OverallStatus, { icon: string; label: string; tone: string }> = {
  healthy: { icon: '🟢', label: 'Healthy', tone: 'ok' },
  warning: { icon: '🟡', label: 'Warning', tone: 'warning' },
  error: { icon: '🔴', label: 'Critical', tone: 'error' },
  unknown: { icon: '⚪', label: 'No data', tone: 'neutral' },
}

export default function OverallStatusBanner({ status }: { status: OverallStatus }) {
  const content = CONTENT[status]
  return (
    <div className={`ph-banner ph-banner--${content.tone}`}>
      <span className="ph-banner__icon" aria-hidden="true">
        {content.icon}
      </span>
      <span className="ph-banner__label">{content.label}</span>
    </div>
  )
}
