import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type {
  CelestialBody,
  CelestialBodyId,
  UseSolarSystemOverviewEngineHandle,
  UseSolarSystemOverviewEngineOptions,
} from '../types'
import { CAMERA_FAR, CAMERA_NEAR, fitDistance } from './planetCamera'
import { axialTiltRotationZ, createRingMeshes } from './planetRing'
import { createStarField, disposeStarField } from './starField'
import { renderPixelRatioForDevice } from './renderQuality'
import {
  exceedsTapMovement,
  ndcToScreen,
  pickNearestSpot,
  POINTER_TAP_MOVE_PX,
  type SpotHitCandidate,
} from './spotPicking'
import {
  boostThinRingForOverview,
  createOverviewHaloTexture,
  createOverviewLabelTexture,
  createOverviewSurfaceTexture,
} from './overviewVisual'

/**
 * 太陽系全体表示(Phase 6)専用のThree.jsエンジン。個別観察(`usePlanetEngine.ts`)とは
 * 目的が異なる(1天体を大きく見せる/複数天体を並べて見せる)ため独立したhookにするが、
 * カメラの当たり判定・星空・輪・自転軸傾きなど「天体1つに閉じない」既存の純粋関数・
 * ユーティリティは同じものをそのまま再利用する(このファイル冒頭のimport参照)。
 */

/** 個別観察用の`body.radius`(画面での見やすさ基準の値)を、複数天体を並べる全体表示向けに縮小する係数。 */
const OVERVIEW_RADIUS_SCALE = 0.22
/** どんなに小さい天体(水星・冥王星)でも指で押せるよう、画面上の当たり判定半径の下限をそろえる。 */
const MIN_HIT_RADIUS_PX = 32
const OVERVIEW_FOV_DEGREES = 46
/** 真上(2D)・真横(平面的)にならない、斜め上から見下ろす既定視点。 */
const OVERVIEW_VIEW_DIRECTION = { x: 0.52, y: 0.62, z: 0.94 } as const
/** 外側の天体まで画面に収めるための余白倍率。 */
const OUTER_VIEW_MARGIN = 1.2
/** 内惑星へ寄れる最短距離を決めるための仮想半径(水星と地球の軌道の中間程度)。 */
const INNER_FIT_RADIUS = 150
/** +/−ボタン1回で変えるカメラ距離の比率。 */
const BUTTON_ZOOM_RATIO = 0.76

const ORBIT_LINE_SEGMENTS = 96
const ORBIT_LINE_COLOR = '#93a5df'
const ORBIT_LINE_OPACITY = 0.32
/** 冥王星の軌道だけ破線にし、8惑星と同列に見えないようにする。 */
const DWARF_ORBIT_LINE_COLOR = '#cdb8f5'
const DWARF_ORBIT_LINE_OPACITY = 0.5

const MOON_ORBIT_RADIUS_FACTOR = 2.6
const MOON_RADIUS_SCALE = OVERVIEW_RADIUS_SCALE * 0.5
const MOON_ANGULAR_SPEED = 1.1

function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function getReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

type PlanetEntry = {
  id: CelestialBodyId
  orbitPivot: THREE.Group
  bodyAnchor: THREE.Group
  angle: number
  angularSpeed: number
}

type InteractiveBody = {
  id: CelestialBodyId
  anchor: THREE.Object3D
}

type Engine = {
  setPlaying: (playing: boolean) => void
  zoomIn: () => void
  zoomOut: () => void
}

