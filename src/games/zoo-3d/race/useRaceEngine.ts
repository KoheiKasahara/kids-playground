// どうぶつレース場の描画と時間の進行を受け持つフック。
// 勝ち負けと進み方は raceSim.ts（純粋なロジック）が先に決め、ここでは それを再生する:
// 動物のモデルとアニメーション・カメラの中継（うしろ・まえ・ゴール）・水しぶきや つちけむり・表彰台。
// 受付では、係のサルが出むかえる。モデルは覚えておき、同じレースを もういちど見るときは読み直さない。

import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { observeGameActivity } from '../../../utils/gameActivity'
import { AnimalAnimator } from '../animator'
import { ModelCache } from '../areaStage'
import { fovFor, follow } from '../cameraRig'
import { createEffects } from '../effects'
import { playZooSound, type ZooSound } from '../sounds'
import { SPECIES, type SpeciesId } from '../species'
import { ATHLETES } from './athletes'
import { pointAt, type CoursePath } from './course'
import { LANE_COLORS, raceById, waterDepth, type RaceDef } from './races'
import { coursePath, poseAt, rankingAt, type RaceEvent, type RacePlan } from './raceSim'
import {
  createRaceScenery, createReceptionScenery, hopHeight, laneOffset, trackHalfWidth, WATER_LEVEL,
  type RaceScenery, type ReceptionScenery,
} from './raceScenery'

export type RaceStatus = 'loading' | 'ready' | 'error'

export type RaceEngineOptions = {
  reducedMotion: boolean
  onStatus: (status: RaceStatus) => void
  onProgress: (ratio: number) => void
  /** 再生中の できごと（start に渡した じっきょう）。 */
  onEvent?: (event: RaceEvent) => void
  /** いまの順位（plan.runners の番号）と、トップの進み具合（0〜1）。間引いて呼ぶ。 */
  onRanking?: (order: number[], progress: number) => void
  /** みんなが ゴールした（または打ち切り）。 */
  onFinish?: () => void
}

type Request = { kind: 'reception' } | { kind: 'prepare'; plan: RacePlan }

type Commands = {
  showReception: () => void
  prepare: (plan: RacePlan) => void
  start: (narration: RaceEvent[]) => void
  showPodium: () => void
  setCheer: (index: number | null) => void
}

type AnimState = { clip: string; clipToken: number; speed: number; turnRate: number; mode: 'move' }

type Runner = {
  species: SpeciesId
  root: THREE.Group
  animator: AnimalAnimator
  anim: AnimState
  tag: THREE.Sprite
  meshes: THREE.Mesh[]
  height: number
  length: number
  head?: THREE.Object3D
  heading: number
  dust: number
  wet: boolean
  sounds: Set<number>
}

type CourseStage = {
  race: RaceDef
  path: CoursePath
  scenery: RaceScenery
  runners: Map<SpeciesId, Runner>
}

type Reception = { scenery: ReceptionScenery; clerk?: Runner; clap: number }

/** 泳ぎ方: もぐる（ペンギン）・うく（ワニ）・あるく（フラミンゴ）・いぬかき（ほか）。 */
function swimStyle(id: SpeciesId): 'dive' | 'float' | 'wade' | 'paddle' {
  if (id === 'penguin') return 'dive'
  if (id === 'crocodile') return 'float'
  if (id === 'flamingo') return 'wade'
  return 'paddle'
}

function lerpAngle(a: number, b: number, k: number): number {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k
}

