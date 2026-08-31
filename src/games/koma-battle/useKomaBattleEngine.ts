import { useEffect, useMemo, useRef } from 'react'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import {
  DISK_CENTER_Y,
  DISK_HALF_HEIGHT,
  DISK_RADIUS,
  MAX_FRAME_DELTA_MS,
  MAX_PHYSICS_SUBSTEPS,
  PHYSICS_TIMESTEP,
  SHAFT_RADIUS,
  START_ORBIT_SPEED,
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
  bowlHeightAt,
  createWallSegments,
  FIELD_RADIUS,
  WALL_HEIGHT,
  WALL_INNER_RADIUS,
  WALL_THICKNESS,
} from './komaStadium'
import { komaCameraSetup } from './komaCamera'
import { komaSpecsForCount, type KomaSpec } from './komaSpecs'
import {
  applyKomaAssist,
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
/** 円盤どうしの中心間距離がこれを下回ったら「接触」とみなす。 */
const IMPACT_CONTACT_DISTANCE = DISK_RADIUS * 2 * 1.05
/** これより弱い相対速度の接触は演出を出さない（かすった程度では光らせない）。 */
const IMPACT_MIN_RELATIVE_SPEED = START_ORBIT_SPEED * 0.7

type ImpactSlot = {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  remainingMs: number
}

type KomaVisual = {
  group: THREE.Group
  /** 毎フレーム、その時点の自転速度で回転演出を更新する。 */
  updateSpin: (spinSpeedAbs: number, dtMs: number) => void
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

    const specs = komaSpecsForCount(options.komaCount)

    let battle: KomaBattleWorld | null = null
    let scene: THREE.Scene | null = null
    let camera: THREE.PerspectiveCamera | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let resizeObserver: ResizeObserver | null = null
    let detachViewportListeners: (() => void) | null = null
    let rafId: number | null = null
    let released = false
    let finished = false
    let settleRemainingMs = 0
    let lastFrameTime: number | null = null
    let accumulator = 0
    let elapsedMs = 0
    let judgeStates: KomaJudgeState[] = specs.map(() => createKomaJudgeState())
    /** 直前ステップで2個の円盤が接触していたか。衝突演出を「接触し始めた瞬間」だけ出すために使う。 */
    let wasInContact = false
    let impactCursor = 0

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

      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      resizeObserver?.disconnect()
      resizeObserver = null
      detachViewportListeners?.()
      detachViewportListeners = null

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

      detachViewportListeners = () => {
        window.removeEventListener('resize', handleViewportChange)
        window.removeEventListener('orientationchange', handleViewportChange)
        orientation?.removeEventListener?.('change', handleViewportChange)
        window.visualViewport?.removeEventListener('resize', handleViewportChange)
      }
    }

    /**
     * コマの見た目Meshが使うgeometryを1組だけ作る。
     * 寸法はどのコマも同じ（色だけがKomaSpecごとに違う）ので、1個モードでも2個モードでも
     * このセット1つを全コマで使い回し、geometry数を人数ぶんに増やさない。
     */
    function createKomaGeometrySet(): KomaGeometrySet {
      return {
        // 軸/先端。物理では球+円柱だが、見た目は下向きの円錐にして「コマの軸」に見せる。
        tip: track(new THREE.ConeGeometry(SHAFT_RADIUS * 1.3, DISK_CENTER_Y - DISK_HALF_HEIGHT, 12)),
        // 持ち手の軸。Colliderは持たせず見た目だけ。倒れたときの傾きが分かりやすくなる。
        shaft: track(new THREE.CylinderGeometry(SHAFT_RADIUS * 0.55, SHAFT_RADIUS * 0.6, 0.14, 10)),
        // 円盤下段。樹脂パーツの土台。
        diskLower: track(
          new THREE.CylinderGeometry(DISK_RADIUS * 0.86, DISK_RADIUS * 0.66, DISK_HALF_HEIGHT * 1.6, 24),
        ),
        // 円盤上段。下段よりわずかに大きくして段差(パネル分割)を作る。
        diskUpper: track(
          new THREE.CylinderGeometry(DISK_RADIUS, DISK_RADIUS * 0.9, DISK_HALF_HEIGHT * 1.66, 24),
        ),
        // 上下段の継ぎ目に入れる溝。上段の最小半径(0.9)よりわずかに大きくして、
        // 上段の表面に埋もれず外へ突き出すようにする（段差として実際に見えるように）。
        groove: track(new THREE.TorusGeometry(DISK_RADIUS * 0.93, DISK_RADIUS * 0.02, 6, 28)),
        // 外周リング。円盤の縁いっぱいに巻く金属風パーツ。
        outerRing: track(new THREE.TorusGeometry(DISK_RADIUS * 0.99, DISK_RADIUS * 0.1, 8, 28)),
        // 中心キャップ。上面の飾りで、回っていることが上から見て分かるようにする。
        cap: track(new THREE.SphereGeometry(DISK_RADIUS * 0.34, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)),
        knob: track(new THREE.SphereGeometry(SHAFT_RADIUS * 0.8, 10, 8)),
        // 回転演出用の半透明リング。高速回転中だけ光る。
        spinRing: track(new THREE.RingGeometry(DISK_RADIUS * 1.15, DISK_RADIUS * 1.42, 28)),
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

      const tip = new THREE.Mesh(geometrySet.tip, metalMaterial)
      tip.rotation.x = Math.PI
      tip.position.y = (DISK_CENTER_Y - DISK_HALF_HEIGHT) / 2
      group.add(tip)

      const diskLower = new THREE.Mesh(geometrySet.diskLower, resinMaterial)
      diskLower.position.y = DISK_CENTER_Y - DISK_HALF_HEIGHT * 0.5
      group.add(diskLower)

      const diskUpperCenterY = DISK_CENTER_Y + DISK_HALF_HEIGHT * 0.45
      const diskUpper = new THREE.Mesh(geometrySet.diskUpper, resinMaterial)
      diskUpper.position.y = diskUpperCenterY
      group.add(diskUpper)

      // 溝は上段の下端（=いちばん細い場所）に合わせる。ここなら上下どちらの円盤の
      // 表面にも埋もれず、実際に段差として突き出して見える。
      const groove = new THREE.Mesh(geometrySet.groove, seamMaterial)
      groove.rotation.x = Math.PI / 2
      groove.position.y = diskUpperCenterY - (DISK_HALF_HEIGHT * 1.66) / 2
      group.add(groove)

      const outerRing = new THREE.Mesh(geometrySet.outerRing, metalMaterial)
      outerRing.rotation.x = Math.PI / 2
      outerRing.position.y = DISK_CENTER_Y + DISK_HALF_HEIGHT * 0.3
      group.add(outerRing)

      const cap = new THREE.Mesh(geometrySet.cap, matteMaterial)
      cap.position.y = DISK_CENTER_Y + DISK_HALF_HEIGHT + 0.02
      group.add(cap)

      const shaft = new THREE.Mesh(geometrySet.shaft, metalMaterial)
      shaft.position.y = DISK_CENTER_Y + DISK_HALF_HEIGHT + 0.1
      group.add(shaft)

      const knob = new THREE.Mesh(geometrySet.knob, accentMaterial)
      knob.position.y = DISK_CENTER_Y + DISK_HALF_HEIGHT + 0.19
      group.add(knob)

      const spinRing = new THREE.Mesh(geometrySet.spinRing, spinRingMaterial)
      spinRing.rotation.x = -Math.PI / 2
      spinRing.position.y = DISK_CENTER_Y
      group.add(spinRing)

      function updateSpin(spinSpeedAbs: number, dtMs: number) {
        const ratio = THREE.MathUtils.clamp(
          (spinSpeedAbs - SPIN_EFFECT_FLOOR_SPEED) / (SPIN_EFFECT_FULL_SPEED - SPIN_EFFECT_FLOOR_SPEED),
          0,
          1,
        )
        spinRingMaterial.opacity = ratio * 0.4
        accentMaterial.emissiveIntensity = ratio * 0.6
        // リングは本体よりわずかに速く自転させ、残像のような「滑り」を出す。
        spinRing.rotation.y += (dtMs / 1000) * spinSpeedAbs * 0.5
      }

      return { group, updateSpin }
    }

    /** すり鉢の見た目。物理の高さ場と同じ profile 関数から作る。 */
    function createStadiumMesh(): THREE.Group {
      const group = new THREE.Group()

      // 断面をbowlHeightAtから作り、回転させてすり鉢にする。
      const profile: THREE.Vector2[] = []
      const steps = 28
      for (let index = 0; index <= steps; index += 1) {
        const radius = (index / steps) * BOWL_RADIUS
        profile.push(new THREE.Vector2(radius, bowlHeightAt(radius)))
      }
      // 縁から外側の平らな踏みしろまで続ける。
      profile.push(new THREE.Vector2(FIELD_RADIUS, 0))

      // 樹脂製玩具らしい、ほどよい光沢のマット面にする。
      const floor = new THREE.Mesh(
        track(new THREE.LatheGeometry(profile, 48)),
        trackMaterial(
          new THREE.MeshStandardMaterial({
            color: 0xf2e4c8,
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
          new THREE.MeshBasicMaterial({ color: 0xe0c9a0, side: THREE.DoubleSide }),
        ),
      )
      centerMark.rotation.x = -Math.PI / 2
      centerMark.position.y = bowlHeightAt(0.3) + 0.005
      group.add(centerMark)

      // 外周壁。物理と同じ配置・寸法のcuboidを並べる。
      const wallMaterial = trackMaterial(
        new THREE.MeshStandardMaterial({ color: 0x5a7fb5, roughness: 0.55, metalness: 0.05 }),
      )
      const wallGeometry = track(new THREE.BoxGeometry(1, 1, 1))
      for (const segment of createWallSegments()) {
        const wall = new THREE.Mesh(wallGeometry, wallMaterial)
        wall.position.set(segment.center.x, segment.center.y, segment.center.z)
        wall.rotation.y = segment.yaw
        wall.scale.set(segment.halfWidth * 2, segment.halfHeight * 2, segment.halfDepth * 2)
        group.add(wall)
      }

      // 壁の上端の縁取り。ほんのり金属風にして、スタジアムの輪郭をはっきりさせる。
      const rim = new THREE.Mesh(
        track(
          new THREE.TorusGeometry(WALL_INNER_RADIUS + WALL_THICKNESS / 2, 0.035, 8, 48),
        ),
        trackMaterial(
          new THREE.MeshStandardMaterial({ color: 0x3c5f92, roughness: 0.4, metalness: 0.35 }),
        ),
      )
      rim.rotation.x = Math.PI / 2
      rim.position.y = WALL_HEIGHT
      group.add(rim)

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
        impactPool.push({ mesh, material, remainingMs: 0 })
      }
    }

    /** 強い衝突の瞬間だけ、プールから1枠を借りて光らせる。 */
    function triggerImpactEffect(position: { x: number; y: number; z: number }) {
      if (impactPool.length === 0) return
      const slot = impactPool[impactCursor]!
      impactCursor = (impactCursor + 1) % impactPool.length
      slot.mesh.position.set(position.x, position.y, position.z)
      slot.mesh.visible = true
      slot.mesh.scale.setScalar(0.3)
      slot.material.opacity = 0.85
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
          continue
        }
        const t = 1 - slot.remainingMs / IMPACT_DURATION_MS
        slot.mesh.scale.setScalar(0.3 + t * 0.5)
        slot.material.opacity = 0.85 * (1 - t)
      }
    }

    /**
     * 2個の円盤が接触し始めた瞬間だけを拾い、相対速度が十分速ければ衝突演出を出す。
     * world.step()の直後に呼ぶ。1個モードでは何もしない。
     */
    function checkImpacts() {
      if (battle === null || battle.komas.length !== 2) return
      const [a, b] = battle.komas
      const ta = a!.body.translation()
      const tb = b!.body.translation()
      const distance = Math.hypot(ta.x - tb.x, ta.z - tb.z)
      const inContact = distance < IMPACT_CONTACT_DISTANCE

      if (inContact && !wasInContact) {
        const va = a!.body.linvel()
        const vb = b!.body.linvel()
        const relativeSpeed = Math.hypot(va.x - vb.x, va.y - vb.y, va.z - vb.z)
        if (relativeSpeed >= IMPACT_MIN_RELATIVE_SPEED) {
          triggerImpactEffect({
            x: (ta.x + tb.x) / 2,
            y: Math.max(ta.y, tb.y) + DISK_CENTER_Y,
            z: (ta.z + tb.z) / 2,
          })
        }
      }
      wasInContact = inContact
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
          blob.position.set(translation.x, bowlHeightAt(radius) + 0.004, translation.z)
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
        battle.world.step()
        for (const koma of battle.komas) clampKomaMotion(koma)
        checkImpacts()
        accumulator -= stepMs
        substeps += 1
        elapsedMs += stepMs

        if (!finished) {
          const readings = battle.komas.map(readKoma)
          judgeStates = judgeStates.map((state, index) =>
            updateKomaJudge(
              state,
              { ...readings[index]!, y: readings[index]!.position.y },
              stepMs,
              elapsedMs,
            ),
          )
          const outcome = decideMatchOutcome(judgeStates, elapsedMs)
          if (outcome !== null) {
            finished = true
            // 決着後もしばらく物理を続け、倒れ切るところまで見せる。
            settleRemainingMs = SETTLE_AFTER_FINISH_MS
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
      })

      const geometrySet = createKomaGeometrySet()
      const shadowGeometry = track(new THREE.CircleGeometry(DISK_RADIUS * 1.35, 20))
      const shadowMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: 0x1a2233,
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
        }),
      )

      for (const koma of battle.komas) {
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
      writeVisuals(0)
      renderer.render(scene, camera)
      rafId = requestAnimationFrame(tick)

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => resizeRenderer())
        resizeObserver.observe(container)
      }
      attachViewportListeners()
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
  }, [options.runId, options.komaCount])

  return handle
}
