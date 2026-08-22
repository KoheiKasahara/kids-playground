import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import ThreeGlobe from 'three-globe'
import type { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type {
  GlobeCountry,
  GlobeFeature,
  UseGlobeEngineHandle,
  UseGlobeEngineOptions,
  ZoomLevel,
} from '../types'
import {
  CAMERA_FAR,
  CAMERA_NEAR,
  cameraDistanceForZoom,
  easeOutCubic,
  rotateSpeedForZoom,
  ZOOM_ANIMATION_DURATION_MS,
} from './zoomLevels'
import {
  isGlobeBodyObject,
  polygonNumericIdFromObject,
} from './threeGlobeAdapter'
import {
  createGlobeBorderLines,
  disposeGlobeBorderLines,
  setGlobeBorderLinesSize,
} from './globeBorderLines'
import {
  BASE_BORDER_RADIUS,
  BASE_POLYGON_ALTITUDE,
  GLOBE_CURVATURE_RESOLUTION_DEGREES,
  POLYGON_CAP_CURVATURE_RESOLUTION_DEGREES,
  SELECTED_BORDER_RADIUS,
  SELECTED_POLYGON_ALTITUDE,
  SELECTED_POLYGON_POP_ALTITUDE,
  SELECTED_POLYGON_POP_BORDER_RADIUS,
} from './globeLayers'
import { renderPixelRatioForDevice } from './renderQuality'
import { configureGlobeRotationControls } from './rotationControls'
import {
  type BorderScaleAnimation,
  POLYGONS_TRANSITION_DURATION_MS,
  SELECTION_POP_RISE_DURATION_MS,
  SELECTION_POP_SETTLE_DURATION_MS,
  sampleBorderScaleAnimation,
} from './selectionTransition'

const BASE_GLOBE_COLOR = '#4dabf7'
const LAND_COLOR = '#8ce99a'
const SIDE_COLOR = '#69b97a'
const SELECTED_LAND_COLOR = '#ffd43b'
const SELECTED_SIDE_COLOR = '#f59f00'
const ATMOSPHERE_COLOR = '#74c0fc'
const POLYGON_DATA_FALLBACK_DELAY_MS = 250
const POINTER_CLICK_DISTANCE_PX = 8
// world units（地球半径100あたり）。cameraDistanceForZoom等と同じ単位系。
const POLYGON_HIT_TOLERANCE = 2

type PolygonDatum = GlobeFeature

type ZoomAnimation = {
  from: number
  to: number
  startedAt: number
  fromRotateSpeed: number
  toRotateSpeed: number
}

type GlobeEngine = {
  setZoom: (level: ZoomLevel) => void
  setSelectedCountry: (countryId: string | null, selectionFeedbackKey: number) => void
  setReducedMotion: (reducedMotion: boolean) => void
}

function numericIdOf(value: unknown): number | null {
  if (value === null || typeof value !== 'object') return null

  const id = (value as { id?: unknown }).id
  return typeof id === 'number' && Number.isInteger(id) ? id : null
}

function disposeGlobeTree(globe: ThreeGlobe) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()

  globe.traverse((object: THREE.Object3D) => {
    const renderObject = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry
      material?: THREE.Material | THREE.Material[]
    }

    if (renderObject.geometry !== undefined) geometries.add(renderObject.geometry)

    if (renderObject.material instanceof Array) {
      renderObject.material.forEach((material) => materials.add(material))
    } else if (renderObject.material !== undefined) {
      materials.add(renderObject.material)
    }
  })

  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
}

