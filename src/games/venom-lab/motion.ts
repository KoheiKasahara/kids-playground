// いきもの ごとの うごきかた（あるく・はねる・およぐ・とぶ・じっと する）と、とくいわざ。
// かんさつエリアでは 1ぴきずつ ちいさな「きもち」を もって、やすむ → うごく → わざ を くりかえす。
// すすんだ きょりで あしの コマを すすめるので、あしが すべって みえない。

import type { Species, SpriteKind } from './data'
import type { ClipName } from './pose'
import { snakePosture } from './snakes'

export type Gait = 'walk' | 'slither' | 'hop' | 'swim' | 'fly' | 'sit'

export type Profile = {
  gait: Gait
  /** すすむ はやさ（ドット / びょう）。 */
  speed: number
  /** move の 1ループで すすむ きょり（ドット）。0 なら じかんで まわす。 */
  stride: number
  /** うろうろ する はんい（ドット）。 */
  range: number
  frames: Record<ClipName, number>
  fps: Record<ClipName, number>
  /** かげの はば（ドット）。 */
  shadow: number
  /** とぶ たかさ（ドット）。 */
  hover?: number
}

/** いきもの ごとの とくいわざ（なまえと せつめい）。 */
export const SIGNATURE_MOVES: Record<string, string> = {
  'blue-ring': 'あおい輪を ピカッと ひからせる',
  stonefish: 'いっしゅんで えものを すいこむ',
  lionfish: 'ひれを おおきく ひろげる',
  'golden-frog': 'したを のばして アリを つかまえる',
  'blue-frog': 'ゆびさきを とんとん ふるわせる',
  'strawberry-frog': 'のどを ふくらませて なく',
  rattlesnake: 'しっぽを ふるわせて ガラガラ ならす',
  'bark-scorpion': 'しっぽの はりで すばやく つく',
  gila: 'したを だして においを さぐる',
  'sea-krait': 'ひらたい しっぽで すいすい ダッシュ',
  'geography-cone': 'どくの はりを のばす',
  'crown-of-thorns': 'うでの さきを もちあげる',
  'long-spined-urchin': 'とげを あいてへ むける',
  'eyelash-viper': 'しっぽで えだに つかまって ぶらさがる',
  bushmaster: 'しっぽを ふるわせて おちばを ならす',
  'wandering-spider': 'まえあしを あげて おどかす',
  'mojave-rattlesnake': 'S字から すばやく とびかかる',
  deathstalker: 'はさみを カチカチ ならす',
  'hairy-scorpion': 'すなを ほって かくれがを つくる',
  mamushi: 'くびを S字に して かまえる',
  'tiger-keelback': 'くびを ひらたく して みせる',
  'japanese-toad': 'からだを ふくらませて おおきく みせる',
  'fire-bellied-newt': 'あかい おなかを みせる',
  'giant-hornet': 'あごを カチカチ ならして けいかい',
  'red-headed-centipede': 'からだを おこして どくの つめを みせる',
  habu: 'くびを たかく のばして みまわす',
  'hime-habu': 'くちを おおきく あけて あくび',
  'sakishima-habu': 'したで においを さぐる',
  'inland-taipan': 'きせつで からだの いろが こく なる',
  'eastern-brown': 'S字に たちあがって おどかす',
  'death-adder': 'しっぽの さきを むしの ように うごかす',
  redback: 'いとを つたって のぼる',
  'black-mamba': 'くろい くちの なかを みせる',
  'puff-adder': 'からだを ふくらませて シューッ',
  boomslang: 'のどを ふくらませる',
  'spitting-cobra': 'どくを とばす',
  'king-cobra': 'たかく たちあがって ゆれる',
  'monocled-cobra': 'フードを ひろげて まるい もようを みせる',
  'banded-krait': 'からだを まるめて あたまを かくす',
  'mangrove-viper': 'えだから とびかかる',
}

const STD = { frames: { idle: 24, move: 20, act: 32 }, fps: { idle: 12, move: 16, act: 16 } }

