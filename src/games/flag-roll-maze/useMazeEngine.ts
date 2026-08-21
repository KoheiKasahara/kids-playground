import { useEffect, useMemo, useRef } from 'react'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { createFlagPanelBallResource } from '../../components/flag-ball/flagPanelBall'
import type { FlagBallData } from '../../components/flag-ball/flagBalls'
import {
  BALL_RADIUS,
  FLOOR_THICKNESS,
  GOAL_RADIUS,
  MAX_FRAME_DELTA_MS,
  MAX_PHYSICS_SUBSTEPS,
  PHYSICS_TIMESTEP,
  visualTiltPivotOffset,
  visualTiltRotation,
  WALL_HEIGHT,
} from './mazePhysics'
import { createMazeStage, mazeStageBounds, type MazeStage } from './mazeStage'
import {
  cameraSetupForFocus,
  clampMazeZoomIndex,
  computeMazeCameraDistance,
  DEFAULT_MAZE_ZOOM_INDEX,
  desiredCameraFocus,
  followCameraFocus,
  followZoomScale,
  mazeZoomScale,
  type MazeCameraFocus,
} from './mazeCamera'
import {
  applyTiltToGravity,
  createMazeWorld,
  isGoalReached,
  limitBallSpeed,
  nudgeBall,
  resetBall,
} from './mazeWorld'
import {
  createStallTracker,
  hasFallenOut,
  updateStallTracker,
  type StallTracker,
} from './mazeRescue'
import { NEUTRAL_TILT, smoothTilt, type TiltInput } from './tiltInput'
import { createResizeScheduler } from './sceneResize'
import type { World } from '@dimforge/rapier3d-compat'

let rapierInitPromise: Promise<void> | null = null

/** Rapierのwasm初期化はモジュール内で一度だけ行い、再入場時に共有する。 */
function initializeRapier(): Promise<void> {
  if (rapierInitPromise === null) rapierInitPromise = RAPIER.init()
  return rapierInitPromise
}

/** WebGLモックや一部のコンテキストでは異方性上限を取得できないため、失敗時は省略する。 */
function getRendererMaxAnisotropy(
  renderer: THREE.WebGLRenderer,
): number | undefined {
  try {
    const maximum = renderer.capabilities?.getMaxAnisotropy?.()
    return typeof maximum === 'number' && Number.isFinite(maximum)
      ? maximum
      : undefined
  } catch {
    return undefined
  }
}

export type MazeEngineOptions = {
  /** 値が変わったら物理世界を作り直す（もういちど / たすけて）。 */
  runId: number
  /** 現在選択されている国旗。idの変更時はボールの見た目も作り直す。 */
  flag: Pick<FlagBallData, 'id' | 'flag'>
  /** ゴールに到達したとき一度だけ呼ぶ。 */
  onGoal: () => void
  /** 場外やスタックから自動復帰したとき呼ぶ。表示用で、ゲーム進行は止めない。 */
  onRescue?: () => void
}

export type MazeEngineHandle = {
  /** 3Dシーンを描画するDOM要素を登録するrefコールバック。 */
  registerContainer: (el: HTMLDivElement | null) => void
  /**
   * 傾き入力を渡す。React stateを経由しないので、
   * スティックを動かしてもプレイ画面は再描画されない。
   */
  setTilt: (tilt: TiltInput) => void
  /** ボールだけをスタートへ戻す。物理世界は作り直さない。 */
  resetBallToStart: () => void
  /**
   * カメラとボールの距離だけを段階的に変える。
   * 追従・向き・物理には一切触れないので、遊びの手触りは変わらない。
   */
  setZoomIndex: (index: number) => void
}

/**
 * Three.jsとRapierをuseEffectの中だけで動かす命令的エンジン。
 *
 * 入力は `setTilt` から入った TiltInput しか見ておらず、
 * それがマウスなのかタッチなのか（Phase 2ではジャイロなのか）を知らない。
 */
