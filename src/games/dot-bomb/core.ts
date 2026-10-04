// せかいの きほん（かたち・ていすう・ボンの ばくはつ・ダメージ）。
// 画面や 音には さわらず、おきた ことは events に つんで 画面がわへ わたす。

import type { BossKind, EnemyKind, RideColor, StageDef } from './stages'

export const TILE = 16
/** 「よーい」から はじまるまで。 */
export const READY_FRAMES = 110
/** ボンが ばくはつするまで。 */
export const FUSE = 150
/** ひが のこる じかん。 */
export const FIRE_FRAMES = 34
/** ひの おわりぎわは あたっても へいき（ちいさな こに やさしく）。 */
export const FIRE_SAFE = 8
/** ひが となりの ボンに うつるまで（れんさが きもちよく みえる）。 */
export const CHAIN_DELAY = 5
export const BURN_FRAMES = 24
export const MAX_BOMBS = 8
export const MAX_FIRE = 8
export const MAX_SPEED = 4
export const MAX_HEARTS = 5
export const START_HEARTS = 3

export type Dir = 0 | 1 | 2 | 3
export const DX = [0, 1, 0, -1] as const
export const DY = [-1, 0, 1, 0] as const
export const DIRS: readonly Dir[] = [0, 1, 2, 3]
export const reverse = (d: Dir) => ((d + 2) % 4) as Dir

// マスの しゅるい
export const T_FLOOR = 0
export const T_WALL = 1
export const T_HARD = 2
export const T_SOFT = 3
export const T_WATER = 4

// ゆかの しかけ
export const F_PLAIN = 0
export const F_ICE = 1
/** 2〜5 は ベルトコンベア（2 + むき）。 */
export const F_BELT = 2
export const F_WARP = 6
export const F_VENT = 7
export const F_DOOR = 8

export const isBelt = (f: number) => f >= F_BELT && f < F_BELT + 4
export const beltDir = (f: number) => (f - F_BELT) as Dir

export type ItemKind = 'bomb' | 'fire' | 'speed' | 'heart' | 'egg' | 'star' | 'gold'

export type Act =
  | { kind: 'hatch'; t: number; color: RideColor }
  | { kind: 'dash'; t: number; dir: Dir }
  | { kind: 'jump'; t: number; dur: number; fx: number; fy: number; tx: number; ty: number }
  | { kind: 'hop'; t: number; dur: number }

export type Hero = {
  x: number; y: number; z: number
  dir: Dir
  moving: boolean
  /** あるいた きょり（あしの うごきに つかう）。 */
  walk: number
  speedLv: number
  bombs: number
  fire: number
  hearts: number
  /** ダメージの あとの むてき。 */
  inv: number
  ride: RideColor | null
  act: Act | null
  cool: number
  /** こおりの うえで すべる のこり。 */
  slide: number
  slideDir: Dir
  warpLock: number
  /** ボンを おいた ポーズの のこり。 */
  placePose: number
}

export type Bomb = {
  id: number
  tx: number; ty: number
  /** すべっている ときの すすんだ ぶん（0〜16）。 */
  off: number
  slide: Dir | null
  speed: number
  /** ベルトで はこばれている。 */
  belt: boolean
  kicked: boolean
  fuse: number
  range: number
  owner: 'hero' | 'boss'
  /** ひが うつって ばくはつするまで（-1 は まだ）。 */
  chain: number
  age: number
}

export type Blast = { tx: number; ty: number; arms: [number, number, number, number]; t: number; power: number }

export type Item = { id: number; tx: number; ty: number; kind: ItemKind; color?: RideColor; age: number }

export type Behave = 'wander' | 'straight' | 'chase' | 'ghost'

export type Enemy = {
  id: number
  kind: EnemyKind
  x: number; y: number
  /** いま いる マスと、むかっている マス。 */
  fx: number; fy: number
  tx: number; ty: number
  dir: Dir
  hp: number
  inv: number
  speed: number
  behave: Behave
  flying: boolean
  /** たおれた あとの えんしゅつ（0 は げんき）。 */
  dead: number
  wait: number
  stun: number
  age: number
}

export type Boss = {
  kind: BossKind
  x: number; y: number; z: number
  vx: number; vy: number
  hp: number; maxHp: number
  inv: number
  state: string
  t: number
  /** よこの むき（-1 ひだり / 1 みぎ）。 */
  face: number
  count: number
  phase: number
  /** ジャンプ などの いきさき。 */
  gx: number; gy: number
  /** どこを ねらうか みせる しるし。 */
  mark: { x: number; y: number; r: number } | null
  dead: number
  /** もぐっている（あたらない・さわれない）。 */
  hidden: boolean
}

export type Shot = {
  id: number
  kind: 'sand' | 'snow' | 'fireball' | 'bolt'
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  life: number
  /** おちた ところで ばくはつ する（ほのおの たま）。 */
  gx?: number; gy?: number
}

