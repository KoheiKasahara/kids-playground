// 3Dどうぶつえんの描画と時間の進行を受け持つフック。
// 動物のふるまいは behavior.ts、歩くモードの人の動きは walk.ts、観察のスタンプは zukan.ts（どれも純粋なロジック）、
// エリアの中身の組み立ては areaStage.ts、アニメーションの合成は animator.ts、演出は effects.ts が担当し、
// ここではそれらをつないで、カメラ・入力・資源を管理する。
//
// 重くしないための工夫:
// - 1度に1つのエリアだけを読み込んで描く。モデルは覚えておき、エリアを行き来しても読み直さない。
// - 画面外の動物は描かず、小さく映る動物は影を省いてアニメーションの更新を間引く。
// - 影を落とす範囲をエリア（歩くモードでは人のまわり）にしぼり、重い端末では解像度を下げる。

import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { observeGameActivity } from '../../utils/gameActivity'
import { buildStage, ModelCache, type Instance, type Stage } from './areaStage'
import { activityOf, command, dropFood, setVisitor, stepZoo, type Activity, type ZooEvent } from './behavior'
import { CAMERA_LIMITS, cameraPosition, follow, followAzimuth, fovFor, overviewPose, pushOutOfSpheres, segmentHitsSphere } from './cameraRig'
import { createEffects, createFood, disposeObject } from './effects'
import { playZooSound, type ZooSound } from './sounds'
import { SPECIES, type SpeciesId } from './species'
import {
  createVisitor, EYE_HEIGHT, facingEnclosure, planAutoWalk, PITCH_LIMIT, stepVisitor, viewSpot, walkable, walkInAt, WALK_FOV_EXTRA, WALK_SPEED,
  type VisitorState, type WalkInput,
} from './walk'
import { apparentSize, observe, WATCH_SIZE, type Sighting, type StampKind, type WatchState } from './zukan'
import { areaById, enclosureById, speciesOfArea, type Area, type AreaId } from './zooMap'

export type ZooStatus = 'loading' | 'ready' | 'error'
export type ViewMode = 'overview' | 'walk'
/** 「いま 〇〇してるよ」のお知らせ（まだスタンプのない、とくいわざ・ねている所）。 */
export type ZooHint = { id: string; species: SpeciesId; kind: StampKind }

export type ZooEngineOptions = {
  reducedMotion: boolean
  initialArea: AreaId
  onStatus: (status: ZooStatus) => void
  onProgress: (ratio: number) => void
  onArea: (area: AreaId) => void
  onSelect: (id: string | null) => void
  onFollow: (following: boolean) => void
  onMode: (mode: ViewMode) => void
  /** 歩くモードで、目の前にある展示場（えさを投げ入れられる）。 */
  onNearby?: (enclosure: string | null) => void
  /** 歩くモードの人の位置（小さな地図に使う。間引いて呼ぶ）。 */
  onVisitor?: (x: number, z: number, yaw: number) => void
  /** 選んでいる動物の、いましていること。 */
  onActivity?: (activity: Activity | null) => void
  /** 観察のスタンプの条件を満たした（新しいかどうかは呼出し側が決める）。 */
  onObserve?: (species: SpeciesId, kind: StampKind) => void
  onHint?: (hint: ZooHint | null) => void
  hasStamp?: (species: SpeciesId, kind: StampKind) => boolean
  /** スタンプを持っていても、いま見てほしいもの（おねがいのお題）。お知らせを出す。 */
  wanted?: (species: SpeciesId, kind: StampKind) => boolean
  onEvent?: (event: ZooEvent) => void
}

type Commands = {
  select: (id: string | null) => void
  feed: (species?: SpeciesId) => boolean
  setFollow: (following: boolean) => void
  overview: () => void
  setMode: (mode: ViewMode) => void
  setArea: (area: AreaId) => void
  walkInput: (input: WalkInput) => void
  /** その動物を見に行く（俯瞰では追いかけ、歩くモードでは見える場所まで歩く）。 */
  goTo: (id: string) => void
  /** 展示場の前まで歩く（歩くモード）。 */
  walkToEnclosure: (id: string) => void
}

type FoodView = {
  group: THREE.Group
  y: number
  vy: number
  heldBy?: string
  vanishAt?: number
  age: number
  /** 柵の外から投げ入れるときの放物線。 */
  toss?: { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number }
}
type Timeline = { id: string; clip: string; t: number; fired: Set<string> }
type Tween = { fromPos: THREE.Vector3; fromLook: THREE.Vector3; t: number; dur: number }