export function useMazeEngine(options: MazeEngineOptions): MazeEngineHandle {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const containerRef = useRef<HTMLDivElement | null>(null)
  // 目標の傾き。エンジン側は毎フレームここへ滑らかに近づける。
  const targetTiltRef = useRef<TiltInput>({ ...NEUTRAL_TILT })
  const resetActionRef = useRef<() => void>(() => undefined)
  const activeRunRef = useRef<symbol | null>(null)
  // ズームは見た目の好みなので、React stateを介さず毎フレーム読むだけにする。
  // refに持たせることで、runIdでシーンを作り直しても選んだ段が引き継がれる。
  const zoomIndexRef = useRef(DEFAULT_MAZE_ZOOM_INDEX)

  const handle = useMemo<MazeEngineHandle>(
    () => ({
      registerContainer: (el) => {
        containerRef.current = el
      },
      setTilt: (tilt) => {
        targetTiltRef.current = { x: tilt.x, y: tilt.y }
      },
      resetBallToStart: () => {
        resetActionRef.current()
      },
      setZoomIndex: (index) => {
        zoomIndexRef.current = clampMazeZoomIndex(index)
      },
    }),
    [],
  )

  useEffect(() => {
    const runToken = Symbol('flag-roll-maze-run')
    activeRunRef.current = runToken
    // 前のrunの傾きを持ち越さない。作り直した直後は必ず止まった状態から始める。
    targetTiltRef.current = { ...NEUTRAL_TILT }

    const stage: MazeStage = createMazeStage()
    const bounds = mazeStageBounds(stage)

    let world: World | null = null
    let scene: THREE.Scene | null = null
    let camera: THREE.PerspectiveCamera | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let boardGroup: THREE.Group | null = null
    let ballMesh: THREE.Object3D | null = null
    let ballBody: ReturnType<typeof createMazeWorld>['ball'] | null = null
    let resizeObserver: ResizeObserver | null = null
    let detachViewportListeners: (() => void) | null = null
    let rafId: number | null = null
    let released = false
    let goalNotified = false
    let lastFrameTime: number | null = null
    let accumulator = 0
    let currentTilt: TiltInput = { ...NEUTRAL_TILT }
    let stallTracker: StallTracker = createStallTracker()
    let cameraFocus: MazeCameraFocus = { x: 0, z: 0 }
    // 標準距離は画面比だけで決まる。ズームはそこへ掛ける倍率として持つ。
    let cameraBaseDistance = computeMazeCameraDistance(1)
    let cameraZoomScale = mazeZoomScale(zoomIndexRef.current)

    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []
    const textures: THREE.Texture[] = []

    const track = <T extends THREE.BufferGeometry>(geometry: T): T => {
      geometries.push(geometry)
      return geometry
    }
    const trackMaterial = <T extends THREE.Material>(material: T): T => {
      materials.push(material)
      return material
    }
    const trackTexture = <T extends THREE.Texture>(texture: T): T => {
      textures.push(texture)
      return texture
    }

    // 関数宣言のresizeRendererは巻き上げ済み。release()より前に用意しておく。
    const resizeScheduler = createResizeScheduler(() => resizeRenderer())

    function release() {
      if (released) return
      released = true

      if (activeRunRef.current === runToken) activeRunRef.current = null
      resetActionRef.current = () => undefined

      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      resizeObserver?.disconnect()
      resizeObserver = null
      resizeScheduler.cancel()
      detachViewportListeners?.()
      detachViewportListeners = null

      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      for (const texture of textures) texture.dispose()
      geometries.length = 0
      materials.length = 0
      textures.length = 0

      if (renderer !== null) {
        const canvas = renderer.domElement
        try {
          renderer.dispose()
        } catch {
          // WebGLコンテキストが失われた環境でも後続の解放を続ける。
        }
        try {
          renderer.forceContextLoss()
        } catch {
          // jsdomなど、コンテキストを持たないrendererでは何もしない。
        }
        if (canvas.parentElement) canvas.parentElement.removeChild(canvas)
        renderer = null
      }

      scene?.clear()
      scene = null
      camera = null
      boardGroup = null
      ballMesh = null
      ballBody = null

      if (world !== null) {
        world.free()
        world = null
      }
    }

    function resizeRenderer() {
      const container = containerRef.current
      if (!container || !renderer || !camera) return
      const rect = container.getBoundingClientRect()
      const width = Math.max(
        1,
        Math.floor(rect.width || container.clientWidth || window.innerWidth),
      )
      const height = Math.max(
        1,
        Math.floor(rect.height || container.clientHeight || window.innerHeight),
      )
      const aspect = width / height
      cameraBaseDistance = computeMazeCameraDistance(aspect)
      camera.aspect = aspect
      applyCameraFocus()
      camera.updateProjectionMatrix()
      // 第3引数false: canvasへ幅高さのインラインstyleを書かせない。
      // 書かせると「canvasの実サイズ→コンテナの高さ」の依存が生まれ、
      // 画面を回しても縮まないレイアウトになってしまう。表示サイズはCSSに任せる。
      renderer.setSize(width, height, false)
    }

    /**
     * 画面の向きが変わるとdvhもcanvasの縦横比も変わる。
     * ResizeObserverが拾えない環境や、回転直後に古い値を返す端末があるため、
     * 向き・ビューポート系のイベントからも測り直す。
     */
    function attachViewportListeners() {
      if (typeof window === 'undefined') return
      const handleViewportChange = () => resizeScheduler.schedule()
      const orientation = window.screen?.orientation

      window.addEventListener('resize', handleViewportChange)
      window.addEventListener('orientationchange', handleViewportChange)
      orientation?.addEventListener?.('change', handleViewportChange)
      window.visualViewport?.addEventListener('resize', handleViewportChange)

      detachViewportListeners = () => {
        window.removeEventListener('resize', handleViewportChange)
        window.removeEventListener('orientationchange', handleViewportChange)
        orientation?.removeEventListener?.('change', handleViewportChange)
        window.visualViewport?.removeEventListener('resize', handleViewportChange)
      }
    }

    // 毎フレーム作り直さず使い回す。60fpsでのGC発生を避ける。
    const tiltAxis = new THREE.Vector3()
    const cameraTarget = new THREE.Vector3()

    /** 標準距離はリサイズ時に決め、毎フレームは追従後の水平注視点とズーム倍率を反映する。 */
    function applyCameraFocus() {
      if (!camera) return
      const setup = cameraSetupForFocus(cameraFocus, cameraBaseDistance * cameraZoomScale)
      camera.position.set(setup.position.x, setup.position.y, setup.position.z)
      cameraTarget.set(setup.target.x, setup.target.y, setup.target.z)
      camera.lookAt(cameraTarget)
    }

    /**
     * 盤面と球をまとめて少しだけ傾け、どちらへ転がしているかを目で分かるようにする。
     * 回転中心は原点ではなく物理ボールへ置き、追従カメラが盤面の端の揺れを拾わないようにする。
     */
    function applyVisualTilt(tilt: TiltInput) {
      if (!boardGroup || !ballBody) return
      const { axis, angle } = visualTiltRotation(tilt)
      tiltAxis.set(axis.x, axis.y, axis.z).normalize()
      boardGroup.quaternion.setFromAxisAngle(tiltAxis, angle)
      const pivot = ballBody.translation()
      const offset = visualTiltPivotOffset({ axis, angle }, pivot)
      boardGroup.position.set(offset.x, offset.y, offset.z)
    }

    function writeVisuals() {
      if (!ballMesh || !ballBody) return
      const translation = ballBody.translation()
      const rotation = ballBody.rotation()
      ballMesh.position.set(translation.x, translation.y, translation.z)
      ballMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
    }

    /** 生成・リセット・救出の直後は、カメラをボール位置へ飛び移らせず即座に合わせる。 */
    function snapCameraFocusToBall() {
      if (!ballBody) return
      const position = ballBody.translation()
      cameraFocus = { x: position.x, z: position.z }
      applyCameraFocus()
    }

    /** 「＋ / −」で選ばれた段へ、距離を跳ねさせずに寄せる。 */
    function updateCameraZoom(deltaSeconds: number) {
      cameraZoomScale = followZoomScale(
        cameraZoomScale,
        mazeZoomScale(zoomIndexRef.current),
        deltaSeconds,
      )
    }

    /** 物理位置と水平速度だけで追従させ、高さの跳ねはカメラへ渡さない。 */
    function updateCameraFocus(deltaSeconds: number) {
      if (!ballBody) return
      const position = ballBody.translation()
      const velocity = ballBody.linvel()
      const desired = desiredCameraFocus(
        { x: position.x, z: position.z },
        { x: velocity.x, z: velocity.z },
        bounds,
      )
      cameraFocus = followCameraFocus(
        cameraFocus,
        desired,
        { x: position.x, z: position.z },
        deltaSeconds,
      )
      applyCameraFocus()
    }

    function rescueToStart() {
      if (!ballBody) return
      resetBall(ballBody, stage.start)
      stallTracker = createStallTracker()
      writeVisuals()
      snapCameraFocusToBall()
      optionsRef.current.onRescue?.()
    }

    function stepPhysics(deltaMs: number) {
      if (world === null || ballBody === null) return
      accumulator += deltaMs / 1000
      let substeps = 0
      while (accumulator >= PHYSICS_TIMESTEP && substeps < MAX_PHYSICS_SUBSTEPS) {
        world.step()
        accumulator -= PHYSICS_TIMESTEP
        substeps += 1
      }
      // 追いつけないほど遅れたら、溜まった時間を捨てて次のフレームから作り直す。
      if (substeps >= MAX_PHYSICS_SUBSTEPS && accumulator >= PHYSICS_TIMESTEP) {
        accumulator = 0
      }
      limitBallSpeed(ballBody)
    }

    function tick(now: number) {
      if (activeRunRef.current !== runToken || released) return
      rafId = requestAnimationFrame(tick)

      let deltaMs = 0
      if (lastFrameTime === null) {
        lastFrameTime = now
      } else {
        deltaMs = Math.min(Math.max(0, now - lastFrameTime), MAX_FRAME_DELTA_MS)
        lastFrameTime = now
      }

      const deltaSeconds = deltaMs / 1000
      // ゴール後は入力を無視し、その場でゆっくり止まるようにする。
      const target = goalNotified ? NEUTRAL_TILT : targetTiltRef.current
      currentTilt = smoothTilt(currentTilt, target, deltaSeconds)
      if (world !== null) applyTiltToGravity(world, currentTilt)

      if (deltaMs > 0) stepPhysics(deltaMs)
      writeVisuals()

      if (ballBody !== null) {
        const position = ballBody.translation()
        if (hasFallenOut(position, bounds)) {
          rescueToStart()
        } else if (!goalNotified) {
          const velocity = ballBody.linvel()
          const stall = updateStallTracker(stallTracker, {
            speed: Math.hypot(velocity.x, velocity.y, velocity.z),
            tiltMagnitude: Math.hypot(currentTilt.x, currentTilt.y),
            deltaMs,
          })
          stallTracker = stall.tracker
          if (stall.nudge) nudgeBall(ballBody, currentTilt)

          if (isGoalReached(position, stage.goal)) {
            goalNotified = true
            optionsRef.current.onGoal()
          }
        }
      }

      // 物理位置が確定してから、盤面のピボット補正とカメラ追従を同じ位置へ適用する。
      applyVisualTilt(currentTilt)
      updateCameraZoom(deltaSeconds)
      updateCameraFocus(deltaSeconds)

      if (renderer && scene && camera) renderer.render(scene, camera)
    }

    function createScene() {
      const container = containerRef.current
      if (!container || typeof window === 'undefined') return false

      const devicePixelRatio = window.devicePixelRatio || 1
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: devicePixelRatio <= 1.25,
          powerPreference: 'high-performance',
        })
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
        renderer.shadowMap.enabled = false
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.domElement.setAttribute('aria-hidden', 'true')
        container.appendChild(renderer.domElement)

        scene = new THREE.Scene()
        scene.background = new THREE.Color('#dff1ff')
        camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)

        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x9cc7a4, 1.7)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.05)
        directionalLight.position.set(-5, 10, 7)
        scene.add(hemisphereLight, directionalLight)

        // 盤面・壁・ゴール・ボールを1つのGroupへ入れ、まとめて見た目の傾きを掛ける。
        boardGroup = new THREE.Group()
        scene.add(boardGroup)

        const floorMesh = new THREE.Mesh(
          track(
            new THREE.BoxGeometry(stage.boardWidth, FLOOR_THICKNESS, stage.boardDepth),
          ),
          trackMaterial(new THREE.MeshLambertMaterial({ color: 0xfaf0d8 })),
        )
        floorMesh.position.y = -FLOOR_THICKNESS / 2
        boardGroup.add(floorMesh)

        const wallMaterial = trackMaterial(
          new THREE.MeshLambertMaterial({ color: 0x67b3e8 }),
        )
        for (const wall of stage.walls) {
          const wallMesh = new THREE.Mesh(
            track(new THREE.BoxGeometry(wall.width, WALL_HEIGHT, wall.depth)),
            wallMaterial,
          )
          wallMesh.position.set(wall.x, WALL_HEIGHT / 2, wall.z)
          boardGroup.add(wallMesh)
        }

        // ゴールは床から少しだけ浮かせた円盤にして、ボールが乗り上げないようにする。
        // 判定半径そのものだと印が小さく見えるため、球半径の1/4だけ外へ広げる。
        const markerRadius = GOAL_RADIUS + BALL_RADIUS * 0.25
        const goalMesh = new THREE.Mesh(
          track(new THREE.CylinderGeometry(markerRadius, markerRadius, BALL_RADIUS * 0.1, 28)),
          trackMaterial(new THREE.MeshLambertMaterial({ color: 0xffc53d })),
        )
        goalMesh.position.set(stage.goal.x, 0.03, stage.goal.z)
        boardGroup.add(goalMesh)

        const startMesh = new THREE.Mesh(
          track(new THREE.CylinderGeometry(markerRadius, markerRadius, BALL_RADIUS * 0.07, 28)),
          trackMaterial(new THREE.MeshLambertMaterial({ color: 0xa9e34b })),
        )
        startMesh.position.set(stage.start.x, 0.02, stage.start.z)
        boardGroup.add(startMesh)

        let flagBall: THREE.Object3D
        try {
          const flagPanelBall = createFlagPanelBallResource(optionsRef.current.flag, {
            ballRadius: BALL_RADIUS,
            maxAnisotropy: getRendererMaxAnisotropy(renderer),
          })
          for (const geometry of flagPanelBall.geometries) track(geometry)
          for (const material of flagPanelBall.materials) trackMaterial(material)
          trackTexture(flagPanelBall.texture)
          flagBall = flagPanelBall.group
        } catch {
          // 国旗テクスチャの生成が失敗しても、盤面自体は遊べるようにする。
          const fallbackMaterial = trackMaterial(
            new THREE.MeshLambertMaterial({ color: 0xff6b6b }),
          )
          const fallbackGroup = new THREE.Group()
          fallbackGroup.name = 'flag-panel-ball-fallback'
          fallbackGroup.add(
            new THREE.Mesh(
              track(new THREE.SphereGeometry(BALL_RADIUS, 28, 20)),
              fallbackMaterial,
            ),
          )
          flagBall = fallbackGroup
        }
        ballMesh = flagBall
        boardGroup.add(ballMesh)

        const mazeWorld = createMazeWorld(RAPIER, stage)
        world = mazeWorld.world
        ballBody = mazeWorld.ball

        cameraZoomScale = mazeZoomScale(zoomIndexRef.current)
        snapCameraFocusToBall()
        resizeRenderer()
        writeVisuals()
        applyVisualTilt(currentTilt)
        rafId = requestAnimationFrame(tick)

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(resizeRenderer)
          resizeObserver.observe(container)
        }
        attachViewportListeners()
        return true
      } catch {
        release()
        return false
      }
    }

    resetActionRef.current = () => {
      if (activeRunRef.current !== runToken) return
      if (ballBody === null) return
      resetBall(ballBody, stage.start)
      stallTracker = createStallTracker()
      snapCameraFocusToBall()
      writeVisuals()
      applyVisualTilt(currentTilt)
    }

    void initializeRapier()
      .then(() => {
        if (activeRunRef.current !== runToken || released) return
        createScene()
      })
      .catch(() => {
        if (activeRunRef.current === runToken) release()
      })

    return release
  }, [options.runId, options.flag.id])

  return handle
}
