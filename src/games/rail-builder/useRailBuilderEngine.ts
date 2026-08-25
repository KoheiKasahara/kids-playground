import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  clampRailPosition,
  connectRailPieces,
  disconnectRailPiece,
  findRailSnapCandidate,
  type RailConnectorId,
  type RailPiece,
  type RailVec3,
  type SnapCandidate,
  worldConnectorForRailPiece,
  worldRailPathPoint,
} from './railModel'

const WORLD_SIZE = 50
const WORLD_HALF_SIZE = WORLD_SIZE / 2
const PAN_LIMIT = 15
const MIN_ZOOM = 0.72
const MAX_ZOOM = 1.75
const DEFAULT_ZOOM = 1
const BASE_VIEW_HEIGHT = 15
const POINTER_MOVE_THRESHOLD = 6

export type RailBuilderEngineOptions = {
  pieces: readonly RailPiece[]
  selectedPieceId: string | null
  zoom: number
  onPiecesChange: (pieces: RailPiece[]) => void
  onSelectPiece: (pieceId: string | null) => void
  onZoomChange?: (zoom: number) => void
}

export type RailBuilderEngineHandle = {
  registerContainer: (element: HTMLDivElement | null) => void
  getCameraTarget: () => RailVec3
}

type PointerPosition = {
  x: number
  y: number
}

type DragState = {
  pointerId: number
  pieceId: string
  layout: RailPiece[]
  currentPiece: RailPiece
  offset: RailVec3
  startX: number
  startY: number
  moved: boolean
  candidate: SnapCandidate | null
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function vec3(x: number, y: number, z: number): RailVec3 {
  return { x, y, z }
}

function subtract(a: RailVec3, b: RailVec3): RailVec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function add(a: RailVec3, b: RailVec3): RailVec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }
}

function distance2D(a: PointerPosition, b: PointerPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function pieceIdFromObject(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object
  while (current !== null) {
    const pieceId = current.userData.pieceId
    if (typeof pieceId === 'string') return pieceId
    current = current.parent
  }
  return null
}

function disposeObjectTree(root: THREE.Object3D, sharedGeometries: Set<THREE.BufferGeometry>, sharedMaterials: Set<THREE.Material>) {
  root.traverse((object) => {
    const renderObject = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry
      material?: THREE.Material | THREE.Material[]
    }
    if (renderObject.geometry !== undefined && !sharedGeometries.has(renderObject.geometry)) {
      renderObject.geometry.dispose()
    }
    if (renderObject.material instanceof Array) {
      renderObject.material.forEach((material) => {
        if (!sharedMaterials.has(material)) material.dispose()
      })
    } else if (renderObject.material !== undefined && !sharedMaterials.has(renderObject.material)) {
      renderObject.material.dispose()
    }
  })
}

