import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {
  applyRailLoopClosure,
  clampRailPosition,
  connectRailPieces,
  DEPOT_LENGTH,
  DEPOT_TRACK_SPACING,
  disconnectRailPiece,
  findRailLoopClosureCandidate,
  findRailSnapNearMiss,
  findRailSnapCandidate,
  getRailConnectorIds,
  type RailConnectorId,
  type RailPath,
  type RailPiece,
  type RailVec3,
  type SnapNearMiss,
  type SnapCandidate,
  worldConnectorForRailPiece,
  worldRailPathPoint,
} from './railModel'
import {
  findNearestRailTrainCursor,
  sampleRailTrainCars,
  sampleRailTrainPose,
  type RailTrainCursor,
  type RailTrainStatus,
} from './railTrainModel'
import {
  addRailFleetTrain,
  createInitialRailFleet,
  moveRailFleetTrainTo,
  occupiedRailFleetPieceIds,
  removeRailFleetTrain,
  setRailFleetTrainRunning,
  setRailFleetTrainType,
  summarizeRailFleet,
  updateRailFleet,
  type RailFleetTrain,
  type RailFleetTrainSummary,
  type TrainType,
} from './railFleetModel'
import {
  getRailBuilderDevicePixelRatio,
  getRailBuilderShadowMapSize,
  RAIL_VISUAL_CONFIG,
  shouldReduceRailBuilderMotion,
} from './railBuilderVisuals'
import {
  E5_LEAD_SHELL_SECTIONS,
  getTrainCarVisualProfile,
  getE5LeadShellAccentBand,
  resolveTrainVisualProfile,
  type TrainCarVisualProfile,
  type TrainShellSection,
  type TrainVisualProfile,
} from './railTrainVisuals'
import {
  createRailTrainSoundController,
  playRailDepartureSound,
  playRailSnapSound,
  playRailStationDepartureSound,
  playRailStationStopSound,
  primeAudio,
  type RailTrainSoundController,
} from '../../utils/quizSound'

const WORLD_SIZE = 50
const WORLD_HALF_SIZE = WORLD_SIZE / 2
const PAN_LIMIT = WORLD_HALF_SIZE - 4
export const ZOOM_STEP = 0.14
// 元のズーム範囲(0.72〜1.75)の上下に、+/-ボタン3段階ぶんずつ広げる
export const MIN_ZOOM = 0.72 - ZOOM_STEP * 3
export const MAX_ZOOM = 1.75 + ZOOM_STEP * 3
const DEFAULT_ZOOM = 1
const BASE_VIEW_SIZE = 15
const POINTER_MOVE_THRESHOLD = 6
// ドラッグで電車を線路上へ置き直すときの当たり判定の許容距離。
const TRAIN_DRAG_MAX_DISTANCE = 8

export type RailBuilderEngineOptions = {
  pieces: readonly RailPiece[]
  selectedPieceId: string | null
  selectedTrainId: string | null
  zoom: number
  onPiecesChange: (pieces: RailPiece[]) => void
  onSelectPiece: (pieceId: string | null) => void
  onSelectTrain: (trainId: string | null) => void
  onZoomChange?: (zoom: number) => void
  lockedPieceIds?: ReadonlySet<string>
  onTrainStatusChange?: (status: RailTrainStatus) => void
  onFleetChange?: (trains: RailFleetTrainSummary[]) => void
  onTrainOccupiedIdsChange?: (pieceIds: string[]) => void
  /** レール専用音量。共有 quizSound の global 設定を変更せずに切り替える。 */
  soundEnabled?: boolean
}

