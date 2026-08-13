import { useEffect, useMemo, useRef } from 'react'
import { travelCountryById } from '../data/travelCountries'
import { travelRegionById } from '../data/travelRegions'
import { worldFeatures } from '../data/worldFeatures'
import type { TravelCourse, TravelPhase } from '../types'
import { bezierPath, boundsForGeometry, boundsForGeometryNear, boundsForPositionsNear, cameraForBounds, cameraForCountryBounds, longitudeNear, mergeBounds, pathForGeometryNear, primaryBounds, project, quadraticBezier, shortestLongitudeBounds, shortestLongitudePath, type Bounds, type Camera, type Position } from './geometry'
import styles from './WorldTravelMap.module.css'

type Props = { course: TravelCourse; questionIndex: number; phase: TravelPhase; onTravelComplete: () => void; result?: boolean }
type CachedFeature = { key: string; id: number; geometry: (typeof worldFeatures)[number]['geometry']; bounds: Bounds; primary: Bounds }

const cachedFeatures: readonly CachedFeature[] = worldFeatures.map((item, index) => ({ key: `${item.id}-${index}`, id: item.id, geometry: item.geometry, bounds: boundsForGeometry(item.geometry), primary: primaryBounds(item.geometry) }))
// Natural Earth は同じ国IDに小さな離島のFeatureを持つことがある。地図上で国を
// フォーカスする際は、主領土が最も大きいFeatureを使う。
const featuresById = cachedFeatures.reduce((items, feature) => {
  const current = items.get(feature.id)
  const area = (bounds: Bounds) => (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
  if (!current || area(feature.primary) > area(current.primary)) items.set(feature.id, feature)
  return items
}, new Map<number, CachedFeature>())
const worldCamera: Camera = { scale: 1, x: 0, y: 0 }
const durationFor = (from: Position, to: Position) => Math.max(800, Math.min(1200, 800 + Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.55))
const transform = (camera: Camera) => `translate(${camera.x.toFixed(2)} ${camera.y.toFixed(2)}) scale(${camera.scale.toFixed(3)})`
const markerTransform = (point: Position, camera: Camera) => `translate(${(point[0] * camera.scale + camera.x).toFixed(2)} ${(point[1] * camera.scale + camera.y).toFixed(2)})`

function targetBounds(countryId: string, point: Position, referenceLongitude: number): Bounds {
  const country = travelCountryById.get(countryId)
  if (!country) return { minX: 480, minY: 260, maxX: 520, maxY: 300 }
  const item = featuresById.get(country.mapId)
  if (!item) return { minX: point[0] - 10, minY: point[1] - 10, maxX: point[0] + 10, maxY: point[1] + 10 }
  // カメラは描画と同じ連続経度帯で国境を測る。以前の primary を anchor 分だけ
  // 平行移動する方式では、地域ごとの表示経度帯とずれて国が画面外になり得た。
  return boundsForGeometryNear(item.geometry, referenceLongitude)
}

/** 日付変更線の処理前の、経度・緯度で表した国のアンカー。 */
function countryCoordinates(countryId: string): Position {
  const country = travelCountryById.get(countryId)
  return country?.anchor ?? [0, 0]
}

function routeCoordinatesForCountryIds(countryIds: readonly string[]): Position[] {
  return shortestLongitudePath(countryIds.map(countryCoordinates))
}

/**
 * 背景地図を、ルートと同じ連続経度帯へ配置する。
 * shortestLongitudeBounds は 0〜360° 側を返すことがあるため、ヨーロッパや
 * 南北アメリカでは先頭地点に近い同値の経度へ戻さないと地図だけ1周ずれる。
 */
// eslint-disable-next-line react-refresh/only-export-components
export function displayLongitudeForCountryIds(countryIds: readonly string[]): number {
  const routeCoordinates = routeCoordinatesForCountryIds(countryIds)
  const centerLongitude = shortestLongitudeBounds(routeCoordinates.map(([longitude]) => longitude)).centerLongitude
  return longitudeNear(centerLongitude, routeCoordinates[0]?.[0] ?? centerLongitude)
}

/**
 * 経度を連続化してから SVG 座標に投影する。
 * 投影済みの X 座標を longitudeNear に渡すと、経度として誤って折り返されるため、
 * この順序を1か所に固定する。
 */
// eslint-disable-next-line react-refresh/only-export-components
export function routePointsForCountryIds(countryIds: readonly string[]): Position[] {
  return routeCoordinatesForCountryIds(countryIds).map(project)
}

// eslint-disable-next-line react-refresh/only-export-components
export function cameraForTargetCountry(countryId: string, point: Position, referenceLongitude: number): Camera {
  return cameraForCountryBounds(targetBounds(countryId, point, referenceLongitude))
}

function cameraForRegion(course: TravelCourse, referenceLongitude: number): Camera {
  const frame = travelRegionById.get(course.region)?.mapFrame
  if (!frame) return worldCamera
  const [minLongitude, minLatitude, maxLongitude, maxLatitude] = frame
  return cameraForBounds(boundsForPositionsNear([[minLongitude, minLatitude], [maxLongitude, minLatitude], [maxLongitude, maxLatitude], [minLongitude, maxLatitude]], referenceLongitude), 0.9)
}

/** 同一 SVG を保ったまま camera g の transform だけを更新する世界地図。 */
export default function WorldTravelMap({ course, questionIndex, phase, onTravelComplete, result = false }: Props) {
  const cameraRef = useRef<SVGGElement>(null)
  const anchorRef = useRef<SVGGElement>(null)
  const planeRef = useRef<SVGGElement>(null)
  const travelingRouteRef = useRef<SVGPathElement>(null)
  const frameRef = useRef<number | null>(null)
  const routeIds = course.countryIds
  const routeCoordinates = useMemo(() => routeCoordinatesForCountryIds(routeIds), [routeIds])
  const displayLongitude = useMemo(() => displayLongitudeForCountryIds(routeIds), [routeIds])
  const initialCamera = useMemo(() => cameraForRegion(course, displayLongitude), [course, displayLongitude])
  const previousCamera = useRef<Camera>(initialCamera)
  const routePoints = useMemo(() => routeCoordinates.map(project), [routeCoordinates])
  const displayFeatures = useMemo(() => cachedFeatures.map((item) => ({ ...item, path: pathForGeometryNear(item.geometry, displayLongitude) })), [displayLongitude])
  const activeIndex = result ? routeIds.length - 1 : phase === 'traveling' ? questionIndex + 1 : questionIndex
  const activeId = routeIds[Math.min(activeIndex, routeIds.length - 1)]
  const activeMapId = travelCountryById.get(activeId)?.mapId
  // 移動中の区間は別レイヤーで伸ばす。ここには完了済みだけを置く。
  const completedSegments = result ? routeIds.length - 1 : questionIndex
  const visitedMapIds = useMemo(() => new Set(routeIds.map((countryId) => travelCountryById.get(countryId)?.mapId)), [routeIds])
  const finalBounds = useMemo(() => mergeBounds(routeIds.map((countryId, index) => targetBounds(countryId, routePoints[index], routeCoordinates[index][0]))), [routeCoordinates, routeIds, routePoints])

  useEffect(() => () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current) }, [])

  useEffect(() => {
    const activePoint = routePoints[Math.min(activeIndex, routePoints.length - 1)]
    const destination = result ? cameraForBounds(finalBounds, 0.82) : cameraForTargetCountry(activeId, activePoint, routeCoordinates[Math.min(activeIndex, routeCoordinates.length - 1)][0])
    const origin = previousCamera.current
    const plane = planeRef.current
    const camera = cameraRef.current
    if (!camera) return
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const travel = phase === 'traveling' && !result
    const from = travel ? routePoints[questionIndex] : null
    const to = travel ? routePoints[questionIndex + 1] : null
    const duration = from && to ? durationFor(from, to) : 800
    const setCamera = (value: Camera) => {
      camera.setAttribute('transform', transform(value))
      anchorRef.current?.setAttribute('transform', markerTransform(activePoint, value))
    }
    const setTravelProgress = (progress: number) => travelingRouteRef.current?.setAttribute('stroke-dashoffset', String(1 - progress))
    const finish = () => { previousCamera.current = destination; setCamera(destination); setTravelProgress(1); if (plane) plane.setAttribute('visibility', 'hidden'); if (travel) onTravelComplete() }
    if (reduced) { finish(); return }
    const started = performance.now()
    if (plane && from) plane.setAttribute('visibility', 'visible')
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration)
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2
      if (travel) setTravelProgress(eased)
      const baseScale = origin.scale + (destination.scale - origin.scale) * eased
      // 離れた国どうしは途中だけ少し引いて、地球をまたぐ移動を感じられるようにする。
      const distance = from && to ? Math.hypot(to[0] - from[0], to[1] - from[1]) : 0
      const zoomOut = travel ? Math.min(Math.max(0, baseScale - 1), distance / 700) * 4 * progress * (1 - progress) : 0
      const current = { scale: Math.max(1, baseScale - zoomOut), x: origin.x + (destination.x - origin.x) * eased, y: origin.y + (destination.y - origin.y) * eased }
      setCamera(current)
      if (plane && from && to) {
        const [x, y] = quadraticBezier(from, to, eased)
        const [nx, ny] = quadraticBezier(from, to, Math.min(1, eased + 0.015))
        const angle = Math.atan2(ny - y, nx - x) * 180 / Math.PI
        // camera の拡大を逆補正し、飛行機だけは読みやすい大きさを保つ。
        plane.setAttribute('transform', `translate(${x} ${y}) rotate(${angle}) scale(${1 / current.scale})`)
      }
      if (progress < 1) frameRef.current = requestAnimationFrame(tick)
      else finish()
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current) }
  }, [activeId, activeIndex, finalBounds, onTravelComplete, phase, questionIndex, result, routeCoordinates, routeIds, routePoints])

  return (
    <svg className={styles.map} viewBox="0 0 1000 560" role="img" aria-label={result ? '旅した国の地図' : '国をさがす世界地図'} preserveAspectRatio="xMidYMid meet">
      <rect width="1000" height="560" className={styles.ocean} />
      <g ref={cameraRef} transform={transform(initialCamera)}>
        {displayFeatures.map((item) => <path key={item.key} d={item.path} className={result && visitedMapIds.has(item.id) ? styles.visitedCountry : styles.country} fillRule="evenodd" />)}
        {!result && activeMapId !== undefined && <path d={pathForGeometryNear(featuresById.get(activeMapId)?.geometry ?? { type: 'Polygon', coordinates: [] }, displayLongitude)} className={styles.activeCountry} fillRule="evenodd" />}
        {Array.from({ length: completedSegments }, (_, index) => {
          const from = routePoints[index]; const to = routePoints[index + 1]
          return <path key={`${routeIds[index]}-${routeIds[index + 1]}`} d={bezierPath(from, to)} className={styles.route} aria-hidden="true" />
        })}
        {phase === 'traveling' && !result && <path ref={travelingRouteRef} d={bezierPath(routePoints[questionIndex], routePoints[questionIndex + 1])} className={styles.route} pathLength="1" strokeDasharray="1" strokeDashoffset="1" aria-hidden="true" />}
        {result && routeIds.map((countryId, index) => <circle key={countryId} className={styles.visitedDot} cx={routePoints[index][0]} cy={routePoints[index][1]} r="4.5" aria-hidden="true" />)}
        <g ref={planeRef} className={styles.plane} visibility="hidden" aria-hidden="true"><text x="-10" y="8">✈</text></g>
      </g>
      {!result && <g ref={anchorRef} className={styles.anchor} transform={markerTransform(routePoints[Math.min(activeIndex, routePoints.length - 1)], initialCamera)} aria-hidden="true"><circle r="6" /><circle r="2.5" /></g>}
    </svg>
  )
}
