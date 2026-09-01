import { useEffect, useMemo, useRef } from 'react'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import {
  createKomaBattleSoundController,
  type KomaBattleImpactSoundKind,
} from '../../utils/quizSound'
import {
  DISK_CENTER_Y,
  DISK_HALF_HEIGHT,
  DISK_RADIUS,
  MAX_FRAME_DELTA_MS,
  MAX_PHYSICS_SUBSTEPS,
  PHYSICS_TIMESTEP,
  SHAFT_RADIUS,
  START_SPIN_VARIANCE,
} from './komaPhysics'

/**
 * 決着してから物理を続ける時間。
 * 倒れ切るところまで見せたら、描画も物理も止めて端末の負荷を0にする。
 */
const SETTLE_AFTER_FINISH_MS = 2500

/**
 * この試合ぶんの初速倍率を決める。
 *
 * 2個の差を独立な乱数にすると、たまたま差がほぼ0になった試合が
 * 「同時に力尽きて引き分け」になってしまう。
 * そこで片方を速く・もう片方を同じだけ遅くし、必ず意味のある差がつくようにする。
 * どちらが速いかは毎回入れ替わるので、再戦のたびに結果は変わる。
 */
function createSpinScales(count: number): number[] {
  if (count < 2) return [1]
  const magnitude = START_SPIN_VARIANCE * (0.6 + Math.random() * 0.4)
  const favored = Math.random() < 0.5 ? 0 : 1
  return Array.from({ length: count }, (_, index) =>
    index === favored ? 1 + magnitude : 1 - magnitude,
  )
}
import {
  BOWL_RADIUS,
  BUMPER_HEIGHT,
  BUMPER_RADIUS,
  createWallSegments,
  FIELD_RADIUS,
  fieldHeightAt,
  getKomaField,
  WALL_INNER_RADIUS,
  WALL_SEGMENTS,
  WALL_THICKNESS,
  wallGapMarkers,
  wallGapSegmentIndices,
  type KomaFieldId,
} from './komaStadium'
import { komaCameraSetup } from './komaCamera'
import type { KomaSpec } from './komaSpecs'
import {
  applyKomaAssist,
  applyKomaBoost,
  applyKomaContactAssist,
  clampKomaMotion,
  createKomaBattleWorld,
  readKoma,
  type KomaBattleWorld,
} from './komaWorld'
import { STABLE_SPIN_SPEED } from './komaSpin'
import {
  createKomaJudgeState,
  decideMatchOutcome,
  STOP_SPIN_SPEED,
  updateKomaJudge,
  type KomaJudgeState,
  type MatchOutcome,
} from './komaOutcome'
import {
  createKomaImpactThrottle,
  impactIntensityForRelativeSpeed,
} from './komaImpact'
import { findNearestKomaTapTarget } from './komaTapTarget'

let rapierInitPromise: Promise<void> | null = null

/** Rapierのwasm初期化はモジュール内で一度だけ行い、再戦や再入場で共有する。 */
function initializeRapier(): Promise<void> {
  if (rapierInitPromise === null) rapierInitPromise = RAPIER.init()
  return rapierInitPromise
}

export type KomaBattleEngineOptions = {
  /** 値が変わったら世界を作り直す（もういちど）。 */
  runId: number
  /** 出場するコマの数。1か2。 */
  komaCount: number
  /** 選択画面で決めたコマ。エンジン側で既定値へ差し替えない。 */
  specs: readonly KomaSpec[]
  /** 選択中のフィールド。世界と見た目は同じ定義を読む。 */
  fieldId?: KomaFieldId
  /** 決着したときに一度だけ呼ばれる。 */
  onFinished: (outcome: MatchOutcome) => void
}

export type KomaBattleEngineHandle = {
  registerContainer: (element: HTMLDivElement | null) => void
}

// ---------------------------------------------------------------------------
// 回転演出。物理のしきい値定数と揃え、判定上「速い/止まった」と表示が食い違わないようにする。
// ---------------------------------------------------------------------------

/** ここまで速いと回転演出（光るリング・ハイライト）が最大になる。安定して自立できる速度と同じ。 */
const SPIN_EFFECT_FULL_SPEED = STABLE_SPIN_SPEED
/** ここを下回ると演出は完全に0になる。停止判定と同じ速度なので、止まったコマにリングが残らない。 */
const SPIN_EFFECT_FLOOR_SPEED = STOP_SPIN_SPEED

// ---------------------------------------------------------------------------
// 衝突演出。強い衝突のときだけ、短時間で消えるリングを出す。
// ---------------------------------------------------------------------------

/** 同時に表示できる衝突エフェクトの最大数。連続衝突でも無制限に増やさないための上限。 */
const IMPACT_POOL_SIZE = 3
/** 1回の衝突エフェクトの寿命[ms]。 */
const IMPACT_DURATION_MS = 260
/** 物理Colliderの境界より少し外側で接触演出を拾う余裕。 */
const IMPACT_CONTACT_MARGIN = 0.03

// ---------------------------------------------------------------------------
// 直接タップブースト。ゲーム上の待ち時間ではなく、同一入力の多重発火だけを防ぐ。
// ---------------------------------------------------------------------------

/** スマホでは見た目より十分広く、PCでは過剰に広がらない画面上のヒット半径[px]。 */
const KOMA_TAP_HIT_RADIUS_MIN_PX = 44
const KOMA_TAP_HIT_RADIUS_MAX_PX = 64
/** 指を少し動かしてもタップとして扱うが、明確なスワイプは誤発火させない。 */
const KOMA_TAP_MAX_MOVEMENT_PX = 24
const KOMA_TAP_MAX_DURATION_MS = 700
/** pointer/click重複や同一フレーム付近の多重入力だけをまとめる、ごく短いガード。 */
const KOMA_TAP_DUPLICATE_GUARD_MS = 36
/** タップ対象を示す発光リングの寿命。 */
const BOOST_EFFECT_DURATION_MS = 380

