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
import {
  createKomaJudgeState,
  decideMatchOutcome,
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

    const komaGroups: THREE.Group[] = []
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
      komaGroups.length = 0

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

    /** 見た目のコマ。物理Colliderとは別に、幼児が「コマ」と分かる形を組む。 */
    function createKomaMesh(spec: KomaSpec): THREE.Group {
      const group = new THREE.Group()
      const bodyMaterial = trackMaterial(new THREE.MeshLambertMaterial({ color: spec.color }))
      const accentMaterial = trackMaterial(
        new THREE.MeshLambertMaterial({ color: spec.accentColor }),
      )

      // 先端。物理では球だが、見た目は下向きの円錐にして「コマの軸」に見せる。
      const tip = new THREE.Mesh(
        track(new THREE.ConeGeometry(SHAFT_RADIUS * 1.4, DISK_CENTER_Y - DISK_HALF_HEIGHT, 12)),
        accentMaterial,
      )
      tip.rotation.x = Math.PI
      tip.position.y = (DISK_CENTER_Y - DISK_HALF_HEIGHT) / 2
      group.add(tip)

      // 円盤部。物理Colliderと同じ寸法にして、見た目とぶつかり方をそろえる。
      const disk = new THREE.Mesh(
        track(new THREE.CylinderGeometry(DISK_RADIUS, DISK_RADIUS * 0.82, DISK_HALF_HEIGHT * 2, 24)),
        bodyMaterial,
      )
      disk.position.y = DISK_CENTER_Y
      group.add(disk)

      // 上面の飾り。回っていることが上から見て分かるようにする。
      const cap = new THREE.Mesh(
        track(new THREE.CylinderGeometry(DISK_RADIUS * 0.45, DISK_RADIUS * 0.45, 0.03, 16)),
        accentMaterial,
      )
      cap.position.y = DISK_CENTER_Y + DISK_HALF_HEIGHT + 0.015
      group.add(cap)

      // 持ち手の軸。Colliderは持たせず見た目だけ。倒れたときの傾きが分かりやすくなる。
      const stem = new THREE.Mesh(
        track(new THREE.CylinderGeometry(SHAFT_RADIUS * 0.55, SHAFT_RADIUS * 0.55, 0.17, 10)),
        bodyMaterial,
      )
      stem.position.y = DISK_CENTER_Y + DISK_HALF_HEIGHT + 0.1
      group.add(stem)

      const knob = new THREE.Mesh(track(new THREE.SphereGeometry(SHAFT_RADIUS * 0.85, 12, 8)), accentMaterial)
      knob.position.y = DISK_CENTER_Y + DISK_HALF_HEIGHT + 0.19
      group.add(knob)

      return group
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

      const floor = new THREE.Mesh(
        track(new THREE.LatheGeometry(profile, 48)),
        trackMaterial(
          new THREE.MeshLambertMaterial({ color: 0xf2e4c8, side: THREE.DoubleSide }),
        ),
      )
      group.add(floor)

      // 中央の目印。回っているコマの位置関係が分かりやすくなる。
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
      const wallMaterial = trackMaterial(new THREE.MeshLambertMaterial({ color: 0x5a7fb5 }))
      const wallGeometry = track(new THREE.BoxGeometry(1, 1, 1))
      for (const segment of createWallSegments()) {
        const wall = new THREE.Mesh(wallGeometry, wallMaterial)
        wall.position.set(segment.center.x, segment.center.y, segment.center.z)
        wall.rotation.y = segment.yaw
        wall.scale.set(segment.halfWidth * 2, segment.halfHeight * 2, segment.halfDepth * 2)
        group.add(wall)
      }

      // 壁の上端の縁取り。スタジアムの輪郭をはっきりさせる。
      const rim = new THREE.Mesh(
        track(
          new THREE.TorusGeometry(WALL_INNER_RADIUS + WALL_THICKNESS / 2, 0.035, 8, 48),
        ),
        trackMaterial(new THREE.MeshLambertMaterial({ color: 0x3c5f92 })),
      )
      rim.rotation.x = Math.PI / 2
      rim.position.y = WALL_HEIGHT
      group.add(rim)

      return group
    }

    function writeVisuals() {
      if (battle === null) return
      battle.komas.forEach((koma, index) => {
        const group = komaGroups[index]
        if (!group) return
        const translation = koma.body.translation()
        const rotation = koma.body.rotation()
        group.position.set(translation.x, translation.y, translation.z)
        group.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w)
      })
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

      stepPhysics(deltaMs)
      writeVisuals()
      if (renderer && scene && camera) renderer.render(scene, camera)

      if (finished) {
        settleRemainingMs -= Math.min(deltaMs, MAX_FRAME_DELTA_MS)
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
      const sun = new THREE.DirectionalLight(0xffffff, 0.75)
      sun.position.set(2.5, 6, 3.5)
      scene.add(sun)

      scene.add(createStadiumMesh())

      battle = createKomaBattleWorld(RAPIER, specs, {
        // 毎回まったく同じ試合にならないよう、開始角を散らす。
        startAngleOffset: Math.random() * Math.PI * 2,
        spinScales: createSpinScales(specs.length),
      })

      for (const koma of battle.komas) {
        const group = createKomaMesh(koma.spec)
        komaGroups.push(group)
        scene.add(group)
      }

      resizeRenderer()
      writeVisuals()
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
