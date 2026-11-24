// 動物の行動（AI）。Three.js に依存しない純粋なロジックとして、位置・向き・速さと
// 再生したいクリップだけを決める。描画側（useZooEngine）はこの結果をアニメーションへ写す。
//
// 動きの品質のための約束:
// - 向きは「旋回の速さ」の上限つきで連続的に変える（瞬間的に向きが変わらない）。
// - 大きく向きを変えるときは止まってから、その場の方向転換クリップで回る。
// - 歩きながら曲がれる速さは、曲がり歩きクリップ（WalkLeft/WalkRight）の旋回量に合わせる。
// - 速さは加速度の上限つきで変え、目的地の手前で減速して止まる。
//
// 観察して楽しめるように、ボタンを押さなくても動物は自分で動く:
// 歩き回る・草を食べる・固有アクション・眠るに加えて、子どもは親のそばへついて行き、
// 柵の前に人（歩くモードのカメラ）がいると、近くへ見に来る動物もいる。
// 展示場には複数の種類をいっしょに入れられる（同じ展示場の動物どうしでよけ合う）。

import { locomotionOf, type Locomotion } from './motion'
import { SPECIES, type SpeciesId } from './species'
import {
  clampToEnclosure, distance, enclosureById, obstaclesOf, pondShore, pushOutOfObstacles, roamRadius, segmentHitsCircle,
  type Area, type Circle, type Enclosure, type Vec2,
} from './zooMap'

export type Random = () => number

export type Plan =
  | { kind: 'wander'; run?: boolean }
  | { kind: 'eat'; foodId: number }
  | { kind: 'graze' }
  | { kind: 'special'; clip: string }
  | { kind: 'react' }
  | { kind: 'sleep' }
  /** 子どもが親のそばへ行く。 */
  | { kind: 'follow'; target: string }
  /** 柵の前の人を見に来る。 */
  | { kind: 'visit' }

export type Mode = 'idle' | 'turn' | 'move' | 'act' | 'sleep'
export type SleepStage = 'down' | 'asleep' | 'up'

export type AnimalState = {
  id: string
  species: SpeciesId
  /** 暮らしている展示場の ID。 */
  enclosure: string
  label: string
  scale: number
  /** 親の ID（子どもだけ）。 */
  parent?: string
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
  /** 目的地へ近づけていない時間（障害物の角などで引っかかったら、あきらめる）。 */
  stall: number
  /** いまの目的地までの、いちばん近づいた距離。 */
  best: number
  pending?: Plan
}

export type FoodState = { id: number; species: SpeciesId; x: number; z: number; eaten: boolean }

export type ZooEvent =
  | { type: 'eat'; animal: string; foodId: number }
  | { type: 'happy'; animal: string }
  | { type: 'special'; animal: string; clip: string }
  | { type: 'asleep'; animal: string }
  | { type: 'wake'; animal: string }
  | { type: 'visit'; animal: string }

/** 歩くモードの人（カメラ）の位置。俯瞰のときは null。 */
export type Visitor = { x: number; z: number }

export type ZooWorld = {
  area: Area
  animals: AnimalState[]
  foods: FoodState[]
  nextFoodId: number
  time: number
  visitor: Visitor | null
}

const DEG = Math.PI / 180
const ARRIVE = 0.2
const TURN_IN_PLACE = 55 * DEG
const SLOW_TURN = 1.15
/** 減速の上限（m/s²）。止まるときも急停止せず、この割合で速さを落とす。 */
const DECEL = 1.4
/** 自分で固有アクションを見せる頻度の倍率（観察して見つけられるよう、少し多めにする）。 */
const SHOWY = 1.6
/** えさを食べて喜んだあと、固有アクションを見せる確率。 */
const THANKS = 0.45
/** 子どもが親からこれ以上はなれると、親のそばへ戻りたくなる（m、大人の大きさで割る前）。 */
const FOLLOW_FAR = 3.2
/** 人がこの距離（柵からの距離、m）より近いと、見に来ることがある。 */
const VISIT_RANGE = 7
/** ふれあい広場で、動物が人をよける半径（m）。 */
const VISITOR_RADIUS = 0.45

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

const obstacleCache = new WeakMap<Enclosure, Circle[]>()