function laneTexture(lane: number): THREE.Texture {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : undefined
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return new THREE.Texture()
  canvas.width = canvas.height = 128
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(64, 64, 60, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = LANE_COLORS[lane % LANE_COLORS.length]
  ctx.beginPath()
  ctx.arc(64, 64, 52, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 76px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 8
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.strokeText(String(lane + 1), 64, 70)
  ctx.fillText(String(lane + 1), 64, 70)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function useRaceEngine(options: RaceEngineOptions) {
  const [container, registerContainer] = useState<HTMLDivElement | null>(null)
  const [generation, setGeneration] = useState(0)
  const optionsRef = useRef(options)
  const commands = useRef<Commands | null>(null)
  /** 最後に頼まれた場面（読み直し・やりなおしのときに もう一度出す）。 */
  const request = useRef<Request>({ kind: 'reception' })
  useEffect(() => { optionsRef.current = options }, [options])
  const retry = useCallback(() => setGeneration(g => g + 1), [])
  const showReception = useCallback(() => {
    request.current = { kind: 'reception' }
    commands.current?.showReception()
  }, [])
  const prepare = useCallback((plan: RacePlan) => {
    request.current = { kind: 'prepare', plan }
    commands.current?.prepare(plan)
  }, [])
  const start = useCallback((narration: RaceEvent[]) => commands.current?.start(narration), [])
  const showPodium = useCallback(() => commands.current?.showPodium(), [])
  const setCheer = useCallback((index: number | null) => commands.current?.setCheer(index), [])

  useEffect(() => {
    if (!container) return
    const host = container
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#c6ecfb')
    scene.fog = new THREE.Fog('#d4f0fb', 70, 170)
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 300)
    const hemi = new THREE.HemisphereLight('#e8f6ff', '#9fc46d', 1.55)
    const sun = new THREE.DirectionalLight('#fff3dc', 2.3)
    sun.castShadow = true
    sun.shadow.mapSize.set(1536, 1536)
    Object.assign(sun.shadow.camera, { near: 2, far: 120 })
    sun.shadow.normalBias = 0.04
    sun.shadow.bias = -0.0004
    sun.shadow.radius = 4
    scene.add(hemi, sun, sun.target)
    const effects = createEffects()
    scene.add(effects.group)
    const cheerRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.9, depthWrite: false }))
    cheerRing.visible = false
    cheerRing.renderOrder = 4
    scene.add(cheerRing)
    const laneTextures = LANE_COLORS.map((_, i) => laneTexture(i))

    let renderer: THREE.WebGLRenderer | undefined
    let models: ModelCache | undefined
    let course: CourseStage | undefined
    let reception: Reception | undefined
    let plan: RacePlan | undefined
    /** plan.runners の番号 → 動物。 */
    let lineup: Runner[] = []
    let view: 'none' | 'reception' | 'gate' | 'race' | 'podium' = 'none'
    let loadToken = 0
    let playT = 0
    let viewT = 0
    let narration: RaceEvent[] = []
    let nextEvent = 0
    let finished = false
    let rankTick = 0
    let cheer: number | null = null
    let shot: 'chase' | 'front' | 'finish' = 'chase'
    let excitement = 0
    let splashAt = -1
    let released = false
    let lost = false
    let active = true
    let raf = 0
    let last = 0
    let clock = 0
    let pixelRatio = 1
    let slowFrames = 0
    const camPos = new THREE.Vector3(0, 6, 12)
    const camLook = new THREE.Vector3()
    const wantPos = new THREE.Vector3()
    const wantLook = new THREE.Vector3()
    const tmp = new THREE.Vector3()
    const tmp2 = new THREE.Vector3()

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

    function fitShadow(cx: number, cz: number, extent: number) {
      const x = Math.round(cx / 2) * 2
      const z = Math.round(cz / 2) * 2
      sun.target.position.set(x, 0, z)
      sun.position.set(x + 22, 40, z + 26)
      const cam = sun.shadow.camera
      if (cam.right !== extent) {
        Object.assign(cam, { left: -extent, right: extent, top: extent, bottom: -extent })
        cam.updateProjectionMatrix()
      }
    }

    function setSky(color: string) {
      const sky = new THREE.Color(color)
      scene.background = sky
      ;(scene.fog as THREE.Fog).color.copy(sky).lerp(new THREE.Color('#ffffff'), 0.15)
    }

    function makeRunner(id: SpeciesId, gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }): Runner {
      const model = cloneSkinned(gltf.scene)
      const meshes: THREE.Mesh[] = []
      model.traverse(o => {
        const mesh = o as THREE.SkinnedMesh
        if (mesh.isMesh) {
          meshes.push(mesh)
          mesh.castShadow = true
          mesh.frustumCulled = false
          const material = mesh.material as THREE.MeshStandardMaterial
          material.roughness = 0.78
          material.metalness = 0
        }
      })
      const root = new THREE.Group()
      root.name = `race-animal-${id}`
      root.rotation.order = 'YXZ'
      root.add(model)
      scene.add(root)
      const manifest = SPECIES[id].manifest
      const animator = new AnimalAnimator(new THREE.AnimationMixer(model), gltf.animations, manifest, 1)
      // 名札（ゼッケン）は、看板や木の むこうでも見えるように いちばん上に描く
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: laneTextures[0], depthWrite: false, depthTest: false, transparent: true }))
      tag.scale.setScalar(0.85)
      tag.renderOrder = 6
      tag.visible = false
      scene.add(tag)
      return {
        species: id, root, animator, tag, meshes,
        anim: { clip: 'Idle', clipToken: 0, speed: 0, turnRate: 0, mode: 'move' },
        height: manifest.bounds.height,
        length: manifest.bounds.length,
        head: model.getObjectByName('head') ?? undefined,
        heading: 0, dust: 0, wet: false, sounds: new Set(),
      }
    }

    function disposeRunner(r: Runner) {
      r.animator.dispose()
      scene.remove(r.root)
      scene.remove(r.tag)
      r.root.traverse(o => (o as THREE.SkinnedMesh).skeleton?.dispose())
      ;(r.tag.material as THREE.Material).dispose()
    }

    function clearStage() {
      if (course) {
        for (const r of course.runners.values()) disposeRunner(r)
        scene.remove(course.scenery.group)
        course.scenery.dispose()
        course = undefined
      }
      if (reception) {
        if (reception.clerk) disposeRunner(reception.clerk)
        scene.remove(reception.scenery.group)
        reception.scenery.dispose()
        reception = undefined
      }
      lineup = []
      plan = undefined
      cheerRing.visible = false
      renderer?.renderLists.dispose()
    }

    function headOf(r: Runner, out: THREE.Vector3): THREE.Vector3 {
      if (r.head) return r.head.getWorldPosition(out).add(tmp2.set(0, 0.4, 0))
      return out.copy(r.root.position).add(tmp2.set(0, r.height, 0))
    }

    // ---------------------------------------------------------------------
    // 場面を用意する

    async function enterReception() {
      if (!renderer || !models) return
      const token = ++loadToken
      const o = optionsRef.current
      o.onStatus('loading')
      o.onProgress(0)
      let loaded
      try {
        loaded = await models.load(['monkey'], r => { if (token === loadToken) optionsRef.current.onProgress(r) })
      } catch {
        if (!released && token === loadToken) optionsRef.current.onStatus('error')
        return
      }
      if (released || token !== loadToken) return
      clearStage()
      const scenery = createReceptionScenery()
      scene.add(scenery.group)
      const clerk = makeRunner('monkey', loaded.get('monkey')!)
      clerk.root.position.set(scenery.clerk.x, scenery.clerk.y, scenery.clerk.z)
      clerk.root.rotation.y = scenery.clerk.heading
      reception = { scenery, clerk, clap: 1.2 }
      void models.release(['monkey'])
      setSky('#c6ecfb')
      ;(scene.fog as THREE.Fog).near = 40
      ;(scene.fog as THREE.Fog).far = 110
      fitShadow(1, -3, 16)
      view = 'reception'
      viewT = 0
      placeCamera(true)
      optionsRef.current.onProgress(1)
      optionsRef.current.onStatus(lost ? 'error' : 'ready')
      schedule()
    }

    async function enterCourse(next: RacePlan) {
      if (!renderer || !models) return
      const race = raceById(next.race)
      const token = ++loadToken
      const o = optionsRef.current
      if (!course || course.race.id !== race.id) {
        o.onStatus('loading')
        o.onProgress(0)
        let loaded
        try {
          loaded = await models.load(race.runners, r => { if (token === loadToken) optionsRef.current.onProgress(r) })
        } catch {
          if (!released && token === loadToken) optionsRef.current.onStatus('error')
          return
        }
        if (released || token !== loadToken) return
        clearStage()
        const scenery = createRaceScenery(race)
        scene.add(scenery.group)
        const runners = new Map<SpeciesId, Runner>()
        for (const id of race.runners) runners.set(id, makeRunner(id, loaded.get(id)!))
        course = { race, path: coursePath(race.course), scenery, runners }
        void models.release(race.runners)
        setSky(race.course.theme.sky)
        ;(scene.fog as THREE.Fog).near = 60
        ;(scene.fog as THREE.Fog).far = 170
      }
      if (released || token !== loadToken || !course) return
      plan = next
      lineup = next.runners.map(r => course!.runners.get(r.species)!)
      lineup.forEach((r, i) => {
        const lane = next.runners[i].lane
        const material = r.tag.material as THREE.SpriteMaterial
        material.map = laneTextures[lane]
        material.needsUpdate = true
        r.tag.visible = true
        r.sounds.clear()
        r.wet = false
        r.anim.clipToken = 0
        r.heading = pointAt(course!.path, 0).heading
      })
      playT = 0
      finished = false
      narration = []
      nextEvent = 0
      excitement = 0
      view = 'gate'
      viewT = optionsRef.current.reducedMotion ? 10 : 0
      updateRunners(0)
      placeCamera(true)
      optionsRef.current.onProgress(1)
      optionsRef.current.onStatus(lost ? 'error' : 'ready')
      schedule()
    }

    // ---------------------------------------------------------------------
    // 動物を動かす

    function updateRunners(dt: number) {
      if (!course || !plan) return
      const race = course.race
      const c = race.course
      const t = view === 'race' ? playT : -1
      const hop = hopHeight(race)
      lineup.forEach((r, i) => {
        const rp = plan!.runners[i]
        const pose = poseAt(plan!, c, i, t)
        const offset = laneOffset(race, rp.lane)
        const p = pointAt(course!.path, pose.s, offset)
        const k = dt > 0 ? follow(10, dt) : 1
        const before = r.heading
        r.heading = lerpAngle(r.heading, p.heading, k)
        const turnRate = dt > 0 ? (r.heading - before) / dt : 0
        const depth = waterDepth(c, pose.s)
        const style = swimStyle(r.species)
        let y = pose.hop * hop
        let pitch = pose.trip * 0.45
        let clip = pose.clip
        let token = pose.token
        let animSpeed = pose.speed
        const moving = clip === 'Run' || clip === 'Walk'
        if (depth > 0 && moving) {
          if (style === 'dive') {
            // ペンギンは水に もぐって、つばさで とぶように およぐ
            pitch = 1.35 * depth
            y = 0.05 - 0.22 * depth + Math.sin(playT * 5 + i) * 0.05 * depth
            clip = 'Flap'
            token = 500 + Math.floor(playT / 1.3)
          } else if (style === 'float') {
            y = -0.22 * depth
            animSpeed = pose.speed * 0.4
            clip = 'Walk'
          } else if (style === 'wade') {
            y = -0.32 * depth
          } else {
            y = -r.height * 0.55 * depth
            animSpeed = pose.speed * 0.45
            clip = 'Walk'
          }
        } else if (pose.terrain === 'ice' && ATHLETES[r.species].slide && r.species === 'penguin' && moving && pose.speed > 0.6) {
          // こおりの上は おなかで すべる
          pitch = 1.3
          y = 0.12
          clip = 'Idle'
        } else if (pose.terrain === 'mud') {
          y -= 0.1
        }
        r.root.position.set(p.x, y, p.z)
        r.root.rotation.set(pitch, r.heading, 0)
        r.anim.clip = clip
        r.anim.clipToken = token
        r.anim.speed = animSpeed
        r.anim.turnRate = turnRate
        if (dt > 0) r.animator.update(dt, r.anim)
        r.tag.position.set(p.x, Math.max(0, y) + r.height + 0.55, p.z)

        if (view !== 'race' || dt <= 0) return
        // 水しぶき・つちけむり
        r.dust -= dt
        const fx = Math.sin(r.heading)
        const fz = Math.cos(r.heading)
        if (depth > 0.3 && pose.speed > 0.4) {
          if (r.dust <= 0) {
            r.dust = 0.09
            tmp.set(p.x - fx * r.length * 0.3, WATER_LEVEL + 0.05, p.z - fz * r.length * 0.3)
            effects.spray(tmp, tmp2.set(-fx * 0.4, 1, -fz * 0.4).normalize(), 2)
          }
        } else if (pose.speed > 1.6 && (pose.terrain === 'dirt' || pose.terrain === 'trail' || pose.terrain === 'mud' || pose.terrain === 'bush')) {
          if (r.dust <= 0) {
            r.dust = pose.terrain === 'mud' ? 0.1 : 0.16
            tmp.set(p.x - fx * r.length * 0.45, 0.12, p.z - fz * r.length * 0.45)
            effects.spray(tmp, tmp2.set(-fx * 0.5, 0.7, -fz * 0.5).normalize(), pose.terrain === 'mud' ? 2 : 1, 'dust')
          }
        }
        const wet = depth > 0.3
        if (wet && !r.wet && playT - splashAt > 0.35) {
          splashAt = playT
          playZooSound('splash')
          effects.spray(tmp.set(p.x, WATER_LEVEL + 0.1, p.z), tmp2.set(0, 1, 0), 10)
        }
        r.wet = wet
        // よりみちの声・つまずき
        rp.acts.forEach((act, n) => {
          if (r.sounds.has(n) || playT < act.from || playT >= act.to) return
          if (act.kind === 'stumble') {
            r.sounds.add(n)
            playZooSound('bonk')
            effects.burst('sparkle', headOf(r, tmp), 5)
          } else if (act.kind === 'quirk') {
            const info = SPECIES[r.species].manifest.clips[act.clip]
            const at = act.from + (info?.callStart ?? 0.6)
            if (playT < at) return
            r.sounds.add(n)
            if (info?.sound) playZooSound(info.sound as ZooSound)
            effects.burst('note', headOf(r, tmp), 3)
          }
        })
      })
      // おうえんしている動物の足もとに、光る輪
      const cheered = cheer !== null ? lineup[cheer] : undefined
      cheerRing.visible = !!cheered && view !== 'podium'
      if (cheered) {
        const s = Math.max(0.9, Math.min(2.2, cheered.length * 0.55)) * (1 + 0.06 * Math.sin(clock * 5))
        cheerRing.position.set(cheered.root.position.x, Math.max(0.05, cheered.root.position.y + 0.05), cheered.root.position.z)
        cheerRing.scale.setScalar(s)
      }
    }

    function updatePodium(dt: number) {
      if (!course || !plan) return
      const podium = course.scenery.podium
      plan.order.forEach((index, place) => {
        const r = lineup[index]
        const spot = podium.spots[place]
        if (!spot) return
        r.root.position.copy(spot)
        r.root.rotation.set(0, podium.facing, 0)
        r.heading = podium.facing
        if (place === 0) {
          r.anim.clip = 'Happy'
          r.anim.clipToken = 2000 + Math.floor(viewT / 2.2)
        } else if (place < 3 && viewT < 1.7) {
          r.anim.clip = 'Happy'
          r.anim.clipToken = 3000 + place
        } else {
          r.anim.clip = 'Idle'
        }
        r.anim.speed = 0
        r.anim.turnRate = 0
        r.animator.update(dt, r.anim)
        r.tag.position.set(spot.x, spot.y + r.height + 0.55, spot.z)
      })
      if (!optionsRef.current.reducedMotion && Math.floor(viewT * 2.5) !== Math.floor((viewT - dt) * 2.5)) {
        const winner = lineup[plan.order[0]]
        effects.burst(Math.random() < 0.3 ? 'heart' : 'sparkle', headOf(winner, tmp).add(tmp2.set((Math.random() - 0.5) * 1.5, 0.4, 0)), 4)
      }
    }

    // ---------------------------------------------------------------------
    // カメラ（中継）

    function portrait(): boolean {
      return camera.aspect < 0.9
    }

    function placeCamera(instant: boolean, dt = 0) {
      const reduced = optionsRef.current.reducedMotion
      let cut = instant
      if (view === 'reception' && reception) {
        // 受付の係を まんなかに、ゆっくり ゆれる
        const vfov = (camera.fov * Math.PI) / 180
        const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect)
        const dist = Math.max(7, Math.min(15, 5.2 / Math.tan(hfov / 2)))
        const az = reduced ? 0.12 : 0.12 + Math.sin(clock * 0.25) * 0.16
        wantLook.set(0.4, 1.7, -0.6)
        wantPos.set(Math.sin(az) * dist + 0.4, 2.8, Math.cos(az) * dist)
      } else if (course && plan && (view === 'gate' || view === 'race')) {
        const race = course.race
        const path = course.path
        const half = trackHalfWidth(race)
        const tall = Math.max(...race.runners.map(id => SPECIES[id].manifest.bounds.height))
        const narrow = portrait()
        if (view === 'gate') {
          // はじめに コースを ゴールから スタートへ 空から たどり、スタートの前で 動物の顔を見る
          const intro = 4.2
          const gate = { pos: pointAt(path, narrow ? 15 : 12), look: pointAt(path, -1) }
          const gy = 2.4 + tall * 0.75 + (narrow ? 1.6 : 0)
          if (viewT < intro && !reduced) {
            const k = viewT / intro
            const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
            const s = race.course.distance * (1 - e) + 12 * e
            const p = pointAt(path, s)
            const l = pointAt(path, s - 14)
            const sy = 16 * (1 - e) + gy * e
            wantPos.set(p.x, sy, p.z)
            wantLook.set(l.x, 0.8, l.z)
            cut = true
          } else {
            wantPos.set(gate.pos.x, gy, gate.pos.z)
            wantLook.set(gate.look.x, 0.9 + tall * 0.25, gate.look.z)
          }
        } else {
          const ranking = rankingAt(plan, playT)
          const poses = ranking.map(i => poseAt(plan!, race.course, i, playT))
          const lead = poses[0].s
          const top = poses.slice(0, Math.min(3, poses.length)).map(p => p.s)
          const pack = Math.max(lead - 7, top.reduce((a, b) => a + b, 0) / top.length)
          const d = race.course.distance
          // スタートは まえから（スタートの門ごしに うしろから写さない）、とちゅうは うしろと ときどき まえ、さいごは ゴールの先から
          let next: typeof shot = 'chase'
          if (lead > d - 20 || poses[0].finished) next = 'finish'
          else if (pack < 16) next = 'front'
          else if (lead < d - 32 && Math.floor(playT / 7) % 2 === 1 && playT % 7 < 2.8) next = 'front'
          if (next !== shot) {
            shot = next
            cut = true
          }
          if (shot === 'finish') {
            // ゴールの門の まんなかごしに、むかってくる どうぶつを写す
            const p = pointAt(path, d + (narrow ? 18 : 15), -half * 0.3)
            const l = pointAt(path, d - 10)
            wantPos.set(p.x, 5.2 + (narrow ? 1 : 0), p.z)
            wantLook.set(l.x, 0.6, l.z)
          } else if (shot === 'front') {
            // 先頭の すこし前から、走ってくる向きの まっすぐ先に立って 顔を写す（くねくね道でも 横に それない）
            const k = pointAt(path, (lead + pack) / 2)
            const ahead = (lead - pack) / 2 + (narrow ? 12 : 10)
            const side = -half * 0.25
            wantPos.set(k.x + Math.sin(k.heading) * ahead + Math.cos(k.heading) * side, 2.6 + tall * 0.45 + (narrow ? 0.8 : 0),
              k.z + Math.cos(k.heading) * ahead - Math.sin(k.heading) * side)
            wantLook.set(k.x, 0.9, k.z)
          } else {
            const back = narrow ? 12 : 8.5
            const side = narrow ? half * 0.5 + 2 : half + 6
            const p = pointAt(path, pack - back, -side)
            const l = pointAt(path, pack + 3)
            wantPos.set(p.x, (narrow ? 8.5 : 6.5) + tall * 0.4, p.z)
            wantLook.set(l.x, 0.8, l.z)
          }
        }
      } else if (course && view === 'podium') {
        wantPos.copy(course.scenery.podium.camera.pos)
        wantLook.copy(course.scenery.podium.camera.look)
        if (portrait()) wantPos.lerp(wantLook, -0.35).setY(wantPos.y + 1.2)
      } else {
        return
      }
      if (cut || reduced || dt <= 0) {
        camPos.copy(wantPos)
        camLook.copy(wantLook)
      } else {
        camPos.lerp(wantPos, follow(view === 'race' ? 2.6 : 2, dt))
        camLook.lerp(wantLook, follow(view === 'race' ? 4 : 2.5, dt))
      }
      camera.position.copy(camPos)
      camera.lookAt(camLook)
    }

    // ---------------------------------------------------------------------
    // 時間を進める

    function frame(now: number) {
      raf = 0
      if (released || lost || !active || !renderer) return
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60)
      last = now
      clock += dt
      viewT += dt
      if (view === 'reception' && reception) {
        reception.scenery.update(clock)
        const clerk = reception.clerk
        if (clerk) {
          // ときどき はくしゅして 出むかえる
          reception.clap -= dt
          if (reception.clap <= 0) {
            reception.clap = 5.5
            clerk.anim.clipToken += 1
          }
          clerk.anim.clip = reception.clap > 2.2 ? 'Clap' : 'Idle'
          clerk.animator.update(dt, clerk.anim)
        }
      } else if (view === 'race' && plan) {
        playT += dt
        while (nextEvent < narration.length && narration[nextEvent].t <= playT) {
          optionsRef.current.onEvent?.(narration[nextEvent])
          nextEvent += 1
        }
        rankTick -= dt
        if (rankTick <= 0) {
          rankTick = 0.25
          const order = rankingAt(plan, playT)
          const lead = poseAt(plan, course!.race.course, order[0], playT)
          optionsRef.current.onRanking?.(order, Math.max(0, Math.min(1, lead.s / plan.distance)))
        }
        const firstFinish = plan.runners[plan.order[0]].finish
        excitement = playT < 2 ? 1 - playT / 2 : playT > firstFinish - 3 ? 1 : 0.25
        if (!finished && playT > plan.end + 1.6) {
          finished = true
          optionsRef.current.onFinish?.()
        }
        updateRunners(dt)
      } else if (view === 'gate') {
        updateRunners(dt)
      } else if (view === 'podium') {
        excitement = 1
        updatePodium(dt)
      }
      if (course) course.scenery.update(clock, excitement)
      effects.update(dt)
      placeCamera(false, dt)
      fitShadow(camLook.x, camLook.z, view === 'reception' ? 16 : 24)
      renderer.render(scene, camera)
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
      host.appendChild(renderer.domElement)
      renderer.domElement.addEventListener('webglcontextlost', contextLost)
      renderer.domElement.addEventListener('webglcontextrestored', contextRestored)
      if (observer) observer.observe(host)
      else window.addEventListener('resize', onWindowResize)
      resize()
      models = new ModelCache()
    } catch {
      optionsRef.current.onStatus('error')
    }

    commands.current = {
      showReception() {
        void enterReception()
      },
      prepare(next) {
        void enterCourse(next)
      },
      start(list) {
        if (!plan || view !== 'gate') return
        narration = list
        nextEvent = 0
        playT = 0
        rankTick = 0
        finished = false
        shot = 'chase'
        view = 'race'
        viewT = 0
        excitement = 1
        placeCamera(true)
        schedule()
      },
      showPodium() {
        if (!plan || !course) return
        view = 'podium'
        viewT = 0
        for (const r of lineup) r.tag.visible = false
        cheerRing.visible = false
        placeCamera(true)
        effects.burst('sparkle', tmp.copy(course.scenery.podium.spots[0]).add(tmp2.set(0, 2, 0)), 12)
        schedule()
      },
      setCheer(index) {
        cheer = index
      },
    }

    if (renderer && models) {
      const first = request.current
      const ready = first.kind === 'prepare' ? enterCourse(first.plan) : enterReception()
      void ready.then(() => {
        if (released || stopActivity) return
        stopActivity = observeGameActivity(next => {
          active = next
          if (next) schedule()
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
      if (renderer) {
        renderer.domElement.removeEventListener('webglcontextlost', contextLost)
        renderer.domElement.removeEventListener('webglcontextrestored', contextRestored)
      }
      clearStage()
      void models?.dispose()
      effects.dispose()
      cheerRing.geometry.dispose()
      ;(cheerRing.material as THREE.Material).dispose()
      for (const t of laneTextures) t.dispose()
      sun.shadow.map?.dispose()
      renderer?.dispose()
      renderer?.domElement.remove()
    }
  }, [container, generation])

  return { registerContainer, retry, showReception, prepare, start, showPodium, setCheer }
}
