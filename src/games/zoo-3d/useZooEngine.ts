// 3Dどうぶつえんの描画と時間の進行を受け持つフック。
// 動物のふるまいは behavior.ts（純粋なロジック）、アニメーションの合成は animator.ts、
// 景色は scenery.ts、演出は effects.ts が担当し、ここではそれらをつないで資源を管理する。

import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { observeGameActivity } from '../../utils/gameActivity'
import { AnimalAnimator } from './animator'
import { command, createZoo, dropFood, type AnimalState, type ZooEvent, type ZooWorld, stepZoo } from './behavior'
import { CAMERA_LIMITS, cameraPosition, follow, followAzimuth, fovFor, overviewPose, pushOutOfSpheres, segmentHitsSphere } from './cameraRig'
import { createEffects, createFood, disposeObject } from './effects'
import { createScenery } from './scenery'
import { playZooSound, type ZooSound } from './sounds'
import { modelUrl, SPECIES, SPECIES_ORDER, type SpeciesId } from './species'

export type ZooStatus = 'loading' | 'ready' | 'error'

export type ZooEngineOptions = {
  reducedMotion: boolean
  onStatus: (status: ZooStatus) => void
  onProgress: (ratio: number) => void
  onSelect: (id: string | null) => void
  onFollow: (following: boolean) => void
  onEvent?: (event: ZooEvent) => void
}

type Commands = {
  select: (id: string | null) => void
  feed: () => void
  special: (clip: string) => void
  setFollow: (following: boolean) => void
  overview: () => void
}

type Instance = {
  state: AnimalState
  root: THREE.Group
  animator: AnimalAnimator
  /** ゾウの鼻先（水しぶき・音符の出どころ）。 */
  tip?: THREE.Object3D
  /** 食べ物を持って運ぶ骨（モーション情報の food.bone）。 */
  hold?: THREE.Object3D
  head?: THREE.Object3D
  skipped: number
}

type FoodView = { group: THREE.Group; y: number; vy: number; heldBy?: string; vanishAt?: number; age: number }
type Timeline = { id: string; clip: string; t: number; fired: Set<string> }

