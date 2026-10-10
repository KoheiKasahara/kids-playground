// カブクワの たたかい。2ひきが むかいあって くみあい、おしあい、わざで なげとばす。
// プレイヤーは みている だけ。1/60びょうずつ すすめる 純粋な しくみで、画面・音とは events で つながる。
//
// つよさの もとは species.ts の ステータス（おおきさ・ちから・はやさ）と からだの おもさ。
//   - おしあい: ちから と おもさ が 大きいほど つよく おす。
//   - わざ: ちから・おもさ・ツノ（あご）の ながさで せいこうしやすく、あいてが つかれて いるほど きまる。
//   - はやさ: わざを だす かいすう・よける・おきあがる はやさ。

import { beetleSize } from './model'
import { rng } from './pixel'
import type { MoveKind, Species } from './species'
import { BRANCH_RUN_OFF, edgeRoom, fallFloor, groundHeight, hasGround, type StageId } from './stages'

export const DT = 1 / 60
/** はっけよい から のこった までの じかん。 */
export const READY_SECONDS = 2.2
/** これを すぎたら げんきの のこりで はんてい。 */
export const TIME_LIMIT = 75
const GRAVITY = 300

export type FighterState =
  | 'ready' | 'approach' | 'circle' | 'clash' | 'windup' | 'strike' | 'stagger'
  | 'thrown' | 'flipped' | 'cling' | 'fall' | 'flee' | 'win' | 'out'

export type FighterPose = {
  leg: number
  lift: number
  jaw: number
  flipped: boolean
  /** くうちゅうで まわる（画面の なかでの 回転）。 */
  spin: number
  /** えだに ぶらさがって いる。 */
  hang: boolean
}

export type Fighter = {
  side: 0 | 1
  sp: Species
  /** からだの まえ・うしろの ながさ（ドット）。 */
  front: number
  rear: number
  /** おもさ（くらべる ための かず）と その へいほうこん。 */
  mass: number
  weight: number
  power: number
  speed: number
  /** その日の ちょうし（0.8〜1.2）。おなじ あいてでも かちまけが かわる。 */
  form: number
  maxSt: number
  st: number
  u: number; v: number; z: number
  vu: number; vv: number; vz: number
  /** むいている ほうこう（u・v の めん）。 */
  heading: number
  state: FighterState
  t: number
  /** つぎの わざまで。 */
  cd: number
  /** いまの わざ。 */
  move: Technique | null
  pose: FighterPose
  /** おしあいの ゆらぎ。 */
  wobble: readonly [number, number, number, number]
  orbit: 1 | -1
  /** おしあいで まけて さがった きょり（すべる はんてい）。 */
  pushed: number
  /** はしで あぶない と いった あと。 */
  warned: boolean
}

/** わざ。どの むしも はしで こらえた ときだけ「うっちゃり」を だせる。 */
export type Technique = MoveKind | 'utchari'

export type EndReason = 'throw' | 'push' | 'slip' | 'flee' | 'judge'

export type BattleEvent =
  | { type: 'ready' }
  | { type: 'go' }
  | { type: 'clash'; u: number; v: number }
  | { type: 'windup'; side: 0 | 1; move: Technique }
  | { type: 'hit'; side: 0 | 1; move: Technique; u: number; v: number; z: number; big: boolean }
  | { type: 'block'; side: 0 | 1; u: number; v: number }
  | { type: 'dodge'; side: 0 | 1 }
  | { type: 'land'; side: 0 | 1; flipped: boolean; u: number; v: number }
  | { type: 'recover'; side: 0 | 1 }
  | { type: 'cling'; side: 0 | 1 }
  | { type: 'climb'; side: 0 | 1 }
  | { type: 'slip'; side: 0 | 1 }
  | { type: 'edge'; side: 0 | 1 }
  | { type: 'push'; side: 0 | 1 }
  | { type: 'fall'; side: 0 | 1; reason: EndReason }
  | { type: 'flee'; side: 0 | 1 }
  | { type: 'timeup' }
  | { type: 'end'; winner: 0 | 1; reason: EndReason }

