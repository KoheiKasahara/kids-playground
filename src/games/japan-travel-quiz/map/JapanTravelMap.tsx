import { useEffect, useMemo } from 'react'
import { prefectures } from '../../prefecture-quiz/data/prefectures'
import { displayPiecesForPrefecture } from '../../prefecture-quiz/map/features'
import { createProjection, mergeBounds, pathForGeometry, positionsForGeometry, primaryProjectedBounds, projectedBoundsForGeometry, splitPolygons } from '../../prefecture-quiz/map/geometry'
import type { Position } from '../../prefecture-quiz/map/geometry'
import type { JapanTravelCourse, JapanTravelPhase } from '../types'
import styles from './JapanTravelMap.module.css'

type Props = { course: JapanTravelCourse; questionIndex: number; phase: JapanTravelPhase; onTravelComplete: () => void; result?: boolean }

// 沖縄を実座標のまま含めると本州が縮みすぎるため、既存都道府県クイズと同様に専用insetへ置く。
const mainPrefectures = prefectures.filter((prefecture) => prefecture.id !== '47')
const okinawa = prefectures.find((prefecture) => prefecture.id === '47')!
const mapBounds = mergeBounds(mainPrefectures.map((prefecture) => projectedBoundsForGeometry(displayPiecesForPrefecture(prefecture).main)))
const project = createProjection(mapBounds, 360, 280, 8)
const pathsById = new Map(mainPrefectures.map((prefecture) => [prefecture.id, pathForGeometry(displayPiecesForPrefecture(prefecture).main, project)]))
const OKINAWA_INSET = { x: 250, y: 216, width: 102, height: 56 }
const okinawaPath = pathForGeometry(displayPiecesForPrefecture(okinawa).main, createProjection(projectedBoundsForGeometry(displayPiecesForPrefecture(okinawa).main), 96, 48, 3))

function primaryCenter(id: string): Position {
  const prefecture = prefectures.find((item) => item.id === id)
  if (!prefecture) return [180, 140]
  const polygons = splitPolygons(displayPiecesForPrefecture(prefecture).main)
  const primary = polygons.reduce((best, polygon) => {
    const bounds = primaryProjectedBounds(polygon)
    const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
    return area > best.area ? { polygon, area } : best
  }, { polygon: polygons[0], area: -1 })
  const positions = primary.polygon ? positionsForGeometry(primary.polygon) : []
  if (positions.length === 0) return [180, 140]
  const [longitude, latitude] = positions.reduce<[number, number]>((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
  return project([longitude / positions.length, latitude / positions.length])
}

const pointsById = new Map(mainPrefectures.map((prefecture) => [prefecture.id, primaryCenter(prefecture.id)]))
pointsById.set('47', [OKINAWA_INSET.x + OKINAWA_INSET.width / 2, OKINAWA_INSET.y + OKINAWA_INSET.height / 2])

function routePath(from: Position, to: Position): string {
  const midX = (from[0] + to[0]) / 2
  const midY = (from[1] + to[1]) / 2
  const lift = Math.min(30, Math.max(8, Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.18))
  return `M ${from[0].toFixed(1)} ${from[1].toFixed(1)} Q ${midX.toFixed(1)} ${(midY - lift).toFixed(1)} ${to[0].toFixed(1)} ${to[1].toFixed(1)}`
}

/** 離島を整理済みの既存県境データで描く、全国を俯瞰する旅行地図。 */
export default function JapanTravelMap({ course, questionIndex, phase, onTravelComplete, result = false }: Props) {
  const routeIds = course.prefectureIds
  const activeIndex = result ? routeIds.length - 1 : phase === 'traveling' ? questionIndex + 1 : questionIndex
  const activeId = routeIds[Math.min(activeIndex, routeIds.length - 1)]
  const completedSegments = result ? routeIds.length - 1 : questionIndex
  const visitedIds = useMemo(() => new Set(result ? routeIds : routeIds.slice(0, questionIndex)), [questionIndex, result, routeIds])

  useEffect(() => {
    if (phase !== 'traveling' || result) return undefined
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { onTravelComplete(); return undefined }
    const timer = window.setTimeout(onTravelComplete, 850)
    return () => window.clearTimeout(timer)
  }, [onTravelComplete, phase, result])

  return <svg className={styles.map} viewBox="0 0 360 280" role="img" aria-label={result ? '旅した都道府県の地図' : '都道府県をさがす日本地図'}>
    <rect width="360" height="280" className={styles.ocean} />
    {mainPrefectures.map((prefecture) => <path key={prefecture.id} d={pathsById.get(prefecture.id)} className={prefecture.id === activeId && !result ? styles.active : visitedIds.has(prefecture.id) || (result && routeIds.includes(prefecture.id)) ? styles.visited : styles.prefecture} fillRule="evenodd" />)}
    <rect x={OKINAWA_INSET.x} y={OKINAWA_INSET.y} width={OKINAWA_INSET.width} height={OKINAWA_INSET.height} rx="5" className={styles.insetFrame} aria-hidden="true" />
    <path d={okinawaPath} transform={`translate(${OKINAWA_INSET.x + 3} ${OKINAWA_INSET.y + 4})`} className={'47' === activeId && !result ? styles.active : visitedIds.has('47') || (result && routeIds.includes('47')) ? styles.visited : styles.prefecture} fillRule="evenodd" />
    {Array.from({ length: completedSegments }, (_, index) => {
      const from = pointsById.get(routeIds[index]) ?? [180, 140]
      const to = pointsById.get(routeIds[index + 1]) ?? [180, 140]
      return <path key={`${routeIds[index]}-${routeIds[index + 1]}`} d={routePath(from, to)} className={styles.route} aria-hidden="true" />
    })}
    {phase === 'traveling' && !result && (() => {
      const from = pointsById.get(routeIds[questionIndex]) ?? [180, 140]
      const to = pointsById.get(routeIds[questionIndex + 1]) ?? [180, 140]
      return <><path d={routePath(from, to)} className={`${styles.route} ${styles.travelingRoute}`} aria-hidden="true" /><text x={(from[0] + to[0]) / 2} y={(from[1] + to[1]) / 2 - 10} className={styles.plane} aria-hidden="true">✈</text></>
    })()}
    {result && routeIds.map((id) => { const point = pointsById.get(id) ?? [180, 140]; return <circle key={id} cx={point[0]} cy={point[1]} r="3.1" className={styles.visitedDot} aria-hidden="true" /> })}
  </svg>
}
