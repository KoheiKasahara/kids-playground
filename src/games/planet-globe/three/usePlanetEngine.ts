import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type {
  CelestialBody,
  UsePlanetEngineHandle,
  UsePlanetEngineOptions,
  ZoomLevel,
} from '../types'
import {
  CAMERA_FAR,
  CAMERA_FOV_DEGREES,
  CAMERA_NEAR,
  cameraDistanceForZoom,
  DEFAULT_VIEW_DIRECTION,
  easeOutCubic,
  ZOOM_ANIMATION_DURATION_MS,
} from './planetCamera'
import { createSurfaceTexture } from './planetSurface'
import { axialTiltRotationZ, createRingMesh } from './planetRing'
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
    let ringMesh: THREE.Mesh | null = null

    let currentBody: CelestialBody | null = null
    let activeZoomLevel: ZoomLevel = initialOptions.zoomLevel
    let zoomAnimation: ZoomAnimation | null = null

    let resizeObserver: ResizeObserver | null = null
    let hasWindowResizeListener = false
    let rafId: number | null = null
    let lastFrameTime: number | null = null
    let released = false

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
     * カメラの向きを既定視点へ戻す（距離は保つ）。
     * 天体を切り替えるたびに呼び、直前の天体をどれだけ回していても
     * 新しい天体が必ず見やすい角度（土星なら輪が開いた角度）で現れるようにする。
     */
    function resetCameraOrientation() {
      if (camera === null || controls === null) return

      const distance = camera.position.distanceTo(controls.target)
      const direction = new THREE.Vector3(
        DEFAULT_VIEW_DIRECTION.x,
        DEFAULT_VIEW_DIRECTION.y,
        DEFAULT_VIEW_DIRECTION.z,
      ).normalize()
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
        material.map?.dispose()
        material.dispose()
        sphereMesh.removeFromParent()
        sphereMesh = null
      }
      if (ringMesh !== null) {
        const material = ringMesh.material as THREE.MeshStandardMaterial
        material.map?.dispose()
        material.dispose()
        ringMesh.geometry.dispose()
        ringMesh.removeFromParent()
        ringMesh = null
      }
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

      const texture = createSurfaceTexture(body.surface)
      const material = new THREE.MeshStandardMaterial({
        roughness: body.material.roughness,
        metalness: 0,
      })
      if (texture !== null) {
        material.map = texture
      } else {
        // Canvas 2Dが使えない環境でも球が透明にならないよう、地色で塗る。
        material.color = new THREE.Color(body.surface.baseColor)
      }

      const mesh = new THREE.Mesh(sphereGeometry, material)
      mesh.scale.setScalar(body.radius)
      nextSpinGroup.add(mesh)
      nextTiltGroup.add(nextSpinGroup)

      let nextRingMesh: THREE.Mesh | null = null
      if (body.ring !== undefined) {
        nextRingMesh = createRingMesh(body, body.ring)
        // 輪は自転させないため spinGroup ではなく tiltGroup 直下に置く。
        nextTiltGroup.add(nextRingMesh)
      }

      bodyRoot.add(nextTiltGroup)

      tiltGroup = nextTiltGroup
      spinGroup = nextSpinGroup
      sphereMesh = mesh
      ringMesh = nextRingMesh
    }

    function setBody(body: CelestialBody) {
      // 同じ天体への再設定は何もしない。React再レンダリング・StrictMode二重実行での作り直しを防ぐ。
      if (currentBody !== null && currentBody.id === body.id) return

      const isFirstBody = currentBody === null

      disposeCurrentBody()
      currentBody = body
      buildBody(body)
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

      const canvas = renderer.domElement
      canvas.setAttribute('aria-hidden', 'true')
      canvas.style.touchAction = 'none'
      canvas.style.userSelect = 'none'
      canvas.style.display = 'block'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      container.appendChild(canvas)

      // 背景は透明のままにし、CSS側の宇宙背景(星の点描)を透かして見せる。
      scene = new THREE.Scene()

      camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEGREES, 1, CAMERA_NEAR, CAMERA_FAR)
      camera.position.set(0, 0, 1)
      camera.lookAt(0, 0, 0)

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.55)
      const keyLight = new THREE.DirectionalLight(0xfff4e2, 1.45)
      keyLight.position.set(-0.55, 0.45, 1).normalize().multiplyScalar(300)
      // 暗部が真っ黒に沈まないよう、キー光の反対側から弱い補助光を当てる。
      const fillLight = new THREE.DirectionalLight(0xa9c0ff, 0.32)
      fillLight.position.set(0.7, -0.25, -0.6).normalize().multiplyScalar(300)
      scene.add(ambientLight, keyLight, fillLight)

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
