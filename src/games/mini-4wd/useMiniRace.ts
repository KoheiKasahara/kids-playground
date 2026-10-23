import { useEffect, useRef, useState } from 'react'
import { CHEER_COOLDOWN_SECONDS, cheerRace, createRace, getRank, stepRace } from './race'
import { drawRace } from './render'
import { playMiniSound } from './sounds'
import type { Build, Course } from './types'

export function useMiniRace(course: Course, build: Build, paused: boolean) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const raceRef = useRef<ReturnType<typeof createRace> | null>(null)
  const pausedRef = useRef(paused)
  const cheerRef = useRef<() => boolean>(() => false)
  const [hud, setHud] = useState({ countdown: 3, lap: 1, rank: 3, time: 0, finished: false, message: 'まもなく スタート！', progress: 0, boosting: false, charge: 1 })
  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => {
    const race = createRace(course, build)
    raceRef.current = race
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let frame = 0, previous = 0, lastHud = 0, count = 4, message = 'まもなく スタート！', messageUntil = 0, forceHud = false
    const tick = (now: number) => {
      const dt = previous ? Math.min((now - previous) / 1000, .05) : 0
      previous = now
      if (!pausedRef.current) {
        stepRace(race, dt)
        const nextCount = Math.ceil(race.countdown)
        if (nextCount > 0 && nextCount !== count) playMiniSound('countdown')
        count = nextCount
        for (const event of race.events) {
          if (event.racer !== 0) continue
          playMiniSound(event.kind)
          message = event.kind === 'go' ? 'いけー！' : event.kind === 'lap' ? 'いいぞ！ そのちょうし！' : event.kind === 'bump' ? 'おっとっと！ すぐに はしるよ' : 'ゴール！ よく はしったね！'
          messageUntil = race.elapsed + 2
        }
      }
      if (canvasRef.current) drawRace(canvasRef.current, race, { reducedMotion })
      if (now - lastHud > 80 || race.phase === 'finished' || forceHud) {
        forceHud = false
        const me = race.racers[0]
        setHud({ countdown: Math.ceil(race.countdown), lap: Math.min(race.lapCount, Math.floor(me.distance / course.length) + 1), rank: getRank(race), time: me.finishTime ?? race.elapsed, finished: race.phase === 'finished', message: race.elapsed < messageUntil || race.phase !== 'racing' ? message : 'きみの マシンは「★」だよ', progress: Math.min(1, me.distance / (course.length * race.lapCount)), boosting: me.boost > 0 && race.phase === 'racing', charge: 1 - race.cheerCooldown / CHEER_COOLDOWN_SECONDS })
        lastHud = now
      }
      if (race.phase !== 'finished') frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    cheerRef.current = () => {
      if (pausedRef.current || !cheerRace(race)) return false
      message = 'ぐぐーんと パワーアップ！'
      messageUntil = race.elapsed + 1.5
      forceHud = true
      return true
    }
    return () => { cancelAnimationFrame(frame); raceRef.current = null; cheerRef.current = () => false }
  }, [course, build])
  return { canvasRef, hud, cheer: () => cheerRef.current() }
}
