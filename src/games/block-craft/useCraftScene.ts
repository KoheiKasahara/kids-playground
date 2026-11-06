import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MATERIALS, SIZE, topBlock, type Position, type World } from './world'

type Pick = (position: Position, normal: Position) => void
type SceneApi = { update: (world: World, cursor: Position) => void; rotate: (direction: number) => void; zoom: (direction: number) => void }

/** Demand rendering: no simulation, RAF, or held input survives a hidden page or unmount. */
export function useCraftScene(world: World, cursor: Position, onPick: Pick) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [failed, setFailed] = useState(false)
  const api = useRef<SceneApi | null>(null)
  const latest = useRef({ world, cursor, onPick })
  useEffect(() => { latest.current = { world, cursor, onPick }; api.current?.update(world, cursor) }, [world, cursor, onPick])

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
    scene.background = new THREE.Color('#c6eafa')
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120)
    camera.position.set(21, 19, 23)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(5.5, 2, 5.5)
    controls.enablePan = false
    controls.minDistance = 10
    controls.maxDistance = 40
    controls.minPolarAngle = 0.2
    controls.maxPolarAngle = Math.PI / 2.15
    controls.update()
    scene.add(new THREE.HemisphereLight('#ffffff', '#74705a', 2.4))
    const sun = new THREE.DirectionalLight('#fff5db', 2.5)
    sun.position.set(4, 14, 9)
    scene.add(sun)
    const geometry = new THREE.BoxGeometry(0.97, 0.97, 0.97)
    const materials = MATERIALS.map(m => new THREE.MeshLambertMaterial({ color: m.color }))
    const meshes = materials.map(material => {
      const mesh = new THREE.InstancedMesh(geometry, material, SIZE * SIZE * 10)
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
    outline.renderOrder = 1
    scene.add(outline)
    const render = () => renderer.render(scene, camera)
    const update = (blocks: World, selection: Position) => {
      const matrix = new THREE.Matrix4()
      positions.forEach(list => { list.length = 0 })
      for (const block of blocks) {
        const index = MATERIALS.findIndex(m => m.id === block.material)
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
    controls.addEventListener('change', render)
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
    api.current = {
      update,
      rotate: direction => {
        const offset = camera.position.clone().sub(controls.target)
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), direction * Math.PI / 4)
        camera.position.copy(controls.target).add(offset)
        controls.update()
      },
      zoom: direction => {
        const offset = camera.position.clone().sub(controls.target)
        offset.setLength(THREE.MathUtils.clamp(offset.length() * (direction > 0 ? 0.8 : 1.25), 10, 40))
        camera.position.copy(controls.target).add(offset)
        controls.update()
      },
    }
    resize()
    update(latest.current.world, latest.current.cursor)
    return () => {
      api.current = null
      observer.disconnect()
      controls.removeEventListener('change', render)
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
