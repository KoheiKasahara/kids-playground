// たいかいの たたかい。2ひきが よこ1れつに ならび、やるき（ガッツ）が たまったら わざを だす。
// ちかい わざは くっついて、とおい わざは はなれて つかう。わざを えらぶと じぶんで ちょうど よい
// きょりまで あるいて いく。しばらく なにも えらばないと モンスターが じぶんで かんがえて うごく。
// 1/60びょうずつ すすめる 純粋な しくみで、画面・音とは events で つながる。

import { speciesById, SPECIES, type Monster, type Species, type Tech } from './monsters'
import { rng } from './pixel'

export const DT = 1 / 60
export const ARENA_W = 168
/** この きょり いかなら ちかい わざが とどく。 */
export const NEAR = 38
/** この きょり いじょうで とおい わざを だせる。 */
export const FAR = 58
const MIN_GAP = 26
const EDGE = 14
export const BATTLE_SECONDS = 30
export const READY_SECONDS = 1.6
/** なにも えらばないと じぶんで うごくまでの じかん。 */
export const AUTO_AFTER = 2
const GUTS_SPEED = 1.5
const GUTS_MAX = 99
const SHOT_SPEED = 170

export type Phase = 'idle' | 'windup' | 'lunge' | 'recover'

export type Fighter = {
  side: 0 | 1
  monster: Monster
  species: Species
  maxHp: number
  hp: number
  guts: number
  x: number
  plan: Tech | null
  /** とびかかって いる わざ。 */
  lunge: Tech | null
  phase: Phase
  t: number
  /** AI が つぎに かんがえるまで。 */
  think: number
  /** ダメージの ちかちか・よけの ジャンプ（のこり じかん）。 */
  hurt: number
  dodge: number
  /** かべに おしつけられて いる じかん。 */
  stuck: number
  /** あるいて いる（絵の ため）。 */
  walking: boolean
}

export type Shot = { side: 0 | 1; tech: Tech; x: number; to: number; hit: boolean; damage: number; crit: boolean; t: number; missed: boolean }

export type BattleEvent =
  | { type: 'go' }
  | { type: 'windup'; side: 0 | 1; tech: Tech }
  | { type: 'shot'; side: 0 | 1; tech: Tech }
  | { type: 'hit'; side: 0 | 1; tech: Tech; damage: number; crit: boolean; x: number }
  | { type: 'miss'; side: 0 | 1; tech: Tech; x: number }
  | { type: 'auto' }
  | { type: 'ko'; side: 0 | 1 }
  | { type: 'timeup' }

export type Battle = {
  f: [Fighter, Fighter]
  shots: Shot[]
  /** たたかいが はじまってからの じかん（よーいの あいだは 0）。 */
  time: number
  state: 'ready' | 'fight' | 'over'
  stateT: number
  winner: 0 | 1 | null
  events: BattleEvent[]
  random: () => number
  /** プレイヤーが なにも えらんで いない じかん。 */
  idle: number
  /** おまかせ（ぜんぶ じぶんで うごく）。 */
  auto: boolean
  /** あいての かんがえる はやさ（びょう）。 */
  foeThink: number
}

export function maxHpOf(monster: Monster) {
  return Math.round((monster.stats.life + 30) * .85)
}

function fighter(monster: Monster, side: 0 | 1): Fighter {
  const species = speciesById(monster.species) ?? SPECIES[0]
  const maxHp = maxHpOf(monster)
  return {
    side, monster, species, maxHp, hp: maxHp, guts: 40, x: side === 0 ? ARENA_W / 2 - 40 : ARENA_W / 2 + 40,
    plan: null, lunge: null, phase: 'idle', t: 0, think: .8, hurt: 0, dodge: 0, stuck: 0, walking: false,
  }
}

export function createBattle(player: Monster, foe: Monster, seed: number, foeThink = 1): Battle {
  return {
    f: [fighter(player, 0), fighter(foe, 1)],
    shots: [], time: 0, state: 'ready', stateT: 0, winner: null, events: [],
    random: rng(seed), idle: 0, auto: false, foeThink,
  }
}

export function distance(b: Battle) {
  return Math.abs(b.f[1].x - b.f[0].x)
}

/** いま この わざが きょりの うえで つかえるか。 */
export function inRange(b: Battle, side: 0 | 1, tech: Tech) {
  const d = distance(b)
  if (tech.range === 'near') return d <= NEAR
  return d >= FAR || (b.f[side].stuck > .5 && d > MIN_GAP + 4)
}

/** プレイヤーが わざを えらんだ。 */
export function command(b: Battle, index: number) {
  const me = b.f[0]
  const tech = me.species.techs[index]
  if (!tech || b.state === 'over') return
  me.plan = tech
  b.idle = 0
}

export function setAuto(b: Battle, on: boolean) {
  b.auto = on
  b.idle = 0
}

