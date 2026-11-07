import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { HEIGHT, MATERIAL_DEFS, SIZE, topBlock, type Position, type World } from './world'

type Pick = (position: Position, normal: Position) => void
type SceneApi = { update: (world: World, cursor: Position, night: boolean) => void }

const DAY = { sky: '#c6eafa', hemisphere: 2.4, sun: 2.5, sunColor: '#fff5db', glow: 0.35 }
const NIGHT = { sky: '#1a2246', hemisphere: 0.75, sun: 0.4, sunColor: '#9fb4ff', glow: 1 }
const CENTER = (SIZE - 1) / 2

/** Keeps the two-finger panned view over the world: moves camera and target together so the angle never changes. */
export function clampTarget(target: THREE.Vector3, camera: THREE.Vector3) {
  const clamped = new THREE.Vector3(
    THREE.MathUtils.clamp(target.x, -1, SIZE),
    THREE.MathUtils.clamp(target.y, 0, HEIGHT - 2),
    THREE.MathUtils.clamp(target.z, -1, SIZE),
  )
  const shift = clamped.clone().sub(target)
  if (shift.lengthSq() === 0) return false
  target.add(shift)
  camera.add(shift)
  return true
}

/** Demand rendering: no simulation, RAF, or held input survives a hidden page or unmount. */
export function useCraftScene(world: World, cursor: Position, onPick: Pick, night = false) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [failed, setFailed] = useState(false)
  const api = useRef<SceneApi | null>(null)
  const latest = useRef({ world, cursor, onPick, night })
  useEffect(() => { latest.current = { world, cursor, onPick, night }; api.current?.update(world, cursor, night) }, [world, cursor, onPick, night])

  useEffect(() => {
    if (!container) return
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true }) } catch {
      let cancelled = false
      queueMicrotask(() => { if (!cancelled) setFailed(true) })
      return () => { cancelled = true }
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    const sky = new THREE.Color(DAY.sky)
    scene.background = sky
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 160)
    camera.position.set(CENTER + 16, 22, CENTER + 18)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(CENTER, 2, CENTER)
    // ひとさしゆび1ぽんで まわす・2ほんで いどうと ちかづく（地面にそって うごく）
    controls.enablePan = true
    controls.screenSpacePanning = false
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
    controls.minDistance = 6
    controls.maxDistance = 48
    controls.minPolarAngle = 0.2
    controls.maxPolarAngle = Math.PI / 2.15
    controls.update()
    const hemisphere = new THREE.HemisphereLight('#ffffff', '#74705a', DAY.hemisphere)
    scene.add(hemisphere)
    const sun = new THREE.DirectionalLight(DAY.sunColor, DAY.sun)
    sun.position.set(6, 18, 12)
    scene.add(sun)
    const geometry = new THREE.BoxGeometry(0.97, 0.97, 0.97)
    const materials = MATERIAL_DEFS.map(m => new THREE.MeshLambertMaterial({
      color: m.color,
      transparent: m.opacity !== undefined,
      opacity: m.opacity ?? 1,
      depthWrite: m.opacity === undefined,
      emissive: m.glow ? m.color : '#000000',
      emissiveIntensity: m.glow ? DAY.glow : 0,
    }))
    const meshes = materials.map((material, index) => {
      const mesh = new THREE.InstancedMesh(geometry, material, SIZE * SIZE * HEIGHT)
      if (MATERIAL_DEFS[index].opacity !== undefined) mesh.renderOrder = 1
      mesh.count = 0
      scene.add(mesh)
      return mesh
    })
    const positions: Position[][] = materials.map(() => [])
    const outlineBox = new THREE.BoxGeometry(1.04, 1.04, 1.04)
    const outlineGeometry = new THREE.EdgesGeometry(outlineBox)
    outlineBox.dispose()
    const outlineMaterial = new THREE.LineBasicMaterial({ color: '#ffef56', depthTest: false })
    const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial)
    outline.renderOrder = 2
    scene.add(outline)
    const render = () => renderer.render(scene, camera)
    const update = (blocks: World, selection: Position, night: boolean) => {
      const theme = night ? NIGHT : DAY
      sky.set(theme.sky)
      hemisphere.intensity = theme.hemisphere
      sun.intensity = theme.sun
      sun.color.set(theme.sunColor)
      materials.forEach((material, i) => { if (MATERIAL_DEFS[i].glow) material.emissiveIntensity = theme.glow })
      const matrix = new THREE.Matrix4()
      positions.forEach(list => { list.length = 0 })
      for (const block of blocks) {
        const index = MATERIAL_DEFS.findIndex(m => m.id === block.material)
        const list = positions[index]
        meshes[index].setMatrixAt(list.length, matrix.makeTranslation(block.x, block.y, block.z))
        list.push(block)
      }
      meshes.forEach((mesh, i) => {
        mesh.count = positions[i].length
        mesh.instanceMatrix.needsUpdate = true
        mesh.computeBoundingSphere()
      })
      const top = topBlock(blocks, selection.x, selection.z)
      outline.position.set(top.x, top.y, top.z)
      render()
    }
    const resize = () => {
      const width = container.clientWidth || 320
      const height = container.clientHeight || 360
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      render()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    const changed = () => {
      clampTarget(controls.target, camera.position)
      render()
    }
    controls.addEventListener('change', changed)
    const raycaster = new THREE.Raycaster()
    let down: { x: number; y: number; id: number } | null = null
    let dragged = false
    const pointerDown = (event: PointerEvent) => {
      if (down || !event.isPrimary || event.button !== 0) { dragged = true; return }
      down = { x: event.clientX, y: event.clientY, id: event.pointerId }
      dragged = false
    }
    const pointerMove = (event: PointerEvent) => {
      if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7) dragged = true
    }
    const cancel = () => { down = null }
    const pointerUp = (event: PointerEvent) => {
      if (!down || down.id !== event.pointerId) return
      const wasDragged = dragged
      down = null
      if (wasDragged) return
      const rect = renderer.domElement.getBoundingClientRect()
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera)
      const hit = raycaster.intersectObjects(meshes)[0]
      if (!hit || hit.instanceId === undefined || !hit.face) return
      const position = positions[meshes.findIndex(mesh => mesh === hit.object)][hit.instanceId]
      latest.current.onPick(position, hit.face.normal)
    }
    const canvas = renderer.domElement
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointermove', pointerMove)
    canvas.addEventListener('pointerup', pointerUp)
    canvas.addEventListener('pointercancel', cancel)
    canvas.addEventListener('lostpointercapture', cancel)
    const contextLost = (event: Event) => { event.preventDefault(); setFailed(true) }
    canvas.addEventListener('webglcontextlost', contextLost)
    api.current = { update }
    resize()
    update(latest.current.world, latest.current.cursor, latest.current.night)
    return () => {
      api.current = null
      observer.disconnect()
      controls.removeEventListener('change', changed)
      controls.dispose()
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('pointercancel', cancel)
      canvas.removeEventListener('lostpointercapture', cancel)
      canvas.removeEventListener('webglcontextlost', contextLost)
      geometry.dispose()
      materials.forEach(material => material.dispose())
      meshes.forEach(mesh => mesh.dispose())
      outlineGeometry.dispose()
      outlineMaterial.dispose()
      renderer.dispose()
      canvas.remove()
    }
  }, [container])
  return { setContainer, failed, api }
}
