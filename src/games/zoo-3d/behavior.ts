// 動物の行動（AI）。Three.js に依存しない純粋なロジックとして、位置・向き・速さと
// 再生したいクリップだけを決める。描画側（useZooEngine）はこの結果をアニメーションへ写す。
//
// 動きの品質のための約束:
// - 向きは「旋回の速さ」の上限つきで連続的に変える（瞬間的に向きが変わらない）。
// - 大きく向きを変えるときは止まってから、その場の方向転換クリップで回る。
// - 歩きながら曲がれる速さは、曲がり歩きクリップ（WalkLeft/WalkRight）の旋回量に合わせる。
// - 速さは加速度の上限つきで変え、目的地の手前で減速して止まる。

import { locomotionOf, type Locomotion } from './motion'
import { SPECIES, SPECIES_ORDER, type SpeciesId } from './species'
import {
  clampToEnclosure, distance, enclosureById, obstaclesOf, pondShore, pushOutOfObstacles, segmentHitsCircle,
  type Circle, type Enclosure, type Vec2,
} from './zooMap'

export type Random = () => number

export type Plan =
  | { kind: 'wander'; run?: boolean }
  | { kind: 'eat'; foodId: number }
  | { kind: 'graze' }
  | { kind: 'special'; clip: string }
  | { kind: 'react' }
  | { kind: 'sleep' }

export type Mode = 'idle' | 'turn' | 'move' | 'act' | 'sleep'
export type SleepStage = 'down' | 'asleep' | 'up'

export type AnimalState = {
  id: string
  species: SpeciesId
  label: string
  scale: number
  /** 重なりを防ぐ半径（m）。 */
  radius: number
  /** 体の中心から鼻先・頭の先までの距離（柵から頭を出さないための余白）。 */
  front: number
  x: number
  z: number
  /** 向き（ラジアン）。0 で +z を向き、正の向きに増えると左へ回る。 */
  heading: number
  speed: number
  /** 現在の旋回の速さ（ラジアン/s、正で左回り）。 */
  turnRate: number
  mode: Mode
  modeTime: number
  run: boolean
  goal?: { x: number; z: number; face?: number; plan: Plan }
  turnTo?: number
  /** 再生したいクリップ名。ワンショットを始め直すたびに clipToken が増える。 */
  clip: string
  clipToken: number
  act?: { plan: Plan; length: number; fired: boolean }
  sleep?: { stage: SleepStage; left: number }
  decideAt: number
  blocked: number
  pending?: Plan
}

export type FoodState = { id: number; species: SpeciesId; x: number; z: number; eaten: boolean }

export type ZooEvent =
  | { type: 'eat'; animal: string; foodId: number }
  | { type: 'happy'; animal: string }
  | { type: 'special'; animal: string; clip: string }
  | { type: 'asleep'; animal: string }
  | { type: 'wake'; animal: string }

export type ZooWorld = { animals: AnimalState[]; foods: FoodState[]; nextFoodId: number; time: number }

const DEG = Math.PI / 180
const ARRIVE = 0.2
const TURN_IN_PLACE = 55 * DEG
const SLOW_TURN = 1.15
/** 減速の上限（m/s²）。止まるときも急停止せず、この割合で速さを落とす。 */
const DECEL = 1.4

export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

export function headingTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.x - from.x, to.z - from.z)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function between(random: Random, [lo, hi]: readonly [number, number]): number {
  return lo + (hi - lo) * random()
}

function loco(a: AnimalState): Locomotion {
  return locomotionOf(SPECIES[a.species].manifest, a.scale)
}

function clipLength(a: AnimalState, clip: string): number {
  const info = SPECIES[a.species].manifest.clips[clip]
  if (!info) throw new Error(`${a.species}: ${clip} がありません`)
  return info.duration
}

function areaOf(a: AnimalState): { enclosure: Enclosure; obstacles: Circle[] } {
  const enclosure = enclosureById(a.species)
  return { enclosure, obstacles: obstaclesOf(enclosure) }
}

function setClip(a: AnimalState, clip: string, restart = false): void {
  if (restart || a.clip !== clip) a.clipToken += 1
  a.clip = clip
}

// ---------------------------------------------------------------------------
// 生成