type ImpactSlot = {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  remainingMs: number
  maxOpacity: number
  startScale: number
}

type KomaVisual = {
  group: THREE.Group
  /** 毎フレーム、その時点の自転速度で回転演出を更新する。 */
  updateSpin: (spinSpeedAbs: number, dtMs: number) => void
  /** タップ対象だけへ、使い回しの発光リングと短い光量変化を出す。 */
  triggerBoost: () => void
  /** 決着後に勝者だけを少し強調する。物理Bodyの姿勢は変更しない。 */
  setOutcome: (isWinner: boolean | null) => void
}

/** 見た目Meshで使い回すgeometry一式。コマごとに寸法は同じなので、色違いのMaterialだけを分ける。 */
type KomaGeometrySet = {
  tip: THREE.ConeGeometry
  shaft: THREE.CylinderGeometry
  diskLower: THREE.CylinderGeometry
  diskUpper: THREE.CylinderGeometry
  groove: THREE.TorusGeometry
  outerRing: THREE.TorusGeometry
  cap: THREE.SphereGeometry
  knob: THREE.SphereGeometry
  spinRing: THREE.RingGeometry
  boostRing: THREE.RingGeometry
  diskHalfHeight: number
}

/**
 * Three.jsとRapierをuseEffectの中だけで動かす命令的エンジン。
 *
 * 既存の3Dゲーム（こっきころころめいろ・ドミノ）と同じ作りにしてある。
 * 毎フレームの物理・描画はReactのstateをいっさい触らず、
 * 決着したときだけ onFinished を1回呼ぶ。これでフレームごとの再レンダーが起きない。
 */
