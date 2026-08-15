import { useEffect, useMemo, useRef } from 'react'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import {
  DOMINO_DEPTH,
  DOMINO_HEIGHT,
  createDominoPlacements,
  getLayoutBounds,
} from './dominoLayout'
import { computeCameraSetup } from './dominoCamera'
import {
  GROUND_SIZE,
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
  createShepherdMemory,
  planShepherdNudges,
  type ShepherdMemory,
} from './dominoShepherd'
import {
  evaluateCompletion,
  isFallen,
  type DominoRuntimeState,
} from './dominoCompletion'
import type { World } from '@dimforge/rapier3d-compat'

let rapierInitPromise: Promise<void> | null = null

/** Rapierのwasm初期化をモジュール内で一度だけ実行し、再入場時に共有する。 */
function initializeRapier(): Promise<void> {
  if (rapierInitPromise === null) rapierInitPromise = RAPIER.init()
  return rapierInitPromise
}

export type DominoEngineOptions = {
  /** 値が変わったら世界を作り直す（もういちど用）。 */
  runId: number
  /** 完成判定が立ったときに一度だけ呼ぶ。 */
  onComplete: () => void
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

    const placements = createDominoPlacements()
    const layoutBounds = getLayoutBounds(placements)
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
    let shepherdMemory: ShepherdMemory = createShepherdMemory()

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
      camera.position.set(setup.position.x, setup.position.y, setup.position.z)
      camera.lookAt(setup.target.x, setup.target.y, setup.target.z)
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
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
    }

    function beginStart() {
      if (started || !world || bodies.length === 0) return
      started = true
      startedAt = performance.now()
      const first = bodies[0]
      if (!first) return
      applyStartImpulse(first.body)
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
      const completion = evaluateCompletion(states, now - startedAt)

      if (completion.complete && !completeNotified) {
        completeNotified = true
        optionsRef.current.onComplete()
        return
      }
      if (completeNotified) return

      const shepherd = planShepherdNudges(
        bodies.map((entry, index) => ({
          id: entry.placement.id,
          chainIndex: entry.chainIndex,
          fallen: isFallen(states[index]!),
          sleeping: states[index]!.sleeping,
        })),
        shepherdMemory,
        now,
      )
      shepherdMemory = shepherd.memory
      for (const nudge of shepherd.plan.nudges) {
        const entry = bodiesById.get(nudge.id)
        if (entry) applyShepherdImpulse(entry.body, nudge.strength)
      }
    }

    function tick(now: number) {
      if (activeRunRef.current !== runToken || released) return
      rafId = requestAnimationFrame(tick)

      if (lastFrameTime === null) {
        lastFrameTime = now
      } else {
        const deltaMs = Math.min(Math.max(0, now - lastFrameTime), MAX_FRAME_DELTA_MS)
        lastFrameTime = now
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
      if (started && now - lastInspectionAt >= INSPECTION_INTERVAL_MS) {
        lastInspectionAt = now
        inspectPhysics(now)
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

        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x8bbf91, 1.8)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1)
        directionalLight.position.set(-4, 8, 6)
        scene.add(hemisphereLight, directionalLight)

        groundGeometry = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE)
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
          const color = placement.kind === 'trigger' ? 0xe0ad6b : 0xfff1cf
          dominoMesh.setColorAt(index, new THREE.Color(color))
          if (placement.kind === 'flag') {
            flagMesh.setColorAt(
              flagInstanceIndex,
              new THREE.Color(placement.color === 'red' ? '#bc002d' : '#fffdf5'),
            )
            flagInstanceIndex += 1
          }
        }
        if (dominoMesh.instanceColor) dominoMesh.instanceColor.needsUpdate = true
        if (flagMesh.instanceColor) flagMesh.instanceColor.needsUpdate = true
        scene.add(dominoMesh, flagMesh)

        const dominoWorld = createDominoWorld(RAPIER, placements)
        world = dominoWorld.world
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
  }, [options.runId])

  return handle
}