function base(kind: SpriteKind): Omit<Profile, 'frames' | 'fps'> & Partial<Pick<Profile, 'frames' | 'fps'>> {
  switch (kind) {
    case 'octopus': return { gait: 'walk', speed: 5, stride: 12, range: 14, shadow: 40 }
    case 'stonefish': return { gait: 'sit', speed: 0, stride: 0, range: 0, shadow: 52 }
    case 'lionfish': return { gait: 'swim', speed: 5, stride: 0, range: 18, shadow: 0, hover: 0, fps: { idle: 10, move: 12, act: 16 } }
    case 'frog': return { gait: 'hop', speed: 0, stride: 10, range: 16, shadow: 36, frames: { idle: 24, move: 20, act: 32 }, fps: { idle: 12, move: 30, act: 16 } }
    case 'toad': return { gait: 'walk', speed: 4, stride: 9, range: 12, shadow: 40 }
    case 'newt': return { gait: 'walk', speed: 6, stride: 10, range: 14, shadow: 46 }
    case 'spider': return { gait: 'walk', speed: 11, stride: 7, range: 16, shadow: 44 }
    case 'hornet': return { gait: 'fly', speed: 14, stride: 0, range: 18, shadow: 20, hover: 9, frames: { idle: 16, move: 16, act: 24 }, fps: { idle: 24, move: 24, act: 12 } }
    case 'centipede': return { gait: 'walk', speed: 9, stride: 9, range: 16, shadow: 50 }
    case 'scorpion': return { gait: 'walk', speed: 8, stride: 8, range: 16, shadow: 44 }
    case 'lizard': return { gait: 'walk', speed: 5, stride: 11, range: 14, shadow: 50 }
    case 'cone': return { gait: 'walk', speed: 1.6, stride: 5, range: 6, shadow: 46, fps: { idle: 10, move: 10, act: 16 } }
    case 'starfish': return { gait: 'walk', speed: 1.4, stride: 5, range: 6, shadow: 50, fps: { idle: 8, move: 10, act: 16 } }
    case 'urchin': return { gait: 'sit', speed: 0, stride: 0, range: 0, shadow: 30, fps: { idle: 8, move: 8, act: 16 } }
    case 'sea-snake': return { gait: 'swim', speed: 7, stride: 0, range: 16, shadow: 0, fps: { idle: 12, move: 16, act: 16 } }
    default: return { gait: 'slither', speed: 7, stride: 18, range: 16, shadow: 48 }
  }
}

export function profileOf(sp: Species): Profile {
  const b = base(sp.sprite)
  const posture = snakePosture(sp.id)
  const sit = posture && posture !== 'crawl' && posture !== 'swim'
  const p: Profile = { ...STD, ...b, frames: { ...STD.frames, ...b.frames }, fps: { ...STD.fps, ...b.fps } }
  if (sit) return { ...p, gait: 'sit', speed: 0, range: 0, shadow: posture === 'branch' ? 0 : 40 }
  return p
}

// ---------------- うごきの きもち ----------------

export type Actor = {
  /** うまれた ばしょ からの ずれ（ドット）。 */
  x: number
  /** うき あがり（ドット、うえが +）。 */
  y: number
  /** 1 は ひだりむき（もとの 絵）、-1 は みぎむき。 */
  facing: 1 | -1
  mode: ClipName
  /** いまの うごきに なってからの じかん（びょう）。 */
  time: number
  /** あしの ループの すすみ（0〜1）。 */
  phase: number
  target: number
  wait: number
  /** つぎの わざまでに やすむ かいすう。 */
  calm: number
  /** うまれてからの じかん（ふわふわ うく ゆれに つかう）。 */
  clock: number
  /** いまの ジャンプで とぶ きょり。 */
  leap: number
  rand: () => number
}

export function createActor(seed: number): Actor {
  let s = (seed * 2654435761) >>> 0 || 1
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return { x: 0, y: 0, facing: 1, mode: 'idle', time: rand() * 2, phase: rand(), target: 0, wait: 1 + rand() * 3, calm: 1 + Math.floor(rand() * 3), clock: rand() * 10, leap: 0, rand }
}

/** わざの ながさ（びょう）。 */
export const actSeconds = (p: Profile) => p.frames.act / p.fps.act