export function createZoo(random: Random): ZooWorld {
  const animals: AnimalState[] = []
  for (const id of SPECIES_ORDER) {
    const species = SPECIES[id]
    const enclosure = enclosureById(id)
    const { bounds } = species.manifest
    species.members.forEach((member, index) => {
      const angle = index * 2.3 + random() * 0.6
      const r = enclosure.radius * 0.3
      const a: AnimalState = {
        id: member.id,
        species: id,
        label: member.label,
        scale: member.scale,
        radius: Math.max(bounds.width * 0.5, bounds.length * 0.36) * member.scale,
        front: bounds.front * member.scale,
        x: enclosure.center.x + Math.sin(angle) * r,
        z: enclosure.center.z + Math.cos(angle) * r,
        heading: random() * Math.PI * 2 - Math.PI,
        speed: 0,
        turnRate: 0,
        mode: 'idle',
        modeTime: 0,
        run: false,
        clip: 'Idle',
        clipToken: 0,
        decideAt: 0.5 + random() * 2.5,
        blocked: 0,
      }
      const p = pushOutOfObstacles(a, obstaclesOf(enclosure), a.radius)
      a.x = p.x
      a.z = p.z
      animals.push(a)
    })
  }
  return { animals, foods: [], nextFoodId: 1, time: 0 }
}

// ---------------------------------------------------------------------------
// 行動の開始

function neighbours(world: ZooWorld, a: AnimalState): AnimalState[] {
  return world.animals.filter(b => b !== a && b.species === a.species)
}

/** 障害物と仲間を避けた、まっすぐ歩いて行ける目的地を選ぶ。 */
export function pickWanderTarget(world: ZooWorld, a: AnimalState, random: Random): Vec2 {
  const { enclosure, obstacles } = areaOf(a)
  const others = neighbours(world, a)
  const usable = enclosure.radius - a.front - 0.4
  let best: Vec2 | undefined
  let bestScore = -Infinity
  for (let i = 0; i < 24; i++) {
    const ang = random() * Math.PI * 2
    const r = Math.sqrt(random()) * usable
    const p = { x: enclosure.center.x + Math.sin(ang) * r, z: enclosure.center.z + Math.cos(ang) * r }
    const d = distance(a, p)
    if (d < 1.6 * a.scale + 0.8) continue
    if (obstacles.some(o => distance(p, o) < o.r + a.radius + 0.3)) continue
    if (obstacles.some(o => segmentHitsCircle(a, p, o, a.radius * 0.9))) continue
    const crowd = Math.min(...others.map(b => distance(p, b) - b.radius - a.radius), 99)
    if (crowd < 0.8) continue
    // 正面に近い方向と、ほどよい距離を好む（急な方向転換を減らす）
    const turn = Math.abs(wrapAngle(headingTo(a, p) - a.heading))
    const score = -turn * 1.2 - Math.abs(d - usable * 0.8) * 0.3 + Math.min(crowd, 3) * 0.3 + random() * 0.6
    if (score > bestScore) {
      bestScore = score
      best = p
    }
  }
  return best ?? { x: enclosure.center.x, z: enclosure.center.z }
}

function setGoal(a: AnimalState, target: Vec2, plan: Plan, face?: number): void {
  a.goal = { x: target.x, z: target.z, face, plan }
  a.blocked = 0
  if (distance(a, target) < ARRIVE) {
    arrive(a)
    return
  }
  const err = wrapAngle(headingTo(a, target) - a.heading)
  if (Math.abs(err) > TURN_IN_PLACE && a.speed < 0.05) {
    startTurn(a, a.heading + err)
  } else {
    a.mode = 'move'
    a.modeTime = 0
    setClip(a, a.run ? 'Run' : 'Walk')
  }
}

function startTurn(a: AnimalState, to: number): void {
  a.mode = 'turn'
  a.modeTime = 0
  a.turnTo = to
  a.turnRate = 0
  setClip(a, wrapAngle(to - a.heading) > 0 ? 'TurnLeft' : 'TurnRight')
}

function startAct(a: AnimalState, clip: string, plan: Plan): void {
  a.mode = 'act'
  a.modeTime = 0
  a.goal = undefined
  a.act = { plan, length: clipLength(a, clip), fired: false }
  setClip(a, clip, true)
}

function goIdle(a: AnimalState, random: Random): void {
  a.mode = 'idle'
  a.modeTime = 0
  a.goal = undefined
  a.act = undefined
  a.run = false
  a.decideAt = between(random, SPECIES[a.species].mood.idle)
  setClip(a, 'Idle')
}

function arrive(a: AnimalState): void {
  const goal = a.goal
  if (!goal) return
  if (goal.face !== undefined && Math.abs(wrapAngle(goal.face - a.heading)) > 8 * DEG) {
    startTurn(a, goal.face)
    return
  }
  perform(a, goal.plan)
}

