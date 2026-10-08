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
import { clampZoom } from './craneZoom'
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
  /** カメラの寄り具合。1でぜんたい。 */
  zoom: number
  reducedMotion: boolean
  onStatus: (status: CraneStatus) => void
  onFeedback: (feedback: CraneFeedback) => void
  onEvent: (event: CraneEvent) => void
  onAction: (action: CraneAction) => void
  /** ピンチやホイールで寄り具合が変わったとき。 */
  onZoom: (zoom: number) => void
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
    const rt = runtime.current
    rt?.scene.setZoom(options.zoom)
  }, [options.zoom])

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
    // TEMPORARY DIAGNOSTIC BRANCH ONLY. Counters observe the unchanged native loop.
    const diagnostic = {
      machine: machine.id, created: performance.now(), disposed: 0, disposeMs: 0, sceneInitMs: 0, readyAt: 0, webglRenderer: '', hiddenFrames: 0,
      firstRaf: 0, lastRaf: 0, rafCount: 0, intervals: [] as number[],
      wallAdvanceMs: 0, simulatedMs: 0, clampedMs: 0, discardedMs: 0,
      physicsMs: 0, syncMs: 0, renderMs: 0, publishMs: 0, frameCallbackMs: 0,
      maxPhysicsMs: 0, maxRenderMs: 0, renders: 0, steps: 0, renderedViews: { front: 0, side: 0 },
      phases: [] as { phase: string; at: number; simulatedMs: number }[],
    }
    const diagnosticWindow = window as typeof window & { __craneNativeDiagnostics?: (typeof diagnostic)[] }
    ;(diagnosticWindow.__craneNativeDiagnostics ??= []).push(diagnostic)

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
      if (feedback.ready && !diagnostic.readyAt) diagnostic.readyAt = performance.now()
      if (diagnostic.phases.at(-1)?.phase !== rig.phase) {
        diagnostic.phases.push({ phase: rig.phase, at: performance.now(), simulatedMs: diagnostic.simulatedMs })
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
      const frameStart = performance.now()
      diagnostic.firstRaf ||= now
      diagnostic.lastRaf = now
      diagnostic.rafCount++
      if (previous) {
        const interval = now - previous
        diagnostic.intervals.push(interval)
        diagnostic.wallAdvanceMs += interval
        diagnostic.clampedMs += Math.max(0, interval - 100)
      }
      const dt = previous ? Math.min((now - previous) / 1000, 0.1) : 0
      previous = now
      if (document.hidden) { diagnostic.hiddenFrames++; accumulator = 0; return }
      accumulator += dt
      let steps = 0
      const physicsStart = performance.now()
      while (accumulator >= STEP && steps < MAX_STEPS) {
        const rigEvents = advanceRig(rig, STEP, { blocked })
        for (const event of rigEvents) latest.current.onAction(event)
        world.step(rig, rigEvents)
        blocked = world.blockedByPrize
        accumulator -= STEP
        steps++
      }
      const physicsMs = performance.now() - physicsStart
      diagnostic.physicsMs += physicsMs
      diagnostic.maxPhysicsMs = Math.max(diagnostic.maxPhysicsMs, physicsMs)
      diagnostic.steps += steps
      diagnostic.simulatedMs += steps * STEP * 1000
      if (steps === MAX_STEPS) { diagnostic.discardedMs += accumulator * 1000; accumulator = 0 }
      const syncStart = performance.now()
      for (const event of world.consumeEvents()) {
        if (event.kind === 'caught') scene.burst(event.position, 22)
        if (event.kind === 'slip') scene.dust(event.position, 1)
        if (event.kind === 'bump') scene.dust(event.position, event.strength)
        latest.current.onEvent(event)
      }
      const pose = world.clawPose()
      scene.syncClaw(pose.position, pose.fingers, rig.phase === 'idle')
      scene.syncPrizes(world.prizes())
      diagnostic.syncMs += performance.now() - syncStart
      if (now - lastDraw >= 1000 / 50) {
        const renderStart = performance.now()
        scene.render(dt, latest.current.reducedMotion)
        const renderMs = performance.now() - renderStart
        diagnostic.renderMs += renderMs
        diagnostic.maxRenderMs = Math.max(diagnostic.maxRenderMs, renderMs)
        diagnostic.renders++
        diagnostic.renderedViews[scene.view]++
        lastDraw = now
      }
      publishClock += dt
      if (publishClock > 0.1) {
        const publishStart = performance.now()
        publish(); publishClock = 0
        diagnostic.publishMs += performance.now() - publishStart
      }
      diagnostic.frameCallbackMs += performance.now() - frameStart
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
    // 画面に触れている指。2本になったらピンチで寄り具合を変える。
    const touches = new Map<number, { x: number; y: number }>()
    let pinch: { distance: number; zoom: number } | null = null
    function spread() {
      const [a, b] = [...touches.values()]
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
    }
    function zoomTo(next: number) {
      if (!scene) return
      scene.setZoom(clampZoom(next))
      latest.current.onZoom(scene.zoom)
    }
    function pointerDown(event: PointerEvent) {
      if (event.button !== 0) return
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touches.size === 2 && scene) {
        // 2本目の指が来たら、タップではなくピンチとして扱う。
        press = null
        pinch = { distance: spread(), zoom: scene.zoom }
        return
      }
      if (touches.size > 2) return
      press = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId }
    }
    function pointerMove(event: PointerEvent) {
      if (!touches.has(event.pointerId)) return
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pinch && touches.size === 2 && pinch.distance > 0) zoomTo(pinch.zoom * (spread() / pinch.distance))
    }
    function wheel(event: WheelEvent) {
      if (!scene) return
      event.preventDefault()
      zoomTo(scene.zoom * Math.exp(-event.deltaY * 0.0015))
    }
    function pointerUp(event: PointerEvent) {
      touches.delete(event.pointerId)
      if (touches.size < 2) pinch = null
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
      const sceneStart = performance.now()
      scene = createCraneScene(host, machine)
      diagnostic.sceneInitMs = performance.now() - sceneStart
      const gl = scene.renderer.getContext()
      const debugRenderer = gl.getExtension('WEBGL_debug_renderer_info')
      diagnostic.webglRenderer = String(gl.getParameter(debugRenderer?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER))
      scene.setView(latest.current.view)
      scene.setZoom(latest.current.zoom)
      scene.renderer.domElement.addEventListener('webglcontextlost', contextLost)
      scene.renderer.domElement.addEventListener('webglcontextrestored', contextRestored)
      scene.renderer.domElement.addEventListener('pointerdown', pointerDown)
      scene.renderer.domElement.addEventListener('pointermove', pointerMove)
      scene.renderer.domElement.addEventListener('wheel', wheel, { passive: false })
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
      diagnostic.disposed = performance.now()
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
      scene?.renderer.domElement.removeEventListener('pointermove', pointerMove)
      scene?.renderer.domElement.removeEventListener('wheel', wheel)
      world?.dispose()
      scene?.dispose()
      diagnostic.disposeMs = performance.now() - diagnostic.disposed
      runtime.current = null
    }
  }, [container, generation, options.machine.id])

  return { registerContainer, registerMapMarker, retry, move, grab }
}