/** 動物の展示場と、よける障害物（毎フレーム作り直さないよう、展示場ごとに覚えておく）。 */
export function homeOfAnimal(world: ZooWorld, a: AnimalState): { enclosure: Enclosure; obstacles: Circle[] } {
  const enclosure = enclosureById(world.area, a.enclosure)
  let obstacles = obstacleCache.get(enclosure)
  if (!obstacles) {
    obstacles = obstaclesOf(enclosure)
    obstacleCache.set(enclosure, obstacles)
  }
  return { enclosure, obstacles }
}

/** ふれあい広場の中に人がいれば、動物がよける円として返す。 */
function visitorInside(world: ZooWorld, enclosure: Enclosure): Circle | undefined {
  const v = world.visitor
  if (!v || !enclosure.walkIn) return undefined
  if (distance(v, enclosure.center) > enclosure.radius + 0.3) return undefined
  return { x: v.x, z: v.z, r: VISITOR_RADIUS }
}

/** 障害物（よける円）に、体が重なっているか。 */
function overlaps(p: Vec2, obstacles: readonly Circle[], radius: number): boolean {
  return obstacles.some(o => distance(p, o) < o.r + radius * 0.85 - 1e-3)
}

/**
 * 柵の内側へ引き戻すことと、障害物の外へ押し出すことを交互に行って、立てる位置を決める。
 * 池・岩と柵のすきまに押しこまれて、どうしても重なるときは、動く前の位置 prev にとどまる。
 */
function settle(a: AnimalState, prev: Vec2, enclosure: Enclosure, obstacles: readonly Circle[], margin = a.front * 0.9, radius = a.radius): Vec2 {
  let p: Vec2 = { x: a.x, z: a.z }
  for (let i = 0; i < 3; i++) {
    p = clampToEnclosure(p, enclosure, margin)
    p = pushOutOfObstacles(p, obstacles, radius * 0.85)
  }
  p = clampToEnclosure(p, enclosure, margin)
  if (overlaps(p, obstacles, radius) && !overlaps(prev, obstacles, radius)) return { x: prev.x, z: prev.z }
  return p
}

function setClip(a: AnimalState, clip: string, restart = false): void {
  if (restart || a.clip !== clip) a.clipToken += 1
  a.clip = clip
}

// ---------------------------------------------------------------------------
// 生成

/** エリアの動物を、それぞれの展示場に生み出す（子どもは親のそばに置く）。 */
export function createZoo(area: Area, random: Random): ZooWorld {
  const world: ZooWorld = { area, animals: [], foods: [], nextFoodId: 1, time: 0, visitor: null }
  for (const enclosure of area.enclosures) {
    const obstacles = obstaclesOf(enclosure)
    const roam = roamRadius(enclosure)
    let index = 0
    for (const id of enclosure.species) {
      const species = SPECIES[id]
      const { bounds } = species.manifest
      const adult = species.members.find(m => m.scale >= 0.85) ?? species.members[0]
      for (const member of species.members) {
        // 黄金角で散らして、種類どうしが重ならないようにする
        const angle = index * 2.39996 + random() * 0.5
        const r = roam * (0.32 + 0.28 * ((index * 0.618) % 1))
        index += 1
        const a: AnimalState = {
          id: member.id,
          species: id,
          enclosure: enclosure.id,
          label: member.label,
          scale: member.scale,
          parent: member.id !== adult.id && member.scale < 0.8 ? adult.id : undefined,
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
          stall: 0,
          best: Infinity,
        }
        const parent = a.parent ? world.animals.find(b => b.id === a.parent) : undefined
        if (parent) {
          a.x = parent.x + Math.sin(parent.heading + 2.2) * (parent.radius + a.radius + 0.4)
          a.z = parent.z + Math.cos(parent.heading + 2.2) * (parent.radius + a.radius + 0.4)
          a.heading = parent.heading
        }
        // 障害物・柵・ほかの動物と重ならない場所が見つかるまで、少しずつずらす
        const others = world.animals.filter(b => b.enclosure === enclosure.id)
        for (let k = 0; k < 24; k++) {
          const p = settle(a, { x: a.x, z: a.z }, enclosure, obstacles, a.front + 0.2, a.radius)
          const clear = !overlaps(p, obstacles, a.radius) && others.every(b => distance(p, b) > a.radius + b.radius)
          a.x = p.x
          a.z = p.z
          if (clear) break
          const ang = angle + (k + 1) * 0.9
          const rr = roam * (0.25 + 0.6 * random())
          a.x = enclosure.center.x + Math.sin(ang) * rr
          a.z = enclosure.center.z + Math.cos(ang) * rr
        }
        world.animals.push(a)
      }
    }
  }
  return world
}

