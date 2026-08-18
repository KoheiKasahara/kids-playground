import { useEffect, useMemo, useRef } from 'react'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { playDominoCompleteSound, playDominoTickSound } from '../../utils/quizSound'
import { FLAG_COLOR_HEX, type DominoFlagId } from './flagDefinitions'
import {
  DOMINO_DEPTH,
  DOMINO_HEIGHT,
  getLayoutBounds,
  LINE_COUNT,
} from './dominoLayout'
import { createDominoCourse, type DominoCourseType } from './dominoCourse'
import { cameraDistanceOf, computeCameraSetup } from './dominoCamera'
import {
  advanceRailProgress,
  approachCameraDistanceFor,
  buildLongCameraRail,
  CAMERA_LAMBDA,
  CAMERA_PROGRESS_TILT_RAD,
  cameraPositionFor,
  dampFactor,
  PROGRESS_LAMBDA,
  sampleCameraRail,
  wideCameraPoseFor,
  type CameraRailAnchor,
  type RailVec3,
} from './dominoCameraRail'
import {
  INSPECTION_INTERVAL_MS,
  MAX_FRAME_DELTA_MS,
  MAX_PHYSICS_SUBSTEPS,
  PHYSICS_TIMESTEP,
} from './dominoPhysics'
import {
  applyShepherdImpulse,
  applyStartImpulse,
  createDominoWorld,
  tiltOf,
  type DominoBodyEntry,
} from './dominoWorld'
import {
  BALL_RADIUS,
  BALL_RAIL_THICKNESS,
  BALL_RAIL_WALL_HEIGHT,
  BALL_RAIL_WALL_THICKNESS,
  BALL_RAIL_WIDTH,
  ballRailProgress,
  getBallRailPieces,
  getBallStairSteps,
} from './dominoBall'
import { getStairPlatforms } from './dominoStairs'
import {
  createShepherdMemory,
  planShepherdNudges,
  type ShepherdMemory,
} from './dominoShepherd'
import {
  evaluateCompletion,
  isFallen,
  type DominoRuntimeState,
} from './dominoCompletion'
import { FALL_SCAN_INTERVAL_MS, createDominoSoundController } from './dominoSound'
import type { World } from '@dimforge/rapier3d-compat'

let rapierInitPromise: Promise<void> | null = null

// 144×144の地面全体をロングの俯瞰から描画するための値。通常モードは100のままにする。
const LONG_CAMERA_FAR = 150

/** Rapierのwasm初期化をモジュール内で一度だけ実行し、再入場時に共有する。 */
function initializeRapier(): Promise<void> {
  if (rapierInitPromise === null) rapierInitPromise = RAPIER.init()
  return rapierInitPromise
}

export type DominoEngineOptions = {
  /** 値が変わったら世界を作り直す（もういちど用）。 */
  runId: number
  /** nullの間は国旗選択中として、Three.jsとRapierを作らない。 */
  flagId: DominoFlagId | null
  /** normal/longを切り替えたら物理世界も作り直す。 */
  courseType: DominoCourseType
  /** 完成判定が立ったときに一度だけ呼ぶ。 */
  onComplete: () => void
  /** このrunのドミノ効果音を鳴らすか。useEffectの再生成条件には含めない。 */
  soundEnabled: boolean
}

export type DominoEngineHandle = {
  /** 3Dシーンを描画するDOM要素を登録するrefコールバック。 */
  registerContainer: (el: HTMLDivElement | null) => void
  /** 「スタート！」から呼ぶ。最初のドミノへ力を加える。 */
  start: () => void
}

type RenderDominoBodyEntry = DominoBodyEntry & {
  flagInstanceIndex: number | null
}

/**
 * Three.jsとRapierをuseEffectの中だけで動かす命令的エンジン。
 * 毎フレームの姿勢はReact stateを経由せず、InstancedMeshへ直接書き込む。
 */