const HOP_SECONDS = .62
const HOP_HEIGHT = 7

/** タップされたら すぐに とくいわざ。 */
export function triggerAct(a: Actor) {
  a.mode = 'act'
  a.time = 0
}

function rest(a: Actor, p: Profile) {
  a.mode = 'idle'
  a.time = 0
  a.wait = 1.4 + a.rand() * (p.gait === 'sit' ? 4 : 3)
}

export function stepActor(a: Actor, p: Profile, dt: number) {
  dt = Math.min(dt, .1)
  a.time += dt
  a.clock += dt
  if (p.gait === 'fly') a.y = (p.hover ?? 0) + Math.sin(a.clock * 2.6) * 1.6
  else if (p.gait === 'swim') a.y = Math.sin(a.clock * 1.3) * 1.2
  else if (a.mode !== 'move') a.y = 0
  if (a.mode === 'act') {
    if (a.time >= actSeconds(p)) rest(a, p)
    return
  }
  if (a.mode === 'idle') {
    if (p.gait === 'swim' || p.gait === 'fly') a.phase = (a.phase + dt * .25) % 1
    a.wait -= dt
    if (a.wait > 0) return
    if (--a.calm <= 0) {
      a.calm = 2 + Math.floor(a.rand() * 3)
      triggerAct(a)
      return
    }
    if (p.gait === 'sit' || p.range <= 0) { rest(a, p); return }
    // あたらしい いきさき（すこし はなれた ところ）。
    let target = (a.rand() * 2 - 1) * p.range
    if (Math.abs(target - a.x) < p.range * .4) target = a.x > 0 ? -p.range * (.4 + a.rand() * .6) : p.range * (.4 + a.rand() * .6)
    a.target = target
    a.facing = target < a.x ? 1 : -1
    a.mode = 'move'
    a.time = 0
    if (p.gait === 'hop') { a.phase = 0; a.leap = 0 }
    return
  }
  // move
  const dir = Math.sign(a.target - a.x)
  if (p.gait === 'hop') {
    const k = a.time / HOP_SECONDS
    if (k < 0) return
    if (a.phase === 0 && a.leap === 0) a.leap = Math.min(p.stride, Math.abs(a.target - a.x))
    if (k >= 1) {
      a.x += dir * a.leap * (1 - a.phase)
      a.phase = 0
      a.leap = 0
      a.y = 0
      if (Math.abs(a.target - a.x) < 1) rest(a, p)
      else a.time = -.18 // つぎの ジャンプまで ひとやすみ。
      return
    }
    // ふみきり（.2）から ちゃくち（.82）までの あいだに すすむ。
    const air = Math.min(1, Math.max(0, (k - .2) / .62))
    a.x += dir * a.leap * (air - a.phase)
    a.phase = air
    a.y = Math.sin(air * Math.PI) * HOP_HEIGHT
    return
  }
  const step = Math.min(Math.abs(a.target - a.x), p.speed * dt)
  a.x += dir * step
  a.phase = p.stride > 0 ? (a.phase + step / p.stride) % 1 : (a.phase + dt * .6) % 1
  if (Math.abs(a.target - a.x) < .01) rest(a, p)
}

/** いまの コマ。 */
export function frameAt(a: Actor, p: Profile): { clip: ClipName; index: number; count: number } {
  if (a.mode === 'act') {
    const count = p.frames.act
    return { clip: 'act', index: Math.min(count - 1, Math.floor((a.time / actSeconds(p)) * count)), count }
  }
  if (a.mode === 'move') {
    const count = p.frames.move
    if (p.gait === 'hop') return { clip: 'move', index: Math.min(count - 1, Math.max(0, Math.floor((a.time / HOP_SECONDS) * count))), count }
    if (p.gait === 'swim' || p.gait === 'fly') return { clip: 'move', index: Math.floor(a.time * p.fps.move) % count, count }
    return { clip: 'move', index: Math.floor(a.phase * count) % count, count }
  }
  const count = p.frames.idle
  return { clip: 'idle', index: Math.floor(a.time * p.fps.idle) % count, count }
}
