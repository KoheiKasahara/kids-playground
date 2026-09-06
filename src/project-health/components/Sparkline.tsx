// 直近履歴の簡易トレンド表示用。大型チャートライブラリを追加せず、
// 軽量な自前SVGのpolylineで十分という方針（Issue #526）に沿った実装。
interface SparklineProps {
  points: Array<number | null>
  width?: number
  height?: number
}

const WIDTH = 120
const HEIGHT = 32
const PADDING = 3

export default function Sparkline({ points, width = WIDTH, height = HEIGHT }: SparklineProps) {
  const valid = points
    .map((value, index) => ({ value, index }))
    .filter((entry): entry is { value: number; index: number } => entry.value !== null)

  if (valid.length < 2) {
    return (
      <div className="ph-sparkline ph-sparkline--empty" style={{ width, height }} aria-hidden="true">
        <span>—</span>
      </div>
    )
  }

  const min = Math.min(...valid.map((entry) => entry.value))
  const max = Math.max(...valid.map((entry) => entry.value))
  const span = max - min || 1
  const lastIndex = points.length - 1

  const toX = (index: number) => PADDING + (index / (lastIndex || 1)) * (width - PADDING * 2)
  const toY = (value: number) => height - PADDING - ((value - min) / span) * (height - PADDING * 2)

  const linePoints = valid.map((entry) => `${toX(entry.index)},${toY(entry.value)}`).join(' ')
  const last = valid[valid.length - 1]

  return (
    <svg
      className="ph-sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`直近${valid.length}件の推移`}
    >
      <polyline points={linePoints} fill="none" strokeWidth={2} className="ph-sparkline__line" />
      <circle cx={toX(last.index)} cy={toY(last.value)} r={2.5} className="ph-sparkline__dot" />
    </svg>
  )
}