/** Three.jsの線路シーンとポインター操作を管理する命令的hook。 */
export function useRailBuilderEngine(options: RailBuilderEngineOptions): RailBuilderEngineHandle {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const cameraTargetRef = useRef<RailVec3>({ x: 0, y: 0, z: 0 })
  const syncSceneRef = useRef<((pieces: readonly RailPiece[], selectedPieceId: string | null) => void) | null>(null)
  const syncZoomRef = useRef<((zoom: number) => void) | null>(null)

  const registerContainer = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element
  }, [])

  const getCameraTarget = useCallback((): RailVec3 => ({ ...cameraTargetRef.current }), [])

  const handle = useMemo<RailBuilderEngineHandle>(
    () => ({ registerContainer, getCameraTarget }),
    [getCameraTarget, registerContainer],
  )

  useEffect(() => {
    syncSceneRef.current?.(options.pieces, options.selectedPieceId)
  }, [options.pieces, options.selectedPieceId])

  useEffect(() => {
    syncZoomRef.current?.(options.zoom)
  }, [options.zoom])

  useEffect(() => {
    const container = containerRef.current
    if (container === null || typeof window === 'undefined') return undefined
    const host = container

    let scene: THREE.Scene | null = null
    let camera: THREE.OrthographicCamera | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let resizeObserver: ResizeObserver | null = null
    let rafId: number | null = null
    let released = false

    const railRoot = new THREE.Group()
    railRoot.name = 'rail-pieces'
    const pieceObjects = new Map<string, THREE.Group>()
    const selectionRings = new Map<string, THREE.Mesh>()
    const marker = new THREE.Group()
    marker.name = 'snap-marker'
    const sharedGeometries = new Set<THREE.BufferGeometry>()
    const sharedMaterials = new Set<THREE.Material>()

    const railGeometry = new THREE.BoxGeometry(1, 0.16, 0.14)
    const baseGeometry = new THREE.BoxGeometry(1.05, 0.14, 0.9)
    const sleeperGeometry = new THREE.BoxGeometry(1.65, 0.16, 0.58)
    const connectorGeometry = new THREE.CylinderGeometry(0.27, 0.27, 0.18, 16)
    const selectionRingGeometry = new THREE.RingGeometry(0.72, 0.82, 32)
    const markerGeometry = new THREE.RingGeometry(0.35, 0.48, 24)
    ;[
      railGeometry,
      baseGeometry,
      sleeperGeometry,
      connectorGeometry,
      selectionRingGeometry,
      markerGeometry,
    ].forEach((geometry) => sharedGeometries.add(geometry))

    const railMaterial = new THREE.MeshStandardMaterial({ color: '#6b7280', roughness: 0.48, metalness: 0.3 })
    const baseMaterial = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.72 })
    const sleeperMaterial = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.88 })
    const connectorMaterial = new THREE.MeshStandardMaterial({ color: '#fb923c', roughness: 0.6 })
    const selectionMaterial = new THREE.MeshBasicMaterial({
      color: '#38bdf8',
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    })
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: '#fef08a',
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
    })
    ;[
      railMaterial,
      baseMaterial,
      sleeperMaterial,
      connectorMaterial,
      selectionMaterial,
      markerMaterial,
    ].forEach((material) => sharedMaterials.add(material))

    const groundGeometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE)
    const groundMaterial = new THREE.MeshStandardMaterial({ color: '#9bd18b', roughness: 0.9 })
    sharedGeometries.add(groundGeometry)
    sharedMaterials.add(groundMaterial)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const groundPoint = new THREE.Vector3()
    const cameraTarget = new THREE.Vector3(
      cameraTargetRef.current.x,
      cameraTargetRef.current.y,
      cameraTargetRef.current.z,
    )
    const cameraOffset = new THREE.Vector3(18, 23, 20)
    const pointers = new Map<number, PointerPosition>()
    let activeZoom = clampZoom(optionsRef.current.zoom || DEFAULT_ZOOM)
    let mode: 'none' | 'pan' | 'rail' | 'pinch' = 'none'
    let panLastGround: RailVec3 | null = null
    let drag: DragState | null = null
    let pinchStartDistance = 0
    let pinchStartZoom = activeZoom

    function updateCamera() {
      if (camera === null) return
      const rect = host.getBoundingClientRect()
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)
      const aspect = width / height
      const viewHeight = BASE_VIEW_HEIGHT / activeZoom
      const viewWidth = viewHeight * aspect
      camera.left = -viewWidth / 2
      camera.right = viewWidth / 2
      camera.top = viewHeight / 2
      camera.bottom = -viewHeight / 2
      camera.position.copy(cameraTarget).add(cameraOffset)
      camera.lookAt(cameraTarget)
      camera.updateProjectionMatrix()
    }

    function updateZoom(nextZoom: number, notify = true) {
      activeZoom = clampZoom(nextZoom)
      updateCamera()
      if (notify) optionsRef.current.onZoomChange?.(activeZoom)
    }

    function setCameraTarget(next: RailVec3) {
      cameraTarget.x = Math.min(PAN_LIMIT, Math.max(-PAN_LIMIT, next.x))
      cameraTarget.y = 0
      cameraTarget.z = Math.min(PAN_LIMIT, Math.max(-PAN_LIMIT, next.z))
      cameraTargetRef.current = {
        x: cameraTarget.x,
        y: cameraTarget.y,
        z: cameraTarget.z,
      }
      updateCamera()
    }

    function getPointerNdc(event: PointerEvent) {
      const rect = host.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
    }

    function intersectGround(event: PointerEvent): RailVec3 | null {
      if (camera === null) return null
      getPointerNdc(event)
      raycaster.setFromCamera(pointer, camera)
      const intersection = raycaster.ray.intersectPlane(groundPlane, groundPoint)
      if (intersection === null) return null
      return vec3(intersection.x, 0, intersection.z)
    }

    function pickPiece(event: PointerEvent): string | null {
      if (camera === null || scene === null) return null
      getPointerNdc(event)
      raycaster.setFromCamera(pointer, camera)
      const intersections = raycaster.intersectObjects(railRoot.children, true)
      for (const intersection of intersections) {
        const pieceId = pieceIdFromObject(intersection.object)
        if (pieceId !== null) return pieceId
      }
      return null
    }

    function setMarker(candidate: SnapCandidate | null) {
      marker.visible = candidate !== null
      if (candidate === null) return
      const targetPiece = optionsRef.current.pieces.find((piece) => piece.id === candidate.targetPieceId)
      if (targetPiece === undefined) return
      const target = worldConnectorForRailPiece(targetPiece, candidate.targetConnectorId)
      marker.position.set(target.position.x, 0.31, target.position.z)
    }

    function updateSelection(selectedPieceId: string | null) {
      for (const [pieceId, ring] of selectionRings) {
        ring.visible = pieceId === selectedPieceId
      }
    }

    function makePieceObject(piece: RailPiece): THREE.Group {
      const group = new THREE.Group()
      group.name = `rail-${piece.id}`
      group.userData.pieceId = piece.id

      const segmentCount = piece.path.kind === 'straight' ? 1 : 12
      const sleeperEvery = piece.path.kind === 'straight' ? 1 : 2
      const localPiece = { ...piece, position: vec3(0, 0, 0), rotationY: 0 }
      for (let i = 0; i < segmentCount; i += 1) {
        const t0 = i / segmentCount
        const t1 = (i + 1) / segmentCount
        const p0 = worldRailPathPoint(localPiece, t0)
        const p1 = worldRailPathPoint(localPiece, t1)
        const midpoint = vec3((p0.x + p1.x) / 2, 0.2, (p0.z + p1.z) / 2)
        const tangent = vec3(p1.x - p0.x, 0, p1.z - p0.z)
        const tangentLength = Math.hypot(tangent.x, tangent.z) || 1
        const tx = tangent.x / tangentLength
        const tz = tangent.z / tangentLength
        const heading = Math.atan2(-tz, tx)

        const base = new THREE.Mesh(baseGeometry, baseMaterial)
        base.position.set(midpoint.x, 0.1, midpoint.z)
        base.scale.x = Math.max(0.55, tangentLength)
        base.rotation.y = heading
        base.userData.pieceId = piece.id
        group.add(base)

        const offsetX = -tz * 0.46
        const offsetZ = tx * 0.46
        for (const side of [-1, 1]) {
          const rail = new THREE.Mesh(railGeometry, railMaterial)
          rail.position.set(midpoint.x + offsetX * side, 0.34, midpoint.z + offsetZ * side)
          rail.scale.x = Math.max(0.55, tangentLength)
          rail.rotation.y = heading
          rail.userData.pieceId = piece.id
          group.add(rail)
        }

        if (i % sleeperEvery === 0) {
          const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial)
          sleeper.position.set((p0.x + p1.x) / 2, 0.2, (p0.z + p1.z) / 2)
          sleeper.rotation.y = heading
          sleeper.userData.pieceId = piece.id
          group.add(sleeper)
        }
      }

      for (const connectorId of ['a', 'b'] as RailConnectorId[]) {
        const connector = worldConnectorForRailPiece(localPiece, connectorId)
        const cap = new THREE.Mesh(connectorGeometry, connectorMaterial)
        cap.position.set(connector.position.x, 0.25, connector.position.z)
        cap.userData.pieceId = piece.id
        group.add(cap)
      }

      const selectionRing = new THREE.Mesh(selectionRingGeometry, selectionMaterial)
      selectionRing.name = 'selection-ring'
      selectionRing.rotation.x = -Math.PI / 2
      const ringCenter = worldRailPathPoint(localPiece, 0.5)
      selectionRing.position.set(ringCenter.x, 0.43, ringCenter.z)
      selectionRing.visible = piece.id === optionsRef.current.selectedPieceId
      selectionRing.userData.pieceId = piece.id
      group.add(selectionRing)
      selectionRings.set(piece.id, selectionRing)
      return group
    }

    function syncPieces(pieces: readonly RailPiece[], selectedPieceId: string | null) {
      const incomingIds = new Set(pieces.map((piece) => piece.id))
      for (const [pieceId, object] of pieceObjects) {
        if (incomingIds.has(pieceId)) continue
        railRoot.remove(object)
        pieceObjects.delete(pieceId)
        selectionRings.delete(pieceId)
      }
      for (const piece of pieces) {
        let object = pieceObjects.get(piece.id)
        if (object === undefined) {
          object = makePieceObject(piece)
          pieceObjects.set(piece.id, object)
          railRoot.add(object)
        }
        object.position.set(piece.position.x, piece.position.y, piece.position.z)
        object.rotation.y = piece.rotationY
      }
      updateSelection(selectedPieceId)
    }

    function moveDragObject(piece: RailPiece) {
      const object = pieceObjects.get(piece.id)
      if (object === undefined) return
      object.position.set(piece.position.x, piece.position.y, piece.position.z)
      object.rotation.y = piece.rotationY
    }

    function startPinch() {
      const values = [...pointers.values()]
      if (values.length < 2) return
      pinchStartDistance = Math.max(1, distance2D(values[0]!, values[1]!))
      pinchStartZoom = activeZoom
      mode = 'pinch'
      drag = null
      setMarker(null)
      syncPieces(optionsRef.current.pieces, optionsRef.current.selectedPieceId)
    }

    function updatePinch() {
      const values = [...pointers.values()]
      if (values.length < 2 || pinchStartDistance <= 0) return
      const distance = Math.max(1, distance2D(values[0]!, values[1]!))
      updateZoom(pinchStartZoom * (distance / pinchStartDistance))
    }

    function finishDrag() {
      const currentDrag = drag
      drag = null
      setMarker(null)
      if (currentDrag === null) return
      if (!currentDrag.moved) {
        syncPieces(optionsRef.current.pieces, optionsRef.current.selectedPieceId)
        return
      }

      const movedLayout = currentDrag.layout.map((piece) => (
        piece.id === currentDrag.pieceId
          ? {
            ...piece,
            position: { ...currentDrag.currentPiece.position },
            rotationY: currentDrag.currentPiece.rotationY,
          }
          : piece
      ))
      const nextLayout = currentDrag.candidate === null
        ? movedLayout
        : connectRailPieces(
          movedLayout,
          currentDrag.pieceId,
          currentDrag.candidate.movingConnectorId,
          currentDrag.candidate.targetPieceId,
          currentDrag.candidate.targetConnectorId,
          currentDrag.candidate.transform,
        )
      optionsRef.current.onPiecesChange(nextLayout)
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) return
      event.preventDefault()
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      try {
        host.setPointerCapture(event.pointerId)
      } catch {
        // Safari may reject capture after a node is detached during navigation.
      }
      if (pointers.size >= 2) {
        startPinch()
        return
      }

      const selectedPieceId = pickPiece(event)
      optionsRef.current.onSelectPiece(selectedPieceId)
      if (selectedPieceId !== null) {
        const sourcePieces = optionsRef.current.pieces
        const sourcePiece = sourcePieces.find((piece) => piece.id === selectedPieceId)
        const ground = intersectGround(event)
        if (sourcePiece !== undefined) {
          const layout = disconnectRailPiece(sourcePieces, selectedPieceId)
          const detachedPiece = layout.find((piece) => piece.id === selectedPieceId) ?? sourcePiece
          drag = {
            pointerId: event.pointerId,
            pieceId: selectedPieceId,
            layout,
            currentPiece: detachedPiece,
            offset: ground === null ? vec3(0, 0, 0) : subtract(ground, sourcePiece.position),
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
            candidate: null,
          }
          mode = 'rail'
        }
      } else {
        mode = 'pan'
        panLastGround = intersectGround(event)
      }
    }

    function handlePointerMove(event: PointerEvent) {
      const previous = pointers.get(event.pointerId)
      if (previous === undefined) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointers.size >= 2 || mode === 'pinch') {
        updatePinch()
        return
      }

      if (mode === 'rail' && drag?.pointerId === event.pointerId) {
        if (distance2D({ x: event.clientX, y: event.clientY }, { x: drag.startX, y: drag.startY }) >= POINTER_MOVE_THRESHOLD) {
          drag.moved = true
        }
        if (!drag.moved) return
        const ground = intersectGround(event)
        if (ground === null) return
        const rawPosition = clampRailPosition(subtract(ground, drag.offset), -WORLD_HALF_SIZE + 4, WORLD_HALF_SIZE - 4)
        const rawPiece: RailPiece = { ...drag.currentPiece, position: rawPosition }
        const candidate = findRailSnapCandidate(
          rawPiece,
          drag.layout.filter((piece) => piece.id !== drag?.pieceId),
        )
        drag.candidate = candidate
        drag.currentPiece = candidate === null
          ? rawPiece
          : { ...rawPiece, position: { ...candidate.transform.position }, rotationY: candidate.transform.rotationY }
        moveDragObject(drag.currentPiece)
        setMarker(candidate)
        return
      }

      if (mode === 'pan' && panLastGround !== null) {
        const ground = intersectGround(event)
        if (ground === null) return
        const delta = subtract(panLastGround, ground)
        setCameraTarget(add(cameraTarget, delta))
        panLastGround = ground
      }
      void previous
    }

    function handlePointerUp(event: PointerEvent) {
      pointers.delete(event.pointerId)
      try {
        host.releasePointerCapture(event.pointerId)
      } catch {
        // Capture is best effort; pointerup still completes the interaction.
      }
      if (pointers.size >= 2) return
      if (mode === 'rail' && drag?.pointerId === event.pointerId) finishDrag()
      if (pointers.size === 0) {
        mode = 'none'
        panLastGround = null
      }
    }

    function handlePointerCancel(event: PointerEvent) {
      pointers.delete(event.pointerId)
      if (drag?.pointerId === event.pointerId) {
        drag = null
        setMarker(null)
        syncPieces(optionsRef.current.pieces, optionsRef.current.selectedPieceId)
      }
      if (pointers.size === 0) {
        mode = 'none'
        panLastGround = null
      }
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      updateZoom(activeZoom * (event.deltaY < 0 ? 1.1 : 0.9))
    }

    function handleContextMenu(event: MouseEvent) {
      event.preventDefault()
    }

    function resize() {
      if (renderer === null || camera === null) return
      const rect = host.getBoundingClientRect()
      const width = Math.max(1, Math.round(rect.width))
      const height = Math.max(1, Math.round(rect.height))
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(width, height, false)
      updateCamera()
    }

    try {
      scene = new THREE.Scene()
      scene.background = new THREE.Color('#cfeef3')
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
      camera.position.copy(cameraTarget).add(cameraOffset)
      camera.lookAt(cameraTarget)

      renderer = new THREE.WebGLRenderer({
        antialias: (window.devicePixelRatio || 1) < 2,
        alpha: false,
        powerPreference: 'high-performance',
      })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setClearColor('#cfeef3')
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.shadowMap.enabled = false
      renderer.domElement.setAttribute('aria-hidden', 'true')
      renderer.domElement.style.display = 'block'
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      host.appendChild(renderer.domElement)

      const ground = new THREE.Mesh(groundGeometry, groundMaterial)
      ground.name = 'toy-mat'
      ground.rotation.x = -Math.PI / 2
      ground.position.y = -0.08
      scene.add(ground)
      const grid = new THREE.GridHelper(WORLD_SIZE, 25, '#80b981', '#a9d39d')
      grid.position.y = 0.01
      scene.add(grid)
      scene.add(railRoot)
      const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial)
      markerMesh.rotation.x = -Math.PI / 2
      markerMesh.position.y = 0.02
      marker.add(markerMesh)
      scene.add(marker)
      scene.add(new THREE.HemisphereLight('#fff7d6', '#4f7c56', 1.8))
      const directional = new THREE.DirectionalLight('#fff8e7', 2.1)
      directional.position.set(8, 18, 10)
      scene.add(directional)
      resize()
      syncPieces(optionsRef.current.pieces, optionsRef.current.selectedPieceId)
      syncSceneRef.current = syncPieces
      syncZoomRef.current = (zoom) => updateZoom(zoom, false)

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(host)
      } else {
        window.addEventListener('resize', resize)
      }
      window.addEventListener('orientationchange', resize)
      host.addEventListener('pointerdown', handlePointerDown, { passive: false })
      host.addEventListener('pointermove', handlePointerMove, { passive: false })
      host.addEventListener('pointerup', handlePointerUp, { passive: false })
      host.addEventListener('pointercancel', handlePointerCancel, { passive: false })
      host.addEventListener('wheel', handleWheel, { passive: false })
      host.addEventListener('contextmenu', handleContextMenu)

      const render = () => {
        if (released || renderer === null || scene === null || camera === null) return
        renderer.render(scene, camera)
        rafId = window.requestAnimationFrame(render)
      }
      rafId = window.requestAnimationFrame(render)
    } catch {
      // WebGLが無効なテスト環境や端末でも、DOM UIは操作できるようにする。
      if (renderer !== null) {
        try {
          renderer.dispose()
        } catch {
          // 初期化途中のrendererはdisposeできないことがある。
        }
        renderer = null
      }
    }

    return () => {
      released = true
      syncSceneRef.current = null
      syncZoomRef.current = null
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      resizeObserver?.disconnect()
      if (resizeObserver === null) window.removeEventListener('resize', resize)
      window.removeEventListener('orientationchange', resize)
      host.removeEventListener('pointerdown', handlePointerDown)
      host.removeEventListener('pointermove', handlePointerMove)
      host.removeEventListener('pointerup', handlePointerUp)
      host.removeEventListener('pointercancel', handlePointerCancel)
      host.removeEventListener('wheel', handleWheel)
      host.removeEventListener('contextmenu', handleContextMenu)
      if (scene !== null) {
        scene.remove(railRoot)
        // GridHelperなどの非共有資源はツリー走査で一度だけ回収する。
        disposeObjectTree(scene, sharedGeometries, sharedMaterials)
      }
      sharedGeometries.forEach((geometry) => geometry.dispose())
      sharedMaterials.forEach((material) => material.dispose())
      const canvas = renderer?.domElement ?? host.querySelector('canvas')
      if (renderer !== null) {
        try {
          renderer.dispose()
        } catch {
          // 既に破棄されたrendererでもDOMと他の資源は回収する。
        }
        try {
          renderer.forceContextLoss()
        } catch {
          // WebGLモックや既に失われたコンテキストでは不要。
        }
      }
      canvas?.remove()
      scene = null
      camera = null
      renderer = null
    }
  }, [])

  return handle
}
