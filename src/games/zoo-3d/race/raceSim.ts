// どうぶつレースの進み方を、スタートの前に最後まで計算する（純粋なロジック。Three.js を使わない）。
// 勝ち負けは乱数で決まるが、動物の運動の力（athletes.ts）とコースの地面・カーブ・ハードルで
// 勝ちやすさが変わる。描画側は、決まった進み方（各時刻の位置と、よりみち・つまずき）を再生するだけ。
//
// 速さ: 実際の最高速度の差をそのまま使うと、小さな動物が いつも大きく負けて見ていて楽しくない。
// 差を縮めて（EXPONENT 乗）使い、そのうえで次のことで勝ち負けが ゆれるようにする。
// - きょうの ちょうし（コンディション）と、走っている間の小さなゆらぎ
// - スタートの でおくれ、持久力が少ない動物の ばてる、ラストスパート
// - よりみち（とちゅうで とくいわざを始めてしまう）、ハードル・丸太での つまずき
// - 地面（こおり・みず・どろんこ・森の小道）とカーブの得意・不得意

import { locomotionOf } from '../motion'
import { SPECIES, type SpeciesId } from '../species'
import { ATHLETES, type Athlete } from './athletes'
import { buildPath, curvatureFrom, curvatureTable, type CoursePath, type CurvatureTable } from './course'
import { terrainAt, type CourseSpec, type RaceDef, type RaceId, type Terrain } from './races'

export type Random = () => number

/** 計算の刻み（秒）。再生はこの刻みの間をなめらかにつなぐ。 */
export const DT = 1 / 20
/** これより長いレースは打ち切る（秒）。 */
const CAP = 90
/** 実際の速さの差を縮める度合い（1 でそのまま、0 で全員同じ）。 */
const EXPONENT = 0.2
/** 持久力が切れはじめる元気の残り。 */
const TIRED = 0.35
/** 持久力 0 の動物が 元気を使いきるまでの秒数。 */
const DRAIN_TIME = 17
/** スタートラインの少しうしろに並ぶ（m）。 */
export const START_BACK = 0.9

export type Mood = 'great' | 'good' | 'sleepy'

export type Act =
  | { kind: 'quirk'; from: number; to: number; clip: string }
  | { kind: 'stumble'; from: number; to: number }
  | { kind: 'jump'; from: number; to: number; ok: boolean }

export type RunnerPlan = {
  species: SpeciesId
  /** レーン（0 が いちばん左）。 */
  lane: number
  /** きょうの ちょうし（1 が ふつう）。 */
  condition: number
  mood: Mood
  /** スタートの合図から走り出すまで（秒）。 */
  reaction: number
  /** 時刻 k * DT の、スタートラインからの距離。ゴールまで（ゴールのあとは止まるまでの動きを計算で出す）。 */
  s: Float32Array
  /** ゴールした時刻（秒）。打ち切りまでにゴールしなければ Infinity。 */
  finish: number
  /** ゴールしたときの速さ（m/s）。 */
  finishSpeed: number
  acts: Act[]
}

type EventBody =
  | { type: 'late' }
  | { type: 'lead' }
  | { type: 'quirk'; clip: string }
  | { type: 'stumble' }
  | { type: 'tired' }
  | { type: 'swim' }
  | { type: 'slide' }
  | { type: 'mud' }
  | { type: 'spurt' }
  | { type: 'finish'; place: number }

export type RaceEvent = { t: number; runner: number } & EventBody

export type RacePlan = {
  race: RaceId
  distance: number
  runners: RunnerPlan[]
  /** 着順（runners の番号）。 */
  order: number[]
  events: RaceEvent[]
  /** みんながゴールした時刻（または打ち切り）。 */
  end: number
}