export function drainBattleEvents(b: Battle) {
  const list = b.events
  b.events = []
  return list
}

/** あいての ステータスに あわせて わざを えらぶ（AI と おまかせ）。 */
function choose(b: Battle, me: Fighter): Tech {
  const techs = me.species.techs
  const stats = me.monster.stats
  const weights = techs.map(t => {
    const base = (stats[t.stat] + 20) * (t.big ? (me.guts >= t.guts ? 1.1 : .25) : 1)
    // いまの きょりで すぐ だせる わざを すこし えらびやすく する。
    return base * (inRange(b, me.side, t) ? 1.4 : 1) * (.6 + b.random() * .8)
  })
  let best = 0
  for (let i = 1; i < weights.length; i++) if (weights[i] > weights[best]) best = i
  return techs[best]
}

function speedOf(f: Fighter) {
  return Math.min(80, 34 + f.monster.stats.spd * .06)
}

function moveToward(b: Battle, me: Fighter, want: 'closer' | 'farther' | 'middle') {
  const foe = b.f[1 - me.side]
  const dir = Math.sign(foe.x - me.x) || (me.side === 0 ? 1 : -1)
  const d = distance(b)
  let step = 0
  if (want === 'closer') step = dir
  else if (want === 'farther') step = -dir
  else if (d > (NEAR + FAR) / 2 + 8) step = dir
  else if (d < (NEAR + FAR) / 2 - 8) step = -dir
  if (!step) { me.walking = false; return }
  const v = speedOf(me) * DT * (want === 'middle' ? .5 : 1)
  const nx = Math.max(EDGE, Math.min(ARENA_W - EDGE, me.x + step * v))
  // あいてに めりこまない。
  const gap = Math.abs(foe.x - nx)
  if (gap < MIN_GAP && Math.sign(foe.x - nx) === dir) { me.walking = false; return }
  me.stuck = nx === me.x && want === 'farther' ? me.stuck + DT : 0
  me.walking = nx !== me.x
  me.x = nx
}

function damageOf(b: Battle, me: Fighter, foe: Fighter, tech: Tech) {
  const atk = me.monster.stats[tech.stat]
  const def = foe.monster.stats.def
  const level = (atk + def) / 2 + 30
  const base = tech.power * Math.pow((atk + 15) / (def + 15), 1.2) * level / 100
  return Math.max(1, Math.round(base * (.9 + b.random() * .2)))
}

function hitChance(me: Fighter, foe: Fighter, tech: Tech) {
  const edge = (me.monster.stats.spd - foe.monster.stats.spd) / 260
  return Math.max(.4, Math.min(.97, .82 + tech.hit + edge + (me.monster.bond - 50) / 1000))
}

function land(b: Battle, me: Fighter, foe: Fighter, tech: Tech, hit: boolean, damage: number, crit: boolean) {
  if (!hit) {
    foe.dodge = .35
    b.events.push({ type: 'miss', side: me.side, tech, x: foe.x })
    return
  }
  foe.hp = Math.max(0, foe.hp - damage)
  foe.hurt = .35
  foe.guts = Math.max(0, foe.guts - (tech.big ? 10 : 4))
  const away = Math.sign(foe.x - me.x) || (foe.side === 1 ? 1 : -1)
  foe.x = Math.max(EDGE, Math.min(ARENA_W - EDGE, foe.x + away * (tech.big ? 14 : tech.range === 'near' ? 9 : 5)))
  b.events.push({ type: 'hit', side: me.side, tech, damage, crit, x: foe.x })
  if (foe.hp <= 0 && b.state === 'fight') {
    b.state = 'over'
    b.stateT = 0
    b.winner = me.side
    b.events.push({ type: 'ko', side: foe.side })
  }
}

function strike(b: Battle, me: Fighter, tech: Tech) {
  const foe = b.f[1 - me.side]
  const hit = b.random() < hitChance(me, foe, tech)
  const crit = hit && b.random() < .04 + me.monster.bond / 1500
  const damage = hit ? Math.round(damageOf(b, me, foe, tech) * (crit ? 1.5 : 1)) : 0
  if (tech.range === 'far') {
    b.shots.push({ side: me.side, tech, x: me.x, to: foe.x, hit, damage, crit, t: 0, missed: false })
    b.events.push({ type: 'shot', side: me.side, tech })
  } else land(b, me, foe, tech, hit, damage, crit)
}