function perform(a: AnimalState, plan: Plan): void {
  switch (plan.kind) {
    case 'eat':
    case 'graze':
      startAct(a, 'Eat', plan)
      return
    case 'special':
      startAct(a, plan.clip, plan)
      return
    case 'react':
      startAct(a, 'Happy', plan)
      return
    case 'sleep':
      a.mode = 'sleep'
      a.modeTime = 0
      a.goal = undefined
      a.sleep = { stage: 'down', left: clipLength(a, 'LieDown') }
      setClip(a, 'LieDown', true)
      return
    case 'wander':
      a.goal = undefined
      a.mode = 'idle'
      a.modeTime = 0
      a.decideAt = 0
      setClip(a, 'Idle')
  }
}

/** 計画を始める。歩いて行く必要があれば目的地を決める。 */
export function begin(world: ZooWorld, a: AnimalState, plan: Plan, random: Random): void {
  a.pending = undefined
  const species = SPECIES[a.species]
  switch (plan.kind) {
    case 'wander': {
      a.run = !!plan.run
      setGoal(a, pickWanderTarget(world, a, random), plan)
      return
    }
    case 'eat': {
      const food = world.foods.find(f => f.id === plan.foodId && !f.eaten)
      if (!food) {
        goIdle(a, random)
        return
      }
      a.run = distance(a, food) > 6
      const dir = headingTo(a, food)
      const reach = species.reach * a.scale
      const stand = { x: food.x - Math.sin(dir) * reach, z: food.z - Math.cos(dir) * reach }
      setGoal(a, stand, plan, headingTo(stand, food))
      return
    }
    case 'special': {
      const spec = species.specials.find(s => s.clip === plan.clip)
      const { enclosure } = areaOf(a)
      const shore = spec?.atPond ? pondShore(enclosure, a, a.front * 0.75 + 0.2) : undefined
      if (shore && enclosure.pond) {
        a.run = false
        setGoal(a, shore, plan, headingTo(shore, enclosure.pond))
      } else {
        perform(a, plan)
      }
      return
    }
    default:
      perform(a, plan)
  }
}

/** 次に何をするか（自律行動）。 */
function decide(world: ZooWorld, a: AnimalState, random: Random): void {
  const mood = SPECIES[a.species].mood
  const specials = SPECIES[a.species].specials
  const options: [number, () => Plan][] = [
    [mood.wander, () => ({ kind: 'wander' })],
    [mood.run, () => ({ kind: 'wander', run: true })],
    [mood.graze, () => ({ kind: 'graze' })],
    [mood.special, () => ({ kind: 'special', clip: specials[Math.floor(random() * specials.length)].clip })],
    [mood.sleep, () => ({ kind: 'sleep' })],
  ]
  const total = options.reduce((s, [w]) => s + w, 0)
  let pick = random() * total
  for (const [w, make] of options) {
    pick -= w
    if (pick <= 0) {
      begin(world, a, make(), random)
      return
    }
  }
  begin(world, a, { kind: 'wander' }, random)
}

// ---------------------------------------------------------------------------
// 子どもの操作

/** 予定を差し込む。歩いている途中ならすぐ切り替え、動作中なら終わってから始める。 */
export function command(world: ZooWorld, id: string, plan: Plan, random: Random): void {
  const a = world.animals.find(x => x.id === id)
  if (!a) return
  if (a.mode === 'sleep') {
    wake(a)
    a.pending = plan
    return
  }
  if (a.mode === 'act') {
    a.pending = plan
    return
  }
  begin(world, a, plan, random)
}

function wake(a: AnimalState): void {
  if (!a.sleep || a.sleep.stage === 'up') return
  const done = a.sleep.stage === 'down' ? a.modeTime / clipLength(a, 'LieDown') : 1
  a.sleep = { stage: 'up', left: clipLength(a, 'GetUp') * done }
  a.modeTime = 0
  setClip(a, 'GetUp', true)
}

