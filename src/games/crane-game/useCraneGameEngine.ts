/**
 * クレーンゲームの実行係。
 * Three.jsの見た目（craneScene）とRapierの世界（craneWorld）を1つずつ持ち、
 * 固定の刻みで物理を進めて、結果だけをReactへ返す。
 * 画面コンポーネントは物理やWebGLの内部状態を直接触らない。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { initializeRapier } from '../../physics/rapierLoader'
import { BIN, type CraneMachine } from './craneMachines'
import {
  advanceRig,
  aimRig,
  clampRail,
  createRig,
  rigBusy,
  startGrab,
  stopRig,
  toggleAxis,
  type Rig,
  type RigAxis,
  type RigEvent,
  type RigPhase,
} from './craneRig'
import { createCraneScene, type CraneScene, type CraneView } from './craneScene'
import { createCraneWorld, type CraneEvent, type CraneWorld } from './craneWorld'

export type CraneStatus = 'loading' | 'ready' | 'error'
/** 効果音や案内のきっかけ。アームの動きと物理の結果をまとめて流す。 */
export type CraneAction = RigEvent | 'motor' | 'stop'
export type CraneFeedback = {
  phase: RigPhase
  axis: RigAxis | null
  holding: boolean
  ready: boolean
  remaining: number
  collected: number
}

type Options = {
  machine: CraneMachine
  /** 並べ直した回数。変わると景品を並べ直す。 */
  round: number
  view: CraneView
  reducedMotion: boolean
  onStatus: (status: CraneStatus) => void
  onFeedback: (feedback: CraneFeedback) => void
  onEvent: (event: CraneEvent) => void
  onAction: (action: CraneAction) => void
}

const STEP = 1 / 120
/** 1フレームで進める物理の上限。タブ復帰などで一気に進めないようにする。 */
const MAX_STEPS = 10