export function useZooEngine(options: ZooEngineOptions) {
  const [container, registerContainer] = useState<HTMLDivElement | null>(null)
  const [generation, setGeneration] = useState(0)
  const optionsRef = useRef(options)
  const commands = useRef<Commands | null>(null)
  useEffect(() => { optionsRef.current = options }, [options])
  const retry = useCallback(() => setGeneration(g => g + 1), [])
  const select = useCallback((id: string | null) => commands.current?.select(id), [])
  const feed = useCallback(() => commands.current?.feed(), [])
  const special = useCallback((clip: string) => commands.current?.special(clip), [])
  const setFollow = useCallback((following: boolean) => commands.current?.setFollow(following), [])
  const overview = useCallback(() => commands.current?.overview(), [])

  useEffect(() => {
    if (!container) return
    const host = container
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#bfe7fb')
    scene.fog = new THREE.Fog('#cdeefb', 62, 130)
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 220)
    const hemi = new THREE.HemisphereLight('#e8f6ff', '#9fc46d', 1.55)
    const sun = new THREE.DirectionalLight('#fff3dc', 2.3)
    sun.position.set(13, 25, 16)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 2, far: 80 })
    sun.shadow.normalBias = 0.04
    sun.shadow.bias = -0.0004
    sun.shadow.radius = 4
    scene.add(hemi, sun, sun.target)

    const scenery = createScenery()
    scene.add(scenery.group)
    const effects = createEffects()
    scene.add(effects.group)
    const selectionRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.85, depthWrite: false }))
    selectionRing.position.y = 0.03
    selectionRing.visible = false
    selectionRing.renderOrder = 2
    scene.add(selectionRing)

    let renderer: THREE.WebGLRenderer | undefined
    let controls: OrbitControls | undefined
    let world: ZooWorld | undefined
    const instances: Instance[] = []
    const foods = new Map<number, FoodView>()
    const timelines: Timeline[] = []
    let selected: string | null = null
    let following = false
    let returning = 0
    let zoomIn = 0
    /** 追いかけるときに回り込む方位角。追いかけ始めに一度決め、さえぎられたときだけ選び直す（毎フレーム選ぶと揺れる）。 */
    let followAz: number | null = null
    let released = false
    let lost = false
    let active = true
    let raf = 0
    let last = 0
    let clock = 0
    let pixelRatio = 1
    let slowFrames = 0
    let zzzClock = 0
    const frustum = new THREE.Frustum()
    const projScreen = new THREE.Matrix4()
    const tmp = new THREE.Vector3()
    const tmp2 = new THREE.Vector3()
    const tmpQ = new THREE.Quaternion()
    const sphere = new THREE.Sphere()
    const raycaster = new THREE.Raycaster()
    const pointer = { x: 0, y: 0, t: 0, down: false }

    const instanceOf = (id: string | null) => instances.find(i => i.state.id === id)

    function resize() {
      if (!renderer) return
      const w = Math.max(1, host.clientWidth)
      const h = Math.max(1, host.clientHeight)
      camera.aspect = w / h
      camera.fov = fovFor(camera.aspect)
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(pixelRatio)
      renderer.setSize(w, h, false)
      effects.setScale(h * pixelRatio / (2 * Math.tan((camera.fov * Math.PI) / 360)))
    }

    function applyOverview(instant: boolean) {
      if (!controls) return
      const pose = overviewPose(camera.aspect)
      if (instant || optionsRef.current.reducedMotion) {
        controls.target.set(...pose.target)
        camera.position.set(...cameraPosition(pose))
        controls.update()
        returning = 0
      } else {
        returning = 1.2
      }
    }

    function setSelected(id: string | null) {
      if (selected === id) return
      selected = id
      optionsRef.current.onSelect(id)
      if (!id && following) setFollowing(false)
      else if (following) {
        // 追いかけている途中で別の動物を選んだら、その動物へ回り込み直す
        zoomIn = 1.4
        followAz = null
      }
    }

    function setFollowing(next: boolean) {
      if (following === next) return
      following = next && !!selected
      zoomIn = following ? 1.4 : 0
      followAz = null
      if (!following) applyOverview(false)
      optionsRef.current.onFollow(following)
    }

    function headPosition(inst: Instance, out: THREE.Vector3) {
      if (inst.head) return inst.head.getWorldPosition(out).add(tmp2.set(0, 0.5 * inst.state.scale, 0))
      return out.set(inst.state.x, SPECIES[inst.state.species].manifest.bounds.height * inst.state.scale, inst.state.z)
    }

    function handleEvent(e: ZooEvent) {
      const inst = instanceOf(e.animal)
      optionsRef.current.onEvent?.(e)
      if (!inst) return
      if (e.type === 'eat') {
        playZooSound('munch')
        const food = foods.get(e.foodId)
        const info = SPECIES[inst.state.species].manifest.clips.Eat
        if (food) {
          const hold = info.food ? info.food.release - info.food.grab : 0.6
          // 鼻先（ゾウ）や前足（パンダ）でつかんで口へ運ぶ動物は、その骨に付けて動かす。ほかはその場で食べる
          if (inst.hold && (info.food?.hold || info.food?.bone === 'trunk_tip')) food.heldBy = inst.state.id
          food.vanishAt = clock + hold
        }
      } else if (e.type === 'happy') {
        playZooSound('happy')
        effects.burst('heart', headPosition(inst, tmp), 6)
      } else if (e.type === 'special') {
        timelines.push({ id: inst.state.id, clip: e.clip, t: 0, fired: new Set() })
      } else if (e.type === 'wake') {
        effects.burst('sparkle', headPosition(inst, tmp), 5)
      }
    }

    function runTimelines(dt: number) {
      for (let i = timelines.length - 1; i >= 0; i--) {
        const tl = timelines[i]
        const inst = instanceOf(tl.id)
        tl.t += dt
        if (!inst || inst.state.clip !== tl.clip) {
          timelines.splice(i, 1)
          continue
        }
        const info = SPECIES[inst.state.species].manifest.clips[tl.clip]
        const once = (key: string, at: number, fn: () => void) => {
          if (!tl.fired.has(key) && tl.t >= at) {
            tl.fired.add(key)
            fn()
          }
        }
        if (info.sound) {
          const sound = info.sound as ZooSound
          once('call', info.callStart ?? 0.8, () => playZooSound(sound))
          if (tl.t > (info.callStart ?? 0.8) && tl.t < (info.callEnd ?? (info.callStart ?? 0.8) + 1) && Math.random() < dt * 5) {
            effects.burst('note', inst.tip ? inst.tip.getWorldPosition(tmp) : headPosition(inst, tmp), 1)
          }
        }
        if (info.effect === 'water' && inst.tip) {
          once('splash', info.sprayStart ?? 2, () => playZooSound('splash'))
          if (tl.t > (info.sprayStart ?? 2) && tl.t < (info.sprayEnd ?? 3)) {
            const from = inst.tip.getWorldPosition(tmp)
            const dir = tmp2.set(0, 1, 0).applyQuaternion(inst.tip.getWorldQuaternion(tmpQ)).normalize()
            dir.y = Math.max(dir.y, 0.35)
            effects.spray(from, dir.normalize(), Math.ceil(dt * 90))
          }
        }
        if (tl.t > info.duration) timelines.splice(i, 1)
      }
    }

    function updateFoods(dt: number) {
      for (const [id, food] of foods) {
        food.age += dt
        if (food.heldBy) {
          const holder = instanceOf(food.heldBy)
          if (holder?.hold) {
            // 持つ骨からのずらし量は動物ごとにモーション情報で決める（ゾウは鼻先の下へぶら下げる）
            const info = SPECIES[holder.state.species].manifest.clips.Eat.food
            const offset = info?.holdOffset ?? (info?.bone === 'trunk_tip' ? -0.12 : 0)
            holder.hold.getWorldPosition(tmp)
            food.group.position.set(tmp.x, tmp.y + offset * holder.state.scale, tmp.z)
          }
        } else if (food.y > 0 || food.vy !== 0) {
          food.vy -= 14 * dt
          food.y += food.vy * dt
          if (food.y <= 0) {
            food.y = 0
            food.vy = Math.abs(food.vy) > 1.2 ? -food.vy * 0.3 : 0
          }
          food.group.position.y = food.y
          food.group.rotation.y += dt * 3
        }
        if (food.vanishAt !== undefined && clock >= food.vanishAt) {
          const s = food.group.scale.x - dt * 6
          if (s <= 0.05) {
            effects.burst('sparkle', food.group.position, 3)
            scene.remove(food.group)
            disposeObject(food.group)
            foods.delete(id)
          } else {
            food.group.scale.setScalar(s)
          }
        }
      }
    }

    function updateCamera(dt: number) {
      if (!controls) return
      const reduced = optionsRef.current.reducedMotion
      if (following) {
        const inst = instanceOf(selected)
        if (inst) {
          const sp = SPECIES[inst.state.species]
          const desired = tmp.set(inst.state.x, sp.follow.height * Math.sqrt(inst.state.scale), inst.state.z)
          const k = reduced ? 1 : follow(4, dt)
          const delta = desired.sub(controls.target).multiplyScalar(k)
          controls.target.add(delta)
          camera.position.add(delta)
          if (zoomIn > 0) {
            // 追いかけ始めは、動物の顔が見える斜め前へ回り込みながら近づく
            zoomIn -= dt
            const want = sp.follow.distance * (0.55 + 0.45 * inst.state.scale)
            const offset = tmp2.copy(camera.position).sub(controls.target)
            const k = reduced ? 1 : follow(2.5, dt)
            const r = offset.length()
            const polar = Math.acos(Math.max(-1, Math.min(1, offset.y / Math.max(r, 1e-6))))
            const az = Math.atan2(offset.x, offset.z)
            const target: [number, number, number] = [controls.target.x, controls.target.y, controls.target.z]
            const blocked = followAz !== null && scenery.canopies.some(s =>
              segmentHitsSphere(cameraPosition({ target, distance: want, polar: 1.0, azimuth: followAz! }), target, s))
            if (followAz === null || blocked) followAz = followAzimuth(target, inst.state.heading, want, 1.0, scenery.canopies)
            const wantAz = followAz
            const dAz = Math.atan2(Math.sin(wantAz - az), Math.cos(wantAz - az))
            const nr = r + (want - r) * k
            const np = polar + (1.0 - polar) * k
            const na = az + dAz * k
            offset.set(Math.sin(np) * Math.sin(na) * nr, Math.cos(np) * nr, Math.sin(np) * Math.cos(na) * nr)
            camera.position.copy(controls.target).add(offset)
          }
        }
      } else if (returning > 0) {
        returning -= dt
        const pose = overviewPose(camera.aspect)
        const k = follow(3.5, dt)
        controls.target.lerp(tmp.set(...pose.target), k)
        camera.position.lerp(tmp2.set(...cameraPosition(pose)), k)
      }
      controls.update()
      const pushed = pushOutOfSpheres([camera.position.x, camera.position.y, camera.position.z], scenery.canopies)
      camera.position.set(...pushed)
    }

    function updateAnimals(dt: number) {
      projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      frustum.setFromProjectionMatrix(projScreen)
      for (const inst of instances) {
        const a = inst.state
        inst.root.position.set(a.x, 0, a.z)
        inst.root.rotation.y = a.heading
        sphere.center.set(a.x, 1, a.z)
        sphere.radius = SPECIES[a.species].manifest.bounds.length * a.scale
        const visible = frustum.intersectsSphere(sphere)
        // 画面外の動物はアニメーションの更新を間引く（移動そのものは毎フレーム進める）
        inst.skipped += dt
        if (visible || inst.skipped > 0.12) {
          inst.animator.update(inst.skipped, a)
          inst.skipped = 0
        }
      }
      const sel = instanceOf(selected)
      selectionRing.visible = !!sel
      if (sel) {
        const r = sel.state.radius * 1.25 + 0.2
        const pulse = 1 + 0.06 * Math.sin(clock * 5)
        selectionRing.position.set(sel.state.x, 0.03, sel.state.z)
        selectionRing.scale.setScalar(r * pulse)
      }
      zzzClock += dt
      if (zzzClock > 1.5) {
        zzzClock = 0
        for (const inst of instances) {
          if (inst.state.mode === 'sleep' && inst.state.sleep?.stage === 'asleep') {
            effects.burst('sleep', headPosition(inst, tmp), 1)
            if (inst.state.id === selected && following) playZooSound('snore')
          }
        }
      }
    }

    function frame(now: number) {
      raf = 0
      if (released || lost || !active || !renderer || !world) return
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60)
      last = now
      clock += dt
      const events = stepZoo(world, dt, Math.random)
      for (const e of events) handleEvent(e)
      updateAnimals(dt)
      runTimelines(dt)
      updateFoods(dt)
      effects.update(dt)
      scenery.update(clock)
      updateCamera(dt)
      renderer.render(scene, camera)
      // 重い端末では解像度を少し下げて、なめらかさを優先する
      if (dt > 0.026) slowFrames += 1
      else slowFrames = Math.max(0, slowFrames - 0.5)
      if (slowFrames > 40 && pixelRatio > 1) {
        pixelRatio = Math.max(1, pixelRatio - 0.25)
        slowFrames = 0
        resize()
      }
      raf = requestAnimationFrame(frame)
    }

    function schedule() {
      if (!raf && !released && !lost && active) {
        last = 0
        raf = requestAnimationFrame(frame)
      }
    }

    function pick(clientX: number, clientY: number): Instance | undefined {
      if (!renderer) return undefined
      const rect = renderer.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      let best: Instance | undefined
      let bestDist = Infinity
      for (const inst of instances) {
        const a = inst.state
        for (const h of SPECIES[a.species].hit) {
          const s = a.scale
          sphere.center.set(a.x + Math.sin(a.heading) * h.z * s, h.y * s, a.z + Math.cos(a.heading) * h.z * s)
          sphere.radius = h.r * s * 1.15
          const hit = raycaster.ray.intersectSphere(sphere, tmp)
          if (hit) {
            const d = hit.distanceTo(raycaster.ray.origin)
            if (d < bestDist) {
              bestDist = d
              best = inst
            }
          }
        }
      }
      return best
    }

    function onPointerDown(e: PointerEvent) {
      pointer.x = e.clientX
      pointer.y = e.clientY
      pointer.t = performance.now()
      pointer.down = true
    }
    function onPointerUp(e: PointerEvent) {
      if (!pointer.down) return
      pointer.down = false
      if (Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 10 || performance.now() - pointer.t > 600) return
      const inst = pick(e.clientX, e.clientY)
      if (!inst || !world) {
        setSelected(null)
        return
      }
      if (selected === inst.state.id) {
        command(world, inst.state.id, { kind: 'react' }, Math.random)
      } else {
        setSelected(inst.state.id)
        playZooSound('select')
        effects.burst('sparkle', headPosition(inst, tmp), 4)
      }
    }
    function onControlsStart() {
      returning = 0
      zoomIn = 0
    }
    function contextLost(event: Event) {
      event.preventDefault()
      lost = true
      cancelAnimationFrame(raf)
      raf = 0
      optionsRef.current.onStatus('error')
    }
    function contextRestored() {
      if (!released) setGeneration(g => g + 1)
    }

    optionsRef.current.onStatus('loading')
    optionsRef.current.onProgress(0)
    let stopActivity: (() => void) | undefined
    // ResizeObserver がない環境（古いブラウザ・テスト）では window の resize で代用する
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : undefined
    const onWindowResize = () => resize()
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.NeutralToneMapping
      renderer.toneMappingExposure = 1.05
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFShadowMap
      renderer.domElement.setAttribute('aria-hidden', 'true')
      renderer.domElement.style.touchAction = 'none'
      host.appendChild(renderer.domElement)
      renderer.domElement.addEventListener('webglcontextlost', contextLost)
      renderer.domElement.addEventListener('webglcontextrestored', contextRestored)
      renderer.domElement.addEventListener('pointerdown', onPointerDown)
      renderer.domElement.addEventListener('pointerup', onPointerUp)
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.enablePan = false
      controls.rotateSpeed = 0.75
      controls.zoomSpeed = 0.9
      controls.minDistance = CAMERA_LIMITS.minDistance
      controls.maxDistance = CAMERA_LIMITS.maxDistance
      controls.minPolarAngle = CAMERA_LIMITS.minPolar
      controls.maxPolarAngle = CAMERA_LIMITS.maxPolar
      controls.addEventListener('start', onControlsStart)
      if (observer) observer.observe(host)
      else window.addEventListener('resize', onWindowResize)
      resize()
      applyOverview(true)
    } catch {
      optionsRef.current.onStatus('error')
    }

    commands.current = {
      select(id) {
        if (!world) return
        setSelected(id)
        const inst = instanceOf(id)
        if (inst) {
          playZooSound('select')
          effects.burst('sparkle', headPosition(inst, tmp), 4)
        }
      },
      feed() {
        if (!world || !selected) return
        const food = dropFood(world, selected, Math.random)
        if (!food) return
        const group = createFood(SPECIES[food.species].food.id)
        // えさの大きさは、置くときに食べる動物の大きさへ合わせる（持ち上げた瞬間に縮まない）
        group.scale.setScalar(Math.max(0.6, world.animals.find(a => a.id === selected)?.scale ?? 1))
        group.position.set(food.x, 3.2, food.z)
        scene.add(group)
        foods.set(food.id, { group, y: 3.2, vy: 0, age: 0 })
        playZooSound('drop')
      },
      special(clip) {
        if (!world || !selected) return
        command(world, selected, { kind: 'special', clip }, Math.random)
      },
      setFollow(next) {
        setFollowing(next)
      },
      overview() {
        setFollowing(false)
        setSelected(null)
        applyOverview(false)
      },
    }

    if (renderer) {
      const manager = new THREE.LoadingManager()
      manager.onProgress = (_url, loaded, total) => optionsRef.current.onProgress(total ? loaded / total : 0)
      const loader = new GLTFLoader(manager)
      loader.setMeshoptDecoder(MeshoptDecoder)
      const species = SPECIES_ORDER
      Promise.all(species.map(id => loader.loadAsync(modelUrl(SPECIES[id])).then(g => [id, g] as const)))
        .then(results => {
          if (released) return
          const models = new Map<SpeciesId, GLTF>(results)
          world = createZoo(Math.random)
          for (const state of world.animals) {
            const gltf = models.get(state.species)!
            const model = cloneSkinned(gltf.scene)
            model.scale.setScalar(state.scale)
            model.traverse(o => {
              const mesh = o as THREE.SkinnedMesh
              if (mesh.isMesh) {
                mesh.castShadow = true
                mesh.frustumCulled = false
                const material = mesh.material as THREE.MeshStandardMaterial
                material.roughness = 0.78
                material.metalness = 0
              }
            })
            const root = new THREE.Group()
            root.name = `zoo-animal-${state.id}`
            root.add(model)
            scene.add(root)
            const mixer = new THREE.AnimationMixer(model)
            const animator = new AnimalAnimator(mixer, gltf.animations, SPECIES[state.species].manifest, state.scale)
            instances.push({
              state, root, animator, skipped: 0,
              tip: model.getObjectByName('trunk_tip') ?? undefined,
              hold: model.getObjectByName(SPECIES[state.species].manifest.clips.Eat?.food?.bone ?? '') ?? undefined,
              head: model.getObjectByName('head') ?? undefined,
            })
          }
          optionsRef.current.onProgress(1)
          optionsRef.current.onStatus(lost ? 'error' : 'ready')
          stopActivity = observeGameActivity(next => {
            active = next
            if (next) schedule()
          })
          schedule()
        })
        .catch(() => {
          if (!released) optionsRef.current.onStatus('error')
        })
    }

    return () => {
      released = true
      commands.current = null
      cancelAnimationFrame(raf)
      stopActivity?.()
      observer?.disconnect()
      window.removeEventListener('resize', onWindowResize)
      controls?.removeEventListener('start', onControlsStart)
      controls?.dispose()
      if (renderer) {
        renderer.domElement.removeEventListener('webglcontextlost', contextLost)
        renderer.domElement.removeEventListener('webglcontextrestored', contextRestored)
        renderer.domElement.removeEventListener('pointerdown', onPointerDown)
        renderer.domElement.removeEventListener('pointerup', onPointerUp)
      }
      for (const inst of instances) {
        inst.animator.dispose()
        disposeObject(inst.root)
      }
      for (const food of foods.values()) disposeObject(food.group)
      scenery.dispose()
      effects.dispose()
      selectionRing.geometry.dispose()
      ;(selectionRing.material as THREE.Material).dispose()
      sun.shadow.map?.dispose()
      renderer?.dispose()
      renderer?.domElement.remove()
    }
  }, [container, generation])

  return { registerContainer, retry, select, feed, special, setFollow, overview }
}