export type Battle = {
  stage: StageId
  f: [Fighter, Fighter]
  time: number
  state: 'ready' | 'fight' | 'over'
  stateT: number
  winner: 0 | 1 | null
  reason: EndReason | null
  /** まけが きまった ところ（おちた・にげた）。 */
  loserReason: EndReason | null
  events: BattleEvent[]
  random: () => number
  /** おしあいで おなじ ほうが おしつづけて いる じかん（+ は 0、- は 1 が おしている）。 */
  pushRun: number
  /** つぎに「おしている」と いえるまで。 */
  pushQuiet: number
}

/** おしあいで つかう ちから。 */
export function pushStrength(f: Pick<Fighter, 'power' | 'weight' | 'form'>) {
  return f.power * f.form + f.weight * 3
}

function makeFighter(sp: Species, side: 0 | 1, startU: number, random: () => number): Fighter {
  const size = beetleSize(sp)
  const mass = Math.pow(sp.lengthMm[1] / 100, 2) * sp.build
  const weight = Math.sqrt(mass)
  const maxSt = 90 + weight * 35
  return {
    side, sp, front: size.front, rear: size.rear, mass, weight,
    power: sp.stats.power, speed: sp.stats.speed, form: .8 + random() * .4, maxSt, st: maxSt,
    u: side === 0 ? -startU : startU, v: 0, z: 0, vu: 0, vv: 0, vz: 0,
    heading: side === 0 ? 0 : Math.PI,
    state: 'ready', t: 0, cd: 0, move: null,
    pose: { leg: random(), lift: 0, jaw: 0, flipped: false, spin: 0, hang: false },
    wobble: [1.2 + random() * 1.1, random() * 6.28, 3 + random() * 2, random() * 6.28],
    orbit: random() < .5 ? 1 : -1, pushed: 0, warned: false,
  }
}

export function createBattle(a: Species, b: Species, stage: StageId, seed: number, startU = 56): Battle {
  const random = rng(seed)
  return {
    stage,
    f: [makeFighter(a, 0, startU, random), makeFighter(b, 1, startU, random)],
    time: 0, state: 'ready', stateT: 0, winner: null, reason: null, loserReason: null,
    events: [{ type: 'ready' }], random, pushRun: 0, pushQuiet: 0,
  }
}

export function drainEvents(b: Battle) {
  const out = b.events
  b.events = []
  return out
}

// ---------------- こまかい どうぐ ----------------

const other = (b: Battle, f: Fighter) => b.f[1 - f.side]

function set(f: Fighter, state: FighterState) {
  f.state = state
  f.t = 0
}

/** a から b への きょりと むき。 */
function toward(a: Fighter, b: Fighter) {
  const du = b.u - a.u, dv = b.v - a.v
  const d = Math.hypot(du, dv) || 1
  return { d, nu: du / d, nv: dv / d }
}

/** くみあう きょり（ツノ・あごが かさなる ぶん ちかい）。 */
export function contactDistance(a: Fighter, b: Fighter) {
  return (a.front + b.front) * .52 + 4
}

function turnToward(f: Fighter, angle: number, rate: number) {
  let d = angle - f.heading
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  f.heading += Math.max(-rate * DT, Math.min(rate * DT, d))
}

function walkSpeed(f: Fighter) {
  return 16 + f.speed * 3.4
}

/** あいてが くみあえる じょうたいか。 */
function canEngage(f: Fighter) {
  return f.state === 'approach' || f.state === 'circle' || f.state === 'clash' || f.state === 'windup' || f.state === 'strike'
}

function busyWithBody(f: Fighter) {
  return f.state === 'thrown' || f.state === 'fall' || f.state === 'flipped' || f.state === 'cling' || f.state === 'out' || f.state === 'flee'
}

function nextCooldown(b: Battle, f: Fighter) {
  return (2 + b.random() * 2.4) * (1.5 - f.speed * .075)
}

function wobble(f: Fighter, time: number) {
  const [f1, p1, f2, p2] = f.wobble
  return .65 * Math.sin(f1 * time + p1) + .35 * Math.sin(f2 * time + p2)
}

