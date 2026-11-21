import { useCallback, useEffect, useRef, useState } from 'react'
import { primeAudio } from '../../audio/sound'
import { observeGameActivity } from '../../utils/gameActivity'
import { vibrate } from '../../utils/haptics'
import { createStageProgressStore } from '../shared/progress/stageProgress'
import { charts, type Chart, type Point } from './charts'
import { createSeaView, selectPirateAt } from './seaView'
import { fleetSound } from './sounds'
import { cycleTarget, fireWater, newVoyage, reloadTime, steerToward, tickVoyage, voyageStars, type Voyage } from './voyage'

const portLog = createStageProgressStore('sea-breeze-fleet-stars-v1', id => charts.some(chart => chart.id === id))
function readGauges(v: Voyage) {
  return { chart: v.chart, phase: v.phase, hull: v.player.hp, mail: v.mail?.hp, total: v.pirates.length,
    cleared: v.pirates.filter(s => !s.hp).length, target: v.target + 1, closingIn: v.closingIn,
    charge: Math.round(5 * (1 - v.player.reload / reloadTime)), stars: voyageStars(v) }
}

export function useFleet() {
  const [initial] = useState(() => newVoyage(charts[0]))
  const voyage = useRef(initial)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const keys = useRef(new Set<string>())
  const [hud, setHud] = useState(() => readGauges(initial))
  const lastHud = useRef(hud)
  const [records, setRecords] = useState(portLog.read)
  const [paused, setPaused] = useState(false)
  const time = useRef(0)
  const draw = useRef<ReturnType<typeof createSeaView> | undefined>(undefined)

  const sync = useCallback(() => {
    const next = readGauges(voyage.current)
    const prev = lastHud.current
    if ((Object.keys(next) as (keyof typeof next)[]).some(k => next[k] !== prev[k])) {
      lastHud.current = next
      setHud(next)
    }
  }, [])

  useEffect(() => {
    if (!canvasRef.current) return
    draw.current = createSeaView(canvasRef.current)
    return () => { draw.current = undefined }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let raf = 0
    let previous: number | undefined
    const paint = () => draw.current?.(voyage.current, reduced ? 0 : time.current)
    const animate = (now: number) => {
      const elapsed = previous === undefined ? 0 : now - previous
      if (previous === undefined || elapsed >= 1000 / 40) {
        previous = now
        const dt = Math.min(0.08, elapsed / 1000)
        time.current += dt
        const held = keys.current
        const v = voyage.current
        if (v.phase === 'sailing') {
          const cues = tickVoyage(v, {
            dx: Number(held.has('ArrowRight')) - Number(held.has('ArrowLeft')),
            dy: Number(held.has('ArrowDown')) - Number(held.has('ArrowUp')),
            firing: held.has(' ') || held.has('spray'),
          }, dt)
          for (const cue of cues) {
            fleetSound(cue)
            if (cue === 'bump') vibrate('impact')
            if (cue === 'clear') {
              vibrate('celebrate')
              setRecords(portLog.record(v.chart.id, voyageStars(v)))
            }
          }
          sync()
        }
        paint()
      }
      raf = requestAnimationFrame(animate)
    }
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(paint)
    observer?.observe(canvas)
    window.addEventListener('resize', paint)
    const stop = observeGameActivity(active => {
      cancelAnimationFrame(raf)
      previous = undefined
      keys.current.clear()
      if (active) {
        paint()
        if (!paused && (hud.phase === 'sailing' || (hud.phase === 'ready' && !reduced))) raf = requestAnimationFrame(animate)
      }
    })
    return () => {
      stop()
      cancelAnimationFrame(raf)
      observer?.disconnect()
      window.removeEventListener('resize', paint)
    }
  }, [hud.chart, hud.phase, paused, sync])

  function enter(chart: Chart, sailing = false) {
    voyage.current = newVoyage(chart)
    if (sailing) {
      primeAudio()
      voyage.current.phase = 'sailing'
      fleetSound('start')
      vibrate('tap')
    }
    time.current = 0
    keys.current.clear()
    setPaused(false)
    sync()
  }
  function fire() {
    if (!paused && fireWater(voyage.current)) {
      fleetSound('water')
      vibrate('tap')
      sync()
    }
  }
  function chooseTarget() {
    if (paused) return
    cycleTarget(voyage.current)
    sync()
  }
  function chartTap(point: Point) {
    const v = voyage.current, canvas = canvasRef.current
    if (!canvas || paused || v.phase !== 'sailing') return
    const index = selectPirateAt(v, point, canvas.width, canvas.height)
    if (index < 0) steerToward(v, point)
    else {
      v.target = index
      fire()
      sync()
    }
  }
  function hold(key: string, down: boolean) {
    if (!down) keys.current.delete(key)
    else if (!paused && voyage.current.phase === 'sailing') keys.current.add(key)
  }
  return { hud, records, canvasRef, paused, setPaused, enter, hold, fire, chooseTarget, chartTap,
    release: () => {
      for (const key of keys.current) if (key !== 'spray') keys.current.delete(key)
    } }
}
