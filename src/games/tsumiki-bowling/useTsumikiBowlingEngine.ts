import { useEffect, useMemo, useRef } from 'react'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import {
  GRAVITY_Y,
  MAX_FRAME_DELTA_MS,
  MAX_PHYSICS_SUBSTEPS,
  PHYSICS_TIMESTEP,
} from './bowlingPhysics'
import {
  BACK_WALL_HALF_HEIGHT,
  BACK_WALL_Z,
  getBowlingStage,
  LANE_CENTER_Z,
  LANE_HALF_LENGTH,
  LANE_HALF_THICKNESS,
  LANE_HALF_WIDTH,
  laneBodyTransform,
  laneSurfaceY,
  laneTiltQuaternion,
  RAIL_HALF_HEIGHT,
  RAIL_HALF_WIDTH,
} from './bowlingStage'
import { bowlingCameraSetup } from './bowlingCamera'
import {
  aimFromDrag,
  launchVelocity,
  predictTrajectory,
  type LaunchAim,
} from './bowlingLaunch'
import {
  ballOutOfPlay,
  clampBowlingMotion,
  createBowlingWorld,
  launchBall,
  parkBall,
  parkFallenBall,
  readBall,
  readBlockSamples,
  readSettleSamples,
  removeFallenBlocks,
  resetForNextThrow,
  setBowlingBall,
  type BowlingWorld,
} from './bowlingWorld'
import {
  createToppleTracker,
  resetToppleTracker,
  updateToppleTracker,
  type ToppleTracker,
} from './bowlingTopple'
import { createSettleState, updateSettleState, type SettleState } from './bowlingSettle'
import { THROWS_PER_GAME } from './bowlingGame'
import type { BowlingBallId, BowlingBallSpec } from './bowlingBalls'

let rapierInitPromise: Promise<void> | null = null

/** Rapierのwasm初期化はモジュール内で一度だけ行い、もういちどや再入場で共有する。 */
function initializeRapier(): Promise<void> {
  if (rapierInitPromise === null) rapierInitPromise = RAPIER.init()
  return rapierInitPromise
}

export type ThrowSettledResult = {
  /** 何投目か（1始まり）。 */
  throwNumber: number
  /** その投球で倒した積み木の数。 */
  toppled: number
  /** これが最後の投球だったか。 */
  isLastThrow: boolean
}

export type TsumikiBowlingEngineOptions = {
  /** 値が変わったら世界を作り直す（もういちど）。 */
  runId: number
  stageId?: string
  ballId?: BowlingBallId
  /** 発射した瞬間に1回だけ呼ばれる。 */
  onThrowStart: (throwNumber: number) => void
  /** 1投が落ち着いたときに1回だけ呼ばれる。 */
  onThrowSettled: (result: ThrowSettledResult) => void
  /**
   * ドラッグ中のパワー(0〜1)。離したりドラッグしていないときはnull。
   * 毎フレームではなく、値が目に見えて変わったときだけ呼ぶ。
   */
  onAimChange: (power: number | null) => void
  /**
   * 投球中に倒れた数が増えたときだけ呼ぶ。
   * 崩れているのに数字が0のままだと、当たった手応えが伝わらない。
   * 呼ぶのは1投につき最大でも積み木の数だけ（毎フレームではない）。
   */
  onToppledProgress: (toppled: number) => void
}

export type TsumikiBowlingEngineHandle = {
  registerContainer: (element: HTMLDivElement | null) => void
  /**
   * 次に投げる玉を切り替える。
   *
   * 世界を作り直さず、玉のBody・見た目だけを差し替える
   * （runIdを変えて全部作り直すと、積み木の状態や投球数まで失われるため）。
   * 投球待機中以外（飛行中・組み直し中・結果画面）は内部で無視される。
   */
  setBallId: (ballId: BowlingBallId) => void
}

/** 1投が落ち着いてから、積み木を組み直すまでの間。崩れた形を見せる時間。 */
const REBUILD_DELAY_MS = 700
/** 組み直しの見た目（小さい状態から元の大きさへ戻す）にかける時間。 */
const REBUILD_POP_MS = 260

/** この速度差が1フレームで生じたら「強くぶつかった」とみなす[m/s]。 */
const IMPACT_SPEED_DROP = 5
/** 衝撃エフェクトの数と寿命。 */
const IMPACT_POOL_SIZE = 3
const IMPACT_DURATION_MS = 320
/** カメラの揺れの最大幅[m]と減衰時間。 */
const SHAKE_MAX = 0.14
const SHAKE_DECAY_MS = 260