/** Three.jsのシーンと操作系をhookのライフサイクル内で完結させる。 */
export function useGlobeEngine(options: UseGlobeEngineOptions): UseGlobeEngineHandle {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const engineRef = useRef<GlobeEngine | null>(null)

  const registerContainer = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element
  }, [])

  const handle = useMemo<UseGlobeEngineHandle>(
    () => ({ registerContainer }),
    [registerContainer],
  )

  useEffect(() => {
    const container = containerRef.current
    if (container === null || typeof window === 'undefined') return undefined

    const initialOptions = optionsRef.current
    const countriesById = new Map<string, GlobeCountry>(
      initialOptions.countries.map((country) => [country.id, country]),
    )
    const countriesByNumericId = new Map<number, GlobeCountry>(
      initialOptions.countries.map((country) => [country.numericId, country]),
    )
    const featuresByNumericId = new Map<number, GlobeFeature>(
      initialOptions.features.map((feature) => [feature.id, feature]),
    )
    const polygonData: PolygonDatum[] = initialOptions.features.map((feature) => ({
      id: feature.id,
      geometry: feature.geometry,
    }))

    let scene: THREE.Scene | null = null
    let camera: THREE.PerspectiveCamera | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let controls: OrbitControls | null = null
    let globe: ThreeGlobe | null = null
    let borderLines: LineSegments2 | null = null
    let selectedBorderLines: LineSegments2 | null = null
    let selectedBorderAnimation: BorderScaleAnimation | null = null
    let selectedBorderRadius = SELECTED_BORDER_RADIUS
    let departingBorderLines: LineSegments2 | null = null
    let departingBorderAnimation: BorderScaleAnimation | null = null
    // 国境線の線幅計算に使う描画サイズ(CSSピクセル)。resizeのたびに更新する。
    const borderLinesSize = new THREE.Vector2(1, 1)
    let resizeObserver: ResizeObserver | null = null
    let hasWindowResizeListener = false
    let rafId: number | null = null
    let polygonLoadRafId: number | null = null
    let polygonLoadTimerId: number | null = null
    let selectionPopTimerId: number | null = null
    let polygonDataLoadStarted = false
    let hasRenderedFirstFrame = false
    let released = false
    let reducedMotion = initialOptions.reducedMotion
    let selectedNumericId = initialOptions.selectedCountryId === null
      ? null
      : countriesById.get(initialOptions.selectedCountryId)?.numericId ?? null
    let selectedPolygonAltitude = SELECTED_POLYGON_ALTITUDE
    let lastSelectionFeedbackKey = initialOptions.selectionFeedbackKey
    let selectionPopVersion = 0
    let zoomAnimation: ZoomAnimation | null = null
    let activeZoomLevel = initialOptions.zoomLevel

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const cameraDirection = new THREE.Vector3()
    const origin = new THREE.Vector3()
    let pointerStart: { pointerId: number; x: number; y: number } | null = null

    function setCameraDistance(distance: number) {
      if (camera === null || controls === null) return

      cameraDirection.copy(camera.position).sub(controls.target)
      if (cameraDirection.lengthSq() === 0) cameraDirection.set(0, 0, 1)
      camera.position.copy(controls.target).add(cameraDirection.normalize().multiplyScalar(distance))
      controls.update()
    }

    function cameraDistanceForViewport(level: ZoomLevel) {
      const rect = container?.getBoundingClientRect()
      return cameraDistanceForZoom(
        level,
        (rect?.height ?? 0) > (rect?.width ?? Number.POSITIVE_INFINITY),
      )
    }

    function updatePointOfView() {
      if (globe !== null && camera !== null) globe.setPointOfView(camera)
    }

    function updatePolygonAltitude(transitionDurationMs: number) {
      if (globe === null) return

      globe.polygonsTransitionDuration(
        reducedMotion ? 0 : transitionDurationMs,
      )
      // 高度アクセサの差し替えは、タップ直後と収束時の2回だけ行う。
      // requestAnimationFrameごとにgeometryを作り直さないため、地球儀の描画負荷を増やさない。
      globe.polygonAltitude((data: object) => (
        numericIdOf(data) === selectedNumericId
          ? selectedPolygonAltitude
          : BASE_POLYGON_ALTITUDE
      ))
    }

    function updatePolygonAppearance(transitionDurationMs = POLYGONS_TRANSITION_DURATION_MS) {
      if (globe === null) return

      globe.polygonCapColor((data: object) => {
        const id = numericIdOf(data)
        if (id === selectedNumericId) return SELECTED_LAND_COLOR
        return LAND_COLOR
      })
      globe.polygonSideColor((data: object) => {
        const id = numericIdOf(data)
        if (id === selectedNumericId) return SELECTED_SIDE_COLOR
        return SIDE_COLOR
      })
      updatePolygonAltitude(transitionDurationMs)
    }

    function cancelPolygonDataSchedule() {
      if (polygonLoadRafId !== null) {
        window.cancelAnimationFrame(polygonLoadRafId)
        polygonLoadRafId = null
      }
      if (polygonLoadTimerId !== null) {
        window.clearTimeout(polygonLoadTimerId)
        polygonLoadTimerId = null
      }
    }

    function addPolygonData() {
      if (
        released ||
        globe === null ||
        polygonData.length === 0 ||
        polygonDataLoadStarted
      ) return

      polygonDataLoadStarted = true
      cancelPolygonDataSchedule()

      const globeToPopulate = globe
      // polygonsData()は呼ぶたびに全体のdigestを行うため、簡略化済みの768件を
      // 細かく分割すると総時間が伸びやすい。初回描画後に一括投入して再計算を1回にする。
      globeToPopulate.polygonsTransitionDuration(0)
      globeToPopulate.polygonsData(polygonData)

      if (released || globe !== globeToPopulate) return
      // reduced-motionでも初回フレームを先に描画する遅延は維持し、段階的な演出は行わない。
      globeToPopulate.polygonsTransitionDuration(
        reducedMotion ? 0 : POLYGONS_TRANSITION_DURATION_MS,
      )
    }

    function schedulePolygonDataFallback() {
      if (
        released ||
        polygonData.length === 0 ||
        polygonDataLoadStarted ||
        polygonLoadTimerId !== null
      ) return
      polygonLoadTimerId = window.setTimeout(
        addPolygonData,
        POLYGON_DATA_FALLBACK_DELAY_MS,
      )
    }

    function schedulePolygonDataAfterFirstFrame() {
      if (
        released ||
        polygonData.length === 0 ||
        polygonDataLoadStarted ||
        polygonLoadRafId !== null
      ) return
      polygonLoadRafId = window.requestAnimationFrame(addPolygonData)
    }

    function setZoom(level: ZoomLevel) {
      activeZoomLevel = level
      const targetDistance = cameraDistanceForViewport(level)
      if (camera === null || controls === null) return

      const currentDistance = camera.position.distanceTo(controls.target)
      if (
        reducedMotion ||
        Math.abs(currentDistance - targetDistance) < 0.5
      ) {
        zoomAnimation = null
        setCameraDistance(targetDistance)
        controls.rotateSpeed = rotateSpeedForZoom(level)
        updatePointOfView()
        return
      }

      zoomAnimation = {
        from: currentDistance,
        to: targetDistance,
        startedAt: performance.now(),
        fromRotateSpeed: controls.rotateSpeed,
        toRotateSpeed: rotateSpeedForZoom(level),
      }
    }

    function cancelSelectionPop() {
      selectionPopVersion += 1
      if (selectionPopTimerId !== null) {
        window.clearTimeout(selectionPopTimerId)
        selectionPopTimerId = null
      }
    }

    function settleSelectedBorderLines() {
      if (selectedBorderLines === null) return

      const targetScale = SELECTED_BORDER_RADIUS / selectedBorderRadius
      selectedBorderAnimation = {
        fromScale: selectedBorderLines.scale.x,
        toScale: targetScale,
        startedAt: performance.now(),
        durationMs: SELECTION_POP_SETTLE_DURATION_MS,
      }
    }

    function scheduleSelectionPopSettle() {
      const popVersion = selectionPopVersion
      selectionPopTimerId = window.setTimeout(() => {
        selectionPopTimerId = null
        if (released || popVersion !== selectionPopVersion || selectedNumericId === null) return

        selectedPolygonAltitude = SELECTED_POLYGON_ALTITUDE
        updatePolygonAltitude(SELECTION_POP_SETTLE_DURATION_MS)
        settleSelectedBorderLines()
      }, SELECTION_POP_RISE_DURATION_MS)
    }

    function setSelectedCountry(countryId: string | null, selectionFeedbackKey: number) {
      const shouldPop = !reducedMotion
        && countryId !== null
        && selectionFeedbackKey !== lastSelectionFeedbackKey
      lastSelectionFeedbackKey = selectionFeedbackKey
      cancelSelectionPop()

      selectedNumericId = countryId === null
        ? null
        : countriesById.get(countryId)?.numericId ?? null
      selectedPolygonAltitude = shouldPop
        ? SELECTED_POLYGON_POP_ALTITUDE
        : SELECTED_POLYGON_ALTITUDE
      updatePolygonAppearance(
        shouldPop ? SELECTION_POP_RISE_DURATION_MS : POLYGONS_TRANSITION_DURATION_MS,
      )
      updateSelectedBorderLines(shouldPop)
      if (shouldPop) scheduleSelectionPopSettle()
    }

    function disposeBorderLines(lines: LineSegments2) {
      disposeGlobeBorderLines(lines)
      lines.removeFromParent()
    }

    function disposeSelectionBorderLines() {
      if (selectedBorderLines !== null) {
        disposeBorderLines(selectedBorderLines)
        selectedBorderLines = null
      }
      selectedBorderAnimation = null

      if (departingBorderLines !== null) {
        disposeBorderLines(departingBorderLines)
        departingBorderLines = null
      }
      departingBorderAnimation = null
    }

    function updateSelectedBorderLines(shouldPop: boolean) {
      const startedAt = performance.now()

      // 連続タップ時は、1つ前の国の線もポリゴンと同じ時間で地表へ戻す。
      if (departingBorderLines !== null) disposeBorderLines(departingBorderLines)
      departingBorderLines = selectedBorderLines
      departingBorderAnimation = departingBorderLines === null || reducedMotion
        ? null
        : {
            fromScale: departingBorderLines.scale.x,
            toScale: BASE_BORDER_RADIUS / selectedBorderRadius,
            startedAt,
            durationMs: POLYGONS_TRANSITION_DURATION_MS,
          }
      selectedBorderLines = null
      selectedBorderAnimation = null

      if (departingBorderLines !== null && reducedMotion) {
        disposeBorderLines(departingBorderLines)
        departingBorderLines = null
      }

      const selectedFeature = selectedNumericId === null
        ? undefined
        : featuresByNumericId.get(selectedNumericId)
      if (scene === null || selectedFeature === undefined) {
        selectedBorderRadius = SELECTED_BORDER_RADIUS
        return
      }

      selectedBorderRadius = shouldPop
        ? SELECTED_POLYGON_POP_BORDER_RADIUS
        : SELECTED_BORDER_RADIUS
      selectedBorderLines = createGlobeBorderLines(
        [selectedFeature],
        selectedBorderRadius,
      )
      const initialScale = reducedMotion ? 1 : BASE_BORDER_RADIUS / selectedBorderRadius
      selectedBorderLines.scale.setScalar(initialScale)
      setGlobeBorderLinesSize(selectedBorderLines, borderLinesSize.x, borderLinesSize.y)
      selectedBorderLines.renderOrder = 2
      scene.add(selectedBorderLines)
      selectedBorderAnimation = reducedMotion
        ? null
        : {
            fromScale: initialScale,
            toScale: 1,
            startedAt,
            durationMs: shouldPop
              ? SELECTION_POP_RISE_DURATION_MS
              : POLYGONS_TRANSITION_DURATION_MS,
          }
    }

    function setReducedMotion(nextReducedMotion: boolean) {
      reducedMotion = nextReducedMotion

      if (controls !== null) {
        controls.enableDamping = !nextReducedMotion
        controls.dampingFactor = nextReducedMotion ? 1 : 0.22
      }

      if (nextReducedMotion && zoomAnimation !== null) {
        const targetDistance = zoomAnimation.to
        const targetRotateSpeed = zoomAnimation.toRotateSpeed
        zoomAnimation = null
        setCameraDistance(targetDistance)
        if (controls !== null) controls.rotateSpeed = targetRotateSpeed
        updatePointOfView()
      }

      if (nextReducedMotion) {
        cancelSelectionPop()
        selectedPolygonAltitude = SELECTED_POLYGON_ALTITUDE
        if (selectedBorderLines !== null) {
          selectedBorderLines.scale.setScalar(
            SELECTED_BORDER_RADIUS / selectedBorderRadius,
          )
        }
        selectedBorderAnimation = null
        if (departingBorderLines !== null) {
          disposeBorderLines(departingBorderLines)
          departingBorderLines = null
        }
        departingBorderAnimation = null
      }

      updatePolygonAppearance()
    }

    function updateSelectionBorderAnimations(now: number) {
      if (selectedBorderLines !== null && selectedBorderAnimation !== null) {
        const sample = sampleBorderScaleAnimation(selectedBorderAnimation, now)
        selectedBorderLines.scale.setScalar(sample.scale)
        if (sample.complete) selectedBorderAnimation = null
      }

      if (departingBorderLines !== null && departingBorderAnimation !== null) {
        const sample = sampleBorderScaleAnimation(departingBorderAnimation, now)
        departingBorderLines.scale.setScalar(sample.scale)
        if (sample.complete) {
          disposeBorderLines(departingBorderLines)
          departingBorderLines = null
          departingBorderAnimation = null
        }
      }
    }

    function updateZoomAnimation(now: number) {
      if (zoomAnimation === null) return

      const progress = (now - zoomAnimation.startedAt) / ZOOM_ANIMATION_DURATION_MS
      const easedProgress = easeOutCubic(progress)
      setCameraDistance(
        zoomAnimation.from + (zoomAnimation.to - zoomAnimation.from) * easedProgress,
      )
      // ズーム中に操作感が急変しないよう、カメラ距離と同じイージングで補間する。
      if (controls !== null) {
        controls.rotateSpeed = zoomAnimation.fromRotateSpeed
          + (zoomAnimation.toRotateSpeed - zoomAnimation.fromRotateSpeed) * easedProgress
      }
      updatePointOfView()

      if (progress >= 1) {
        if (controls !== null) controls.rotateSpeed = zoomAnimation.toRotateSpeed
        zoomAnimation = null
      }
    }

    function selectCountryAt(event: PointerEvent) {
      if (camera === null || renderer === null || globe === null) return

      const rect = renderer.domElement.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        optionsRef.current.onCountrySelect(null)
        return
      }

      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)

      let closestPolygon: { distance: number; numericId: number } | null = null
      let closestGlobeDistance = Number.POSITIVE_INFINITY

      for (const intersection of raycaster.intersectObject(globe, true)) {
        const numericId = polygonNumericIdFromObject(intersection.object)
        if (numericId !== null) {
          if (closestPolygon === null || intersection.distance < closestPolygon.distance) {
            closestPolygon = { distance: intersection.distance, numericId }
          }
          continue
        }

        if (isGlobeBodyObject(intersection.object)) {
          closestGlobeDistance = Math.min(closestGlobeDistance, intersection.distance)
        }
      }

      // ポリゴンは「円錐」形状(中心から地表まで)で作られており、画面中心付近をタップすると、
      // その国とは無関係な、円錐の頂点(地球の中心)近くの薄い側面が誤って最短距離になることがある。
      // 本物の陸地タップは、海の球体表面とほぼ同じ距離になるはずなので、そこから離れすぎている
      // 交点は無視する。粗い曲面分割(capCurvatureResolution)による誤差も吸収できる余裕を持たせる。
      if (
        closestPolygon !== null &&
        closestPolygon.distance <= closestGlobeDistance + POLYGON_HIT_TOLERANCE
      ) {
        optionsRef.current.onCountrySelect(
          countriesByNumericId.get(closestPolygon.numericId)?.id ?? null,
        )
        return
      }

      optionsRef.current.onCountrySelect(null)
    }

    function handlePointerDown(event: PointerEvent) {
      if (!event.isPrimary || event.button !== 0) return
      pointerStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    }

    function handlePointerUp(event: PointerEvent) {
      const start = pointerStart
      pointerStart = null
      if (start === null || start.pointerId !== event.pointerId) return

      const movement = Math.hypot(event.clientX - start.x, event.clientY - start.y)
      if (movement > POINTER_CLICK_DISTANCE_PX) return
      selectCountryAt(event)
    }

    function handlePointerCancel() {
      pointerStart = null
    }

    function resizeRenderer() {
      if (container === null || renderer === null || camera === null) return

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
      borderLinesSize.set(width, height)
      if (borderLines !== null) setGlobeBorderLinesSize(borderLines, width, height)
      if (selectedBorderLines !== null) {
        setGlobeBorderLinesSize(selectedBorderLines, width, height)
      }
      if (departingBorderLines !== null) {
        setGlobeBorderLinesSize(departingBorderLines, width, height)
      }
      // 向きが変わった場合も、最小ズームだけはその画面比に合う表示範囲へ戻す。
      if (activeZoomLevel === 0) setCameraDistance(cameraDistanceForViewport(activeZoomLevel))
      updatePointOfView()
    }

    function tick(now: number) {
      if (released) return
      rafId = window.requestAnimationFrame(tick)

      if (controls !== null) controls.update()
      updateZoomAnimation(now)
      updateSelectionBorderAnimations(now)
      if (renderer !== null && scene !== null && camera !== null) {
        renderer.render(scene, camera)
        if (!hasRenderedFirstFrame) {
          hasRenderedFirstFrame = true
          // 現在のフレームを表示する機会を確保してから、重いgeometry生成を始める。
          schedulePolygonDataAfterFirstFrame()
        }
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
      cancelPolygonDataSchedule()
      cancelSelectionPop()

      resizeObserver?.disconnect()
      resizeObserver = null
      if (hasWindowResizeListener) {
        window.removeEventListener('resize', resizeRenderer)
        hasWindowResizeListener = false
      }

      if (renderer !== null) {
        const canvas = renderer.domElement
        canvas.removeEventListener('pointerdown', handlePointerDown)
        canvas.removeEventListener('pointerup', handlePointerUp)
        canvas.removeEventListener('pointercancel', handlePointerCancel)
      }
      controls?.removeEventListener('change', updatePointOfView)
      controls?.dispose()
      controls = null

      if (globe !== null) {
        globe.pauseAnimation()
        try {
          globe._destructor()
        } catch {
          // WebGLコンテキストが失われた場合も、下の自前解放は継続する。
        }
        // three-globeのdestructorが対象に含めない大気オブジェクトも回収する。
        disposeGlobeTree(globe)
        globe = null
      }

      if (borderLines !== null) {
        disposeGlobeBorderLines(borderLines)
        borderLines.removeFromParent()
        borderLines = null
      }
      disposeSelectionBorderLines()

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
    }

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      })
      renderer.setPixelRatio(renderPixelRatioForDevice(window.devicePixelRatio))
      renderer.outputColorSpace = THREE.SRGBColorSpace

      const canvas = renderer.domElement
      canvas.setAttribute('aria-hidden', 'true')
      canvas.style.touchAction = 'none'
      canvas.style.userSelect = 'none'
      canvas.style.display = 'block'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.addEventListener('pointerdown', handlePointerDown)
      canvas.addEventListener('pointerup', handlePointerUp)
      canvas.addEventListener('pointercancel', handlePointerCancel)
      container.appendChild(canvas)

      scene = new THREE.Scene()
      scene.background = new THREE.Color('#e7f5ff')

      camera = new THREE.PerspectiveCamera(45, 1, CAMERA_NEAR, CAMERA_FAR)
      const latitude = THREE.MathUtils.degToRad(25)
      const longitude = THREE.MathUtils.degToRad(90 - 135)
      camera.position.set(
        Math.cos(latitude) * Math.cos(longitude),
        Math.sin(latitude),
        Math.cos(latitude) * Math.sin(longitude),
      )
      camera.position.normalize().multiplyScalar(
        cameraDistanceForViewport(initialOptions.zoomLevel),
      )
      camera.lookAt(origin)

      const ambientLight = new THREE.AmbientLight(0xffffff, 1.35)
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4)
      directionalLight.position.set(-4, 6, 8)
      scene.add(ambientLight, directionalLight)

      const nextGlobe = new ThreeGlobe({
        animateIn: false,
        waitForGlobeReady: false,
      })
      globe = nextGlobe
      nextGlobe.globeMaterial(new THREE.MeshPhongMaterial({
        color: BASE_GLOBE_COLOR,
        shininess: 8,
      }))
      nextGlobe.globeCurvatureResolution(GLOBE_CURVATURE_RESOLUTION_DEGREES)
      nextGlobe.showAtmosphere(true)
      nextGlobe.atmosphereColor(ATMOSPHERE_COLOR)
      nextGlobe.atmosphereAltitude(0.08)
      nextGlobe.polygonGeoJsonGeometry((data: object) => (
        (data as PolygonDatum).geometry as unknown as {
          type: string
          coordinates: number[]
        }
      ))
      // 面ポリゴンは当たり判定用の簡略化データのまま維持し、線だけを別meshで滑らかにする。
      nextGlobe.polygonStrokeColor(() => null)
      nextGlobe.polygonCapCurvatureResolution(POLYGON_CAP_CURVATURE_RESOLUTION_DEGREES)
      nextGlobe.polygonsTransitionDuration(
        reducedMotion ? 0 : POLYGONS_TRANSITION_DURATION_MS,
      )
      updatePolygonAppearance()
      scene.add(nextGlobe)
      borderLines = createGlobeBorderLines(initialOptions.features, BASE_BORDER_RADIUS)
      borderLines.renderOrder = 1
      scene.add(borderLines)
      updateSelectedBorderLines(false)

      controls = new OrbitControls(camera, renderer.domElement)
      controls.target.set(0, 0, 0)
      controls.enableZoom = false
      controls.enablePan = false
      controls.enableRotate = true
      controls.rotateSpeed = rotateSpeedForZoom(initialOptions.zoomLevel)
      configureGlobeRotationControls(controls)
      controls.enableDamping = !reducedMotion
      controls.dampingFactor = reducedMotion ? 1 : 0.22
      controls.touches.ONE = THREE.TOUCH.ROTATE
      controls.minDistance = cameraDistanceForZoom(3) - 10
      controls.maxDistance = cameraDistanceForZoom(0, true) + 10
      controls.update()
      controls.addEventListener('change', updatePointOfView)

      updatePointOfView()
      resizeRenderer()

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resizeRenderer)
        resizeObserver.observe(container)
      } else {
        window.addEventListener('resize', resizeRenderer)
        hasWindowResizeListener = true
      }

      engineRef.current = {
        setZoom,
        setSelectedCountry,
        setReducedMotion,
      }
      rafId = window.requestAnimationFrame(tick)
      // 最初のtickが停止しても、一定時間後にはポリゴン生成を開始できるようにする。
      schedulePolygonDataFallback()
    } catch {
      release()
    }

    return release
  }, [])

  useEffect(() => {
    engineRef.current?.setZoom(options.zoomLevel)
  }, [options.zoomLevel])

  useEffect(() => {
    engineRef.current?.setSelectedCountry(
      options.selectedCountryId,
      options.selectionFeedbackKey,
    )
  }, [options.selectedCountryId, options.selectionFeedbackKey])

  useEffect(() => {
    engineRef.current?.setReducedMotion(options.reducedMotion)
  }, [options.reducedMotion])

  return handle
}
