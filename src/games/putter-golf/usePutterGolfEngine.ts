/**
 * パターゴルフの実行係。
 * Three.js の見た目（golfScene）と Rapier の世界（golfWorld）を1つずつ持ち、
 * 固定の刻みで物理を進めて、結果だけを React へ返す。画面コンポーネントは物理やWebGLの内部状態を触らない。
 *
 * 操作は2とおり。画面をひっぱって はなす（パチンコのように、引いた向きと反対へ飛ぶ）か、
 * ボタンで向きと強さを決めて「うつ！」。タップした場所をねらうこともできる。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { initializeRapier } from '../../physics/rapierLoader'
import { aimPose, followPose, lerpPose, overviewPose, type CameraPose } from './golfCamera'
import type { CourseDefinition, GolfBallId, Vec2 } from './golfCourses'
import { buildHoleGeometry, type HoleGeometry } from './golfGeometry'
import { BALL_RADIUS, BIG_CUP_RADIUS, CUP_RADIUS, MAX_STEPS_PER_FRAME, PHYSICS_STEP, powerForDistance, rollingDecel } from './golfPhysics'
import { createGolfScene, type GolfScene } from './golfScene'
import { createGolfWorld, type GolfEvent, type GolfPhase, type GolfWorld } from './golfWorld'

export type GolfStatus = 'loading' | 'ready' | 'error'
export type GolfCamera = 'ball' | 'overview'
export type EngineEvent = GolfEvent | { kind: 'returned' } | { kind: 'assisted' } | { kind: 'hint' } | { kind: 'aimed' }
export type GolfFeedback = { phase: GolfPhase; strokes: number; power: number; aiming: boolean; returning: boolean }

type Options = {
  course: CourseDefinition
  holeIndex: number
  /** 同じホールを「やりなおす」たびに増える。 */
  attempt: number
  ballStyle: GolfBallId
  bigCup: boolean
  camera: GolfCamera
  /** false の間（コース選び）は操作を受け付けず、ホール全体を見せる。 */
  active: boolean
  reducedMotion: boolean
  onStatus: (status: GolfStatus) => void
  onFeedback: (feedback: GolfFeedback) => void
  onEvent: (event: EngineEvent) => void
}

type Runtime = {
  loadHole: () => void
  beginPlay: () => void
  setBallStyle: (id: GolfBallId) => void
  shoot: () => void
  turn: (side: number) => void
  setPower: (power: number) => void
  hint: () => void
  assist: () => void
}

/** これより小さいドラッグは、ねらいを変えないタップとして扱う。 */
export const DRAG_DEAD_ZONE = 14
const INTRO_SECONDS = 1.8
const TURN_STEP = (5 * Math.PI) / 180

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const ease = (t: number) => t * t * (3 - 2 * t)

/** ひっぱった量（画面のpx）→ うつ向きと強さ。カメラの向きを基準にして、引いた向きの反対へ飛ばす。 */
export function aimFromDrag(dx: number, dy: number, forward: Vec2, fullPower: number): { direction: Vec2; power: number } | null {
  const distance = Math.hypot(dx, dy)
  if (distance < DRAG_DEAD_ZONE) return null
  const length = Math.hypot(forward.x, forward.z) || 1
  const f = { x: forward.x / length, z: forward.z / length }
  const right = { x: -f.z, z: f.x }
  const shot = { x: f.x * dy - right.x * dx, z: f.z * dy - right.z * dx }
  const shotLength = Math.hypot(shot.x, shot.z) || 1
  return { direction: { x: shot.x / shotLength, z: shot.z / shotLength }, power: clamp((distance - DRAG_DEAD_ZONE) / Math.max(1, fullPower - DRAG_DEAD_ZONE), 0.05, 1) }
}