/** 予測軌道の点の数。多すぎると線に見えてしまい、少なすぎると方向が読めない。 */
const GUIDE_DOT_COUNT = 18

/** HUDのパワー表示を更新する最小の変化量。細かすぎる再レンダーを避ける。 */
const AIM_POWER_STEP = 0.04

type ImpactSlot = {
  mesh: THREE.Mesh
  remainingMs: number
}

export function useTsumikiBowlingEngine(
  options: TsumikiBowlingEngineOptions,
): TsumikiBowlingEngineHandle {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const activeRunRef = useRef<symbol | null>(null)
  // 実体はeffectの中（bowlingが作られたあと）で差し替わる。
  // 世界がまだ無い間にsetBallIdが呼ばれても何もしない既定値にしておく。
  const applyBallSwitchRef = useRef<(ballId: BowlingBallId) => void>(() => {})

  const handle = useMemo<TsumikiBowlingEngineHandle>(
    () => ({
      registerContainer: (element) => {
        containerRef.current = element
      },
      setBallId: (ballId) => {
        applyBallSwitchRef.current(ballId)
      },
    }),
    [],
  )

  // ballIdは初回（または「もういちど」）の世界作りにだけ使う。
  // 効果の依存配列に含めない: 毎投の切替はworld/sceneを作り直さずに
  // 下のapplyBallSwitchRef経由で行う（作り直すと積み木の状態や投球数が失われる）。
  const { runId, stageId, ballId } = options

  useEffect(() => {
    const runToken = Symbol('tsumiki-bowling-run')
    activeRunRef.current = runToken

    // カメラの画角はステージごとに変わる（bowlingCameraSetup参照）。
    // world作りと同じくrunId/stageIdでeffectごと作り直すので、ここで一度だけ引く。
    const stage = getBowlingStage(stageId)

    let bowling: BowlingWorld | null = null
    let scene: THREE.Scene | null = null
    let camera: THREE.PerspectiveCamera | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let resizeObserver: ResizeObserver | null = null
    let detachViewportListeners: (() => void) | null = null
    let detachPointerListeners: (() => void) | null = null
    let rafId: number | null = null
    let released = false

    // ---- 1投ぶんの進行状態 ----
    /** 何投目か（0始まり）。 */
    let throwIndex = 0
    /** 発射してから落ち着くまでの間か。 */
    let flying = false
    /** 3投終わったか。終わったら物理も描画も止める。 */
    let finished = false
    /** 落ち着いてから組み直すまでの残り時間。 */
    let rebuildRemainingMs = 0
    /** 組み直しの見た目に使う残り時間。 */
    let popRemainingMs = 0
    let tracker: ToppleTracker | null = null
    let settle: SettleState | null = null

    let currentAim: LaunchAim | null = null
    let reportedPower: number | null = null
    let lastBallSpeed = 0
    let shakeStrength = 0
    let impactCursor = 0

    let lastFrameTime: number | null = null
    let accumulator = 0

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const blockMeshes: THREE.Mesh[] = []
    const impactPool: ImpactSlot[] = []
    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []
    let ballMesh: THREE.Mesh | null = null
    const guideDots: THREE.Mesh[] = []
    let guideMaterial: THREE.MeshBasicMaterial | null = null
    let landingRing: THREE.Mesh | null = null

    function track<T extends THREE.BufferGeometry>(geometry: T): T {
      geometries.push(geometry)
      return geometry
    }
    function trackMaterial<T extends THREE.Material>(material: T): T {
      materials.push(material)
      return material
    }

    function release() {
      if (released) return
      released = true
      if (activeRunRef.current === runToken) activeRunRef.current = null

      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      resizeObserver?.disconnect()
      resizeObserver = null
      detachViewportListeners?.()
      detachViewportListeners = null
      detachPointerListeners?.()
      detachPointerListeners = null

      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      geometries.length = 0
      materials.length = 0
      blockMeshes.length = 0
      impactPool.length = 0
      guideDots.length = 0
      ballMesh = null
      guideMaterial = null
      landingRing = null

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

      // Rapierのwasm側のメモリを必ず解放する。
      // ここを忘れると「もういちど」のたびに前回のBodyとColliderが残る。
      if (bowling !== null) {
        bowling.world.free()
        bowling = null
      }
    }

    // -----------------------------------------------------------------------
    // カメラと表示サイズ
    // -----------------------------------------------------------------------

    const cameraTarget = new THREE.Vector3()
    const cameraBase = new THREE.Vector3()

    function applyCamera() {
      if (!camera) return
      const setup = bowlingCameraSetup(camera.aspect, stage)
      cameraBase.set(setup.position.x, setup.position.y, setup.position.z)
      cameraTarget.set(setup.target.x, setup.target.y, setup.target.z)
      camera.fov = setup.fov
      camera.position.copy(cameraBase)
      camera.lookAt(cameraTarget)
    }

    function resizeRenderer() {
      const container = containerRef.current
      if (!container || !renderer || !camera) return
      const rect = container.getBoundingClientRect()
      const width = Math.max(1, Math.floor(rect.width || container.clientWidth || 1))
      const height = Math.max(1, Math.floor(rect.height || container.clientHeight || 1))
      camera.aspect = width / height
      applyCamera()
      camera.updateProjectionMatrix()
      // 第3引数false: canvasへ幅高さのインラインstyleを書かせず、表示サイズはCSSに任せる。
      renderer.setSize(width, height, false)
    }

    function attachViewportListeners() {
      if (typeof window === 'undefined') return
      const handleViewportChange = () => resizeRenderer()
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

    // -----------------------------------------------------------------------
    // 見た目の組み立て
    // -----------------------------------------------------------------------

    function createLaneMeshes(target: THREE.Scene) {
      const lane = laneBodyTransform()

      // 地面。物理には関係しない見た目だけの広い板で、
      // レーンが宙に浮いて見えるのを防ぎ、奥行きを感じさせる。
      const ground = new THREE.Mesh(
        track(new THREE.PlaneGeometry(120, 120)),
        trackMaterial(new THREE.MeshStandardMaterial({ color: 0x9fe0a6, roughness: 1 })),
      )
      ground.rotation.x = -Math.PI / 2
      ground.position.set(0, laneSurfaceY(BACK_WALL_Z) - LANE_HALF_THICKNESS, 0)
      target.add(ground)

      // 奥の飾り。見下ろす構図では空がほとんど映らず、背景が一色の緑で
      // 埋まってしまう（実画面で確認）。積み木の壁を1列だけ置いて、
      // おもちゃ箱の中のような奥行きを作る。物理には一切関わらない。
      const backdropGeometry = track(new THREE.BoxGeometry(1.5, 2.4, 0.7))
      const backdropColors = [0xffd9a0, 0xa5d8ff, 0xffc9c9, 0xd8f5a2, 0xe5dbff]
      const backdropMaterials = backdropColors.map((color) =>
        trackMaterial(new THREE.MeshStandardMaterial({ color, roughness: 0.9 })),
      )
      const backdropY = laneSurfaceY(BACK_WALL_Z) - LANE_HALF_THICKNESS + 1.2
      for (let index = 0; index < 11; index += 1) {
        const block = new THREE.Mesh(
          backdropGeometry,
          backdropMaterials[index % backdropMaterials.length]!,
        )
        block.position.set(
          (index - 5) * 1.7,
          backdropY + (index % 2 === 0 ? 0 : 0.35),
          BACK_WALL_Z - 3.4,
        )
        target.add(block)
      }
      const laneMesh = new THREE.Mesh(
        track(
          new THREE.BoxGeometry(
            LANE_HALF_WIDTH * 2,
            LANE_HALF_THICKNESS * 2,
            LANE_HALF_LENGTH * 2,
          ),
        ),
        trackMaterial(new THREE.MeshStandardMaterial({ color: 0xf2e2c4, roughness: 0.95 })),
      )
      laneMesh.position.set(lane.center.x, lane.center.y, lane.center.z)
      laneMesh.quaternion.set(
        lane.rotation.x,
        lane.rotation.y,
        lane.rotation.z,
        lane.rotation.w,
      )
      target.add(laneMesh)

      // レーンの中央を示す帯。どこへ転がっていくかを幼児にも分かりやすくする。
      const stripe = new THREE.Mesh(
        track(new THREE.PlaneGeometry(1.1, LANE_HALF_LENGTH * 2 - 1)),
        trackMaterial(
          new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.55 }),
        ),
      )
      // 平面を水平へ倒してから、レーンと同じ勾配へ寝かせる。
      const tilt = laneTiltQuaternion()
      stripe.quaternion
        .setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
        .premultiply(new THREE.Quaternion(tilt.x, tilt.y, tilt.z, tilt.w))
      stripe.position.set(0, laneSurfaceY(LANE_CENTER_Z) + 0.012, LANE_CENTER_Z)
      target.add(stripe)

      const railGeometry = track(
        new THREE.BoxGeometry(RAIL_HALF_WIDTH * 2, RAIL_HALF_HEIGHT * 2, LANE_HALF_LENGTH * 2),
      )
      const railMaterial = trackMaterial(
        new THREE.MeshStandardMaterial({ color: 0x8ecae6, roughness: 0.8 }),
      )
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(railGeometry, railMaterial)
        rail.position.set(
          side * (LANE_HALF_WIDTH - RAIL_HALF_WIDTH),
          laneSurfaceY(lane.center.z) + RAIL_HALF_HEIGHT,
          lane.center.z,
        )
        rail.quaternion.copy(laneMesh.quaternion)
        target.add(rail)
      }

      const backWall = new THREE.Mesh(
        track(new THREE.BoxGeometry(LANE_HALF_WIDTH * 2, BACK_WALL_HALF_HEIGHT * 2, 0.5)),
        railMaterial,
      )
      backWall.position.set(
        0,
        laneSurfaceY(BACK_WALL_Z) + BACK_WALL_HALF_HEIGHT,
        BACK_WALL_Z,
      )
      backWall.quaternion.copy(laneMesh.quaternion)
      target.add(backWall)
    }

    function createBlockMeshes(target: THREE.Scene, world: BowlingWorld) {
      const geometryCache = new Map<string, THREE.BoxGeometry>()
      const materialCache = new Map<number, THREE.MeshStandardMaterial>()
      for (const placement of world.placements) {
        const key = placement.size.join(':')
        let geometry = geometryCache.get(key)
        if (!geometry) {
          geometry = track(
            new THREE.BoxGeometry(placement.size[0], placement.size[1], placement.size[2]),
          )
          geometryCache.set(key, geometry)
        }
        let material = materialCache.get(placement.color)
        if (!material) {
          material = trackMaterial(
            new THREE.MeshStandardMaterial({
              color: placement.color,
              roughness: 0.65,
              metalness: 0.05,
            }),
          )
          materialCache.set(placement.color, material)
        }
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(
          placement.position.x,
          placement.position.y,
          placement.position.z,
        )
        mesh.quaternion.set(
          placement.rotation.x,
          placement.rotation.y,
          placement.rotation.z,
          placement.rotation.w,
        )
        target.add(mesh)
        blockMeshes.push(mesh)
      }
    }

    function createBallMesh(target: THREE.Scene, world: BowlingWorld) {
      const spec = world.ballSpec
      ballMesh = new THREE.Mesh(
        track(new THREE.SphereGeometry(spec.radius, 24, 18)),
        trackMaterial(
          new THREE.MeshStandardMaterial({
            color: spec.color,
            emissive: spec.emissive,
            emissiveIntensity: 0.35,
            roughness: 0.35,
            metalness: 0.15,
          }),
        ),
      )
      target.add(ballMesh)
    }

    /**
     * 玉を切り替えたときに見た目（大きさ・色）を合わせる。
     * ジオメトリは半径が変わるため作り直し、マテリアルは色だけ書き換えて使い回す。
     */
    function applyBallVisual(spec: BowlingBallSpec) {
      if (!ballMesh) return
      const oldGeometry = ballMesh.geometry
      ballMesh.geometry = track(new THREE.SphereGeometry(spec.radius, 24, 18))
      oldGeometry.dispose()
      const material = ballMesh.material as THREE.MeshStandardMaterial
      material.color.setHex(spec.color)
      material.emissive.setHex(spec.emissive)
    }

    /**
     * 発射ガイド。玉が飛ぶ道すじを点で描き、最後に着地点の輪を置く。
     * 点の長さでパワーが、左右の曲がりで発射方向が分かる。
     */
    function createGuide(target: THREE.Scene) {
      guideMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95 }),
      )
      const dotGeometry = track(new THREE.SphereGeometry(0.16, 10, 8))
      for (let index = 0; index < GUIDE_DOT_COUNT; index += 1) {
        const dot = new THREE.Mesh(dotGeometry, guideMaterial)
        dot.visible = false
        dot.renderOrder = 3
        target.add(dot)
        guideDots.push(dot)
      }
      landingRing = new THREE.Mesh(
        track(new THREE.RingGeometry(0.45, 0.72, 24)),
        guideMaterial,
      )
      landingRing.visible = false
      landingRing.renderOrder = 3
      target.add(landingRing)
    }

    function createImpactPool(target: THREE.Scene) {
      const geometry = track(new THREE.RingGeometry(0.35, 0.62, 24))
      for (let index = 0; index < IMPACT_POOL_SIZE; index += 1) {
        const material = trackMaterial(
          new THREE.MeshBasicMaterial({
            color: 0xfff3b0,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        )
        const mesh = new THREE.Mesh(geometry, material)
        mesh.visible = false
        mesh.renderOrder = 2
        target.add(mesh)
        impactPool.push({ mesh, remainingMs: 0 })
      }
    }

    function spawnImpact(position: { x: number; y: number; z: number }) {
      const slot = impactPool[impactCursor % Math.max(1, impactPool.length)]
      impactCursor += 1
      if (!slot) return
      slot.mesh.position.set(position.x, position.y, position.z)
      slot.mesh.visible = true
      slot.remainingMs = IMPACT_DURATION_MS
      if (!prefersReducedMotion) shakeStrength = 1
    }

    // -----------------------------------------------------------------------
    // 操作（スリングショット）
    // -----------------------------------------------------------------------

    function reportAim(power: number | null) {
      if (power === null) {
        if (reportedPower === null) return
        reportedPower = null
        optionsRef.current.onAimChange(null)
        return
      }
      const stepped = Math.round(power / AIM_POWER_STEP) * AIM_POWER_STEP
      if (reportedPower !== null && Math.abs(stepped - reportedPower) < AIM_POWER_STEP / 2) {
        return
      }
      reportedPower = stepped
      optionsRef.current.onAimChange(stepped)
    }

    /**
     * ドラッグを受け付けてよいか。
     *
     * 前の投球がまだ転がっている最中でも受け付けるのが大事なところ。
     * 幼児は積み木が止まる前に次を触るので、ここで弾くと
     * 「ひっぱったのに何も起きない」投球が生まれる（実画面で確認した）。
     * 実際に発射できるかは指を離すときに判定する。
     */
    function canStartAim(): boolean {
      return !finished && bowling !== null
    }

    /** 玉を引いて見せてよいか。前の投球中と組み直し中は玉を動かさない。 */
    function canPullBall(): boolean {
      return !flying && !finished && rebuildRemainingMs <= 0 && bowling !== null
    }

    /** 指を離した時点で発射してよいか。 */
    function canLaunchNow(): boolean {
      return !flying && !finished && bowling !== null
    }

    /**
     * 玉の切替（TsumikiBowlingEngineHandle.setBallId）の実処理。
     *
     * canPullBall()と同じ条件でだけ受け付ける。飛行中・組み直し中・結果画面での
     * 呼び出しは黙って無視する（UI側もdisabledにするが、ここでも必ず二重に防ぐ）。
     */
    function applyBallSwitch(nextBallId: BowlingBallId) {
      if (!bowling || !canPullBall()) return
      const changed = setBowlingBall(bowling, RAPIER, nextBallId)
      if (!changed) return
      applyBallVisual(bowling.ballSpec)
      // ドラッグ中ではない（ボタン操作でしか呼ばれない）ので、狙いは常にリセットでよい。
      currentAim = null
      reportAim(null)
    }
    applyBallSwitchRef.current = applyBallSwitch

    /** 組み直し待ちを飛ばして、すぐ次を投げられるようにする。 */
    function skipRebuildWait() {
      if (rebuildRemainingMs <= 0) return
      rebuildRemainingMs = 0
      rebuildStage()
    }

    function attachPointerListeners() {
      if (!renderer) return
      const canvas = renderer.domElement
      let activePointerId: number | null = null
      let startX = 0
      let startY = 0

      const viewportOf = () => {
        const rect = canvas.getBoundingClientRect()
        return {
          width: rect.width || canvas.clientWidth || 1,
          height: rect.height || canvas.clientHeight || 1,
        }
      }

      const onPointerDown = (event: PointerEvent) => {
        if (activePointerId !== null) return
        if (event.pointerType === 'mouse' && event.button !== 0) return
        if (!canStartAim()) return
        activePointerId = event.pointerId
        startX = event.clientX
        startY = event.clientY
        currentAim = null
        if (canPullBall()) reportAim(0)
        try {
          canvas.setPointerCapture(event.pointerId)
        } catch {
          // captureできない環境でも、通常のドラッグはそのまま扱える。
        }
        event.preventDefault()
      }

      const onPointerMove = (event: PointerEvent) => {
        if (activePointerId !== event.pointerId || !bowling) return
        const aim = aimFromDrag(
          { dx: event.clientX - startX, dy: event.clientY - startY },
          viewportOf(),
        )
        currentAim = aim
        // 前の投球中・組み直し中は玉を動かさない（まだ前の投球の位置にいる）。
        if (canPullBall()) {
          parkBall(bowling, aim)
          reportAim(aim.active ? aim.power : 0)
        } else {
          reportAim(null)
        }
        event.preventDefault()
      }

      const finishDrag = (event: PointerEvent, launch: boolean) => {
        if (activePointerId !== event.pointerId) return
        activePointerId = null
        try {
          canvas.releasePointerCapture(event.pointerId)
        } catch {
          // capture していない場合は何もしなくてよい。
        }
        const aim = currentAim
        currentAim = null
        reportAim(null)
        if (!bowling) return
        if (launch && aim && aim.active && canLaunchNow()) {
          // 待たされている途中で離したときは、その場で組み直して即発射する。
          skipRebuildWait()
          startThrow(aim)
          return
        }
        if (canPullBall()) parkBall(bowling, null)
      }

      const onPointerUp = (event: PointerEvent) => finishDrag(event, true)
      const onPointerCancel = (event: PointerEvent) => finishDrag(event, false)

      canvas.addEventListener('pointerdown', onPointerDown)
      canvas.addEventListener('pointermove', onPointerMove)
      canvas.addEventListener('pointerup', onPointerUp)
      canvas.addEventListener('pointercancel', onPointerCancel)
      canvas.addEventListener('lostpointercapture', onPointerCancel)
      detachPointerListeners = () => {
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerup', onPointerUp)
        canvas.removeEventListener('pointercancel', onPointerCancel)
        canvas.removeEventListener('lostpointercapture', onPointerCancel)
      }
    }

    // -----------------------------------------------------------------------
    // 1投の進行
    // -----------------------------------------------------------------------

    function startThrow(aim: LaunchAim) {
      if (!bowling || flying || finished) return
      // 判定の基準はこの投球の直前の姿勢。組み直し直後のごくわずかな沈み込みを
      // 「倒れた」と数えないよう、投球ごとに取り直す。
      tracker = createToppleTracker(readBlockSamples(bowling))
      settle = createSettleState()
      lastBallSpeed = 0
      flying = true
      launchBall(bowling, aim)
      optionsRef.current.onThrowStart(throwIndex + 1)
    }

    function settleThrow() {
      if (!bowling) return
      flying = false
      const toppled = tracker?.count ?? 0
      const throwNumber = throwIndex + 1
      const isLastThrow = throwNumber >= THROWS_PER_GAME
      throwIndex += 1
      if (isLastThrow) {
        finished = true
      } else {
        rebuildRemainingMs = REBUILD_DELAY_MS
      }
      optionsRef.current.onThrowSettled({ throwNumber, toppled, isLastThrow })
    }

    function rebuildStage() {
      if (!bowling) return
      resetForNextThrow(bowling)
      if (tracker) resetToppleTracker(tracker, readBlockSamples(bowling))
      popRemainingMs = REBUILD_POP_MS
    }

    // -----------------------------------------------------------------------
    // 物理と描画
    // -----------------------------------------------------------------------

    function stepPhysics(deltaMs: number) {
      if (!bowling) return
      accumulator += Math.min(deltaMs, MAX_FRAME_DELTA_MS)
      const stepMs = PHYSICS_TIMESTEP * 1000
      let substeps = 0
      while (accumulator >= stepMs && substeps < MAX_PHYSICS_SUBSTEPS) {
        accumulator -= stepMs
        substeps += 1
        bowling.world.step()
        clampBowlingMotion(bowling)
      }
      // 処理が追いつかないときは、たまった時間を捨てて雪だるま式の遅延を防ぐ。
      if (substeps >= MAX_PHYSICS_SUBSTEPS) accumulator = 0
      if (substeps === 0) return

      removeFallenBlocks(bowling)
      parkFallenBall(bowling)
      if (!flying) return

      // 倒れ判定・衝突演出・落ち着き判定は1フレームに1回でよい。
      // どのしきい値も100ms以上なので、物理ステップごとに見ても結果は変わらず、
      // 積み木ぶんの読み出しだけが毎ステップ増える。
      const steppedMs = substeps * stepMs
      if (tracker && updateToppleTracker(tracker, readBlockSamples(bowling), steppedMs) > 0) {
        optionsRef.current.onToppledProgress(tracker.count)
      }

      // 玉の速度が急に落ちたら、何かへ強くぶつかった合図。
      // 重力だけでは1フレームでこれほど速度は変わらないので、衝突だけを拾える。
      if (!ballOutOfPlay(bowling)) {
        const ball = readBall(bowling)
        if (lastBallSpeed - ball.speed >= IMPACT_SPEED_DROP) spawnImpact(ball.position)
        lastBallSpeed = ball.speed
      }

      if (settle && updateSettleState(settle, readSettleSamples(bowling), steppedMs)) {
        settleThrow()
      }
    }

    const guideColor = new THREE.Color()
    /** レーン面へ寝かせるための姿勢。着地点の輪に使う。 */
    const flatOnLane = (() => {
      const tilt = laneTiltQuaternion()
      return new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
        .premultiply(new THREE.Quaternion(tilt.x, tilt.y, tilt.z, tilt.w))
    })()
    const weakColor = new THREE.Color(0xffe066)
    const strongColor = new THREE.Color(0xff3b30)

    function writeVisuals(deltaMs: number) {
      if (!bowling) return

      // 組み直しの「ぽん」と出る演出。
      const popScale =
        popRemainingMs > 0
          ? 0.35 + 0.65 * (1 - popRemainingMs / REBUILD_POP_MS)
          : 1
      if (popRemainingMs > 0) popRemainingMs = Math.max(0, popRemainingMs - deltaMs)

      bowling.blocks.forEach((block, index) => {
        const mesh = blockMeshes[index]
        if (!mesh) return
        const position = block.body.translation()
        const rotation = block.body.rotation()
        mesh.position.set(position.x, position.y, position.z)
        mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
        mesh.scale.setScalar(popScale)
        mesh.visible = !block.removed
      })

      if (ballMesh) {
        const position = bowling.ball.translation()
        const rotation = bowling.ball.rotation()
        ballMesh.position.set(position.x, position.y, position.z)
        ballMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
        ballMesh.visible = !ballOutOfPlay(bowling)
      }

      // 発射ガイド（予測軌道）
      if (guideMaterial && landingRing) {
        const aim = currentAim
        const show = aim !== null && aim.active && canPullBall()
        if (show && aim) {
          const ballPosition = bowling.ball.translation()
          const points = predictTrajectory(
            { x: ballPosition.x, y: ballPosition.y, z: ballPosition.z },
            launchVelocity(aim, bowling.ballSpec),
            {
              gravityY: GRAVITY_Y,
              surfaceY: laneSurfaceY,
              clearance: bowling.ballSpec.radius,
              samples: GUIDE_DOT_COUNT,
              maxTime: 0.9,
            },
          )
          guideDots.forEach((dot, index) => {
            const point = points[index]
            dot.visible = point !== undefined
            if (point) {
              dot.position.set(point.x, point.y, point.z)
              // 手前を大きく、遠くを小さくして進む向きを分かりやすくする。
              dot.scale.setScalar(1 - (index / GUIDE_DOT_COUNT) * 0.45)
            }
          })
          const landing = points[points.length - 1]
          landingRing.visible = landing !== undefined
          if (landing) {
            landingRing.position.set(landing.x, laneSurfaceY(landing.z) + 0.02, landing.z)
            landingRing.quaternion.copy(flatOnLane)
          }
          guideColor.copy(weakColor).lerp(strongColor, aim.power)
          guideMaterial.color.copy(guideColor)
        } else {
          for (const dot of guideDots) dot.visible = false
          landingRing.visible = false
        }
      }

      // 衝撃エフェクト
      for (const slot of impactPool) {
        if (slot.remainingMs <= 0) continue
        slot.remainingMs = Math.max(0, slot.remainingMs - deltaMs)
        const progress = 1 - slot.remainingMs / IMPACT_DURATION_MS
        const material = slot.mesh.material as THREE.MeshBasicMaterial
        material.opacity = Math.max(0, 0.85 * (1 - progress))
        slot.mesh.scale.setScalar(0.6 + progress * 2.6)
        if (camera) slot.mesh.quaternion.copy(camera.quaternion)
        if (slot.remainingMs <= 0) slot.mesh.visible = false
      }

      // カメラの揺れ。固定カメラのまま、当たった瞬間だけ短く揺らす。
      if (camera) {
        if (shakeStrength > 0) {
          shakeStrength = Math.max(0, shakeStrength - deltaMs / SHAKE_DECAY_MS)
          const amount = SHAKE_MAX * shakeStrength * shakeStrength
          camera.position.set(
            cameraBase.x + (Math.random() - 0.5) * 2 * amount,
            cameraBase.y + (Math.random() - 0.5) * 2 * amount,
            cameraBase.z,
          )
          camera.lookAt(cameraTarget)
        } else if (!camera.position.equals(cameraBase)) {
          camera.position.copy(cameraBase)
          camera.lookAt(cameraTarget)
        }
      }
    }

    function tick(now: number) {
      if (released) return
      if (lastFrameTime === null) lastFrameTime = now
      const deltaMs = now - lastFrameTime
      lastFrameTime = now
      const clampedDeltaMs = Math.min(deltaMs, MAX_FRAME_DELTA_MS)

      if (rebuildRemainingMs > 0) {
        rebuildRemainingMs -= clampedDeltaMs
        if (rebuildRemainingMs <= 0) {
          rebuildRemainingMs = 0
          rebuildStage()
        }
      }

      stepPhysics(deltaMs)
      writeVisuals(clampedDeltaMs)
      if (renderer && scene && camera) renderer.render(scene, camera)

      // 3投終わって崩れ切ったら、描画も物理も止めて端末の負荷を0にする。
      // 結果表示を出したまま放置されても、電池を使い続けない。
      if (
        finished &&
        bowling !== null &&
        shakeStrength <= 0 &&
        impactPool.every((slot) => slot.remainingMs <= 0) &&
        readSettleSamples(bowling).every(
          (sample) => sample.linearSpeed < 0.05 && sample.angularSpeed < 0.1,
        )
      ) {
        rafId = null
        return
      }
      rafId = requestAnimationFrame(tick)
    }

    function createSceneGraph(): boolean {
      const container = containerRef.current
      if (!container) return false
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
      } catch {
        // WebGLを持たない環境（テストなど）では3D表示だけを諦める。
        return false
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.shadowMap.enabled = false
      container.appendChild(renderer.domElement)

      scene = new THREE.Scene()
      scene.background = new THREE.Color(0xcfeafc)

      camera = new THREE.PerspectiveCamera(46, 1, 0.1, 80)
      scene.add(new THREE.HemisphereLight(0xffffff, 0x9db4c6, 1.15))
      const sun = new THREE.DirectionalLight(0xffffff, 0.95)
      sun.position.set(3, 8, 6)
      scene.add(sun)

      bowling = createBowlingWorld(RAPIER, { stageId, ballId })
      createLaneMeshes(scene)
      createBlockMeshes(scene, bowling)
      createBallMesh(scene, bowling)
      createGuide(scene)
      createImpactPool(scene)

      resizeRenderer()
      writeVisuals(0)
      renderer.render(scene, camera)
      rafId = requestAnimationFrame(tick)

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => resizeRenderer())
        resizeObserver.observe(container)
      }
      attachViewportListeners()
      attachPointerListeners()
      return true
    }

    void initializeRapier()
      .then(() => {
        // StrictModeの二重実行や素早い「もういちど」で、
        // 古いrunがシーンを作ってしまわないよう必ず確認する。
        if (activeRunRef.current !== runToken || released) return
        createSceneGraph()
      })
      .catch(() => {
        if (activeRunRef.current === runToken) release()
      })

    return release
    // ballIdは意図的に依存配列へ含めない。世界の再構築（=積み木・投球数のリセット）は
    // runId/stageIdだけで起こし、毎投の玉切替はapplyBallSwitchRef経由で行う。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, stageId])

  return handle
}