/** エサを動物の前に置き、食べに来させる。置いた場所を返す。 */
export function dropFood(world: ZooWorld, id: string, random: Random): FoodState | undefined {
  const a = world.animals.find(x => x.id === id)
  if (!a) return undefined
  const { enclosure, obstacles } = areaOf(a)
  const species = SPECIES[a.species]
  let spot: Vec2 = { x: a.x, z: a.z }
  for (let i = 0; i < 12; i++) {
    const ang = a.heading + (random() - 0.5) * (0.6 + i * 0.25)
    const d = species.reach * a.scale + 1.2 + random() * 1.2
    const p = clampToEnclosure({ x: a.x + Math.sin(ang) * d, z: a.z + Math.cos(ang) * d }, enclosure,
      species.reach * a.scale + 0.3)
    if (!obstacles.some(o => distance(p, o) < o.r + 0.6)) {
      spot = p
      break
    }
  }
  const food: FoodState = { id: world.nextFoodId++, species: a.species, x: spot.x, z: spot.z, eaten: false }
  world.foods.push(food)
  command(world, id, { kind: 'eat', foodId: food.id }, random)
  return food
}

// ---------------------------------------------------------------------------
// 時間を進める

export function stepZoo(world: ZooWorld, dt: number, random: Random): ZooEvent[] {
  const events: ZooEvent[] = []
  world.time += dt
  for (const a of world.animals) stepAnimal(world, a, dt, random, events)
  separate(world)
  world.foods = world.foods.filter(f => !f.eaten)
  return events
}

function stepAnimal(world: ZooWorld, a: AnimalState, dt: number, random: Random, events: ZooEvent[]): void {
  const lc = loco(a)
  a.modeTime += dt
  switch (a.mode) {
    case 'idle':
      a.speed = Math.max(0, a.speed - DECEL * dt)
      a.turnRate = 0
      if (a.pending) begin(world, a, a.pending, random)
      else if (a.modeTime >= a.decideAt) decide(world, a, random)
      break
    case 'turn': {
      a.speed = Math.max(0, a.speed - DECEL * dt)
      const err = wrapAngle((a.turnTo ?? a.heading) - a.heading)
      const rate = lc.turnSpeed * DEG
      const stepAngle = Math.sign(err) * Math.min(Math.abs(err), rate * dt)
      a.turnRate = stepAngle / Math.max(dt, 1e-6)
      a.heading = wrapAngle(a.heading + stepAngle)
      if (Math.abs(err) - Math.abs(stepAngle) < 1.5 * DEG) {
        a.turnRate = 0
        const goal = a.goal
        if (goal && distance(a, goal) >= ARRIVE) {
          a.mode = 'move'
          a.modeTime = 0
          setClip(a, a.run ? 'Run' : 'Walk')
        } else if (goal) {
          perform(a, goal.plan)
        } else {
          goIdle(a, random)
        }
      }
      break
    }
    case 'move':
      steer(world, a, lc, dt, random)
      break
    case 'act': {
      const act = a.act
      if (!act) {
        goIdle(a, random)
        break
      }
      a.speed = Math.max(0, a.speed - DECEL * dt)
      a.turnRate = 0
      const info = SPECIES[a.species].manifest.clips[a.clip]
      if (!act.fired) {
        if (act.plan.kind === 'eat' && info?.food && a.modeTime >= info.food.grab) {
          act.fired = true
          const food = world.foods.find(f => f.id === (act.plan as { foodId: number }).foodId)
          if (food) food.eaten = true
          events.push({ type: 'eat', animal: a.id, foodId: (act.plan as { foodId: number }).foodId })
        } else if (act.plan.kind === 'special') {
          act.fired = true
          events.push({ type: 'special', animal: a.id, clip: a.clip })
        } else if (act.plan.kind === 'react') {
          act.fired = true
          events.push({ type: 'happy', animal: a.id })
        }
      }
      if (a.modeTime >= act.length) {
        const ateFood = act.plan.kind === 'eat'
        a.act = undefined
        if (a.pending) begin(world, a, a.pending, random)
        else if (ateFood) begin(world, a, { kind: 'react' }, random)
        else goIdle(a, random)
      }
      break
    }
    case 'sleep': {
      a.speed = Math.max(0, a.speed - DECEL * dt)
      a.turnRate = 0
      const s = a.sleep
      if (!s) {
        goIdle(a, random)
        break
      }
      s.left -= dt
      if (s.left > 0) break
      if (s.stage === 'down') {
        a.sleep = { stage: 'asleep', left: 9 + random() * 7 }
        setClip(a, 'Sleep')
        events.push({ type: 'asleep', animal: a.id })
      } else if (s.stage === 'asleep') {
        a.sleep = { stage: 'up', left: clipLength(a, 'GetUp') }
        a.modeTime = 0
        setClip(a, 'GetUp', true)
      } else {
        a.sleep = undefined
        events.push({ type: 'wake', animal: a.id })
        if (a.pending) begin(world, a, a.pending, random)
        else goIdle(a, random)
      }
      break
    }
  }
  if (a.speed > 0) {
    a.x += Math.sin(a.heading) * a.speed * dt
    a.z += Math.cos(a.heading) * a.speed * dt
  }
  const { enclosure, obstacles } = areaOf(a)
  const inside = clampToEnclosure(a, enclosure, a.front * 0.9)
  const free = pushOutOfObstacles(inside, obstacles, a.radius * 0.85)
  a.x = free.x
  a.z = free.z
}