/** えさは、同じ種類に同時にこれより多く置かない（連打で増えすぎない）。 */
const MAX_FOOD = 2
/** これより小さく映る動物（画面の高さに対する割合）は、影を省き、アニメーションを間引く。 */
const SMALL = 0.045
/** 鳴き声・音を出すのは、このくらい以上の大きさで見えている動物（または選んでいる動物）。 */
const AUDIBLE = 0.035

function ease(k: number): number {
  return k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
}

export function useZooEngine(options: ZooEngineOptions) {
  const [container, registerContainer] = useState<HTMLDivElement | null>(null)
  const [generation, setGeneration] = useState(0)
  const optionsRef = useRef(options)
  const commands = useRef<Commands | null>(null)
  useEffect(() => { optionsRef.current = options }, [options])
  const retry = useCallback(() => setGeneration(g => g + 1), [])
  const select = useCallback((id: string | null) => commands.current?.select(id), [])
  const feed = useCallback((species?: SpeciesId) => commands.current?.feed(species) ?? false, [])
  const setFollow = useCallback((following: boolean) => commands.current?.setFollow(following), [])
  const overview = useCallback(() => commands.current?.overview(), [])
  const setMode = useCallback((mode: ViewMode) => commands.current?.setMode(mode), [])
  const setArea = useCallback((area: AreaId) => commands.current?.setArea(area), [])
  const walkInput = useCallback((input: WalkInput) => commands.current?.walkInput(input), [])
  const goTo = useCallback((id: string) => commands.current?.goTo(id), [])
  const walkToEnclosure = useCallback((id: string) => commands.current?.walkToEnclosure(id), [])

  useEffect(() => {
    if (!container) return
    const host = container
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#bfe7fb')
    scene.fog = new THREE.Fog('#cdeefb', 60, 150)
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 260)
    const hemi = new THREE.HemisphereLight('#e8f6ff', '#9fc46d', 1.55)
    const sun = new THREE.DirectionalLight('#fff3dc', 2.3)
    sun.castShadow = true
    sun.shadow.mapSize.set(1536, 1536)
    Object.assign(sun.shadow.camera, { near: 2, far: 110 })
    sun.shadow.normalBias = 0.04
    sun.shadow.bias = -0.0004
    sun.shadow.radius = 4
    scene.add(hemi, sun, sun.target)

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
    let stage: Stage | undefined
    let models: ModelCache | undefined
    let loadToken = 0
    /** 門をくぐって移る先（読み込みが終わるまで、同じ門で何度も移らない）。 */
    let pendingArea: AreaId | null = null
    const foods = new Map<number, FoodView>()
    const timelines: Timeline[] = []
    const watch: WatchState = new Map()
    const apparent = new Map<string, number>()
    let selected: string | null = null
    let following = false
    let mode: ViewMode = 'overview'
    let visitor: VisitorState | undefined
    let tween: Tween | undefined
    let returning = 0
    let zoomIn = 0
    /** 追いかけるときに回り込む方位角。追いかけ始めに一度決め、さえぎられたときだけ選び直す（毎フレーム選ぶと揺れる）。 */
    let followAz: number | null = null
    let hint: ZooHint | null = null
    let nearby: string | null = null
    let activity: Activity | null = null
    const keys = { forward: 0, back: 0, left: 0, right: 0 }
    let buttons: WalkInput = { forward: 0, turn: 0 }
    let released = false
    let lost = false
    let active = true
    let raf = 0
    let last = 0
    let clock = 0
    let slowTick = 0
    let pixelRatio = 1
    let slowFrames = 0
    let zzzClock = 0
    const frustum = new THREE.Frustum()
    const projScreen = new THREE.Matrix4()
    const tmp = new THREE.Vector3()
    const tmp2 = new THREE.Vector3()
    const look = new THREE.Vector3()
    const tmpQ = new THREE.Quaternion()
    const sphere = new THREE.Sphere()
    const raycaster = new THREE.Raycaster()
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const pointer = { x: 0, y: 0, t: 0, down: false, dragged: false, lastX: 0, lastY: 0, id: -1 }

    const area = (): Area | undefined => stage?.area
    const instanceOf = (id: string | null) => stage?.instances.find(i => i.state.id === id)

    function resize() {
      if (!renderer) return
      const w = Math.max(1, host.clientWidth)
      const h = Math.max(1, host.clientHeight)
      camera.aspect = w / h
      camera.fov = fovFor(camera.aspect) + (mode === 'walk' ? WALK_FOV_EXTRA : 0)
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(pixelRatio)
      renderer.setSize(w, h, false)
      effects.setScale(h * pixelRatio / (2 * Math.tan((camera.fov * Math.PI) / 360)))
    }

    /** 影を落とす範囲を、見ている所のまわりにしぼる（狭いほど影がくっきりし、軽い）。 */
    function fitShadow(cx: number, cz: number, extent: number) {
      const snap = 2
      const x = Math.round(cx / snap) * snap
      const z = Math.round(cz / snap) * snap
      sun.target.position.set(x, 0, z)
      sun.position.set(x + 20, 38, z + 24)
      const cam = sun.shadow.camera
      if (cam.right !== extent) {
        Object.assign(cam, { left: -extent, right: extent, top: extent, bottom: -extent })
        cam.updateProjectionMatrix()
      }
    }

    function applyAtmosphere() {
      const a = area()
      if (!a) return
      const sky = new THREE.Color(a.sky)
      scene.background = sky
      const fog = scene.fog as THREE.Fog
      fog.color.copy(sky).lerp(new THREE.Color('#ffffff'), 0.15)
      if (mode === 'walk') {
        fog.near = 26
        fog.far = 78
      } else {
        fog.near = a.radius * 2.2
        fog.far = a.radius * 5.4
      }
    }

    function overviewTarget(): { pos: THREE.Vector3; look: THREE.Vector3 } {
      const pose = overviewPose(camera.aspect, area()?.radius)
      return { pos: new THREE.Vector3(...cameraPosition(pose)), look: new THREE.Vector3(...pose.target) }
    }

    function applyOverview(instant: boolean) {
      if (!controls) return
      if (instant || optionsRef.current.reducedMotion) {
        const t = overviewTarget()
        controls.target.copy(t.look)
        camera.position.copy(t.pos)
        controls.update()
        returning = 0
      } else {
        returning = 1.2
      }
    }

    function walkPose(out: THREE.Vector3, lookOut: THREE.Vector3) {
      const v = visitor!
      const reduced = optionsRef.current.reducedMotion
      const pace = Math.min(1, Math.abs(v.speed) / WALK_SPEED)
      const bob = reduced ? 0 : Math.sin((v.walked * Math.PI * 2) / 1.5) * 0.03 * pace
      out.set(v.x, EYE_HEIGHT + bob, v.z)
      lookOut.set(Math.sin(v.yaw) * Math.cos(v.pitch), Math.sin(v.pitch), Math.cos(v.yaw) * Math.cos(v.pitch)).add(out)
    }

    function startTween(dur: number) {
      if (optionsRef.current.reducedMotion) {
        tween = undefined
        return
      }
      const fromLook = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(10).add(camera.position)
      tween = { fromPos: camera.position.clone(), fromLook, t: 0, dur }
    }

    function setSelected(id: string | null) {
      if (selected === id) return
      selected = id
      optionsRef.current.onSelect(id)
      activity = null
      optionsRef.current.onActivity?.(null)
      if (!id && following) setFollowing(false)
      else if (following) {
        // 追いかけている途中で別の動物を選んだら、その動物へ回り込み直す
        zoomIn = 1.4
        followAz = null
      }
    }

    function setFollowing(next: boolean) {
      const want = next && !!selected && mode === 'overview'
      if (following === want) return
      following = want
      zoomIn = following ? 1.4 : 0
      followAz = null
      if (!following) applyOverview(false)
      optionsRef.current.onFollow(following)
    }

    function setViewMode(next: ViewMode) {
      if (mode === next || !stage || !controls) return
      if (following) {
        following = false
        optionsRef.current.onFollow(false)
      }
      mode = next
      startTween(1.1)
      if (next === 'walk') {
        controls.enabled = false
        if (!visitor) visitor = createVisitor(stage.area)
        camera.far = 120
      } else {
        if (visitor) visitor.auto = undefined
        buttons = { forward: 0, turn: 0 }
        camera.far = 260
        returning = 0
        const t = overviewTarget()
        controls.target.copy(t.look)
        if (!tween) {
          camera.position.copy(t.pos)
          controls.update()
        }
        nearby = null
        optionsRef.current.onNearby?.(null)
      }
      resize()
      applyAtmosphere()
      optionsRef.current.onMode(next)
    }

    function headPosition(inst: Instance, out: THREE.Vector3) {
      if (inst.head) return inst.head.getWorldPosition(out).add(tmp2.set(0, 0.5 * inst.state.scale, 0))
      return out.set(inst.state.x, SPECIES[inst.state.species].manifest.bounds.height * inst.state.scale, inst.state.z)
    }

    function audible(inst: Instance): boolean {
      return inst.state.id === selected || (apparent.get(inst.state.id) ?? 0) > AUDIBLE
    }

    function doingKind(inst: Instance): StampKind | undefined {
      const a = inst.state
      if (a.mode === 'sleep' && a.sleep && a.sleep.stage !== 'up') return 'sleep'
      if (a.mode === 'act' && a.act?.plan.kind === 'special') return a.clip
      return undefined
    }

    function offerHint(inst: Instance, kind: StampKind) {
      const o = optionsRef.current
      if (hint || (o.hasStamp?.(inst.state.species, kind) && !o.wanted?.(inst.state.species, kind))) return
      // すでに大きく見えているなら、お知らせはいらない（そのまま見ればスタンプになる）
      if ((apparent.get(inst.state.id) ?? 0) >= WATCH_SIZE) return
      hint = { id: inst.state.id, species: inst.state.species, kind }
      o.onHint?.(hint)
    }

    function checkHint() {
      if (!hint) return
      const inst = instanceOf(hint.id)
      const o = optionsRef.current
      const still = inst && doingKind(inst) === hint.kind && (!o.hasStamp?.(hint.species, hint.kind) || !!o.wanted?.(hint.species, hint.kind))
      if (!still) {
        hint = null
        optionsRef.current.onHint?.(null)
      }
    }

    function handleEvent(e: ZooEvent) {
      const inst = instanceOf(e.animal)
      optionsRef.current.onEvent?.(e)
      if (!inst) return
      if (e.type === 'eat') {
        if (audible(inst)) playZooSound('munch')
        optionsRef.current.onObserve?.(inst.state.species, 'feed')
        const food = foods.get(e.foodId)
        const info = SPECIES[inst.state.species].manifest.clips.Eat
        if (food) {
          const hold = info.food ? info.food.release - info.food.grab : 0.6
          // 鼻先（ゾウ）や前足（パンダ）でつかんで口へ運ぶ動物は、その骨に付けて動かす。ほかはその場で食べる
          if (inst.hold && (info.food?.hold || info.food?.bone === 'trunk_tip')) food.heldBy = inst.state.id
          food.vanishAt = clock + hold
        }
      } else if (e.type === 'happy') {
        if (audible(inst)) playZooSound('happy')
        effects.burst('heart', headPosition(inst, tmp), 6)
      } else if (e.type === 'special') {
        timelines.push({ id: inst.state.id, clip: e.clip, t: 0, fired: new Set() })
        offerHint(inst, e.clip)
      } else if (e.type === 'asleep') {
        offerHint(inst, 'sleep')
      } else if (e.type === 'wake') {
        effects.burst('sparkle', headPosition(inst, tmp), 5)
      } else if (e.type === 'visit') {
        // 人を見に来た: 小さなハートで知らせる
        effects.burst('heart', headPosition(inst, tmp), 2)
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
          once('call', info.callStart ?? 0.8, () => { if (audible(inst)) playZooSound(sound) })
          if (tl.t > (info.callStart ?? 0.8) && tl.t < (info.callEnd ?? (info.callStart ?? 0.8) + 1) && Math.random() < dt * 5) {
            effects.burst('note', inst.tip ? inst.tip.getWorldPosition(tmp) : headPosition(inst, tmp), 1)
          }
        }
        if (info.effect === 'water' && inst.tip) {
          once('splash', info.sprayStart ?? 2, () => { if (audible(inst)) playZooSound('splash') })
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

    function clearFoods() {
      for (const food of foods.values()) {
        scene.remove(food.group)
        disposeObject(food.group)
      }
      foods.clear()
    }

    function updateFoods(dt: number) {
      for (const [id, food] of foods) {
        food.age += dt
        if (food.toss) {
          const s = food.toss
          s.t += dt
          const k = Math.min(1, s.t / s.dur)
          food.group.position.lerpVectors(s.from, s.to, k)
          food.group.position.y += Math.sin(Math.PI * k) * 1.4
          food.group.rotation.y += dt * 8
          if (k >= 1) {
            food.toss = undefined
            food.y = 0
            food.vy = 1.6
          }
        } else if (food.heldBy) {
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

    function updateOverviewCamera(dt: number) {
      if (!controls) return
      const reduced = optionsRef.current.reducedMotion
      const canopies = stage?.scenery.canopies ?? []
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
            const k2 = reduced ? 1 : follow(2.5, dt)
            const r = offset.length()
            const polar = Math.acos(Math.max(-1, Math.min(1, offset.y / Math.max(r, 1e-6))))
            const az = Math.atan2(offset.x, offset.z)
            const target: [number, number, number] = [controls.target.x, controls.target.y, controls.target.z]
            const blocked = followAz !== null && canopies.some(s =>
              segmentHitsSphere(cameraPosition({ target, distance: want, polar: 1.0, azimuth: followAz! }), target, s))
            if (followAz === null || blocked) followAz = followAzimuth(target, inst.state.heading, want, 1.0, canopies)
            const dAz = Math.atan2(Math.sin(followAz - az), Math.cos(followAz - az))
            const nr = r + (want - r) * k2
            const np = polar + (1.0 - polar) * k2
            const na = az + dAz * k2
            offset.set(Math.sin(np) * Math.sin(na) * nr, Math.cos(np) * nr, Math.sin(np) * Math.cos(na) * nr)
            camera.position.copy(controls.target).add(offset)
          }
        }
      } else if (returning > 0) {
        returning -= dt
        const t = overviewTarget()
        const k = follow(3.5, dt)
        controls.target.lerp(t.look, k)
        camera.position.lerp(t.pos, k)
      }
      controls.update()
      const pushed = pushOutOfSpheres([camera.position.x, camera.position.y, camera.position.z], canopies)
      camera.position.set(...pushed)
    }

    function updateCamera(dt: number) {
      if (mode === 'walk' && visitor) walkPose(tmp, look)
      if (tween) {
        tween.t += dt
        const k = ease(Math.min(1, tween.t / tween.dur))
        if (mode === 'overview') {
          const t = overviewTarget()
          tmp.copy(t.pos)
          look.copy(t.look)
        }
        camera.position.lerpVectors(tween.fromPos, tmp, k)
        camera.lookAt(tmp2.lerpVectors(tween.fromLook, look, k))
        if (tween.t >= tween.dur) {
          tween = undefined
          if (mode === 'overview' && controls) {
            controls.enabled = true
            controls.target.copy(look)
            controls.update()
          }
        }
        return
      }
      if (mode === 'walk') {
        camera.position.copy(tmp)
        camera.lookAt(look)
        return
      }
      if (controls && !controls.enabled) controls.enabled = true
      updateOverviewCamera(dt)
    }

    function updateAnimals(dt: number) {
      if (!stage) return
      projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      frustum.setFromProjectionMatrix(projScreen)
      const sightings: Sighting[] = []
      for (const inst of stage.instances) {
        const a = inst.state
        inst.root.position.set(a.x, 0, a.z)
        inst.root.rotation.y = a.heading
        const { length, height } = SPECIES[a.species].manifest.bounds
        sphere.center.set(a.x, height * a.scale * 0.5, a.z)
        sphere.radius = Math.max(length, height) * a.scale * 0.6
        const visible = frustum.intersectsSphere(sphere)
        const dist = camera.position.distanceTo(sphere.center)
        const size = visible ? apparentSize(inst.size, dist, camera.fov) : 0
        apparent.set(a.id, size)
        // 画面外の動物は描かない（影が画面に入る分だけ広めに判定する）。霧の向こうも描かない
        sphere.radius += 2.5
        const fogFar = (scene.fog as THREE.Fog).far
        inst.root.visible = frustum.intersectsSphere(sphere) && dist < fogFar + 4
        // 小さく映る動物は、影を省き、アニメーションの更新を 20 回/秒に抑える
        const small = size < SMALL
        for (const m of inst.meshes) m.castShadow = !small
        inst.skipped += dt
        if ((visible && (!small || inst.skipped >= 0.05)) || inst.skipped > 0.12) {
          inst.animator.update(inst.skipped, a)
          inst.skipped = 0
        }
        const kind = doingKind(inst)
        sightings.push({
          id: a.id, species: a.species, size,
          doing: kind === 'sleep' ? { kind: 'sleep' } : kind ? { kind: 'special', clip: kind } : undefined,
        })
      }
      for (const f of observe(watch, dt, sightings)) optionsRef.current.onObserve?.(f.species, f.kind)
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
        for (const inst of stage.instances) {
          if (inst.state.mode === 'sleep' && inst.state.sleep?.stage === 'asleep' && inst.root.visible) {
            effects.burst('sleep', headPosition(inst, tmp), 1)
            if (inst.state.id === selected && (following || mode === 'walk')) playZooSound('snore')
          }
        }
      }
    }

    /** ゆっくり変わる状態（目の前の展示場・選んだ動物の様子・地図の位置・お知らせ）を間引いて知らせる。 */
    function reportSlow() {
      const o = optionsRef.current
      const a = area()
      if (mode === 'walk' && visitor && a) {
        const e = facingEnclosure(a, visitor)
        const id = e?.id ?? null
        if (id !== nearby) {
          nearby = id
          o.onNearby?.(id)
        }
        o.onVisitor?.(visitor.x, visitor.z, visitor.yaw)
      }
      const sel = instanceOf(selected)
      const next = sel ? activityOf(sel.state) : null
      if (next !== activity) {
        activity = next
        o.onActivity?.(next)
      }
      checkHint()
    }

    function frame(now: number) {
      raf = 0
      if (released || lost || !active || !renderer) return
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60)
      last = now
      clock += dt
      if (stage) {
        const world = stage.world
        if (mode === 'walk' && visitor) {
          const input: WalkInput = {
            forward: Math.max(-1, Math.min(1, buttons.forward + keys.forward - keys.back)),
            turn: Math.max(-1, Math.min(1, buttons.turn + keys.left - keys.right)),
          }
          // ふれあい広場の中では、動物にぶつからない
          const inside = walkInAt(stage.area, visitor)
          const bodies = inside ? stage.world.animals.filter(a => a.enclosure === inside.id).map(a => ({ x: a.x, z: a.z, r: a.radius * 0.8 })) : []
          const exit = pendingArea ? undefined : stepVisitor(stage.area, visitor, input, dt, bodies)
          setVisitor(world, { x: visitor.x, z: visitor.z })
          if (exit) void enterArea(exit.to, stage.area.id)
        } else {
          setVisitor(world, null)
        }
        const events = stepZoo(world, dt, Math.random)
        for (const e of events) handleEvent(e)
        updateAnimals(dt)
        runTimelines(dt)
        updateFoods(dt)
        stage.scenery.update(clock)
        if (mode === 'walk' && visitor) fitShadow(visitor.x + Math.sin(visitor.yaw) * 8, visitor.z + Math.cos(visitor.yaw) * 8, 18)
        else fitShadow(0, 0, stage.area.radius + 2)
        slowTick += dt
        if (slowTick > 0.15) {
          slowTick = 0
          reportSlow()
        }
      }
      effects.update(dt)
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

    /** エリアへ入る（モデルをそろえて、景色と動物を作り直す）。from は来たエリア（門をくぐったとき）。 */
    async function enterArea(id: AreaId, from?: AreaId) {
      if (!renderer || !models) return
      const token = ++loadToken
      pendingArea = id
      const next = areaById(id)
      const o = optionsRef.current
      o.onStatus('loading')
      o.onProgress(0)
      const species = speciesOfArea(next)
      let loaded
      try {
        loaded = await models.load(species, r => { if (token === loadToken) optionsRef.current.onProgress(r) })
      } catch {
        if (!released && token === loadToken) {
          pendingArea = null
          optionsRef.current.onStatus('error')
        }
        return
      }
      if (released || token !== loadToken) return
      pendingArea = null
      // 前のエリアを片付ける
      clearFoods()
      timelines.length = 0
      watch.clear()
      apparent.clear()
      stage?.dispose()
      if (hint) {
        hint = null
        optionsRef.current.onHint?.(null)
      }
      setSelected(null)
      stage = buildStage(scene, next, loaded, Math.random)
      void models.release(species)
      renderer.renderLists.dispose()
      const gate = from ? next.exits.find(x => x.to === from) : undefined
      visitor = createVisitor(next, gate)
      nearby = null
      optionsRef.current.onNearby?.(null)
      applyAtmosphere()
      tween = undefined
      if (mode === 'overview') applyOverview(true)
      else {
        walkPose(camera.position, look)
        camera.lookAt(look)
      }
      optionsRef.current.onArea(id)
      optionsRef.current.onProgress(1)
      optionsRef.current.onStatus(lost ? 'error' : 'ready')
      schedule()
    }

    function pick(clientX: number, clientY: number): Instance | undefined {
      if (!renderer || !stage) return undefined
      const rect = renderer.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      let best: Instance | undefined
      let bestDist = Infinity
      for (const inst of stage.instances) {
        const a = inst.state
        for (const h of SPECIES[a.species].hit) {
          const s = a.scale
          sphere.center.set(a.x + Math.sin(a.heading) * h.z * s, h.y * s, a.z + Math.cos(a.heading) * h.z * s)
          // 歩くモードでは遠くの動物もタップしやすいよう、判定を少し大きくする
          sphere.radius = h.r * s * (mode === 'walk' ? 1.4 : 1.15)
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

    /** 歩くモードで、その動物が見える場所へ歩いて行く。 */
    function walkToAnimal(inst: Instance) {
      if (!stage || !visitor) return
      const e = enclosureById(stage.area, inst.state.enclosure)
      const spot = viewSpot(stage.area, e, visitor, inst.state)
      visitor.auto = planAutoWalk(stage.area, visitor, spot, { x: inst.state.x, z: inst.state.z })
    }

    function walkTap(clientX: number, clientY: number) {
      if (!renderer || !stage || !visitor) return
      const rect = renderer.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const p = raycaster.ray.intersectPlane(groundPlane, tmp)
      if (!p) return
      const point = { x: p.x, z: p.z }
      const a = stage.area
      const fenced = a.enclosures.find(e => !e.walkIn && Math.hypot(point.x - e.center.x, point.z - e.center.z) < e.radius)
      if (fenced) {
        visitor.auto = planAutoWalk(a, visitor, viewSpot(a, fenced, visitor, point), point)
      } else if (walkable(a, point) || walkInAt(a, point)) {
        visitor.auto = planAutoWalk(a, visitor, point)
      }
    }

    function onPointerDown(e: PointerEvent) {
      Object.assign(pointer, { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, t: performance.now(), down: true, dragged: false, id: e.pointerId })
    }
    function onPointerMove(e: PointerEvent) {
      if (!pointer.down || e.pointerId !== pointer.id) return
      if (Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 8) pointer.dragged = true
      if (mode === 'walk' && visitor && pointer.dragged && !tween) {
        // 景色をつかんで動かすように見回す（右へなぞると左を向く）
        visitor.yaw += (e.clientX - pointer.lastX) * 0.0055
        visitor.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, visitor.pitch + (e.clientY - pointer.lastY) * 0.004))
        visitor.auto = undefined
      }
      pointer.lastX = e.clientX
      pointer.lastY = e.clientY
    }
    function onPointerUp(e: PointerEvent) {
      if (!pointer.down || e.pointerId !== pointer.id) return
      pointer.down = false
      if (pointer.dragged || performance.now() - pointer.t > 600) return
      const inst = pick(e.clientX, e.clientY)
      if (mode === 'walk') {
        if (inst) {
          if (selected !== inst.state.id) {
            setSelected(inst.state.id)
            playZooSound('select')
            effects.burst('sparkle', headPosition(inst, tmp), 4)
          } else if (stage) {
            command(stage.world, inst.state.id, { kind: 'react' }, Math.random)
          }
          // まだ遠ければ、見える所まで歩く
          if (visitor && Math.hypot(inst.state.x - visitor.x, inst.state.z - visitor.z) > 9) walkToAnimal(inst)
        } else {
          walkTap(e.clientX, e.clientY)
        }
        return
      }
      if (!inst || !stage) {
        setSelected(null)
        return
      }
      if (selected === inst.state.id) {
        command(stage.world, inst.state.id, { kind: 'react' }, Math.random)
      } else {
        setSelected(inst.state.id)
        playZooSound('select')
        effects.burst('sparkle', headPosition(inst, tmp), 4)
      }
    }
    function onPointerCancel() {
      pointer.down = false
    }
    const KEYMAP: Record<string, keyof typeof keys> = {
      ArrowUp: 'forward', KeyW: 'forward', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    }
    function onKey(e: KeyboardEvent) {
      const k = KEYMAP[e.code]
      if (!k || mode !== 'walk') return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.closest('[role="dialog"]'))) return
      keys[k] = e.type === 'keydown' ? 1 : 0
      e.preventDefault()
    }
    function clearKeys() {
      keys.forward = keys.back = keys.left = keys.right = 0
      buttons = { forward: 0, turn: 0 }
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
      renderer.domElement.addEventListener('pointermove', onPointerMove)
      renderer.domElement.addEventListener('pointerup', onPointerUp)
      renderer.domElement.addEventListener('pointercancel', onPointerCancel)
      window.addEventListener('keydown', onKey)
      window.addEventListener('keyup', onKey)
      window.addEventListener('blur', clearKeys)
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
      models = new ModelCache()
    } catch {
      optionsRef.current.onStatus('error')
    }

    commands.current = {
      select(id) {
        if (!stage) return
        setSelected(id)
        const inst = instanceOf(id)
        if (inst) {
          playZooSound('select')
          effects.burst('sparkle', headPosition(inst, tmp), 4)
        }
      },
      feed(species) {
        if (!stage) return false
        const world = stage.world
        let id = selected
        let from: { x: number; z: number } | undefined
        if (mode === 'walk' && visitor) {
          // 目の前の展示場の、その種類でいちばん近い動物に投げ入れる
          const e = facingEnclosure(stage.area, visitor, 9)
          const want = species ?? instanceOf(selected)?.state.species
          const candidates = world.animals.filter(a => a.species === want && (!e || a.enclosure === e.id))
          const near = candidates.sort((a, b) => Math.hypot(a.x - visitor!.x, a.z - visitor!.z) - Math.hypot(b.x - visitor!.x, b.z - visitor!.z))[0]
          if (!near) return false
          id = near.id
          from = walkInAt(stage.area, visitor) ? undefined : { x: visitor.x, z: visitor.z }
        }
        const target = world.animals.find(a => a.id === id)
        if (!target) return false
        if (world.foods.filter(f => f.species === target.species && !f.eaten).length >= MAX_FOOD) return false
        const food = dropFood(world, target.id, Math.random, from)
        if (!food) return false
        const group = createFood(SPECIES[food.species].food.id)
        // えさの大きさは、置くときに食べる動物の大きさへ合わせる（持ち上げた瞬間に縮まない）
        group.scale.setScalar(Math.max(0.6, target.scale))
        scene.add(group)
        if (from && visitor) {
          // 柵の外から、放物線をえがいて投げ入れる
          walkPose(tmp, look)
          const start = tmp.clone().add(new THREE.Vector3(Math.sin(visitor.yaw) * 0.5, -0.35, Math.cos(visitor.yaw) * 0.5))
          group.position.copy(start)
          foods.set(food.id, { group, y: 0, vy: 0, age: 0, toss: { from: start, to: new THREE.Vector3(food.x, 0, food.z), t: 0, dur: 0.75 } })
        } else {
          group.position.set(food.x, 3.2, food.z)
          foods.set(food.id, { group, y: 3.2, vy: 0, age: 0 })
        }
        playZooSound('drop')
        return true
      },
      setFollow(next) {
        setFollowing(next)
      },
      overview() {
        setFollowing(false)
        setSelected(null)
        applyOverview(false)
      },
      setMode(next) {
        setViewMode(next)
      },
      setArea(id) {
        if (stage?.area.id === id) return
        if (following) setFollowing(false)
        void enterArea(id)
      },
      walkInput(input) {
        buttons = input
      },
      goTo(id) {
        const inst = instanceOf(id)
        if (!inst) return
        setSelected(id)
        if (mode === 'walk') walkToAnimal(inst)
        else setFollowing(true)
      },
      walkToEnclosure(id) {
        if (!stage || !visitor || mode !== 'walk') return
        const e = stage.area.enclosures.find(x => x.id === id)
        if (!e) return
        visitor.auto = planAutoWalk(stage.area, visitor, viewSpot(stage.area, e, visitor), e.walkIn ? undefined : e.center)
      },
    }

    if (renderer && models) {
      void enterArea(optionsRef.current.initialArea).then(() => {
        if (released || stopActivity) return
        stopActivity = observeGameActivity(next => {
          active = next
          if (next) schedule()
          else clearKeys()
        })
      })
    }

    return () => {
      released = true
      commands.current = null
      cancelAnimationFrame(raf)
      stopActivity?.()
      observer?.disconnect()
      window.removeEventListener('resize', onWindowResize)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', clearKeys)
      controls?.removeEventListener('start', onControlsStart)
      controls?.dispose()
      if (renderer) {
        renderer.domElement.removeEventListener('webglcontextlost', contextLost)
        renderer.domElement.removeEventListener('webglcontextrestored', contextRestored)
        renderer.domElement.removeEventListener('pointerdown', onPointerDown)
        renderer.domElement.removeEventListener('pointermove', onPointerMove)
        renderer.domElement.removeEventListener('pointerup', onPointerUp)
        renderer.domElement.removeEventListener('pointercancel', onPointerCancel)
      }
      clearFoods()
      stage?.dispose()
      void models?.dispose()
      effects.dispose()
      selectionRing.geometry.dispose()
      ;(selectionRing.material as THREE.Material).dispose()
      sun.shadow.map?.dispose()
      renderer?.dispose()
      renderer?.domElement.remove()
    }
  }, [container, generation])

  return { registerContainer, retry, select, feed, setFollow, overview, setMode, setArea, walkInput, goTo, walkToEnclosure }
}