export function useDominoEngine(options: DominoEngineOptions): DominoEngineHandle {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const startActionRef = useRef<() => void>(() => undefined)
  const activeRunRef = useRef<symbol | null>(null)

  const handle = useMemo<DominoEngineHandle>(
    () => ({
      registerContainer: (el) => {
        containerRef.current = el
      },
      start: () => {
        startActionRef.current()
      },
    }),
    [],
  )

  useEffect(() => {
    const runToken = Symbol('domino-flag-run')
    activeRunRef.current = runToken

    const flagId = options.flagId
    if (flagId === null) {
      activeRunRef.current = null
      startActionRef.current = () => undefined
      return
    }

    const course = createDominoCourse(options.courseType, flagId)
    const placements = course.placements
    const layoutBounds = course.flagCameraBounds
    const flagPlacements = placements.filter((placement) => placement.kind === 'flag')
    const bodies: RenderDominoBodyEntry[] = []
    const bodiesById = new Map<string, DominoBodyEntry>()

    let world: World | null = null
    let scene: THREE.Scene | null = null
    let camera: THREE.PerspectiveCamera | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let dominoMesh: THREE.InstancedMesh | null = null
    let flagMesh: THREE.InstancedMesh | null = null
    let groundGeometry: THREE.PlaneGeometry | null = null
    let dominoGeometry: THREE.BoxGeometry | null = null
    let flagGeometry: THREE.PlaneGeometry | null = null
    let groundMaterial: THREE.MeshLambertMaterial | null = null
    let dominoMaterial: THREE.MeshLambertMaterial | null = null
    let flagMaterial: THREE.MeshBasicMaterial | null = null
    let ballGeometry: THREE.SphereGeometry | null = null
    let ballMaterial: THREE.MeshLambertMaterial | null = null
    let ballMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshLambertMaterial> | null = null
    let railFloorMaterial: THREE.MeshLambertMaterial | null = null
    let railWallMaterial: THREE.MeshLambertMaterial | null = null
    let stairPlatformMaterial: THREE.MeshLambertMaterial | null = null
    const railGeometries: THREE.BoxGeometry[] = []
    const railMeshes: THREE.Mesh[] = []
    let resizeObserver: ResizeObserver | null = null
    let hasWindowResizeListener = false
    let rafId: number | null = null
    let released = false
    let startRequested = false
    let started = false
    let startedAt: number | null = null
    let completeNotified = false
    let lastFrameTime: number | null = null
    let accumulator = 0
    let lastInspectionAt = Number.NEGATIVE_INFINITY
    let lastFallScanAt = Number.NEGATIVE_INFINITY
    const isLongCourse = course.approachCount > 0
    const reducedMotion =
      isLongCourse &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    let cameraRail: CameraRailAnchor[] = []
    let cameraFrontier = 0
    let smoothedProgress = 0
    let smoothedTarget: RailVec3 | null = null
    let smoothedDistance = 0
    let shepherdMemory: ShepherdMemory = createShepherdMemory()
    let dominoBall: ReturnType<typeof createDominoWorld>['ball'] = null
    const soundController = createDominoSoundController({
      dominoCount: placements.length,
      playTick: playDominoTickSound,
      playComplete: playDominoCompleteSound,
      soundEnabled: () => optionsRef.current.soundEnabled,
      now: () => performance.now(),
      setTimeoutFn: (handler, timeoutMs) => globalThis.setTimeout(handler, timeoutMs),
      clearTimeoutFn: (timerId) => globalThis.clearTimeout(timerId),
    })

    const bodyMatrix = new THREE.Matrix4()
    const flagMatrix = new THREE.Matrix4()
    const flagLocalMatrix = new THREE.Matrix4()
    const bodyPosition = new THREE.Vector3()
    const bodyScale = new THREE.Vector3()
    const bodyQuaternion = new THREE.Quaternion()
    const flagLocalQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI,
    )
    flagLocalMatrix.compose(
      new THREE.Vector3(0, 0, -0.5 - 0.004 / DOMINO_DEPTH),
      flagLocalQuaternion,
      new THREE.Vector3(0.86, 0.82, 1),
    )

    function release() {
      if (released) return
      released = true

      if (activeRunRef.current === runToken) activeRunRef.current = null
      startActionRef.current = () => undefined
      soundController.dispose()

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

      dominoMesh?.dispose()
      flagMesh?.dispose()
      groundGeometry?.dispose()
      dominoGeometry?.dispose()
      flagGeometry?.dispose()
      groundMaterial?.dispose()
      dominoMaterial?.dispose()
      flagMaterial?.dispose()
      ballGeometry?.dispose()
      ballMaterial?.dispose()
      railFloorMaterial?.dispose()
      railWallMaterial?.dispose()
      stairPlatformMaterial?.dispose()
      for (const geometry of railGeometries) geometry.dispose()

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

      groundGeometry = null
      dominoGeometry = null
      flagGeometry = null
      groundMaterial = null
      dominoMaterial = null
      flagMaterial = null
      ballGeometry = null
      ballMaterial = null
      ballMesh = null
      railFloorMaterial = null
      railWallMaterial = null
      stairPlatformMaterial = null
      railGeometries.length = 0
      railMeshes.length = 0
      dominoBall = null
      scene?.clear()
      scene = null
      camera = null
      dominoMesh = null
      flagMesh = null

      if (world !== null) {
        world.free()
        world = null
      }
    }

    function resizeRenderer() {
      const container = containerRef.current
      if (!container || !renderer || !camera) return
      const rect = container.getBoundingClientRect()
      const width = Math.max(1, Math.floor(rect.width || container.clientWidth || window.innerWidth))
      const height = Math.max(
        1,
        Math.floor(rect.height || container.clientHeight || window.innerHeight),
      )
      const aspect = width / height
      const setup = computeCameraSetup(layoutBounds, aspect)
      camera.aspect = aspect
      if (course.approachCount === 0) {
        camera.position.set(setup.position.x, setup.position.y, setup.position.z)
        camera.lookAt(setup.target.x, setup.target.y, setup.target.z)
      } else {
        cameraRail = buildLongCameraRail(
          course.cameraApproachPath,
          {
            target: setup.target,
            distance: cameraDistanceOf(setup),
          },
          {
            reducedMotion,
            approachDistance: approachCameraDistanceFor(aspect),
            cameraProgressCount: course.cameraProgressCount,
            wideCamera: wideCameraPoseFor(getLayoutBounds(placements), aspect),
          },
        )
        if (smoothedTarget === null) {
          const initialPose = sampleCameraRail(cameraRail, smoothedProgress)
          smoothedTarget = { ...initialPose.target }
          smoothedDistance = initialPose.distance
        }
        const position = cameraPositionFor(smoothedTarget, smoothedDistance)
        camera.position.set(position.x, position.y, position.z)
        camera.lookAt(smoothedTarget.x, smoothedTarget.y, smoothedTarget.z)
      }
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    function updateLongCamera(deltaSeconds: number) {
      if (!isLongCourse || !camera || cameraRail.length === 0 || smoothedTarget === null) return

      while (
        cameraFrontier < course.approachCount + LINE_COUNT &&
        tiltOf(bodies[cameraFrontier]!.body) >= CAMERA_PROGRESS_TILT_RAD
      ) {
        cameraFrontier += 1
      }
      let cameraProgressIndex = cameraFrontier
      if (course.ballSection !== null && dominoBall !== null) {
        const trigger = bodiesById.get(course.ballSection.triggerDominoId)
        const receiver = bodiesById.get(course.ballSection.receiverDominoId)
        const triggerHasFallen = trigger !== undefined && tiltOf(trigger.body) >= CAMERA_PROGRESS_TILT_RAD
        const receiverHasFallen = receiver !== undefined && tiltOf(receiver.body) >= CAMERA_PROGRESS_TILT_RAD
        const virtualCount = course.ballSection.replacedApproachIndexes.length
        const ballStartProgress = course.ballSection.replacedApproachIndexes[0] ?? 0
        if (triggerHasFallen && !receiverHasFallen) {
          const position = dominoBall.body.translation()
          // カメラ位置は常に演出用レールから算出する。球の進行度はレール内の補間にだけ使う。
          cameraProgressIndex =
            ballStartProgress + ballRailProgress(course.ballSection, position) * virtualCount
        } else if (receiverHasFallen) {
          // 物理ドミノには存在しないボール区間ぶんを、出口後の進行度へ加算する。
          cameraProgressIndex += virtualCount
        }
      }
      const rawProgress = cameraProgressIndex / course.cameraProgressCount
      smoothedProgress = advanceRailProgress(
        smoothedProgress,
        rawProgress,
        deltaSeconds,
        PROGRESS_LAMBDA,
      )
      const pose = sampleCameraRail(cameraRail, smoothedProgress)
      const factor = dampFactor(CAMERA_LAMBDA, deltaSeconds)
      smoothedTarget = {
        x: smoothedTarget.x + (pose.target.x - smoothedTarget.x) * factor,
        y: smoothedTarget.y + (pose.target.y - smoothedTarget.y) * factor,
        z: smoothedTarget.z + (pose.target.z - smoothedTarget.z) * factor,
      }
      smoothedDistance += (pose.distance - smoothedDistance) * factor
      const position = cameraPositionFor(smoothedTarget, smoothedDistance)
      camera.position.set(position.x, position.y, position.z)
      camera.lookAt(smoothedTarget.x, smoothedTarget.y, smoothedTarget.z)
    }

    function writeVisuals() {
      if (!dominoMesh || !flagMesh) return
      for (const [index, entry] of bodies.entries()) {
        const translation = entry.body.translation()
        const rotation = entry.body.rotation()
        bodyPosition.set(translation.x, translation.y, translation.z)
        bodyQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
        bodyScale.set(entry.placement.width, DOMINO_HEIGHT, DOMINO_DEPTH)
        bodyMatrix.compose(
          bodyPosition,
          bodyQuaternion,
          bodyScale,
        )
        dominoMesh.setMatrixAt(index, bodyMatrix)
        if (entry.flagInstanceIndex !== null) {
          flagMatrix.copy(bodyMatrix).multiply(flagLocalMatrix)
          flagMesh.setMatrixAt(entry.flagInstanceIndex, flagMatrix)
        }
      }
      dominoMesh.instanceMatrix.needsUpdate = true
      flagMesh.instanceMatrix.needsUpdate = true
      if (dominoBall !== null && ballMesh !== null) {
        const translation = dominoBall.body.translation()
        const rotation = dominoBall.body.rotation()
        ballMesh.position.set(translation.x, translation.y, translation.z)
        ballMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      }
    }

    function beginStart() {
      if (started || !world || bodies.length === 0) return
      started = true
      startedAt = performance.now()
      const first = bodiesById.get(course.startId)
      if (!first) return
      applyStartImpulse(first.body, first.placement.chainYaw)
    }

    function requestStart() {
      if (activeRunRef.current !== runToken) return
      startRequested = true
      beginStart()
    }

    function inspectPhysics(now: number) {
      if (!started || startedAt === null) return
      const states: DominoRuntimeState[] = bodies.map((entry) => ({
        tilt: tiltOf(entry.body),
        sleeping: entry.body.isSleeping(),
      }))
      const completion = evaluateCompletion(
        states,
        now - startedAt,
        course.hardTimeoutMs,
      )

      if (completion.complete && !completeNotified) {
        completeNotified = true
        soundController.notifyComplete(now)
        optionsRef.current.onComplete()
        return
      }
      if (completeNotified) return

      const receiverDominoId = course.ballSection?.receiverDominoId ?? null
      const shepherd = planShepherdNudges(
        bodies.map((entry, index) => ({
          id: entry.placement.id,
          chainIndex: entry.chainIndex,
          fallen: isFallen(states[index]!),
          sleeping: states[index]!.sleeping,
          // 後段の先頭ドミノは球の到達でのみ倒れるべきで、停滞救出の対象にはしない。
          nudgeDisabled: entry.placement.id === receiverDominoId,
        })),
        shepherdMemory,
        now,
      )
      shepherdMemory = shepherd.memory
      for (const nudge of shepherd.plan.nudges) {
        const entry = bodiesById.get(nudge.id)
        if (entry) {
          applyShepherdImpulse(entry.body, nudge.strength, entry.placement.chainYaw)
        }
      }
    }

    function tick(now: number) {
      if (activeRunRef.current !== runToken || released) return
      rafId = requestAnimationFrame(tick)
      let deltaSeconds = 0

      if (lastFrameTime === null) {
        lastFrameTime = now
      } else {
        const deltaMs = Math.min(Math.max(0, now - lastFrameTime), MAX_FRAME_DELTA_MS)
        lastFrameTime = now
        deltaSeconds = deltaMs / 1000
        if (started && world !== null) {
          accumulator += deltaMs / 1000
          let substeps = 0
          while (accumulator >= PHYSICS_TIMESTEP && substeps < MAX_PHYSICS_SUBSTEPS) {
            world.step()
            accumulator -= PHYSICS_TIMESTEP
            substeps += 1
          }
          if (substeps >= MAX_PHYSICS_SUBSTEPS && accumulator >= PHYSICS_TIMESTEP) {
            accumulator = 0
          }
        }
      }

      writeVisuals()
      if (course.approachCount > 0) updateLongCamera(deltaSeconds)
      if (started && now - lastInspectionAt >= INSPECTION_INTERVAL_MS) {
        lastInspectionAt = now
        inspectPhysics(now)
      }
      if (
        started &&
        !completeNotified &&
        optionsRef.current.soundEnabled &&
        now - lastFallScanAt >= FALL_SCAN_INTERVAL_MS
      ) {
        lastFallScanAt = now
        soundController.scan(
          (index) => tiltOf(bodies[index]!.body),
          now,
        )
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
        scene.background = new THREE.Color('#e7f5ff')
        camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
        if (course.approachCount > 0) camera.far = LONG_CAMERA_FAR

        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x8bbf91, 1.8)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1)
        directionalLight.position.set(-4, 8, 6)
        scene.add(hemisphereLight, directionalLight)

        groundGeometry = new THREE.PlaneGeometry(course.groundSize, course.groundSize)
        groundMaterial = new THREE.MeshLambertMaterial({ color: 0x9bd38f })
        const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial)
        groundMesh.rotation.x = -Math.PI / 2
        scene.add(groundMesh)

        dominoGeometry = new THREE.BoxGeometry(1, 1, 1)
        dominoMaterial = new THREE.MeshLambertMaterial({
          color: 0xfff1cf,
        })
        dominoMesh = new THREE.InstancedMesh(dominoGeometry, dominoMaterial, placements.length)
        dominoMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        dominoMesh.frustumCulled = false

        flagGeometry = new THREE.PlaneGeometry(1, 1)
        // 立っている間は- Z面がカメラから背を向けるため、表面を表示しない。
        flagMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          side: THREE.FrontSide,
        })
        flagMesh = new THREE.InstancedMesh(flagGeometry, flagMaterial, flagPlacements.length)
        flagMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        flagMesh.frustumCulled = false

        let flagInstanceIndex = 0
        for (const [index, placement] of placements.entries()) {
          const color = 0xfff1cf
          dominoMesh.setColorAt(index, new THREE.Color(color))
          if (placement.kind === 'flag') {
            if (placement.color === undefined) {
              throw new Error('国旗ドミノの色が未定義です')
            }
            flagMesh.setColorAt(
              flagInstanceIndex,
              new THREE.Color(FLAG_COLOR_HEX[placement.color]),
            )
            flagInstanceIndex += 1
          }
        }
        if (dominoMesh.instanceColor) dominoMesh.instanceColor.needsUpdate = true
        if (flagMesh.instanceColor) flagMesh.instanceColor.needsUpdate = true
        scene.add(dominoMesh, flagMesh)

        if (course.ballSection !== null) {
          ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 24, 16)
          ballMaterial = new THREE.MeshLambertMaterial({ color: 0xff8a3d })
          ballMesh = new THREE.Mesh(ballGeometry, ballMaterial)
          scene.add(ballMesh)

          railFloorMaterial = new THREE.MeshLambertMaterial({ color: 0x5b7891 })
          railWallMaterial = new THREE.MeshLambertMaterial({ color: 0x7e9db5 })
          for (const piece of getBallRailPieces(course.ballSection)) {
            const floorGeometry = new THREE.BoxGeometry(
              BALL_RAIL_WIDTH,
              BALL_RAIL_THICKNESS,
              piece.length + 0.14,
            )
            railGeometries.push(floorGeometry)
            const floor = new THREE.Mesh(floorGeometry, railFloorMaterial)
            floor.position.set(
              piece.center.x,
              piece.center.y - BALL_RAIL_THICKNESS / 2,
              piece.center.z,
            )
            const halfYaw = piece.yaw / 2
            const halfPitch = piece.pitch / 2
            floor.quaternion.set(
              Math.cos(halfYaw) * Math.sin(halfPitch),
              Math.sin(halfYaw) * Math.cos(halfPitch),
              -Math.sin(halfYaw) * Math.sin(halfPitch),
              Math.cos(halfYaw) * Math.cos(halfPitch),
            )
            railMeshes.push(floor)
            scene.add(floor)

            const sideX = Math.cos(piece.yaw) * (BALL_RAIL_WIDTH / 2 - BALL_RAIL_WALL_THICKNESS / 2)
            const sideZ = -Math.sin(piece.yaw) * (BALL_RAIL_WIDTH / 2 - BALL_RAIL_WALL_THICKNESS / 2)
            for (const side of [-1, 1] as const) {
              const wallGeometry = new THREE.BoxGeometry(
                BALL_RAIL_WALL_THICKNESS,
                BALL_RAIL_WALL_HEIGHT,
                piece.length + 0.14,
              )
              railGeometries.push(wallGeometry)
              const wall = new THREE.Mesh(wallGeometry, railWallMaterial)
              wall.position.set(
                piece.center.x + side * sideX,
                piece.surfaceY + BALL_RAIL_WALL_HEIGHT / 2,
                piece.center.z + side * sideZ,
              )
              wall.rotation.y = piece.yaw
              railMeshes.push(wall)
              scene.add(wall)
            }
          }

          // スタート台が足場から浮いて見えないよう、トリガー側に表示専用の短い連結段を並べる。
          for (const step of getBallStairSteps(course.ballSection)) {
            const stepGeometry = new THREE.BoxGeometry(step.width, step.height, step.depth)
            railGeometries.push(stepGeometry)
            const stepMesh = new THREE.Mesh(stepGeometry, railFloorMaterial)
            stepMesh.position.set(step.center.x, step.center.y, step.center.z)
            stepMesh.rotation.y = step.yaw
            railMeshes.push(stepMesh)
            scene.add(stepMesh)
          }

          // トリガーへ向けて道中のドミノ自身が登る、実際に支える階段。
          stairPlatformMaterial = new THREE.MeshLambertMaterial({ color: 0xc9a06b })
          for (const platform of getStairPlatforms(placements)) {
            const platformGeometry = new THREE.BoxGeometry(
              platform.width,
              platform.height,
              platform.depth,
            )
            railGeometries.push(platformGeometry)
            const platformMesh = new THREE.Mesh(platformGeometry, stairPlatformMaterial)
            platformMesh.position.set(platform.center.x, platform.center.y, platform.center.z)
            platformMesh.rotation.y = platform.yaw
            railMeshes.push(platformMesh)
            scene.add(platformMesh)
          }
        }

        const dominoWorld = createDominoWorld(RAPIER, placements, {
          groundSize: course.groundSize,
          ballSection: course.ballSection,
        })
        world = dominoWorld.world
        dominoBall = dominoWorld.ball
        let flagBodyIndex = 0
        for (const entry of dominoWorld.bodies) {
          const renderEntry: RenderDominoBodyEntry = {
            ...entry,
            flagInstanceIndex: entry.placement.kind === 'flag' ? flagBodyIndex++ : null,
          }
          bodies.push(renderEntry)
          bodiesById.set(entry.placement.id, entry)
        }

        resizeRenderer()
        writeVisuals()
        rafId = requestAnimationFrame(tick)
        if (startRequested) beginStart()

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

    startActionRef.current = requestStart
    void initializeRapier()
      .then(() => {
        if (activeRunRef.current !== runToken || released) return
        createScene()
      })
      .catch(() => {
        if (activeRunRef.current === runToken) release()
      })

    return release
  }, [options.runId, options.flagId, options.courseType])

  return handle
}
