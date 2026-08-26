import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  clampRailPosition,
  connectRailPieces,
  disconnectRailPiece,
  findRailSnapNearMiss,
  findRailSnapCandidate,
  type RailConnectorId,
  type RailPiece,
  type RailVec3,
  type SnapNearMiss,
  type SnapCandidate,
  worldConnectorForRailPiece,
  worldRailPathPoint,
} from './railModel'
import {
  createInitialRailTrainMotion,
  getOccupiedRailPieceIds,
  sampleRailTrainCars,
  sampleRailTrainPose,
  startRailTrain,
  updateRailTrainMotion,
  type RailTrainMotion,
  type RailTrainStatus,
} from './railTrainModel'

const WORLD_SIZE = 50
const WORLD_HALF_SIZE = WORLD_SIZE / 2
const PAN_LIMIT = 15
export const ZOOM_STEP = 0.14
// 元のズーム範囲(0.72〜1.75)の上下に、+/-ボタン3段階ぶんずつ広げる
export const MIN_ZOOM = 0.72 - ZOOM_STEP * 3
export const MAX_ZOOM = 1.75 + ZOOM_STEP * 3
const DEFAULT_ZOOM = 1
const BASE_VIEW_SIZE = 15
const POINTER_MOVE_THRESHOLD = 6

export type RailBuilderEngineOptions = {
  pieces: readonly RailPiece[]
  selectedPieceId: string | null
  zoom: number
  onPiecesChange: (pieces: RailPiece[]) => void
  onSelectPiece: (pieceId: string | null) => void
  onZoomChange?: (zoom: number) => void
  lockedPieceIds?: ReadonlySet<string>
  onTrainStatusChange?: (status: RailTrainStatus) => void
  onTrainOccupiedIdsChange?: (pieceIds: string[]) => void
}

