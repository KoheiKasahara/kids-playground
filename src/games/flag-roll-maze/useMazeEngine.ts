import { useEffect, useMemo, useRef } from 'react'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { createFlagPanelBallResource } from '../../components/flag-ball/flagPanelBall'
import type { FlagBallData } from '../../components/flag-ball/flagBalls'
import {
  BALL_RADIUS,
  BUMPER_HEIGHT,
  CAR_BODY_HEIGHT,
  CAR_BODY_ROUND,
  CAR_CABIN_RADIUS,
  CAR_DEPTH,
  CAR_WIDTH,
  CANNON_LAUNCH_SPEED_CAP,
  CANNON_LAUNCH_WINDOW_MS,
  FLOOR_THICKNESS,
  GOAL_CUP_FLOOR_Y,
  GOAL_CUP_RADIUS,
  GOAL_CUP_RIM_RADIUS,
  GOAL_RADIUS,
  HOLE_PIT_BOTTOM_Y,
  JUMP_PAD_SPEED_CAP,
  JUMP_PAD_SPEED_CAP_MS,
  MAX_FRAME_DELTA_MS,
  MAX_BALL_SPEED,
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
import type { TerrainStyle } from './mazeTerrain'
import { carXAt } from './mazeCarToy'
import { createCannonState, updateCannon, type CannonState } from './mazeCannon'
import {
  CAMERA_ELEVATION_FOLLOW_LAMBDA,
  CAMERA_LAUNCH_FOLLOW_LAMBDA,
  cameraSetupForFocus,
  clampMazeZoomIndex,
  computeMazeCameraDistance,
  DEFAULT_MAZE_ZOOM_INDEX,
  desiredCameraFocus,
  followCameraElevation,
  followCameraFocus,
  followZoomScale,
  mazeZoomScale,
  type MazeCameraFocus,
} from './mazeCamera'
import {
  applyTiltToGravity,
  applyBumperKicks,
  applyJumpPadLaunches,
  advanceCars,
  advanceSpinners,
  createMazeWorld,
  fireCannon,
  isGoalReached,
  limitBallSpeed,
  nudgeBall,
  pushBallOutOfSpinner,
  resetBall,
  settleBallIntoCannon,
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
  playPinballJumppadSound,
  playPinballLaunchSound,
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
    let cars: ReturnType<typeof createMazeWorld>['cars'] = []
    let resizeObserver: ResizeObserver | null = null
    let detachViewportListeners: (() => void) | null = null
    let rafId: number | null = null
    let released = false
    let goalNotified = false
    let lastFrameTime: number | null = null
    let accumulator = 0
    // 回転棒はフレーム時刻ではなく物理ステップ数から進め、処理落ちでも回転が飛ばないようにする。
    let physicsElapsedSeconds = 0
    // 車だけはリトライ時に見た目の初期位相へ戻し、既存の回転棒の時刻は止めない。
    let carPhaseBaseSeconds = 0
    // ジャンプ床の発射直後だけ上限を緩める。既存ステージは窓を開かないため常に従来値のまま。
    let speedCapValue = MAX_BALL_SPEED
    let speedCapUntilMs = 0
    let currentTilt: TiltInput = { ...NEUTRAL_TILT }
    let stallTracker: StallTracker = createStallTracker()
    let checkpointTracker: CheckpointTracker = createCheckpointTracker()
    let spinnerTrapTracker: SpinnerTrapTracker = createSpinnerTrapTracker()
    let respawnGraceRemainingMs = 0
    let respawnSettleRemainingMs = 0
    // クールダウンをrun内に閉じ込め、もういちどで前の衝突履歴を持ち越さない。
    const bumperCooldowns: BumperCooldowns = new Map()
    const jumpPadCooldowns: BumperCooldowns = new Map()
    const cannonStates = new Map<string, CannonState>(
      stage.gimmicks.cannons.map((cannon) => [cannon.id, createCannonState()]),
    )
    let impactTracker: ImpactTracker = createImpactTracker()
    let starTracker: StarTracker = createStarTracker()
    let cameraFocus: MazeCameraFocus = { x: 0, z: 0 }
    let cameraFocusY = BALL_RADIUS
    let cameraFollowBoostUntilMs = 0
    // 標準距離は画面比だけで決まる。ズームはそこへ掛ける倍率として持つ。
    let cameraBaseDistance = computeMazeCameraDistance(1)
    let cameraZoomScale = mazeZoomScale(zoomIndexRef.current)

    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []
    const textures: THREE.Texture[] = []
    const spinnerVisuals: { body: RigidBody; mesh: THREE.Mesh }[] = []
    const carVisuals: { body: RigidBody; mesh: THREE.Group }[] = []
    const bumperVisuals = new Map<string, THREE.Group>()
    const bumperPopStartedAtMs = new Map<string, number>()
    const jumpPadVisuals = new Map<string, THREE.Group>()
    const jumpPadPopStartedAtMs = new Map<string, number>()
    const cannonVisuals = new Map<
      string,
      {
        barrel: THREE.Group
        ring: THREE.Mesh
        smoke: THREE.Mesh[]
        smokeMaterial: THREE.MeshLambertMaterial
        direction: THREE.Vector3
        muzzle: THREE.Vector3
      }
    >()
    const cannonFireStartedAtMs = new Map<string, number>()
    const starVisuals: { id: string; mesh: THREE.Mesh; hoverY: number }[] = []
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

    function currentSpeedCap(nowMs: number): number {
      return nowMs < speedCapUntilMs ? speedCapValue : MAX_BALL_SPEED
    }

    function openSpeedCapWindow(cap: number, durationMs: number, nowMs: number): void {
      speedCapValue = cap
      speedCapUntilMs = nowMs + durationMs
    }

    function closeSpeedCapWindow(): void {
      speedCapValue = MAX_BALL_SPEED
      speedCapUntilMs = 0
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
      cars = []
      spinnerVisuals.length = 0
      carVisuals.length = 0
      bumperVisuals.clear()
      bumperPopStartedAtMs.clear()
      jumpPadVisuals.clear()
      jumpPadPopStartedAtMs.clear()
      cannonVisuals.clear()
      cannonFireStartedAtMs.clear()
      starVisuals.length = 0
      starPopStartedAtMs.clear()
      bumperCooldowns.clear()
      jumpPadCooldowns.clear()
      cannonStates.clear()
      closeSpeedCapWindow()
      cameraFollowBoostUntilMs = 0
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

    /** 標準距離はリサイズ時に決め、毎フレームは追従後の注視点とズーム倍率を反映する。 */
    function applyCameraFocus() {
      if (!camera) return
      const setup = cameraSetupForFocus(
        cameraFocus,
        cameraBaseDistance * cameraZoomScale,
        cameraFocusY,
      )
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

    function updateJumpPadPops(nowMs: number) {
      for (const [id, startedAtMs] of jumpPadPopStartedAtMs) {
        const group = jumpPadVisuals.get(id)
        if (!group) {
          jumpPadPopStartedAtMs.delete(id)
          continue
        }
        const progress = Math.min(1, Math.max(0, (nowMs - startedAtMs) / 220))
        if (progress >= 1 || prefersReducedMotion) {
          group.scale.set(1, 1, 1)
          jumpPadPopStartedAtMs.delete(id)
          continue
        }
        // 横に広げず縦だけ弾ませ、床の上へ押し上げる力を直感的に伝える。
        group.scale.set(1, 1 + 0.28 * Math.sin(Math.PI * progress), 1)
      }
    }

    function updateCannonVisuals(nowMs: number) {
      for (const [id, visual] of cannonVisuals) {
        const state = cannonStates.get(id)
        visual.ring.scale.setScalar(state?.phase === 'capturing' ? 1.12 : 1)

        const startedAtMs = cannonFireStartedAtMs.get(id)
        if (startedAtMs === undefined) continue

        const recoilProgress = Math.min(1, Math.max(0, (nowMs - startedAtMs) / 220))
        const recoil = 0.22 * Math.sin(Math.PI * recoilProgress)
        visual.barrel.position.set(
          -visual.direction.x * recoil,
          -visual.direction.y * recoil,
          -visual.direction.z * recoil,
        )
        visual.ring.position.copy(visual.muzzle).addScaledVector(visual.direction, -recoil)

        const smokeProgress = Math.min(1, Math.max(0, (nowMs - startedAtMs) / 450))
        if (smokeProgress >= 1) {
          visual.barrel.position.set(0, 0, 0)
          visual.ring.position.copy(visual.muzzle)
          visual.smokeMaterial.opacity = 0
          for (const smoke of visual.smoke) {
            smoke.visible = false
            smoke.scale.setScalar(1)
          }
          cannonFireStartedAtMs.delete(id)
          continue
        }

        if (prefersReducedMotion) {
          visual.smokeMaterial.opacity = 0
          for (const smoke of visual.smoke) smoke.visible = false
          continue
        }

        // 煙は発射方向へ広がりながら薄くし、弾道を隠さず「打ち出した」ことだけを伝える。
        visual.smokeMaterial.opacity = 0.6 * (1 - smokeProgress)
        for (const [index, smoke] of visual.smoke.entries()) {
          const spread = (index - 1) * 0.13
          smoke.visible = true
          smoke.position.set(
            visual.muzzle.x + visual.direction.x * (0.18 + smokeProgress * 0.52) + spread,
            visual.muzzle.y + visual.direction.y * (0.18 + smokeProgress * 0.52) + index * 0.06,
            visual.muzzle.z + visual.direction.z * (0.18 + smokeProgress * 0.52),
          )
          smoke.scale.setScalar(0.55 + smokeProgress * (0.65 + index * 0.12))
        }
      }
    }

    function resetCannons(): void {
      cannonStates.clear()
      cameraFollowBoostUntilMs = 0
      for (const cannon of stage.gimmicks.cannons) {
        cannonStates.set(cannon.id, createCannonState())
      }
      cannonFireStartedAtMs.clear()
      for (const visual of cannonVisuals.values()) {
        visual.barrel.position.set(0, 0, 0)
        visual.ring.position.copy(visual.muzzle)
        visual.ring.scale.setScalar(1)
        visual.smokeMaterial.opacity = 0
        for (const smoke of visual.smoke) {
          smoke.visible = false
          smoke.scale.setScalar(1)
        }
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
          visual.mesh.position.y = visual.hoverY
          continue
        }

        const phase = index * 1.7
        visual.mesh.rotation.y = nowMs * 0.001 + phase
        visual.mesh.rotation.x = Math.sin(nowMs * 0.0007 + phase) * 0.12
        visual.mesh.position.y = visual.hoverY + Math.sin(nowMs * 0.003 + phase) * 0.08
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
      // 車もkinematic bodyを正本にするため、React stateを使わず毎フレーム同じ位置へ同期する。
      for (const { body, mesh } of carVisuals) {
        const translation = body.translation()
        const rotation = body.rotation()
        mesh.position.set(translation.x, translation.y, translation.z)
        mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      }
      updateStarVisuals(nowMs)
      if (nowMs !== undefined) {
        updateBumperPops(nowMs)
        updateJumpPadPops(nowMs)
        updateCannonVisuals(nowMs)
        updateStarPops(nowMs)
      }
    }

    /** 生成・リセット・救出の直後は、カメラをボール位置へ即座に合わせる。 */
    function snapCameraFocusToBall() {
      if (!ballBody) return
      const position = ballBody.translation()
      cameraFocus = { x: position.x, z: position.z }
      cameraFocusY = position.y
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

    /** 水平と高さを別々に追従させ、ジャンプ中も画面が跳ねすぎないようにする。 */
    function updateCameraFocus(deltaSeconds: number, nowMs: number) {
      if (!ballBody) return
      const position = ballBody.translation()
      const velocity = ballBody.linvel()
      const desired = desiredCameraFocus(
        { x: position.x, z: position.z },
        { x: velocity.x, z: velocity.z },
        bounds,
      )
      const launchFollowing = nowMs < cameraFollowBoostUntilMs
      cameraFocus = followCameraFocus(
        cameraFocus,
        desired,
        { x: position.x, z: position.z },
        deltaSeconds,
        launchFollowing
          ? { followLambda: CAMERA_LAUNCH_FOLLOW_LAMBDA }
          : undefined,
      )
      // 高さは既定2.6を水平5.0より遅くし、跳ねや段差でカメラが揺れないようにする。
      cameraFocusY = followCameraElevation(
        cameraFocusY,
        position.y,
        deltaSeconds,
        launchFollowing ? 4.5 : CAMERA_ELEVATION_FOLLOW_LAMBDA,
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
      closeSpeedCapWindow()
      resetCannons()
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

    function startJumpPadPops(launchedIds: readonly string[], nowMs: number) {
      if (prefersReducedMotion) return
      for (const id of launchedIds) {
        if (jumpPadVisuals.has(id)) jumpPadPopStartedAtMs.set(id, nowMs)
      }
    }

    function startCannonFireVisual(cannonId: string, nowMs: number): void {
      const visual = cannonVisuals.get(cannonId)
      if (visual === undefined) return
      cannonFireStartedAtMs.set(cannonId, nowMs)
      visual.smokeMaterial.opacity = 0.6
      for (const smoke of visual.smoke) smoke.visible = !prefersReducedMotion
    }

    /**
     * 大砲の捕捉・発射はフレームごとに状態を進める。
     * hold中は後段の救出・停滞判定を止めるため、呼び出し元へ明示的に返す。
     */
    function updateCannons(nowMs: number): boolean {
      if (ballBody === null) return false
      let holding = false

      for (const cannon of stage.gimmicks.cannons) {
        const currentState = cannonStates.get(cannon.id) ?? createCannonState()
        const result = updateCannon(currentState, ballBody.translation(), cannon, nowMs)
        cannonStates.set(cannon.id, result.state)

        if (result.hold) {
          settleBallIntoCannon(ballBody, cannon)
          holding = true
        }
        if (result.action === 'fire') {
          fireCannon(ballBody, cannon)
          openSpeedCapWindow(CANNON_LAUNCH_SPEED_CAP, CANNON_LAUNCH_WINDOW_MS, nowMs)
          // 発射中だけ追従を強め、速い弾道でもカメラを瞬間移動させずに見せる。
          cameraFollowBoostUntilMs = nowMs + CANNON_LAUNCH_WINDOW_MS
          // 窓を開いてから制限し、通常上限5.4で大砲の発射速度を削らないようにする。
          limitBallSpeed(ballBody, currentSpeedCap(nowMs))
          playPinballLaunchSound()
          startCannonFireVisual(cannon.id, nowMs)
        }
      }

      return holding
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
        advanceCars(cars, physicsElapsedSeconds - carPhaseBaseSeconds)
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
      limitBallSpeed(ballBody, currentSpeedCap(nowMs))
      const kickedIds = applyBumperKicks(
        ballBody,
        stage.gimmicks.bumpers,
        bumperCooldowns,
        nowMs,
      )
      const launchedIds = applyJumpPadLaunches(
        ballBody,
        stage.gimmicks.jumpPads,
        jumpPadCooldowns,
        nowMs,
      )
      if (launchedIds.length > 0) {
        openSpeedCapWindow(JUMP_PAD_SPEED_CAP, JUMP_PAD_SPEED_CAP_MS, nowMs)
        playPinballJumppadSound()
        startJumpPadPops(launchedIds, nowMs)
      }
      // 発射の後に窓を開いてから制限し、5.4へ即座に削らないようにする。
      limitBallSpeed(ballBody, currentSpeedCap(nowMs))
      if (kickedIds.length > 0) {
        playPinballBumperSound()
        startBumperPops(kickedIds, nowMs)
      }
      if (
        kickedIds.length === 0 &&
        launchedIds.length === 0 &&
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
      const cannonHolding = updateCannons(now)
      if (settlingAfterRespawn && ballBody !== null) {
        // 重力と入力はそのままにし、復帰直後だけボールの動きを毎フレーム打ち消す。
        ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
        ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true)
      }
      respawnSettleRemainingMs = Math.max(0, respawnSettleRemainingMs - deltaMs)
      writeVisuals(now)

      // 捕捉中は位置と速度を大砲側で管理する。ここで救出・停滞・星・ゴールまで動かすと、
      // 静止させた演出を「詰み」と誤判定して復帰させてしまうため、復帰直後と同じく止める。
      if (ballBody !== null && !cannonHolding) {
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
      updateCameraFocus(deltaSeconds, now)

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

        // 地形はstyleごとに1つだけマテリアルを持ち、段差が増えてもGPUリソースを増やしすぎない。
        const terrainMaterials = new Map<TerrainStyle, THREE.MeshLambertMaterial>()
        const terrainMaterialFor = (style: TerrainStyle): THREE.MeshLambertMaterial => {
          const existing = terrainMaterials.get(style)
          if (existing) return existing

          let color = 0xf7d9a0
          if (style === 'step') color = 0xf3c98b
           if (style === 'slide') color = 0x4dc4f5
           if (style === 'guard') color = 0xffb84d
           if (style === 'road') color = 0x6c717d
           if (style === 'roadMarking') color = 0xfff9db
          const material = trackMaterial(new THREE.MeshLambertMaterial({ color }))
          terrainMaterials.set(style, material)
          return material
        }
        for (const box of stage.terrain.boxes) {
          const terrainMesh = new THREE.Mesh(
            track(new THREE.BoxGeometry(box.width, box.height, box.depth)),
            terrainMaterialFor(box.style),
          )
          terrainMesh.position.set(box.x, box.y, box.z)
          terrainMesh.rotation.x = box.rotationX
          boardGroup.add(terrainMesh)
        }

        if (stage.terrain.bars.length > 0) {
          const roundedBarMaterial = trackMaterial(
            new THREE.MeshLambertMaterial({ color: 0xffd43b }),
          )
          for (const bar of stage.terrain.bars) {
            const barMesh = new THREE.Mesh(
              track(new THREE.CylinderGeometry(bar.radius, bar.radius, bar.length, 16)),
              roundedBarMaterial,
            )
            barMesh.position.set(bar.x, bar.y, bar.z)
            barMesh.rotation.z = Math.PI / 2
            boardGroup.add(barMesh)
          }
        }

        const slides = stage.terrain.boxes.filter((box) => box.style === 'slide')
        if (slides.length > 0) {
          // 三角形を斜面と同じ向きへ寝かせ、初めて遊ぶ子にも下りる方向を伝える。
          // ConeGeometryは半径に対して高さを十分小さくすると、XZ平面に寝た薄い三角の板になる。
          // radialSegments=3の最初の頂点は+Z側に来るので、回さないままで進行方向(+z)を指す。
          const slideArrowGeometry = track(new THREE.ConeGeometry(CELL_SIZE * 0.14, 0.08, 3))
          const slideArrowMaterial = trackMaterial(
            new THREE.MeshLambertMaterial({ color: 0xfff9db }),
          )
          for (const slide of slides) {
            const arrowGroup = new THREE.Group()
            arrowGroup.position.set(slide.x, slide.y, slide.z)
            arrowGroup.rotation.x = slide.rotationX
            for (const localZ of [-slide.depth * 0.22, 0, slide.depth * 0.22]) {
              const arrow = new THREE.Mesh(slideArrowGeometry, slideArrowMaterial)
              arrow.position.set(0, slide.height / 2 + 0.04, localZ)
              arrowGroup.add(arrow)
            }
            boardGroup.add(arrowGroup)
          }
        }

        const hurdle = stage.terrain.boxes.find(
          ({ id }) => id === 'athletic-hurdle',
        )
        if (hurdle !== undefined) {
          // 物理の幅や高さを増やさず、白い縞だけで「跳ぶ壁」を遠くからも見分けられるようにする。
          const stripeHeight = 0.4
          const hurdleStripeGeometry = track(
            new THREE.BoxGeometry(hurdle.width * 0.13, stripeHeight, 0.03),
          )
          const hurdleStripeMaterial = trackMaterial(
            new THREE.MeshLambertMaterial({ color: 0xfff9db }),
          )
          const stripeY = hurdle.y + hurdle.height / 2 - stripeHeight / 2 - 0.03
          for (const z of [
            hurdle.z - hurdle.depth / 2 - 0.016,
            hurdle.z + hurdle.depth / 2 + 0.016,
          ]) {
            for (const x of [-hurdle.width * 0.32, 0, hurdle.width * 0.32]) {
              const stripe = new THREE.Mesh(hurdleStripeGeometry, hurdleStripeMaterial)
              stripe.position.set(hurdle.x + x, stripeY, z)
              boardGroup.add(stripe)
            }
          }
        }

        if (stage.gimmicks.jumpPads.length > 0) {
          const jumpPadArrowGeometry = track(
            new THREE.ConeGeometry(CELL_SIZE * 0.13, 0.1, 3),
          )
          const jumpPadSpringGeometry = track(
            new THREE.TorusGeometry(CELL_SIZE * 0.13, 0.035, 8, 16),
          )
          const jumpPadMaterial = trackMaterial(
            new THREE.MeshLambertMaterial({ color: 0xa9e34b }),
          )
          const jumpPadEdgeMaterial = trackMaterial(
            new THREE.LineBasicMaterial({ color: 0xff922b }),
          )
          const jumpPadArrowMaterial = trackMaterial(
            new THREE.MeshLambertMaterial({ color: 0xfff9db }),
          )
          const jumpPadSpringMaterial = trackMaterial(
            new THREE.MeshLambertMaterial({ color: 0xffd43b }),
          )
          for (const jumpPad of stage.gimmicks.jumpPads) {
            const jumpPadGroup = new THREE.Group()
            jumpPadGroup.position.set(jumpPad.center.x, 0, jumpPad.center.z)

            const padGeometry = track(
              new THREE.BoxGeometry(
                jumpPad.halfWidth * 2,
                jumpPad.top,
                jumpPad.halfDepth * 2,
              ),
            )
            const padMesh = new THREE.Mesh(padGeometry, jumpPadMaterial)
            padMesh.position.y = jumpPad.top / 2
            jumpPadGroup.add(padMesh)

            const edgeMesh = new THREE.LineSegments(
              track(new THREE.EdgesGeometry(padGeometry)),
              jumpPadEdgeMaterial,
            )
            edgeMesh.position.y = jumpPad.top / 2
            jumpPadGroup.add(edgeMesh)

            for (const x of [
              -jumpPad.halfWidth * 0.45,
              0,
              jumpPad.halfWidth * 0.45,
            ]) {
              const arrow = new THREE.Mesh(jumpPadArrowGeometry, jumpPadArrowMaterial)
              arrow.position.set(x, jumpPad.top + 0.07, 0)
              jumpPadGroup.add(arrow)
            }

            for (const y of [-0.035, -0.085, -0.135]) {
              const spring = new THREE.Mesh(jumpPadSpringGeometry, jumpPadSpringMaterial)
              spring.position.y = y
              spring.rotation.x = Math.PI / 2
              jumpPadGroup.add(spring)
            }

            boardGroup.add(jumpPadGroup)
            jumpPadVisuals.set(jumpPad.id, jumpPadGroup)
          }
        }

        if (stage.gimmicks.cannons.length > 0) {
          const cannonBarrelGeometry = track(
            new THREE.CylinderGeometry(0.34, 0.34, 1.5, 16),
          )
          const cannonBaseGeometry = track(
            new THREE.CylinderGeometry(0.48, 0.62, 0.36, 16),
          )
          const cannonRingGeometry = track(
            new THREE.TorusGeometry(0.37, 0.06, 8, 20),
          )
          const cannonSmokeGeometry = track(new THREE.SphereGeometry(0.18, 12, 10))
          const cannonBarrelMaterial = trackMaterial(
            new THREE.MeshLambertMaterial({ color: 0x495057 }),
          )
          const cannonBaseMaterial = trackMaterial(
            new THREE.MeshLambertMaterial({ color: 0x868e96 }),
          )
          const cannonRingMaterial = trackMaterial(
            new THREE.MeshLambertMaterial({ color: 0xffd43b }),
          )
          const cannonSmokeMaterial = trackMaterial(
            new THREE.MeshLambertMaterial({
              color: 0xf8f9fa,
              transparent: true,
              opacity: 0,
              depthWrite: false,
            }),
          )

          for (const cannon of stage.gimmicks.cannons) {
            const cannonGroup = new THREE.Group()
            cannonGroup.position.set(cannon.center.x, 0, cannon.center.z)

            const base = new THREE.Mesh(cannonBaseGeometry, cannonBaseMaterial)
            base.position.y = 0.18
            cannonGroup.add(base)

            const barrelGroup = new THREE.Group()
            const barrel = new THREE.Mesh(cannonBarrelGeometry, cannonBarrelMaterial)
            const barrelCenterY = cannon.muzzleY * 0.66
            barrel.position.y = barrelCenterY
            // 円柱の軸を+zへ向ける仰角として扱い、設計どおりの回転量で砲身を立ち上げる。
            barrel.rotation.x = -(Math.PI / 2 - cannon.elevationRad)
            barrelGroup.add(barrel)
            cannonGroup.add(barrelGroup)

            const direction = new THREE.Vector3(
              Math.cos(cannon.elevationRad) * Math.sin(cannon.headingRad),
              Math.sin(cannon.elevationRad),
              Math.cos(cannon.elevationRad) * Math.cos(cannon.headingRad),
            ).normalize()
            const muzzle = new THREE.Vector3(0, barrelCenterY, 0).addScaledVector(
              direction,
              0.78,
            )
            const ring = new THREE.Mesh(cannonRingGeometry, cannonRingMaterial)
            ring.position.copy(muzzle)
            ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction)
            cannonGroup.add(ring)

            const smoke: THREE.Mesh[] = []
            for (let index = 0; index < 3; index += 1) {
              const puff = new THREE.Mesh(cannonSmokeGeometry, cannonSmokeMaterial)
              puff.visible = false
              cannonGroup.add(puff)
              smoke.push(puff)
            }

            boardGroup.add(cannonGroup)
            cannonVisuals.set(cannon.id, {
              barrel: barrelGroup,
              ring,
              smoke,
              smokeMaterial: cannonSmokeMaterial,
              direction,
              muzzle,
            })
          }
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
        startMesh.position.set(stage.start.x, (stage.start.y ?? 0) + 0.02, stage.start.z)
        boardGroup.add(startMesh)

        // 星は同じ形状とマテリアルを共有し、盤面と一緒に傾いて通り道を塞がないようにする。
        const starGeometry = track(new THREE.OctahedronGeometry(STAR_VISUAL_RADIUS, 0))
        const starMaterial = trackMaterial(
          new THREE.MeshLambertMaterial({ color: 0xffd43b }),
        )
        for (const star of stage.stars) {
          const starMesh = new THREE.Mesh(starGeometry, starMaterial)
          const hoverY = (star.center.y ?? 0) + STAR_HOVER_Y
          starMesh.position.set(star.center.x, hoverY, star.center.z)
          boardGroup.add(starMesh)
          starVisuals.push({ id: star.id, mesh: starMesh, hoverY })
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
        cars = mazeWorld.cars

        if (cars.length > 0) {
          // 車ごとにGeometryやMaterialを増やさず、同じ道路を走る全車で共有する。
          const carBodyGeometry = track(
            new RoundedBoxGeometry(
              CAR_WIDTH,
              CAR_BODY_HEIGHT,
              CAR_DEPTH,
              4,
              CAR_BODY_ROUND,
            ),
          )
          const carEdgeGeometry = track(new THREE.EdgesGeometry(carBodyGeometry))
          const carCabinGeometry = track(
            new THREE.CylinderGeometry(
              CAR_CABIN_RADIUS,
              CAR_CABIN_RADIUS,
              CAR_WIDTH * 0.56,
              16,
            ),
          )
          const carWheelGeometry = track(
            new THREE.CylinderGeometry(
              CAR_BODY_HEIGHT * 0.24,
              CAR_BODY_HEIGHT * 0.24,
              CAR_DEPTH * 0.18,
              12,
            ),
          )
          const carLightGeometry = track(
            new THREE.SphereGeometry(CAR_BODY_HEIGHT * 0.13, 12, 8),
          )
          const carBodyMaterial = trackMaterial(
            new THREE.MeshLambertMaterial({ color: 0xff7b3f }),
          )
          const carEdgeMaterial = trackMaterial(
            new THREE.LineBasicMaterial({ color: 0xd1481c }),
          )
          const carCabinMaterial = trackMaterial(
            new THREE.MeshLambertMaterial({ color: 0xffe3bf }),
          )
          const carWheelMaterial = trackMaterial(
            new THREE.MeshLambertMaterial({ color: 0x343a40 }),
          )
          const carLightMaterial = trackMaterial(
            new THREE.MeshLambertMaterial({ color: 0xffd43b }),
          )

          for (const car of cars) {
            const carMesh = new THREE.Group()
            const bodyMesh = new THREE.Mesh(carBodyGeometry, carBodyMaterial)
            carMesh.add(bodyMesh)
            carMesh.add(new THREE.LineSegments(carEdgeGeometry, carEdgeMaterial))

            const cabinMesh = new THREE.Mesh(carCabinGeometry, carCabinMaterial)
            cabinMesh.position.y =
              CAR_BODY_HEIGHT / 2 + CAR_CABIN_RADIUS * 0.55
            cabinMesh.rotation.z = Math.PI / 2
            carMesh.add(cabinMesh)

            for (const x of [-CAR_WIDTH * 0.31, CAR_WIDTH * 0.31]) {
              for (const z of [-CAR_DEPTH * 0.34, CAR_DEPTH * 0.34]) {
                const wheel = new THREE.Mesh(carWheelGeometry, carWheelMaterial)
                wheel.position.set(x, -CAR_BODY_HEIGHT * 0.34, z)
                wheel.rotation.x = Math.PI / 2
                carMesh.add(wheel)
              }
            }

            const light = new THREE.Mesh(carLightGeometry, carLightMaterial)
            light.position.set(0, CAR_BODY_HEIGHT / 2 + CAR_CABIN_RADIUS * 1.45, 0)
            carMesh.add(light)

            boardGroup.add(carMesh)
            carVisuals.push({ body: car.body, mesh: carMesh })
          }
        }

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
      for (const { mesh, hoverY } of starVisuals) {
        mesh.visible = true
        mesh.scale.setScalar(1)
        mesh.rotation.set(0, 0, 0)
        mesh.position.y = hoverY
      }
      optionsRef.current.onStarCollected?.(0, stage.stars.length)
      impactTracker = createImpactTracker()
      bumperCooldowns.clear()
      jumpPadCooldowns.clear()
      jumpPadPopStartedAtMs.clear()
      for (const group of jumpPadVisuals.values()) group.scale.set(1, 1, 1)
      closeSpeedCapWindow()
      resetCannons()
      resetBall(ballBody, stage.start)
      // 物理時刻は回転棒のために維持し、車だけをelapsed 0の初期位相へ戻す。
      carPhaseBaseSeconds = physicsElapsedSeconds
      for (const { gimmick, body } of cars) {
        // 次の物理stepを待たず、リトライを押した瞬間の描画も初期位置へ揃える。
        body.setTranslation(
          {
            x: carXAt(gimmick, 0),
            y: gimmick.center.y,
            z: gimmick.center.z,
          },
          true,
        )
      }
      advanceCars(cars, 0)
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
