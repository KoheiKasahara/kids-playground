import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type {
  CelestialBody,
  CelestialBodyId,
  FeatureSpot,
  SatelliteSpec,
  RingSpec,
  UsePlanetEngineHandle,
  UsePlanetEngineOptions,
  ZoomLevel,
} from '../types'
import { MIN_ZOOM_LEVEL } from '../types'
import {
  CAMERA_FAR,
  CAMERA_FOV_DEGREES,
  CAMERA_NEAR,
  cameraDistanceForZoomWithSatellites,
  easeOutCubic,
  viewDirectionOf,
  viewRadiusOf,
  ZOOM_ANIMATION_DURATION_MS,
} from './planetCamera'
import { surfaceDirection } from './planetCoords'
import { createCloudTexture, createSurfaceMaps, type SurfaceMaps } from './planetSurface'
import { axialTiltRotationZ, createRingMeshes, createRingSegmentTexture } from './planetRing'
import {
  createSunSurfaceMaterial,
  updateSunSurfaceMaterial,
} from './sunVisual'
import {
  applyLighting,
  configureKeyLightShadow,
  createPlanetLights,
  type PlanetLights,
} from './planetLighting'
import { createStarField, disposeStarField } from './starField'
import { renderPixelRatioForDevice } from './renderQuality'
import {
  exceedsTapMovement,
  isRingPointVisible,
  isSurfacePointVisible,
  ndcToScreen,
  pickNearestSpot,
  POINTER_TAP_MOVE_PX,
  type SpotHitCandidate,
} from './spotPicking'
import {
  createMarkerTexture,
  createPulseTexture,
  createRingHighlightMeshes,
  MARKER_RADIUS_RATIO,
  resolveRingHighlightBands,
  RING_HIGHLIGHT_COLOR,
  RING_HIGHLIGHT_MAX_OPACITY,
  ringSpotLocalPosition,
  surfaceSpotLocalPosition,
} from './spotMarkers'
import {
  applySatelliteSelection,
  createSatelliteMaterial,
  createSatelliteTexture,
} from './satelliteVisual'

/** 特徴スポットのマーカー・パルスの既定色(未選択時)。選択時だけ`spot.accentColor`に切り替える。 */
const DEFAULT_MARKER_COLOR = '#ffffff'
/** マーカーの「呼吸」の周期(秒)。点滅ではなくゆっくりした不透明度の揺らぎにする。 */
const MARKER_BREATH_PERIOD_SECONDS = 2.4
/** マーカーの表示/非表示が切り替わるときの不透明度の追従の速さ(小さいほど素早く追従する)。 */
const SPOT_OPACITY_SMOOTHING_SECONDS = 0.15
/** 選択パルスの再生時間(ms)。 */
const PULSE_DURATION_MS = 620
/** 選択パルスが広がる最終スケール(基準直径の何倍か)。 */
const PULSE_MAX_SCALE = 2.4
/** 選択パルスの開始不透明度。 */
const PULSE_START_OPACITY = 0.9
/** 輪ハイライトのフェードイン/フェードアウト時間(ms)。 */
const RING_HIGHLIGHT_FADE_IN_MS = 200
const RING_HIGHLIGHT_FADE_OUT_MS = 180

type RingHighlightAnimation = { from: number; to: number; startedAt: number; durationMs: number }

/**
 * 特徴スポット1つぶんの3Dオブジェクトと状態。
 * `normalized`は正規化空間(楕円体を単位球にした空間)での位置。surfaceは自転前の単位ベクトル
 * (spinGroupの現在の自転角ぶんだけ毎frame回してから可視判定に使う)、ringはtiltGroupローカルの
 * 位置を`(r, r*(1-f), r)`で割った値(輪は自転しないため毎frame回す必要がない)。
 */
type SpotVisual = {
  spot: FeatureSpot
  normalized: THREE.Vector3
  marker: THREE.Sprite | null
  pulse: THREE.Sprite | null
  ringHighlights: THREE.Mesh[]
  /** マーカー直径(world unit)。選択時のスケール計算の基準にする。 */
  baseDiameter: number
  /** 今フレーム、天体に遮られず見えているか(タップ候補・当たり判定に使う)。 */
  visible: boolean
  /** visibleの切り替わりを滑らかにするための現在の表示強度(0..1)。 */
  displayOpacity: number
  selected: boolean
  pulseStartedAt: number | null
  ringHighlightOpacity: number
  ringHighlightAnimation: RingHighlightAnimation | null
}

type ZoomAnimation = {
  from: number
  to: number
  startedAt: number
}

type SatelliteVisual = {
  satellite: SatelliteSpec
  orbitPlaneGroup: THREE.Group
  orbitPivot: THREE.Group
  mesh: THREE.Mesh
  orbitLine: THREE.LineLoop
  atmosphere: THREE.Mesh | null
  visible: boolean
}

type PlanetEngine = {
  setBody: (body: CelestialBody) => void
  setZoom: (level: ZoomLevel) => void
  setSelectedSpot: (spotId: string | null, restartPulse: boolean) => void
  setSatelliteOptions: (satellites: readonly SatelliteSpec[], show: boolean) => void
  setSelectedSatellite: (satelliteId: string | null) => void
}

function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * 他ゲーム(earth-globeのuseReducedMotion等)と同じく、初期化時に一度だけ読む。
 * 購読はせず、画面を開き直すまで値は変わらない前提にする。
 * matchMediaが無い環境(jsdom等)でも、オプショナルチェーンにより例外を投げずfalseへ倒れる。
 */
function getReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/** Three.jsのシーンと操作系をhookのライフサイクル内で完結させる。天体ごとの分岐は書かず、bodyの値だけを読む。 */
export function usePlanetEngine(options: UsePlanetEngineOptions): UsePlanetEngineHandle {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const engineRef = useRef<PlanetEngine | null>(null)

  const registerContainer = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element
  }, [])

  const handle = useMemo<UsePlanetEngineHandle>(
    () => ({ registerContainer }),
    [registerContainer],
  )

  useEffect(() => {
    const containerElement = containerRef.current
    if (containerElement === null || typeof window === 'undefined') return undefined
    // 以降のネストした関数からも非nullとして参照できるよう、型を確定させた別名に控える。
    const container: HTMLDivElement = containerElement

    const initialOptions = optionsRef.current
    const reducedMotion = getReducedMotion()

    let scene: THREE.Scene | null = null
    let camera: THREE.PerspectiveCamera | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let controls: OrbitControls | null = null

    // 天体を差し替える器。scene直下に1つだけ置く。
    let bodyRoot: THREE.Group | null = null
    // 共有の球ジオメトリ。大きさは mesh.scale で表現するため、天体を切り替えても作り直さない。
    let sphereGeometry: THREE.SphereGeometry | null = null
    let satelliteGeometry: THREE.SphereGeometry | null = null

    let tiltGroup: THREE.Group | null = null
    let spinGroup: THREE.Group | null = null
    let cloudSpinGroup: THREE.Group | null = null
    let sphereMesh: THREE.Mesh | null = null
    let ringMeshes: THREE.Mesh[] = []
    let visualObjects: THREE.Object3D[] = []
    let visualMaterials: THREE.Material[] = []
    let satelliteSystemRoot: THREE.Group | null = null
    let satelliteVisuals: SatelliteVisual[] = []
    let activeSatellites: readonly SatelliteSpec[] = initialOptions.satellites ?? []
    let activeShowSatellites = initialOptions.showSatellites ?? true
    let selectedSatelliteId: string | null = initialOptions.selectedSatelliteId ?? null

    // 太陽(kind: 'star')だけが持つ、毎frame動かす必要がある参照。所有権(dispose対象)は
    // sphereMeshが持つため、ここは「今フレーム何を動かすか」を指すだけ。
    let sunMaterial: THREE.ShaderMaterial | null = null

    // マーカー・パルスのテクスチャはeffectスコープで1回だけ生成する。モジュールスコープに
    // キャッシュしてdisposeすると、再マウント時に破棄済みテクスチャを使ってしまうため。
    let markerTexture: THREE.CanvasTexture | null = null
    let pulseTexture: THREE.CanvasTexture | null = null
    let spotVisuals: SpotVisual[] = []
    // 可視判定・タップ判定で毎frame使い回すVector3(newを避ける)。
    const spotCameraNormalized = new THREE.Vector3()
    const spotRotatedPoint = new THREE.Vector3()
    const spotMarkerWorldPosition = new THREE.Vector3()
    const satelliteWorldPosition = new THREE.Vector3()
    const satelliteLocalPosition = new THREE.Vector3()
    const satelliteCameraNormalized = new THREE.Vector3()
    const satelliteNormalizedPoint = new THREE.Vector3()
    const SPOT_Y_AXIS = new THREE.Vector3(0, 1, 0)
    let pointerStart: { pointerId: number; x: number; y: number; moved: boolean } | null = null
    let activePointerCount = 0

    let lights: PlanetLights | null = null
    let starField: THREE.Points | null = null

    let currentBody: CelestialBody | null = null
    let activeZoomLevel: ZoomLevel = initialOptions.zoomLevel
    let zoomAnimation: ZoomAnimation | null = null

    let resizeObserver: ResizeObserver | null = null
    let hasWindowResizeListener = false
    let rafId: number | null = null
    let lastFrameTime: number | null = null
    let released = false

    // 表面テクスチャと輪テクスチャは天体ID単位でキャッシュし、天体を何度切り替えても
    // 1天体につき1回しかCanvas 2Dのピクセルループを走らせない(生成コストの主因のため)。
    const surfaceCache = new Map<CelestialBodyId, SurfaceMaps>()
    const ringTextureCache = new Map<CelestialBodyId, (THREE.CanvasTexture | null)[]>()
    const cloudTextureCache = new Map<CelestialBodyId, THREE.CanvasTexture | null>()
    const satelliteTextureCache = new Map<string, THREE.CanvasTexture | null>()

    function getOrCreateSurfaceMaps(body: CelestialBody): SurfaceMaps {
      const cached = surfaceCache.get(body.id)
      if (cached !== undefined) return cached

      const maps = createSurfaceMaps(body.surface)
      const maxAnisotropy = renderer?.capabilities.getMaxAnisotropy() ?? 1
      if (maps.map !== null) maps.map.anisotropy = maxAnisotropy
      if (maps.bumpMap !== null) maps.bumpMap.anisotropy = maxAnisotropy
      surfaceCache.set(body.id, maps)
      return maps
    }

    function getOrCreateRingTextures(
      body: CelestialBody,
      ring: RingSpec,
    ): (THREE.CanvasTexture | null)[] {
      const cached = ringTextureCache.get(body.id)
      if (cached !== undefined) return cached

      const textures = ring.segments.map((segment) => createRingSegmentTexture(segment))
      ringTextureCache.set(body.id, textures)
      return textures
    }

    function getOrCreateCloudTexture(body: CelestialBody): THREE.CanvasTexture | null {
      const cached = cloudTextureCache.get(body.id)
      if (cached !== undefined) return cached
      const texture = body.visual?.clouds === undefined ? null : createCloudTexture(body.visual.clouds.patches)
      const maxAnisotropy = renderer?.capabilities.getMaxAnisotropy() ?? 1
      if (texture !== null) texture.anisotropy = maxAnisotropy
      cloudTextureCache.set(body.id, texture)
      return texture
    }

    function aspectOfContainer(): number {
      const rect = container.getBoundingClientRect()
      return rect.height > 0 ? rect.width / rect.height : 1
    }

    function setCameraDistance(distance: number) {
      if (camera === null || controls === null) return

      const direction = camera.position.clone().sub(controls.target)
      if (direction.lengthSq() === 0) direction.set(0, 0, 1)
      camera.position.copy(controls.target).add(direction.normalize().multiplyScalar(distance))
      controls.update()
    }

    /**
     * カメラの向きを既定視点(天体ごとに`viewDirectionOf`で決まる)へ戻す(距離は保つ)。
     * 天体を切り替えるたびに呼び、直前の天体をどれだけ回していても
     * 新しい天体が必ず見やすい角度(土星なら輪が開いた角度)で現れるようにする。
     */
    function resetCameraOrientation() {
      if (camera === null || controls === null || currentBody === null) return

      const distance = camera.position.distanceTo(controls.target)
      const view = viewDirectionOf(currentBody)
      const direction = new THREE.Vector3(view.x, view.y, view.z).normalize()
      camera.position.copy(controls.target).add(direction.multiplyScalar(distance))
      controls.update()
    }

    function updateControlsDistanceLimits(body: CelestialBody) {
      if (controls === null) return

      const aspect = aspectOfContainer()
      // level3(最大ズーム)より寄れなくし、今回追加したlevel-2より離れられなくする。
      controls.minDistance = cameraDistanceForZoomWithSatellites(
        body,
        3,
        aspect,
        activeSatellites,
        activeShowSatellites,
      ) * 0.85
      controls.maxDistance = cameraDistanceForZoomWithSatellites(
        body,
        MIN_ZOOM_LEVEL,
        aspect,
        activeSatellites,
        activeShowSatellites,
      ) * 1.2
    }

    function disposeSatellites() {
      for (const visual of satelliteVisuals) {
        visual.mesh.material instanceof THREE.Material && visual.mesh.material.dispose()
        visual.atmosphere?.material instanceof THREE.Material && visual.atmosphere.material.dispose()
        visual.mesh.removeFromParent()
        visual.atmosphere?.removeFromParent()
        visual.orbitLine.material instanceof THREE.Material && visual.orbitLine.material.dispose()
        visual.orbitLine.geometry.dispose()
        visual.orbitLine.removeFromParent()
        visual.orbitPivot.removeFromParent()
        visual.orbitPlaneGroup.removeFromParent()
      }
      satelliteVisuals = []
      if (satelliteSystemRoot !== null) satelliteSystemRoot.visible = false
      if (tiltGroup !== null) tiltGroup.position.set(0, 0, 0)
    }

    function disposeCurrentBody() {
      disposeSatellites()
      // 衛星テクスチャのキャッシュは個別観察エンジンが所有する。
      // 天体切り替え時に解放し、再訪問時だけ作り直す(毎renderでは生成しない)。
      for (const texture of satelliteTextureCache.values()) texture?.dispose()
      satelliteTextureCache.clear()
      for (const spotVisual of spotVisuals) {
        if (spotVisual.marker !== null) {
          spotVisual.marker.material.dispose()
          spotVisual.marker.removeFromParent()
        }
        if (spotVisual.pulse !== null) {
          spotVisual.pulse.material.dispose()
          spotVisual.pulse.removeFromParent()
        }
        for (const mesh of spotVisual.ringHighlights) {
          mesh.geometry.dispose()
          ;(mesh.material as THREE.Material).dispose()
          mesh.removeFromParent()
        }
      }
      spotVisuals = []

      if (sphereMesh !== null) {
        // 通常はMeshStandardMaterial、太陽(kind:'star')はShaderMaterial。
        // map/bumpMapはsurfaceCacheが保持し続けるため、ここではmaterial自体だけを破棄する。
        const material = sphereMesh.material as THREE.Material
        material.dispose()
        sphereMesh.removeFromParent()
        sphereMesh = null
      }
      for (const ringMesh of ringMeshes) {
        const material = ringMesh.material as THREE.MeshStandardMaterial
        // 輪のテクスチャもringTextureCacheが保持し続けるため、ここではdisposeしない。
        material.dispose()
        ringMesh.geometry.dispose()
        ringMesh.removeFromParent()
      }
      ringMeshes = []
      for (const material of visualMaterials) material.dispose()
      visualMaterials = []
      for (const object of visualObjects) object.removeFromParent()
      visualObjects = []
      cloudSpinGroup = null
      sunMaterial = null
      if (spinGroup !== null) {
        spinGroup.removeFromParent()
        spinGroup = null
      }
      if (tiltGroup !== null) {
        tiltGroup.removeFromParent()
        tiltGroup = null
      }
    }

    function buildBody(body: CelestialBody) {
      if (bodyRoot === null || sphereGeometry === null) return

      const nextTiltGroup = new THREE.Group()
      nextTiltGroup.rotation.z = axialTiltRotationZ(body)

      const nextSpinGroup = new THREE.Group()
      nextSpinGroup.rotation.y = body.initialRotationY

      const maps = getOrCreateSurfaceMaps(body)
      const isSun = body.kind === 'star'

      let material: THREE.Material
      if (isSun && maps.map !== null) {
        // 恒星は光源に照らされる/されないの陰影を持たせず、自分で光っている見た目にする。
        // ベースの帯+黒点テクスチャ(maps.map)はそのまま使い、その上へ流れるノイズと
        // Fresnel状の縁発光だけをシェーダーで重ねる(three/sunVisual.ts参照)。
        const sunMat = createSunSurfaceMaterial({
          map: maps.map,
          hotColor: body.material.emissive ?? '#fff3c4',
          flowStrength: body.material.emissiveIntensity ?? 0.5,
          // 外周スプライトに頼らず、球面内の縁だけを暖色でごく薄く明るくする。
          rimColor: '#ffb347',
        })
        sunMaterial = sunMat
        material = sunMat
      } else {
        const standardMaterial = new THREE.MeshStandardMaterial({
          roughness: body.material.roughness,
          metalness: 0,
        })
        if (maps.map !== null) {
          standardMaterial.map = maps.map
        } else {
          // Canvas 2Dが使えない環境でも球が透明にならないよう、地色で塗る。
          standardMaterial.color = new THREE.Color(body.surface.baseColor)
        }
        if (maps.bumpMap !== null) {
          standardMaterial.bumpMap = maps.bumpMap
          standardMaterial.bumpScale = body.material.bumpScale ?? 0
        }
        if (body.material.emissive !== undefined) {
          standardMaterial.emissive = new THREE.Color(body.material.emissive)
          standardMaterial.emissiveIntensity = body.material.emissiveIntensity ?? 1
        }
        material = standardMaterial
      }

      const mesh = new THREE.Mesh(sphereGeometry, material)
      // 極方向の潰れ(ガス惑星の扁平)はY軸(極軸)だけを縮めて表現する。
      mesh.scale.set(body.radius, body.radius * (1 - (body.flattening ?? 0)), body.radius)
      // 土星本体の影が輪に落ちるよう、球は影を落とす側にする(輪からの影は受けない)。
      mesh.castShadow = true
      mesh.receiveShadow = false
      nextSpinGroup.add(mesh)
      nextTiltGroup.add(nextSpinGroup)

      const visual = body.visual
      if (visual?.clouds !== undefined) {
        const texture = getOrCreateCloudTexture(body)
        const cloudMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: visual.clouds.opacity,
          depthWrite: false,
        })
        const cloudMesh = new THREE.Mesh(sphereGeometry, cloudMaterial)
        const cloudScale = body.radius * 1.014
        cloudMesh.scale.set(cloudScale, cloudScale * (1 - (body.flattening ?? 0)), cloudScale)
        cloudMesh.renderOrder = 1
        const nextCloudSpinGroup = new THREE.Group()
        nextCloudSpinGroup.rotation.y = body.initialRotationY
        nextCloudSpinGroup.add(cloudMesh)
        nextTiltGroup.add(nextCloudSpinGroup)
        cloudSpinGroup = nextCloudSpinGroup
        visualObjects.push(cloudMesh, nextCloudSpinGroup)
        visualMaterials.push(cloudMaterial)
      }

      if (visual?.atmosphere !== undefined) {
        const atmosphereMaterial = new THREE.MeshBasicMaterial({
          color: visual.atmosphere.color,
          transparent: true,
          opacity: visual.atmosphere.opacity,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
        const atmosphere = new THREE.Mesh(satelliteGeometry, atmosphereMaterial)
        const atmosphereScale = body.radius * visual.atmosphere.scale
        atmosphere.scale.set(
          atmosphereScale,
          atmosphereScale * (1 - (body.flattening ?? 0)),
          atmosphereScale,
        )
        atmosphere.renderOrder = 2
        nextTiltGroup.add(atmosphere)
        visualObjects.push(atmosphere)
        visualMaterials.push(atmosphereMaterial)
      }

      let nextRingMeshes: THREE.Mesh[] = []
      if (body.ring !== undefined) {
        const ring = body.ring
        const textures = getOrCreateRingTextures(body, ring)
        nextRingMeshes = createRingMeshes(body, ring, (_segment, index) => textures[index] ?? null)
        // 輪は自転させないため spinGroup ではなく tiltGroup 直下に置く。
        for (const ringMesh of nextRingMeshes) nextTiltGroup.add(ringMesh)
      }

      bodyRoot.add(nextTiltGroup)

      tiltGroup = nextTiltGroup
      spinGroup = nextSpinGroup
      sphereMesh = mesh
      ringMeshes = nextRingMeshes

      buildSpots(optionsRef.current.spots, body)
      buildSatellites(optionsRef.current.satellites ?? [], body)
    }

    function getOrCreateSatelliteTexture(satellite: SatelliteSpec): THREE.CanvasTexture | null {
      if (satelliteTextureCache.has(satellite.id)) return satelliteTextureCache.get(satellite.id) ?? null
      const texture = createSatelliteTexture(satellite)
      satelliteTextureCache.set(satellite.id, texture)
      return texture
    }

    function buildSatellites(satellites: readonly SatelliteSpec[], body: CelestialBody) {
      if (satelliteSystemRoot === null || satelliteGeometry === null) return
      activeSatellites = satellites
      activeShowSatellites = optionsRef.current.showSatellites ?? true
      satelliteSystemRoot.visible = activeShowSatellites && satellites.length > 0
      for (const satellite of satellites) {
        const orbitPlaneGroup = new THREE.Group()
        // Charonの簡易連星表現だけは、PlutoのtiltGroupと同じ軌道面にそろえる。
        orbitPlaneGroup.rotation.z = satellite.barycenter === undefined
          ? (satellite.orbitInclination ?? 0)
          : axialTiltRotationZ(body)
        const orbitPivot = new THREE.Group()
        orbitPivot.rotation.y = satellite.initialAngle
        const texture = getOrCreateSatelliteTexture(satellite)
        const material = createSatelliteMaterial(satellite, texture)
        const mesh = new THREE.Mesh(satelliteGeometry, material)
        const shape = satellite.shapeScale ?? { x: 1, y: 1, z: 1 }
        const radius = body.radius * satellite.displayScale
        mesh.scale.set(radius * shape.x, radius * shape.y, radius * shape.z)
        mesh.position.set(satellite.orbitRadius, 0, 0)
        mesh.castShadow = false
        mesh.receiveShadow = true
        orbitPivot.add(mesh)
        const lineGeometry = new THREE.BufferGeometry()
        const positions = new Float32Array(49 * 3)
        for (let index = 0; index <= 48; index += 1) {
          const angle = (index / 48) * Math.PI * 2
          positions[index * 3] = Math.cos(angle) * satellite.orbitRadius
          positions[index * 3 + 1] = 0
          positions[index * 3 + 2] = Math.sin(angle) * satellite.orbitRadius
        }
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        const lineMaterial = new THREE.LineBasicMaterial({
          color: satellite.appearance.accentColor,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        })
        const orbitLine = new THREE.LineLoop(lineGeometry, lineMaterial)
        orbitPlaneGroup.add(orbitLine)
        orbitPlaneGroup.add(orbitPivot)
        satelliteSystemRoot.add(orbitPlaneGroup)
        let atmosphere: THREE.Mesh | null = null
        if (satellite.appearance.atmosphere !== undefined && satelliteGeometry !== null) {
          const atmosphereSpec = satellite.appearance.atmosphere
          const atmosphereMaterial = new THREE.MeshBasicMaterial({
            color: atmosphereSpec.color,
            transparent: true,
            opacity: atmosphereSpec.opacity,
            side: THREE.BackSide,
            depthWrite: false,
          })
          atmosphere = new THREE.Mesh(sphereGeometry, atmosphereMaterial)
          const atmosphereRadius = radius * atmosphereSpec.scale
          atmosphere.scale.set(atmosphereRadius, atmosphereRadius, atmosphereRadius)
          orbitPivot.add(atmosphere)
        }
        satelliteVisuals.push({
          satellite,
          orbitPlaneGroup,
          orbitPivot,
          mesh,
          orbitLine,
          atmosphere,
          visible: false,
        })
      }
      updateSatelliteVisuals()
    }

    /** 天体1つぶんの特徴スポットの3Dオブジェクトを作る。marker/pulseはSprite(常にカメラを向く)。 */
    function buildSpots(spots: readonly FeatureSpot[], body: CelestialBody) {
      if (spinGroup === null || tiltGroup === null) return

      const markerDiameter = body.radius * MARKER_RADIUS_RATIO * 2
      const nextSpotVisuals: SpotVisual[] = []

      for (const spot of spots) {
        const target = spot.target
        let normalized: THREE.Vector3
        let localPosition: { x: number; y: number; z: number }
        let parent: THREE.Group
        let ringHighlights: THREE.Mesh[] = []

        if (target.kind === 'surface') {
          const direction = surfaceDirection(target.lonDeg, target.latDeg)
          normalized = new THREE.Vector3(direction.x, direction.y, direction.z)
          localPosition = surfaceSpotLocalPosition(body, target)
          parent = spinGroup
        } else {
          localPosition = ringSpotLocalPosition(body, target)
          normalized = new THREE.Vector3(localPosition.x / body.radius, 0, localPosition.z / body.radius)
          parent = tiltGroup
          const bands = resolveRingHighlightBands(body, target)
          ringHighlights = createRingHighlightMeshes(body, bands, RING_HIGHLIGHT_COLOR)
          for (const mesh of ringHighlights) tiltGroup.add(mesh)
        }

        const marker = markerTexture === null ? null : new THREE.Sprite(new THREE.SpriteMaterial({
          map: markerTexture,
          color: DEFAULT_MARKER_COLOR,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          opacity: 0,
        }))
        if (marker !== null) {
          marker.position.set(localPosition.x, localPosition.y, localPosition.z)
          marker.scale.set(markerDiameter, markerDiameter, 1)
          marker.renderOrder = 5
          marker.visible = false
          parent.add(marker)
        }

        const pulse = pulseTexture === null ? null : new THREE.Sprite(new THREE.SpriteMaterial({
          map: pulseTexture,
          color: spot.accentColor,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          opacity: 0,
        }))
        if (pulse !== null) {
          pulse.position.set(localPosition.x, localPosition.y, localPosition.z)
          pulse.scale.set(markerDiameter, markerDiameter, 1)
          pulse.renderOrder = 5
          pulse.visible = false
          parent.add(pulse)
        }

        nextSpotVisuals.push({
          spot,
          normalized,
          marker,
          pulse,
          ringHighlights,
          baseDiameter: markerDiameter,
          visible: false,
          displayOpacity: 0,
          selected: false,
          pulseStartedAt: null,
          ringHighlightOpacity: 0,
          ringHighlightAnimation: null,
        })
      }

      spotVisuals = nextSpotVisuals
    }

    function startRingHighlightFade(spotVisual: SpotVisual, toOpacity: number, durationMs: number) {
      if (spotVisual.ringHighlights.length === 0) return

      if (reducedMotion) {
        spotVisual.ringHighlightOpacity = toOpacity
        spotVisual.ringHighlightAnimation = null
        for (const mesh of spotVisual.ringHighlights) {
          mesh.visible = toOpacity > 0
          ;(mesh.material as THREE.MeshBasicMaterial).opacity = toOpacity
        }
        return
      }

      for (const mesh of spotVisual.ringHighlights) mesh.visible = true
      spotVisual.ringHighlightAnimation = {
        from: spotVisual.ringHighlightOpacity,
        to: toOpacity,
        startedAt: performance.now(),
        durationMs,
      }
    }

    /** 選択状態を反映する。天体切り替え直後は全スポットが未選択(selected:false)で作り直されるため、
     *  選択解除・輪ハイライトを消す処理を別途呼ぶ必要はない。 */
    function setSelectedSpot(spotId: string | null, restartPulse: boolean) {
      for (const spotVisual of spotVisuals) {
        const isSelected = spotVisual.spot.id === spotId
        const wasSelected = spotVisual.selected
        spotVisual.selected = isSelected

        if (isSelected && !wasSelected) {
          startRingHighlightFade(spotVisual, RING_HIGHLIGHT_MAX_OPACITY, RING_HIGHLIGHT_FADE_IN_MS)
        } else if (!isSelected && wasSelected) {
          spotVisual.pulseStartedAt = null
          if (spotVisual.pulse !== null) spotVisual.pulse.visible = false
          startRingHighlightFade(spotVisual, 0, RING_HIGHLIGHT_FADE_OUT_MS)
        }

        if (isSelected && restartPulse && !reducedMotion) {
          spotVisual.pulseStartedAt = performance.now()
          if (spotVisual.pulse !== null) spotVisual.pulse.visible = true
        }
      }
    }

    function applyPulseAnimation(spotVisual: SpotVisual, now: number) {
      if (spotVisual.pulse === null) return

      if (spotVisual.pulseStartedAt === null) {
        spotVisual.pulse.visible = false
        return
      }

      const progress = Math.min(1, (now - spotVisual.pulseStartedAt) / PULSE_DURATION_MS)
      const eased = easeOutCubic(progress)
      const scale = spotVisual.baseDiameter * (1 + (PULSE_MAX_SCALE - 1) * eased)

      spotVisual.pulse.visible = true
      spotVisual.pulse.scale.set(scale, scale, 1)
      spotVisual.pulse.material.color.set(spotVisual.spot.accentColor)
      spotVisual.pulse.material.opacity = PULSE_START_OPACITY * (1 - eased) * spotVisual.displayOpacity

      if (progress >= 1) {
        spotVisual.pulseStartedAt = null
        spotVisual.pulse.visible = false
      }
    }

    function applyMarkerAppearance(spotVisual: SpotVisual, now: number) {
      if (spotVisual.marker === null) return

      const breathing = reducedMotion
        ? 0.52
        : 0.52 + Math.sin((now / 1000) * ((Math.PI * 2) / MARKER_BREATH_PERIOD_SECONDS)) * 0.1
      const baseOpacity = spotVisual.selected ? 1 : breathing
      const scaleMultiplier = spotVisual.selected ? 1.5 : 1
      const color = spotVisual.selected ? spotVisual.spot.accentColor : DEFAULT_MARKER_COLOR

      const opacity = baseOpacity * spotVisual.displayOpacity
      const scale = spotVisual.baseDiameter * scaleMultiplier

      spotVisual.marker.visible = opacity > 0.004
      spotVisual.marker.material.opacity = opacity
      spotVisual.marker.material.color.set(color)
      spotVisual.marker.scale.set(scale, scale, 1)

      applyPulseAnimation(spotVisual, now)
    }

    function applyRingHighlightAnimation(spotVisual: SpotVisual, now: number) {
      if (spotVisual.ringHighlights.length === 0) return

      const animation = spotVisual.ringHighlightAnimation
      if (animation !== null) {
        const progress = Math.min(1, (now - animation.startedAt) / animation.durationMs)
        spotVisual.ringHighlightOpacity = animation.from + (animation.to - animation.from) * progress
        if (progress >= 1) spotVisual.ringHighlightAnimation = null
      }

      const opacity = spotVisual.ringHighlightOpacity
      for (const mesh of spotVisual.ringHighlights) {
        const material = mesh.material as THREE.MeshBasicMaterial
        material.opacity = opacity
        if (opacity > 0.001) {
          mesh.visible = true
        } else if (spotVisual.ringHighlightAnimation === null) {
          mesh.visible = false
        }
      }
    }

    /**
     * 特徴スポットの可視判定・見た目を毎frame更新する。可視判定は正規化空間(楕円体→単位球)で行う
     * (§1参照)。カメラ位置をtiltGroupローカルへ変換してから(r, r*(1-f), r)で割ることで、
     * 扁平した天体でも単位球に対する厳密な遮蔽判定がそのまま使える。
     */
    function updateSpotVisuals(now: number, dt: number) {
      if (spotVisuals.length === 0) return
      if (camera === null || tiltGroup === null || spinGroup === null || currentBody === null) return

      const flattening = currentBody.flattening ?? 0
      const radius = currentBody.radius

      // tiltGroup自体は姿勢を変えない(祖先もbodyRoot=原点固定)ため実質1回で済むはずだが、
      // render()より前に呼ぶこの位置では最新のmatrixWorldが未計算な場合があるため明示的に更新する。
      tiltGroup.updateWorldMatrix(true, false)
      spotCameraNormalized.copy(camera.position)
      tiltGroup.worldToLocal(spotCameraNormalized)
      spotCameraNormalized.set(
        spotCameraNormalized.x / radius,
        spotCameraNormalized.y / (radius * (1 - flattening)),
        spotCameraNormalized.z / radius,
      )

      const spinY = spinGroup.rotation.y
      const smoothing = reducedMotion ? 1 : 1 - Math.exp(-dt / SPOT_OPACITY_SMOOTHING_SECONDS)

      for (const spotVisual of spotVisuals) {
        let visible: boolean
        if (spotVisual.spot.target.kind === 'surface') {
          spotRotatedPoint.copy(spotVisual.normalized).applyAxisAngle(SPOT_Y_AXIS, spinY)
          visible = isSurfacePointVisible(spotCameraNormalized, spotRotatedPoint)
        } else {
          visible = isRingPointVisible(spotCameraNormalized, spotVisual.normalized)
        }
        spotVisual.visible = visible

        const targetOpacity = visible ? 1 : 0
        spotVisual.displayOpacity += (targetOpacity - spotVisual.displayOpacity) * smoothing
        if (Math.abs(spotVisual.displayOpacity - targetOpacity) < 0.003) {
          spotVisual.displayOpacity = targetOpacity
        }

        applyMarkerAppearance(spotVisual, now)
        applyRingHighlightAnimation(spotVisual, now)
      }
    }

    function updateSatelliteVisuals() {
      if (satelliteSystemRoot === null || camera === null || tiltGroup === null || currentBody === null) return
      const body = currentBody
      const radius = body.radius
      if (!activeShowSatellites) {
        tiltGroup.position.set(0, 0, 0)
        for (const visual of satelliteVisuals) {
          visual.orbitPlaneGroup.visible = false
          visual.visible = false
        }
        return
      }
      const flattening = body.flattening ?? 0
      tiltGroup.updateWorldMatrix(true, false)
      satelliteSystemRoot.updateWorldMatrix(true, true)
      satelliteCameraNormalized.copy(camera.position)
      tiltGroup.worldToLocal(satelliteCameraNormalized)
      satelliteCameraNormalized.set(
        satelliteCameraNormalized.x / radius,
        satelliteCameraNormalized.y / (radius * (1 - flattening)),
        satelliteCameraNormalized.z / radius,
      )
      let barycenterVisual: SatelliteVisual | null = null
      for (const visual of satelliteVisuals) {
        const enabled = activeShowSatellites
        visual.orbitPlaneGroup.visible = enabled
        visual.visible = false
        if (!enabled) continue
        visual.mesh.getWorldPosition(satelliteWorldPosition)
        satelliteLocalPosition.copy(satelliteWorldPosition)
        tiltGroup.worldToLocal(satelliteLocalPosition)
        satelliteNormalizedPoint.set(
          satelliteLocalPosition.x / radius,
          satelliteLocalPosition.y / (radius * (1 - flattening)),
          satelliteLocalPosition.z / radius,
        )
        visual.visible = isRingPointVisible(satelliteCameraNormalized, satelliteNormalizedPoint)
        applySatelliteSelection(
          visual.mesh.material as THREE.MeshStandardMaterial,
          visual.satellite.id === selectedSatelliteId,
        )
        if (visual.satellite.barycenter !== undefined) barycenterVisual = visual
      }
      if (barycenterVisual !== null) {
        barycenterVisual.mesh.getWorldPosition(satelliteWorldPosition)
        const direction = satelliteWorldPosition.normalize()
        const offset = radius * (barycenterVisual.satellite.barycenter?.parentOffsetRatio ?? 0)
        tiltGroup.position.set(-direction.x * offset, -direction.y * offset, -direction.z * offset)
      }
    }

    /** キャンバス上のタップ位置から、最も近い(見えている)スポットを選ぶ。Raycasterは使わない
     *  (マーカーはSpriteで見た目が小さく、ピンポイント判定になってしまうため。幼児向けには
     *  「画面上の距離」で判定するほうが確実に押せる)。 */
    function selectSpotAt(event: PointerEvent) {
      if (camera === null || renderer === null) return

      const rect = renderer.domElement.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top

      const candidates: SpotHitCandidate[] = []
      for (const spotVisual of spotVisuals) {
        if (!spotVisual.visible || spotVisual.marker === null) continue

        spotMarkerWorldPosition.setFromMatrixPosition(spotVisual.marker.matrixWorld)
        spotMarkerWorldPosition.project(camera)
        if (spotMarkerWorldPosition.z > 1 || spotMarkerWorldPosition.z < -1) continue

        const screen = ndcToScreen(spotMarkerWorldPosition.x, spotMarkerWorldPosition.y, rect.width, rect.height)
        candidates.push({ id: `spot:${spotVisual.spot.id}`, x: screen.x, y: screen.y, hitRadiusPx: spotVisual.spot.hitRadiusPx })
      }
      if (activeShowSatellites) {
        for (const satelliteVisual of satelliteVisuals) {
          if (!satelliteVisual.visible) continue
          satelliteWorldPosition.setFromMatrixPosition(satelliteVisual.mesh.matrixWorld)
          satelliteWorldPosition.project(camera)
          if (satelliteWorldPosition.z > 1 || satelliteWorldPosition.z < -1) continue
          const screen = ndcToScreen(satelliteWorldPosition.x, satelliteWorldPosition.y, rect.width, rect.height)
          candidates.push({
            id: `satellite:${satelliteVisual.satellite.id}`,
            x: screen.x,
            y: screen.y,
            hitRadiusPx: satelliteVisual.satellite.hitRadiusPx,
          })
        }
      }

      const selected = pickNearestSpot(candidates, pointerX, pointerY)
      if (selected?.startsWith('satellite:')) {
        optionsRef.current.onSpotSelect(null)
        optionsRef.current.onSatelliteSelect?.(selected.slice('satellite:'.length) || null)
      } else {
        optionsRef.current.onSatelliteSelect?.(null)
        optionsRef.current.onSpotSelect(selected?.slice('spot:'.length) ?? null)
      }
    }

    function handleSpotPointerDown(event: PointerEvent) {
      activePointerCount += 1
      if (!event.isPrimary || event.button !== 0) return
      // 2本目以降の指が触れたら、回転操作とみなしてタップ判定をやめる。
      if (activePointerCount > 1) {
        pointerStart = null
        return
      }
      pointerStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
    }

    function handleSpotPointerMove(event: PointerEvent) {
      if (pointerStart === null || pointerStart.pointerId !== event.pointerId || pointerStart.moved) return
      // 指が元の位置へ戻ってきても回転操作として扱う(離した位置との距離だけを見る方式より誤タップに強い)。
      if (exceedsTapMovement(event.clientX - pointerStart.x, event.clientY - pointerStart.y, POINTER_TAP_MOVE_PX)) {
        pointerStart.moved = true
      }
    }

    function handleSpotPointerUp(event: PointerEvent) {
      activePointerCount = Math.max(0, activePointerCount - 1)
      const start = pointerStart
      if (start === null || start.pointerId !== event.pointerId) return
      pointerStart = null
      if (!start.moved) selectSpotAt(event)
    }

    function handleSpotPointerCancel(event: PointerEvent) {
      activePointerCount = Math.max(0, activePointerCount - 1)
      if (pointerStart !== null && pointerStart.pointerId === event.pointerId) pointerStart = null
    }

    function handleSpotPointerLeave(event: PointerEvent) {
      if (pointerStart !== null && pointerStart.pointerId === event.pointerId) pointerStart = null
    }

    function setSatelliteOptions(satellites: readonly SatelliteSpec[], show: boolean) {
      const idsChanged = satellites.length !== activeSatellites.length
        || satellites.some((satellite, index) => satellite.id !== activeSatellites[index]?.id)
      activeShowSatellites = show
      activeSatellites = satellites
      if (!show && tiltGroup !== null) tiltGroup.position.set(0, 0, 0)
      if (idsChanged && currentBody !== null) {
        disposeSatellites()
        buildSatellites(satellites, currentBody)
      } else if (satelliteSystemRoot !== null) {
        satelliteSystemRoot.visible = show && satellites.length > 0
        updateControlsDistanceLimits(currentBody ?? initialOptions.body)
        setZoom(activeZoomLevel, true)
      }
    }

    function setSelectedSatellite(satelliteId: string | null) {
      selectedSatelliteId = satelliteId
      for (const visual of satelliteVisuals) {
        applySatelliteSelection(
          visual.mesh.material as THREE.MeshStandardMaterial,
          visual.satellite.id === satelliteId,
        )
      }
    }

    function setBody(body: CelestialBody) {
      // 同じ天体への再設定は何もしない。React再レンダリング・StrictMode二重実行での作り直しを防ぐ。
      if (currentBody !== null && currentBody.id === body.id) return

      const isFirstBody = currentBody === null

      disposeCurrentBody()
      activeSatellites = optionsRef.current.satellites ?? []
      activeShowSatellites = optionsRef.current.showSatellites ?? true
      selectedSatelliteId = optionsRef.current.selectedSatelliteId ?? null
      currentBody = body
      buildBody(body)

      if (lights !== null) {
        applyLighting(lights, body.lighting)
        // 影は輪を持つ天体(土星)だけで有効化する。本体の影が輪に落ちる立体感が目的で、
        // 輪の無い天体では影を計算する意味が薄い分、コストだけ払わないようにする。
        configureKeyLightShadow(lights.key, viewRadiusOf(body), body.ring !== undefined)
      }

      updateControlsDistanceLimits(body)
      resetCameraOrientation()
      // 初回だけは「遠くから寄ってくる」演出にならないよう即座に合わせ、
      // 2つめ以降は距離の変化をアニメーションで見せる。
      setZoom(activeZoomLevel, isFirstBody)
    }

    function setZoom(level: ZoomLevel, immediate = false) {
      activeZoomLevel = level
      if (camera === null || controls === null || currentBody === null) return

      const targetDistance = cameraDistanceForZoomWithSatellites(currentBody, level, aspectOfContainer(), activeSatellites, activeShowSatellites)
      const currentDistance = camera.position.distanceTo(controls.target)

      if (immediate || reducedMotion || Math.abs(currentDistance - targetDistance) < 0.5) {
        zoomAnimation = null
        setCameraDistance(targetDistance)
        return
      }

      zoomAnimation = {
        from: currentDistance,
        to: targetDistance,
        startedAt: performance.now(),
      }
    }

    function updateZoomAnimation(now: number) {
      if (zoomAnimation === null) return

      const progress = (now - zoomAnimation.startedAt) / ZOOM_ANIMATION_DURATION_MS
      const eased = easeOutCubic(progress)
      setCameraDistance(zoomAnimation.from + (zoomAnimation.to - zoomAnimation.from) * eased)

      if (progress >= 1) zoomAnimation = null
    }

    /**
     * 太陽の表面シェーダーの時間変化を進める。呼び出し側(tick)は reducedMotionのときは
     * そもそも呼ばないため、ここでは分岐しない(uTimeが0のまま止まった1コマになる)。
     */
    function updateSunAnimation(now: number) {
      const t = now / 1000

      if (sunMaterial !== null) updateSunSurfaceMaterial(sunMaterial, t)
    }

    function resizeRenderer() {
      if (renderer === null || camera === null) return

      const rect = container.getBoundingClientRect()
      const width = Math.max(
        1,
        Math.floor(rect.width || container.clientWidth || window.innerWidth || 1),
      )
      const height = Math.max(
        1,
        Math.floor(rect.height || container.clientHeight || window.innerHeight || 1),
      )

      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)

      if (currentBody !== null) {
        updateControlsDistanceLimits(currentBody)
        // 向きが変わった直後は、実行中のズームアニメーションを打ち切って新しいaspectの距離へ即座に合わせる。
        zoomAnimation = null
        setCameraDistance(cameraDistanceForZoomWithSatellites(currentBody, activeZoomLevel, width / height, activeSatellites, activeShowSatellites))
      }
    }

    function tick(now: number) {
      if (released) return
      rafId = window.requestAnimationFrame(tick)

      const dt = Math.min((now - (lastFrameTime ?? now)) / 1000, 0.1)
      lastFrameTime = now

      controls?.update()
      if (!reducedMotion && spinGroup !== null && currentBody !== null) {
        spinGroup.rotation.y += currentBody.spinSpeed * dt
      }
      if (!reducedMotion && cloudSpinGroup !== null && currentBody?.visual?.clouds !== undefined) {
        cloudSpinGroup.rotation.y += currentBody.visual.clouds.spinSpeed * dt
      }
      if (!reducedMotion && activeShowSatellites) {
        for (const visual of satelliteVisuals) {
          const direction = visual.satellite.retrograde ? -1 : 1
          visual.orbitPivot.rotation.y += direction * visual.satellite.orbitSpeed * dt
        }
      }
      if (!reducedMotion) updateSunAnimation(now)
      updateSpotVisuals(now, dt)
      updateSatelliteVisuals()
      updateZoomAnimation(now)

      if (renderer !== null && scene !== null && camera !== null) {
        renderer.render(scene, camera)
      }
    }

    function release() {
      if (released) return
      released = true
      engineRef.current = null

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }

      resizeObserver?.disconnect()
      resizeObserver = null
      if (hasWindowResizeListener) {
        window.removeEventListener('resize', resizeRenderer)
        hasWindowResizeListener = false
      }

      if (renderer !== null) {
        const canvas = renderer.domElement
        canvas.removeEventListener('pointerdown', handleSpotPointerDown)
        canvas.removeEventListener('pointermove', handleSpotPointerMove)
        canvas.removeEventListener('pointerup', handleSpotPointerUp)
        canvas.removeEventListener('pointercancel', handleSpotPointerCancel)
        canvas.removeEventListener('pointerleave', handleSpotPointerLeave)
      }

      controls?.dispose()
      controls = null

      disposeCurrentBody()
      sphereGeometry?.dispose()
      sphereGeometry = null
      satelliteGeometry?.dispose()
      satelliteGeometry = null

      markerTexture?.dispose()
      markerTexture = null
      pulseTexture?.dispose()
      pulseTexture = null

      // ここでようやくキャッシュ済みテクスチャも破棄する(天体切り替え中は保持し続けた)。
      for (const maps of surfaceCache.values()) {
        maps.map?.dispose()
        maps.bumpMap?.dispose()
      }
      surfaceCache.clear()
      for (const textures of ringTextureCache.values()) {
        for (const texture of textures) texture?.dispose()
      }
      ringTextureCache.clear()
      for (const texture of cloudTextureCache.values()) texture?.dispose()
      cloudTextureCache.clear()
      for (const texture of satelliteTextureCache.values()) texture?.dispose()
      satelliteTextureCache.clear()

      if (starField !== null) {
        starField.removeFromParent()
        disposeStarField(starField)
        starField = null
      }
      lights = null

      if (renderer !== null) {
        const canvas = renderer.domElement
        try {
          renderer.dispose()
        } catch {
          // jsdomなどWebGLコンテキストを持たない環境では何もしない。
        }
        try {
          renderer.forceContextLoss()
        } catch {
          // コンテキストを取得できないレンダラーでは何もしない。
        }
        if (canvas.parentElement) canvas.parentElement.removeChild(canvas)
        renderer = null
      }

      scene?.clear()
      scene = null
      camera = null
      bodyRoot = null
    }

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
      renderer.setClearAlpha(0)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.setPixelRatio(renderPixelRatioForDevice(window.devicePixelRatio))
      // 土星本体の影を輪に落とすためにシャドウマップを有効化する。柔らかい影のPCFSoftShadowMapを使う。
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap

      const canvas = renderer.domElement
      canvas.setAttribute('aria-hidden', 'true')
      canvas.style.touchAction = 'none'
      canvas.style.userSelect = 'none'
      canvas.style.display = 'block'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.addEventListener('pointerdown', handleSpotPointerDown)
      canvas.addEventListener('pointermove', handleSpotPointerMove)
      canvas.addEventListener('pointerup', handleSpotPointerUp)
      canvas.addEventListener('pointercancel', handleSpotPointerCancel)
      canvas.addEventListener('pointerleave', handleSpotPointerLeave)
      container.appendChild(canvas)

      // マーカー・パルスのテクスチャは天体を問わず共通のため、ここで1回だけ生成する。
      markerTexture = createMarkerTexture()
      pulseTexture = createPulseTexture()

      // 背景は透明のままにし、CSS側の宇宙背景(グラデーション)を透かして見せる。星はWebGL側に置く。
      scene = new THREE.Scene()

      camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEGREES, 1, CAMERA_NEAR, CAMERA_FAR)
      camera.position.set(0, 0, 1)
      camera.lookAt(0, 0, 0)

      // ライトは天体切り替えのたびに作り直さず、ここで1回だけ作って強度だけを差し替える。
      lights = createPlanetLights()
      scene.add(...lights.all)

      starField = createStarField(renderer.getPixelRatio())
      scene.add(starField)

      bodyRoot = new THREE.Group()
      scene.add(bodyRoot)
      satelliteSystemRoot = new THREE.Group()
      bodyRoot.add(satelliteSystemRoot)

      sphereGeometry = new THREE.SphereGeometry(1, 64, 48)
      satelliteGeometry = new THREE.SphereGeometry(1, 16, 10)

      controls = new OrbitControls(camera, canvas)
      controls.target.set(0, 0, 0)
      controls.enableZoom = false
      controls.enablePan = false
      controls.enableRotate = true
      controls.touches.ONE = THREE.TOUCH.ROTATE
      // 指が少し動いただけで暴れないよう、回転速度は控えめにする。
      controls.rotateSpeed = 0.5
      controls.enableDamping = !reducedMotion
      controls.dampingFactor = 0.18
      // 上下68度(22〜158度)で止め、天体がひっくり返って見えないようにする。
      controls.minPolarAngle = degToRad(22)
      controls.maxPolarAngle = degToRad(158)

      engineRef.current = { setBody, setZoom, setSelectedSpot, setSatelliteOptions, setSelectedSatellite }

      setBody(initialOptions.body)
      resizeRenderer()

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resizeRenderer)
        resizeObserver.observe(container)
      } else {
        window.addEventListener('resize', resizeRenderer)
        hasWindowResizeListener = true
      }

      rafId = window.requestAnimationFrame(tick)
    } catch {
      release()
    }

    return release
  }, [])

  useEffect(() => {
    engineRef.current?.setBody(options.body)
  }, [options.body])

  useEffect(() => {
    engineRef.current?.setZoom(options.zoomLevel)
  }, [options.zoomLevel])

  // selectionFeedbackKeyが実際に変化したときだけパルスをやり直す(同じ値のまま別の理由で
  // このeffectが再実行されても、選択演出を無駄に再生しないようにする)。
  const previousSelectionFeedbackKeyRef = useRef(options.selectionFeedbackKey)
  useEffect(() => {
    const restartPulse = options.selectedSpotId !== null
      && options.selectionFeedbackKey !== previousSelectionFeedbackKeyRef.current
    previousSelectionFeedbackKeyRef.current = options.selectionFeedbackKey
    engineRef.current?.setSelectedSpot(options.selectedSpotId, restartPulse)
  }, [options.selectedSpotId, options.selectionFeedbackKey])


  useEffect(() => {
    engineRef.current?.setSatelliteOptions(options.satellites ?? [], options.showSatellites ?? true)
  }, [options.satellites, options.showSatellites])

  useEffect(() => {
    engineRef.current?.setSelectedSatellite(options.selectedSatelliteId ?? null)
  }, [options.selectedSatelliteId])

  return handle
}