export type RailBuilderEngineHandle = {
  registerContainer: (element: HTMLDivElement | null) => void
  getCameraTarget: () => RailVec3
  startTrain: (trainId: string) => void
  pauseTrain: (trainId: string) => void
  addTrain: (trainType?: TrainType) => void
  removeTrain: (trainId?: string) => void
  focusTrain: (trainId: string) => void
  focusDepot: () => void
  /** Phase 3の車両選択UIから、既存列車の見た目(trainType)だけを差し替えるためのAPI。 */
  setTrainType: (trainId: string, trainType: TrainType) => void
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

type TrainDragState = {
  pointerId: number
  trainId: string
  /** 掴んだ瞬間にいたpiece。置いた先が違う場合だけスナップ音を鳴らす。 */
  startPieceId: string
  lastCursor: RailTrainCursor
  lastForward: RailVec3 | null
}

type TrainVisualRuntime = {
  root: THREE.Group
  cars: THREE.Group[]
  wheelPivots: THREE.Object3D[][]
  trainType: TrainType
  bodyMaterial: THREE.MeshStandardMaterial
  frontMaterial: THREE.MeshStandardMaterial
  roofMaterial: THREE.MeshStandardMaterial
  windowMaterial: THREE.MeshStandardMaterial
  accentMaterial: THREE.MeshStandardMaterial | null
  roofFeatureMaterial: THREE.MeshStandardMaterial | null
}

type SpecialTrainVisualDefinition = {
  profile: TrainVisualProfile
  noseGeometry?: THREE.BufferGeometry
  leadBodyGeometry: THREE.BufferGeometry
  middleBodyGeometry: THREE.BufferGeometry
  leadRoofGeometry: THREE.BufferGeometry
  middleRoofGeometry: THREE.BufferGeometry
  sideWindowGeometry: THREE.BufferGeometry
  cockpitWindowGeometry: THREE.BufferGeometry
  accentGeometry: THREE.BufferGeometry
  /** Optional accent ribbon following an integrated lead shell's side width. */
  leadAccentGeometry?: THREE.BufferGeometry
  /** Optional E5-only low-cost details; future train types can opt in as needed. */
  splitNoseColor?: boolean
  /** Lead body geometry already includes the nose and must be rendered as one shell. */
  integratedLeadShell?: boolean
  sideCockpitWindows?: boolean
  underfloorGeometry?: THREE.BufferGeometry
  bogieGeometry?: THREE.BufferGeometry
  gangwayGeometry?: THREE.BufferGeometry
  wheelGeometry?: THREE.BufferGeometry
  roofFeatureGeometry?: THREE.BufferGeometry
}

type SpecialTrainVisualMaterials = {
  bodyMaterial: THREE.MeshStandardMaterial
  frontMaterial: THREE.MeshStandardMaterial
  roofMaterial: THREE.MeshStandardMaterial
  windowMaterial: THREE.MeshStandardMaterial
  accentMaterial: THREE.MeshStandardMaterial
  roofFeatureMaterial?: THREE.MeshStandardMaterial
}

type BranchRouteVisual = {
  b: THREE.InstancedMesh
  c: THREE.InstancedMesh
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

function trainIdFromObject(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object
  while (current !== null) {
    const trainId = current.userData.trainId
    if (typeof trainId === 'string') return trainId
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

type NoseSection = TrainShellSection

type NoseStyle = TrainCarVisualProfile['noseStyle']

function noseSectionRing(section: NoseSection, style: NoseStyle): readonly [number, number][] {
  const halfWidth = section.width / 2
  const cornerWidth = Math.min(0.08, halfWidth * 0.3)
  const verticalRange = Math.max(0.01, section.top - section.bottom)
  const cornerHeight = Math.min(0.07, verticalRange * 0.28)
  if (style === 'e5-wide-wedge') {
    // E5 uses a softly rounded 12-point cross-section rather than a triangular
    // wedge.  The slightly proud top centre gives the roof a gentle crown while
    // the broad shoulder points keep the side silhouette full for most of the
    // nose length.
    const topCrown = Math.min(0.018, verticalRange * 0.06)
    const lowerCrown = Math.min(0.012, verticalRange * 0.04)
    return [
      [-halfWidth * 0.68, section.top - cornerHeight * 0.4],
      [-halfWidth * 0.32, section.top],
      [0, section.top + topCrown],
      [halfWidth * 0.32, section.top],
      [halfWidth * 0.68, section.top - cornerHeight * 0.4],
      [halfWidth, section.top - cornerHeight * 1.25],
      [halfWidth, section.bottom + cornerHeight * 1.15],
      [halfWidth * 0.7, section.bottom],
      [0, section.bottom - lowerCrown],
      [-halfWidth * 0.7, section.bottom],
      [-halfWidth, section.bottom + cornerHeight * 1.15],
      [-halfWidth, section.top - cornerHeight * 1.25],
    ]
  }
  if (style === 'e6-spear') {
    // E6は細い中央稜線を作り、E5の幅広wedgeとは別の断面にする。
    const ridgeHalfWidth = Math.min(0.07, halfWidth * 0.22)
    const ridgeHeight = Math.min(0.07, verticalRange * 0.2)
    return [
      [-halfWidth + cornerWidth, section.top],
      [-ridgeHalfWidth, section.top + ridgeHeight],
      [ridgeHalfWidth, section.top + ridgeHeight],
      [halfWidth - cornerWidth, section.top],
      [halfWidth, section.top - cornerHeight],
      [halfWidth, section.bottom + cornerHeight],
      [halfWidth - cornerWidth, section.bottom],
      [-halfWidth + cornerWidth, section.bottom],
      [-halfWidth, section.bottom + cornerHeight],
      [-halfWidth, section.top - cornerHeight],
    ]
  }
  if (style === 'n700s-winged') {
    // N700Sは中ほどだけ左右へ張り出す二枚翼状の上縁にする。
    const wingOffset = halfWidth * 0.58
    const wingLift = Math.min(0.055, verticalRange * 0.2)
    return [
      [-halfWidth + cornerWidth, section.top],
      [-wingOffset, section.top + wingLift],
      [0, section.top + wingLift * 0.2],
      [wingOffset, section.top + wingLift],
      [halfWidth - cornerWidth, section.top],
      [halfWidth, section.top - cornerHeight],
      [halfWidth, section.bottom + cornerHeight],
      [halfWidth - cornerWidth, section.bottom],
      [-halfWidth + cornerWidth, section.bottom],
      [-halfWidth, section.bottom + cornerHeight],
      [-halfWidth, section.top - cornerHeight],
    ]
  }
  return [
    [-halfWidth + cornerWidth, section.top],
    [halfWidth - cornerWidth, section.top],
    [halfWidth, section.top - cornerHeight],
    [halfWidth, section.bottom + cornerHeight],
    [halfWidth - cornerWidth, section.bottom],
    [-halfWidth + cornerWidth, section.bottom],
    [-halfWidth, section.bottom + cornerHeight],
    [-halfWidth, section.top - cornerHeight],
  ]
}

/** 複数断面の低ポリゴンnose。geometryはeffect初期化時にだけ生成する。 */
function createNoseGeometry(
  sections: readonly NoseSection[],
  style: NoseStyle,
  splitE5Color = false,
): THREE.BufferGeometry {
  const positions: number[] = []
  const rings = sections.map((section) => noseSectionRing(section, style))
  const sectionSize = rings[0]?.length ?? 0
  if (sectionSize === 0) return new THREE.BufferGeometry()
  for (const [sectionIndex, ring] of rings.entries()) {
    const section = sections[sectionIndex]!
    // All styles intentionally keep the same small ring count; there are no
    // per-frame tessellation or high-segment objects in the render loop.
    for (const [z, y] of ring) positions.push(section.x, y, z)
  }

  const indices: number[] = []
  const upperIndices: number[] = []
  const lowerIndices: number[] = []
  for (let sectionIndex = 0; sectionIndex < rings.length - 1; sectionIndex += 1) {
    const currentOffset = sectionIndex * sectionSize
    const nextOffset = (sectionIndex + 1) * sectionSize
    for (let pointIndex = 0; pointIndex < sectionSize; pointIndex += 1) {
      const nextPointIndex = (pointIndex + 1) % sectionSize
      const targetIndices = splitE5Color
        ? (pointIndex <= 4 || pointIndex === sectionSize - 1 ? upperIndices : lowerIndices)
        : indices
      targetIndices.push(
        currentOffset + pointIndex,
        currentOffset + nextPointIndex,
        nextOffset + pointIndex,
        currentOffset + nextPointIndex,
        nextOffset + nextPointIndex,
        nextOffset + pointIndex,
      )
    }
  }
  // End caps keep the tapered nose closed without adding a high segment count.
  for (const sectionIndex of [0, rings.length - 1]) {
    const offset = sectionIndex * sectionSize
    const centerIndex = positions.length / 3
    const section = sections[sectionIndex]!
    positions.push(section.x, (section.top + section.bottom) / 2, 0)
    for (let pointIndex = 0; pointIndex < sectionSize; pointIndex += 1) {
      const nextPointIndex = (pointIndex + 1) % sectionSize
      const targetIndices = splitE5Color
        ? (pointIndex <= 4 || pointIndex === sectionSize - 1 ? upperIndices : lowerIndices)
        : indices
      targetIndices.push(
        centerIndex,
        offset + (sectionIndex === 0 ? nextPointIndex : pointIndex),
        offset + (sectionIndex === 0 ? pointIndex : nextPointIndex),
      )
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const geometryIndices = splitE5Color ? upperIndices.concat(lowerIndices) : indices
  geometry.setIndex(geometryIndices)
  if (splitE5Color) {
    // Keep E5's green upper / light lower split to two draw groups, even though
    // the low-poly loft has many individual surface strips.
    geometry.addGroup(0, upperIndices.length, 0)
    geometry.addGroup(upperIndices.length, lowerIndices.length, 1)
  }
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** E5先頭車の12断面・12頂点リングの連続ロフトシェル。 */
function createE5LeadShellGeometry(): THREE.BufferGeometry {
  return createNoseGeometry(E5_LEAD_SHELL_SECTIONS, 'e5-wide-wedge', true)
}

/** E5先頭シェルの断面幅と上下端に沿う、両側面の薄いピンク帯。 */
function createE5LeadAccentGeometry(height: number, centerY: number): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const sectionSize = 4
  const shellInset = 0.002
  const stripDepth = 0.03

  for (const side of [-1, 1]) {
    for (const section of E5_LEAD_SHELL_SECTIONS) {
      const band = getE5LeadShellAccentBand(section, height, centerY)
      const innerZ = side * (section.width / 2 + shellInset)
      const outerZ = side * (section.width / 2 + shellInset + stripDepth)
      positions.push(
        section.x, band.lowerY, innerZ,
        section.x, band.upperY, innerZ,
        section.x, band.upperY, outerZ,
        section.x, band.lowerY, outerZ,
      )
    }

    const sideOffset = side === -1 ? 0 : E5_LEAD_SHELL_SECTIONS.length * sectionSize
    for (let sectionIndex = 0; sectionIndex < E5_LEAD_SHELL_SECTIONS.length - 1; sectionIndex += 1) {
      const current = sideOffset + sectionIndex * sectionSize
      const next = current + sectionSize
      // Keep the visible outer face wound away from the shell so the default
      // FrontSide material renders both side strips from outside.
      const outerFace = side === 1
        ? [current + 3, next + 3, next + 2, current + 3, next + 2, current + 2]
        : [current + 2, next + 2, next + 3, current + 2, next + 3, current + 3]
      const innerFace = side === 1
        ? [current, next + 1, next, current, current + 1, next + 1]
        : [current, next, next + 1, current, next + 1, current + 1]
      indices.push(...outerFace, ...innerFace)
      indices.push(
        current,
        current + 3,
        next + 3,
        current,
        next + 3,
        next,
        current + 1,
        next + 1,
        next + 2,
        current + 1,
        next + 2,
        current + 2,
      )
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** Shared low-poly rounded loft used by the E5 body and future train variants. */
function createE5BodyGeometry(profile: TrainCarVisualProfile): THREE.BufferGeometry {
  const halfLength = profile.bodyLength / 2
  return createNoseGeometry([
    { x: -halfLength, top: profile.bodyHeight / 2, bottom: -profile.bodyHeight / 2, width: profile.bodyWidth },
    { x: -halfLength * 0.72, top: profile.bodyHeight / 2, bottom: -profile.bodyHeight / 2, width: profile.bodyWidth },
    { x: halfLength * 0.72, top: profile.bodyHeight / 2, bottom: -profile.bodyHeight / 2, width: profile.bodyWidth },
    { x: halfLength, top: profile.bodyHeight / 2, bottom: -profile.bodyHeight / 2, width: profile.bodyWidth },
  ], 'e5-wide-wedge')
}

/** A shallow side window with a rearward-sloping top edge, used on E5 only. */
function createSlantedWindowGeometry(width: number, height: number, depth: number, topOffset: number): THREE.BufferGeometry {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const halfDepth = depth / 2
  const positions = [
    -halfWidth, -halfHeight, halfDepth,
    halfWidth, -halfHeight, halfDepth,
    halfWidth + topOffset, halfHeight, halfDepth,
    -halfWidth + topOffset, halfHeight, halfDepth,
    -halfWidth, -halfHeight, -halfDepth,
    halfWidth, -halfHeight, -halfDepth,
    halfWidth + topOffset, halfHeight, -halfDepth,
    -halfWidth + topOffset, halfHeight, -halfDepth,
  ]
  const indices = [
    0, 1, 2, 0, 2, 3,
    5, 4, 7, 5, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function createE6NoseGeometry(profile: TrainCarVisualProfile): THREE.BufferGeometry {
  return createNoseGeometry([
    {
      x: profile.noseBaseX,
      top: profile.noseBaseTopY,
      bottom: profile.noseBaseBottomY,
      width: profile.noseBaseWidth,
    },
    {
      x: profile.noseBaseX + profile.noseLength * 0.34,
      top: profile.noseBaseTopY - 0.02,
      bottom: profile.noseBaseBottomY + 0.04,
      width: profile.noseBaseWidth * 0.78,
    },
    {
      x: profile.noseTipX,
      top: profile.noseTipTopY,
      bottom: profile.noseTipBottomY,
      width: profile.noseTipWidth,
    },
  ], 'e6-spear')
}

function createN700SNoseGeometry(profile: TrainCarVisualProfile): THREE.BufferGeometry {
  return createNoseGeometry([
    {
      x: profile.noseBaseX,
      top: profile.noseBaseTopY,
      bottom: profile.noseBaseBottomY,
      width: profile.noseBaseWidth,
    },
    {
      x: profile.noseBaseX + profile.noseLength * 0.32,
      top: profile.noseBaseTopY - 0.04,
      bottom: profile.noseBaseBottomY + 0.02,
      width: profile.bodyWidth,
    },
    {
      x: profile.noseTipX,
      top: profile.noseTipTopY,
      bottom: profile.noseTipBottomY,
      width: profile.noseTipWidth,
    },
  ], 'n700s-winged')
}

function createDoctorYellowNoseGeometry(profile: TrainCarVisualProfile): THREE.BufferGeometry {
  return createNoseGeometry([
    {
      x: profile.noseBaseX,
      top: profile.noseBaseTopY,
      bottom: profile.noseBaseBottomY,
      width: profile.noseBaseWidth,
    },
    {
      x: profile.noseBaseX + profile.noseLength * 0.28,
      top: profile.noseBaseTopY + 0.05,
      bottom: profile.noseBaseBottomY + 0.01,
      width: profile.noseBaseWidth,
    },
    {
      x: profile.noseTipX,
      top: profile.noseTipTopY,
      bottom: profile.noseTipBottomY,
      width: profile.noseTipWidth,
    },
  ], 'doctor-yellow-duck')
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
  const startTrainRef = useRef<((trainId: string) => void) | null>(null)
  const pauseTrainRef = useRef<((trainId: string) => void) | null>(null)
  const addTrainRef = useRef<((trainType?: TrainType) => void) | null>(null)
  const removeTrainRef = useRef<((trainId?: string) => void) | null>(null)
  const focusTrainRef = useRef<((trainId: string) => void) | null>(null)
  const focusDepotRef = useRef<(() => void) | null>(null)
  const setTrainTypeRef = useRef<((trainId: string, trainType: TrainType) => void) | null>(null)

  const registerContainer = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element
  }, [])

  const getCameraTarget = useCallback((): RailVec3 => ({ ...cameraTargetRef.current }), [])

  const startTrain = useCallback((trainId: string) => {
    startTrainRef.current?.(trainId)
  }, [])

  const pauseTrain = useCallback((trainId: string) => {
    pauseTrainRef.current?.(trainId)
  }, [])

  const addTrain = useCallback((trainType?: TrainType) => {
    addTrainRef.current?.(trainType)
  }, [])

  const removeTrain = useCallback((trainId?: string) => {
    removeTrainRef.current?.(trainId)
  }, [])

  const focusTrain = useCallback((trainId: string) => {
    focusTrainRef.current?.(trainId)
  }, [])

  const focusDepot = useCallback(() => {
    focusDepotRef.current?.()
  }, [])

  const setTrainType = useCallback((trainId: string, trainType: TrainType) => {
    setTrainTypeRef.current?.(trainId, trainType)
  }, [])

  const handle = useMemo<RailBuilderEngineHandle>(
    () => ({
      registerContainer,
      getCameraTarget,
      startTrain,
      pauseTrain,
      addTrain,
      removeTrain,
      focusTrain,
      focusDepot,
      setTrainType,
    }),
    [
      addTrain,
      focusDepot,
      focusTrain,
      getCameraTarget,
      pauseTrain,
      registerContainer,
      removeTrain,
      setTrainType,
      startTrain,
    ],
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
    const dioramaRoot = new THREE.Group()
    dioramaRoot.name = 'diorama-root'
    const pieceObjects = new Map<string, THREE.Group>()
    const selectionRings = new Map<string, THREE.Mesh>()
    const connectorCaps = new Map<string, Partial<Record<RailConnectorId, THREE.Mesh>>>()
    const stationPulseTargets = new Map<string, THREE.Object3D>()
    const marker = new THREE.Group()
    marker.name = 'snap-marker'
    marker.visible = false // 起動直後は原点にリングを出さない（setMarker() が呼ばれるまで非表示）
    let snapGlow: THREE.Mesh | null = null
    const trainRoot = new THREE.Group()
    trainRoot.name = 'toy-train-fleet'
    const trainVisuals = new Map<string, TrainVisualRuntime>()
    const branchRouteVisuals = new Map<string, BranchRouteVisual>()
    const sharedGeometries = new Set<THREE.BufferGeometry>()
    const sharedMaterials = new Set<THREE.Material>()

    const railGeometry = new THREE.BoxGeometry(1, 0.16, 0.14)
    const baseGeometry = new THREE.BoxGeometry(1.05, 0.14, 0.9)
    const sleeperGeometry = new THREE.BoxGeometry(1.65, 0.16, 0.58)
    const connectorGeometry = new THREE.CylinderGeometry(0.27, 0.27, 0.18, 16)
    const selectionRingGeometry = new THREE.RingGeometry(0.72, 0.82, 32)
    const markerGeometry = new THREE.RingGeometry(0.35, 0.48, 24)
    const trainBodyGeometry = new RoundedBoxGeometry(2.15, 0.78, 0.92, 2, 0.14)
    const trainFrontGeometry = new RoundedBoxGeometry(0.3, 0.7, 0.88, 2, 0.12)
    const trainRoofGeometry = new RoundedBoxGeometry(2.22, 0.16, 1.0, 2, 0.06)
    const trainSkirtGeometry = new RoundedBoxGeometry(1.7, 0.2, 0.84, 2, 0.07)
    const trainWindowGeometry = new THREE.BoxGeometry(0.42, 0.28, 0.04)
    const trainFrontWindowGeometry = new THREE.BoxGeometry(0.04, 0.28, 0.54)
    const trainDoorGeometry = new THREE.BoxGeometry(0.36, 0.57, 0.035)
    const trainDoorFrameGeometry = new THREE.BoxGeometry(0.44, 0.65, 0.022)
    const trainWheelGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.13, 16)
    const trainCouplerGeometry = new THREE.BoxGeometry(0.34, 0.16, 0.16)
    const trainLightGeometry = new THREE.SphereGeometry(0.09, 8, 6)
    const e5Profile = resolveTrainVisualProfile('e5')
    const e5LeadBodyGeometry = createE5LeadShellGeometry()
    const e5MiddleBodyGeometry = createE5BodyGeometry(e5Profile.middle)
    const e5LeadRoofGeometry = new RoundedBoxGeometry(
      e5Profile.lead.roofLength,
      e5Profile.lead.roofHeight,
      e5Profile.lead.roofWidth,
      2,
      0.06,
    )
    const e5MiddleRoofGeometry = new RoundedBoxGeometry(
      e5Profile.middle.roofLength,
      e5Profile.middle.roofHeight,
      e5Profile.middle.roofWidth,
      2,
      0.06,
    )
    const e5SideWindowGeometry = new THREE.BoxGeometry(
      e5Profile.window.sideWidth,
      e5Profile.window.sideHeight,
      0.04,
    )
    const e5CockpitWindowGeometry = createSlantedWindowGeometry(
      e5Profile.lead.frontWindowWidth,
      0.2,
      0.04,
      -0.1,
    )
    const e5AccentGeometry = new THREE.BoxGeometry(1, e5Profile.accent.height, 0.04)
    const e5LeadAccentGeometry = createE5LeadAccentGeometry(e5Profile.accent.height, e5Profile.accent.y)
    // E5-only details remain shared for the effect lifetime.  They are shallow
    // rounded blocks so the underframe reads clearly without a mesh per bolt.
    const e5UnderfloorGeometry = new RoundedBoxGeometry(1.42, 0.14, 0.7, 1, 0.04)
    const e5BogieGeometry = new RoundedBoxGeometry(0.5, 0.14, 0.64, 1, 0.04)
    const e5GangwayGeometry = new RoundedBoxGeometry(0.16, 0.28, 0.48, 1, 0.035)
    const e5WheelGeometry = new THREE.CylinderGeometry(0.16, 0.16, 0.11, 12)
    const e6Profile = resolveTrainVisualProfile('e6')
    const e6NoseGeometry = createE6NoseGeometry(e6Profile.lead)
    const e6LeadBodyGeometry = new RoundedBoxGeometry(
      e6Profile.lead.bodyLength,
      e6Profile.lead.bodyHeight,
      e6Profile.lead.bodyWidth,
      2,
      0.12,
    )
    const e6MiddleBodyGeometry = new RoundedBoxGeometry(
      e6Profile.middle.bodyLength,
      e6Profile.middle.bodyHeight,
      e6Profile.middle.bodyWidth,
      2,
      0.12,
    )
    const e6LeadRoofGeometry = new RoundedBoxGeometry(
      e6Profile.lead.roofLength,
      e6Profile.lead.roofHeight,
      e6Profile.lead.roofWidth,
      2,
      0.05,
    )
    const e6MiddleRoofGeometry = new RoundedBoxGeometry(
      e6Profile.middle.roofLength,
      e6Profile.middle.roofHeight,
      e6Profile.middle.roofWidth,
      2,
      0.05,
    )
    const e6SideWindowGeometry = new THREE.BoxGeometry(
      e6Profile.window.sideWidth,
      e6Profile.window.sideHeight,
      0.04,
    )
    const e6CockpitWindowGeometry = new THREE.BoxGeometry(0.04, 0.2, e6Profile.lead.frontWindowWidth)
    const e6AccentGeometry = new THREE.BoxGeometry(1, e6Profile.accent.height, 0.035)
    const n700sProfile = resolveTrainVisualProfile('n700s')
    const n700sNoseGeometry = createN700SNoseGeometry(n700sProfile.lead)
    const n700sLeadBodyGeometry = new RoundedBoxGeometry(
      n700sProfile.lead.bodyLength,
      n700sProfile.lead.bodyHeight,
      n700sProfile.lead.bodyWidth,
      2,
      0.14,
    )
    const n700sMiddleBodyGeometry = new RoundedBoxGeometry(
      n700sProfile.middle.bodyLength,
      n700sProfile.middle.bodyHeight,
      n700sProfile.middle.bodyWidth,
      2,
      0.14,
    )
    const n700sLeadRoofGeometry = new RoundedBoxGeometry(
      n700sProfile.lead.roofLength,
      n700sProfile.lead.roofHeight,
      n700sProfile.lead.roofWidth,
      2,
      0.06,
    )
    const n700sMiddleRoofGeometry = new RoundedBoxGeometry(
      n700sProfile.middle.roofLength,
      n700sProfile.middle.roofHeight,
      n700sProfile.middle.roofWidth,
      2,
      0.06,
    )
    const n700sSideWindowGeometry = new THREE.BoxGeometry(
      n700sProfile.window.sideWidth,
      n700sProfile.window.sideHeight,
      0.04,
    )
    const n700sCockpitWindowGeometry = new THREE.BoxGeometry(0.04, 0.22, n700sProfile.lead.frontWindowWidth)
    const n700sAccentGeometry = new THREE.BoxGeometry(1, n700sProfile.accent.height, 0.04)
    const doctorYellowProfile = resolveTrainVisualProfile('doctorYellow')
    const doctorYellowNoseGeometry = createDoctorYellowNoseGeometry(doctorYellowProfile.lead)
    const doctorYellowLeadBodyGeometry = new RoundedBoxGeometry(
      doctorYellowProfile.lead.bodyLength,
      doctorYellowProfile.lead.bodyHeight,
      doctorYellowProfile.lead.bodyWidth,
      2,
      0.16,
    )
    const doctorYellowMiddleBodyGeometry = new RoundedBoxGeometry(
      doctorYellowProfile.middle.bodyLength,
      doctorYellowProfile.middle.bodyHeight,
      doctorYellowProfile.middle.bodyWidth,
      2,
      0.16,
    )
    const doctorYellowLeadRoofGeometry = new RoundedBoxGeometry(
      doctorYellowProfile.lead.roofLength,
      doctorYellowProfile.lead.roofHeight,
      doctorYellowProfile.lead.roofWidth,
      2,
      0.07,
    )
    const doctorYellowMiddleRoofGeometry = new RoundedBoxGeometry(
      doctorYellowProfile.middle.roofLength,
      doctorYellowProfile.middle.roofHeight,
      doctorYellowProfile.middle.roofWidth,
      2,
      0.07,
    )
    const doctorYellowSideWindowGeometry = new THREE.BoxGeometry(
      doctorYellowProfile.window.sideWidth,
      doctorYellowProfile.window.sideHeight,
      0.04,
    )
    const doctorYellowCockpitWindowGeometry = new THREE.BoxGeometry(
      0.04,
      0.24,
      doctorYellowProfile.lead.frontWindowWidth,
    )
    const doctorYellowAccentGeometry = new THREE.BoxGeometry(1, doctorYellowProfile.accent.height, 0.04)
    const doctorYellowInspectionBoxGeometry = new RoundedBoxGeometry(0.48, 0.1, 0.36, 2, 0.04)
    const bridgeBeamGeometry = new THREE.BoxGeometry(1, 0.26, 0.38)
    const bridgeSupportGeometry = new THREE.BoxGeometry(0.42, 1, 0.42)
    const bridgeGuardGeometry = new THREE.BoxGeometry(1, 0.16, 0.13)
    const stationPlatformGeometry = new RoundedBoxGeometry(1, 0.28, 1.12, 2, 0.08)
    const stationRoofGeometry = new RoundedBoxGeometry(1, 0.22, 3.2, 2, 0.08)
    const stationColumnGeometry = new THREE.BoxGeometry(0.2, 1, 0.2)
    const stationSignGeometry = new THREE.BoxGeometry(0.86, 0.58, 0.14)
    const stationBenchGeometry = new THREE.BoxGeometry(0.78, 0.18, 0.25)
    const stationClockGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16)
    const tunnelTopGeometry = new THREE.BoxGeometry(1, 0.34, 2.75)
    const tunnelWallGeometry = new THREE.BoxGeometry(1, 1.25, 0.26)
    const tunnelRingGeometry = new THREE.TorusGeometry(1.4, 0.13, 8, 18)
    const treeTrunkGeometry = new THREE.CylinderGeometry(0.18, 0.24, 1.45, 8)
    const treeFoliageGeometry = new RoundedBoxGeometry(1.35, 1.55, 1.35, 2, 0.42)
    const shrubGeometry = new THREE.SphereGeometry(0.58, 8, 6)
    const houseBodyGeometry = new RoundedBoxGeometry(2.4, 1.45, 2.1, 2, 0.18)
    const houseRoofGeometry = new THREE.ConeGeometry(1.7, 0.85, 4)
    const houseWindowGeometry = new THREE.BoxGeometry(0.36, 0.42, 0.05)
    // 車庫パーツ(depot)の建物。屋根は中央部だけ・壁は腰高にして、
    // 斜め上から見下ろすカメラでも車庫の中の線路と電車が見えるようにする。
    const depotRoofLength = DEPOT_LENGTH * 0.62 // 屋根はx方向の中央部のみ。両端は大きく開ける
    const depotRoofDepth = DEPOT_TRACK_SPACING + 1.2
    const depotBodyGeometry = new THREE.BoxGeometry(depotRoofLength, 0.6, 0.2) // 側壁(腰高)
    const depotRoofGeometry = new THREE.BoxGeometry(depotRoofLength, 0.26, depotRoofDepth) // 屋根
    const depotDoorGeometry = new THREE.BoxGeometry(0.18, 2.06, 0.18) // 屋根を支える柱
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
      trainSkirtGeometry,
      trainWindowGeometry,
      trainFrontWindowGeometry,
      trainDoorGeometry,
      trainDoorFrameGeometry,
      trainWheelGeometry,
      trainCouplerGeometry,
      trainLightGeometry,
      e5LeadBodyGeometry,
      e5MiddleBodyGeometry,
      e5LeadRoofGeometry,
      e5MiddleRoofGeometry,
      e5SideWindowGeometry,
      e5CockpitWindowGeometry,
      e5AccentGeometry,
      e5LeadAccentGeometry,
      e5UnderfloorGeometry,
      e5BogieGeometry,
      e5GangwayGeometry,
      e5WheelGeometry,
      e6NoseGeometry,
      e6LeadBodyGeometry,
      e6MiddleBodyGeometry,
      e6LeadRoofGeometry,
      e6MiddleRoofGeometry,
      e6SideWindowGeometry,
      e6CockpitWindowGeometry,
      e6AccentGeometry,
      n700sNoseGeometry,
      n700sLeadBodyGeometry,
      n700sMiddleBodyGeometry,
      n700sLeadRoofGeometry,
      n700sMiddleRoofGeometry,
      n700sSideWindowGeometry,
      n700sCockpitWindowGeometry,
      n700sAccentGeometry,
      doctorYellowNoseGeometry,
      doctorYellowLeadBodyGeometry,
      doctorYellowMiddleBodyGeometry,
      doctorYellowLeadRoofGeometry,
      doctorYellowMiddleRoofGeometry,
      doctorYellowSideWindowGeometry,
      doctorYellowCockpitWindowGeometry,
      doctorYellowAccentGeometry,
      doctorYellowInspectionBoxGeometry,
      bridgeBeamGeometry,
      bridgeSupportGeometry,
      bridgeGuardGeometry,
      stationPlatformGeometry,
      stationRoofGeometry,
      stationColumnGeometry,
      stationSignGeometry,
      stationBenchGeometry,
      stationClockGeometry,
      tunnelTopGeometry,
      tunnelWallGeometry,
      tunnelRingGeometry,
      treeTrunkGeometry,
      treeFoliageGeometry,
      shrubGeometry,
      houseBodyGeometry,
      houseRoofGeometry,
      houseWindowGeometry,
      depotBodyGeometry,
      depotRoofGeometry,
      depotDoorGeometry,
    ].forEach((geometry) => sharedGeometries.add(geometry))

    const railMaterial = new THREE.MeshStandardMaterial({
      color: RAIL_VISUAL_CONFIG.palette.rail,
      roughness: RAIL_VISUAL_CONFIG.roughness,
      metalness: RAIL_VISUAL_CONFIG.metalness,
    })
    const branchSelectedRailMaterial = new THREE.MeshStandardMaterial({
      color: '#fde047',
      emissive: '#f59e0b',
      emissiveIntensity: 0.42,
      roughness: 0.48,
      metalness: 0.08,
    })
    const branchDimRailMaterial = new THREE.MeshStandardMaterial({
      color: '#64748b',
      roughness: 0.72,
      metalness: 0.04,
    })
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: RAIL_VISUAL_CONFIG.palette.base,
      roughness: RAIL_VISUAL_CONFIG.roughness,
    })
    const sleeperMaterial = new THREE.MeshStandardMaterial({
      color: RAIL_VISUAL_CONFIG.palette.sleeper,
      roughness: RAIL_VISUAL_CONFIG.roughness,
    })
    const connectorMaterial = new THREE.MeshStandardMaterial({
      color: RAIL_VISUAL_CONFIG.palette.connector,
      roughness: RAIL_VISUAL_CONFIG.roughness,
    })
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
    const snapMaterial = new THREE.MeshBasicMaterial({
      color: '#fb923c',
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    })
    snapGlow = new THREE.Mesh(markerGeometry, snapMaterial)
    snapGlow.name = 'snap-glow'
    snapGlow.rotation.x = -Math.PI / 2
    snapGlow.visible = false
    // 選択中の電車がいるときだけ光る輪。パーツのselectionRingsと同じ見た目を流用する。
    const trainSelectionRing = new THREE.Mesh(selectionRingGeometry, selectionMaterial)
    trainSelectionRing.name = 'train-selection-ring'
    trainSelectionRing.rotation.x = -Math.PI / 2
    trainSelectionRing.visible = false
    const trainBodyMaterial = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.58 })
    const trainFrontMaterial = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.55 })
    const trainRoofMaterial = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.7 })
    const e5BodyMaterial = new THREE.MeshStandardMaterial({ color: e5Profile.bodyColor, roughness: 0.58 })
    const e5FrontMaterial = new THREE.MeshStandardMaterial({ color: e5Profile.frontColor, roughness: 0.5 })
    const e5RoofMaterial = new THREE.MeshStandardMaterial({ color: e5Profile.roofColor, roughness: 0.7 })
    const trainWindowMaterial = new THREE.MeshStandardMaterial({ color: '#67e8f9', roughness: 0.24, metalness: 0.12 })
    const trainDoorMaterial = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.68 })
    const trainWheelMaterial = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.85 })
    const trainCouplerMaterial = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.8 })
    const trainLightMaterial = new THREE.MeshStandardMaterial({
      color: '#fff7ae',
      emissive: '#facc15',
      emissiveIntensity: 0.7,
      roughness: 0.3,
    })
    // E5の外装色は編成間で共有する。type変更で車両を再構築しても、
    // render中に新規materialを増やさず、effect終了時に確実に解放できる。
    const e5AccentMaterial = new THREE.MeshStandardMaterial({
      color: e5Profile.accent.color,
      roughness: 0.52,
    })
    const e5WindowMaterial = new THREE.MeshStandardMaterial({
      color: e5Profile.window.color,
      roughness: 0.28,
      metalness: 0.08,
    })
    const e6BodyMaterial = new THREE.MeshStandardMaterial({ color: e6Profile.bodyColor, roughness: 0.58 })
    const e6FrontMaterial = new THREE.MeshStandardMaterial({ color: e6Profile.frontColor, roughness: 0.5 })
    const e6RoofMaterial = new THREE.MeshStandardMaterial({ color: e6Profile.roofColor, roughness: 0.7 })
    const e6AccentMaterial = new THREE.MeshStandardMaterial({ color: e6Profile.accent.color, roughness: 0.48, metalness: 0.28 })
    const e6WindowMaterial = new THREE.MeshStandardMaterial({ color: e6Profile.window.color, roughness: 0.25, metalness: 0.12 })
    const n700sBodyMaterial = new THREE.MeshStandardMaterial({ color: n700sProfile.bodyColor, roughness: 0.6 })
    const n700sFrontMaterial = new THREE.MeshStandardMaterial({ color: n700sProfile.frontColor, roughness: 0.52 })
    const n700sRoofMaterial = new THREE.MeshStandardMaterial({ color: n700sProfile.roofColor, roughness: 0.7 })
    const n700sAccentMaterial = new THREE.MeshStandardMaterial({ color: n700sProfile.accent.color, roughness: 0.48 })
    const n700sWindowMaterial = new THREE.MeshStandardMaterial({ color: n700sProfile.window.color, roughness: 0.26, metalness: 0.12 })
    const doctorYellowBodyMaterial = new THREE.MeshStandardMaterial({ color: doctorYellowProfile.bodyColor, roughness: 0.58 })
    const doctorYellowFrontMaterial = new THREE.MeshStandardMaterial({ color: doctorYellowProfile.frontColor, roughness: 0.5 })
    const doctorYellowRoofMaterial = new THREE.MeshStandardMaterial({ color: doctorYellowProfile.roofColor, roughness: 0.7 })
    const doctorYellowAccentMaterial = new THREE.MeshStandardMaterial({ color: doctorYellowProfile.accent.color, roughness: 0.46 })
    const doctorYellowWindowMaterial = new THREE.MeshStandardMaterial({ color: doctorYellowProfile.window.color, roughness: 0.27, metalness: 0.1 })
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
      branchSelectedRailMaterial,
      branchDimRailMaterial,
      baseMaterial,
      sleeperMaterial,
      connectorMaterial,
      selectionMaterial,
      markerMaterial,
      snapMaterial,
      trainBodyMaterial,
      trainFrontMaterial,
      trainRoofMaterial,
      e5BodyMaterial,
      e5FrontMaterial,
      e5RoofMaterial,
      trainLightMaterial,
      trainWindowMaterial,
      trainDoorMaterial,
      trainWheelMaterial,
      trainCouplerMaterial,
      e5AccentMaterial,
      e5WindowMaterial,
      e6BodyMaterial,
      e6FrontMaterial,
      e6RoofMaterial,
      e6AccentMaterial,
      e6WindowMaterial,
      n700sBodyMaterial,
      n700sFrontMaterial,
      n700sRoofMaterial,
      n700sAccentMaterial,
      n700sWindowMaterial,
      doctorYellowBodyMaterial,
      doctorYellowFrontMaterial,
      doctorYellowRoofMaterial,
      doctorYellowAccentMaterial,
      doctorYellowWindowMaterial,
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

    const specialTrainVisualDefinitions: ReadonlyMap<Exclude<TrainType, 'basic'>, SpecialTrainVisualDefinition> = new Map([
      ['e5', {
        profile: e5Profile,
        leadBodyGeometry: e5LeadBodyGeometry,
        middleBodyGeometry: e5MiddleBodyGeometry,
        leadRoofGeometry: e5LeadRoofGeometry,
        middleRoofGeometry: e5MiddleRoofGeometry,
        sideWindowGeometry: e5SideWindowGeometry,
        cockpitWindowGeometry: e5CockpitWindowGeometry,
        accentGeometry: e5AccentGeometry,
        leadAccentGeometry: e5LeadAccentGeometry,
        integratedLeadShell: true,
        sideCockpitWindows: true,
        underfloorGeometry: e5UnderfloorGeometry,
        bogieGeometry: e5BogieGeometry,
        gangwayGeometry: e5GangwayGeometry,
        wheelGeometry: e5WheelGeometry,
      }],
      ['e6', {
        profile: e6Profile,
        noseGeometry: e6NoseGeometry,
        leadBodyGeometry: e6LeadBodyGeometry,
        middleBodyGeometry: e6MiddleBodyGeometry,
        leadRoofGeometry: e6LeadRoofGeometry,
        middleRoofGeometry: e6MiddleRoofGeometry,
        sideWindowGeometry: e6SideWindowGeometry,
        cockpitWindowGeometry: e6CockpitWindowGeometry,
        accentGeometry: e6AccentGeometry,
      }],
      ['n700s', {
        profile: n700sProfile,
        noseGeometry: n700sNoseGeometry,
        leadBodyGeometry: n700sLeadBodyGeometry,
        middleBodyGeometry: n700sMiddleBodyGeometry,
        leadRoofGeometry: n700sLeadRoofGeometry,
        middleRoofGeometry: n700sMiddleRoofGeometry,
        sideWindowGeometry: n700sSideWindowGeometry,
        cockpitWindowGeometry: n700sCockpitWindowGeometry,
        accentGeometry: n700sAccentGeometry,
      }],
      ['doctorYellow', {
        profile: doctorYellowProfile,
        noseGeometry: doctorYellowNoseGeometry,
        leadBodyGeometry: doctorYellowLeadBodyGeometry,
        middleBodyGeometry: doctorYellowMiddleBodyGeometry,
        leadRoofGeometry: doctorYellowLeadRoofGeometry,
        middleRoofGeometry: doctorYellowMiddleRoofGeometry,
        sideWindowGeometry: doctorYellowSideWindowGeometry,
        cockpitWindowGeometry: doctorYellowCockpitWindowGeometry,
        accentGeometry: doctorYellowAccentGeometry,
        roofFeatureGeometry: doctorYellowInspectionBoxGeometry,
      }],
    ])

    const specialTrainVisualMaterials: ReadonlyMap<Exclude<TrainType, 'basic'>, SpecialTrainVisualMaterials> = new Map([
      ['e5', {
        bodyMaterial: e5BodyMaterial,
        frontMaterial: e5FrontMaterial,
        roofMaterial: e5RoofMaterial,
        windowMaterial: e5WindowMaterial,
        accentMaterial: e5AccentMaterial,
      }],
      ['e6', {
        bodyMaterial: e6BodyMaterial,
        frontMaterial: e6FrontMaterial,
        roofMaterial: e6RoofMaterial,
        windowMaterial: e6WindowMaterial,
        accentMaterial: e6AccentMaterial,
      }],
      ['n700s', {
        bodyMaterial: n700sBodyMaterial,
        frontMaterial: n700sFrontMaterial,
        roofMaterial: n700sRoofMaterial,
        windowMaterial: n700sWindowMaterial,
        accentMaterial: n700sAccentMaterial,
      }],
      ['doctorYellow', {
        bodyMaterial: doctorYellowBodyMaterial,
        frontMaterial: doctorYellowFrontMaterial,
        roofMaterial: doctorYellowRoofMaterial,
        windowMaterial: doctorYellowWindowMaterial,
        accentMaterial: doctorYellowAccentMaterial,
        roofFeatureMaterial: doctorYellowAccentMaterial,
      }],
    ])

    const groundGeometry = new THREE.BoxGeometry(WORLD_SIZE, 0.48, WORLD_SIZE)
    const groundMaterial = new THREE.MeshStandardMaterial({ color: '#9bd18b', roughness: 0.9 })
    const groundEdgeMaterial = new THREE.MeshStandardMaterial({ color: '#82b875', roughness: 0.94 })
    const treeTrunkMaterial = new THREE.MeshStandardMaterial({ color: '#9a633d', roughness: 0.9 })
    const treeFoliageMaterial = new THREE.MeshStandardMaterial({ color: '#4f9d62', roughness: 0.84 })
    const shrubMaterial = new THREE.MeshStandardMaterial({ color: '#72b86a', roughness: 0.88 })
    const houseBodyMaterial = new THREE.MeshStandardMaterial({ color: '#f3b56b', roughness: 0.8 })
    const houseBodyAccentMaterial = new THREE.MeshStandardMaterial({ color: '#ef9d7a', roughness: 0.8 })
    const houseBodyPaleMaterial = new THREE.MeshStandardMaterial({ color: '#f4c96b', roughness: 0.8 })
    const houseRoofMaterial = new THREE.MeshStandardMaterial({ color: '#d96b63', roughness: 0.82 })
    const houseWindowMaterial = new THREE.MeshStandardMaterial({ color: '#75d4e6', roughness: 0.4, metalness: 0.08 })
    const depotBodyMaterial = new THREE.MeshStandardMaterial({ color: '#f8cf78', roughness: 0.76 }) // 壁
    const depotRoofMaterial = new THREE.MeshStandardMaterial({ color: '#ef6b73', roughness: 0.66 }) // 屋根
    const depotDoorMaterial = new THREE.MeshStandardMaterial({ color: '#486a78', roughness: 0.72 }) // 柱
    sharedGeometries.add(groundGeometry)
    ;[
      groundMaterial,
      groundEdgeMaterial,
      treeTrunkMaterial,
      treeFoliageMaterial,
      shrubMaterial,
      houseBodyMaterial,
      houseBodyAccentMaterial,
      houseBodyPaleMaterial,
      houseRoofMaterial,
      houseWindowMaterial,
      depotBodyMaterial,
      depotRoofMaterial,
      depotDoorMaterial,
    ].forEach((material) => sharedMaterials.add(material))

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
    const selectionAnchorVector = new THREE.Vector3()
    const instanceMatrix = new THREE.Matrix4()
    const instanceQuaternion = new THREE.Quaternion()
    const instanceScale = new THREE.Vector3()
    const instancePosition = new THREE.Vector3()
    const instanceDummy = new THREE.Object3D()
    const pointers = new Map<number, PointerPosition>()
    let activeZoom = clampZoom(optionsRef.current.zoom || DEFAULT_ZOOM)
    let mode: 'none' | 'pan' | 'rail' | 'pinch' | 'train' = 'none'
    let panLastGround: RailVec3 | null = null
    let drag: DragState | null = null
    let trainDrag: TrainDragState | null = null
    let pinchStartDistance = 0
    let pinchStartZoom = activeZoom
    let trainPieces: readonly RailPiece[] = optionsRef.current.pieces
    let fleet: RailFleetTrain[] = createInitialRailFleet(trainPieces, 1)
    const lastTrainStatuses = new Map<string, RailTrainStatus>()
    let lastFleetKey = ''
    let lastOccupiedKey = ''
    let followedTrainId: string | null = null
    let lastFrameTime = typeof performance === 'undefined' ? 0 : performance.now()
    const trainSound: RailTrainSoundController = createRailTrainSoundController(
      optionsRef.current.soundEnabled ?? true,
    )
    let snapGlowElapsed = Number.POSITIVE_INFINITY
    let stationPulseElapsed = Number.POSITIVE_INFINITY
    let stationPulsePieceId: string | null = null
    const reducedMotion = typeof window.matchMedia === 'function'
      ? shouldReduceRailBuilderMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      : false

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

    function pickTrain(event: PointerEvent): string | null {
      if (camera === null || scene === null) return null
      getPointerNdc(event)
      raycaster.setFromCamera(pointer, camera)
      const intersections = raycaster.intersectObjects(trainRoot.children, true)
      for (const intersection of intersections) {
        const trainId = trainIdFromObject(intersection.object)
        if (trainId !== null) return trainId
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

    /** 選択中の電車の下に光る輪を出す。走行中も追従できるよう毎フレーム呼ぶ。 */
    function updateTrainSelectionRing(selectedTrainId: string | null) {
      const runtime = selectedTrainId === null ? undefined : trainVisuals.get(selectedTrainId)
      const leadCar = runtime?.cars[0]
      if (leadCar === undefined || !leadCar.visible) {
        trainSelectionRing.visible = false
        return
      }
      leadCar.getWorldPosition(selectionAnchorVector)
      trainSelectionRing.position.set(selectionAnchorVector.x, selectionAnchorVector.y + 0.12, selectionAnchorVector.z)
      trainSelectionRing.visible = true
    }

    function makeBasicTrainCar(runtime: TrainVisualRuntime, trainId: string, index: number): THREE.Group {
      const group = new THREE.Group()
      group.name = index === 0 ? `${trainId}-lead-car` : `${trainId}-car-${index + 1}`
      group.userData.trainId = trainId

      const body = new THREE.Mesh(trainBodyGeometry, runtime.bodyMaterial)
      body.position.y = 0.84
      body.castShadow = true
      body.receiveShadow = true
      group.add(body)

      const front = new THREE.Mesh(trainFrontGeometry, runtime.frontMaterial)
      front.position.set(1.06, 0.85, 0)
      front.castShadow = true
      group.add(front)

      const skirt = new THREE.Mesh(trainSkirtGeometry, trainCouplerMaterial)
      skirt.position.set(-0.03, 0.44, 0)
      group.add(skirt)

      const roof = new THREE.Mesh(trainRoofGeometry, runtime.roofMaterial)
      roof.position.y = 1.31
      roof.castShadow = true
      group.add(roof)

      for (const side of [-1, 1]) {
        for (const x of [-0.52, 0.18]) {
          const window = new THREE.Mesh(trainWindowGeometry, trainWindowMaterial)
          window.position.set(x, 1.02, side * 0.48)
          group.add(window)
        }
        const doorFrame = new THREE.Mesh(trainDoorFrameGeometry, trainCouplerMaterial)
        doorFrame.position.set(-0.78, 0.72, side * 0.495)
        group.add(doorFrame)
        const door = new THREE.Mesh(trainDoorGeometry, trainDoorMaterial)
        door.position.set(-0.78, 0.72, side * 0.51)
        group.add(door)
      }

      const frontWindow = new THREE.Mesh(trainFrontWindowGeometry, trainWindowMaterial)
      frontWindow.position.set(1.23, 1.04, 0)
      group.add(frontWindow)

      for (const side of [-1, 1]) {
        const headlight = new THREE.Mesh(trainLightGeometry, trainLightMaterial)
        headlight.position.set(1.24, 0.8, side * 0.27)
        group.add(headlight)
      }

      const wheelPivots: THREE.Object3D[] = []
      for (const x of [-0.67, 0.67]) {
        for (const side of [-1, 1]) {
          const pivot = new THREE.Object3D()
          pivot.position.set(x, 0.34, side * 0.5)
          const wheel = new THREE.Mesh(trainWheelGeometry, trainWheelMaterial)
          wheel.rotation.x = Math.PI / 2
          pivot.add(wheel)
          group.add(pivot)
          wheelPivots.push(pivot)
        }
      }

      for (const x of [-1.25, 1.25]) {
        const coupler = new THREE.Mesh(trainCouplerGeometry, trainCouplerMaterial)
        coupler.position.set(x, 0.62, 0)
        group.add(coupler)
      }
      runtime.root.add(group)
      runtime.cars.push(group)
      runtime.wheelPivots.push(wheelPivots)
      return group
    }

    function makeSpecialTrainCar(
      runtime: TrainVisualRuntime,
      trainId: string,
      index: number,
      definition: SpecialTrainVisualDefinition,
    ): THREE.Group {
      const isLead = index === 0
      const profile = getTrainCarVisualProfile(runtime.trainType, isLead ? 'lead' : 'middle')
      const group = new THREE.Group()
      group.name = isLead ? `${trainId}-lead-car` : `${trainId}-car-${index + 1}`
      group.userData.trainId = trainId

      const bodyGeometry = isLead ? definition.leadBodyGeometry : definition.middleBodyGeometry
      const roofGeometry = isLead ? definition.leadRoofGeometry : definition.middleRoofGeometry
      const bodyMaterial: THREE.Material | THREE.Material[] = isLead && definition.integratedLeadShell
        ? [runtime.frontMaterial, runtime.bodyMaterial]
        : runtime.bodyMaterial
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
      if (!isLead || !definition.integratedLeadShell) {
        body.position.set(profile.bodyCenterX, profile.bodyCenterY, 0)
      }
      body.castShadow = true
      body.receiveShadow = true
      group.add(body)

      if (isLead && !definition.integratedLeadShell && definition.noseGeometry !== undefined) {
        // ノーズ形状の座標はgeometry内へ焼き込み済み。ここではoffsetを加えず、
        // 先頭車だけへ一つの共有nose meshを追加する。
        const noseMaterial: THREE.Material | THREE.Material[] = definition.splitNoseColor
          ? [runtime.frontMaterial, runtime.bodyMaterial]
          : runtime.frontMaterial
        const nose = new THREE.Mesh(definition.noseGeometry, noseMaterial)
        nose.castShadow = true
        nose.receiveShadow = true
        group.add(nose)
      }

      const skirt = new THREE.Mesh(trainSkirtGeometry, trainCouplerMaterial)
      skirt.position.set(profile.bodyCenterX, 0.43, 0)
      skirt.scale.x = profile.bodyLength / 1.7
      group.add(skirt)

      if (!isLead || !definition.integratedLeadShell) {
        const roof = new THREE.Mesh(roofGeometry, runtime.roofMaterial)
        roof.position.set(profile.roofCenterX, profile.roofCenterY, 0)
        roof.castShadow = true
        group.add(roof)
      }

      if (definition.underfloorGeometry !== undefined && definition.bogieGeometry !== undefined) {
        const underfloor = new THREE.Mesh(definition.underfloorGeometry, trainCouplerMaterial)
        underfloor.position.set(profile.bodyCenterX, 0.4, 0)
        group.add(underfloor)
        for (const x of [-0.63, 0.63]) {
          const bogie = new THREE.Mesh(definition.bogieGeometry, trainCouplerMaterial)
          bogie.position.set(profile.bodyCenterX + x, 0.31, 0)
          group.add(bogie)
        }
      }

      const accentMaterial = runtime.accentMaterial
      if (accentMaterial !== null && profile.accentLength > 0) {
        if (isLead && definition.integratedLeadShell && definition.leadAccentGeometry !== undefined) {
          // The integrated E5 shell narrows toward the tip, so the belt follows
          // each shell section instead of floating at the cabin width.
          const accent = new THREE.Mesh(definition.leadAccentGeometry, accentMaterial)
          group.add(accent)
        } else {
          for (const side of [-1, 1]) {
            const accent = new THREE.Mesh(definition.accentGeometry, accentMaterial)
            accent.position.set(profile.bodyCenterX, profile.accentY, side * (profile.bodyWidth / 2 + 0.012))
            accent.scale.x = profile.accentLength
            group.add(accent)
          }
        }
      }

      for (const side of [-1, 1]) {
        for (const x of profile.sideWindowXs) {
          const window = new THREE.Mesh(definition.sideWindowGeometry, runtime.windowMaterial)
          const sideOffset = isLead && definition.integratedLeadShell ? 0.008 : 0.014
          window.position.set(x, profile.sideWindowY, side * (profile.bodyWidth / 2 + sideOffset))
          group.add(window)
        }
        const doorX = runtime.trainType === 'e5'
          ? profile.bodyCenterX - profile.bodyLength * 0.34
          : profile.bodyCenterX - 0.4
        const doorFrame = new THREE.Mesh(trainDoorFrameGeometry, trainCouplerMaterial)
        doorFrame.position.set(doorX, 0.72, side * (profile.bodyWidth / 2 + 0.02))
        group.add(doorFrame)
        const door = new THREE.Mesh(trainDoorGeometry, trainDoorMaterial)
        door.position.set(doorX, 0.72, side * (profile.bodyWidth / 2 + 0.03))
        group.add(door)
      }

      if (profile.hasFrontWindow) {
        if (definition.sideCockpitWindows) {
          // E5の運転台窓は正面板ではなく、ノーズ肩に沿う左右の細長い
          // サイド窓。共通geometryを反転配置してメッシュ数を抑える。
          for (const side of [-1, 1]) {
            const cockpitWindow = new THREE.Mesh(definition.cockpitWindowGeometry, runtime.windowMaterial)
            // Follow the E5 shell's shallow side taper; mirror the lean on
            // the opposite side so both cockpit windows stay on the shell.
            cockpitWindow.rotation.y = side * 0.1
            cockpitWindow.position.set(
              profile.frontWindowX,
              profile.frontWindowY,
              side * (profile.bodyWidth / 2 + (definition.integratedLeadShell ? 0.008 : 0.014)),
            )
            group.add(cockpitWindow)
          }
        } else {
          // ノーズの先端ではなく、肩の根元寄りに置く運転台窓。
          const cockpitWindow = new THREE.Mesh(definition.cockpitWindowGeometry, runtime.windowMaterial)
          cockpitWindow.position.set(profile.frontWindowX, profile.frontWindowY, 0)
          group.add(cockpitWindow)
        }
      }

      if (profile.hasHeadlights) {
        for (const side of [-1, 1]) {
          const headlight = new THREE.Mesh(trainLightGeometry, trainLightMaterial)
          headlight.position.set(profile.headlightX, profile.headlightY, side * profile.headlightZ)
          group.add(headlight)
        }
      }

      if (isLead && definition.roofFeatureGeometry !== undefined && runtime.roofFeatureMaterial !== null) {
        // 検測箱は低く一個だけ。車体の上端制約を越えない位置に置く。
        const feature = new THREE.Mesh(definition.roofFeatureGeometry, runtime.roofFeatureMaterial)
        feature.position.set(profile.roofCenterX - 0.1, profile.roofCenterY + profile.roofHeight / 2 + 0.05, 0)
        group.add(feature)
      }

      const wheelPivots: THREE.Object3D[] = []
      const wheelGeometry = definition.wheelGeometry ?? trainWheelGeometry
      const wheelHalfWidth = definition.wheelGeometry === undefined ? 0.5 : 0.39
      for (const x of [-0.67, 0.67]) {
        for (const side of [-1, 1]) {
          const pivot = new THREE.Object3D()
          const wheelX = definition.wheelGeometry === undefined ? x : profile.bodyCenterX + x
          pivot.position.set(wheelX, 0.34, side * wheelHalfWidth)
          const wheel = new THREE.Mesh(wheelGeometry, trainWheelMaterial)
          wheel.rotation.x = Math.PI / 2
          pivot.add(wheel)
          group.add(pivot)
          wheelPivots.push(pivot)
        }
      }

      for (const x of profile.couplerPositions) {
        const coupler = new THREE.Mesh(trainCouplerGeometry, trainCouplerMaterial)
        coupler.position.set(x, 0.62, 0)
        group.add(coupler)
        if (definition.gangwayGeometry !== undefined && (!isLead || x < 0)) {
          const gangway = new THREE.Mesh(definition.gangwayGeometry, trainCouplerMaterial)
          // Adjacent cars each own half of the bellows. Pull each half toward
          // its car so the two meshes meet instead of occupying the same plane.
          gangway.position.set(x - Math.sign(x) * 0.08, 0.63, 0)
          group.add(gangway)
        }
      }
      runtime.root.add(group)
      runtime.cars.push(group)
      runtime.wheelPivots.push(wheelPivots)
      return group
    }

    function makeTrainCar(runtime: TrainVisualRuntime, trainId: string, index: number): THREE.Group {
      if (runtime.trainType === 'basic') return makeBasicTrainCar(runtime, trainId, index)
      const definition = specialTrainVisualDefinitions.get(runtime.trainType)
      return definition === undefined
        ? makeBasicTrainCar(runtime, trainId, index)
        : makeSpecialTrainCar(runtime, trainId, index, definition)
    }

    function createTrainVisualRuntime(train: RailFleetTrain): TrainVisualRuntime {
      const specialMaterials = train.trainType === 'basic'
        ? undefined
        : specialTrainVisualMaterials.get(train.trainType)
      // basicだけは既存の列車ごとの色ローテーションを保つためcloneする。
      // 新型の固定色はeffect内で一度作ったtype共有materialを再利用する。
      const bodyMaterial = specialMaterials?.bodyMaterial ?? trainBodyMaterial.clone()
      const frontMaterial = specialMaterials?.frontMaterial ?? trainFrontMaterial.clone()
      const roofMaterial = specialMaterials?.roofMaterial ?? trainRoofMaterial.clone()
      if (specialMaterials === undefined) {
        bodyMaterial.color.set(train.appearance.color)
        frontMaterial.color.set(train.appearance.frontColor)
        roofMaterial.color.set(train.appearance.roofColor)
      }
      const runtime: TrainVisualRuntime = {
        root: new THREE.Group(),
        cars: [],
        wheelPivots: [],
        trainType: train.trainType,
        bodyMaterial,
        frontMaterial,
        roofMaterial,
        windowMaterial: specialMaterials?.windowMaterial ?? trainWindowMaterial,
        accentMaterial: specialMaterials?.accentMaterial ?? null,
        roofFeatureMaterial: specialMaterials?.roofFeatureMaterial ?? null,
      }
      runtime.root.name = train.id
      runtime.root.userData.trainId = train.id
      for (let index = 0; index < 2; index += 1) makeTrainCar(runtime, train.id, index)
      trainRoot.add(runtime.root)
      return runtime
    }

    function disposeTrainVisualRuntime(runtime: TrainVisualRuntime) {
      trainRoot.remove(runtime.root)
      // 車体固有のbasic clone materialだけが非共有として解放される。
      // E5の共有material/geometryはeffectのcleanupで一度だけ解放する。
      disposeObjectTree(runtime.root, sharedGeometries, sharedMaterials)
    }

    function ensureTrainVisuals() {
      for (const [trainId, runtime] of trainVisuals) {
        const train = fleet.find((candidate) => candidate.id === trainId)
        if (train !== undefined && runtime.trainType === train.trainType) continue
        disposeTrainVisualRuntime(runtime)
        trainVisuals.delete(trainId)
      }
      for (const train of fleet) {
        if (trainVisuals.has(train.id)) continue
        const runtime = createTrainVisualRuntime(train)
        trainVisuals.set(train.id, runtime)
      }
    }

    function updateTrainVisuals(delta = 0) {
      ensureTrainVisuals()
      trainRoot.visible = fleet.length > 0
      let anyTrainInTunnel = false
      for (const train of fleet) {
        const runtime = trainVisuals.get(train.id)
        if (runtime === undefined) continue
        const poses = sampleRailTrainCars(trainPieces, train.motion.cursor, runtime.cars.length)
        runtime.root.visible = poses.length > 0
        const leadPiece = trainPieces.find((piece) => piece.id === train.motion.cursor.pieceId)
        if (leadPiece?.kind === 'tunnel') anyTrainInTunnel = true
        const wheelRotation = train.motion.speed > 0.015 && delta > 0
          ? (train.motion.speed * delta) / 0.22
          : 0
        for (const [index, car] of runtime.cars.entries()) {
          const pose = poses[index]
          if (pose === undefined) {
            car.visible = false
            continue
          }
          car.visible = true
          car.position.set(pose.position.x, pose.position.y, pose.position.z)
          trainForwardVector.set(pose.forward.x, pose.forward.y, pose.forward.z).normalize()
          // yawとpitchだけに分解し、坂や分岐でも車体へrollを混ぜない。
          const yaw = Math.atan2(-trainForwardVector.z, trainForwardVector.x)
          const horizontalLength = Math.hypot(trainForwardVector.x, trainForwardVector.z)
          const pitch = Math.atan2(trainForwardVector.y, horizontalLength)
          trainYawQuaternion.setFromAxisAngle(trainYawAxis, yaw)
          trainPitchQuaternion.setFromAxisAngle(trainPitchAxis, pitch)
          car.quaternion.copy(trainYawQuaternion).multiply(trainPitchQuaternion)
          if (wheelRotation > 0) {
            for (const wheel of runtime.wheelPivots[index] ?? []) wheel.rotation.z -= wheelRotation
          }
        }
      }
      trainLightMaterial.emissiveIntensity = anyTrainInTunnel ? 1.15 : 0.7
    }

    function triggerStationPulse(pieceId: string | null) {
      if (reducedMotion || pieceId === null) return
      stationPulsePieceId = pieceId
      stationPulseElapsed = 0
      const target = stationPulseTargets.get(pieceId)
      if (target !== undefined) target.scale.setScalar(1)
    }

    function triggerSnapGlow(candidate: SnapCandidate) {
      const glow = snapGlow
      if (glow === null) return
      const targetPiece = trainPieces.find((piece) => piece.id === candidate.targetPieceId)
      if (targetPiece === undefined) return
      const target = worldConnectorForRailPiece(targetPiece, candidate.targetConnectorId)
      glow.position.set(target.position.x, target.position.y + 0.06, target.position.z)
      glow.visible = true
      glow.scale.setScalar(reducedMotion ? 0.8 : 0.55)
      snapMaterial.opacity = 0.9
      snapGlowElapsed = 0
    }

    function updateFeedbackAnimations(delta: number) {
      const glow = snapGlow
      if (glow?.visible === true) {
        snapGlowElapsed += delta
        // reduced-motionでは拡大を止めるが、短い表示時間は確保する。
        const progress = Math.min(1, snapGlowElapsed / (reducedMotion ? 0.18 : 0.38))
        if (progress >= 1) {
          glow.visible = false
        } else if (!reducedMotion) {
          glow.scale.setScalar(0.55 + progress * 0.95)
          snapMaterial.opacity = 0.9 * (1 - progress)
        }
      }
      if (stationPulsePieceId !== null) {
        stationPulseElapsed += delta
        const progress = Math.min(1, stationPulseElapsed / 0.52)
        const target = stationPulseTargets.get(stationPulsePieceId)
        if (target === undefined || progress >= 1) {
          target?.scale.setScalar(1)
          stationPulsePieceId = null
          stationPulseElapsed = Number.POSITIVE_INFINITY
        } else {
          const pulse = Math.sin(progress * Math.PI)
          target.scale.setScalar(1 + pulse * 0.08)
        }
      }
    }

    function reportTrainState() {
      for (const train of fleet) {
        const status = train.motion.status
        const previousStatus = lastTrainStatuses.get(train.id) ?? null
        if (status === previousStatus) continue
        lastTrainStatuses.set(train.id, status)
        if (train === fleet[0]) optionsRef.current.onTrainStatusChange?.(status)
        const enabled = optionsRef.current.soundEnabled ?? true
        if (status === 'running' && (previousStatus === 'ready' || previousStatus === 'waiting' || previousStatus === 'paused')) {
          playRailDepartureSound(enabled)
        } else if (status === 'stoppedAtStation') {
          playRailStationStopSound(enabled)
          triggerStationPulse(train.motion.cursor.pieceId)
        } else if (status === 'departing' && previousStatus === 'stoppedAtStation') {
          playRailStationDepartureSound(enabled)
        }
      }
      const summaries = summarizeRailFleet(fleet)
      // trainTypeもキーに含める。見た目だけの変更(Phase 3の車両選択UIから)でも
      // 走行状態(status/wantsToRun/blocked)が変わらずonFleetChangeが素通りしないようにする。
      const fleetKey = summaries
        .map((train) => `${train.id}:${train.trainType}:${train.status}:${train.wantsToRun ? 1 : 0}:${train.blocked ? 1 : 0}`)
        .join('|')
      if (fleetKey !== lastFleetKey) {
        lastFleetKey = fleetKey
        optionsRef.current.onFleetChange?.(summaries)
      }
      const occupied = occupiedRailFleetPieceIds(fleet, trainPieces)
      const occupiedKey = occupied.join('\u0000')
      if (occupiedKey !== lastOccupiedKey) {
        lastOccupiedKey = occupiedKey
        optionsRef.current.onTrainOccupiedIdsChange?.(occupied)
      }
    }

    function startTrainNow(trainId: string) {
      if (optionsRef.current.soundEnabled ?? true) primeAudio()
      fleet = setRailFleetTrainRunning(fleet, trainId, true)
      updateTrainVisuals()
      reportTrainState()
    }

    function pauseTrainNow(trainId: string) {
      fleet = setRailFleetTrainRunning(fleet, trainId, false)
      updateTrainVisuals()
      reportTrainState()
    }

    function addTrainNow(trainType?: TrainType) {
      fleet = addRailFleetTrain(fleet, trainPieces, trainType)
      updateTrainVisuals()
      reportTrainState()
    }

    /** Phase 3の車両選択UI向け。走行状態(cursor/speed/status)には触れず、見た目だけ差し替える。 */
    function setTrainTypeNow(trainId: string, trainType: TrainType) {
      fleet = setRailFleetTrainType(fleet, trainId, trainType)
      // trainType差分はensureTrainVisualsがruntimeごと再構築する。
      // E5のtype共有materialを直接変更すると、他のE5編成まで色が変わるため触れない。
      updateTrainVisuals()
      reportTrainState()
    }

    function focusTrainNow(trainId: string) {
      const train = fleet.find((candidate) => candidate.id === trainId)
      if (train === undefined) return
      followedTrainId = trainId
      const pose = sampleRailTrainPose(trainPieces, train.motion.cursor)
      if (pose !== null) setCameraTarget(pose.position)
    }

    function removeTrainNow(trainId?: string) {
      const before = fleet
      fleet = removeRailFleetTrain(fleet, trainId)
      const remainingIds = new Set(fleet.map((train) => train.id))
      for (const removedTrain of before) {
        if (remainingIds.has(removedTrain.id)) continue
        const runtime = trainVisuals.get(removedTrain.id)
        if (runtime === undefined) continue
        disposeTrainVisualRuntime(runtime)
        trainVisuals.delete(removedTrain.id)
      }
      updateTrainVisuals()
      reportTrainState()
    }

    function focusDepotNow() {
      followedTrainId = null
      const pieces = optionsRef.current.pieces
      const depotPiece = pieces.find((piece) => piece.kind === 'depot')
      setCameraTarget(depotPiece?.position ?? pieces[0]?.position ?? vec3(0, 0, 0))
    }

    startTrainRef.current = startTrainNow
    pauseTrainRef.current = pauseTrainNow
    addTrainRef.current = addTrainNow
    removeTrainRef.current = removeTrainNow
    focusTrainRef.current = focusTrainNow
    focusDepotRef.current = focusDepotNow
    setTrainTypeRef.current = setTrainTypeNow

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
        mesh.receiveShadow = true
        mesh.castShadow = geometry === bridgeBeamGeometry
          || geometry === bridgeSupportGeometry
          || geometry === stationRoofGeometry
          || geometry === tunnelTopGeometry
          || geometry === tunnelRingGeometry
          || geometry === depotRoofGeometry
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
        const sign = addMesh(
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
        const clock = addMesh(
          stationClockGeometry,
          stationSignMaterial,
          { x: stationCenter.x, y: stationCenter.y + 1.65, z: stationCenter.z + 1.56 },
          { x: 1, y: 1, z: 1 },
          { x: Math.PI / 2, y: 0, z: 0 },
        )
        sign.castShadow = true
        stationPulseTargets.set(pieceId, clock)
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

      if (localPiece.kind === 'depot') {
        // +X方向が線路の向き。屋根は中央部だけ・壁は腰高にして、
        // 上から見ても車庫の中の線路と電車が見えるようにする。
        const wallHeight = 0.6
        const wallZ = depotRoofDepth / 2 - 0.1
        const pillarHeight = 2.06
        const pillarX = depotRoofLength / 2 - 0.25
        addMesh(depotRoofGeometry, depotRoofMaterial, { x: 0, y: 2.06, z: 0 })
        for (const side of [-1, 1]) {
          addMesh(depotBodyGeometry, depotBodyMaterial, { x: 0, y: wallHeight / 2, z: side * wallZ })
          for (const x of [-pillarX, pillarX]) {
            addMesh(depotDoorGeometry, depotDoorMaterial, { x, y: pillarHeight / 2, z: side * wallZ })
          }
        }
      }
    }

    /**
     * 1本のpathからbase/rail/sleeperのInstancedMeshを組み立てる。
     * 本線・branchの副線(A-C)・depotの2番線(C-D)で共通の手順。
     * localPieceはposition/rotationが0で、group側へworld transformを
     * 一度だけ適用する。pathを省略すると本線(localPiece.path)を使う。
     */
    function buildRailPathInstances(
      localPiece: RailPiece,
      path: RailPath | undefined,
      segmentCount: number,
      pieceId: string,
      pathRailMaterial: THREE.Material,
      sleeperEvery: number,
    ): { base: THREE.InstancedMesh; rail: THREE.InstancedMesh; sleeper: THREE.InstancedMesh } {
      const baseInstances = new THREE.InstancedMesh(baseGeometry, baseMaterial, segmentCount)
      const railInstances = new THREE.InstancedMesh(railGeometry, pathRailMaterial, segmentCount * 2)
      const sleeperCount = Math.ceil(segmentCount / sleeperEvery)
      const sleeperInstances = new THREE.InstancedMesh(sleeperGeometry, sleeperMaterial, sleeperCount)
      for (const instances of [baseInstances, railInstances, sleeperInstances]) {
        instances.userData.pieceId = pieceId
        instances.instanceMatrix.setUsage(THREE.StaticDrawUsage)
        instances.receiveShadow = true
      }
      let railInstanceIndex = 0
      let sleeperInstanceIndex = 0
      for (let i = 0; i < segmentCount; i += 1) {
        const t0 = i / segmentCount
        const t1 = (i + 1) / segmentCount
        const p0 = worldRailPathPoint(localPiece, t0, path)
        const p1 = worldRailPathPoint(localPiece, t1, path)
        const midpoint = vec3((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2)
        const tangent = vec3(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z)
        const tangentLength = Math.hypot(tangent.x, tangent.y, tangent.z) || 1
        segmentTangentVector.set(tangent.x, tangent.y, tangent.z).normalize()
        instanceQuaternion.setFromUnitVectors(trainBaseForward, segmentTangentVector)
        instancePosition.set(midpoint.x, midpoint.y, midpoint.z)

        instanceScale.set(Math.max(0.55, tangentLength), 1, 1)
        instanceMatrix.compose(instancePosition, instanceQuaternion, instanceScale)
        instanceDummy.position.set(0, 0.1, 0)
        instanceDummy.quaternion.identity()
        instanceDummy.scale.setScalar(1)
        instanceDummy.updateMatrix()
        instanceMatrix.multiply(instanceDummy.matrix)
        baseInstances.setMatrixAt(i, instanceMatrix)

        for (const side of [-1, 1]) {
          instanceScale.set(Math.max(0.55, tangentLength), 1, 1)
          instanceMatrix.compose(instancePosition, instanceQuaternion, instanceScale)
          instanceDummy.position.set(0, 0.34, (RAIL_VISUAL_CONFIG.gauge / 2) * side)
          instanceDummy.quaternion.identity()
          instanceDummy.scale.setScalar(1)
          instanceDummy.updateMatrix()
          instanceMatrix.multiply(instanceDummy.matrix)
          railInstances.setMatrixAt(railInstanceIndex, instanceMatrix)
          railInstanceIndex += 1
        }

        if (i % sleeperEvery === 0) {
          instanceScale.setScalar(1)
          instanceMatrix.compose(instancePosition, instanceQuaternion, instanceScale)
          instanceDummy.position.set(0, 0.2, 0)
          instanceDummy.quaternion.identity()
          instanceDummy.scale.setScalar(1)
          instanceDummy.updateMatrix()
          instanceMatrix.multiply(instanceDummy.matrix)
          sleeperInstances.setMatrixAt(sleeperInstanceIndex, instanceMatrix)
          sleeperInstanceIndex += 1
        }
      }
      baseInstances.instanceMatrix.needsUpdate = true
      railInstances.instanceMatrix.needsUpdate = true
      sleeperInstances.instanceMatrix.needsUpdate = true
      baseInstances.computeBoundingSphere()
      railInstances.computeBoundingSphere()
      sleeperInstances.computeBoundingSphere()
      return { base: baseInstances, rail: railInstances, sleeper: sleeperInstances }
    }

    function makePieceObject(piece: RailPiece): THREE.Group {
      const group = new THREE.Group()
      group.name = `rail-${piece.id}`
      group.userData.pieceId = piece.id

      const segmentCount = piece.kind === 'curve' || piece.kind === 'branch'
        ? 12
        : piece.kind === 'slope'
          ? 16
          : piece.kind === 'bridge' || piece.kind === 'station' || piece.kind === 'tunnel'
            ? 8
            : 1
      const sleeperEvery = piece.kind === 'curve' || piece.kind === 'slope' ? 2 : 1
      const localPiece = { ...piece, position: vec3(0, 0, 0), rotationY: 0 }
      const mainRailMaterial = piece.kind === 'branch'
        ? piece.branchDirection === 'c' ? branchDimRailMaterial : branchSelectedRailMaterial
        : railMaterial
      const { base: baseInstances, rail: railInstances, sleeper: sleeperInstances } = buildRailPathInstances(
        localPiece,
        undefined,
        segmentCount,
        piece.id,
        mainRailMaterial,
        sleeperEvery,
      )
      baseInstances.name = 'rail-bases'
      railInstances.name = 'rail-pairs'
      sleeperInstances.name = 'rail-sleepers'
      group.add(baseInstances, railInstances, sleeperInstances)

      if (piece.kind === 'branch' && piece.branchPath !== undefined) {
        const branchSegmentCount = 12
        const branchRailMaterial = piece.branchDirection === 'c' ? branchSelectedRailMaterial : branchDimRailMaterial
        const { base: branchBases, rail: branchRails, sleeper: branchSleepers } = buildRailPathInstances(
          localPiece,
          piece.branchPath,
          branchSegmentCount,
          piece.id,
          branchRailMaterial,
          1,
        )
        group.add(branchBases, branchRails, branchSleepers)
        branchRouteVisuals.set(piece.id, { b: railInstances, c: branchRails })
      }

      if (piece.kind === 'depot' && piece.secondaryPath !== undefined) {
        // 2番線は選択・非選択の色分けをせず、branchRouteVisualsにも登録しない。
        const depotSecondarySegmentCount = 8
        const { base: depotSecondaryBases, rail: depotSecondaryRails, sleeper: depotSecondarySleepers } = buildRailPathInstances(
          localPiece,
          piece.secondaryPath,
          depotSecondarySegmentCount,
          piece.id,
          railMaterial,
          1,
        )
        group.add(depotSecondaryBases, depotSecondaryRails, depotSecondarySleepers)
      }

      const capsForPiece: Partial<Record<RailConnectorId, THREE.Mesh>> = {}
      for (const connectorId of getRailConnectorIds(piece)) {
        const connector = worldConnectorForRailPiece(localPiece, connectorId)
        const cap = new THREE.Mesh(connectorGeometry, connectorMaterial)
        cap.position.set(connector.position.x, connector.position.y + 0.25, connector.position.z)
        cap.userData.pieceId = piece.id
        group.add(cap)
        capsForPiece[connectorId] = cap
      }
      connectorCaps.set(piece.id, capsForPiece)

      addPieceFacilityDetails(group, localPiece)

      const selectionRing = new THREE.Mesh(selectionRingGeometry, selectionMaterial)
      selectionRing.name = 'selection-ring'
      selectionRing.rotation.x = -Math.PI / 2
      let ringCenter = worldRailPathPoint(localPiece, 0.5)
      if (piece.kind === 'depot' && piece.secondaryPath !== undefined) {
        // 1番線と2番線の中点に置く。1番線だけだと車庫の片側に寄って見える。
        const secondaryRingCenter = worldRailPathPoint(localPiece, 0.5, piece.secondaryPath)
        ringCenter = vec3(
          (ringCenter.x + secondaryRingCenter.x) / 2,
          (ringCenter.y + secondaryRingCenter.y) / 2,
          (ringCenter.z + secondaryRingCenter.z) / 2,
        )
      }
      selectionRing.position.set(ringCenter.x, ringCenter.y + 0.43, ringCenter.z)
      selectionRing.visible = piece.id === optionsRef.current.selectedPieceId
      selectionRing.userData.pieceId = piece.id
      group.add(selectionRing)
      selectionRings.set(piece.id, selectionRing)
      return group
    }

    function syncPieces(pieces: readonly RailPiece[], selectedPieceId: string | null) {
      trainPieces = pieces
      if (fleet.length === 0 && pieces.length > 0) fleet = createInitialRailFleet(pieces, 1)
      const incomingIds = new Set(pieces.map((piece) => piece.id))
      for (const [pieceId, object] of pieceObjects) {
        if (incomingIds.has(pieceId)) continue
        railRoot.remove(object)
        pieceObjects.delete(pieceId)
        selectionRings.delete(pieceId)
        connectorCaps.delete(pieceId)
        branchRouteVisuals.delete(pieceId)
        stationPulseTargets.delete(pieceId)
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
        const caps = connectorCaps.get(piece.id)
        if (caps !== undefined) {
          for (const connectorId of getRailConnectorIds(piece)) {
            const cap = caps[connectorId]
            if (cap !== undefined) cap.visible = piece.connections[connectorId] === undefined
          }
        }
        const branchRoutes = branchRouteVisuals.get(piece.id)
        if (branchRoutes !== undefined) {
          const selected = piece.branchDirection === 'c' ? 'c' : 'b'
          branchRoutes.b.material = selected === 'b' ? branchSelectedRailMaterial : branchDimRailMaterial
          branchRoutes.c.material = selected === 'c' ? branchSelectedRailMaterial : branchDimRailMaterial
        }
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
      trainDrag = null
      setMarker(null)
      // syncPieces()の末尾でreportTrainState()も呼ばれ、掴んでいた電車の
      // 状態(停止のまま)がonFleetChangeへ反映される。
      syncPieces(optionsRef.current.pieces, optionsRef.current.selectedPieceId)
    }

    function updatePinch() {
      const values = [...pointers.values()]
      if (values.length < 2 || pinchStartDistance <= 0) return
      const distance = Math.max(1, distance2D(values[0]!, values[1]!))
      updateZoom(pinchStartZoom * (distance / pinchStartDistance))
    }

    /**
     * 通常接続が成立した直後、今つないだpieceのもう片方の空き端点が
     * 「ループとして閉じられそうか」だけを追加でチェックする。
     * 通常のsnap判定・connectRailPiecesの挙動そのものは変えない、
     * あくまでその後段の任意の一手として発動する。
     * 成立した場合の見た目・音のフィードバックは、通常接続と同じ
     * triggerSnapGlow/playRailSnapSoundをそのまま流用する。
     */
    function tryCloseLoopAfterConnect(
      layout: RailPiece[],
      normalCandidate: SnapCandidate | null,
      draggedPieceId: string,
    ): RailPiece[] {
      if (normalCandidate === null) return layout
      const draggedPiece = layout.find((piece) => piece.id === draggedPieceId)
      if (draggedPiece === undefined) return layout
      const normalTarget = layout.find((piece) => piece.id === normalCandidate.targetPieceId)
      if (draggedPiece.kind === 'branch' || normalTarget?.kind === 'branch') return layout
      const looseConnectorId: RailConnectorId = normalCandidate.movingConnectorId === 'a' ? 'b' : 'a'
      if (draggedPiece.connections[looseConnectorId] !== undefined) return layout

      const targets = layout.filter((piece) => piece.id !== draggedPieceId)
      const loopCandidate = findRailLoopClosureCandidate(
        draggedPiece,
        looseConnectorId,
        targets,
        normalCandidate.targetPieceId,
      )
      if (loopCandidate === null) return layout

      const closedLayout = applyRailLoopClosure(layout, loopCandidate)
      const lockedPieceIds = optionsRef.current.lockedPieceIds
      if (lockedPieceIds !== undefined) {
        const movedLockedPiece = [...lockedPieceIds].some((pieceId) => {
          const before = layout.find((piece) => piece.id === pieceId)
          const after = closedLayout.find((piece) => piece.id === pieceId)
          if (before === undefined || after === undefined) return false
          return Math.abs(before.position.x - after.position.x) > 1e-7
            || Math.abs(before.position.y - after.position.y) > 1e-7
            || Math.abs(before.position.z - after.position.z) > 1e-7
            || Math.abs(before.rotationY - after.rotationY) > 1e-7
        })
        // 通常接続は維持し、列車がいるchainへ分散補正だけをかけない。
        if (movedLockedPiece) return layout
      }
      // triggerSnapGlowはtrainPiecesからtargetPieceIdの現在位置を引くため、
      // syncPieces()を待たずにここで先に反映しておく（targetPieceIdは
      // 今まさにドラッグで動いたdraggedPiece自身なので、古い位置のままだと
      // 光る場所がずれてしまう）。
      trainPieces = closedLayout
      triggerSnapGlow(loopCandidate)
      playRailSnapSound(optionsRef.current.soundEnabled ?? true)
      return closedLayout
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
      const connectedLayout = currentDrag.candidate === null
        ? movedLayout
        : connectRailPieces(
          movedLayout,
          currentDrag.pieceId,
          currentDrag.candidate.movingConnectorId,
          currentDrag.candidate.targetPieceId,
          currentDrag.candidate.targetConnectorId,
          currentDrag.candidate.transform,
        )
      if (currentDrag.candidate !== null) {
        triggerSnapGlow(currentDrag.candidate)
        playRailSnapSound(optionsRef.current.soundEnabled ?? true)
      }
      const nextLayout = tryCloseLoopAfterConnect(connectedLayout, currentDrag.candidate, currentDrag.pieceId)
      optionsRef.current.onPiecesChange(nextLayout)
    }

    function finishTrainDrag() {
      const currentDrag = trainDrag
      trainDrag = null
      if (currentDrag === null) return
      if (currentDrag.lastCursor.pieceId !== currentDrag.startPieceId) {
        playRailSnapSound(optionsRef.current.soundEnabled ?? true)
      }
      reportTrainState()
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.button !== 0) return
      event.preventDefault()
      if (optionsRef.current.soundEnabled ?? true) primeAudio()
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

      const grabbedTrainId = pickTrain(event)
      if (grabbedTrainId !== null) {
        const grabbedTrain = fleet.find((candidate) => candidate.id === grabbedTrainId)
        if (grabbedTrain !== undefined) {
          followedTrainId = null
          optionsRef.current.onSelectPiece(null)
          optionsRef.current.onSelectTrain(grabbedTrainId)
          const grabbedForward = sampleRailTrainPose(trainPieces, grabbedTrain.motion.cursor)?.forward ?? null
          trainDrag = {
            pointerId: event.pointerId,
            trainId: grabbedTrainId,
            startPieceId: grabbedTrain.motion.cursor.pieceId,
            lastCursor: { ...grabbedTrain.motion.cursor },
            lastForward: grabbedForward,
          }
          mode = 'train'
          drag = null
          fleet = setRailFleetTrainRunning(fleet, grabbedTrainId, false)
          updateTrainVisuals()
          reportTrainState()
          return
        }
      }

      optionsRef.current.onSelectTrain(null)
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
        followedTrainId = null
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

      if (mode === 'train' && trainDrag?.pointerId === event.pointerId) {
        const ground = intersectGround(event)
        if (ground !== null) {
          const nearest = findNearestRailTrainCursor(trainPieces, ground, {
            maxDistance: TRAIN_DRAG_MAX_DISTANCE,
            preferForward: trainDrag.lastForward ?? undefined,
          })
          // 見つからないときは直前の位置を保つ。電車が消えたり地面に
          // 落ちたりしないよう、fleet/lastCursorはどちらも据え置く。
          if (nearest !== null) {
            fleet = moveRailFleetTrainTo(fleet, trainDrag.trainId, nearest.cursor)
            trainDrag.lastCursor = { ...nearest.cursor }
            updateTrainVisuals()
          }
        }
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
      if (mode === 'train' && trainDrag?.pointerId === event.pointerId) finishTrainDrag()
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
      if (trainDrag?.pointerId === event.pointerId) {
        trainDrag = null
        reportTrainState()
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
      renderer.setPixelRatio(getRailBuilderDevicePixelRatio(window.devicePixelRatio || 1, width, height))
      renderer.setSize(width, height, false)
      updateCamera()
    }

    function addDioramaDecorations() {
      const treePositions = [
        { x: -22, y: 0.72, z: -21, scale: 1.05 },
        { x: -19, y: 0.72, z: 21, scale: 0.9 },
        { x: 21, y: 0.72, z: -20, scale: 1.12 },
        { x: 23, y: 0.72, z: 20, scale: 0.9 },
        { x: -22, y: 0.72, z: 8, scale: 0.84 },
        { x: 22, y: 0.72, z: 8, scale: 0.88 },
        { x: -8, y: 0.72, z: 22, scale: 0.82 },
        { x: 9, y: 0.72, z: -22, scale: 0.86 },
      ]
      const trunks = new THREE.InstancedMesh(treeTrunkGeometry, treeTrunkMaterial, treePositions.length)
      const foliage = new THREE.InstancedMesh(treeFoliageGeometry, treeFoliageMaterial, treePositions.length)
      for (const instances of [trunks, foliage]) {
        instances.instanceMatrix.setUsage(THREE.StaticDrawUsage)
        instances.castShadow = true
        instances.receiveShadow = true
      }
      treePositions.forEach((tree, index) => {
        instanceDummy.position.set(tree.x, tree.y, tree.z)
        instanceDummy.rotation.set(0, (index % 3) * 0.45, 0)
        instanceDummy.scale.set(tree.scale, tree.scale, tree.scale)
        instanceDummy.updateMatrix()
        trunks.setMatrixAt(index, instanceDummy.matrix)
        instanceDummy.position.y += 1.1 * tree.scale
        instanceDummy.scale.setScalar(tree.scale * 1.05)
        instanceDummy.updateMatrix()
        foliage.setMatrixAt(index, instanceDummy.matrix)
      })
      trunks.instanceMatrix.needsUpdate = true
      foliage.instanceMatrix.needsUpdate = true
      trunks.computeBoundingSphere()
      foliage.computeBoundingSphere()
      dioramaRoot.add(trunks, foliage)

      const shrubPositions = [
        { x: -21, z: -12 },
        { x: -20, z: -7 },
        { x: -21, z: 14 },
        { x: -13, z: 22 },
        { x: 14, z: 22 },
        { x: 20, z: 13 },
        { x: 20, z: -13 },
        { x: 14, z: -21 },
      ]
      const shrubs = new THREE.InstancedMesh(shrubGeometry, shrubMaterial, shrubPositions.length)
      shrubs.instanceMatrix.setUsage(THREE.StaticDrawUsage)
      shrubs.castShadow = true
      shrubs.receiveShadow = true
      shrubPositions.forEach((shrub, index) => {
        instanceDummy.position.set(shrub.x, 0.47 + (index % 2) * 0.05, shrub.z)
        instanceDummy.rotation.set(0, index * 0.7, 0)
        instanceDummy.scale.set(1 + (index % 3) * 0.12, 0.75 + (index % 2) * 0.12, 1 + (index % 3) * 0.12)
        instanceDummy.updateMatrix()
        shrubs.setMatrixAt(index, instanceDummy.matrix)
      })
      shrubs.instanceMatrix.needsUpdate = true
      shrubs.computeBoundingSphere()
      dioramaRoot.add(shrubs)

      const houses = [
        { x: -18, z: -16, rotation: 0.35 },
        { x: 17, z: 16, rotation: -0.4 },
        { x: -16, z: 17, rotation: 0.15 },
      ]
      houses.forEach((house, index) => {
        const group = new THREE.Group()
        group.name = `diorama-house-${index + 1}`
        group.position.set(house.x, 0, house.z)
        group.rotation.y = house.rotation
        const bodyMaterials = [houseBodyMaterial, houseBodyAccentMaterial, houseBodyPaleMaterial]
        const body = new THREE.Mesh(houseBodyGeometry, bodyMaterials[index % bodyMaterials.length])
        body.position.y = 0.73
        body.castShadow = true
        body.receiveShadow = true
        group.add(body)
        const roof = new THREE.Mesh(houseRoofGeometry, houseRoofMaterial)
        roof.position.y = 1.88
        roof.rotation.y = Math.PI / 4
        roof.castShadow = true
        group.add(roof)
        for (const side of [-1, 1]) {
          const window = new THREE.Mesh(houseWindowGeometry, houseWindowMaterial)
          window.position.set(0.62, 0.9, side * 1.07)
          group.add(window)
        }
        dioramaRoot.add(group)
      })
    }

    try {
      scene = new THREE.Scene()
      scene.background = new THREE.Color('#cfeef3')
      scene.fog = new THREE.Fog('#cfeef3', 38, 78)
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
      camera.position.copy(cameraTarget).add(cameraOffset)
      camera.lookAt(cameraTarget)

      renderer = new THREE.WebGLRenderer({
        antialias: (window.devicePixelRatio || 1) < 1.75,
        alpha: false,
        powerPreference: 'high-performance',
      })
      renderer.setPixelRatio(getRailBuilderDevicePixelRatio(window.devicePixelRatio || 1, host.clientWidth, host.clientHeight))
      renderer.setClearColor('#cfeef3')
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.domElement.setAttribute('aria-hidden', 'true')
      renderer.domElement.style.display = 'block'
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      host.appendChild(renderer.domElement)

      const ground = new THREE.Mesh(groundGeometry, groundMaterial)
      ground.name = 'toy-mat'
      ground.position.y = -0.25
      ground.receiveShadow = true
      const groundEdge = new THREE.Mesh(groundGeometry, groundEdgeMaterial)
      groundEdge.name = 'toy-mat-edge'
      groundEdge.position.y = -0.42
      groundEdge.scale.set(1.018, 0.72, 1.018)
      groundEdge.receiveShadow = true
      dioramaRoot.add(groundEdge, ground)
      addDioramaDecorations()
      scene.add(dioramaRoot)
      scene.add(railRoot)
      scene.add(trainRoot)
      const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial)
      markerMesh.rotation.x = -Math.PI / 2
      markerMesh.position.y = 0.02
      marker.add(markerMesh)
      scene.add(marker)
      scene.add(trainSelectionRing)
      if (snapGlow !== null) scene.add(snapGlow)
      scene.add(new THREE.HemisphereLight('#fff7d6', '#4f7c56', 1.8))
      const directional = new THREE.DirectionalLight('#fff8e7', 2.1)
      directional.position.set(8, 18, 10)
      directional.castShadow = true
      directional.shadow.mapSize.set(getRailBuilderShadowMapSize(host.clientWidth, host.clientHeight), getRailBuilderShadowMapSize(host.clientWidth, host.clientHeight))
      directional.shadow.camera.left = -28
      directional.shadow.camera.right = 28
      directional.shadow.camera.top = 28
      directional.shadow.camera.bottom = -28
      directional.shadow.camera.near = 1
      directional.shadow.camera.far = 70
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
        if (fleet.length > 0 && delta > 0) {
          fleet = updateRailFleet(fleet, trainPieces, delta)
          updateTrainVisuals(delta)
          reportTrainState()
        }
        if (followedTrainId !== null && delta > 0) {
          const followed = fleet.find((train) => train.id === followedTrainId)
          const pose = followed === undefined ? null : sampleRailTrainPose(trainPieces, followed.motion.cursor)
          if (pose !== null) {
            const alpha = 1 - Math.exp(-delta * 7)
            setCameraTarget({
              x: cameraTarget.x + (pose.position.x - cameraTarget.x) * alpha,
              y: 0,
              z: cameraTarget.z + (pose.position.z - cameraTarget.z) * alpha,
            })
          }
        }
        updateFeedbackAnimations(delta)
        trainSound.setEnabled(optionsRef.current.soundEnabled ?? true)
        const representative = fleet.find((train) => train.id === followedTrainId)
          ?? fleet.find((train) => train.wantsToRun)
          ?? fleet[0]
        const leadPiece = trainPieces.find((piece) => piece.id === representative?.motion.cursor.pieceId)
        const soundStatus = representative?.motion.status === 'paused'
          ? 'ready'
          : representative?.motion.status ?? 'ready'
        trainSound.update(
          representative?.motion.speed ?? 0,
          soundStatus,
          leadPiece?.kind === 'tunnel',
        )
        updateTrainSelectionRing(optionsRef.current.selectedTrainId)
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
      pauseTrainRef.current = null
      addTrainRef.current = null
      removeTrainRef.current = null
      focusTrainRef.current = null
      focusDepotRef.current = null
      setTrainTypeRef.current = null
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
      trainSound.dispose()
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