export type Runaway = { x: number; y: number; vx: number; vy: number; t: number; color: RideColor }

export type WorldEvent =
  | { type: 'go' }
  | { type: 'place'; x: number; y: number }
  | { type: 'boom'; x: number; y: number; power: number; owner: FireOwner }
  | { type: 'break'; x: number; y: number }
  | { type: 'reveal'; x: number; y: number; kind: ItemKind }
  | { type: 'item'; x: number; y: number; kind: ItemKind }
  | { type: 'hatch'; x: number; y: number; color: RideColor }
  | { type: 'ride'; x: number; y: number; color: RideColor }
  | { type: 'dismount'; x: number; y: number; color: RideColor }
  | { type: 'skill'; x: number; y: number; skill: 'dash' | 'kick' | 'jump' | 'line' }
  | { type: 'land'; x: number; y: number }
  | { type: 'bump'; x: number; y: number }
  | { type: 'enemyHit'; x: number; y: number; kind: EnemyKind; dead: boolean }
  | { type: 'hurt'; x: number; y: number; hearts: number }
  | { type: 'heal'; x: number; y: number }
  | { type: 'doorOpen'; x: number; y: number }
  | { type: 'warp'; x: number; y: number; tx: number; ty: number }
  | { type: 'ventWarn'; x: number; y: number }
  | { type: 'bossHit'; x: number; y: number; hp: number }
  | { type: 'bossAct'; x: number; y: number; act: 'land' | 'roar' | 'shoot' | 'dive' | 'emerge' | 'charge' | 'bonk' | 'breath' | 'spawn' | 'break' }
  | { type: 'bossDown'; x: number; y: number }
  | { type: 'bossPop'; x: number; y: number }
  | { type: 'clear'; x: number; y: number }
  | { type: 'done' }
  | { type: 'miss'; x: number; y: number }
  | { type: 'missDone' }

export type WorldState = 'ready' | 'play' | 'clear' | 'miss'

export type Vent = { tx: number; ty: number; period: number; phase: number; range: number }

export type World = {
  stage: StageDef
  cols: number
  rows: number
  tiles: Uint8Array
  floor: Uint8Array
  /** ブロックの なかに かくれている もの。 */
  hidden: ({ kind: ItemKind; color?: RideColor } | null)[]
  /** もえている ブロック（マスばんごう → のこり）。 */
  burning: Map<number, number>
  fire: Uint8Array
  /** だれの ひか（1 ポン / 2 ボス・ひの あな）。ボスは ポンの ひでだけ いたがる。 */
  fireOwner: Uint8Array
  blasts: Blast[]
  bombs: Bomb[]
  items: Item[]
  enemies: Enemy[]
  boss: Boss | null
  shots: Shot[]
  runaways: Runaway[]
  hero: Hero
  door: { tx: number; ty: number; open: boolean } | null
  warps: Map<number, number>
  vents: Vent[]
  state: WorldState
  stateT: number
  frame: number
  /** あたった しゅんかんに すこし とめて てごたえを だす。 */
  hitStop: number
  input: { dir: Dir | null; bomb: number; skill: number }
  events: WorldEvent[]
  stats: { damage: number; star: boolean; frames: number; defeated: number; bombs: number }
  nextId: number
  rand: () => number
}

/** 32bit の 種から いつも 同じ ならびを だす 乱数（mulberry32）。 */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