export function useKomaBattleEngine(
  options: KomaBattleEngineOptions,
): KomaBattleEngineHandle {
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const containerRef = useRef<HTMLDivElement | null>(null)
  const activeRunRef = useRef<symbol | null>(null)

  const handle = useMemo<KomaBattleEngineHandle>(
    () => ({
      registerContainer: (element) => {
        containerRef.current = element
      },
    }),
    [],
  )

  useEffect(() => {
    const runToken = Symbol('koma-battle-run')
    activeRunRef.current = runToken

    const specs = options.specs
    const selectedField = getKomaField(options.fieldId)

    let battle: KomaBattleWorld | null = null
    let scene: THREE.Scene | null = null
    let camera: THREE.PerspectiveCamera | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let resizeObserver: ResizeObserver | null = null
    let detachViewportListeners: (() => void) | null = null
    let detachPointerListeners: (() => void) | null = null
    let rafId: number | null = null
    let released = false
    let finished = false
    let settleRemainingMs = 0
    let lastFrameTime: number | null = null
    let accumulator = 0
    let elapsedMs = 0
    let judgeStates: KomaJudgeState[] = specs.map(() => createKomaJudgeState())
    let impactCursor = 0
    const activeImpactContacts = new Set<string>()
    const impactThrottle = createKomaImpactThrottle()
    const soundController = createKomaBattleSoundController()
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const komaVisuals: KomaVisual[] = []
    const shadowBlobs: THREE.Mesh[] = []
    const impactPool: ImpactSlot[] = []
    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []

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

      soundController.dispose()
      impactThrottle.reset()
      activeImpactContacts.clear()

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
      komaVisuals.length = 0
      shadowBlobs.length = 0
      impactPool.length = 0

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
      if (battle !== null) {
        battle.world.free()
        battle = null
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
      camera.aspect = width / height
      applyCamera()
      camera.updateProjectionMatrix()
      // 第3引数false: canvasへ幅高さのインラインstyleを書かせず、表示サイズはCSSに任せる。
      renderer.setSize(width, height, false)
    }

    const cameraTarget = new THREE.Vector3()

    /** 固定カメラ。画面比が変わったときだけ位置を計算し直す。 */
    function applyCamera() {
      if (!camera) return
      const setup = komaCameraSetup(camera.aspect)
      camera.position.set(setup.position.x, setup.position.y, setup.position.z)
      cameraTarget.set(setup.target.x, setup.target.y, setup.target.z)
      camera.lookAt(cameraTarget)
    }

    function attachViewportListeners() {
      if (typeof window === 'undefined') return
      const handleViewportChange = () => resizeRenderer()
      const orientation = window.screen?.orientation

      window.addEventListener('resize', handleViewportChange)
      window.addEventListener('orientationchange', handleViewportChange)
      orientation?.addEventListener?.('change', handleViewportChange)
      window.visualViewport?.addEventListener('resize', handleViewportChange)
      const handleVisibilityChange = () => {
        soundController.setSuspended(document.visibilityState === 'hidden')
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)

      detachViewportListeners = () => {
        window.removeEventListener('resize', handleViewportChange)
        window.removeEventListener('orientationchange', handleViewportChange)
        orientation?.removeEventListener?.('change', handleViewportChange)
        window.visualViewport?.removeEventListener('resize', handleViewportChange)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }

    function attachPointerListeners() {
      if (!renderer) return
      const canvas = renderer.domElement
      const pointerStarts = new Map<
        number,
        { x: number; y: number; at: number }
      >()
      const lastBoostAt = specs.map(() => Number.NEGATIVE_INFINITY)
      const projectedCenter = new THREE.Vector3()
      const bodyQuaternion = new THREE.Quaternion()

      const onPointerDown = (event: PointerEvent) => {
        if (finished || (event.pointerType === 'mouse' && event.button !== 0)) return
        pointerStarts.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
          at: event.timeStamp,
        })
        try {
          canvas.setPointerCapture(event.pointerId)
        } catch {
          // 古いSafari等でcaptureできなくても、canvas上の通常タップはそのまま扱える。
        }
      }

      const forgetPointer = (event: PointerEvent) => {
        pointerStarts.delete(event.pointerId)
      }

      const onPointerUp = (event: PointerEvent) => {
        const start = pointerStarts.get(event.pointerId)
        pointerStarts.delete(event.pointerId)
        if (!start || finished || battle === null || camera === null) return
        if (
          Math.hypot(event.clientX - start.x, event.clientY - start.y) >
            KOMA_TAP_MAX_MOVEMENT_PX ||
          event.timeStamp - start.at > KOMA_TAP_MAX_DURATION_MS
        ) {
          return
        }

        const rect = canvas.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return
        const activeBattle = battle
        const activeCamera = camera
        const targets = activeBattle.komas.flatMap((koma, index) => {
          const translation = koma.body.translation()
          const rotation = koma.body.rotation()
          bodyQuaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
          projectedCenter
            .set(0, DISK_CENTER_Y, 0)
            .applyQuaternion(bodyQuaternion)
          projectedCenter.set(
            projectedCenter.x + translation.x,
            projectedCenter.y + translation.y,
            projectedCenter.z + translation.z,
          ).project(activeCamera)
          if (
            !Number.isFinite(projectedCenter.x) ||
            !Number.isFinite(projectedCenter.y) ||
            projectedCenter.z < -1 ||
            projectedCenter.z > 1
          ) {
            return []
          }
          return [{
            index,
            x: rect.left + ((projectedCenter.x + 1) / 2) * rect.width,
            y: rect.top + ((1 - projectedCenter.y) / 2) * rect.height,
          }]
        })
        const hitRadius = THREE.MathUtils.clamp(
          rect.width * 0.135,
          KOMA_TAP_HIT_RADIUS_MIN_PX,
          KOMA_TAP_HIT_RADIUS_MAX_PX,
        )
        const targetIndex = findNearestKomaTapTarget(
          { x: event.clientX, y: event.clientY },
          targets,
          hitRadius,
        )
        if (targetIndex === null) return

        // ごく近い多重pointerイベントだけをまとめる。通常の連打には毎回反応する。
        if (event.timeStamp - lastBoostAt[targetIndex]! < KOMA_TAP_DUPLICATE_GUARD_MS) return
        lastBoostAt[targetIndex] = event.timeStamp
        const target = activeBattle.komas[targetIndex]
        const visual = komaVisuals[targetIndex]
        if (!target || !visual) return

        applyKomaBoost(target)
        visual.triggerBoost()
        soundController.playBoost()
        // 次のanimation frameを待たず、タップイベント内で最初の1枚を即座に返す。
        writeVisuals(0)
        if (renderer && scene && camera) renderer.render(scene, camera)
      }

      canvas.addEventListener('pointerdown', onPointerDown)
      canvas.addEventListener('pointerup', onPointerUp)
      canvas.addEventListener('pointercancel', forgetPointer)
      canvas.addEventListener('lostpointercapture', forgetPointer)
      detachPointerListeners = () => {
        pointerStarts.clear()
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointerup', onPointerUp)
        canvas.removeEventListener('pointercancel', forgetPointer)
        canvas.removeEventListener('lostpointercapture', forgetPointer)
      }
    }

    /**
     * コマの見た目Meshが使うgeometryをタイプごとに1組作る。
     * 同じタイプ同士ではセットを使い回し、タイプ数が増えても人数ぶんに増やさない。
     */
    function createKomaGeometrySet(visual: KomaSpec['type']['visual']): KomaGeometrySet {
      const diskRadius = DISK_RADIUS * visual.diskRadiusScale
      const diskHalfHeight = DISK_HALF_HEIGHT * visual.diskThicknessScale
      return {
        // 軸/先端。物理では球+円柱だが、見た目は下向きの円錐にして「コマの軸」に見せる。
        tip: track(new THREE.ConeGeometry(SHAFT_RADIUS * 1.3, DISK_CENTER_Y - diskHalfHeight, 12)),
        // 持ち手の軸。Colliderは持たせず見た目だけ。倒れたときの傾きが分かりやすくなる。
        shaft: track(new THREE.CylinderGeometry(SHAFT_RADIUS * 0.55, SHAFT_RADIUS * 0.6, 0.14, 10)),
        // 円盤下段。樹脂パーツの土台。
        diskLower: track(
          new THREE.CylinderGeometry(
            diskRadius * 0.86,
            diskRadius * 0.66,
            diskHalfHeight * 1.6,
            24,
          ),
        ),
        // 円盤上段。下段よりわずかに大きくして段差(パネル分割)を作る。
        diskUpper: track(
          new THREE.CylinderGeometry(
            diskRadius * visual.upperTopScale,
            diskRadius * visual.upperBottomScale,
            diskHalfHeight * 1.66,
            24,
          ),
        ),
        // 上下段の継ぎ目に入れる溝。上段の最小半径(0.9)よりわずかに大きくして、
        // 上段の表面に埋もれず外へ突き出すようにする（段差として実際に見えるように）。
        groove: track(new THREE.TorusGeometry(diskRadius * 0.93, diskRadius * 0.02, 6, 28)),
        // 外周リング。円盤の縁いっぱいに巻く金属風パーツ。
        outerRing: track(
          new THREE.TorusGeometry(
            diskRadius * 0.99,
            diskRadius * 0.1 * visual.ringScale,
            8,
            28,
          ),
        ),
        // 中心キャップ。上面の飾りで、回っていることが上から見て分かるようにする。
        cap: track(
          new THREE.SphereGeometry(
            diskRadius * 0.34 * visual.capScale,
            14,
            8,
            0,
            Math.PI * 2,
            0,
            Math.PI / 2,
          ),
        ),
        knob: track(new THREE.SphereGeometry(SHAFT_RADIUS * 0.8 * visual.knobScale, 10, 8)),
        // 回転演出用の半透明リング。高速回転中だけ光る。
        spinRing: track(
          new THREE.RingGeometry(diskRadius * 1.15, diskRadius * 1.42, 28),
        ),
        // タップ時だけ一瞬広がるリング。常時描画せず、コマごとに1個を使い回す。
        boostRing: track(
          new THREE.RingGeometry(diskRadius * 1.18, diskRadius * 1.72, 32),
        ),
        diskHalfHeight,
      }
    }

    /**
     * 見た目のコマ。物理Colliderとは別に、幼児が「コマ」と分かる形を組む。
     *
     * 中心キャップ・樹脂の円盤(2段)・外周リング(金属風)・軸/先端(金属風)の4層構成にし、
     * 材質もMeshStandardMaterialで樹脂/金属/マットを塗り分ける。
     * 高速回転中は上面のつまみが自転速度に応じて光り、円盤の外側に半透明のリングが浮かぶ。
     * どちらも自転速度の低下にあわせてそのまま弱まるので、専用の減衰処理は持たない。
     */
    function createKomaMesh(spec: KomaSpec, geometrySet: KomaGeometrySet): KomaVisual {
      const group = new THREE.Group()
      const { diskHalfHeight } = geometrySet

      // 樹脂パーツ。円盤の主要部分で、コマの識別色(spec.color)を持つ。
      const resinMaterial = trackMaterial(
        new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.55, metalness: 0.05 }),
      )
      // 金属風。軸・先端・外周リングに使い、樹脂との質感差を出す。
      const metalMaterial = trackMaterial(
        new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.3, metalness: 0.6 }),
      )
      // マット素材風。中心キャップに使う。
      const matteMaterial = trackMaterial(
        new THREE.MeshStandardMaterial({ color: spec.accentColor, roughness: 0.92, metalness: 0 }),
      )
      // 上下段の継ぎ目の溝。ごく暗い色で段差を強調する。
      const seamMaterial = trackMaterial(
        new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.8, metalness: 0.1 }),
      )
      // 上部のつまみ。回転速度に応じて自己発光させ、速く回っているほど光って見える。
      const accentMaterial = trackMaterial(
        new THREE.MeshStandardMaterial({
          color: spec.accentColor,
          roughness: 0.35,
          metalness: 0.15,
          emissive: new THREE.Color(spec.accentColor),
          emissiveIntensity: 0,
        }),
      )
      const spinRingMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: spec.accentColor,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      const boostRingMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: spec.accentColor,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      let outcomeEmphasis: 'winner' | 'loser' | null = null
      let boostRemainingMs = 0

      const tip = new THREE.Mesh(geometrySet.tip, metalMaterial)
      tip.rotation.x = Math.PI
      tip.position.y = (DISK_CENTER_Y - diskHalfHeight) / 2
      group.add(tip)

      const diskLower = new THREE.Mesh(geometrySet.diskLower, resinMaterial)
      diskLower.position.y = DISK_CENTER_Y - diskHalfHeight * 0.5
      group.add(diskLower)

      const diskUpperCenterY = DISK_CENTER_Y + diskHalfHeight * 0.45
      const diskUpper = new THREE.Mesh(geometrySet.diskUpper, resinMaterial)
      diskUpper.position.y = diskUpperCenterY
      group.add(diskUpper)

      // 溝は上段の下端（=いちばん細い場所）に合わせる。ここなら上下どちらの円盤の
      // 表面にも埋もれず、実際に段差として突き出して見える。
      const groove = new THREE.Mesh(geometrySet.groove, seamMaterial)
      groove.rotation.x = Math.PI / 2
      groove.position.y = diskUpperCenterY - (diskHalfHeight * 1.66) / 2
      group.add(groove)

      const outerRing = new THREE.Mesh(geometrySet.outerRing, metalMaterial)
      outerRing.rotation.x = Math.PI / 2
      outerRing.position.y = DISK_CENTER_Y + diskHalfHeight * 0.3
      group.add(outerRing)

      const cap = new THREE.Mesh(geometrySet.cap, matteMaterial)
      cap.position.y = DISK_CENTER_Y + diskHalfHeight + 0.02
      group.add(cap)

      const shaft = new THREE.Mesh(geometrySet.shaft, metalMaterial)
      shaft.position.y = DISK_CENTER_Y + diskHalfHeight + 0.1
      group.add(shaft)

      const knob = new THREE.Mesh(geometrySet.knob, accentMaterial)
      knob.position.y = DISK_CENTER_Y + diskHalfHeight + 0.19
      group.add(knob)

      const spinRing = new THREE.Mesh(geometrySet.spinRing, spinRingMaterial)
      spinRing.rotation.x = -Math.PI / 2
      spinRing.position.y = DISK_CENTER_Y
      group.add(spinRing)

      const boostRing = new THREE.Mesh(geometrySet.boostRing, boostRingMaterial)
      boostRing.rotation.x = -Math.PI / 2
      boostRing.position.y = DISK_CENTER_Y + 0.025
      boostRing.visible = false
      boostRing.renderOrder = 4
      group.add(boostRing)

      function updateSpin(spinSpeedAbs: number, dtMs: number) {
        const ratio = THREE.MathUtils.clamp(
          (spinSpeedAbs - SPIN_EFFECT_FLOOR_SPEED) / (SPIN_EFFECT_FULL_SPEED - SPIN_EFFECT_FLOOR_SPEED),
          0,
          1,
        )
        spinRingMaterial.opacity = Math.min(
          0.72,
          ratio * 0.4 + (outcomeEmphasis === 'winner' ? 0.18 : 0),
        )
        const boostRatio = Math.max(0, boostRemainingMs / BOOST_EFFECT_DURATION_MS)
        accentMaterial.emissiveIntensity = Math.max(
          ratio * 0.6,
          boostRatio * 1.35,
          outcomeEmphasis === 'winner' ? 0.8 : outcomeEmphasis === 'loser' ? 0.05 : 0,
        )
        // リングは本体よりわずかに速く自転させ、残像のような「滑り」を出す。
        spinRing.rotation.y += (dtMs / 1000) * spinSpeedAbs * 0.5

        if (boostRemainingMs > 0) {
          boostRemainingMs = Math.max(0, boostRemainingMs - dtMs)
          const progress = 1 - boostRemainingMs / BOOST_EFFECT_DURATION_MS
          boostRing.visible = boostRemainingMs > 0
          boostRingMaterial.opacity = (1 - progress) * 0.92
          const scale = prefersReducedMotion ? 1.12 : 0.82 + progress * 0.78
          boostRing.scale.setScalar(scale)
        } else if (boostRing.visible) {
          boostRing.visible = false
          boostRingMaterial.opacity = 0
        }
      }

      function triggerBoost() {
        boostRemainingMs = BOOST_EFFECT_DURATION_MS
        boostRing.visible = true
        boostRing.scale.setScalar(prefersReducedMotion ? 1.12 : 0.82)
        boostRingMaterial.opacity = 0.92
      }

      function setOutcome(isWinner: boolean | null) {
        outcomeEmphasis = isWinner === null ? null : isWinner ? 'winner' : 'loser'
        group.scale.setScalar(isWinner === true ? 1.12 : isWinner === false ? 0.94 : 1)
      }

      return { group, updateSpin, triggerBoost, setOutcome }
    }

    /** すり鉢の見た目。物理の高さ場と同じ profile 関数から作る。 */
    function createStadiumMesh(): THREE.Group {
      const group = new THREE.Group()

      // フィールド定義と同じ高さ関数から断面を作り、回転させてすり鉢にする。
      const profile: THREE.Vector2[] = []
      const steps = 28
      for (let index = 0; index <= steps; index += 1) {
        const radius = (index / steps) * BOWL_RADIUS
        profile.push(new THREE.Vector2(radius, fieldHeightAt(selectedField, radius)))
      }
      // 縁から外側の平らな踏みしろまで続ける。
      profile.push(new THREE.Vector2(FIELD_RADIUS, 0))

      // 樹脂製玩具らしい、ほどよい光沢のマット面にする。
      const floor = new THREE.Mesh(
        track(new THREE.LatheGeometry(profile, 48)),
        trackMaterial(
          new THREE.MeshStandardMaterial({
            color: selectedField.theme.floor,
            roughness: 0.65,
            metalness: 0.02,
            side: THREE.DoubleSide,
          }),
        ),
      )
      group.add(floor)

      // 中央の目印。すり鉢の谷がどこかを上からでも分かりやすくする。
      const centerMark = new THREE.Mesh(
        track(new THREE.RingGeometry(0.26, 0.34, 32)),
        trackMaterial(
          new THREE.MeshBasicMaterial({ color: selectedField.theme.accent, side: THREE.DoubleSide }),
        ),
      )
      centerMark.rotation.x = -Math.PI / 2
      centerMark.position.y = fieldHeightAt(selectedField, 0.3) + 0.005
      group.add(centerMark)

      // 外周壁。物理と同じ配置・寸法のcuboidを並べる。開口部（wallGaps）は物理と同じ
      // セグメント番号を読むので、見た目だけ開口して物理壁が残る/その逆は起きない。
      const wallMaterial = trackMaterial(
        new THREE.MeshStandardMaterial({ color: selectedField.theme.wall, roughness: 0.55, metalness: 0.05 }),
      )
      const rimMaterial = trackMaterial(
        new THREE.MeshStandardMaterial({ color: selectedField.theme.rim, roughness: 0.4, metalness: 0.35 }),
      )
      const wallGeometry = track(new THREE.BoxGeometry(1, 1, 1))
      const wallGapIndices = wallGapSegmentIndices(selectedField.wallGaps, WALL_SEGMENTS)
      const wallSegments = createWallSegments(undefined, selectedField.wallHeight, wallGapIndices)
      for (const segment of wallSegments) {
        const wall = new THREE.Mesh(wallGeometry, wallMaterial)
        wall.position.set(segment.center.x, segment.center.y, segment.center.z)
        wall.rotation.y = segment.yaw
        wall.scale.set(segment.halfWidth * 2, segment.halfHeight * 2, segment.halfDepth * 2)
        group.add(wall)

        // 壁の上端の縁取り。壁が無いセグメントには置かないので、開口部だけ
        // 縁取りが途切れ、そこが安全な壁でないことが上から見ても分かる。
        const rimCap = new THREE.Mesh(wallGeometry, rimMaterial)
        rimCap.position.set(
          segment.center.x,
          selectedField.wallHeight + 0.02,
          segment.center.z,
        )
        rimCap.rotation.y = segment.yaw
        rimCap.scale.set(segment.halfWidth * 2.05, 0.05, segment.halfDepth * 2.6)
        group.add(rimCap)
      }

      // 開口部の床マーカー。壁の代わりに、注意色の縞模様を床へ直接敷く。
      // 「ここから落ちそう」を文字なしで伝えるための唯一の説明手段なので、
      // 物理の開口（wallGapIndices）と必ず同じ位置・同じ幅にしてある。
      // フィールドのテーマ色に合わせず、注意色そのもの（黄×黒）で揃える。
      // テーマのaccent色は床の色と近く馴染んでしまうフィールドがあり、
      // 「危険」だと伝える役目は薄い色より確実な警戒色を優先する。
      const hazardAccentMaterial = trackMaterial(
        new THREE.MeshStandardMaterial({ color: 0xffcc33, roughness: 0.45, metalness: 0.05 }),
      )
      const hazardDarkMaterial = trackMaterial(
        new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.8, metalness: 0.1 }),
      )
      const hazardRadialSpan = FIELD_RADIUS - WALL_INNER_RADIUS
      const hazardRadius = (WALL_INNER_RADIUS + FIELD_RADIUS) / 2
      const hazardHalfWidth = wallSegments[0]?.halfWidth ?? Math.tan(Math.PI / WALL_SEGMENTS) * hazardRadius
      for (const marker of wallGapMarkers(wallGapIndices, WALL_SEGMENTS)) {
        const stripe = new THREE.Mesh(
          wallGeometry,
          marker.index % 2 === 0 ? hazardAccentMaterial : hazardDarkMaterial,
        )
        // 段差として少し盛り上がった縁石に見せる。壁の代わりに「ここで区切れている」と分かる高さ。
        const stripeHeight = 0.03
        stripe.position.set(
          Math.cos(marker.angle) * hazardRadius,
          fieldHeightAt(selectedField, hazardRadius) + stripeHeight / 2,
          Math.sin(marker.angle) * hazardRadius,
        )
        stripe.rotation.y = Math.PI / 2 - marker.angle
        stripe.scale.set(hazardHalfWidth * 1.9, stripeHeight, hazardRadialSpan + WALL_THICKNESS)
        group.add(stripe)
      }

      // バンパーは共有geometry/materialで描く。物理側も同じ位置・寸法の固定Colliderを持つが、
      // 見た目のMeshへColliderを付けることはしない（再戦時の重複と負荷を防ぐ）。
      if (selectedField.obstacles.length > 0) {
        const bumperMaterial = trackMaterial(
          new THREE.MeshStandardMaterial({
            color: selectedField.theme.accent,
            roughness: 0.38,
            metalness: 0.08,
          }),
        )
        const bumperGeometry = track(new THREE.CylinderGeometry(BUMPER_RADIUS, BUMPER_RADIUS, BUMPER_HEIGHT, 20))
        const bumperCapGeometry = track(new THREE.SphereGeometry(BUMPER_RADIUS * 0.73, 16, 8))
        for (const obstacle of selectedField.obstacles) {
          if (obstacle.type !== 'bumper') continue
          const radius = Number.isFinite(obstacle.radius) ? Math.max(0.08, obstacle.radius) : BUMPER_RADIUS
          const height = Number.isFinite(obstacle.height) ? Math.max(0.12, obstacle.height) : BUMPER_HEIGHT
          const floorY = fieldHeightAt(selectedField, Math.hypot(obstacle.x, obstacle.z))
          const bumper = new THREE.Mesh(bumperGeometry, bumperMaterial)
          bumper.scale.set(radius / BUMPER_RADIUS, height / BUMPER_HEIGHT, radius / BUMPER_RADIUS)
          bumper.position.set(obstacle.x, floorY + height / 2, obstacle.z)
          group.add(bumper)
          const cap = new THREE.Mesh(bumperCapGeometry, bumperMaterial)
          cap.scale.setScalar(radius / BUMPER_RADIUS)
          cap.position.set(obstacle.x, floorY + height + 0.02, obstacle.z)
          group.add(cap)
        }
      }

      return group
    }

    /**
     * 衝突エフェクトのプール。事前にIMPACT_POOL_SIZE個だけ作って使い回し、
     * 対戦中に新しいgeometry/materialを作らない。連続衝突でも増え続けない。
     */
    function createImpactPool() {
      if (scene === null) return
      const geometry = track(new THREE.RingGeometry(0.7, 1, 24))
      for (let index = 0; index < IMPACT_POOL_SIZE; index += 1) {
        const material = trackMaterial(
          new THREE.MeshBasicMaterial({
            color: 0xfff0c2,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        )
        const mesh = new THREE.Mesh(geometry, material)
        mesh.rotation.x = -Math.PI / 2
        mesh.visible = false
        mesh.scale.setScalar(0.001)
        mesh.renderOrder = 3
        scene.add(mesh)
        impactPool.push({ mesh, material, remainingMs: 0, maxOpacity: 0, startScale: 0 })
      }
    }

    /** 強い衝突の瞬間だけ、プールから1枠を借りて光らせる。 */
    function triggerImpactEffect(
      position: { x: number; y: number; z: number },
      intensity: number,
      kind: KomaBattleImpactSoundKind,
    ) {
      if (impactPool.length === 0) return
      const slot = impactPool[impactCursor]!
      impactCursor = (impactCursor + 1) % impactPool.length
      slot.mesh.position.set(position.x, position.y, position.z)
      slot.mesh.visible = true
      const safeIntensity = Math.min(1, Math.max(0, intensity))
      slot.startScale = 0.22 + safeIntensity * (kind === 'koma' ? 0.42 : 0.3)
      slot.mesh.scale.setScalar(slot.startScale)
      slot.material.color.set(kind === 'bumper' ? 0x9be7ff : kind === 'wall' ? 0xffd48a : 0xfff0c2)
      slot.maxOpacity = 0.25 + safeIntensity * 0.6
      slot.material.opacity = slot.maxOpacity
      slot.remainingMs = IMPACT_DURATION_MS
    }

    /** 有効なエフェクトの寿命を進め、消えたら非表示に戻す。新しいオブジェクトは作らない。 */
    function updateImpactEffects(dtMs: number) {
      for (const slot of impactPool) {
        if (slot.remainingMs <= 0) continue
        slot.remainingMs -= dtMs
        if (slot.remainingMs <= 0) {
          slot.mesh.visible = false
          slot.material.opacity = 0
          slot.maxOpacity = 0
          slot.startScale = 0
          continue
        }
        const t = 1 - slot.remainingMs / IMPACT_DURATION_MS
        slot.mesh.scale.setScalar(slot.startScale + t * 0.5)
        slot.material.opacity = slot.maxOpacity * (1 - t)
      }
    }

    /**
     * 物理ステップ直後の接触を「接触開始」へまとめ、強度に応じて音とリングを出す。
     * 同一Body/障害物ペアと全体の両方にthrottleをかけるため、接触中の連打を防ぐ。
     */
    function checkImpacts() {
      if (battle === null) return

      function inspectContact(
        key: string,
        inContact: boolean,
        relativeSpeed: number,
        position: { x: number; y: number; z: number },
        kind: KomaBattleImpactSoundKind,
      ) {
        if (!inContact) {
          activeImpactContacts.delete(key)
          return
        }
        if (activeImpactContacts.has(key)) return
        activeImpactContacts.add(key)

        const intensity = impactIntensityForRelativeSpeed(relativeSpeed)
        if (intensity <= 0 || !impactThrottle.tryEmit(key, elapsedMs)) return
        if (!prefersReducedMotion) triggerImpactEffect(position, intensity, kind)
        soundController.playImpact(kind, intensity)
      }

      if (battle.komas.length === 2) {
        const [a, b] = battle.komas
        const ta = a!.body.translation()
        const tb = b!.body.translation()
        const radiusA = DISK_RADIUS * a!.spec.type.visual.diskRadiusScale
        const radiusB = DISK_RADIUS * b!.spec.type.visual.diskRadiusScale
        const inContact =
          Math.hypot(ta.x - tb.x, ta.z - tb.z) <= radiusA + radiusB + IMPACT_CONTACT_MARGIN
        const va = a!.body.linvel()
        const vb = b!.body.linvel()
        inspectContact(
          'koma:0-1',
          inContact,
          Math.hypot(va.x - vb.x, va.y - vb.y, va.z - vb.z),
          {
            x: (ta.x + tb.x) / 2,
            y: Math.max(ta.y, tb.y) + DISK_CENTER_Y,
            z: (ta.z + tb.z) / 2,
          },
          'koma',
        )
      }

      battle.komas.forEach((koma, komaIndex) => {
        const translation = koma.body.translation()
        const reading = readKoma(koma)
        const diskRadius = DISK_RADIUS * koma.spec.type.visual.diskRadiusScale
        selectedField.obstacles.forEach((obstacle, obstacleIndex) => {
          const distance = Math.hypot(
            translation.x - obstacle.x,
            translation.z - obstacle.z,
          )
          const inContact = distance <= diskRadius + obstacle.radius + IMPACT_CONTACT_MARGIN
          const velocity = koma.body.linvel()
          const rimSpeed = Math.abs(reading.spinSpeed) * diskRadius * 0.05
          inspectContact(
            `bumper:${komaIndex}:${obstacleIndex}`,
            inContact,
            Math.hypot(velocity.x, velocity.y, velocity.z) + rimSpeed,
            {
              x: (translation.x + obstacle.x) / 2,
              y: translation.y + DISK_CENTER_Y,
              z: (translation.z + obstacle.z) / 2,
            },
            obstacle.type === 'bumper' ? 'bumper' : 'wall',
          )
        })

        const wallContact = reading.radius >= WALL_INNER_RADIUS - diskRadius * 0.8
        const wallVelocity = koma.body.linvel()
        inspectContact(
          `wall:${komaIndex}`,
          wallContact,
          Math.hypot(wallVelocity.x, wallVelocity.y, wallVelocity.z) +
            Math.abs(reading.spinSpeed) * diskRadius * 0.04,
          { x: translation.x, y: translation.y + DISK_CENTER_Y, z: translation.z },
          'wall',
        )
      })
    }

    function writeVisuals(dtMs: number) {
      if (battle === null) return
      battle.komas.forEach((koma, index) => {
        const visual = komaVisuals[index]
        if (!visual) return
        const translation = koma.body.translation()
        const rotation = koma.body.rotation()
        visual.group.position.set(translation.x, translation.y, translation.z)
        visual.group.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)

        const reading = readKoma(koma)
        visual.updateSpin(Math.abs(reading.spinSpeed), dtMs)

        // 接地感を出す軽い影。実シャドウマップは使わず、床の高さに沿わせた半透明の円で済ませる。
        const blob = shadowBlobs[index]
        if (blob) {
          const radius = Math.hypot(translation.x, translation.z)
          blob.position.set(translation.x, fieldHeightAt(selectedField, radius) + 0.004, translation.z)
        }
      })
      updateImpactEffects(dtMs)
    }

    function stepPhysics(deltaMs: number) {
      if (battle === null) return
      if (finished && settleRemainingMs <= 0) return
      accumulator += Math.min(deltaMs, MAX_FRAME_DELTA_MS)
      const stepMs = PHYSICS_TIMESTEP * 1000
      let substeps = 0
      while (accumulator >= stepMs && substeps < MAX_PHYSICS_SUBSTEPS) {
        for (const koma of battle.komas) applyKomaAssist(koma, PHYSICS_TIMESTEP)
        // 決着前だけ接触開始時の追加反発を適用する。決着後のsettle中は自然に倒れ切らせる。
        applyKomaContactAssist(battle, !finished)
        battle.world.step()
        for (const koma of battle.komas) clampKomaMotion(koma)
        checkImpacts()
        accumulator -= stepMs
        substeps += 1
        elapsedMs += stepMs

        if (!finished) {
          const previousJudgeStates = judgeStates
          const readings = battle.komas.map(readKoma)
          judgeStates = previousJudgeStates.map((state, index) =>
            updateKomaJudge(
              state,
              { ...readings[index]!, y: readings[index]!.position.y },
              stepMs,
              elapsedMs,
            ),
          )
          judgeStates.forEach((state, index) => {
            const previous = previousJudgeStates[index]
            if (previous?.defeatReason === null && state.defeatReason !== null) {
              soundController.playDefeat(state.defeatReason)
            }
          })
          const outcome = decideMatchOutcome(judgeStates, elapsedMs)
          if (outcome !== null) {
            finished = true
            // 決着後もしばらく物理を続け、倒れ切るところまで見せる。
            settleRemainingMs = SETTLE_AFTER_FINISH_MS
            soundController.stopSpin()
            if (outcome.kind === 'win') {
              komaVisuals.forEach((visual, index) => visual.setOutcome(index === outcome.winnerIndex))
              soundController.playVictory()
            } else if (outcome.kind === 'draw') {
              soundController.playDraw()
            } else {
              // 通常はjudgeの確定直前に鳴っているが、時間上限による終了でも音を保証する。
              soundController.playDefeat(outcome.reason)
            }
            // React stateへ触れるのはここだけ。1試合につき1回。
            optionsRef.current.onFinished(outcome)
          }
        }
      }
      // 処理が追いつかないときは、たまった時間を捨てて雪だるま式の遅延を防ぐ。
      if (substeps >= MAX_PHYSICS_SUBSTEPS) accumulator = 0
    }

    function tick(now: number) {
      if (released) return
      if (lastFrameTime === null) lastFrameTime = now
      const deltaMs = now - lastFrameTime
      lastFrameTime = now
      const clampedDeltaMs = Math.min(deltaMs, MAX_FRAME_DELTA_MS)

      stepPhysics(deltaMs)
      writeVisuals(clampedDeltaMs)
      if (renderer && scene && camera) renderer.render(scene, camera)

      if (finished) {
        settleRemainingMs -= clampedDeltaMs
        if (settleRemainingMs <= 0) {
          // 決着して落ち着いたら描画も物理も止める。
          // 結果表示を出したまま放置されても、端末の電池を使い続けない。
          rafId = null
          return
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    function createScene(): boolean {
      const container = containerRef.current
      if (!container) return false

      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
      } catch {
        // WebGLを持たない環境（テストなど）では3D表示だけを諦める。
        return false
      }
      // スマホの負荷を抑えるため、解像度倍率は2までに制限する。
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      // 影は使わない。コマ2個のためにリアルタイム影を焚くのは割に合わない。
      renderer.shadowMap.enabled = false
      container.appendChild(renderer.domElement)

      scene = new THREE.Scene()
      scene.background = new THREE.Color(0xdff0fb)

      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60)

      // ライトは2つだけ。ポストプロセスは使わない。
      scene.add(new THREE.HemisphereLight(0xffffff, 0x9fb6c8, 1.1))
      const sun = new THREE.DirectionalLight(0xffffff, 0.95)
      sun.position.set(2.5, 6, 3.5)
      scene.add(sun)

      scene.add(createStadiumMesh())
      createImpactPool()

      battle = createKomaBattleWorld(RAPIER, specs, {
        // 毎回まったく同じ試合にならないよう、開始角を散らす。
        startAngleOffset: Math.random() * Math.PI * 2,
        spinScales: createSpinScales(specs.length),
        field: selectedField,
      })

      const shadowGeometry = track(new THREE.CircleGeometry(DISK_RADIUS * 1.35, 20))
      const shadowMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: 0x1a2233,
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
        }),
      )

      const geometrySets = new Map<string, KomaGeometrySet>()
      for (const koma of battle.komas) {
        let geometrySet = geometrySets.get(koma.spec.typeId)
        if (!geometrySet) {
          geometrySet = createKomaGeometrySet(koma.spec.type.visual)
          geometrySets.set(koma.spec.typeId, geometrySet)
        }
        const visual = createKomaMesh(koma.spec, geometrySet)
        komaVisuals.push(visual)
        scene.add(visual.group)

        const blob = new THREE.Mesh(shadowGeometry, shadowMaterial)
        blob.rotation.x = -Math.PI / 2
        blob.renderOrder = 1
        scene.add(blob)
        shadowBlobs.push(blob)
      }

      resizeRenderer()
      soundController.startSpin()
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
        // StrictModeの二重実行や、素早い「もういちど」で
        // 古いrunがシーンを作ってしまわないよう、必ずここで確認する。
        if (activeRunRef.current !== runToken || released) return
        createScene()
      })
      .catch(() => {
        if (activeRunRef.current === runToken) release()
      })

    return release
  }, [options.runId, options.komaCount, options.specs, options.fieldId])

  return handle
}