/** ひとことで いうと どれくらい わざが きまりやすいか（0〜1）。 */
export function strikeChance(att: Fighter, def: Fighter) {
  const reach = (att.front - def.front) / 22
  const a = att.power * att.form + att.weight * 2.5 + reach
  const d = def.power * def.form * .55 + def.weight * 3 + def.speed * .25
  const tired = 1 - def.st / def.maxSt
  return Math.max(.1, Math.min(.85, .2 + (a - d) * .045 + tired * .5))
}

// ---------------- じょうたいごとの うごき ----------------

function startClash(b: Battle, a: Fighter, c: Fighter) {
  for (const f of [a, c]) {
    if (f.state === 'approach' || f.state === 'circle') {
      set(f, 'clash')
      if (f.cd <= 0) f.cd = 1.4 + b.random() * 1.8 - Math.max(0, f.front - other(b, f).front) / 60
    }
  }
  const mu = (a.u + c.u) / 2, mv = (a.v + c.v) / 2
  b.events.push({ type: 'clash', u: mu, v: mv })
}

function approach(b: Battle, f: Fighter) {
  const o = other(b, f)
  const { d, nu, nv } = toward(f, o)
  turnToward(f, Math.atan2(nv, nu), 7)
  const contact = contactDistance(f, o)
  if (!canEngage(o)) {
    // あいてが ひっくりかえって いる あいだは すこし はなれて いかく する。
    const want = contact + 14
    const go = d > want + 2 ? 1 : d < want - 2 ? -.6 : 0
    f.u += nu * go * walkSpeed(f) * .6 * DT
    f.v += nv * go * walkSpeed(f) * .6 * DT
    f.pose.lift = .5 + .5 * Math.sin(f.t * 7)
    f.pose.leg += go ? DT * 2.4 : 0
    return
  }
  f.pose.lift = Math.max(0, f.pose.lift - DT * 2)
  if (d <= contact) {
    startClash(b, f, o)
    return
  }
  const step = Math.min(walkSpeed(f) * DT, d - contact)
  f.u += nu * step
  f.v += nv * step
  // まるたでは まんなかへ もどろうと する。
  if (b.stage === 'log') f.v *= .98
  if (b.stage === 'branch') f.v = 0
  f.pose.leg += DT * (1.6 + f.speed * .25)
  // きりかぶでは ときどき まわりこむ。
  if (b.stage === 'stump' && d > contact + 30 && f.t > .3 && b.random() < DT * .55) {
    set(f, 'circle')
    f.orbit = b.random() < .5 ? 1 : -1
  }
  stayOnStage(b, f)
}

function circle(b: Battle, f: Fighter) {
  const o = other(b, f)
  const { d, nu, nv } = toward(f, o)
  turnToward(f, Math.atan2(nv, nu), 8)
  const want = contactDistance(f, o) + 26
  const speed = walkSpeed(f) * .75
  const radial = Math.max(-1, Math.min(1, (d - want) / 12))
  f.u += (-nv * f.orbit * speed + nu * radial * speed) * DT
  f.v += (nu * f.orbit * speed + nv * radial * speed) * DT
  f.pose.leg += DT * 2.6
  stayOnStage(b, f)
  if (f.t > .8 + f.speed * .06 || d < contactDistance(f, o)) set(f, 'approach')
}

/** はしに ちかづきすぎたら まんなかへ むかう（じぶんから おちない）。 */
function stayOnStage(b: Battle, f: Fighter) {
  if (b.stage === 'branch') return
  const room = edgeRoom(b.stage, f.u, f.v)
  if (room > 22) return
  const k = (22 - room) / 22 * 30 * DT
  const d = Math.hypot(f.u, f.v) || 1
  if (b.stage === 'stump') { f.u -= f.u / d * k; f.v -= f.v / d * k }
  else { f.u -= Math.sign(f.u) * k * (Math.abs(f.u) > 60 ? 1 : 0); f.v *= .9 }
}

