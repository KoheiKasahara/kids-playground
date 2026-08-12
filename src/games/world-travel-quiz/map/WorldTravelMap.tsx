import { useEffect, useMemo, useRef } from 'react'
import { travelCountryById } from '../data/travelCountries'
import { worldFeatures } from '../data/worldFeatures'
import type { TravelCourse, TravelPhase } from '../types'
import { bezierPath, boundsForGeometry, cameraForBounds, mergeBounds, pathForGeometry, primaryBounds, project, quadraticBezier, type Bounds, type Camera, type Position } from './geometry'
import styles from './WorldTravelMap.module.css'

type Props = { course: TravelCourse; questionIndex: number; phase: TravelPhase; onTravelComplete: () => void; result?: boolean }
type CachedFeature = { id: number; path: string; bounds: Bounds; primary: Bounds }

const cachedFeatures: readonly CachedFeature[] = worldFeatures.map((item) => ({ id: item.id, path: pathForGeometry(item.geometry), bounds: boundsForGeometry(item.geometry), primary: primaryBounds(item.geometry) }))
const featuresById = new Map(cachedFeatures.map((item) => [item.id, item]))
const worldCamera: Camera = { scale: 1, x: 0, y: 0 }
const durationFor = (from: Position, to: Position) => Math.max(800, Math.min(1200, 800 + Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.55))
const transform = (camera: Camera) => `translate(${camera.x.toFixed(2)} ${camera.y.toFixed(2)}) scale(${camera.scale.toFixed(3)})`

function targetBounds(countryId: string): Bounds {
  const country = travelCountryById.get(countryId)
  if (!country) return { minX: 480, minY: 260, maxX: 520, maxY: 300 }
  const item = featuresById.get(country.mapId)
  if (!item) { const [x, y] = project(country.anchor); return { minX: x - 10, minY: y - 10, maxX: x + 10, maxY: y + 10 } }
  return country.fitMode === 'all' ? item.bounds : item.primary
}

function countryPoint(countryId: string): Position {
  const country = travelCountryById.get(countryId)
  return project(country?.anchor ?? [0, 0])
}

/** 同一 SVG を保ったまま camera g の transform だけを更新する世界地図。 */
export default function WorldTravelMap({ course, questionIndex, phase, onTravelComplete, result = false }: Props) {
  const cameraRef = useRef<SVGGElement>(null)
  const planeRef = useRef<SVGGElement>(null)
  const travelingRouteRef = useRef<SVGPathElement>(null)
  const frameRef = useRef<number | null>(null)
  const previousCamera = useRef<Camera>(worldCamera)
  const routeIds = course.countryIds
  const activeIndex = result ? routeIds.length - 1 : phase === 'traveling' ? questionIndex + 1 : questionIndex
  const activeId = routeIds[Math.min(activeIndex, routeIds.length - 1)]
  const activeMapId = travelCountryById.get(activeId)?.mapId
  // 移動中の区間は別レイヤーで伸ばす。ここには完了済みだけを置く。
  const completedSegments = result ? routeIds.length - 1 : questionIndex
  const visitedMapIds = useMemo(() => new Set(routeIds.map((countryId) => travelCountryById.get(countryId)?.mapId)), [routeIds])
  const finalBounds = useMemo(() => mergeBounds(routeIds.map(targetBounds)), [routeIds])

  useEffect(() => () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current) }, [])

  useEffect(() => {
    const destination = result ? cameraForBounds(finalBounds, 0.82) : cameraForBounds(targetBounds(activeId))
    const origin = previousCamera.current
    const plane = planeRef.current
    const camera = cameraRef.current
    if (!camera) return
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const travel = phase === 'traveling' && !result
    const from = travel ? countryPoint(routeIds[questionIndex]) : null
    const to = travel ? countryPoint(routeIds[questionIndex + 1]) : null
    const duration = from && to ? durationFor(from, to) : 800
    const setCamera = (value: Camera) => camera.setAttribute('transform', transform(value))
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
  }, [activeId, finalBounds, onTravelComplete, phase, questionIndex, result, routeIds])

  return (
    <svg className={styles.map} viewBox="0 0 1000 560" role="img" aria-label={result ? '旅した国の地図' : '国をさがす世界地図'} preserveAspectRatio="xMidYMid meet">
      <rect width="1000" height="560" className={styles.ocean} />
      <g ref={cameraRef} transform={transform(worldCamera)}>
        {cachedFeatures.map((item) => <path key={item.id} d={item.path} className={result && visitedMapIds.has(item.id) ? styles.visitedCountry : styles.country} fillRule="evenodd" />)}
        {!result && activeMapId !== undefined && <path d={featuresById.get(activeMapId)?.path} className={styles.activeCountry} fillRule="evenodd" />}
        {Array.from({ length: completedSegments }, (_, index) => {
          const from = countryPoint(routeIds[index]); const to = countryPoint(routeIds[index + 1])
          return <path key={`${routeIds[index]}-${routeIds[index + 1]}`} d={bezierPath(from, to)} className={styles.route} aria-hidden="true" />
        })}
        {phase === 'traveling' && !result && <path ref={travelingRouteRef} d={bezierPath(countryPoint(routeIds[questionIndex]), countryPoint(routeIds[questionIndex + 1]))} className={styles.route} pathLength="1" strokeDasharray="1" strokeDashoffset="1" aria-hidden="true" />}
        {!result && <g className={styles.anchor} transform={`translate(${countryPoint(activeId).join(' ')})`} aria-hidden="true"><circle r="13" /><circle r="6" /></g>}
        {result && routeIds.map((countryId) => <circle key={countryId} className={styles.visitedDot} cx={countryPoint(countryId)[0]} cy={countryPoint(countryId)[1]} r="4.5" aria-hidden="true" />)}
        <g ref={planeRef} className={styles.plane} visibility="hidden" aria-hidden="true"><text x="-10" y="8">✈</text></g>
      </g>
    </svg>
  )
}
