/**
 * つくった車を走らせるシーン（コース・配置物・カメラ・走行）を管理する命令的hook。
 *
 * 車の組み立ては carModel.ts（＝つくりかえ画面とまったく同じ車）、
 * コースの形と走り方は driveCourse.ts、路面・配置物・空・カメラの計算は
 * サーキットレース側（`../circuit-racing/`）のものをそのまま使う。
 * このhookは「それらを1つのシーンにまとめ、毎フレーム車を進める」ことだけを行う。
 *
 * Reactの再描画でシーンを作り直さないよう、組み立てはマウント時の1回だけにし、
 * 走行状態・カメラ・加速はrefを通して渡す。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { CIRCUIT_SCENERY } from '../circuit-racing/circuit'
import { createRaceAtmosphere } from '../circuit-racing/atmosphere'
import { animateBoostEffect, BOOST_DURATION_SECONDS, createBoostEffect } from '../circuit-racing/boostEffect'
import { createCarContactShadows, createRaceEnvironment } from '../circuit-racing/carAppearance'
import { createMotionProfile, sampleMotion } from '../circuit-racing/motion'
import {
  chaseCameraPose,
  createTracksideLift,
  overviewCameraPose,
  sampleTracksideLift,
  tracksideCameraPose,
} from '../circuit-racing/raceCamera'
import { createCircuitScenery } from '../circuit-racing/scenery'
import { createSceneryShadows, RACE_SUN_OFFSET } from '../circuit-racing/sceneryShadows'
import { createTrackVisuals, ROAD_Y } from '../circuit-racing/trackVisuals'
import { CAR_CATEGORY_ORDER, type CarConfig } from './carConfig'
import { computeCarDimensions } from './carDimensions'
import { createCarModel } from './carModel'
import { createDriveCourse, driveCarTuning, driveTracksideAnchor } from './driveCourse'
import { clearCarVehicleModelCache } from './vehicleBody'

export type CarDriveCameraMode = 'chase' | 'trackside' | 'overview'
export type CarDriveSceneStatus = 'loading' | 'ready' | 'error'

export type CarDriveSceneOptions = {
  /** 走らせる車。つくりかえ画面と同じCarConfigをそのまま受け取る。 */
  config: CarConfig
  /** 走行中かどうか。false では車も時間も止まる。 */
  running: boolean
  cameraMode: CarDriveCameraMode
  onStatusChange?: (status: CarDriveSceneStatus) => void
  /** 1周するたびに、走り終えた周回数で呼ばれる。 */
  onLapChange?: (laps: number) => void
}

export type CarDriveSceneHandle = {
  registerContainer: (element: HTMLDivElement | null) => void
  /** 数秒だけ速くする。ボタンを押すたびに時間が延びる。 */
  boost: () => void
  /** 3Dを作り直す（読み込みに失敗したときのやり直し）。 */
  retry: () => void
}

const CAMERA_FOV = 48
const CAMERA_NEAR = 0.1
const CAMERA_FAR = 900
const MAX_DEVICE_PIXEL_RATIO = 2
const BOOST_SPEED_MULTIPLIER = 1.7
/**
 * 追いかけるカメラの位置。車の大きさに合わせて決めるので、
 * スクールバスのような大きい車でも画面いっぱいにならず、道の先まで見える。
 */
const CHASE_DISTANCE_BASE = 5
const CHASE_HEIGHT_BASE = 2.2

/** CarConfigの中身が変わったかどうかだけを見るための鍵。 */
function carConfigKey(config: CarConfig): string {
  return CAR_CATEGORY_ORDER.map((category) => config[category]).join('|')
}