/** くみあって おしあう。2ひき いっしょに うごく。 */
function clash(b: Battle, a: Fighter, c: Fighter) {
  const { nu, nv } = toward(a, c)
  turnToward(a, Math.atan2(nv, nu), 6)
  turnToward(c, Math.atan2(-nv, -nu), 6)
  const fa = force(b, a), fc = force(b, c)
  const net = fa - fc
  const vel = Math.max(-30, Math.min(30, net * 5 / (a.weight + c.weight)))
  // まんなかを うごかし、きょりは くみあう きょりに たもつ。
  const contact = contactDistance(a, c)
  const mu = (a.u + c.u) / 2 + nu * vel * DT
  const mv = (a.v + c.v) / 2 + nv * vel * DT
  let au = mu - nu * contact / 2, av = mv - nv * contact / 2
  let cu = mu + nu * contact / 2, cv = mv + nv * contact / 2
  // きりかぶでは、おされて はしに きた ほうが まわりこんで にげる。
  if (b.stage === 'stump') {
    const loser = vel > 0 ? c : a
    const room = edgeRoom(b.stage, loser === c ? cu : au, loser === c ? cv : av)
    if (room < 34 && b.random() < DT * (.6 + loser.speed * .12)) {
      const ang = (b.random() < .5 ? 1 : -1) * (.25 + b.random() * .35)
      const cs = Math.cos(ang), sn = Math.sin(ang)
      const ru = (au - mu) * cs - (av - mv) * sn, rv = (au - mu) * sn + (av - mv) * cs
      // まわった ぶん、すこし まんなかへ よる。
      const md = Math.hypot(mu, mv) || 1
      const su = -mu / md * 4, sv = -mv / md * 4
      au = mu + ru + su; av = mv + rv + sv
      cu = mu - ru + su; cv = mv - rv + sv
    }
  }
  if (b.stage === 'branch') { av = 0; cv = 0 }
  // きりかぶでは まわりながら おしあう（うえから みると くるくる まわる）。
  if (b.stage === 'stump') {
    const turn = DT * .55 * Math.sin(b.time * .45 + a.wobble[1])
    const cs = Math.cos(turn), sn = Math.sin(turn)
    const ru = (au - cu) / 2, rv = (av - cv) / 2
    const mu2 = (au + cu) / 2, mv2 = (av + cv) / 2
    au = mu2 + ru * cs - rv * sn; av = mv2 + ru * sn + rv * cs
    cu = mu2 - (ru * cs - rv * sn); cv = mv2 - (ru * sn + rv * cs)
  }
  a.u = au; a.v = av; c.u = cu; c.v = cv
  // ぐいぐい おしつづけたら じっきょう する。
  const pushing = vel > 6 ? 1 : vel < -6 ? -1 : 0
  b.pushRun = pushing === 0 || Math.sign(b.pushRun) !== pushing ? pushing * DT : b.pushRun + pushing * DT
  b.pushQuiet = Math.max(0, b.pushQuiet - DT)
  if (Math.abs(b.pushRun) > .9 && b.pushQuiet <= 0) {
    b.events.push({ type: 'push', side: b.pushRun > 0 ? 0 : 1 })
    b.pushQuiet = 3.5
  }
  for (const [f, mine, theirs, dir] of [[a, fa, fc, vel], [c, fc, fa, -vel]] as const) {
    f.pose.leg += DT * Math.abs(vel) * .08 + DT * .6
    if (f.state === 'clash') {
      f.pose.lift += ((.25 + .2 * Math.sin(b.time * 5 + f.side * 2)) - f.pose.lift) * .1
      f.pose.jaw += ((f.sp.group === 'kuwagata' ? .55 : 0) - f.pose.jaw) * .1
    }
    // つかれ: まけている ほうが たくさん つかれる。
    const over = Math.max(0, theirs - mine) / theirs
    f.st -= DT * (.6 + over * 5)
    f.pushed = dir < -1 ? f.pushed + -dir * DT : Math.max(0, f.pushed - DT * 4)
  }
  // えだ: つかれて おされつづけると あしが すべる。
  if (b.stage === 'branch') {
    for (const f of [a, c]) {
      if (f.st / f.maxSt < .3 && f.pushed > 12 && b.random() < DT * .5) {
        slip(b, f)
        return
      }
    }
  }
  // まるた・きりかぶ: おしだし。はしで こらえて いる ほうは「うっちゃり」で ぎゃくてんを ねらう。
  if (b.stage !== 'branch') {
    for (const [f, g, dir] of [[a, c, vel], [c, a, -vel]] as const) {
      const room = edgeRoom(b.stage, f.u, f.v)
      if (room < 16 && !f.warned) { f.warned = true; b.events.push({ type: 'edge', side: f.side }) }
      if (room > 40) f.warned = false
      if (room < 20 && dir < -2 && f.state === 'clash' && b.random() < DT * .4) {
        utchari(b, f, g)
        return
      }
      if (!hasGround(b.stage, f.u, f.v)) {
        pushOut(b, f)
        return
      }
    }
  }
  // わざ。
  for (const f of [a, c]) {
    if (f.state !== 'clash') continue
    f.cd -= DT
    if (f.cd <= 0) {
      set(f, 'windup')
      f.move = f.sp.move.kind
      b.events.push({ type: 'windup', side: f.side, move: f.move })
      break
    }
  }
}

