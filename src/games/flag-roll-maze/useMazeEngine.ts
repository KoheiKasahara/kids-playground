import { useEffect, useMemo, useRef } from 'react'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { createFlagPanelBallResource } from '../../components/flag-ball/flagPanelBall'
import type { FlagBallData } from '../../components/flag-ball/flagBalls'
import {
  BALL_RADIUS,
  BUMPER_HEIGHT,
  FLOOR_THICKNESS,
  GOAL_CUP_FLOOR_Y,
  GOAL_CUP_RADIUS,
  GOAL_CUP_RIM_RADIUS,
  GOAL_RADIUS,
  HOLE_PIT_BOTTOM_Y,
  MAX_FRAME_DELTA_MS,
  MAX_PHYSICS_SUBSTEPS,
  PHYSICS_TIMESTEP,
  STAR_HOVER_Y,
  STAR_VISUAL_RADIUS,
  visualTiltPivotOffset,
  visualTiltRotation,
  WALL_HEIGHT,
} from './mazePhysics'
import { CELL_SIZE } from './mazeGrid'
import { mazeStageBounds, type MazeStage } from './mazeStage'
import { createMazeStageById } from './mazeStages'
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
  applyBumperKicks,
  advanceSpinners,
  createMazeWorld,
  isGoalReached,
  limitBallSpeed,
  nudgeBall,
  pushBallOutOfSpinner,
  resetBall,
  settleBallInGoalCup,
} from './mazeWorld'
import {
  createImpactTracker,
  updateImpactTracker,
  type ImpactTracker,
} from './mazeImpact'
import {
  collectedStarCount,
  createStarTracker,
  isStarCollected,
  updateStarTracker,
  type StarTracker,
} from './mazeStars'
import {
  checkpointPosition,
  createCheckpointTracker,
  createSpinnerTrapTracker,
  createStallTracker,
  hasFallenBelowFloor,
  hasFallenOut,
  RESPAWN_GRACE_MS,
  RESPAWN_SETTLE_MS,
  updateSpinnerTrapTracker,
  updateCheckpointTracker,
  updateStallTracker,
  type CheckpointTracker,
  type SpinnerTrapTracker,
  type StallTracker,
} from './mazeRescue'
import type { BumperCooldowns } from './mazeGimmicks'
import { NEUTRAL_TILT, smoothTilt, type TiltInput } from './tiltInput'
import { createResizeScheduler } from './sceneResize'
import {
  playMazeGoalSound,
  playMazeStarSound,
  playMazeWallHitSound,
  playPinballBumperSound,
} from '../../utils/quizSound'
import type { RigidBody, World } from '@dimforge/rapier3d-compat'

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
  /** 遊ぶステージ。変わったら物理世界とThree.jsシーンを作り直す。 */
  stageId: string
  /** ゴールに到達したとき一度だけ呼ぶ。 */
  onGoal: () => void
  /** 場外やスタックから自動復帰したとき呼ぶ。表示用で、ゲーム進行は止めない。 */
  onRescue?: (reason?: 'hole' | 'outOfBounds' | 'stuck') => void
  /**
   * ⭐を取ったとき、そのrunでの累計取得数を渡す。
   * 1ステージ3個までしか呼ばれないので、React state更新の頻度は問題にならない。
   */
  onStarCollected?: (collectedCount: number, totalCount: number) => void
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

    const stage: MazeStage = createMazeStageById(options.stageId)
    const bounds = mazeStageBounds(stage)

    let world: World | null = null
    let scene: THREE.Scene | null = null
    let camera: THREE.PerspectiveCamera | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let boardGroup: THREE.Group | null = null
    let ballMesh: THREE.Object3D | null = null
    let ballBody: ReturnType<typeof createMazeWorld>['ball'] | null = null
    let spinners: ReturnType<typeof createMazeWorld>['spinners'] = []
    let resizeObserver: ResizeObserver | null = null
    let detachViewportListeners: (() => void) | null = null
    let rafId: number | null = null
    let released = false
    let goalNotified = false
    let lastFrameTime: number | null = null
    let accumulator = 0
    // 回転棒はフレーム時刻ではなく物理ステップ数から進め、処理落ちでも回転が飛ばないようにする。
    let physicsElapsedSeconds = 0
    let currentTilt: TiltInput = { ...NEUTRAL_TILT }
    let stallTracker: StallTracker = createStallTracker()
    let checkpointTracker: CheckpointTracker = createCheckpointTracker()
    let spinnerTrapTracker: SpinnerTrapTracker = createSpinnerTrapTracker()
    let respawnGraceRemainingMs = 0
    let respawnSettleRemainingMs = 0
    // クールダウンをrun内に閉じ込め、もういちどで前の衝突履歴を持ち越さない。
    const bumperCooldowns: BumperCooldowns = new Map()
    let impactTracker: ImpactTracker = createImpactTracker()
    let starTracker: StarTracker = createStarTracker()
    let cameraFocus: MazeCameraFocus = { x: 0, z: 0 }
    // 標準距離は画面比だけで決まる。ズームはそこへ掛ける倍率として持つ。
    let cameraBaseDistance = computeMazeCameraDistance(1)
    let cameraZoomScale = mazeZoomScale(zoomIndexRef.current)

    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []
    const textures: THREE.Texture[] = []
    const spinnerVisuals: { body: RigidBody; mesh: THREE.Mesh }[] = []
    const bumperVisuals = new Map<string, THREE.Group>()
    const bumperPopStartedAtMs = new Map<string, number>()
    const starVisuals: { id: string; mesh: THREE.Mesh }[] = []
    const starPopStartedAtMs = new Map<string, number>()
    let prefersReducedMotion = false

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
      spinners = []
      spinnerVisuals.length = 0
      bumperVisuals.clear()
      bumperPopStartedAtMs.clear()
      starVisuals.length = 0
      starPopStartedAtMs.clear()
      bumperCooldowns.clear()
      impactTracker = createImpactTracker()
      starTracker = createStarTracker()

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

    function updateBumperPops(nowMs: number) {
      for (const [id, startedAtMs] of bumperPopStartedAtMs) {
        const group = bumperVisuals.get(id)
        if (!group) {
          bumperPopStartedAtMs.delete(id)
          continue
        }
        const progress = Math.min(1, Math.max(0, (nowMs - startedAtMs) / 220))
        if (progress >= 1) {
          group.scale.setScalar(1)
          bumperPopStartedAtMs.delete(id)
          continue
        }
        group.scale.setScalar(1 + 0.25 * Math.sin(Math.PI * progress))
      }
    }

    function updateStarVisuals(nowMs?: number) {
      for (let index = 0; index < starVisuals.length; index += 1) {
        const visual = starVisuals[index]
        if (visual === undefined) continue
        if (isStarCollected(starTracker, visual.id) || starPopStartedAtMs.has(visual.id)) {
          continue
        }

        // 復帰直後など時刻を持たない描画では、回している途中の角度をそのまま残す。
        // ここで0へ戻すと、場外復帰のたびに星の向きが跳ねて見えてしまう。
        if (nowMs === undefined) continue
        if (prefersReducedMotion) {
          visual.mesh.rotation.set(0, 0, 0)
          visual.mesh.position.y = STAR_HOVER_Y
          continue
        }

        const phase = index * 1.7
        visual.mesh.rotation.y = nowMs * 0.001 + phase
        visual.mesh.rotation.x = Math.sin(nowMs * 0.0007 + phase) * 0.12
        visual.mesh.position.y = STAR_HOVER_Y + Math.sin(nowMs * 0.003 + phase) * 0.08
      }
    }

    function updateStarPops(nowMs: number) {
      for (const [id, startedAtMs] of starPopStartedAtMs) {
        let mesh: THREE.Mesh | undefined
        for (const visual of starVisuals) {
          if (visual.id === id) {
            mesh = visual.mesh
            break
          }
        }
        if (mesh === undefined) {
          starPopStartedAtMs.delete(id)
          continue
        }

        const progress = Math.min(1, Math.max(0, (nowMs - startedAtMs) / 260))
        if (progress >= 1 || prefersReducedMotion) {
          mesh.scale.setScalar(0)
          mesh.visible = false
          starPopStartedAtMs.delete(id)
          continue
        }

        mesh.visible = true
        const scale = progress < 0.5
          ? 1 + 0.8 * (progress * 2)
          : 1.8 * ((1 - progress) * 2)
        mesh.scale.setScalar(scale)
      }
    }

    function writeVisuals(nowMs?: number) {
      if (ballMesh && ballBody) {
        const translation = ballBody.translation()
        const rotation = ballBody.rotation()
        ballMesh.position.set(translation.x, translation.y, translation.z)
        ballMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      }

      // 回転棒はRapierのkinematic bodyを正本にし、見た目だけが遅れないよう毎フレーム同期する。
      for (const { body, mesh } of spinnerVisuals) {
        const translation = body.translation()
        const rotation = body.rotation()
        mesh.position.set(translation.x, translation.y, translation.z)
        mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      }
      updateStarVisuals(nowMs)
      if (nowMs !== undefined) {
        updateBumperPops(nowMs)
        updateStarPops(nowMs)
      }
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

    function rescueToCheckpoint(reason: 'hole' | 'outOfBounds' | 'stuck') {
      if (!ballBody) return
      const point = checkpointPosition(
        checkpointTracker,
        stage.checkpoints,
        stage.start,
      )
      resetBall(ballBody, point)
      // チェックポイント復帰で星まで消すと、落ちるたびに集め直しになって幼児がつらいため、星の状態は残す。
      stallTracker = createStallTracker()
      spinnerTrapTracker = createSpinnerTrapTracker()
      respawnGraceRemainingMs = RESPAWN_GRACE_MS
      respawnSettleRemainingMs = RESPAWN_SETTLE_MS
      writeVisuals()
      snapCameraFocusToBall()
      optionsRef.current.onRescue?.(reason)
    }

    function startBumperPops(kickedIds: readonly string[], nowMs: number) {
      if (prefersReducedMotion) return
      for (const id of kickedIds) {
        if (bumperVisuals.has(id)) bumperPopStartedAtMs.set(id, nowMs)
      }
    }

    function startStarPops(collectedIds: readonly string[], nowMs: number) {
      for (const id of collectedIds) {
        const visual = starVisuals.find(({ id: visualId }) => visualId === id)
        if (visual === undefined) continue

        if (prefersReducedMotion) {
          visual.mesh.scale.setScalar(0)
          visual.mesh.visible = false
        } else {
          visual.mesh.scale.setScalar(1)
          visual.mesh.visible = true
          starPopStartedAtMs.set(id, nowMs)
        }
      }
    }

    function stepPhysics(deltaMs: number, nowMs: number) {
      if (world === null || ballBody === null) return
      // linvel()は呼ぶたびに値を作るため、衝突判定用の速さは1回の取得から求める。
      const velocityBefore = ballBody.linvel()
      const speedBefore = Math.hypot(velocityBefore.x, velocityBefore.z)
      accumulator += deltaMs / 1000
      let substeps = 0
      while (accumulator >= PHYSICS_TIMESTEP && substeps < MAX_PHYSICS_SUBSTEPS) {
        physicsElapsedSeconds += PHYSICS_TIMESTEP
        advanceSpinners(spinners, physicsElapsedSeconds)
        world.step()
        accumulator -= PHYSICS_TIMESTEP
        substeps += 1
      }
      const velocityAfter = ballBody.linvel()
      const speedAfter = Math.hypot(velocityAfter.x, velocityAfter.z)
      const impact = updateImpactTracker(impactTracker, {
        speedBefore,
        speedAfter,
        nowMs,
      })
      impactTracker = impact.tracker
      // 追いつけないほど遅れたら、溜まった時間を捨てて次のフレームから作り直す。
      if (substeps >= MAX_PHYSICS_SUBSTEPS && accumulator >= PHYSICS_TIMESTEP) {
        accumulator = 0
      }
      limitBallSpeed(ballBody)
      const kickedIds = applyBumperKicks(
        ballBody,
        stage.gimmicks.bumpers,
        bumperCooldowns,
        nowMs,
      )
      limitBallSpeed(ballBody)
      if (kickedIds.length > 0) {
        playPinballBumperSound()
        startBumperPops(kickedIds, nowMs)
      } else if (
        impact.intensity !== null &&
        !goalNotified &&
        respawnGraceRemainingMs <= 0 &&
        respawnSettleRemainingMs <= 0 &&
        deltaMs > 0
      ) {
        // ゴール後は静かにし、復帰直後は無敵・静止時間中の接触音を出さない。
        // deltaMsが0のフレームも、同じ時刻の衝突を重ねて鳴らさない。
        // バンパーがキックしたフレームは専用音を優先し、壁衝突音を重ねない。
        playMazeWallHitSound(impact.intensity)
      }
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
      respawnGraceRemainingMs = Math.max(0, respawnGraceRemainingMs - deltaMs)
      // ゴール後は入力を無視し、その場でゆっくり止まるようにする。
      const target = goalNotified ? NEUTRAL_TILT : targetTiltRef.current
      currentTilt = smoothTilt(currentTilt, target, deltaSeconds)
      if (world !== null) applyTiltToGravity(world, currentTilt)

      const settlingAfterRespawn = respawnSettleRemainingMs > 0
      if (deltaMs > 0) stepPhysics(deltaMs, now)
      if (settlingAfterRespawn && ballBody !== null) {
        // 重力と入力はそのままにし、復帰直後だけボールの動きを毎フレーム打ち消す。
        ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
        ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
      }
      respawnSettleRemainingMs = Math.max(0, respawnSettleRemainingMs - deltaMs)
      writeVisuals(now)

      if (ballBody !== null) {
        const position = ballBody.translation()
        let rescueReason: 'hole' | 'outOfBounds' | null = null
        if (respawnGraceRemainingMs <= 0) {
          if (hasFallenBelowFloor(position)) {
            rescueReason = 'hole'
          } else if (hasFallenOut(position, bounds)) {
            rescueReason = 'outOfBounds'
          }
        }

        if (rescueReason !== null) {
          rescueToCheckpoint(rescueReason)
        } else if (!goalNotified) {
          checkpointTracker = updateCheckpointTracker(
            checkpointTracker,
            position,
            stage.checkpoints,
          )

          if (
            !settlingAfterRespawn &&
            respawnSettleRemainingMs <= 0 &&
            respawnGraceRemainingMs <= 0
          ) {
            const spinnerTrap = updateSpinnerTrapTracker(
              spinnerTrapTracker,
              position,
              stage.gimmicks.spinners,
              deltaMs,
            )
            spinnerTrapTracker = spinnerTrap.tracker
            if (spinnerTrap.escapeFrom !== null) {
              pushBallOutOfSpinner(ballBody, spinnerTrap.escapeFrom)
              limitBallSpeed(ballBody)
            }

            if (spinnerTrap.rescue) {
              rescueToCheckpoint('stuck')
            } else {
              const velocity = ballBody.linvel()
              const stall = updateStallTracker(stallTracker, {
                speed: Math.hypot(velocity.x, velocity.y, velocity.z),
                tiltMagnitude: Math.hypot(currentTilt.x, currentTilt.y),
                deltaMs,
              })
              stallTracker = stall.tracker
              if (stall.rescue) {
                rescueToCheckpoint('stuck')
              } else {
                if (stall.nudge) nudgeBall(ballBody, currentTilt)

                const starUpdate = updateStarTracker(starTracker, position, stage.stars)
                starTracker = starUpdate.tracker
                if (starUpdate.collectedIds.length > 0) {
                  const totalCollected = collectedStarCount(starTracker)
                  startStarPops(starUpdate.collectedIds, now)
                  for (let index = 0; index < starUpdate.collectedIds.length; index += 1) {
                    playMazeStarSound(
                      totalCollected - starUpdate.collectedIds.length + index,
                    )
                  }
                  // 同じフレームに複数個取っても、React側への通知は1回にまとめる。
                  optionsRef.current.onStarCollected?.(totalCollected, stage.stars.length)
                }

                // ⭐はクリア条件ではないため、残していても従来どおりゴール判定だけでクリアする。
                if (isGoalReached(position, stage.goal)) {
                  goalNotified = true
                  playMazeGoalSound()
                  settleBallInGoalCup(ballBody)
                  optionsRef.current.onGoal()
                }
              }
            }
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

        try {
          prefersReducedMotion =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        } catch {
          // matchMediaがないテスト環境や古いブラウザでは通常の演出を使う。
          prefersReducedMotion = false
        }

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

        const floorMaterial = trackMaterial(
          new THREE.MeshLambertMaterial({ color: 0xfaf0d8 }),
        )
        for (const floor of stage.floors) {
          const floorMesh = new THREE.Mesh(
            track(new THREE.BoxGeometry(floor.width, FLOOR_THICKNESS, floor.depth)),
            floorMaterial,
          )
          floorMesh.position.set(floor.x, -FLOOR_THICKNESS / 2, floor.z)
          boardGroup.add(floorMesh)
        }

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

        const holeRingMaterial = trackMaterial(
          new THREE.MeshLambertMaterial({ color: 0xff8787 }),
        )
        const holePitMaterial = trackMaterial(
          new THREE.MeshLambertMaterial({ color: 0x27374d }),
        )
        for (const hole of stage.holes) {
          const ring = new THREE.Mesh(
            track(
              new THREE.TorusGeometry(CELL_SIZE * 0.44, CELL_SIZE * 0.05, 8, 24),
            ),
            holeRingMaterial,
          )
          ring.rotation.x = -Math.PI / 2
          ring.position.set(hole.center.x, 0.03, hole.center.z)
          boardGroup.add(ring)

          const pit = new THREE.Mesh(
            track(new THREE.BoxGeometry(hole.size, 0.1, hole.size)),
            holePitMaterial,
          )
          pit.position.set(hole.center.x, HOLE_PIT_BOTTOM_Y, hole.center.z)
          boardGroup.add(pit)
        }

        // ゴールは、底が少しだけ低いゴルフカップ風の受け皿。
        // 深い穴にしないことで、カップイン後も国旗ボールを十分に見せられる。
        const goalCupBottom = new THREE.Mesh(
          track(new THREE.CylinderGeometry(GOAL_CUP_RADIUS, GOAL_CUP_RADIUS, BALL_RADIUS * 0.04, 32)),
          trackMaterial(new THREE.MeshLambertMaterial({ color: 0x315a72 })),
        )
        goalCupBottom.position.set(stage.goal.x, GOAL_CUP_FLOOR_Y + BALL_RADIUS * 0.02, stage.goal.z)
        boardGroup.add(goalCupBottom)

        const goalCupRim = new THREE.Mesh(
          track(new THREE.TorusGeometry(
            (GOAL_CUP_RADIUS + GOAL_CUP_RIM_RADIUS) / 2,
            (GOAL_CUP_RIM_RADIUS - GOAL_CUP_RADIUS) / 2,
            8,
            32,
          )),
          trackMaterial(new THREE.MeshLambertMaterial({ color: 0xffc53d })),
        )
        goalCupRim.rotation.x = -Math.PI / 2
        goalCupRim.position.set(stage.goal.x, BALL_RADIUS * 0.045, stage.goal.z)
        boardGroup.add(goalCupRim)

        const goalCupLip = new THREE.Mesh(
          track(new THREE.TorusGeometry(GOAL_CUP_RADIUS, BALL_RADIUS * 0.045, 8, 32)),
          trackMaterial(new THREE.MeshLambertMaterial({ color: 0xfff9db })),
        )
        goalCupLip.rotation.x = -Math.PI / 2
        goalCupLip.position.set(stage.goal.x, BALL_RADIUS * 0.055, stage.goal.z)
        boardGroup.add(goalCupLip)

        const markerRadius = GOAL_RADIUS + BALL_RADIUS * 0.25

        const startMesh = new THREE.Mesh(
          track(new THREE.CylinderGeometry(markerRadius, markerRadius, BALL_RADIUS * 0.07, 28)),
          trackMaterial(new THREE.MeshLambertMaterial({ color: 0xa9e34b })),
        )
        startMesh.position.set(stage.start.x, 0.02, stage.start.z)
        boardGroup.add(startMesh)

        // 星は同じ形状とマテリアルを共有し、盤面と一緒に傾いて通り道を塞がないようにする。
        const starGeometry = track(new THREE.OctahedronGeometry(STAR_VISUAL_RADIUS, 0))
        const starMaterial = trackMaterial(
          new THREE.MeshLambertMaterial({ color: 0xffd43b }),
        )
        for (const star of stage.stars) {
          const starMesh = new THREE.Mesh(starGeometry, starMaterial)
          starMesh.position.set(star.center.x, STAR_HOVER_Y, star.center.z)
          boardGroup.add(starMesh)
          starVisuals.push({ id: star.id, mesh: starMesh })
        }

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
        spinners = mazeWorld.spinners

        const spinnerMaterial = trackMaterial(
          new THREE.MeshLambertMaterial({ color: 0xf76707 }),
        )
        const spinnerEndMaterial = trackMaterial(
          new THREE.MeshLambertMaterial({ color: 0xffd43b }),
        )
        for (const spinner of spinners) {
          const spinnerMesh = new THREE.Mesh(
            track(
              new THREE.BoxGeometry(
                spinner.gimmick.length,
                spinner.gimmick.height,
                spinner.gimmick.thickness,
              ),
            ),
            spinnerMaterial,
          )
          const endGeometry = track(
            new THREE.SphereGeometry(spinner.gimmick.thickness * 0.9, 12, 8),
          )
          for (const x of [-spinner.gimmick.length / 2, spinner.gimmick.length / 2]) {
            const end = new THREE.Mesh(endGeometry, spinnerEndMaterial)
            end.position.x = x
            spinnerMesh.add(end)
          }
          boardGroup.add(spinnerMesh)
          spinnerVisuals.push({ body: spinner.body, mesh: spinnerMesh })
        }

        const bumperBodyMaterial = trackMaterial(
          new THREE.MeshLambertMaterial({ color: 0xff5fa2 }),
        )
        const bumperBaseMaterial = trackMaterial(
          new THREE.MeshLambertMaterial({ color: 0xffd43b }),
        )
        const bumperTopMaterial = trackMaterial(
          new THREE.MeshLambertMaterial({ color: 0xfff3bf }),
        )
        for (const bumper of stage.gimmicks.bumpers) {
          const bumperGroup = new THREE.Group()
          bumperGroup.position.set(bumper.center.x, 0, bumper.center.z)

          const bodyMesh = new THREE.Mesh(
            track(
              new THREE.CylinderGeometry(
                bumper.radius,
                bumper.radius * 0.92,
                BUMPER_HEIGHT,
                20,
              ),
            ),
            bumperBodyMaterial,
          )
          bodyMesh.position.y = BUMPER_HEIGHT / 2
          bumperGroup.add(bodyMesh)

          const baseMesh = new THREE.Mesh(
            track(
              new THREE.CylinderGeometry(
                bumper.radius * 1.45,
                bumper.radius * 1.45,
                0.06,
                20,
              ),
            ),
            bumperBaseMaterial,
          )
          baseMesh.position.y = 0.03
          bumperGroup.add(baseMesh)

          const topMesh = new THREE.Mesh(
            track(
              new THREE.CylinderGeometry(
                bumper.radius * 0.55,
                bumper.radius * 0.55,
                0.06,
                16,
              ),
            ),
            bumperTopMaterial,
          )
          topMesh.position.y = BUMPER_HEIGHT + 0.03
          bumperGroup.add(topMesh)

          boardGroup.add(bumperGroup)
          bumperVisuals.set(bumper.id, bumperGroup)
        }

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
      goalNotified = false
      checkpointTracker = createCheckpointTracker()
      starTracker = createStarTracker()
      starPopStartedAtMs.clear()
      for (const { mesh } of starVisuals) {
        mesh.visible = true
        mesh.scale.setScalar(1)
        mesh.rotation.set(0, 0, 0)
        mesh.position.y = STAR_HOVER_Y
      }
      optionsRef.current.onStarCollected?.(0, stage.stars.length)
      impactTracker = createImpactTracker()
      bumperCooldowns.clear()
      resetBall(ballBody, stage.start)
      stallTracker = createStallTracker()
      spinnerTrapTracker = createSpinnerTrapTracker()
      respawnGraceRemainingMs = RESPAWN_GRACE_MS
      respawnSettleRemainingMs = RESPAWN_SETTLE_MS
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
  }, [options.runId, options.flag.id, options.stageId])

  return handle
}