export function usePutterGolfEngine(options: Options) {
  const [container, registerContainer] = useState<HTMLDivElement | null>(null)
  const [generation, setGeneration] = useState(0)
  const latest = useRef(options)
  const marker = useRef<SVGCircleElement | null>(null)
  const runtime = useRef<Runtime | null>(null)
  useEffect(() => { latest.current = options }, [options])

  const retry = useCallback(() => setGeneration(value => value + 1), [])
  const registerMapMarker = useCallback((element: SVGCircleElement | null) => { marker.current = element }, [])
  const shoot = useCallback(() => runtime.current?.shoot(), [])
  const turn = useCallback((side: number) => runtime.current?.turn(side), [])
  const setPower = useCallback((power: number) => runtime.current?.setPower(power), [])
  const hint = useCallback(() => runtime.current?.hint(), [])
  const assist = useCallback(() => runtime.current?.assist(), [])

  const holeKey = `${options.course.id}:${options.holeIndex}:${options.attempt}:${options.bigCup}`
  useEffect(() => { runtime.current?.loadHole() }, [holeKey])
  useEffect(() => { runtime.current?.setBallStyle(options.ballStyle) }, [options.ballStyle])
  useEffect(() => { if (options.active) runtime.current?.beginPlay() }, [options.active])

  useEffect(() => {
    if (!container) return
    const host = container
    let scene: GolfScene | undefined
    let world: GolfWorld | undefined
    let geometry: HoleGeometry | undefined
    let released = false
    let lost = false
    let frame = 0
    let previous = 0
    let accumulator = 0
    let publishClock = 0
    let direction: Vec2 = { x: 0, z: -1 }
    let heading: Vec2 = { x: 0, z: -1 }
    let power = 0.5
    let strokes = 0
    let introTime = 0
    let returnTimer = 0
    let hintTarget: Vec2 | null = null
    let pose: CameraPose | null = null
    let aimKey = ''
    let lastFeedback = ''
    let drag: { id: number; x: number; y: number; time: number; moved: boolean; forward: Vec2; saved: { direction: Vec2; power: number } } | null = null

    function publish() {
      if (!world) return
      const feedback: GolfFeedback = { phase: world.phase, strokes, power: Math.round(power * 100) / 100, aiming: drag?.moved ?? false, returning: returnTimer > 0 }
      const key = JSON.stringify(feedback)
      if (key !== lastFeedback) { lastFeedback = key; latest.current.onFeedback(feedback) }
      const ball = world.ball().position
      host.dataset.phase = feedback.phase
      host.dataset.strokes = String(strokes)
      host.dataset.power = power.toFixed(2)
      host.dataset.ballX = ball.x.toFixed(2)
      host.dataset.ballZ = ball.z.toFixed(2)
      host.dataset.camera = latest.current.active ? latest.current.camera : 'overview'
      marker.current?.setAttribute('cx', ball.x.toFixed(2))
      marker.current?.setAttribute('cy', ball.z.toFixed(2))
      if (scene) {
        const stats = scene.stats()
        host.dataset.drawCalls = String(stats.calls)
        host.dataset.triangles = String(stats.triangles)
      }
    }

    function aimAtSuggestion() {
      if (!world) return
      direction = world.suggestShot().direction
      aimKey = ''
    }

    function loadHole() {
      if (!scene) return
      const { course, holeIndex, bigCup } = latest.current
      const hole = course.holes[holeIndex] ?? course.holes[0]!
      world?.dispose()
      world = undefined
      geometry = buildHoleGeometry(hole, bigCup ? BIG_CUP_RADIUS : CUP_RADIUS)
      world = createGolfWorld(course, hole, geometry)
      scene.setHole(course, hole, geometry, holeIndex + 1)
      strokes = 0
      returnTimer = 0
      hintTarget = null
      accumulator = 0
      drag = null
      aimAtSuggestion()
      heading = direction
      introTime = latest.current.active && !latest.current.reducedMotion ? INTRO_SECONDS : 0
      pose = null
      host.dataset.hole = hole.id
      publish()
    }

    function shootNow() {
      if (!world || !latest.current.active) return
      if (world.shoot(direction, power)) { hintTarget = null; introTime = 0 }
    }

    function handleEvents() {
      if (!world || !scene || !geometry) return
      const events = world.consumeEvents()
      for (const event of events) {
        if (event.kind === 'shot') { strokes++; scene.swingClub(); heading = direction }
        if (event.kind === 'bumper') { scene.pulseBumper(event.id); scene.effect('sparkle', event.position) }
        if (event.kind === 'critter') scene.effect('sparkle', event.position)
        if (event.kind === 'boost') scene.effect('sparkle', event.position)
        if (event.kind === 'surface') scene.effect(event.surface === 'ice' ? 'sparkle' : 'dust', event.position, 0.7)
        if (event.kind === 'warp') {
          scene.effect('ring', event.position)
          scene.effect('sparkle', event.to)
          // 出口へは カメラを すぐ移す。ゆっくり追うと コースの上を 長く流れてしまう。
          const velocity = world.ball().velocity
          const speed = Math.hypot(velocity.x, velocity.z)
          if (speed > 0.1) heading = { x: velocity.x / speed, z: velocity.z / speed }
          pose = null
        }
        if (event.kind === 'land') scene.effect('dust', event.position, event.strength)
        if (event.kind === 'splash') { scene.effect('splash', event.position); returnTimer = 1.2 }
        if (event.kind === 'lost') returnTimer = 0.6
        if (event.kind === 'cup') scene.effect(strokes === 1 ? 'fireworks' : 'confetti', geometry.cup)
        if (event.kind === 'rest') aimAtSuggestion()
        latest.current.onEvent(event)
      }
      // うった・止まった・入ったは、ボタンの有効・無効にすぐ効くよう待たずに知らせる。
      if (events.length) publish()
    }

    function desiredPose(): CameraPose | null {
      if (!scene || !world || !geometry) return null
      const aspect = scene.aspect
      const overview = overviewPose(geometry.bounds, aspect)
      if (!latest.current.active || latest.current.camera === 'overview') return overview
      const ball = world.ball().position
      const target = world.phase === 'rolling' || world.phase === 'out' ? followPose(ball, heading, aspect) : aimPose(ball, direction, aspect)
      return introTime > 0 ? lerpPose(overview, target, ease(1 - introTime / INTRO_SECONDS)) : target
    }

    function animate(now: number) {
      frame = requestAnimationFrame(animate)
      if (!scene) return
      const dt = previous ? Math.min((now - previous) / 1000, 0.1) : 0
      previous = now
      if (document.hidden) { accumulator = 0; return }
      const current = latest.current
      if (world && geometry) {
        accumulator += dt
        let steps = 0
        while (accumulator >= PHYSICS_STEP && steps < MAX_STEPS_PER_FRAME) { world.step(); accumulator -= PHYSICS_STEP; steps++ }
        if (steps === MAX_STEPS_PER_FRAME) accumulator = 0
        handleEvents()
        introTime = Math.max(0, introTime - dt)
        if (returnTimer > 0) {
          returnTimer -= dt
          if (returnTimer <= 0) {
            returnTimer = 0
            world.returnToRest()
            aimAtSuggestion()
            current.onEvent({ kind: 'returned' })
          }
        }
        const state = world.ball()
        scene.syncBall(state.position, state.rotation)
        scene.syncGadgets(world.motion())
        const { cup } = geometry
        scene.setFlagLifted(world.phase === 'holed' || (world.phase === 'rolling' && Math.hypot(state.position.x - cup.x, state.position.z - cup.z) < 2.4))
        const speed = Math.hypot(state.velocity.x, state.velocity.z)
        if (world.phase === 'rolling' && speed > 0.4) {
          const k = 1 - Math.exp(-dt * 2.5)
          const next = { x: heading.x + (state.velocity.x / speed - heading.x) * k, z: heading.z + (state.velocity.z / speed - heading.z) * k }
          const length = Math.hypot(next.x, next.z) || 1
          heading = { x: next.x / length, z: next.z / length }
        } else if (world.phase === 'ready') heading = direction
        // ひっぱっている間はカメラを止める。動くと、ひっぱる向きの基準がずれてしまう。
        if (!drag?.moved) {
          const desired = desiredPose()
          if (desired) pose = !pose || current.reducedMotion || introTime > 0 ? desired : lerpPose(pose, desired, 1 - Math.exp(-dt * 4.5))
        }
        if (pose) scene.setCamera(pose)
        if (current.active && world.phase === 'ready') {
          const ball = state.position
          const key = `${ball.x.toFixed(3)}:${ball.z.toFixed(3)}:${direction.x.toFixed(4)}:${direction.z.toFixed(4)}:${power.toFixed(3)}`
          if (key !== aimKey) {
            aimKey = key
            scene.setAim({ ball, direction, power, path: world.aimPath(direction, power, 5.5) })
          }
        } else if (aimKey !== 'hidden') {
          aimKey = 'hidden'
          scene.setAim(null)
        }
        scene.setHint(current.active && world.phase === 'ready' ? hintTarget : null)
      }
      scene.render(dt, current.reducedMotion)
      publishClock += dt
      if (publishClock > 0.1) { publish(); publishClock = 0 }
    }

    function pointerDown(event: PointerEvent) {
      if (event.button !== 0 || drag || !world || !pose || world.phase !== 'ready' || !latest.current.active) return
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), moved: false, forward: { x: pose.target.x - pose.position.x, z: pose.target.z - pose.position.z }, saved: { direction, power } }
      try { scene?.renderer.domElement.setPointerCapture(event.pointerId) } catch { /* captureできなくても操作は続けられる */ }
      event.preventDefault()
    }
    function pointerMove(event: PointerEvent) {
      if (!drag || drag.id !== event.pointerId || !scene) return
      const rect = scene.renderer.domElement.getBoundingClientRect()
      const aim = aimFromDrag(event.clientX - drag.x, event.clientY - drag.y, drag.forward, clamp(Math.min(rect.width, rect.height) * 0.34, 110, 230))
      if (!aim) return
      drag.moved = true
      direction = aim.direction
      power = aim.power
      hintTarget = null
      introTime = 0
      publish()
      event.preventDefault()
    }
    function pointerUp(event: PointerEvent) {
      if (!drag || drag.id !== event.pointerId) return
      const finished = drag
      drag = null
      try { scene?.renderer.domElement.releasePointerCapture(event.pointerId) } catch { /* 何もしない */ }
      if (finished.moved) { shootNow(); publish(); return }
      // 軽いタップは、その場所をねらう。
      if (!world || !scene || performance.now() - finished.time > 600) return
      const ball = world.ball().position
      const point = scene.pickGround(event.clientX, event.clientY, ball.y - BALL_RADIUS)
      if (!point) return
      const dx = point.x - ball.x
      const dz = point.z - ball.z
      const length = Math.hypot(dx, dz)
      if (length < 0.25) return
      direction = { x: dx / length, z: dz / length }
      hintTarget = null
      latest.current.onEvent({ kind: 'aimed' })
      publish()
    }
    function pointerCancel(event: PointerEvent) {
      if (!drag || drag.id !== event.pointerId) return
      direction = drag.saved.direction
      power = drag.saved.power
      drag = null
      publish()
    }

    function resize() { scene?.resize() }
    function visibility() {
      cancelAnimationFrame(frame)
      previous = 0
      accumulator = 0
      if (!document.hidden && !lost && !released && world) frame = requestAnimationFrame(animate)
    }
    function contextLost(event: Event) {
      event.preventDefault()
      lost = true
      cancelAnimationFrame(frame)
      latest.current.onStatus('error')
    }
    function contextRestored() { if (!released) setGeneration(value => value + 1) }

    latest.current.onStatus('loading')
    try {
      scene = createGolfScene(host)
      scene.setBallStyle(latest.current.ballStyle)
    } catch {
      queueMicrotask(() => { if (!released) latest.current.onStatus('error') })
      return () => { released = true }
    }
    const canvas = scene.renderer.domElement
    canvas.addEventListener('webglcontextlost', contextLost)
    canvas.addEventListener('webglcontextrestored', contextRestored)
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointermove', pointerMove)
    canvas.addEventListener('pointerup', pointerUp)
    canvas.addEventListener('pointercancel', pointerCancel)
    canvas.addEventListener('lostpointercapture', pointerCancel)
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize)
    observer?.observe(host)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', visibility)

    initializeRapier().then(() => {
      if (released || !scene) return
      try { loadHole() } catch { latest.current.onStatus('error'); return }
      runtime.current = {
        loadHole,
        beginPlay() {
          if (!world) return
          introTime = latest.current.reducedMotion ? 0 : INTRO_SECONDS
          pose = null
          aimAtSuggestion()
        },
        setBallStyle(id) { scene?.setBallStyle(id) },
        shoot: shootNow,
        turn(side) {
          if (!world || world.phase !== 'ready') return
          const angle = TURN_STEP * Math.sign(side)
          // ボールのうしろから見て右（side>0）へ回す。右は (-d.z, d.x) の向き。
          direction = { x: direction.x * Math.cos(angle) - direction.z * Math.sin(angle), z: direction.z * Math.cos(angle) + direction.x * Math.sin(angle) }
          hintTarget = null
          introTime = 0
          publish()
        },
        setPower(next) { power = clamp(next, 0.05, 1); introTime = 0; publish() },
        hint() {
          if (!world || world.phase !== 'ready') return
          const shot = world.suggestShot()
          direction = shot.direction
          power = shot.power
          hintTarget = shot.target
          introTime = 0
          latest.current.onEvent({ kind: 'hint' })
          publish()
        },
        assist() {
          if (!world || (world.phase !== 'ready' && world.phase !== 'out') || !geometry) return
          const { course, holeIndex } = latest.current
          const hole = course.holes[holeIndex] ?? course.holes[0]!
          const { cup } = geometry
          const previousPoint = hole.route[hole.route.length - 2] ?? hole.tee
          const toward = { x: previousPoint.x - cup.x, z: previousPoint.z - cup.z }
          const length = Math.hypot(toward.x, toward.z) || 1
          let spot = { x: cup.x + (toward.x / length) * 1.2, z: cup.z + (toward.z / length) * 1.2 }
          for (const reach of [1.2, 0.95, 0.75]) {
            spot = { x: cup.x + (toward.x / length) * reach, z: cup.z + (toward.z / length) * reach }
            if (geometry.surfaceAt(spot.x, spot.z) === 'green') break
          }
          returnTimer = 0
          world.placeBall(spot)
          const dx = cup.x - spot.x
          const dz = cup.z - spot.z
          const distance = Math.hypot(dx, dz) || 1
          direction = { x: dx / distance, z: dz / distance }
          power = Math.min(0.5, powerForDistance(distance + 0.4, rollingDecel('green', course.gravity, course.rollingScale)))
          hintTarget = null
          latest.current.onEvent({ kind: 'assisted' })
          publish()
        },
      }
      latest.current.onStatus(lost ? 'error' : 'ready')
      frame = requestAnimationFrame(animate)
    }).catch(() => { if (!released) latest.current.onStatus('error') })

    return () => {
      released = true
      runtime.current = null
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', visibility)
      canvas.removeEventListener('webglcontextlost', contextLost)
      canvas.removeEventListener('webglcontextrestored', contextRestored)
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('pointercancel', pointerCancel)
      canvas.removeEventListener('lostpointercapture', pointerCancel)
      world?.dispose()
      scene?.dispose()
    }
  }, [container, generation])

  return { registerContainer, registerMapMarker, retry, shoot, turn, setPower, hint, assist }
}