export type RailBuilderEngineHandle = {
  registerContainer: (element: HTMLDivElement | null) => void
  getCameraTarget: () => RailVec3
  startTrain: () => void
  focusTrain: () => void
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
  nearMiss: SnapNearMiss | null
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
  const startTrainRef = useRef<(() => void) | null>(null)
  const focusTrainRef = useRef<(() => void) | null>(null)

  const registerContainer = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element
  }, [])

  const getCameraTarget = useCallback((): RailVec3 => ({ ...cameraTargetRef.current }), [])

  const startTrain = useCallback(() => {
    startTrainRef.current?.()
  }, [])

  const focusTrain = useCallback(() => {
    focusTrainRef.current?.()
  }, [])

  const handle = useMemo<RailBuilderEngineHandle>(
    () => ({ registerContainer, getCameraTarget, startTrain, focusTrain }),
    [focusTrain, getCameraTarget, registerContainer, startTrain],
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
    const trainRoot = new THREE.Group()
    trainRoot.name = 'toy-train'
    const trainCars: THREE.Group[] = []
    const sharedGeometries = new Set<THREE.BufferGeometry>()
    const sharedMaterials = new Set<THREE.Material>()

    const railGeometry = new THREE.BoxGeometry(1, 0.16, 0.14)
    const baseGeometry = new THREE.BoxGeometry(1.05, 0.14, 0.9)
    const sleeperGeometry = new THREE.BoxGeometry(1.65, 0.16, 0.58)
    const connectorGeometry = new THREE.CylinderGeometry(0.27, 0.27, 0.18, 16)
    const selectionRingGeometry = new THREE.RingGeometry(0.72, 0.82, 32)
    const markerGeometry = new THREE.RingGeometry(0.35, 0.48, 24)
    const trainBodyGeometry = new THREE.BoxGeometry(2.15, 0.78, 0.92)
    const trainFrontGeometry = new THREE.BoxGeometry(0.25, 0.82, 0.94)
    const trainRoofGeometry = new THREE.BoxGeometry(2.28, 0.16, 1.02)
    const trainWindowGeometry = new THREE.BoxGeometry(0.42, 0.28, 0.04)
    const trainFrontWindowGeometry = new THREE.BoxGeometry(0.04, 0.28, 0.54)
    const trainDoorGeometry = new THREE.BoxGeometry(0.36, 0.57, 0.035)
    const trainWheelGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.13, 16)
    const trainCouplerGeometry = new THREE.BoxGeometry(0.34, 0.16, 0.16)
    const bridgeBeamGeometry = new THREE.BoxGeometry(1, 0.26, 0.38)
    const bridgeSupportGeometry = new THREE.BoxGeometry(0.42, 1, 0.42)
    const bridgeGuardGeometry = new THREE.BoxGeometry(1, 0.16, 0.13)
    const stationPlatformGeometry = new THREE.BoxGeometry(1, 0.28, 1.12)
    const stationRoofGeometry = new THREE.BoxGeometry(1, 0.22, 3.2)
    const stationColumnGeometry = new THREE.BoxGeometry(0.2, 1, 0.2)
    const stationSignGeometry = new THREE.BoxGeometry(0.86, 0.58, 0.14)
    const stationBenchGeometry = new THREE.BoxGeometry(0.78, 0.18, 0.25)
    const tunnelTopGeometry = new THREE.BoxGeometry(1, 0.34, 2.75)
    const tunnelWallGeometry = new THREE.BoxGeometry(1, 1.25, 0.26)
    const tunnelRingGeometry = new THREE.TorusGeometry(1.4, 0.13, 8, 18)
    ;[
      railGeometry,
      baseGeometry,
      sleeperGeometry,
      connectorGeometry,
      selectionRingGeometry,
      markerGeometry,
      trainBodyGeometry,
      trainFrontGeometry,
      trainRoofGeometry,
      trainWindowGeometry,
      trainFrontWindowGeometry,
      trainDoorGeometry,
      trainWheelGeometry,
      trainCouplerGeometry,
      bridgeBeamGeometry,
      bridgeSupportGeometry,
      bridgeGuardGeometry,
      stationPlatformGeometry,
      stationRoofGeometry,
      stationColumnGeometry,
      stationSignGeometry,
      stationBenchGeometry,
      tunnelTopGeometry,
      tunnelWallGeometry,
      tunnelRingGeometry,
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
    const trainBodyMaterial = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.58 })
    const trainFrontMaterial = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.55 })
    const trainRoofMaterial = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.7 })
    const trainWindowMaterial = new THREE.MeshStandardMaterial({ color: '#67e8f9', roughness: 0.24, metalness: 0.12 })
    const trainDoorMaterial = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.68 })
    const trainWheelMaterial = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.85 })
    const trainCouplerMaterial = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.8 })
    const bridgeMaterial = new THREE.MeshStandardMaterial({ color: '#b77945', roughness: 0.82 })
    const bridgeGuardMaterial = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.64 })
    const stationPlatformMaterial = new THREE.MeshStandardMaterial({ color: '#f4c96b', roughness: 0.76 })
    const stationRoofMaterial = new THREE.MeshStandardMaterial({ color: '#ef6b73', roughness: 0.64 })
    const stationColumnMaterial = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.7 })
    const stationSignMaterial = new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.54 })
    const stationBenchMaterial = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.8 })
    const tunnelMaterial = new THREE.MeshStandardMaterial({ color: '#818cf8', roughness: 0.8 })
    const tunnelInnerMaterial = new THREE.MeshStandardMaterial({ color: '#6366f1', roughness: 0.86 })
    ;[
      railMaterial,
      baseMaterial,
      sleeperMaterial,
      connectorMaterial,
      selectionMaterial,
      markerMaterial,
      trainBodyMaterial,
      trainFrontMaterial,
      trainRoofMaterial,
      trainWindowMaterial,
      trainDoorMaterial,
      trainWheelMaterial,
      trainCouplerMaterial,
      bridgeMaterial,
      bridgeGuardMaterial,
      stationPlatformMaterial,
      stationRoofMaterial,
      stationColumnMaterial,
      stationSignMaterial,
      stationBenchMaterial,
      tunnelMaterial,
      tunnelInnerMaterial,
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
    const trainForwardVector = new THREE.Vector3()
    const trainBaseForward = new THREE.Vector3(1, 0, 0)
    const segmentTangentVector = new THREE.Vector3()
    const trainYawAxis = new THREE.Vector3(0, 1, 0)
    const trainPitchAxis = new THREE.Vector3(0, 0, 1)
    const trainYawQuaternion = new THREE.Quaternion()
    const trainPitchQuaternion = new THREE.Quaternion()
    const pointers = new Map<number, PointerPosition>()
    let activeZoom = clampZoom(optionsRef.current.zoom || DEFAULT_ZOOM)
    let mode: 'none' | 'pan' | 'rail' | 'pinch' = 'none'
    let panLastGround: RailVec3 | null = null
    let drag: DragState | null = null
    let pinchStartDistance = 0
    let pinchStartZoom = activeZoom
    let trainPieces: readonly RailPiece[] = optionsRef.current.pieces
    let trainMotion: RailTrainMotion | null = createInitialRailTrainMotion(trainPieces)
    let lastTrainStatus: RailTrainStatus | null = null
    let lastOccupiedKey = ''
    let lastFrameTime = typeof performance === 'undefined' ? 0 : performance.now()

    function updateCamera() {
      if (camera === null) return
      const rect = host.getBoundingClientRect()
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)
      const aspect = width / height
      const viewSize = BASE_VIEW_SIZE / activeZoom
      // 縦横どちらの向きでも見え方の拡大率が揃うよう、短い辺の方をviewSizeに固定する。
      const viewWidth = aspect >= 1 ? viewSize * aspect : viewSize
      const viewHeight = aspect >= 1 ? viewSize : viewSize / aspect
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

    function setMarker(feedback: SnapCandidate | SnapNearMiss | null) {
      marker.visible = feedback !== null
      markerMaterial.color.set(feedback === null || 'transform' in feedback ? '#fef08a' : '#fb7185')
      if (feedback === null) return
      const targetPiece = optionsRef.current.pieces.find((piece) => piece.id === feedback.targetPieceId)
      if (targetPiece === undefined) return
      const target = worldConnectorForRailPiece(targetPiece, feedback.targetConnectorId)
      marker.position.set(target.position.x, target.position.y + 0.38, target.position.z)
    }

    function updateSelection(selectedPieceId: string | null) {
      for (const [pieceId, ring] of selectionRings) {
        ring.visible = pieceId === selectedPieceId
      }
    }

    function makeTrainCar(index: number): THREE.Group {
      const group = new THREE.Group()
      group.name = index === 0 ? 'train-lead-car' : `train-car-${index + 1}`

      const body = new THREE.Mesh(trainBodyGeometry, trainBodyMaterial)
      body.position.y = 0.84
      group.add(body)

      const front = new THREE.Mesh(trainFrontGeometry, trainFrontMaterial)
      front.position.set(1.1, 0.86, 0)
      group.add(front)

      const roof = new THREE.Mesh(trainRoofGeometry, trainRoofMaterial)
      roof.position.y = 1.31
      group.add(roof)

      for (const side of [-1, 1]) {
        for (const x of [-0.52, 0.18]) {
          const window = new THREE.Mesh(trainWindowGeometry, trainWindowMaterial)
          window.position.set(x, 1.02, side * 0.48)
          group.add(window)
        }
        const door = new THREE.Mesh(trainDoorGeometry, trainDoorMaterial)
        door.position.set(-0.78, 0.72, side * 0.49)
        group.add(door)
      }

      const frontWindow = new THREE.Mesh(trainFrontWindowGeometry, trainWindowMaterial)
      frontWindow.position.set(1.23, 1.04, 0)
      group.add(frontWindow)

      for (const x of [-0.67, 0.67]) {
        for (const side of [-1, 1]) {
          const wheel = new THREE.Mesh(trainWheelGeometry, trainWheelMaterial)
          wheel.position.set(x, 0.34, side * 0.5)
          wheel.rotation.x = Math.PI / 2
          group.add(wheel)
        }
      }

      const coupler = new THREE.Mesh(trainCouplerGeometry, trainCouplerMaterial)
      coupler.position.set(-1.25, 0.62, 0)
      group.add(coupler)
      trainRoot.add(group)
      trainCars.push(group)
      return group
    }

    for (let index = 0; index < 2; index += 1) makeTrainCar(index)

    function updateTrainVisuals() {
      if (trainMotion === null) {
        trainRoot.visible = false
        return
      }
      const poses = sampleRailTrainCars(trainPieces, trainMotion.cursor, trainCars.length)
      trainRoot.visible = poses.length > 0
      for (const [index, car] of trainCars.entries()) {
        const pose = poses[index]
        if (pose === undefined) {
          car.visible = false
          continue
        }
        car.visible = true
        car.position.set(pose.position.x, pose.position.y, pose.position.z)
        trainForwardVector.set(pose.forward.x, pose.forward.y, pose.forward.z).normalize()
        // yawとpitchだけで車体を経路接線へ合わせる。+Xから直接
        // setFromUnitVectorsすると、yaw+pitchの組み合わせによって
        // rollが混ざり得るため、玩具車両が横倒しにならないよう分解する。
        const yaw = Math.atan2(-trainForwardVector.z, trainForwardVector.x)
        const horizontalLength = Math.hypot(trainForwardVector.x, trainForwardVector.z)
        const pitch = Math.atan2(trainForwardVector.y, horizontalLength)
        trainYawQuaternion.setFromAxisAngle(trainYawAxis, yaw)
        trainPitchQuaternion.setFromAxisAngle(trainPitchAxis, pitch)
        car.quaternion.copy(trainYawQuaternion).multiply(trainPitchQuaternion)
      }
    }

    function reportTrainState() {
      const status = trainMotion?.status ?? 'ready'
      if (status !== lastTrainStatus) {
        lastTrainStatus = status
        optionsRef.current.onTrainStatusChange?.(status)
      }
      const occupied = trainMotion === null
        ? []
        : getOccupiedRailPieceIds(trainPieces, trainMotion.cursor, trainCars.length)
      const occupiedKey = occupied.join('\u0000')
      if (occupiedKey !== lastOccupiedKey) {
        lastOccupiedKey = occupiedKey
        optionsRef.current.onTrainOccupiedIdsChange?.(occupied)
      }
    }

    function startTrainNow() {
      if (trainMotion === null) trainMotion = createInitialRailTrainMotion(trainPieces)
      if (trainMotion !== null) trainMotion = startRailTrain(trainMotion)
      updateTrainVisuals()
      reportTrainState()
    }

    function focusTrainNow() {
      if (trainMotion === null) return
      const pose = sampleRailTrainPose(trainPieces, trainMotion.cursor)
      if (pose !== null) setCameraTarget(pose.position)
    }

    startTrainRef.current = startTrainNow
    focusTrainRef.current = focusTrainNow

    function addPieceFacilityDetails(group: THREE.Group, localPiece: RailPiece) {
      const pieceId = localPiece.id
      const addMesh = (
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        position: RailVec3,
        scale?: RailVec3,
        rotation?: RailVec3,
      ) => {
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(position.x, position.y, position.z)
        if (scale !== undefined) mesh.scale.set(scale.x, scale.y, scale.z)
        if (rotation !== undefined) mesh.rotation.set(rotation.x, rotation.y, rotation.z)
        mesh.userData.pieceId = pieceId
        group.add(mesh)
        return mesh
      }

      const addOrientedPathMesh = (
        geometry: THREE.BufferGeometry,
        material: THREE.Material,
        t0: number,
        t1: number,
        localY: number,
        localZ: number,
      ) => {
        const p0 = worldRailPathPoint(localPiece, t0)
        const p1 = worldRailPathPoint(localPiece, t1)
        const midpoint = vec3((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2)
        const tangent = vec3(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z)
        const tangentLength = Math.hypot(tangent.x, tangent.y, tangent.z) || 1
        const segment = new THREE.Group()
        segment.position.set(midpoint.x, midpoint.y, midpoint.z)
        segmentTangentVector.set(tangent.x, tangent.y, tangent.z).normalize()
        segment.quaternion.setFromUnitVectors(trainBaseForward, segmentTangentVector)
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(0, localY, localZ)
        mesh.scale.x = Math.max(0.4, tangentLength)
        mesh.userData.pieceId = pieceId
        segment.add(mesh)
        group.add(segment)
      }

      if (localPiece.kind === 'bridge') {
        const segmentCount = 4
        for (let index = 0; index < segmentCount; index += 1) {
          const t0 = index / segmentCount
          const t1 = (index + 1) / segmentCount
          addOrientedPathMesh(bridgeBeamGeometry, bridgeMaterial, t0, t1, -0.36, 0)
          addOrientedPathMesh(bridgeGuardGeometry, bridgeGuardMaterial, t0, t1, 0.82, -0.72)
          addOrientedPathMesh(bridgeGuardGeometry, bridgeGuardMaterial, t0, t1, 0.82, 0.72)
        }
        for (const t of [0.18, 0.5, 0.82]) {
          const point = worldRailPathPoint(localPiece, t)
          const supportHeight = Math.max(0.75, point.y)
          addMesh(
            bridgeSupportGeometry,
            bridgeMaterial,
            { x: point.x, y: supportHeight / 2 - 0.02, z: point.z },
            { x: 1, y: supportHeight, z: 1 },
          )
        }
      }

      if (localPiece.kind === 'station') {
        const stationCenter = worldRailPathPoint(localPiece, 0.5)
        const stationLength = localPiece.path.kind === 'straight' ? localPiece.path.length : 7
        for (const side of [-1, 1]) {
          addMesh(
            stationPlatformGeometry,
            stationPlatformMaterial,
            { x: stationCenter.x, y: stationCenter.y + 0.18, z: stationCenter.z + side * 1.12 },
            { x: stationLength * 0.92, y: 1, z: 1 },
          )
        }
        addMesh(
          stationRoofGeometry,
          stationRoofMaterial,
          { x: stationCenter.x, y: stationCenter.y + 2.45, z: stationCenter.z },
          { x: stationLength * 0.9, y: 1, z: 1 },
        )
        for (const x of [-2.35, 2.35]) {
          for (const z of [-1.18, 1.18]) {
            addMesh(
              stationColumnGeometry,
              stationColumnMaterial,
              { x: stationCenter.x + x, y: stationCenter.y + 1.22, z: stationCenter.z + z },
              { x: 1, y: 2.44, z: 1 },
            )
          }
        }
        addMesh(
          stationSignGeometry,
          stationSignMaterial,
          { x: stationCenter.x, y: stationCenter.y + 2.12, z: stationCenter.z + 1.54 },
        )
        addMesh(
          stationBenchGeometry,
          stationBenchMaterial,
          { x: stationCenter.x, y: stationCenter.y + 0.56, z: stationCenter.z + 1.12 },
          { x: 1, y: 1, z: 1 },
        )
      }

      if (localPiece.kind === 'tunnel' && localPiece.path.kind === 'straight') {
        const tunnelLength = localPiece.path.length
        // 上部は中央を開けた2本の屋根梁にして、上方カメラからも
        // トンネル内部と列車を見失いにくくする。
        for (const side of [-1, 1]) {
          addMesh(
            tunnelTopGeometry,
            tunnelMaterial,
            { x: 0, y: 1.62, z: side * 0.9 },
            { x: tunnelLength, y: 1, z: 0.22 },
          )
        }
        for (const side of [-1, 1]) {
          addMesh(
            tunnelWallGeometry,
            tunnelInnerMaterial,
            { x: 0, y: 0.78, z: side * 1.26 },
            { x: tunnelLength, y: 1, z: 1 },
          )
        }
        for (const x of [-tunnelLength / 2, tunnelLength / 2]) {
          addMesh(
            tunnelRingGeometry,
            tunnelMaterial,
            { x, y: 1.0, z: 0 },
            { x: 1, y: 1, z: 1 },
            { x: 0, y: Math.PI / 2, z: 0 },
          )
        }
      }
    }

    function makePieceObject(piece: RailPiece): THREE.Group {
      const group = new THREE.Group()
      group.name = `rail-${piece.id}`
      group.userData.pieceId = piece.id

      const segmentCount = piece.kind === 'curve'
        ? 12
        : piece.kind === 'slope'
          ? 16
          : piece.kind === 'bridge' || piece.kind === 'station' || piece.kind === 'tunnel'
            ? 8
            : 1
      const sleeperEvery = piece.kind === 'curve' || piece.kind === 'slope' ? 2 : 1
      const localPiece = { ...piece, position: vec3(0, 0, 0), rotationY: 0 }
      for (let i = 0; i < segmentCount; i += 1) {
        const t0 = i / segmentCount
        const t1 = (i + 1) / segmentCount
        const p0 = worldRailPathPoint(localPiece, t0)
        const p1 = worldRailPathPoint(localPiece, t1)
        const midpoint = vec3((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2)
        const tangent = vec3(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z)
        const tangentLength = Math.hypot(tangent.x, tangent.y, tangent.z) || 1
        segmentTangentVector.set(tangent.x, tangent.y, tangent.z).normalize()
        const segment = new THREE.Group()
        segment.position.set(midpoint.x, midpoint.y, midpoint.z)
        segment.quaternion.setFromUnitVectors(trainBaseForward, segmentTangentVector)

        const base = new THREE.Mesh(baseGeometry, baseMaterial)
        base.position.y = 0.1
        base.scale.x = Math.max(0.55, tangentLength)
        base.userData.pieceId = piece.id
        segment.add(base)

        for (const side of [-1, 1]) {
          const rail = new THREE.Mesh(railGeometry, railMaterial)
          rail.position.set(0, 0.34, 0.46 * side)
          rail.scale.x = Math.max(0.55, tangentLength)
          rail.userData.pieceId = piece.id
          segment.add(rail)
        }

        if (i % sleeperEvery === 0) {
          const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial)
          sleeper.position.y = 0.2
          sleeper.userData.pieceId = piece.id
          segment.add(sleeper)
        }
        group.add(segment)
      }

      for (const connectorId of ['a', 'b'] as RailConnectorId[]) {
        const connector = worldConnectorForRailPiece(localPiece, connectorId)
        const cap = new THREE.Mesh(connectorGeometry, connectorMaterial)
        cap.position.set(connector.position.x, connector.position.y + 0.25, connector.position.z)
        cap.userData.pieceId = piece.id
        group.add(cap)
      }

      addPieceFacilityDetails(group, localPiece)

      const selectionRing = new THREE.Mesh(selectionRingGeometry, selectionMaterial)
      selectionRing.name = 'selection-ring'
      selectionRing.rotation.x = -Math.PI / 2
      const ringCenter = worldRailPathPoint(localPiece, 0.5)
      selectionRing.position.set(ringCenter.x, ringCenter.y + 0.43, ringCenter.z)
      selectionRing.visible = piece.id === optionsRef.current.selectedPieceId
      selectionRing.userData.pieceId = piece.id
      group.add(selectionRing)
      selectionRings.set(piece.id, selectionRing)
      return group
    }

    function syncPieces(pieces: readonly RailPiece[], selectedPieceId: string | null) {
      trainPieces = pieces
      if (trainMotion === null && pieces.length > 0) trainMotion = createInitialRailTrainMotion(pieces)
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
      updateTrainVisuals()
      reportTrainState()
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
        if (optionsRef.current.lockedPieceIds?.has(selectedPieceId)) {
          mode = 'none'
          drag = null
          return
        }
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
            nearMiss: null,
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
        const snapTargets = drag.layout.filter((piece) => piece.id !== drag?.pieceId)
        const candidate = findRailSnapCandidate(rawPiece, snapTargets)
        const nearMiss = candidate === null
          ? findRailSnapNearMiss(rawPiece, snapTargets)
          : null
        drag.candidate = candidate
        drag.nearMiss = nearMiss
        drag.currentPiece = candidate === null
          ? rawPiece
          : { ...rawPiece, position: { ...candidate.transform.position }, rotationY: candidate.transform.rotationY }
        moveDragObject(drag.currentPiece)
        setMarker(candidate ?? nearMiss)
        return
      }

      if (mode === 'pan' && panLastGround !== null) {
        const ground = intersectGround(event)
        if (ground === null) return
        const delta = subtract(panLastGround, ground)
        setCameraTarget(add(cameraTarget, delta))
        // カメラ移動範囲の端でクランプされた場合、生のraycast結果をそのまま
        // 次回の基準にすると実際のカメラ位置とズレてがたつくため、
        // クランプ後のカメラで再計算した地面座標を基準にする。
        panLastGround = intersectGround(event) ?? ground
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
      scene.add(trainRoot)
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
        const now = typeof performance === 'undefined' ? lastFrameTime : performance.now()
        const delta = lastFrameTime <= 0 ? 0 : Math.min(0.1, Math.max(0, (now - lastFrameTime) / 1000))
        lastFrameTime = now
        if (trainMotion !== null && delta > 0) {
          trainMotion = updateRailTrainMotion(trainMotion, trainPieces, delta)
          updateTrainVisuals()
          reportTrainState()
        }
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
      startTrainRef.current = null
      focusTrainRef.current = null
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