export function useCraneGameEngine(options: Options) {
  const [container, registerContainer] = useState<HTMLDivElement | null>(null)
  const [generation, setGeneration] = useState(0)
  const marker = useRef<SVGCircleElement | null>(null)
  const latest = useRef(options)
  const runtime = useRef<{ scene: CraneScene; world: CraneWorld | null; rig: Rig } | null>(null)
  useEffect(() => { latest.current = options }, [options])

  const retry = useCallback(() => setGeneration(value => value + 1), [])
  const registerMapMarker = useCallback((element: SVGCircleElement | null) => { marker.current = element }, [])
  const move = useCallback((axis: RigAxis) => {
    const rt = runtime.current
    if (!rt || rigBusy(rt.rig)) return
    toggleAxis(rt.rig, axis)
    latest.current.onAction(rt.rig.axis ? 'motor' : 'stop')
  }, [])
  const grab = useCallback(() => {
    const rt = runtime.current
    if (!rt?.world?.ready) return
    if (startGrab(rt.rig)) latest.current.onAction('motor')
  }, [])
  useEffect(() => {
    const rt = runtime.current
    // 機械に入ったときの並べ（round=0）は world の生成時にすませている。
    if (rt?.world && options.round > 0) {
      stopRig(rt.rig)
      rt.world.refill(options.round)
    }
  }, [options.round])

  useEffect(() => {
    const rt = runtime.current
    rt?.scene.setView(options.view)
  }, [options.view])

  useEffect(() => {
    if (!container) return
    const host = container
    const machine = latest.current.machine
    let scene: CraneScene | undefined
    let world: CraneWorld | undefined
    let released = false
    let lost = false
    let frame = 0
    let previous = 0
    let lastDraw = 0
    let accumulator = 0
    let publishClock = 0
    const rig = createRig()
    let blocked = false

    function publish() {
      if (!world) return
      const feedback: CraneFeedback = {
        phase: rig.phase,
        axis: rig.axis,
        holding: world.holding !== null,
        ready: world.ready,
        remaining: world.remaining,
        collected: world.collected,
      }
      latest.current.onFeedback(feedback)
      host.dataset.phase = feedback.phase
      host.dataset.ready = String(feedback.ready)
      host.dataset.holding = String(feedback.holding)
      host.dataset.remaining = String(feedback.remaining)
      host.dataset.collected = String(feedback.collected)
      host.dataset.clawX = rig.x.toFixed(3)
      host.dataset.clawY = rig.y.toFixed(3)
      host.dataset.clawZ = rig.z.toFixed(3)
      // 上から見た地図の印。Reactの再描画を挟まずに動かす。
      if (marker.current) {
        marker.current.setAttribute('cx', ((rig.x / BIN.x) * 20).toFixed(2))
        marker.current.setAttribute('cy', ((rig.z / BIN.z) * 14).toFixed(2))
      }
      if (scene) {
        const stats = scene.stats()
        host.dataset.view = scene.view
        host.dataset.drawCalls = String(stats.calls)
        host.dataset.triangles = String(stats.triangles)
      }
    }

    function animate(now: number) {
      frame = requestAnimationFrame(animate)
      if (!scene || !world) return
      const dt = previous ? Math.min((now - previous) / 1000, 0.1) : 0
      previous = now
      if (document.hidden) { accumulator = 0; return }
      accumulator += dt
      let steps = 0
      while (accumulator >= STEP && steps < MAX_STEPS) {
        const rigEvents = advanceRig(rig, STEP, { blocked })
        for (const event of rigEvents) latest.current.onAction(event)
        world.step(rig, rigEvents)
        blocked = world.blockedByPrize
        accumulator -= STEP
        steps++
      }
      if (steps === MAX_STEPS) accumulator = 0
      for (const event of world.consumeEvents()) {
        if (event.kind === 'caught') scene.burst(event.position, 22)
        if (event.kind === 'slip') scene.dust(event.position, 1)
        if (event.kind === 'bump') scene.dust(event.position, event.strength)
        latest.current.onEvent(event)
      }
      const pose = world.clawPose()
      scene.syncClaw(pose.position, pose.fingers, rig.phase === 'idle')
      scene.syncPrizes(world.prizes())
      if (now - lastDraw >= 1000 / 50) {
        scene.render(dt, latest.current.reducedMotion)
        lastDraw = now
      }
      publishClock += dt
      if (publishClock > 0.1) { publish(); publishClock = 0 }
    }

    function resize() { scene?.resize() }
    function visibility() {
      cancelAnimationFrame(frame)
      previous = 0
      accumulator = 0
      if (!document.hidden && !lost && !released) frame = requestAnimationFrame(animate)
    }
    function contextLost(event: Event) {
      event.preventDefault()
      lost = true
      cancelAnimationFrame(frame)
      latest.current.onStatus('error')
    }
    function contextRestored() { if (!released) setGeneration(value => value + 1) }

    let press: { x: number; y: number; time: number; id: number } | null = null
    function pointerDown(event: PointerEvent) {
      if (event.button !== 0) return
      press = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId }
    }
    function pointerUp(event: PointerEvent) {
      const start = press
      press = null
      if (!start || start.id !== event.pointerId || !scene) return
      // 軽いタップだけを行き先の指定として扱う。なぞった操作は無視する。
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 14) return
      if (performance.now() - start.time > 600) return
      if (rigBusy(rig)) return
      const point = scene.pick(event.clientX, event.clientY)
      if (!point) return
      const clamped = clampRail(point.x, point.z)
      aimRig(rig, clamped.x, clamped.z)
      latest.current.onAction('motor')
      publish()
    }

    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize)
    latest.current.onStatus('loading')
    try {
      scene = createCraneScene(host, machine)
      scene.setView(latest.current.view)
      scene.renderer.domElement.addEventListener('webglcontextlost', contextLost)
      scene.renderer.domElement.addEventListener('webglcontextrestored', contextRestored)
      scene.renderer.domElement.addEventListener('pointerdown', pointerDown)
    } catch {
      queueMicrotask(() => { if (!released) latest.current.onStatus('error') })
      return () => { released = true }
    }
    window.addEventListener('pointerup', pointerUp)
    window.addEventListener('pointercancel', pointerUp)
    window.addEventListener('resize', resize)
    observer?.observe(host)
    document.addEventListener('visibilitychange', visibility)
    runtime.current = { scene, world: null, rig }
    initializeRapier().then(() => {
      if (released || !scene) return
      world = createCraneWorld(machine, latest.current.round)
      runtime.current = { scene, world, rig }
      publish()
      latest.current.onStatus(lost ? 'error' : 'ready')
      frame = requestAnimationFrame(animate)
    }).catch(() => { if (!released) latest.current.onStatus('error') })

    return () => {
      released = true
      cancelAnimationFrame(frame)
      observer?.disconnect()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pointerup', pointerUp)
      window.removeEventListener('pointercancel', pointerUp)
      window.removeEventListener('resize', resize)
      scene?.renderer.domElement.removeEventListener('webglcontextlost', contextLost)
      scene?.renderer.domElement.removeEventListener('webglcontextrestored', contextRestored)
      scene?.renderer.domElement.removeEventListener('pointerdown', pointerDown)
      world?.dispose()
      scene?.dispose()
      runtime.current = null
    }
  }, [container, generation, options.machine.id])

  return { registerContainer, registerMapMarker, retry, move, grab }
}