export const center = (t: number) => t * TILE + TILE / 2
export const tileOf = (p: number) => Math.floor(p / TILE)
export const inside = (w: World, tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < w.cols && ty < w.rows
export const idx = (w: World, tx: number, ty: number) => ty * w.cols + tx

export function tileAt(w: World, tx: number, ty: number) {
  return inside(w, tx, ty) ? w.tiles[idx(w, tx, ty)] : T_WALL
}

export function floorAt(w: World, tx: number, ty: number) {
  return inside(w, tx, ty) ? w.floor[idx(w, tx, ty)] : F_PLAIN
}

/** あるけない マス（みずも あるけない）。 */
export function isSolid(w: World, tx: number, ty: number) {
  return tileAt(w, tx, ty) !== T_FLOOR
}

/** ひの ついている マス。おわりぎわは へいき。 */
export function isHot(w: World, tx: number, ty: number) {
  return inside(w, tx, ty) && w.fire[idx(w, tx, ty)] > FIRE_SAFE
}

/** すべっている ボンは まんなかを こえたら つぎの マスに いる。 */
export function bombTile(b: Bomb): [number, number] {
  if (b.slide !== null && b.off >= TILE / 2) return [b.tx + DX[b.slide], b.ty + DY[b.slide]]
  return [b.tx, b.ty]
}

export function bombPos(b: Bomb): [number, number] {
  const d = b.slide
  return [center(b.tx) + (d === null ? 0 : DX[d] * b.off), center(b.ty) + (d === null ? 0 : DY[d] * b.off)]
}

export function bombAt(w: World, tx: number, ty: number) {
  for (const b of w.bombs) {
    const [bx, by] = bombTile(b)
    if (bx === tx && by === ty) return b
  }
  return undefined
}

export function emit(w: World, event: WorldEvent) {
  w.events.push(event)
}

export type FireOwner = 'hero' | 'boss' | 'vent'

/** ひを つける。 */
export function ignite(w: World, tx: number, ty: number, owner: FireOwner) {
  if (!inside(w, tx, ty)) return
  const i = idx(w, tx, ty)
  // ポンの ひと かさなったら ポンの ひと して あつかう。
  if (owner === 'hero' || w.fire[i] <= FIRE_SAFE) w.fireOwner[i] = owner === 'hero' ? 1 : 2
  w.fire[i] = FIRE_FRAMES
}

/** ポンの ひ（ボスに きく ひ）。 */
export function isHeroFire(w: World, tx: number, ty: number) {
  return isHot(w, tx, ty) && w.fireOwner[idx(w, tx, ty)] === 1
}

/** こわれる ブロックを もやしはじめる。 */
export function burnSoft(w: World, tx: number, ty: number) {
  const i = idx(w, tx, ty)
  if (w.tiles[i] !== T_SOFT || w.burning.has(i)) return
  w.burning.set(i, BURN_FRAMES)
  emit(w, { type: 'break', x: center(tx), y: center(ty) })
}

/** ばくはつ。ひは かたい かべで とまり、ブロックは もやして そこで とまる。ほかの ボンには ひが うつる。 */
export function explodeAt(w: World, tx: number, ty: number, range: number, owner: FireOwner) {
  const arms: [number, number, number, number] = [0, 0, 0, 0]
  ignite(w, tx, ty, owner)
  for (const d of DIRS) {
    for (let i = 1; i <= range; i++) {
      const x = tx + DX[d] * i, y = ty + DY[d] * i
      const t = tileAt(w, x, y)
      if (t === T_WALL || t === T_HARD) break
      arms[d] = i
      ignite(w, x, y, owner)
      if (t === T_SOFT) { burnSoft(w, x, y); break }
      const other = bombAt(w, x, y)
      if (other) { if (other.chain < 0) other.chain = CHAIN_DELAY; break }
    }
  }
  w.blasts.push({ tx, ty, arms, t: 0, power: range })
  emit(w, { type: 'boom', x: center(tx), y: center(ty), power: range, owner })
}

export function explodeBomb(w: World, b: Bomb) {
  const i = w.bombs.indexOf(b)
  if (i < 0) return
  w.bombs.splice(i, 1)
  const [tx, ty] = bombTile(b)
  explodeAt(w, tx, ty, b.range, b.owner)
}

export function placeBombAt(w: World, tx: number, ty: number, range: number, owner: 'hero' | 'boss', fuse = FUSE): Bomb | null {
  if (!inside(w, tx, ty) || isSolid(w, tx, ty) || bombAt(w, tx, ty)) return null
  const b: Bomb = { id: w.nextId++, tx, ty, off: 0, slide: null, speed: 0, belt: false, kicked: false, fuse, range, owner, chain: -1, age: 0 }
  w.bombs.push(b)
  return b
}

export function heroAirborne(h: Hero) {
  return h.act?.kind === 'jump' || h.z > 4
}

/** ポンが いたい めに あう。ピョンタに のっていれば ピョンタが にげて ポンは ぶじ。 */
export function hurtHero(w: World) {
  const h = w.hero
  if (w.state !== 'play' || h.inv > 0 || heroAirborne(h) || h.act?.kind === 'hatch') return
  if (h.ride) {
    const color = h.ride
    h.ride = null
    h.inv = 100
    h.act = { kind: 'hop', t: 0, dur: 24 }
    const away = h.dir === 1 ? -1 : 1
    w.runaways.push({ x: h.x, y: h.y, vx: away * 1.6, vy: -.4, t: 0, color })
    emit(w, { type: 'dismount', x: h.x, y: h.y, color })
    w.hitStop = Math.max(w.hitStop, 5)
    return
  }
  h.hearts--
  w.stats.damage++
  h.inv = 120
  w.hitStop = Math.max(w.hitStop, 7)
  emit(w, { type: 'hurt', x: h.x, y: h.y, hearts: h.hearts })
  if (h.hearts <= 0) {
    w.state = 'miss'
    w.stateT = 0
    h.act = null
    emit(w, { type: 'miss', x: h.x, y: h.y })
  }
}

export function heroTile(w: World): [number, number] {
  return [tileOf(w.hero.x), tileOf(w.hero.y)]
}

export function aliveEnemies(w: World) {
  return w.enemies.filter(e => e.dead === 0)
}

export function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by)
}