export function useSolarSystemOverviewEngine(
  options: UseSolarSystemOverviewEngineOptions,
): UseSolarSystemOverviewEngineHandle {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const engineRef = useRef<Engine | null>(null)

  const registerContainer = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element
  }, [])

  const zoomIn = useCallback(() => {
    engineRef.current?.zoomIn()
  }, [])

  const zoomOut = useCallback(() => {
    engineRef.current?.zoomOut()
  }, [])

  const handle = useMemo<UseSolarSystemOverviewEngineHandle>(
    () => ({ registerContainer, zoomIn, zoomOut }),
    [registerContainer, zoomIn, zoomOut],
  )

  useEffect(() => {
    const containerElement = containerRef.current
    if (containerElement === null || typeof window === 'undefined') return undefined
    const container: HTMLDivElement = containerElement

    const initialOptions = optionsRef.current
    const reducedMotion = getReducedMotion()

    let scene: THREE.Scene | null = null
    let camera: THREE.PerspectiveCamera | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let controls: OrbitControls | null = null
    let starField: THREE.Points | null = null

    const sphereGeometry = new THREE.SphereGeometry(1, 20, 14)
    const orbitLineGeometry = new THREE.BufferGeometry()
    {
      const positions = new Float32Array((ORBIT_LINE_SEGMENTS + 1) * 3)
      for (let i = 0; i <= ORBIT_LINE_SEGMENTS; i += 1) {
        const angle = (i / ORBIT_LINE_SEGMENTS) * Math.PI * 2
        positions[i * 3] = Math.cos(angle)
        positions[i * 3 + 1] = 0
        positions[i * 3 + 2] = Math.sin(angle)
      }
      orbitLineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    }

    const disposableGeometries: THREE.BufferGeometry[] = [sphereGeometry, orbitLineGeometry]
    const disposableMaterials: THREE.Material[] = []
    const disposableTextures: THREE.Texture[] = []

    const planetEntries: PlanetEntry[] = []
    const interactiveBodies: InteractiveBody[] = []
    let moonEntry: { pivot: THREE.Group; angle: number } | null = null
    let outerViewRadius = INNER_FIT_RADIUS

    let playing = initialOptions.playing
    let pointerStart: { pointerId: number; x: number; y: number; moved: boolean } | null = null
    let activePointerCount = 0

    let resizeObserver: ResizeObserver | null = null
    let hasWindowResizeListener = false
    let rafId: number | null = null
    let lastFrameTime: number | null = null
    let released = false
    let previousZoomAvailability: { canZoomIn: boolean; canZoomOut: boolean } | null = null

    function aspectOfContainer(): number {
      const rect = container.getBoundingClientRect()
      return rect.height > 0 ? rect.width / rect.height : 1
    }

    function buildOrbitLine(radius: number, dashed: boolean): THREE.Line {
      if (!dashed) {
        const material = new THREE.LineBasicMaterial({
          color: ORBIT_LINE_COLOR,
          transparent: true,
          opacity: ORBIT_LINE_OPACITY,
        })
        disposableMaterials.push(material)
        const line = new THREE.LineLoop(orbitLineGeometry, material)
        line.scale.set(radius, 1, radius)
        return line
      }

      // 破線は object.scale ではなく実半径で頂点を作る(computeLineDistancesがローカル座標の
      // 距離で判定するため、scaleに頼ると破線の間隔が半径ごとにばらついてしまう)。
      const geometry = new THREE.BufferGeometry()
      const positions = new Float32Array((ORBIT_LINE_SEGMENTS + 1) * 3)
      for (let i = 0; i <= ORBIT_LINE_SEGMENTS; i += 1) {
        const angle = (i / ORBIT_LINE_SEGMENTS) * Math.PI * 2
        positions[i * 3] = Math.cos(angle) * radius
        positions[i * 3 + 1] = 0
        positions[i * 3 + 2] = Math.sin(angle) * radius
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      disposableGeometries.push(geometry)

      const material = new THREE.LineDashedMaterial({
        color: DWARF_ORBIT_LINE_COLOR,
        transparent: true,
        opacity: DWARF_ORBIT_LINE_OPACITY,
        dashSize: radius * 0.02,
        gapSize: radius * 0.015,
      })
      disposableMaterials.push(material)
      const line = new THREE.LineLoop(geometry, material)
      line.computeLineDistances()
      return line
    }

    function buildLabel(displayName: string, overviewRadius: number): THREE.Sprite | null {
      const texture = createOverviewLabelTexture(displayName)
      if (texture === null) return null
      disposableTextures.push(texture)

      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
        depthTest: false,
      })
      disposableMaterials.push(material)
      const sprite = new THREE.Sprite(material)
      const width = Math.max(overviewRadius * 3.2, 14)
      sprite.scale.set(width, width * (56 / 192), 1)
      sprite.position.set(0, overviewRadius * 2.2 + 3, 0)
      sprite.renderOrder = 4
      return sprite
    }

    function createBodyMesh(body: CelestialBody, overviewRadius: number): THREE.Mesh {
      const texture = createOverviewSurfaceTexture(body.surface)
      const material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 })
      if (texture !== null) {
        disposableTextures.push(texture)
        material.map = texture
      } else {
        material.color = new THREE.Color(body.surface.baseColor)
      }
      if (body.material.emissive !== undefined) {
        material.emissive = new THREE.Color(body.material.emissive)
        material.emissiveIntensity = body.material.emissiveIntensity ?? 1
      }
      disposableMaterials.push(material)

      const mesh = new THREE.Mesh(sphereGeometry, material)
      mesh.scale.set(overviewRadius, overviewRadius * (1 - (body.flattening ?? 0)), overviewRadius)
      return mesh
    }

    function buildSun(body: CelestialBody, sceneRoot: THREE.Group) {
      const overviewRadius = body.radius * OVERVIEW_RADIUS_SCALE

      // mesh自体はoverviewRadiusぶんscaleするため、halo・ラベルはscaleが1のsunRootへ
      // 付ける(meshの子にすると、halo/ラベルのscaleがoverviewRadius倍され巨大になる)。
      const sunRoot = new THREE.Group()
      sceneRoot.add(sunRoot)

      const mesh = createBodyMesh(body, overviewRadius)
      sunRoot.add(mesh)

      const halo = body.visual?.halo
      if (halo !== undefined) {
        const haloTexture = createOverviewHaloTexture(halo.color)
        if (haloTexture !== null) {
          disposableTextures.push(haloTexture)
          const haloMaterial = new THREE.SpriteMaterial({
            map: haloTexture,
            color: halo.color,
            transparent: true,
            opacity: halo.opacity,
            depthWrite: false,
            depthTest: false,
          })
          disposableMaterials.push(haloMaterial)
          const haloSprite = new THREE.Sprite(haloMaterial)
          const haloDiameter = overviewRadius * halo.scale
          haloSprite.scale.set(haloDiameter, haloDiameter, 1)
          haloSprite.renderOrder = -1
          sunRoot.add(haloSprite)
        }
      }

      const label = buildLabel(body.displayName, overviewRadius)
      if (label !== null) sunRoot.add(label)

      interactiveBodies.push({ id: body.id, anchor: sunRoot })
    }

    function buildOrbitingBody(body: CelestialBody, index: number, sceneRoot: THREE.Group): number {
      const orbit = body.orbit
      if (orbit === undefined) return 0

      const overviewRadius = body.radius * OVERVIEW_RADIUS_SCALE

      const orbitPivot = new THREE.Group()
      const bodyAnchor = new THREE.Group()
      bodyAnchor.position.set(orbit.radius, 0, 0)

      const tiltGroup = new THREE.Group()
      tiltGroup.rotation.z = axialTiltRotationZ(body)
      const mesh = createBodyMesh(body, overviewRadius)
      tiltGroup.add(mesh)

      if (body.ring !== undefined) {
        // ring.segmentsの比率は個別観察と共通のデータのため、半径だけ全体表示用に縮めたbodyを渡す。
        const ringMeshes = createRingMeshes({ ...body, radius: overviewRadius }, boostThinRingForOverview(body.ring))
        for (const ringMesh of ringMeshes) {
          disposableGeometries.push(ringMesh.geometry)
          disposableMaterials.push(ringMesh.material as THREE.Material)
          tiltGroup.add(ringMesh)
        }
      }

      bodyAnchor.add(tiltGroup)

      const label = buildLabel(body.displayName, overviewRadius)
      if (label !== null) bodyAnchor.add(label)

      orbitPivot.add(bodyAnchor)
      // 全惑星が一直線に並んだ状態(実際には起きない特別な配置)から始めないよう、
      // 天体ごとに開始角をずらす。物理的な意味は持たない見た目だけの初期化。
      const initialAngle = index * 0.87
      orbitPivot.rotation.y = initialAngle
      sceneRoot.add(orbitPivot)

      const dashed = body.kind === 'dwarf-planet'
      sceneRoot.add(buildOrbitLine(orbit.radius, dashed))

      planetEntries.push({ id: body.id, orbitPivot, bodyAnchor, angle: initialAngle, angularSpeed: orbit.angularSpeed })
      interactiveBodies.push({ id: body.id, anchor: bodyAnchor })

      if (body.id === 'earth') {
        const moon = initialOptions.moon
        if (moon !== undefined) {
          const moonOverviewRadius = moon.radius * MOON_RADIUS_SCALE
          const moonPivot = new THREE.Group()
          const moonAnchor = new THREE.Group()
          moonAnchor.position.set(overviewRadius * MOON_ORBIT_RADIUS_FACTOR, 0, 0)
          const moonMesh = createBodyMesh(moon, moonOverviewRadius)
          moonAnchor.add(moonMesh)
          moonPivot.add(moonAnchor)
          // 月は太陽を直接回る惑星列に混ぜず、地球のbodyAnchorの子として地球と一緒に公転させる。
          bodyAnchor.add(moonPivot)
          moonEntry = { pivot: moonPivot, angle: 0 }
        }
      }

      return orbit.radius
    }

    function selectBodyAt(event: PointerEvent) {
      if (camera === null || renderer === null) return
      const rect = renderer.domElement.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top

      const worldPosition = new THREE.Vector3()
      const candidates: SpotHitCandidate[] = []
      for (const body of interactiveBodies) {
        worldPosition.setFromMatrixPosition(body.anchor.matrixWorld)
        worldPosition.project(camera)
        if (worldPosition.z > 1 || worldPosition.z < -1) continue

        const screen = ndcToScreen(worldPosition.x, worldPosition.y, rect.width, rect.height)
        candidates.push({ id: body.id, x: screen.x, y: screen.y, hitRadiusPx: MIN_HIT_RADIUS_PX })
      }

      const picked = pickNearestSpot(candidates, pointerX, pointerY)
      if (picked !== null) optionsRef.current.onSelectBody(picked as CelestialBodyId)
    }

    function handlePointerDown(event: PointerEvent) {
      activePointerCount += 1
      if (!event.isPrimary || event.button !== 0) return
      if (activePointerCount > 1) {
        pointerStart = null
        return
      }
      pointerStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
    }

    function handlePointerMove(event: PointerEvent) {
      if (pointerStart === null || pointerStart.pointerId !== event.pointerId || pointerStart.moved) return
      if (exceedsTapMovement(event.clientX - pointerStart.x, event.clientY - pointerStart.y, POINTER_TAP_MOVE_PX)) {
        pointerStart.moved = true
      }
    }

    function handlePointerUp(event: PointerEvent) {
      activePointerCount = Math.max(0, activePointerCount - 1)
      const start = pointerStart
      if (start === null || start.pointerId !== event.pointerId) return
      pointerStart = null
      if (!start.moved) selectBodyAt(event)
    }

    function handlePointerCancel(event: PointerEvent) {
      activePointerCount = Math.max(0, activePointerCount - 1)
      if (pointerStart !== null && pointerStart.pointerId === event.pointerId) pointerStart = null
    }

    function handlePointerLeave(event: PointerEvent) {
      if (pointerStart !== null && pointerStart.pointerId === event.pointerId) pointerStart = null
    }

    function updateControlsLimits() {
      if (controls === null || camera === null) return
      const aspect = aspectOfContainer()
      controls.minDistance = fitDistance(INNER_FIT_RADIUS, aspect, OVERVIEW_FOV_DEGREES) * 0.7
      controls.maxDistance = fitDistance(outerViewRadius, aspect, OVERVIEW_FOV_DEGREES) * 1.35

      // 縦長画面(横方向のFOVが狭い)ではmaxDistanceが共通のCAMERA_FARを超えることがあり、
      // 太陽・惑星がカメラの far クリップ面の外に出て消えてしまう。実際に必要な距離まで
      // farを広げて必ず収める(狭くはしない = 個別観察側の精度をここで落とさない)。
      const requiredFar = controls.maxDistance + outerViewRadius * 1.5
      if (requiredFar > camera.far) {
        camera.far = requiredFar
        camera.updateProjectionMatrix()
      }
    }

    function notifyZoomAvailability() {
      if (camera === null || controls === null) return
      const distance = camera.position.distanceTo(controls.target)
      // 浮動小数点のわずかな誤差でボタンの有効/無効がちらつかないよう余裕を持たせる。
      const epsilon = Math.max(0.01, (controls.maxDistance - controls.minDistance) * 0.001)
      const availability = {
        canZoomIn: distance > controls.minDistance + epsilon,
        canZoomOut: distance < controls.maxDistance - epsilon,
      }
      if (
        previousZoomAvailability?.canZoomIn === availability.canZoomIn
        && previousZoomAvailability.canZoomOut === availability.canZoomOut
      ) return
      previousZoomAvailability = availability
      optionsRef.current.onZoomAvailabilityChange(availability)
    }

    function zoomBy(ratio: number) {
      if (camera === null || controls === null) return
      const currentDistance = camera.position.distanceTo(controls.target)
      const nextDistance = THREE.MathUtils.clamp(
        currentDistance * ratio,
        controls.minDistance,
        controls.maxDistance,
      )
      if (nextDistance !== currentDistance) {
        const direction = camera.position.clone().sub(controls.target).normalize()
        camera.position.copy(controls.target).add(direction.multiplyScalar(nextDistance))
        controls.update()
      }
      notifyZoomAvailability()
    }

    function resizeRenderer() {
      if (renderer === null || camera === null) return
      const rect = container.getBoundingClientRect()
      const width = Math.max(1, Math.floor(rect.width || container.clientWidth || window.innerWidth || 1))
      const height = Math.max(1, Math.floor(rect.height || container.clientHeight || window.innerHeight || 1))

      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      updateControlsLimits()

      // 連続ズームを許すため(ZoomControlsの離散ズームと違い)、リサイズのたびに距離をリセットしない。
      // 新しい制限の外に出ていた場合だけ範囲内へ戻す。
      if (controls !== null && camera !== null) {
        const distance = camera.position.distanceTo(controls.target)
        const clamped = THREE.MathUtils.clamp(distance, controls.minDistance, controls.maxDistance)
        if (clamped !== distance) {
          const direction = camera.position.clone().sub(controls.target).normalize()
          camera.position.copy(controls.target).add(direction.multiplyScalar(clamped))
          controls.update()
        }
      }
      notifyZoomAvailability()
    }

    function setPlaying(next: boolean) {
      playing = next
    }

    function tick(now: number) {
      if (released) return
      rafId = window.requestAnimationFrame(tick)

      const dt = Math.min((now - (lastFrameTime ?? now)) / 1000, 0.1)
      lastFrameTime = now

      controls?.update()

      if (playing && !reducedMotion) {
        for (const entry of planetEntries) {
          entry.angle += entry.angularSpeed * dt
          entry.orbitPivot.rotation.y = entry.angle
        }
        if (moonEntry !== null) {
          moonEntry.angle += MOON_ANGULAR_SPEED * dt
          moonEntry.pivot.rotation.y = moonEntry.angle
        }
      }

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
        canvas.removeEventListener('pointerdown', handlePointerDown)
        canvas.removeEventListener('pointermove', handlePointerMove)
        canvas.removeEventListener('pointerup', handlePointerUp)
        canvas.removeEventListener('pointercancel', handlePointerCancel)
        canvas.removeEventListener('pointerleave', handlePointerLeave)
      }

      controls?.removeEventListener('change', notifyZoomAvailability)
      controls?.dispose()
      controls = null

      for (const geometry of disposableGeometries) geometry.dispose()
      for (const material of disposableMaterials) material.dispose()
      for (const texture of disposableTextures) texture.dispose()

      if (starField !== null) {
        starField.removeFromParent()
        disposeStarField(starField)
        starField = null
      }

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
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
      renderer.setClearAlpha(0)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.setPixelRatio(renderPixelRatioForDevice(window.devicePixelRatio))

      const canvas = renderer.domElement
      canvas.setAttribute('aria-hidden', 'true')
      canvas.style.touchAction = 'none'
      canvas.style.userSelect = 'none'
      canvas.style.display = 'block'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.addEventListener('pointerdown', handlePointerDown)
      canvas.addEventListener('pointermove', handlePointerMove)
      canvas.addEventListener('pointerup', handlePointerUp)
      canvas.addEventListener('pointercancel', handlePointerCancel)
      canvas.addEventListener('pointerleave', handlePointerLeave)
      container.appendChild(canvas)

      scene = new THREE.Scene()
      camera = new THREE.PerspectiveCamera(OVERVIEW_FOV_DEGREES, 1, CAMERA_NEAR, CAMERA_FAR)

      const ambient = new THREE.AmbientLight(0xffffff, 0.85)
      const directional = new THREE.DirectionalLight(0xfff6e8, 0.9)
      directional.position.set(0.4, 0.6, 0.8).normalize().multiplyScalar(500)
      scene.add(ambient, directional)

      starField = createStarField(renderer.getPixelRatio())
      scene.add(starField)

      const sceneRoot = new THREE.Group()
      scene.add(sceneRoot)

      let maxOrbitRadius = INNER_FIT_RADIUS
      initialOptions.bodies.forEach((body, index) => {
        if (body.orbit === undefined) {
          buildSun(body, sceneRoot)
          return
        }
        const radius = buildOrbitingBody(body, index, sceneRoot)
        if (radius > maxOrbitRadius) maxOrbitRadius = radius
      })
      outerViewRadius = maxOrbitRadius * OUTER_VIEW_MARGIN

      const aspect = aspectOfContainer()
      const initialDistance = fitDistance(outerViewRadius, aspect, OVERVIEW_FOV_DEGREES)
      const direction = new THREE.Vector3(
        OVERVIEW_VIEW_DIRECTION.x,
        OVERVIEW_VIEW_DIRECTION.y,
        OVERVIEW_VIEW_DIRECTION.z,
      ).normalize()
      camera.position.copy(direction.multiplyScalar(initialDistance))
      camera.lookAt(0, 0, 0)

      controls = new OrbitControls(camera, canvas)
      controls.target.set(0, 0, 0)
      controls.enableZoom = true
      controls.enablePan = false
      controls.enableRotate = true
      controls.touches.ONE = THREE.TOUCH.ROTATE
      controls.rotateSpeed = 0.5
      controls.zoomSpeed = 0.8
      controls.enableDamping = !reducedMotion
      controls.dampingFactor = 0.15
      controls.minPolarAngle = degToRad(18)
      controls.maxPolarAngle = degToRad(82)
      updateControlsLimits()
      controls.update()
      controls.addEventListener('change', notifyZoomAvailability)

      engineRef.current = {
        setPlaying,
        zoomIn: () => zoomBy(BUTTON_ZOOM_RATIO),
        zoomOut: () => zoomBy(1 / BUTTON_ZOOM_RATIO),
      }

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
    engineRef.current?.setPlaying(options.playing)
  }, [options.playing])

  return handle
}
