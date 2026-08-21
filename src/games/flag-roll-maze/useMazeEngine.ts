import { useEffect, useMemo, useRef } from 'react'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import {
  BALL_RADIUS,
  FLOOR_THICKNESS,
  GOAL_RADIUS,
  MAX_FRAME_DELTA_MS,
  MAX_PHYSICS_SUBSTEPS,
  PHYSICS_TIMESTEP,
  visualTiltRotation,
  WALL_HEIGHT,
} from './mazePhysics'
import { createMazeStage, mazeStageBounds, type MazeStage } from './mazeStage'
import { computeMazeCameraSetup } from './mazeCamera'
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
import type { World } from '@dimforge/rapier3d-compat'

let rapierInitPromise: Promise<void> | null = null

/** Rapierのwasm初期化はモジュール内で一度だけ行い、再入場時に共有する。 */
function initializeRapier(): Promise<void> {
  if (rapierInitPromise === null) rapierInitPromise = RAPIER.init()
  return rapierInitPromise
}

export type MazeEngineOptions = {
  /** 値が変わったら物理世界を作り直す（もういちど / たすけて）。 */
  runId: number
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
    let ballMesh: THREE.Mesh | null = null
    let ballBody: ReturnType<typeof createMazeWorld>['ball'] | null = null
    let resizeObserver: ResizeObserver | null = null
    let hasWindowResizeListener = false
    let rafId: number | null = null
    let released = false
    let goalNotified = false
    let lastFrameTime: number | null = null
    let accumulator = 0
    let currentTilt: TiltInput = { ...NEUTRAL_TILT }
    let stallTracker: StallTracker = createStallTracker()

    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []

    const track = <T extends THREE.BufferGeometry>(geometry: T): T => {
      geometries.push(geometry)
      return geometry
    }
    const trackMaterial = <T extends THREE.Material>(material: T): T => {
      materials.push(material)
      return material
    }

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
      if (hasWindowResizeListener && typeof window !== 'undefined') {
        window.removeEventListener('resize', resizeRenderer)
        hasWindowResizeListener = false
      }

      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      geometries.length = 0
      materials.length = 0

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
      const setup = computeMazeCameraSetup(bounds, aspect)
      camera.aspect = aspect
      camera.position.set(setup.position.x, setup.position.y, setup.position.z)
      camera.lookAt(setup.target.x, setup.target.y, setup.target.z)
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    // 毎フレーム作り直さず使い回す。60fpsでのGC発生を避ける。
    const tiltAxis = new THREE.Vector3()

    /** 盤面と球をまとめて少しだけ傾け、どちらへ転がしているかを目で分かるようにする。 */
    function applyVisualTilt(tilt: TiltInput) {
      if (!boardGroup) return
      const { axis, angle } = visualTiltRotation(tilt)
      tiltAxis.set(axis.x, axis.y, axis.z).normalize()
      boardGroup.quaternion.setFromAxisAngle(tiltAxis, angle)
    }

    function writeVisuals() {
      if (!ballMesh || !ballBody) return
      const translation = ballBody.translation()
      const rotation = ballBody.rotation()
      ballMesh.position.set(translation.x, translation.y, translation.z)
      ballMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
    }

    function rescueToStart() {
      if (!ballBody) return
      resetBall(ballBody, stage.start)
      stallTracker = createStallTracker()
      writeVisuals()
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
      applyVisualTilt(currentTilt)

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
        const goalMesh = new THREE.Mesh(
          track(new THREE.CylinderGeometry(GOAL_RADIUS + 0.16, GOAL_RADIUS + 0.16, 0.06, 28)),
          trackMaterial(new THREE.MeshLambertMaterial({ color: 0xffc53d })),
        )
        goalMesh.position.set(stage.goal.x, 0.03, stage.goal.z)
        boardGroup.add(goalMesh)

        const startMesh = new THREE.Mesh(
          track(new THREE.CylinderGeometry(GOAL_RADIUS + 0.16, GOAL_RADIUS + 0.16, 0.04, 28)),
          trackMaterial(new THREE.MeshLambertMaterial({ color: 0xa9e34b })),
        )
        startMesh.position.set(stage.start.x, 0.02, stage.start.z)
        boardGroup.add(startMesh)

        ballMesh = new THREE.Mesh(
          track(new THREE.SphereGeometry(BALL_RADIUS, 28, 20)),
          trackMaterial(new THREE.MeshLambertMaterial({ color: 0xff6b6b })),
        )
        boardGroup.add(ballMesh)

        const mazeWorld = createMazeWorld(RAPIER, stage)
        world = mazeWorld.world
        ballBody = mazeWorld.ball

        resizeRenderer()
        writeVisuals()
        rafId = requestAnimationFrame(tick)

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(resizeRenderer)
          resizeObserver.observe(container)
        } else {
          window.addEventListener('resize', resizeRenderer)
          hasWindowResizeListener = true
        }
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
      writeVisuals()
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
  }, [options.runId])

  return handle
}