export function useCarDriveScene(options: CarDriveSceneOptions): CarDriveSceneHandle {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const optionsRef = useRef(options)
  const boostRef = useRef<(() => void) | null>(null)
  const [generation, setGeneration] = useState(0)
  const configKey = carConfigKey(options.config)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const registerContainer = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element
  }, [])

  const handle = useMemo<CarDriveSceneHandle>(
    () => ({
      registerContainer,
      boost: () => boostRef.current?.(),
      retry: () => setGeneration((value) => value + 1),
    }),
    [registerContainer],
  )

  useEffect(() => {
    const host = containerRef.current
    if (host === null || typeof window === 'undefined') return undefined

    // null検査を通したあとの型で束縛し直す（関数宣言の中でも非nullとして扱えるようにする）。
    const sceneHost = host
    const config = optionsRef.current.config
    const course = createDriveCourse()
    const palette = CIRCUIT_SCENERY[course.scenery]
    const curve = course.curve
    curve.arcLengthDivisions = 4096
    curve.updateArcLengths()
    const dimensions = computeCarDimensions(config)
    const profile = createMotionProfile(driveCarTuning(config), curve, 0)

    let renderer: THREE.WebGLRenderer | null = null
    let resizeObserver: ResizeObserver | null = null
    let rafId: number | null = null
    let released = false
    let contextLost = false
    let failed = false
    let dirty = true
    let previousTime = 0
    let wasRunning = false
    let lastCameraMode: CarDriveCameraMode | null = null
    let elapsedSeconds = 0
    let boostRemaining = 0
    let reportedLaps = 0

    const markDirty = () => {
      dirty = true
    }
    const notify = (status: CarDriveSceneStatus) => {
      if (released) return
      // 一度でも作れなかったら、あとから車体だけ届いても「はしれる」へは戻さない
      // （やり直しボタンで作り直すまで案内を出したままにする）。
      if (failed && status !== 'error') return
      if (status === 'error') failed = true
      optionsRef.current.onStatusChange?.(status)
    }
    notify('loading')

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(palette.sky)
    const environment = createRaceEnvironment()
    scene.environment = environment
    scene.environmentIntensity = 0.45
    const atmosphere = createRaceAtmosphere(course)
    scene.add(atmosphere.group)
    const raceFog = new THREE.Fog(atmosphere.horizonColor, 160, 560)
    scene.fog = raceFog

    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR)
    camera.position.set(0, 10, 18)

    const hemisphere = new THREE.HemisphereLight('#e8f4ff', '#78856b', 1.0)
    const sun = new THREE.DirectionalLight('#fff1d6', 2.5)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.far = 500
    sun.shadow.bias = -0.0002
    sun.shadow.normalBias = 0.035
    const fill = new THREE.DirectionalLight('#d6e8ff', 0.38)
    fill.position.set(35, 16, -45)
    scene.add(hemisphere, sun, sun.target, fill)

    const courseBounds = new THREE.Box3()
      .setFromPoints(curve.getPoints(1024))
      .expandByScalar(course.width / 2 + 8)
    const overviewCenter = courseBounds.getCenter(new THREE.Vector3())
    const overviewExtent = courseBounds.getSize(new THREE.Vector3()).length() / 2

    /**
     * コース全体を見るカメラの位置。
     *
     * コースは東西に長いので、縦画面では長い辺を画面の長い辺（上下）へ向けたほうが
     * 同じ画角でも大きく見える。レース側のフィット計算をそのまま使いたいので、
     * 縦画面のときだけ x と z を入れ替えて渡し、返ってきた位置も入れ替えて戻す
     * （＝コースの東がわから見下ろす）。横画面はそのまま南がわから見下ろす。
     */
    function overviewPose(): { position: THREE.Vector3; target: THREE.Vector3 } {
      const portrait = camera.aspect < 1
      const bounds = portrait
        ? {
            min: { x: courseBounds.min.z, z: courseBounds.min.x },
            max: { x: courseBounds.max.z, z: courseBounds.max.x },
          }
        : courseBounds
      const pose = overviewCameraPose(bounds, camera.aspect, CAMERA_FOV)
      const position = new THREE.Vector3(pose.position.x, pose.position.y, pose.position.z)
      const target = new THREE.Vector3(pose.target.x, pose.target.y, pose.target.z)
      if (!portrait) return { position, target }
      return {
        position: new THREE.Vector3(position.z, position.y, position.x),
        target: new THREE.Vector3(target.z, target.y, target.x),
      }
    }

    // 車は非同期に届くGLBを含むので、先に受け皿だけ置いて走行ループを始める。
    const car = createCarModel(config, {
      onBodyStatusChange: (status) => {
        if (status === 'failed') notify('error')
        else if (status === 'ready') notify('ready')
      },
      onBodyReady: () => {
        wheelPivots = car.getWheelPivots()
        markDirty()
      },
    })
    let wheelPivots = car.getWheelPivots()
    scene.add(car.root)
    const boostEffect = createBoostEffect(-dimensions.length / 2, dimensions.width / 2)
    car.root.add(boostEffect)
    const contactShadows = createCarContactShadows()
    scene.add(contactShadows.mesh)
    // 接地影は車の外形から決まる。GLBの到着では寸法が変わらないので1回で足りる。
    const shadowCars = [
      {
        root: car.root,
        shadowSize: new THREE.Vector3(dimensions.overallWidth, dimensions.height, dimensions.length),
        shadowCenter: new THREE.Vector3(0, 0, 0),
      },
    ]

    let track: ReturnType<typeof createTrackVisuals> | undefined
    let scenery: ReturnType<typeof createCircuitScenery> | undefined
    let sceneryShadows: ReturnType<typeof createSceneryShadows> | undefined
    const tracksideAnchor = driveTracksideAnchor(course)
    let tracksideLift: number[] = []
    try {
      track = createTrackVisuals(course)
      scene.add(track.group)
      scenery = createCircuitScenery(course)
      scene.add(scenery.group)
      scenery.group.updateMatrixWorld(true)
      // 「みちばた」は1か所から見続けるので、配置物で車が隠れる区間だけ先に高さを上げておく。
      const sightline = new THREE.Raycaster()
      const origin = new THREE.Vector3()
      const direction = new THREE.Vector3()
      const obstacles = scenery.group
      tracksideLift = createTracksideLift(curve, tracksideAnchor, (pose) => {
        origin.set(pose.position.x, pose.position.y, pose.position.z)
        direction.set(pose.target.x, pose.target.y, pose.target.z).sub(origin)
        sightline.far = direction.length() - 0.5
        sightline.set(origin, direction.normalize())
        return sightline.intersectObject(obstacles, true).length > 0
      })
      sceneryShadows = createSceneryShadows(scenery.group)
      const receivers = new Set<THREE.MeshStandardMaterial>()
      for (const group of [track.group, scenery.group]) {
        group.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          for (const material of materials) {
            if (material instanceof THREE.MeshStandardMaterial) receivers.add(material)
          }
        })
      }
      receivers.forEach((material) => sceneryShadows!.apply(material))
    } catch {
      // コースを作れなくても、画面の案内からやり直せるようにする。
      notify('error')
    }

    function resize(): void {
      if (renderer === null) return
      const width = Math.max(1, sceneHost.clientWidth)
      const height = Math.max(1, sceneHost.clientHeight)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO))
      renderer.setSize(width, height, false)
      updateCamera()
      markDirty()
    }

    /** 走行プロファイルの現在位置を車へ反映し、カメラが使う姿勢を返す。 */
    function applyCarFrame(): {
      position: THREE.Vector3
      tangent: THREE.Vector3
      progress: number
    } {
      const duration = Math.max(0.001, profile.duration)
      const sample = sampleMotion(profile, elapsedSeconds % duration)
      const angle = Math.atan2(sample.tangent.x, sample.tangent.z)
      car.root.position.set(sample.position.x, ROAD_Y, sample.position.z)
      car.root.rotation.y = angle
      const laps = Math.floor(elapsedSeconds / duration)
      const distance = laps * profile.length + sample.distance
      for (const pivot of wheelPivots) pivot.rotation.x = -distance / dimensions.wheelRadius
      if (laps !== reportedLaps) {
        reportedLaps = laps
        if (!released) optionsRef.current.onLapChange?.(laps)
      }
      return {
        position: new THREE.Vector3(sample.position.x, ROAD_Y, sample.position.z),
        tangent: sample.tangent,
        progress: sample.distance / profile.length,
      }
    }

    function updateCamera(): void {
      const frame = applyCarFrame()
      const mode = optionsRef.current.cameraMode
      // コース全体を見るときだけ霧を外す。遠くの配置物まで色が残り、
      // 「じぶんのコース」として見渡せるようにする。
      scene.fog = mode === 'overview' ? null : raceFog
      if (mode === 'overview') {
        const pose = overviewPose()
        camera.fov = CAMERA_FOV
        camera.position.copy(pose.position)
        camera.lookAt(pose.target)
        camera.updateProjectionMatrix()
        lastCameraMode = mode
        return
      }
      if (mode === 'trackside') {
        const position = { ...tracksideAnchor }
        position.y = tracksideAnchor.y + sampleTracksideLift(tracksideLift, frame.progress)
        const pose = tracksideCameraPose(position, frame.position)
        camera.position.set(pose.position.x, pose.position.y, pose.position.z)
        camera.lookAt(pose.target.x, pose.target.y, pose.target.z)
        // 1か所から見続けるため、遠いときは画角を狭めて車の大きさを保つ。
        const distance = camera.position.distanceTo(car.root.position)
        const frameWidth = 4 + dimensions.length
        camera.fov = THREE.MathUtils.clamp(
          THREE.MathUtils.radToDeg(2 * Math.atan(frameWidth / Math.max(1, distance * Math.min(1, camera.aspect)))),
          4,
          CAMERA_FOV,
        )
        camera.updateProjectionMatrix()
        lastCameraMode = mode
        return
      }
      const pose = chaseCameraPose(frame.position, frame.tangent, {
        distance: CHASE_DISTANCE_BASE + dimensions.length * 0.85 + dimensions.height * 1.5,
        height: CHASE_HEIGHT_BASE + dimensions.height * 0.85,
        lookAhead: 5 + dimensions.length * 0.4,
        targetHeight: dimensions.height * 0.55,
      })
      camera.fov = CAMERA_FOV
      camera.position.set(pose.position.x, pose.position.y, pose.position.z)
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z)
      camera.updateProjectionMatrix()
      lastCameraMode = mode
    }

    function render(): void {
      if (renderer === null || released || contextLost || !dirty) return
      contactShadows.update(shadowCars)
      // 影の解像度は限られるので、近くで見るときは車のまわりだけへ寄せる。
      const overview = optionsRef.current.cameraMode === 'overview'
      const center = overview ? overviewCenter : car.root.position
      const extent = overview ? overviewExtent : 24
      sun.target.position.copy(center)
      sun.position.copy(center).add(RACE_SUN_OFFSET)
      sun.target.updateMatrixWorld()
      sun.shadow.camera.left = sun.shadow.camera.bottom = -extent
      sun.shadow.camera.right = sun.shadow.camera.top = extent
      sun.shadow.camera.updateProjectionMatrix()
      atmosphere.update(camera)
      track?.update(elapsedSeconds)
      renderer.render(scene, camera)
      dirty = false
    }

    function handleContextLost(event: Event): void {
      event.preventDefault()
      contextLost = true
      notify('error')
    }

    function handleContextRestored(): void {
      contextLost = false
      markDirty()
    }

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.0
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      track?.setAnisotropy(renderer.capabilities.getMaxAnisotropy())
      renderer.domElement.setAttribute('aria-hidden', 'true')
      renderer.domElement.style.display = 'block'
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false)
      renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored, false)
      sceneHost.appendChild(renderer.domElement)
      resize()

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(sceneHost)
      } else {
        window.addEventListener('resize', resize)
      }
      window.addEventListener('orientationchange', resize)

      boostRef.current = () => {
        if (contextLost) return
        boostRemaining = BOOST_DURATION_SECONDS
        animateBoostEffect(boostEffect, boostRemaining)
        markDirty()
      }

      const tick = (time: number) => {
        if (released || renderer === null) return
        if (previousTime === 0) previousTime = time
        const delta = Math.min(0.08, Math.max(0, (time - previousTime) / 1000))
        previousTime = time
        const running = optionsRef.current.running && !contextLost && !document.hidden
        const cameraChanged = optionsRef.current.cameraMode !== lastCameraMode
        if (running) {
          elapsedSeconds += delta * (boostRemaining > 0 ? BOOST_SPEED_MULTIPLIER : 1)
          boostRemaining = Math.max(0, boostRemaining - delta)
          animateBoostEffect(boostEffect, boostRemaining)
          updateCamera()
          dirty = true
        } else if (wasRunning || cameraChanged) {
          animateBoostEffect(boostEffect, boostRemaining)
          updateCamera()
          dirty = true
        }
        wasRunning = running
        render()
        rafId = window.requestAnimationFrame(tick)
      }
      rafId = window.requestAnimationFrame(tick)
      if (car.getBodyStatus() === 'ready') notify('ready')
    } catch {
      // WebGLが使えない端末では走行画面を出せない。案内からやり直せる状態にする。
      notify('error')
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
      boostRef.current = null
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      resizeObserver?.disconnect()
      if (resizeObserver === null) window.removeEventListener('resize', resize)
      window.removeEventListener('orientationchange', resize)
      if (renderer !== null) {
        renderer.domElement.removeEventListener('webglcontextlost', handleContextLost)
        renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored)
      }
      car.root.remove(boostEffect)
      boostEffect.traverse((child) => {
        const mesh = child as Partial<THREE.Mesh>
        mesh.geometry?.dispose()
        const material = mesh.material
        if (Array.isArray(material)) material.forEach((value) => value.dispose())
        else material?.dispose()
      })
      scene.remove(car.root)
      car.dispose()
      // 取得済みのGLBバイト列は画面を離れたら手放す。再訪時はHTTPキャッシュから戻る。
      clearCarVehicleModelCache()
      contactShadows.dispose()
      scenery?.dispose()
      sceneryShadows?.dispose()
      track?.dispose()
      atmosphere.dispose()
      environment.dispose()
      hemisphere.dispose()
      sun.dispose()
      fill.dispose()
      const canvas = renderer?.domElement ?? sceneHost.querySelector('canvas')
      if (renderer !== null) {
        try {
          renderer.dispose()
          renderer.forceContextLoss()
        } catch {
          // WebGLモックや既に失われたコンテキストでは不要。
        }
      }
      if (canvas !== null && canvas.parentNode === sceneHost) sceneHost.removeChild(canvas)
    }
    // 走らせる車が変わったとき（＝別の車で入り直したとき）だけ作り直す。
    // 走行中・カメラ・加速はrefで渡すので、ここでの作り直しは起きない。
  }, [generation, configKey])

  return handle
}
