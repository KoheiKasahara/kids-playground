import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { initializeRapier } from '../../physics/rapierLoader'
import { appendPart, BOARD_LIMIT, snapPart, type Course, type MarblePart, type PartKind } from './marbleModel'
import { createMarbleScene, type MarbleScene } from './marbleScene'
import { createMarbleWorld, type MarbleWorld, type RunStatus } from './marbleWorld'

export type EngineStatus = 'loading' | 'ready' | 'error'
export type EngineOptions = {
  course: Course
  selectedId: string | null
  onCommit: (course: Course) => void
  onSelect: (id: string | null) => void
  onPhase: (phase: RunStatus) => void
  onSnap: () => void
}
type Drag = { pointerId: number; x: number; y: number; original: Course; part: MarblePart; offset: THREE.Vector3; moved: boolean; palette: boolean; snapped: boolean }
type Runtime = { scene: MarbleScene; run: MarbleWorld | null; drag: Drag | null; dirty: number; phase: RunStatus }

export function useMarbleEngine(options: EngineOptions) {
  const [container, registerContainer] = useState<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<EngineStatus>('loading')
  const [attempt, setAttempt] = useState(0)
  const latest = useRef(options)
  const runtime = useRef<Runtime | null>(null)
  const sequence = useRef(1)
  useEffect(() => { latest.current = options }, [options])
  useEffect(() => {
    const rt = runtime.current
    if (!rt) return
    rt.scene.update(options.course, latest.current.selectedId)
    rt.dirty = 90
  }, [options.course])
  useEffect(() => {
    const rt = runtime.current
    if (rt) { rt.scene.select(options.selectedId); rt.dirty = 90 }
  }, [options.selectedId])

  useEffect(() => {
    if (!container) return
    let disposed = false
    let frame = 0
    let rt: Runtime
    try {
      rt = { scene: createMarbleScene(container), run: null, drag: null, dirty: 90, phase: 'ready' }
      runtime.current = rt
      rt.scene.update(latest.current.course, latest.current.selectedId)
    } catch {
      queueMicrotask(() => { if (!disposed) setStatus('error') })
      return () => { disposed = true }
    }
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let previous = 0, lastRender = 0, accumulator = 0
    const animate = (now: number) => {
      frame = requestAnimationFrame(animate)
      const dt = previous ? Math.min((now - previous) / 1000, 0.075) : 0
      previous = now
      if (document.hidden) { accumulator = 0; return }
      if (rt.run && rt.phase === 'rolling') {
        accumulator += dt
        while (accumulator >= 1 / 120 && rt.phase === 'rolling') {
          rt.phase = rt.run.step()
          accumulator -= 1 / 120
          if (rt.phase !== 'rolling') latest.current.onPhase(rt.phase)
        }
        const p = rt.run.ball.translation(), q = rt.run.ball.rotation()
        rt.scene.ball.position.copy(p)
        rt.scene.ball.quaternion.set(q.x, q.y, q.z, q.w)
        rt.dirty = 90
      }
      if (now - lastRender < 25 || rt.dirty <= 0) return
      lastRender = now
      rt.dirty--
      rt.scene.render(rt.phase === 'rolling' ? rt.scene.ball.position : null, reducedMotion)
    }
    frame = requestAnimationFrame(animate)
    initializeRapier().then(() => { if (!disposed) setStatus('ready') }).catch(() => { if (!disposed) setStatus('error') })
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const planePoint = new THREE.Vector3()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0))
    const ray = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
      raycaster.setFromCamera(pointer, rt.scene.camera)
    }
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || rt.phase === 'rolling' || rt.drag) return
      ray(event)
      const hit = raycaster.intersectObjects(rt.scene.root.children, false)[0]
      const part = latest.current.course.parts.find(item => item.id === hit?.object.userData.partId)
      latest.current.onSelect(part?.id ?? null)
      if (!part) return
      plane.constant = -part.position.y
      if (!raycaster.ray.intersectPlane(plane, planePoint)) return
      rt.drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, original: latest.current.course, part, offset: new THREE.Vector3().copy(part.position).sub(planePoint), moved: false, palette: false, snapped: false }
      rt.scene.renderer.domElement.setPointerCapture(event.pointerId)
      rt.dirty = 90
    }
    const move = (event: PointerEvent) => {
      const drag = rt.drag
      if (!drag || event.pointerId !== drag.pointerId) return
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 7 && !drag.moved) return
      const rect = container.getBoundingClientRect()
      if (drag.palette && (event.clientY > rect.bottom || event.clientY < rect.top)) return
      ray(event)
      plane.constant = -drag.part.position.y
      if (!raycaster.ray.intersectPlane(plane, planePoint)) return
      const position = planePoint.clone().add(drag.offset)
      const result = snapPart({ ...drag.part, position: { x: THREE.MathUtils.clamp(position.x, -BOARD_LIMIT, BOARD_LIMIT), y: drag.part.position.y, z: THREE.MathUtils.clamp(position.z, -BOARD_LIMIT, BOARD_LIMIT) } }, drag.original.parts)
      drag.moved = true
      drag.snapped = result.snapped
      const parts = drag.palette ? [...drag.original.parts, result.part] : drag.original.parts.map(part => part.id === drag.part.id ? result.part : part)
      rt.scene.update({ ...drag.original, parts }, drag.part.id, false)
      // Keep the original horizontal drag plane, even when a snap preview changes height.
      preview = result.part
      rt.dirty = 90
    }
    let preview: MarblePart | null = null
    const finish = (event: PointerEvent) => {
      const drag = rt.drag
      if (!drag || event.pointerId !== drag.pointerId) return
      rt.drag = null
      const rect = container.getBoundingClientRect()
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
      if (event.type === 'pointercancel' || (drag.palette && drag.moved && !inside)) {
        rt.scene.update(latest.current.course, latest.current.selectedId)
      } else if (drag.moved && preview) {
        const placed = preview
        const parts = drag.palette ? [...drag.original.parts, placed] : drag.original.parts.map(part => part.id === placed.id ? placed : part)
        latest.current.onCommit({ parts, startId: drag.original.startId ?? (placed.kind === 'goal' ? null : placed.id) })
        latest.current.onSelect(placed.id)
        if (drag.snapped) latest.current.onSnap()
      } else if (drag.palette) {
        const next = appendPart(drag.original, drag.part.kind, drag.part.id, latest.current.selectedId)
        latest.current.onCommit(next)
        latest.current.onSelect(drag.part.id)
        if (snapPart(next.parts.at(-1)!, drag.original.parts).snapped) latest.current.onSnap()
      }
      preview = null
      rt.dirty = 90
    }
    const redraw = () => { rt.dirty = 90 }
    const cancelDrag = () => {
      if (!rt.drag) return
      rt.drag = null
      preview = null
      rt.scene.update(latest.current.course, latest.current.selectedId)
      rt.dirty = 90
    }
    const visibility = () => { if (document.hidden) cancelDrag(); redraw() }
    const lostContext = (event: Event) => { event.preventDefault(); setStatus('error') }
    const canvas = rt.scene.renderer.domElement
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('webglcontextlost', lostContext)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    window.addEventListener('blur', cancelDrag)
    window.addEventListener('lostpointercapture', cancelDrag)
    window.addEventListener('resize', redraw)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('webglcontextlost', lostContext)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      window.removeEventListener('blur', cancelDrag)
      window.removeEventListener('lostpointercapture', cancelDrag)
      window.removeEventListener('resize', redraw)
      document.removeEventListener('visibilitychange', visibility)
      rt.run?.dispose()
      rt.scene.dispose()
      runtime.current = null
    }
  }, [container, attempt])

  const stop = useCallback(() => {
    const rt = runtime.current
    if (!rt) return
    rt.run?.dispose()
    rt.run = null
    rt.phase = 'ready'
    rt.dirty = 90
    rt.scene.update(latest.current.course, latest.current.selectedId)
    latest.current.onPhase('ready')
  }, [])
  const roll = useCallback(() => {
    const rt = runtime.current
    if (!rt || status !== 'ready') return
    rt.run?.dispose()
    // A tiny variation in release position gives the physical splitter different contact angles.
    rt.run = createMarbleWorld(latest.current.course, rt.scene.geometries, (Math.random() - 0.5) * 0.16)
    if (!rt.run) return
    rt.phase = 'rolling'
    rt.dirty = 90
    latest.current.onPhase('rolling')
  }, [status])
  const palette = useCallback((kind: PartKind, event: PointerEvent) => {
    const rt = runtime.current
    if (!rt || status !== 'ready' || rt.phase === 'rolling' || rt.drag || event.button !== 0) return
    const course = latest.current.course
    const appended = appendPart(course, kind, `part-${sequence.current++}`, latest.current.selectedId)
    if (appended === course) return
    const part = appended.parts.at(-1)!
    rt.drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, original: course, part, offset: new THREE.Vector3(), moved: false, palette: true, snapped: false }
  }, [status])
  const nextId = useCallback(() => `part-${sequence.current++}`, [])
  const retry = useCallback(() => { setStatus('loading'); setAttempt(value => value + 1) }, [])
  const zoom = useCallback((delta: number) => { const rt = runtime.current; if (rt) { rt.scene.zoom(delta); rt.dirty = 90 } }, [])
  const overview = useCallback(() => { const rt = runtime.current; if (rt) { rt.scene.overview(); rt.dirty = 90 } }, [])
  return {
    registerContainer, status, roll, stop, palette,
    nextId, retry, zoom, overview,
  }
}