function steer(world: ZooWorld, a: AnimalState, lc: Locomotion, dt: number, random: Random): void {
  const goal = a.goal
  if (!goal) {
    goIdle(a, random)
    return
  }
  const dist = distance(a, goal)
  const err = wrapAngle(headingTo(a, goal) - a.heading)
  // 目的地の手前で十分に減速してから止まる（通り過ぎたときも、そこで止まる）
  if ((dist < ARRIVE && a.speed < 0.09) || (dist < 0.45 && Math.abs(err) > Math.PI / 2 && a.speed < 0.2)) {
    a.speed = Math.max(0, a.speed - DECEL * dt)
    a.turnRate = 0
    if (a.speed <= 0.001) arrive(a)
    return
  }
  const vmax = a.run ? lc.runSpeed : lc.walkSpeed
  // 歩きながら曲がれる速さは、曲がり歩きクリップと同じ比率（速さに比例）に抑える
  const maxTurn = lc.walkTurn * DEG * clamp(a.speed / lc.walkSpeed, 0, a.run ? 1.1 : 1)
  const wantTurn = clamp(err * 1.8, -maxTurn, maxTurn)
  a.turnRate += clamp(wantTurn - a.turnRate, -1.4 * dt, 1.4 * dt)
  a.heading = wrapAngle(a.heading + a.turnRate * dt)

  let vTarget = vmax * clamp(1 - (Math.abs(err) - 0.3) / 1.1, 0.3, 1)
  if (Math.abs(err) > SLOW_TURN) vTarget = 0
  vTarget = Math.min(vTarget, 0.95 * Math.sqrt(2 * 0.8 * Math.max(0, dist - 0.06)))
  // 仲間が行く手にいたら待つ。待ちすぎたら行き先を変える
  for (const b of neighbours(world, a)) {
    const d = distance(a, b)
    const ahead = Math.abs(wrapAngle(headingTo(a, b) - a.heading)) < 0.9
    if (ahead && d < a.radius + b.radius + 0.6 + a.speed * 1.5) {
      vTarget = 0
      a.blocked += dt
    }
  }
  const accel = a.run ? 1.6 : 0.8
  a.speed += clamp(vTarget - a.speed, -DECEL * dt, accel * dt)
  if (a.speed < 0.05 && Math.abs(err) > SLOW_TURN) {
    startTurn(a, a.heading + err)
    return
  }
  if (a.blocked > 2.5) {
    a.blocked = 0
    if (goal.plan.kind === 'wander') begin(world, a, { kind: 'wander' }, random)
    // 仲間とゆずり合ったまま動けないときは、固有アクションをその場で見せる（ずっと待たせない）
    else if (goal.plan.kind === 'special') perform(a, goal.plan)
  }
}

/** 同じエリアの動物どうしが重ならないよう、少しずつ押し離す。 */
function separate(world: ZooWorld): void {
  const list = world.animals
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]
      const b = list[j]
      if (a.species !== b.species) continue
      const d = distance(a, b)
      const min = a.radius + b.radius
      if (d >= min) continue
      const nx = d > 1e-6 ? (a.x - b.x) / d : 1
      const nz = d > 1e-6 ? (a.z - b.z) / d : 0
      const push = (min - d) * 0.5
      // 眠っている・動作中の動物は動かさず、動いている方だけをずらす
      let wa = a.mode === 'move' || a.mode === 'idle' ? 1 : 0
      let wb = b.mode === 'move' || b.mode === 'idle' ? 1 : 0
      if (wa + wb === 0) wa = wb = 1
      const share = (push * 2) / (wa + wb)
      a.x += nx * share * wa
      a.z += nz * share * wa
      b.x -= nx * share * wb
      b.z -= nz * share * wb
    }
  }
}

export function animalById(world: ZooWorld, id: string): AnimalState | undefined {
  return world.animals.find(a => a.id === id)
}

/** テスト・デバッグ用: 目的地へ歩いている途中か。 */
export function isWalking(a: AnimalState): boolean {
  return a.mode === 'move'
}
