import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type {
  CelestialBody,
  CelestialBodyId,
  RingSpec,
  UsePlanetEngineHandle,
  UsePlanetEngineOptions,
  ZoomLevel,
} from '../types'
import {
  CAMERA_FAR,
  CAMERA_FOV_DEGREES,
  CAMERA_NEAR,
  cameraDistanceForZoom,
  easeOutCubic,
  viewDirectionOf,
  viewRadiusOf,
  ZOOM_ANIMATION_DURATION_MS,
} from './planetCamera'
import { createSurfaceMaps, type SurfaceMaps } from './planetSurface'
import { axialTiltRotationZ, createRingMeshes, createRingSegmentTexture } from './planetRing'
import {
  applyLighting,
  configureKeyLightShadow,
  createPlanetLights,
  type PlanetLights,
} from './planetLighting'
import { createStarField, disposeStarField } from './starField'
import { renderPixelRatioForDevice } from './renderQuality'

type ZoomAnimation = {
  from: number
  to: number
  startedAt: number
}

type PlanetEngine = {
  setBody: (body: CelestialBody) => void
  setZoom: (level: ZoomLevel) => void
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

    let tiltGroup: THREE.Group | null = null
    let spinGroup: THREE.Group | null = null
    let sphereMesh: THREE.Mesh | null = null
    let ringMeshes: THREE.Mesh[] = []

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
      // level3(最大ズーム)より寄れなくし、level0(全体表示)より離れられなくする。
      controls.minDistance = cameraDistanceForZoom(body, 3, aspect) * 0.85
      controls.maxDistance = cameraDistanceForZoom(body, 0, aspect) * 1.2
    }

    function disposeCurrentBody() {
      if (sphereMesh !== null) {
        const material = sphereMesh.material as THREE.MeshStandardMaterial
        // map/bumpMapはsurfaceCacheが保持し続けるため、ここではmaterial自体だけを破棄する。
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
      const material = new THREE.MeshStandardMaterial({
        roughness: body.material.roughness,
        metalness: 0,
      })
      if (maps.map !== null) {
        material.map = maps.map
      } else {
        // Canvas 2Dが使えない環境でも球が透明にならないよう、地色で塗る。
        material.color = new THREE.Color(body.surface.baseColor)
      }
      if (maps.bumpMap !== null) {
        material.bumpMap = maps.bumpMap
        material.bumpScale = body.material.bumpScale ?? 0
      }

      const mesh = new THREE.Mesh(sphereGeometry, material)
      // 極方向の潰れ(ガス惑星の扁平)はY軸(極軸)だけを縮めて表現する。
      mesh.scale.set(body.radius, body.radius * (1 - (body.flattening ?? 0)), body.radius)
      // 土星本体の影が輪に落ちるよう、球は影を落とす側にする(輪からの影は受けない)。
      mesh.castShadow = true
      mesh.receiveShadow = false
      nextSpinGroup.add(mesh)
      nextTiltGroup.add(nextSpinGroup)

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
    }

    function setBody(body: CelestialBody) {
      // 同じ天体への再設定は何もしない。React再レンダリング・StrictMode二重実行での作り直しを防ぐ。
      if (currentBody !== null && currentBody.id === body.id) return

      const isFirstBody = currentBody === null

      disposeCurrentBody()
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

      const targetDistance = cameraDistanceForZoom(currentBody, level, aspectOfContainer())
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
        setCameraDistance(cameraDistanceForZoom(currentBody, activeZoomLevel, width / height))
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

      controls?.dispose()
      controls = null

      disposeCurrentBody()
      sphereGeometry?.dispose()
      sphereGeometry = null

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
      container.appendChild(canvas)

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

      sphereGeometry = new THREE.SphereGeometry(1, 64, 48)

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

      engineRef.current = { setBody, setZoom }

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

  return handle
}