/** うっちゃり: はしで こらえて、おしてくる あいてを うしろへ なげる。からだの 大きさに かんけいなく きまる ことが ある。 */
function utchari(b: Battle, f: Fighter, g: Fighter) {
  b.events.push({ type: 'windup', side: f.side, move: 'utchari' })
  const chance = .16 + f.speed * .02 + .12 * Math.max(0, f.st) / f.maxSt
  if (b.random() > chance) {
    b.events.push({ type: 'block', side: g.side, u: g.u, v: g.v })
    f.st -= 4
    return
  }
  const { nu, nv } = toward(g, f)
  g.st -= 10
  b.events.push({ type: 'hit', side: f.side, move: 'utchari', u: g.u, v: g.v, z: 10, big: true })
  g.vu = nu * 62; g.vv = nv * 62; g.vz = 115
  g.z = 2
  g.pose.spin = 0
  g.pose.flipped = false
  set(g, 'thrown')
  set(f, 'strike')
  f.move = 'utchari'
  f.cd = nextCooldown(b, f)
}

function force(b: Battle, f: Fighter) {
  const fresh = .5 + .5 * Math.max(0, f.st) / f.maxSt
  const room = edgeRoom(b.stage, f.u, f.v)
  const brace = 1 + .45 * Math.max(0, Math.min(1, 1 - room / 34))
  const busy = f.state === 'windup' || f.state === 'strike' ? .85 : 1
  return pushStrength(f) * fresh * (1 + .55 * wobble(f, b.time)) * brace * busy
}

function windup(b: Battle, f: Fighter) {
  const o = other(b, f)
  const length = .5 * (1.3 - f.speed * .045)
  const k = Math.min(1, f.t / length)
  if (f.sp.group === 'kuwagata') { f.pose.jaw = .55 + .45 * k; f.pose.lift = k * .6 }
  else f.pose.lift = .3 + .7 * k
  if (f.t < length) return
  set(f, 'strike')
  if (!canEngage(o) || toward(f, o).d > contactDistance(f, o) + 10) {
    f.cd = nextCooldown(b, f) * .5
    return
  }
  resolveStrike(b, f, o)
}