// ---------------------------------------------------------------------------
// 行動の開始

function neighbours(world: ZooWorld, a: AnimalState): AnimalState[] {
  return world.animals.filter(b => b !== a && b.enclosure === a.enclosure)
}

/** 障害物と仲間を避けた、まっすぐ歩いて行ける目的地を選ぶ。見つからなければ undefined。 */
export function pickWanderTarget(world: ZooWorld, a: AnimalState, random: Random): Vec2 | undefined {
  const { enclosure, obstacles } = homeOfAnimal(world, a)
  const others = neighbours(world, a)
  const person = visitorInside(world, enclosure)
  const blockers = person ? [...obstacles, person] : obstacles
  const usable = roamRadius(enclosure) - a.front - 0.4
  let best: Vec2 | undefined
  let bestScore = -Infinity
  for (let i = 0; i < 24; i++) {
    const ang = random() * Math.PI * 2
    const r = Math.sqrt(random()) * usable
    const p = { x: enclosure.center.x + Math.sin(ang) * r, z: enclosure.center.z + Math.cos(ang) * r }
    const d = distance(a, p)
    if (d < 1.6 * a.scale + 0.8) continue
    if (blockers.some(o => distance(p, o) < o.r + a.radius + 0.3)) continue
    if (blockers.some(o => segmentHitsCircle(a, p, o, a.radius * 0.9))) continue
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
  return best
}

/** 展示場の中で、目標の点 want にいちばん近い、立てる場所（障害物の外・柵の内側）。 */
function standingSpot(world: ZooWorld, a: AnimalState, want: Vec2): Vec2 {
  const { enclosure, obstacles } = homeOfAnimal(world, a)
  const inside = clampToEnclosure(want, enclosure, a.front + 0.25)
  const free = pushOutOfObstacles(inside, obstacles, a.radius + 0.2)
  return clampToEnclosure(free, enclosure, a.front + 0.1)
}

function setGoal(a: AnimalState, target: Vec2, plan: Plan, face?: number): void {
  a.goal = { x: target.x, z: target.z, face, plan }
  a.blocked = 0
  a.stall = 0
  a.best = Infinity
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

function goIdle(a: AnimalState, random: Random, scale = 1): void {
  a.mode = 'idle'
  a.modeTime = 0
  a.goal = undefined
  a.act = undefined
  a.run = false
  a.decideAt = between(random, SPECIES[a.species].mood.idle) * scale
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
    case 'visit':
      // 人の方を向いて、しばらくじっと見る
      a.goal = undefined
      a.mode = 'idle'
      a.modeTime = 0
      a.decideAt = 3.5 + (a.id.length % 3)
      a.run = false
      setClip(a, 'Idle')
      return
    case 'wander':
    case 'follow':
      a.goal = undefined
      a.mode = 'idle'
      a.modeTime = 0
      a.decideAt = plan.kind === 'follow' ? 1.2 : 0.4
      a.run = false
      setClip(a, 'Idle')
  }
}

/** 計画を始める。歩いて行く必要があれば目的地を決める。 */
export function begin(world: ZooWorld, a: AnimalState, plan: Plan, random: Random): void {
  a.pending = undefined
  const species = SPECIES[a.species]
  switch (plan.kind) {
    case 'wander': {
      const target = pickWanderTarget(world, a, random)
      if (!target) {
        goIdle(a, random, 0.5)
        return
      }
      a.run = !!plan.run
      setGoal(a, target, plan)
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
      const { enclosure } = homeOfAnimal(world, a)
      const shore = spec?.atPond ? pondShore(enclosure, a, a.front * 0.75 + 0.2) : undefined
      if (shore && enclosure.pond) {
        a.run = false
        setGoal(a, shore, plan, headingTo(shore, enclosure.pond))
      } else {
        perform(a, plan)
      }
      return
    }
    case 'follow': {
      const parent = world.animals.find(b => b.id === plan.target)
      if (!parent) {
        goIdle(a, random)
        return
      }
      // 親の斜め後ろ（親の進む向きの横）にならぶ
      const side = a.id.charCodeAt(a.id.length - 1) % 2 ? 1 : -1
      const ang = parent.heading + side * 2.3
      const gap = parent.radius + a.radius + 0.35
      const spot = standingSpot(world, a, { x: parent.x + Math.sin(ang) * gap, z: parent.z + Math.cos(ang) * gap })
      a.run = distance(a, spot) > 6
      setGoal(a, spot, plan, parent.heading)
      return
    }
    case 'visit': {
      const v = world.visitor
      if (!v) {
        goIdle(a, random)
        return
      }
      // 人の目の前（人から動物の方へ少しはなれた所）へ来る。柵の外の人なら、柵の内側のいちばん近い所になる
      const away = headingTo(v, a)
      const gap = VISITOR_RADIUS + a.front + 0.35
      const spot = standingSpot(world, a, { x: v.x + Math.sin(away) * gap, z: v.z + Math.cos(away) * gap })
      if (distance(spot, v) < VISITOR_RADIUS + a.front + 0.2 || distance(spot, a) < 0.3) {
        goIdle(a, random)
        return
      }
      a.run = false
      setGoal(a, spot, plan, headingTo(spot, v))
      return
    }
    default:
      perform(a, plan)
  }
}

/** 人が柵の近く（または中）にいるか。 */
function visitorNear(world: ZooWorld, a: AnimalState): boolean {
  const v = world.visitor
  if (!v) return false
  const { enclosure } = homeOfAnimal(world, a)
  return distance(v, enclosure.center) - enclosure.radius < VISIT_RANGE
}

/** 次に何をするか（自律行動）。 */
function decide(world: ZooWorld, a: AnimalState, random: Random): void {
  const species = SPECIES[a.species]
  const mood = species.mood
  const specials = species.specials
  const parent = a.parent ? world.animals.find(b => b.id === a.parent) : undefined
  const far = parent ? distance(a, parent) > FOLLOW_FAR * Math.max(1, parent.scale) + parent.radius : false
  const options: [number, () => Plan][] = [
    [mood.wander * (parent ? 0.5 : 1), () => ({ kind: 'wander' })],
    [mood.run, () => ({ kind: 'wander', run: true })],
    [mood.graze, () => ({ kind: 'graze' })],
    [mood.special * SHOWY, () => ({ kind: 'special', clip: specials[Math.floor(random() * specials.length)].clip })],
    [mood.sleep, () => ({ kind: 'sleep' })],
    // 子どもは、親からはなれると戻りたくなる（はなれていなくても、ときどき親のそばへ行く）
    [parent ? (far ? 8 : 1.5) : 0, () => ({ kind: 'follow', target: parent!.id })],
    // 柵の前に人がいると、近くへ見に来る
    [visitorNear(world, a) ? (mood.curious ?? 1) * 2.2 : 0, () => ({ kind: 'visit' })],
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

/**
 * エサを置き、食べに来させる。置いた場所を返す。
 * from（柵の外の人の位置）を渡すと、柵の内側の、人に近い所へ投げ入れる。なければ動物の前に置く。
 */
export function dropFood(world: ZooWorld, id: string, random: Random, from?: Vec2): FoodState | undefined {
  const a = world.animals.find(x => x.id === id)
  if (!a) return undefined
  const { enclosure, obstacles } = homeOfAnimal(world, a)
  const species = SPECIES[a.species]
  const margin = species.reach * a.scale + 0.3
  let spot: Vec2 = clampToEnclosure({ x: a.x, z: a.z }, enclosure, margin)
  for (let i = 0; i < 12; i++) {
    let p: Vec2
    if (from) {
      // 人の前から、動物のいる方へ少し寄せて投げ入れる
      const toward = headingTo(from, a) + (random() - 0.5) * (0.3 + i * 0.15)
      const throwDist = Math.min(distance(from, a), 3 + random() * 1.5 + i * 0.3)
      p = clampToEnclosure({ x: from.x + Math.sin(toward) * throwDist, z: from.z + Math.cos(toward) * throwDist }, enclosure, margin)
    } else {
      const ang = a.heading + (random() - 0.5) * (0.6 + i * 0.25)
      const d = species.reach * a.scale + 1.2 + random() * 1.2
      p = clampToEnclosure({ x: a.x + Math.sin(ang) * d, z: a.z + Math.cos(ang) * d }, enclosure, margin)
    }
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

/** 人の位置を伝える（歩くモード）。俯瞰では null。 */
export function setVisitor(world: ZooWorld, visitor: Visitor | null): void {
  world.visitor = visitor
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
  const prev = { x: a.x, z: a.z }
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
          if (goal.plan.kind === 'visit') events.push({ type: 'visit', animal: a.id })
          perform(a, goal.plan)
        } else {
          goIdle(a, random)
        }
      }
      break
    }
    case 'move':
      steer(world, a, lc, dt, random, events)
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
        else if (ateFood) {
          begin(world, a, { kind: 'react' }, random)
          // 食べて喜んだあと、お礼に固有アクションを見せることがある
          const specials = SPECIES[a.species].specials
          if (random() < THANKS) a.pending = { kind: 'special', clip: specials[Math.floor(random() * specials.length)].clip }
        } else goIdle(a, random)
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
  const { enclosure, obstacles } = homeOfAnimal(world, a)
  const person = visitorInside(world, enclosure)
  const free = settle(a, prev, enclosure, person ? [...obstacles, person] : obstacles)
  a.x = free.x
  a.z = free.z
}

function steer(world: ZooWorld, a: AnimalState, lc: Locomotion, dt: number, random: Random, events: ZooEvent[]): void {
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
    if (a.speed <= 0.001) {
      if (goal.plan.kind === 'visit' && (goal.face === undefined || Math.abs(wrapAngle(goal.face - a.heading)) <= 8 * DEG)) {
        events.push({ type: 'visit', animal: a.id })
      }
      arrive(a)
    }
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
  // 仲間（や、ふれあい広場の人）が行く手にいたら待つ。待ちすぎたら行き先を変える
  const { enclosure } = homeOfAnimal(world, a)
  const person = visitorInside(world, enclosure)
  const ahead = (b: Circle) => {
    const d = distance(a, b)
    return Math.abs(wrapAngle(headingTo(a, b) - a.heading)) < 0.9 && d < a.radius + b.r + 0.6 + a.speed * 1.5
  }
  if (neighbours(world, a).some(b => ahead({ x: b.x, z: b.z, r: b.radius })) || (person && ahead(person))) {
    vTarget = 0
    a.blocked += dt
  }
  // 障害物の角などに引っかかって近づけないまま時間がたったら、あきらめる
  if (dist < a.best - 0.15) {
    a.best = dist
    a.stall = 0
  } else {
    a.stall += dt
  }
  const accel = a.run ? 1.6 : 0.8
  a.speed += clamp(vTarget - a.speed, -DECEL * dt, accel * dt)
  if (a.speed < 0.05 && Math.abs(err) > SLOW_TURN) {
    startTurn(a, a.heading + err)
    return
  }
  if (a.blocked > 2.5 || a.stall > 3.5) {
    a.blocked = 0
    a.stall = 0
    const kind = goal.plan.kind
    if (kind === 'wander') begin(world, a, { kind: 'wander' }, random)
    // 仲間とゆずり合ったまま・引っかかったまま動けないときは、その場で見せる・食べる（ずっと待たせない）
    else if (kind === 'special' || kind === 'eat') perform(a, goal.plan)
    else if (kind === 'follow' || kind === 'visit') goIdle(a, random, 0.5)
  }
}

/** 同じ展示場の動物どうしが重ならないよう、少しずつ押し離す（ちがう種類どうしも）。 */
function separate(world: ZooWorld): void {
  const list = world.animals
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]
      const b = list[j]
      if (a.enclosure !== b.enclosure) continue
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
      const before = [{ x: a.x, z: a.z }, { x: b.x, z: b.z }]
      a.x += nx * share * wa
      a.z += nz * share * wa
      b.x -= nx * share * wb
      b.z -= nz * share * wb
      // 押し離した先が柵・池・岩・木にかからないよう、立てる位置へ直す
      ;[a, b].forEach((c, k) => {
        const { enclosure, obstacles } = homeOfAnimal(world, c)
        const free = settle(c, before[k], enclosure, obstacles)
        c.x = free.x
        c.z = free.z
      })
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

/** 画面に出す「いま なにしてる？」の短い言葉。 */
export type Activity = 'walk' | 'run' | 'eat' | 'sleep' | 'special' | 'happy' | 'rest'

export function activityOf(a: AnimalState): Activity {
  if (a.mode === 'sleep') return 'sleep'
  if (a.mode === 'move') return a.run ? 'run' : 'walk'
  if (a.mode === 'act') {
    const kind = a.act?.plan.kind
    if (kind === 'eat' || kind === 'graze') return 'eat'
    if (kind === 'special') return 'special'
    if (kind === 'react') return 'happy'
  }
  return 'rest'
}
