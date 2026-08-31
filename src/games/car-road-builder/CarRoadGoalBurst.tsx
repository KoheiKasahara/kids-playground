import type { CSSProperties } from 'react'
import styles from './CarRoadBuilder.module.css'

type SparkStyle = CSSProperties & Record<`--${string}`, string>

const SPARKS = [
  { symbol: '✦', color: '#ffd43b', x: '0px', y: '-32px', delay: '0ms' },
  { symbol: '✧', color: '#74c0fc', x: '30px', y: '-20px', delay: '42ms' },
  { symbol: '★', color: '#ff9f68', x: '38px', y: '10px', delay: '84ms' },
  { symbol: '✦', color: '#b2f2bb', x: '18px', y: '34px', delay: '126ms' },
  { symbol: '✧', color: '#ffd43b', x: '-20px', y: '34px', delay: '63ms' },
  { symbol: '★', color: '#ff9f68', x: '-38px', y: '8px', delay: '105ms' },
  { symbol: '✦', color: '#74c0fc', x: '-30px', y: '-22px', delay: '21ms' },
] as const

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

type CarRoadGoalBurstProps = Readonly<{
  style?: CSSProperties
}>

/** ゴールマーカーの周りだけに広がる、CSSだけの短い成功演出。 */
export default function CarRoadGoalBurst({ style }: CarRoadGoalBurstProps) {
  if (prefersReducedMotion()) return null

  return (
    <span className={styles.goalBurst} style={style} data-testid="car-road-goal-burst" aria-hidden="true">
      {SPARKS.map((spark, index) => {
        const sparkStyle: SparkStyle = {
          '--goal-spark-color': spark.color,
          '--goal-spark-x': spark.x,
          '--goal-spark-y': spark.y,
          '--goal-spark-delay': spark.delay,
        }
        return <span key={index} className={styles.goalSpark} style={sparkStyle}>{spark.symbol}</span>
      })}
    </span>
  )
}