function resolveStrike(b: Battle, att: Fighter, def: Fighter) {
  const move = att.move === 'utchari' || !att.move ? att.sp.move.kind : att.move
  const dodge = Math.max(0, def.speed - att.speed) * .05
  const roll = b.random()
  att.cd = nextCooldown(b, att)
  if (roll < dodge) {
    b.events.push({ type: 'dodge', side: def.side })
    att.st -= 3
    if (b.stage === 'stump') {
      // よこへ ひらりと まわりこむ。
      const { nu, nv } = toward(att, def)
      const s = b.random() < .5 ? 1 : -1
      def.u += -nv * s * 16; def.v += nu * s * 16
      set(def, 'circle')
    }
    return
  }
  const p = strikeChance(att, def)
  if (b.random() > p) {
    att.st -= 4
    b.events.push({ type: 'block', side: def.side, u: def.u, v: def.v })
    return
  }
  const edge = (att.power * att.form + att.weight * 2.5) - (def.power * def.form * .55 + def.weight * 3)
  const damage = (8 + Math.max(0, edge) * 1 + att.power * .6) * (move === 'pinch' ? 1.15 : move === 'charge' ? .85 : 1) / (.6 + .4 * def.weight)
  def.st -= damage
  const big = damage > 22
  b.events.push({ type: 'hit', side: att.side, move, u: def.u, v: def.v, z: 10, big })
  const { nu, nv } = toward(att, def)
  if (move === 'pinch' && def.st / def.maxSt > .35) {
    // しめつけ: その ばで くるしむ。
    set(def, 'stagger')
    def.vu = nu * 26; def.vv = nv * 26
    return
  }
  if (move === 'charge') {
    set(def, 'stagger')
    const push = 70 + Math.max(0, edge) * 9
    def.vu = nu * push; def.vv = nv * push
    return
  }
  // なげる: ツノで すくう（まえへ）・あごで はさんで よこへ。
  let du = nu, dv = nv
  if (b.stage !== 'branch') {
    const spread = move === 'lift' || move === 'pinch' ? (.25 + b.random() * .45) * (b.random() < .5 ? 1 : -1) : (b.random() - .5) * .3
    const cs = Math.cos(spread), sn = Math.sin(spread)
    du = nu * cs - nv * sn; dv = nu * sn + nv * cs
  }
  // げんきな うちは ちかくに ころがる だけ。つかれて くると とおくへ とぶ。
  const tired = Math.min(1, 1 - Math.max(0, def.st) / def.maxSt)
  // はじまって すぐは まだ ふんばりが きく。
  const early = b.time < 8 ? .7 : 1
  const reachOut = (.5 + .65 * tired) * early
  const out = Math.max(26, Math.min(110, (46 + edge * 5) * reachOut))
  def.vu = du * out; def.vv = dv * out
  def.vz = Math.max(80, Math.min(150, 104 + edge * 4)) * (.8 + .3 * tired)
  def.z = Math.max(def.z, 2)
  def.pose.spin = 0
  def.pose.flipped = false
  set(def, 'thrown')
}

function strike(b: Battle, f: Fighter) {
  const k = f.t / .35
  if (f.sp.group === 'kuwagata') f.pose.jaw = Math.max(0, 1 - k)
  f.pose.lift = Math.max(0, 1 - k * .8)
  if (f.t >= .35) set(f, canEngage(other(b, f)) ? 'clash' : 'approach')
}

function stagger(b: Battle, f: Fighter) {
  f.u += f.vu * DT; f.v += f.vv * DT
  f.vu *= .9; f.vv *= .9
  if (b.stage === 'branch') f.v = 0
  f.pose.leg += DT * 6
  f.pose.lift = 0
  if (!hasGround(b.stage, f.u, f.v)) {
    pushOut(b, f)
    return
  }
  if (f.t > .55) set(f, f.st <= 0 ? 'flee' : 'approach')
}

function thrown(b: Battle, f: Fighter) {
  f.u += f.vu * DT; f.v += f.vv * DT
  f.vz -= GRAVITY * DT
  f.z += f.vz * DT
  f.pose.spin += DT * (f.vu >= 0 ? 1 : -1) * 9
  f.pose.leg += DT * 8
  if (f.z > 0 || f.vz > 0) return
  // ちゃくち。
  if (b.stage === 'branch') {
    const grip = .2 + .5 * Math.max(0, f.st) / f.maxSt + f.speed * .012 + (b.time < 8 ? .25 : 0)
    if (b.random() < grip) {
      f.z = 0; f.vz = 0; f.vu = 0; f.v = 0
      f.pose.spin = 0
      f.pose.hang = true
      f.pose.flipped = true
      set(f, 'cling')
      b.events.push({ type: 'cling', side: f.side })
      return
    }
    fallOff(b, f, 'throw')
    return
  }
  if (!hasGround(b.stage, f.u, f.v)) {
    fallOff(b, f, 'throw')
    return
  }
  f.z = groundHeight(b.stage, f.v); f.vz = 0
  const flipped = b.random() < .55
  f.pose.spin = 0
  f.pose.flipped = flipped
  f.vu *= .3; f.vv *= .3
  b.events.push({ type: 'land', side: f.side, flipped, u: f.u, v: f.v })
  set(f, flipped ? 'flipped' : 'stagger')
}

