import type { OverallStatus } from '../dashboardData'

const CONTENT: Record<OverallStatus, { icon: string; label: string; tone: string }> = {
  healthy: { icon: '🟢', label: '正常です', tone: 'ok' },
  warning: { icon: '🟡', label: '確認が必要です', tone: 'warning' },
  error: { icon: '🔴', label: '対応が必要です', tone: 'error' },
  unknown: { icon: '⚪', label: '判定に必要なデータが不足しています', tone: 'neutral' },
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
