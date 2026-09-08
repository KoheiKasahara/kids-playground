import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { createSnowWorld, FIELD_LIMIT, ITEM_TYPES, nextItemKind, progress, stepSnowWorld, type ItemKind } from './snowballWorld'
import { createSnowVisuals } from './snowballVisuals'
import { playSnowSound } from './sounds'

export type SnowSnapshot = { count: number; progress: number; next: ItemKind | null; message: string; won: boolean }
export const INITIAL_SNAPSHOT: SnowSnapshot = { count: 0, progress: 0, next: 'gift', message: 'どんぐりを あつめよう！', won: false }

export function useSnowballEngine(onUpdate: (snapshot: SnowSnapshot) => void) {
  const [container, registerContainer] = useState<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const directionRef = useRef({ x: 0, z: 0 })

  useEffect(() => {
    if (!container) return
    const world = createSnowWorld()
    const visuals = createSnowVisuals()
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#b7dfef')
    scene.fog = new THREE.Fog('#b7dfef', 50, 110)
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 150)
    let renderer: THREE.WebGLRenderer | undefined
    let observer: ResizeObserver | undefined
    let frame = 0
    let stopped = false
    let disposed = false
    let announcedReady = false
    let previous = 0
    let hintTime = -2
    let burst = 0
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const ball = new THREE.Group()
    const spin = new THREE.Group()
    ball.add(spin)
    visuals.part(spin, visuals.sphere, '#fffdf5', [0, 0, 0], [1, 1, 1])
    // Small blue flecks make the rolling motion visible even before the first pickup.
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4
      const y = -0.85 + i * 0.15
      const r = Math.sqrt(1 - y * y)
      visuals.part(spin, visuals.sphere, '#d9eef8', [Math.cos(a) * r, y, Math.sin(a) * r], [0.065, 0.065, 0.065])
    }
    scene.add(ball)
    const hemisphere = new THREE.HemisphereLight('#ffffff', '#7e9ab8', 2.5)
    const sunlight = new THREE.DirectionalLight('#fff4d9', 3)
    sunlight.position.set(-12, 24, 15)
    scene.add(hemisphere, sunlight)
    visuals.part(scene, visuals.box, '#e9f6fc', [0, -0.25, 0], [46, 0.5, 46])
    // Low snow banks delimit the entire reachable area without trapping the ball.
    for (let i = -FIELD_LIMIT; i <= FIELD_LIMIT; i += 3) {
      for (const side of [-1, 1]) {
        visuals.part(scene, visuals.sphere, '#d0e6f2', [i, 0, side * 23], [2, 1.2, 1.6])
        visuals.part(scene, visuals.sphere, '#d0e6f2', [side * 23, 0, i], [1.6, 1.2, 2])
      }
    }
    const itemMeshes = world.items.map(item => {
      const mesh = visuals.item(item.kind, item.id)
      mesh.position.set(item.x, 0, item.z)
      scene.add(mesh)
      return mesh
    })
    const shadowGeometry = new THREE.CircleGeometry(1, 24)
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#779cb6', transparent: true, opacity: 0.22, depthWrite: false })
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial)
    shadow.rotation.x = -Math.PI / 2
    scene.add(shadow)
    const guide = visuals.part(scene, visuals.cone, '#ec9650', [0, 0.3, 0], [0.3, 0.9, 0.25])
    const sparkles = Array.from({ length: 16 }, (_, index) => {
      const mesh = visuals.part(scene, visuals.sphere, index % 2 ? '#ffcd66' : '#80d5dc', [0, -10, 0], [0.12, 0.12, 0.12])
      mesh.visible = false
      return mesh
    })
    const attachments: { mesh: THREE.Group; normal: THREE.Vector3; size: number }[] = []
    const axis = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)
    const target = new THREE.Vector3()
    const offset = new THREE.Vector3()
    const normal = new THREE.Vector3()
    const inverse = new THREE.Quaternion()
    let cameraDistance = 11

    const clearInput = () => { directionRef.current = { x: 0, z: 0 }; previous = 0 }
    const lostContext = (event: Event) => {
      event.preventDefault()
      stopped = true
      clearInput()
      cancelAnimationFrame(frame)
      setStatus('error')
    }
    function resize() {
      const width = Math.max(1, container!.clientWidth)
      const height = Math.max(1, container!.clientHeight)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer?.setSize(width, height)
    }
    function draw(now: number) {
      if (stopped) return
      frame = requestAnimationFrame(draw)
      if (document.hidden) { previous = 0; return }
      const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0
      previous = now
      const oldX = world.x
      const oldZ = world.z
      const oldNext = nextItemKind(world.radius)
      const update = stepSnowWorld(world, directionRef.current, dt)
      const dx = world.x - oldX
      const dz = world.z - oldZ
      const distance = Math.hypot(dx, dz)
      if (distance > 0) {
        axis.set(dz, 0, -dx).normalize()
        spin.rotateOnWorldAxis(axis, distance / world.radius)
      }
      for (const item of update.picked) {
        const mesh = itemMeshes[item.id]!
        inverse.copy(spin.quaternion).invert()
        normal.set(item.x - world.x, -world.radius * 0.35, item.z - world.z).normalize().applyQuaternion(inverse)
        spin.add(mesh)
        mesh.quaternion.setFromUnitVectors(up, normal)
        attachments.push({ mesh, normal: normal.clone(), size: ITEM_TYPES[item.kind].size })
      }
      ball.position.set(world.x, world.radius, world.z)
      spin.scale.setScalar(world.radius)
      for (const attachment of attachments) {
        attachment.mesh.position.copy(attachment.normal).multiplyScalar(0.87)
        attachment.mesh.scale.setScalar(attachment.size / world.radius)
      }
      shadow.position.set(world.x, 0.015, world.z)
      shadow.scale.setScalar(world.radius * 1.15)
      if (update.picked.length || update.justWon || (update.blocked && now / 1000 - hintTime > 2)) {
        const next = nextItemKind(world.radius)
        let message = update.blocked ? 'ちいさい ものから あつめよう！' : 'ぺたっ！ おおきく なったよ'
        if (oldNext !== next && oldNext) message = `${ITEM_TYPES[oldNext].label}も くっつくよ！`
        if (update.justWon) message = 'やったー！ おおきな ゆきだま！'
        onUpdate({ count: world.collected, progress: progress(world), next, message, won: world.won })
        hintTime = now / 1000
        if (update.picked.length) {
          playSnowSound(update.justWon, world.collected)
          burst = reducedMotion ? 0 : 0.7
        }
      }
      burst = Math.max(0, burst - dt)
      sparkles.forEach((mesh, i) => {
        mesh.visible = burst > 0
        if (!mesh.visible) return
        const a = i * Math.PI / 8
        const radius = world.radius + (0.7 - burst) * 3
        mesh.position.set(world.x + Math.cos(a) * radius, world.radius + Math.sin(burst * Math.PI) * 2, world.z + Math.sin(a) * radius)
        mesh.scale.setScalar(burst * 0.24)
      })
      const nearest = world.items.filter(item => !item.collected && ITEM_TYPES[item.kind].required <= world.radius)
        .reduce<typeof world.items[number] | undefined>((best, item) => !best || Math.hypot(item.x - world.x, item.z - world.z) < Math.hypot(best.x - world.x, best.z - world.z) ? item : best, undefined)
      guide.visible = !!nearest && !world.won
      if (nearest) {
        normal.set(nearest.x - world.x, 0, nearest.z - world.z).normalize()
        guide.position.copy(ball.position).addScaledVector(normal, world.radius + 1)
        guide.position.y = 0.3
        guide.quaternion.setFromUnitVectors(up, normal)
      }
      const wantedDistance = (10 + world.radius * 4.5) * Math.max(1, 0.8 / camera.aspect)
      cameraDistance += (wantedDistance - cameraDistance) * Math.min(1, dt * 3)
      target.set(world.x, world.radius * 0.5, world.z)
      offset.set(0, cameraDistance * 0.92, cameraDistance * 0.78)
      camera.position.copy(target).add(offset)
      camera.lookAt(target)
      renderer?.render(scene, camera)
      if (!announcedReady) {
        announcedReady = true
        setStatus('ready')
      }
    }

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      container.appendChild(renderer.domElement)
      renderer.domElement.addEventListener('webglcontextlost', lostContext)
      observer = new ResizeObserver(resize)
      observer.observe(container)
      resize()
      cameraDistance = (10 + world.radius * 4.5) * Math.max(1, 0.8 / camera.aspect)
      window.addEventListener('blur', clearInput)
      document.addEventListener('visibilitychange', clearInput)
      frame = requestAnimationFrame(draw)
    } catch {
      stopped = true
      queueMicrotask(() => { if (!disposed) setStatus('error') })
    }
    return () => {
      stopped = true
      disposed = true
      clearInput()
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('blur', clearInput)
      document.removeEventListener('visibilitychange', clearInput)
      renderer?.domElement.removeEventListener('webglcontextlost', lostContext)
      renderer?.domElement.remove()
      renderer?.dispose()
      renderer?.forceContextLoss()
      shadowGeometry.dispose()
      shadowMaterial.dispose()
      visuals.dispose()
      hemisphere.dispose()
      sunlight.dispose()
      scene.clear()
    }
  }, [container, onUpdate])
  return { registerContainer, status, directionRef }
}