function flipped(b: Battle, f: Fighter) {
  f.u += f.vu * DT; f.v += f.vv * DT
  f.vu *= .85; f.vv *= .85
  f.pose.leg += DT * 7
  if (!hasGround(b.stage, f.u, f.v)) {
    fallOff(b, f, 'throw')
    return
  }
  const recover = 1.1 + (10 - f.speed) * .14
  if (f.t >= recover) {
    f.pose.flipped = false
    b.events.push({ type: 'recover', side: f.side })
    set(f, f.st <= 0 ? 'flee' : 'approach')
  }
}

function cling(b: Battle, f: Fighter) {
  f.pose.leg += DT * 5
  if (f.t >= 1.5) {
    if (f.st / f.maxSt < .15 && b.random() < .5) {
      f.pose.hang = false
      fallOff(b, f, 'throw')
      return
    }
    f.pose.hang = false
    f.pose.flipped = false
    b.events.push({ type: 'climb', side: f.side })
    set(f, f.st <= 0 ? 'flee' : 'approach')
  }
}

function slip(b: Battle, f: Fighter) {
  b.events.push({ type: 'slip', side: f.side })
  f.vu = 0; f.vz = 20
  fallOff(b, f, 'slip')
}

function pushOut(b: Battle, f: Fighter) {
  const o = other(b, f)
  const { nu, nv } = toward(o, f)
  f.vu = nu * 20; f.vv = nv * 20; f.vz = 10
  fallOff(b, f, 'push')
}

function fallOff(b: Battle, f: Fighter, reason: EndReason) {
  set(f, 'fall')
  f.pose.hang = false
  if (b.loserReason === null && b.state === 'fight') {
    b.loserReason = reason
    b.events.push({ type: 'fall', side: f.side, reason })
  }
}

function fall(b: Battle, f: Fighter) {
  f.u += f.vu * DT; f.v += f.vv * DT
  f.vu *= .99; f.vv *= .99
  f.vz -= GRAVITY * DT
  f.z += f.vz * DT
  f.pose.spin += DT * 6 * (f.vu >= 0 ? 1 : -1)
  f.pose.leg += DT * 8
  const floor = fallFloor(b.stage)
  if (f.z <= floor) {
    f.z = floor
    f.vz = 0; f.vu = 0; f.vv = 0
    f.pose.spin = 0
    f.pose.flipped = true
    set(f, 'out')
  }
}

function flee(b: Battle, f: Fighter) {
  const o = other(b, f)
  const { nu, nv } = toward(o, f)
  let du = nu, dv = nv
  if (b.stage === 'branch') { du = Math.sign(f.u - o.u) || 1; dv = 0 }
  if (b.stage === 'log') { du = Math.sign(f.u - o.u) || 1; dv = 0 }
  turnToward(f, Math.atan2(dv, du), 6)
  const speed = walkSpeed(f) * 1.25
  const facing = Math.cos(f.heading - Math.atan2(dv, du))
  if (facing > .7) {
    f.u += Math.cos(f.heading) * speed * DT
    f.v += Math.sin(f.heading) * speed * DT
  }
  f.pose.leg += DT * 4.5
  f.pose.lift = 0
  if (b.stage === 'branch') {
    if (Math.abs(f.u - o.u) > BRANCH_RUN_OFF) set(f, 'out')
    return
  }
  if (!hasGround(b.stage, f.u, f.v)) {
    f.vu = Math.cos(f.heading) * 20; f.vv = Math.sin(f.heading) * 20; f.vz = 0
    set(f, 'fall')
  }
}

function win(b: Battle, f: Fighter) {
  f.pose.lift = .5 + .5 * Math.sin(f.t * 6)
  f.pose.jaw = f.sp.group === 'kuwagata' ? .5 + .5 * Math.sin(f.t * 6) : 0
  f.pose.leg += DT * 1.5
  void b
}

// ---------------- ぜんたい ----------------

function finish(b: Battle, winner: 0 | 1, reason: EndReason) {
  b.state = 'over'
  b.stateT = 0
  b.winner = winner
  b.reason = reason
  const w = b.f[winner]
  w.pose.flipped = false
  w.pose.hang = false
  if (w.state !== 'out' && w.state !== 'fall') set(w, 'win')
  b.events.push({ type: 'end', winner, reason })
}