function gauss(random: Random): number {
  const u = Math.max(1e-9, random())
  const v = random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function shuffle<T>(items: readonly T[], random: Random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** 実際の速さ（km/h）を、レースの速さの比（REF km/h で 1）にする。 */
export function speedRatio(kmh: number): number {
  return (Math.max(1, kmh) / 60) ** EXPONENT
}

const pathCache = new WeakMap<CourseSpec, { path: CoursePath; curvature: CurvatureTable }>()

function courseShape(course: CourseSpec): { path: CoursePath; curvature: CurvatureTable } {
  let shape = pathCache.get(course)
  if (!shape) {
    const path = buildPath(course.points, { closed: course.closed, smooth: course.smooth })
    shape = { path, curvature: curvatureTable(path) }
    pathCache.set(course, shape)
  }
  return shape
}

/** コースの中心線（同じコースは作り直さない）。 */
export function coursePath(course: CourseSpec): CoursePath {
  return courseShape(course).path
}

/** そのレースの速さの基準（REF km/h の動物の m/s）。いちばん速い動物が time 秒くらいでゴールする。 */
export function racePace(race: RaceDef): number {
  const fastest = Math.max(...race.runners.map(id => ATHLETES[id].speed))
  return race.course.distance / race.time / speedRatio(fastest)
}

type Runner = {
  a: Athlete
  /** やぶで じゃまに なる 体の大きさ（0〜1）。 */
  bulk: number
  land: number
  swim: number
  slide: number
  accel: number
  drain: number
  energy: number
  noise: number
  spurt: number
  v: number
  s: number
  samples: number[]
  finish: number
  finishSpeed: number
  acts: Act[]
  quirkAt?: number
  quirkClip: string
  /** よりみち・つまずきが終わる時刻。 */
  busyUntil: number
  stumbleUntil: number
  tiredSaid: boolean
  zoneSaid: Set<number>
}

function terrainSpeed(r: Runner, terrain: Terrain): number {
  switch (terrain) {
    case 'water': return r.swim
    case 'ice': return Math.max(r.land * (0.6 + 0.4 * r.a.grip), r.slide)
    case 'mud': return r.land * (0.35 + 0.65 * r.a.mud)
    case 'trail': return r.land * (0.85 + 0.15 * r.a.agility)
    // やぶ: 体の大きな動物ほど 枝や草に じゃまされる
    case 'bush': return r.land * (1 - 0.3 * r.bulk) * (0.9 + 0.1 * r.a.agility)
    default: return r.land
  }
}

function zoneIndex(course: CourseSpec, s: number): number {
  return course.zones.findIndex(z => s >= z.from && s < z.to)
}

/** 1回のレースを最後まで計算する。 */
export function planRace(race: RaceDef, random: Random): RacePlan {
  const course = race.course
  const { curvature } = courseShape(course)
  const distance = course.distance
  const pace = racePace(race)
  const species = shuffle(race.runners, random)
  // 持久力 0 の動物が、およそ DRAIN_TIME 秒で 元気を使いきる（長いレースほど 持久力が だいじ）
  const drainBase = 1 / DRAIN_TIME

  const setups = species.map((id, lane) => {
    const condition = Math.max(0.88, Math.min(1.12, 1 + gauss(random) * 0.06))
    const a = ATHLETES[id]
    let reaction = 0.08 + random() * 0.3
    const late = random() < 0.05 + 0.08 * (1 - a.accel)
    if (late) reaction += 0.5 + random() * 0.5
    return { id, lane, condition, reaction, late }
  })

  const runners: Runner[] = setups.map(({ id }) => {
    const a = ATHLETES[id]
    let quirkAt: number | undefined
    if (random() < a.quirk.chance) {
      // 泳いでいる所・ハードルの近くでは、よりみちしない
      for (let tries = 0; tries < 12 && quirkAt === undefined; tries++) {
        const at = distance * (0.18 + random() * 0.6)
        if (terrainAt(course, at) !== 'water' && !course.jumps.some(j => Math.abs(j - at) < 4)) quirkAt = at
      }
    }
    return {
      a,
      bulk: Math.max(0, Math.min(1, (SPECIES[id].manifest.bounds.height - 0.7) / 1.0)),
      land: pace * speedRatio(a.speed),
      swim: pace * speedRatio(a.swim),
      slide: a.slide ? pace * speedRatio(a.slide) : 0,
      accel: 0.7 + 2.3 * a.accel,
      drain: (1 - a.stamina) * drainBase,
      energy: 1,
      noise: 0,
      spurt: 1,
      v: 0,
      s: -START_BACK,
      samples: [-START_BACK],
      finish: Infinity,
      finishSpeed: 0,
      acts: [],
      quirkAt,
      quirkClip: a.quirk.clip,
      busyUntil: 0,
      stumbleUntil: 0,
      tiredSaid: false,
      zoneSaid: new Set(),
    }
  })

  const events: RaceEvent[] = []
  setups.forEach((s, i) => { if (s.late) events.push({ t: s.reaction, runner: i, type: 'late' }) })

  const rankOf = (): number[] => runners
    .map((_, i) => i)
    .sort((i, j) => {
      const a = runners[i]
      const b = runners[j]
      if (a.finish !== b.finish) return a.finish - b.finish
      return b.s - a.s
    })
  let ranks = rankOf()
  let leader = -1
  let candidate = -1
  let candidateSince = 0
  let winnerDone = false

  let t = 0
  for (let k = 0; t < CAP; k++) {
    t = k * DT
    for (let i = 0; i < runners.length; i++) {
      const r = runners[i]
      if (r.finish < Infinity) continue
      const setup = setups[i]
      const prev = r.s
      if (t >= setup.reaction) {
        const quirking = t < r.busyUntil
        if (quirking) {
          // よりみち中は止まって、とくいわざをする（少し元気が もどる）
          r.v *= Math.exp(-7 * DT)
          r.energy = Math.min(1, r.energy + 0.04 * DT)
        } else {
          const terrain = terrainAt(course, r.s)
          const corner = 1 - Math.min(0.3, curvatureFrom(curvature, r.s) * 1.8 * (1 - r.a.agility))
          const fatigue = r.energy >= TIRED ? 1 : 0.7 + 0.3 * Math.max(0, r.energy) / TIRED
          const stumble = t < r.stumbleUntil ? 0.35 : 1
          r.noise += -r.noise * 1.2 * DT + gauss(random) * 0.035 * Math.sqrt(DT)
          const target = terrainSpeed(r, terrain) * corner * setup.condition * (1 + r.noise) * fatigue * r.spurt * stumble
          const rate = target > r.v ? r.accel : 3
          r.v += (target - r.v) * (1 - Math.exp(-rate * DT))
          r.energy -= r.drain * (r.v / r.land) ** 2 * DT
          if (fatigue < 0.92 && !r.tiredSaid) {
            r.tiredSaid = true
            if (ranks.indexOf(i) <= 1) events.push({ t, runner: i, type: 'tired' })
          }
        }
        r.s += r.v * DT
      }
      // ラストスパート（元気が残っている動物ほど のびる）
      if (prev < distance * 0.72 && r.s >= distance * 0.72 && r.energy > TIRED) {
        r.spurt = 1 + random() * 0.05 * (0.4 + 0.6 * r.a.stamina)
      }
      // ハードル・丸太
      for (const j of course.jumps) {
        if (prev < j && r.s >= j) {
          const at = t + DT * ((j - prev) / Math.max(1e-6, r.s - prev))
          const ok = random() < 0.5 + 0.5 * r.a.jump ** 0.8
          r.acts.push({ kind: 'jump', from: at - 0.22, to: at + 0.24, ok })
          if (ok) {
            r.v *= 0.82 + 0.18 * r.a.jump
          } else {
            r.v *= 0.25
            r.stumbleUntil = at + 0.9
            r.acts.push({ kind: 'stumble', from: at, to: at + 0.9 })
            events.push({ t: at, runner: i, type: 'stumble' })
          }
        }
      }
      // よりみち
      if (r.quirkAt !== undefined && prev < r.quirkAt && r.s >= r.quirkAt) {
        const duration = SPECIES[setup.id].manifest.clips[r.quirkClip]?.duration ?? 3
        r.busyUntil = t + duration + 0.3
        r.acts.push({ kind: 'quirk', from: t, to: t + duration + 0.3, clip: r.quirkClip })
        events.push({ t, runner: i, type: 'quirk', clip: r.quirkClip })
        r.quirkAt = undefined
      }
      if (prev < distance && r.s >= distance) {
        r.finish = t + DT * ((distance - prev) / Math.max(1e-6, r.s - prev))
        r.finishSpeed = r.v
      }
      r.samples.push(r.s)
    }

    // 順位の変化（トップの入れかわり・とくいな地面での おいぬき）
    const next = rankOf()
    if (!winnerDone && t > 1.2) {
      const top = next[0]
      if (top !== candidate) {
        candidate = top
        candidateSince = t
      }
      // 0.6 秒以上 トップが続いたら「トップ！」
      if (candidate !== leader && t - candidateSince >= 0.6) {
        leader = candidate
        events.push({ t: candidateSince, runner: leader, type: 'lead' })
      }
    }
    next.forEach((i, rank) => {
      const r = runners[i]
      if (r.finish < Infinity || rank >= ranks.indexOf(i)) return
      const zone = zoneIndex(course, r.s)
      const terrain = terrainAt(course, r.s)
      const key = zone >= 0 ? zone : -1
      if (r.zoneSaid.has(key)) return
      if (terrain === 'water' && r.swim > r.land * 0.9) {
        r.zoneSaid.add(key)
        events.push({ t, runner: i, type: 'swim' })
      } else if (terrain === 'mud' && r.a.mud >= 0.8) {
        r.zoneSaid.add(key)
        events.push({ t, runner: i, type: 'mud' })
      } else if (terrain === 'ice' && r.slide > 0) {
        r.zoneSaid.add(key)
        events.push({ t, runner: i, type: 'slide' })
      } else if (r.s > distance * 0.75 && rank === 0 && leader !== i) {
        r.zoneSaid.add(key)
        events.push({ t, runner: i, type: 'spurt' })
      }
    })
    ranks = next
    if (!winnerDone && runners.some(r => r.finish < Infinity)) winnerDone = true
    if (runners.every(r => r.finish < Infinity)) break
  }

  const order = rankOf()
  order.forEach((i, place) => {
    const r = runners[i]
    if (r.finish < Infinity) events.push({ t: r.finish, runner: i, type: 'finish', place: place + 1 })
  })
  events.sort((a, b) => a.t - b.t)

  const plans: RunnerPlan[] = runners.map((r, i) => {
    const c = setups[i].condition
    return {
      species: setups[i].id,
      lane: setups[i].lane,
      condition: c,
      mood: c >= 1.035 ? 'great' : c <= 0.965 ? 'sleepy' : 'good',
      reaction: setups[i].reaction,
      s: Float32Array.from(r.samples),
      finish: r.finish,
      finishSpeed: r.finishSpeed,
      acts: r.acts,
    }
  })
  const finished = plans.map(p => p.finish).filter(f => f < Infinity)
  return {
    race: race.id,
    distance,
    runners: plans,
    order,
    events,
    end: plans.every(p => p.finish < Infinity) ? Math.max(...finished) : CAP,
  }
}

// ---------------------------------------------------------------------------
// 再生（時刻 t の動物の様子）

/** ゴールのあと止まるまでの時間の目安（秒）。 */
const RUNOUT = 1.4

/** 時刻 t（スタートの合図が 0）の、スタートラインからの距離。 */
export function distanceAt(r: RunnerPlan, t: number): number {
  if (t <= 0) return r.s[0]
  const last = r.s.length - 1
  const end = last * DT
  if (t >= end) {
    // ゴールの少し先まで、だんだん ゆっくりになって止まる（打ち切りまでにゴールしなかった動物は その場で止まる）
    const over = t - end
    return r.s[last] + r.finishSpeed * RUNOUT * (1 - Math.exp(-over / RUNOUT))
  }
  const k = t / DT
  const i = Math.min(last - 1, Math.floor(k))
  return r.s[i] + (r.s[i + 1] - r.s[i]) * (k - i)
}

export type Pose = {
  /** スタートラインからの距離（m）。スタート前は少しうしろ、ゴールのあとは止まるまで進む。 */
  s: number
  /** 進む速さ（m/s）。 */
  speed: number
  /** 再生したいクリップ。 */
  clip: string
  /** ワンショットのクリップを始め直すたびに変わる番号。 */
  token: number
  /** ジャンプの高さ（m、ハードルの高さに対する割合 0〜1）。 */
  hop: number
  /** つまずき（0〜1）。前へ つんのめる。 */
  trip: number
  terrain: Terrain
  finished: boolean
}

const walkSpeedCache = new Map<SpeciesId, number>()
function walkSpeed(id: SpeciesId): number {
  let v = walkSpeedCache.get(id)
  if (v === undefined) {
    v = locomotionOf(SPECIES[id].manifest).walkSpeed
    walkSpeedCache.set(id, v)
  }
  return v
}

/** 時刻 t の、その動物の様子。winner は1着の動物（ゴールのあと よろこぶ）。 */
export function poseAt(plan: RacePlan, course: CourseSpec, index: number, t: number): Pose {
  const r = plan.runners[index]
  const s = distanceAt(r, t)
  const h = 0.05
  const speed = t <= 0 ? 0 : Math.max(0, (distanceAt(r, t + h) - distanceAt(r, Math.max(0, t - h))) / (t + h - Math.max(0, t - h)))
  const terrain = terrainAt(course, Math.max(0, s))
  const finished = t >= r.finish
  let clip = speed < 0.12 ? 'Idle' : speed < walkSpeed(r.species) * 1.5 ? 'Walk' : 'Run'
  let token = 0
  let hop = 0
  let trip = 0
  r.acts.forEach((act, i) => {
    if (t < act.from || t >= act.to) return
    const k = (t - act.from) / (act.to - act.from)
    if (act.kind === 'quirk') {
      clip = act.clip
      token = i + 1
    } else if (act.kind === 'jump') {
      hop = Math.sin(Math.PI * k) * (act.ok ? 1 : 0.55)
    } else {
      trip = Math.sin(Math.PI * Math.min(1, k * 1.6))
    }
  })
  if (finished && t > r.finish + RUNOUT * 2.2 && plan.order[0] === index) {
    // 1着の動物は、止まったら よろこぶ（くりかえし）
    const after = t - r.finish - RUNOUT * 2.2
    clip = 'Happy'
    token = 1000 + Math.floor(after / 2.4)
  }
  return { s, speed, clip, token, hop, trip, terrain, finished }
}

/** 時刻 t の順位（runners の番号）。ゴールした動物は着順、ほかは前にいる順。 */
export function rankingAt(plan: RacePlan, t: number): number[] {
  return plan.runners.map((_, i) => i).sort((i, j) => {
    const a = plan.runners[i]
    const b = plan.runners[j]
    const fa = a.finish <= t ? a.finish : Infinity
    const fb = b.finish <= t ? b.finish : Infinity
    if (fa !== fb) return fa - fb
    return distanceAt(b, t) - distanceAt(a, t)
  })
}

// ---------------------------------------------------------------------------
// じっきょう（お知らせを出す できごとを えらぶ）

const PRIORITY: Record<RaceEvent['type'], number> = {
  finish: 9, quirk: 7, stumble: 6, late: 5, swim: 5, slide: 5, mud: 5, spurt: 4, tired: 4, lead: 3,
}

/**
 * 画面に出す じっきょう。できごとが続くときは、だいじな ものを残して間引く。
 * ゴールは 3着までと、おうえんしている動物（cheer）を出す。
 */
export function narrate(plan: RacePlan, cheer?: number, gap = 1.5): RaceEvent[] {
  const out: RaceEvent[] = []
  for (const e of plan.events) {
    if (e.type === 'finish') {
      if (e.place <= 3 || e.runner === cheer) out.push(e)
      continue
    }
    const last = out[out.length - 1]
    if (!last || e.t - last.t >= gap) {
      out.push(e)
    } else if (PRIORITY[e.type] > PRIORITY[last.type] && last.type !== 'finish') {
      // すぐ前の お知らせより だいじなら、入れかえる
      out[out.length - 1] = e
    }
  }
  return out
}
