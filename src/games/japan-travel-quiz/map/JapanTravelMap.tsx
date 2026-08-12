import { useEffect, useMemo, useRef } from 'react'
import { prefectures } from '../../prefecture-quiz/data/prefectures'
import { displayPiecesForPrefecture } from '../../prefecture-quiz/map/features'
import { createProjection, mergeBounds, pathForGeometry, positionsForGeometry, primaryProjectedBounds, projectedBoundsForGeometry, splitPolygons } from '../../prefecture-quiz/map/geometry'
import type { Bounds, Geometry, Position } from '../../prefecture-quiz/map/geometry'
import type { JapanTravelCourse, JapanTravelPhase } from '../types'
import styles from './JapanTravelMap.module.css'

type Props = { course: JapanTravelCourse; questionIndex: number; phase: JapanTravelPhase; onTravelComplete: () => void; result?: boolean }
type Camera = { scale: number; x: number; y: number }

const MAP_WIDTH = 360
const MAP_HEIGHT = 280
const overviewCamera: Camera = { scale: 1, x: 0, y: 0 }

// 沖縄を実座標のまま含めると本州が縮みすぎるため、既存都道府県クイズと同様に専用insetへ置く。
const mainPrefectures = prefectures.filter((prefecture) => prefecture.id !== '47')
const okinawa = prefectures.find((prefecture) => prefecture.id === '47')!
const mapBounds = mergeBounds(mainPrefectures.map((prefecture) => projectedBoundsForGeometry(displayPiecesForPrefecture(prefecture).main)))
const project = createProjection(mapBounds, MAP_WIDTH, MAP_HEIGHT, 8)
const pathsById = new Map(mainPrefectures.map((prefecture) => [prefecture.id, pathForGeometry(displayPiecesForPrefecture(prefecture).main, project)]))
const OKINAWA_INSET = { x: 250, y: 216, width: 102, height: 56 }
const okinawaPath = pathForGeometry(displayPiecesForPrefecture(okinawa).main, createProjection(projectedBoundsForGeometry(displayPiecesForPrefecture(okinawa).main), 96, 48, 3))