export function stepBattle(b: Battle) {
  b.stateT += DT
  const [a, c] = b.f
  if (b.state === 'ready') {
    for (const f of b.f) f.pose.lift = Math.max(0, Math.sin(b.stateT * 3 + f.side) * .4)
    if (b.stateT >= READY_SECONDS) {
      b.state = 'fight'
      b.stateT = 0
      for (const f of b.f) set(f, 'approach')
      // きりかぶでは まず にらみあいながら まわる。
      if (b.stage === 'stump') {
        const orbit = b.random() < .5 ? 1 : -1
        for (const f of b.f) { set(f, 'circle'); f.orbit = orbit }
      }
      b.events.push({ type: 'go' })
    }
    return
  }
  if (b.state === 'fight') b.time += DT
  for (const f of b.f) f.t += DT

  if (b.state === 'fight' && (a.state === 'clash' || a.state === 'windup' || a.state === 'strike') && (c.state === 'clash' || c.state === 'windup' || c.state === 'strike')) {
    clash(b, a, c)
  }
  for (const f of b.f) {
    switch (f.state) {
      case 'approach': approach(b, f); break
      case 'circle': circle(b, f); break
      case 'windup': windup(b, f); break
      case 'strike': strike(b, f); break
      case 'stagger': stagger(b, f); break
      case 'thrown': thrown(b, f); break
      case 'flipped': flipped(b, f); break
      case 'cling': cling(b, f); break
      case 'fall': fall(b, f); break
      case 'flee': flee(b, f); break
      case 'win': win(b, f); break
      case 'clash':
        // あいてが はなれたら また ちかづく。
        if (!canEngage(other(b, f))) set(f, 'approach')
        break
    }
  }
  // ぶつからない ように（くみあって いない とき）。
  if (!busyWithBody(a) && !busyWithBody(c) && a.state !== 'clash' && c.state !== 'clash' && a.z <= 0 && c.z <= 0) {
    const { d, nu, nv } = toward(a, c)
    const min = (a.front + c.front) * .4
    if (d < min) {
      const push = (min - d) / 2
      a.u -= nu * push; a.v -= nv * push
      c.u += nu * push; c.v += nv * push
    }
  }
  for (const f of b.f) {
    if (f.state !== 'thrown' && f.state !== 'fall' && f.state !== 'out') f.z = groundHeight(b.stage, f.v)
  }

  if (b.state === 'over') {
    // しょうぶの あと: かった ほうは よろこぶ。
    const w = b.f[b.winner ?? 0]
    if (w.state === 'approach' || w.state === 'circle' || w.state === 'clash' || w.state === 'windup' || w.state === 'strike') set(w, 'win')
    return
  }
  if (b.state !== 'fight') return
  // つかれきったら にげだす。
  for (const f of b.f) {
    if (f.st <= 0 && (f.state === 'clash' || f.state === 'approach' || f.state === 'circle')) {
      f.st = 0
      set(f, 'flee')
    }
  }
  // しょうぶが ついたか。
  for (const f of b.f) {
    const winner = (1 - f.side) as 0 | 1
    if (f.state === 'flee') {
      b.loserReason = 'flee'
      b.events.push({ type: 'flee', side: f.side })
      finish(b, winner, 'flee')
      return
    }
    if ((f.state === 'fall' || f.state === 'out') && b.loserReason !== null) {
      finish(b, winner, b.loserReason)
      return
    }
  }
  if (b.time >= TIME_LIMIT) {
    b.events.push({ type: 'timeup' })
    const ra = a.st / a.maxSt, rc = c.st / c.maxSt
    const winner: 0 | 1 = ra === rc ? (a.mass >= c.mass ? 0 : 1) : ra > rc ? 0 : 1
    const loser = b.f[1 - winner]
    if (!busyWithBody(loser)) set(loser, 'flee')
    finish(b, winner, 'judge')
  }
}

/** さいごまで すすめる（テスト・ためし用）。 */
export function runToEnd(b: Battle, maxSeconds = TIME_LIMIT + READY_SECONDS + 5) {
  const steps = Math.ceil(maxSeconds / DT)
  for (let i = 0; i < steps && b.state !== 'over'; i++) stepBattle(b)
  return b
}