function stepFighter(b: Battle, me: Fighter) {
  me.hurt = Math.max(0, me.hurt - DT)
  me.dodge = Math.max(0, me.dodge - DT)
  const foe = b.f[1 - me.side]
  // すばやい ほうが やるきも はやく たまる。
  const quick = 1 + (me.monster.stats.spd - foe.monster.stats.spd) / (me.monster.stats.spd + foe.monster.stats.spd + 60) * .6
  me.guts = Math.min(GUTS_MAX, me.guts + me.species.gutsRate * GUTS_SPEED * quick * DT)
  me.t += DT
  if (me.phase === 'windup') {
    me.walking = false
    if (me.t >= .3 && me.plan) {
      const tech = me.plan
      me.plan = null
      me.t = 0
      if (tech.range === 'near') { me.phase = 'lunge'; me.lunge = tech } else { strike(b, me, tech); me.phase = 'recover' }
    }
    return
  }
  if (me.phase === 'lunge') {
    const dir = Math.sign(foe.x - me.x) || 1
    if (Math.abs(foe.x - me.x) > MIN_GAP - 4) me.x += dir * 220 * DT
    if (me.t >= .12 || Math.abs(foe.x - me.x) <= MIN_GAP - 4) {
      if (me.lunge) strike(b, me, me.lunge)
      me.lunge = null
      me.phase = 'recover'
      me.t = 0
    }
    return
  }
  if (me.phase === 'recover') {
    if (me.t >= .38) { me.phase = 'idle'; me.t = 0 }
    return
  }
  // idle: わざの じゅんび（あるく・ためる）か、かんがえる。
  if (me.hurt > .2) return
  const thinker = me.side === 1 || b.auto
  if (!me.plan) {
    if (thinker) {
      me.think -= DT
      if (me.think <= 0) {
        me.plan = choose(b, me)
        me.think = me.side === 1 ? b.foeThink * (.5 + b.random()) : .3 + b.random() * .5
      }
    } else {
      b.idle += DT
      if (b.idle >= AUTO_AFTER) {
        me.plan = choose(b, me)
        b.idle = 0
        b.events.push({ type: 'auto' })
      }
    }
  }
  const plan = me.plan
  if (!plan) { moveToward(b, me, 'middle'); return }
  if (!inRange(b, me.side, plan)) { moveToward(b, me, plan.range === 'near' ? 'closer' : 'farther'); return }
  me.walking = false
  if (me.guts >= plan.guts) {
    me.guts -= plan.guts
    me.phase = 'windup'
    me.t = 0
    b.events.push({ type: 'windup', side: me.side, tech: plan })
  }
}

function stepShots(b: Battle) {
  for (const s of b.shots) {
    const dir = Math.sign(s.to - s.x) || 1
    s.t += DT
    s.x += dir * SHOT_SPEED * DT
    const target = b.f[1 - s.side]
    if (!s.hit) continue
    if ((dir > 0 && s.x >= target.x - 6) || (dir < 0 && s.x <= target.x + 6)) {
      s.t = -1
      land(b, b.f[s.side], target, s.tech, true, s.damage, s.crit)
    }
  }
  // はずれた たまは そのまま とんで いって きえる。
  for (const s of b.shots) {
    if (!s.hit && s.t >= 0) {
      const target = b.f[1 - s.side]
      const passed = (s.to > b.f[s.side].x ? s.x >= target.x : s.x <= target.x)
      if (passed && !s.missed) {
        s.missed = true
        target.dodge = .35
        b.events.push({ type: 'miss', side: s.side, tech: s.tech, x: target.x })
      }
      if (s.x < -20 || s.x > ARENA_W + 20) s.t = -1
    }
  }
  b.shots = b.shots.filter(s => s.t >= 0)
}

/** 1/60びょう すすめる。 */
export function stepBattle(b: Battle) {
  b.stateT += DT
  if (b.state === 'ready') {
    if (b.stateT >= READY_SECONDS) {
      b.state = 'fight'
      b.stateT = 0
      b.events.push({ type: 'go' })
    }
    return
  }
  if (b.state === 'over') {
    for (const f of b.f) { f.hurt = Math.max(0, f.hurt - DT); f.dodge = Math.max(0, f.dodge - DT); f.walking = false }
    stepShots(b)
    return
  }
  b.time += DT
  stepFighter(b, b.f[0])
  stepFighter(b, b.f[1])
  stepShots(b)
  if (b.state === 'fight' && b.time >= BATTLE_SECONDS) {
    b.state = 'over'
    b.stateT = 0
    const [me, foe] = b.f
    // じかんぎれは のこりの たいりょくの わりあいで きめる（おなじなら プレイヤーの かち）。
    b.winner = me.hp / me.maxHp >= foe.hp / foe.maxHp ? 0 : 1
    b.events.push({ type: 'timeup' })
  }
}

/** さいごまで じどうで たたかわせる（テスト・おてほん）。 */
export function simulate(b: Battle, auto = true) {
  b.auto = auto
  for (let i = 0; i < 60 * (READY_SECONDS + BATTLE_SECONDS + 1) && b.state !== 'over'; i++) stepBattle(b)
  return b.winner
}