function boundsForPositions(positions: readonly Position[]): Bounds {
  if (positions.length === 0) return { minX: 0, minY: 0, maxX: MAP_WIDTH, maxY: MAP_HEIGHT }
  return positions.reduce<Bounds>((bounds, [x, y]) => ({
    minX: Math.min(bounds.minX, x), minY: Math.min(bounds.minY, y),
    maxX: Math.max(bounds.maxX, x), maxY: Math.max(bounds.maxY, y),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
}

/** 全国用に投影済みのSVG座標で、主領土だけの外接矩形を求める。 */
function primaryScreenBounds(geometry: Geometry): Bounds {
  const polygons = splitPolygons(geometry)
  const primary = polygons.reduce((best, polygon) => {
    const bounds = primaryProjectedBounds(polygon)
    const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
    return area > best.area ? { geometry: polygon, area } : best
  }, { geometry: polygons[0], area: -1 })
  return boundsForPositions(positionsForGeometry(primary.geometry ?? geometry).map(project))
}

const targetBoundsById = new Map<string, Bounds>(mainPrefectures.map((prefecture) => [prefecture.id, primaryScreenBounds(displayPiecesForPrefecture(prefecture).main)]))
// 沖縄は本州との距離ではなく、既存のinsetそのものを読みやすく見せる。
targetBoundsById.set('47', {
  minX: OKINAWA_INSET.x - 8,
  minY: OKINAWA_INSET.y - 8,
  maxX: OKINAWA_INSET.x + OKINAWA_INSET.width + 8,
  maxY: OKINAWA_INSET.y + OKINAWA_INSET.height + 8,
})

function cameraForBounds(bounds: Bounds, coverage = 0.42, minimumDimension = 14, maximumScale = 11): Camera {
  const width = Math.max(minimumDimension, bounds.maxX - bounds.minX)
  const height = Math.max(minimumDimension, bounds.maxY - bounds.minY)
  const scale = Math.max(1, Math.min(maximumScale, Math.min((MAP_WIDTH * coverage) / width, (MAP_HEIGHT * coverage) / height)))
  return {
    scale,
    x: MAP_WIDTH / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
    y: MAP_HEIGHT / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
  }
}

/**
 * 県の主領土のbboxから倍率を決める。小さい県だけ上限を少し高くしつつ、
 * 県を画面いっぱいにはせず周辺の県が残るcoverageにする。
 */
// eslint-disable-next-line react-refresh/only-export-components
export function cameraForPrefectureBounds(bounds: Bounds): Camera {
  const longestDimension = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
  const smallPrefectureThreshold = 38
  const maximumScale = longestDimension >= smallPrefectureThreshold
    ? 7
    : Math.min(11, 7 + (smallPrefectureThreshold - longestDimension) * 0.14)
  return cameraForBounds(bounds, 0.42, 14, maximumScale)
}

function targetBounds(id: string): Bounds { return targetBoundsById.get(id) ?? { minX: 140, minY: 100, maxX: 220, maxY: 180 } }
// eslint-disable-next-line react-refresh/only-export-components
export function cameraForTargetPrefecture(id: string): Camera { return cameraForPrefectureBounds(targetBounds(id)) }
function transform(camera: Camera): string { return `translate(${camera.x.toFixed(2)} ${camera.y.toFixed(2)}) scale(${camera.scale.toFixed(3)})` }
function durationFor(from: Position, to: Position): number { return Math.max(760, Math.min(1150, 760 + Math.hypot(to[0] - from[0], to[1] - from[1]) * 1.2)) }

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

function quadraticPoint(from: Position, to: Position, progress: number): Position {
  const midX = (from[0] + to[0]) / 2
  const midY = (from[1] + to[1]) / 2 - Math.min(30, Math.max(8, Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.18))
  const reverse = 1 - progress
  return [
    reverse * reverse * from[0] + 2 * reverse * progress * midX + progress * progress * to[0],
    reverse * reverse * from[1] + 2 * reverse * progress * midY + progress * progress * to[1],
  ]
}

/** 同一SVGのcamera transformを更新して、目的県と周辺を自然に見せる旅行地図。 */
export default function JapanTravelMap({ course, questionIndex, phase, onTravelComplete, result = false }: Props) {
  const cameraRef = useRef<SVGGElement>(null)
  const planeRef = useRef<SVGGElement>(null)
  const frameRef = useRef<number | null>(null)
  const previousCamera = useRef<Camera>(overviewCamera)
  const routeIds = course.prefectureIds
  const activeIndex = result ? routeIds.length - 1 : phase === 'traveling' ? questionIndex + 1 : questionIndex
  const activeId = routeIds[Math.min(activeIndex, routeIds.length - 1)]
  const completedSegments = result ? routeIds.length - 1 : questionIndex
  const visitedIds = useMemo(() => new Set(result ? routeIds : routeIds.slice(0, questionIndex)), [questionIndex, result, routeIds])

  useEffect(() => () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current) }, [])

  useEffect(() => {
    const camera = cameraRef.current
    if (!camera) return undefined
    const destination = result ? overviewCamera : cameraForTargetPrefecture(activeId)
    const origin = previousCamera.current
    const plane = planeRef.current
    const traveling = phase === 'traveling' && !result
    const from = traveling ? pointsById.get(routeIds[questionIndex]) : undefined
    const to = traveling ? pointsById.get(routeIds[questionIndex + 1]) : undefined
    const duration = from && to ? durationFor(from, to) : 800
    const setCamera = (value: Camera) => {
      camera.setAttribute('transform', transform(value))
    }
    const finish = () => {
      frameRef.current = null
      previousCamera.current = destination
      setCamera(destination)
      if (plane) plane.setAttribute('visibility', 'hidden')
      if (traveling) onTravelComplete()
    }
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { finish(); return undefined }

    const started = performance.now()
    if (plane && from) plane.setAttribute('visibility', 'visible')
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration)
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2
      const baseScale = origin.scale + (destination.scale - origin.scale) * eased
      const distance = from && to ? Math.hypot(to[0] - from[0], to[1] - from[1]) : 0
      const zoomOut = traveling ? Math.min(Math.max(0, baseScale - 1), distance / 250) * 3.2 * progress * (1 - progress) : 0
      const current = {
        scale: Math.max(1, baseScale - zoomOut),
        x: origin.x + (destination.x - origin.x) * eased,
        y: origin.y + (destination.y - origin.y) * eased,
      }
      setCamera(current)
      if (plane && from && to) {
        const point = quadraticPoint(from, to, eased)
        const next = quadraticPoint(from, to, Math.min(1, eased + 0.015))
        const angle = Math.atan2(next[1] - point[1], next[0] - point[0]) * 180 / Math.PI
        plane.setAttribute('transform', `translate(${point[0]} ${point[1]}) rotate(${angle}) scale(${1 / current.scale})`)
      }
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
      else finish()
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current) }
  }, [activeId, onTravelComplete, phase, questionIndex, result, routeIds])

  return <svg className={styles.map} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label={result ? '旅した都道府県の地図' : '都道府県をさがす日本地図'} preserveAspectRatio="xMidYMid meet">
    <rect width={MAP_WIDTH} height={MAP_HEIGHT} className={styles.ocean} />
    <g ref={cameraRef} transform={transform(overviewCamera)}>
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
        return <path d={routePath(from, to)} className={`${styles.route} ${styles.travelingRoute}`} aria-hidden="true" />
      })()}
      {result && routeIds.map((id) => { const point = pointsById.get(id) ?? [180, 140]; return <circle key={id} cx={point[0]} cy={point[1]} r="3.1" className={styles.visitedDot} aria-hidden="true" /> })}
      <g ref={planeRef} className={styles.plane} visibility="hidden" aria-hidden="true"><text x="-8" y="6">✈</text></g>
    </g>
  </svg>
}
