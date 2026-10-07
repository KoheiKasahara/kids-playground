// ゲームの なかみ（うごきと あたりはんてい）。DOM も canvas も さわらない 純粋な 計算だけ。
// 1かい よぶと 1/60 びょう すすむ。うさぎは じぶんで みぎへ はしり、プレイヤーは ジャンプだけ する。

import { CHUNKS, type StageDef } from './stages'

export const TILE = 16
export const ROWS = 10
export const WORLD_H = ROWS * TILE
/** じめんの うえの たかさ（y）。 */
export const GROUND_Y = 8 * TILE

export const HERO_W = 10
export const HERO_H = 14

/** ジャンプの つよさ など（ドット / フレーム）。ながおしで たかく、くうちゅうで もう1かい とべる。 */
const JUMP_V = 4.7
const AIR_JUMP_V = 4.3
const STOMP_V = 3.9
const STOMP_V_HELD = 4.9
const SPRING_V = 5.8
const G_HOLD = .17
const G_FALL = .3
const MAX_FALL = 5
const COYOTE = 7
const JUMP_BUFFER = 8
/** よーい どん！ までの フレーム。 */
export const READY_FRAMES = 96
/** ゴールしてから おわるまでの フレーム。 */
export const GOAL_FRAMES = 150
const HURT_STUN = 26
const INVINCIBLE = 100
const BUBBLE_FRAMES = 84
const LOOSE_READY = 24
const LOOSE_LIFE = 360
/** いわの まえで とまって いたら ヒントを だす フレーム。 */
const HINT_AFTER = 80

export type Cell = '.' | '#' | '=' | '?' | 'u' | 'r'

export type Hero = {
  x: number; y: number; vy: number
  onGround: boolean
  coyote: number
  airJumps: number
  /** ばねで とんだ ときは ながおし なしでも たかく とぶ。 */
  boost: boolean
  stun: number
  invincible: number
  blocked: number
  hinted: boolean
  bubble: { t: number; fromX: number; fromY: number; toX: number; toY: number } | null
  /** はしった きょり（あしの アニメに つかう）。 */
  run: number
  /** さいごに ジャンプした ときからの フレーム。 */
  air: number
  /** 2だんジャンプで くるっと まわる のこり フレーム。 */
  flip: number
}

export type Pickup = { id: number; x: number; y: number; got: boolean }
export type Loose = { id: number; x: number; y: number; vx: number; vy: number; age: number }
export type Enemy = {
  id: number
  kind: 'walker' | 'flyer'
  x: number; y: number; baseY: number
  w: number; h: number
  vx: number; vy: number
  state: 'sleep' | 'move' | 'bye'
  t: number
}
export type Spring = { id: number; x: number; y: number; t: number }
export type Bump = { col: number; row: number; t: number }

export type WorldEvent =
  | { type: 'go' }
  | { type: 'jump'; x: number; y: number }
  | { type: 'double'; x: number; y: number }
  | { type: 'land'; x: number; y: number; hard: boolean }
  | { type: 'carrot'; x: number; y: number; count: number }
  | { type: 'medal'; x: number; y: number; count: number }
  | { type: 'block'; x: number; y: number }
  | { type: 'stomp'; x: number; y: number }
  | { type: 'hurt'; x: number; y: number; dropped: number }
  | { type: 'spring'; x: number; y: number }
  | { type: 'fall'; x: number; y: number }
  | { type: 'rescue'; x: number; y: number }
  | { type: 'hint' }
  | { type: 'goal'; x: number; y: number }
  | { type: 'done' }

export type World = {
  stage: StageDef
  cols: number
  width: number
  cells: Cell[][]
  hero: Hero
  carrots: Pickup[]
  medals: Pickup[]
  loose: Loose[]
  enemies: Enemy[]
  springs: Spring[]
  bumps: Bump[]
  goalX: number
  state: 'ready' | 'play' | 'goal' | 'done'
  frame: number
  /** state が かわってからの フレーム。 */
  stateT: number
  held: boolean
  pressBuffer: number
  got: { carrots: number; medals: number }
  carrotTotal: number
  events: WorldEvent[]
  nextId: number
}

export type RunResult = { carrots: number; carrotTotal: number; medals: number; medalTotal: number; stars: number }

/** チャンクを つなげた ステージの マップ（10ぎょう の もじれつ）。 */
export function stageRows(stage: StageDef): string[] {
  const rows = Array.from({ length: ROWS }, () => '')
  for (const name of stage.chunks) {
    const chunk = CHUNKS[name]
    for (let r = 0; r < ROWS; r++) rows[r] += chunk[r]
  }
  return rows
}

export function createWorld(stage: StageDef): World {
  const rows = stageRows(stage)
  const cols = rows[0].length
  const cells: Cell[][] = []
  const carrots: Pickup[] = [], medals: Pickup[] = [], enemies: Enemy[] = [], springs: Spring[] = []
  let goalX = (cols - 12) * TILE
  let id = 1
  let blocks = 0
  for (let r = 0; r < ROWS; r++) {
    const line: Cell[] = []
    for (let c = 0; c < cols; c++) {
      const ch = rows[r][c]
      const cx = c * TILE + TILE / 2, cy = r * TILE + TILE / 2
      if (ch === '#' || ch === '=' || ch === '?' || ch === 'r') line.push(ch)
      else line.push('.')
      if (ch === '?') blocks++
      else if (ch === 'c') carrots.push({ id: id++, x: cx, y: cy, got: false })
      else if (ch === 'M') medals.push({ id: id++, x: cx, y: cy, got: false })
      else if (ch === 'S') springs.push({ id: id++, x: c * TILE, y: r * TILE, t: 0 })
      else if (ch === 'G') goalX = cx
      else if (ch === 'e') {
        enemies.push({ id: id++, kind: 'walker', x: c * TILE + 2, y: (r + 1) * TILE - 12, baseY: (r + 1) * TILE - 12, w: 12, h: 12, vx: -.35, vy: 0, state: 'sleep', t: 0 })
      } else if (ch === 'b') {
        enemies.push({ id: id++, kind: 'flyer', x: c * TILE + 2, y: r * TILE + 2, baseY: r * TILE + 2, w: 12, h: 11, vx: -.45, vy: 0, state: 'sleep', t: 0 })
      }
    }
    cells.push(line)
  }
  return {
    stage,
    cols,
    width: cols * TILE,
    cells,
    hero: {
      x: 3 * TILE + 3, y: GROUND_Y - HERO_H, vy: 0, onGround: true, coyote: 0, airJumps: 0, boost: false,
      stun: 0, invincible: 0, blocked: 0, hinted: false, bubble: null, run: 0, air: 0, flip: 0,
    },
    carrots, medals, loose: [], enemies, springs, bumps: [],
    goalX,
    state: 'ready',
    frame: 0,
    stateT: 0,
    held: false,
    pressBuffer: 0,
    got: { carrots: 0, medals: 0 },
    carrotTotal: carrots.length + blocks,
    events: [],
    nextId: id,
  }
}

export function cellAt(world: World, col: number, row: number): Cell {
  if (col < 0 || col >= world.cols) return '#'
  if (row < 0) return '.'
  // いちばん したの ぎょうより したは、おなじ ものが つづいている ことに する（あなは そこなし）。
  return world.cells[Math.min(ROWS - 1, row)][col]
}

const isSolid = (c: Cell) => c === '#' || c === '?' || c === 'u' || c === 'r'

function solidAt(world: World, x: number, y: number) {
  return isSolid(cellAt(world, Math.floor(x / TILE), Math.floor(y / TILE)))
}

function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

/** ボタンを おした（タップ・キー）。すこし まえに おしても ジャンプに なる。 */
export function pressJump(world: World) {
  world.held = true
  world.pressBuffer = JUMP_BUFFER
}

export function releaseJump(world: World) {
  world.held = false
}

export function drainEvents(world: World): WorldEvent[] {
  const events = world.events
  world.events = []
  return events
}

function emit(world: World, event: WorldEvent) {
  world.events.push(event)
}

/** あなから たすけて おろす ばしょ（あなの さきの あんぜんな じめん）。 */
function rescueSpot(world: World, fromX: number) {
  for (let c = Math.max(0, Math.floor(fromX / TILE) + 1); c < world.cols - 2; c++) {
    const ok = [c, c + 1, c + 2].every(k => cellAt(world, k, 8) === '#' && !isSolid(cellAt(world, k, 7)) && !isSolid(cellAt(world, k, 6)))
    if (ok) return { x: c * TILE + 6, y: GROUND_Y - HERO_H - 34 }
  }
  return { x: fromX, y: GROUND_Y - HERO_H - 34 }
}

function heroSpeed(world: World) {
  const { hero } = world
  if (world.state === 'ready' || world.state === 'done') return 0
  if (world.state === 'goal') return Math.max(0, world.stage.speed * (1 - world.stateT / 50))
  if (hero.stun > 0) return -.5
  return world.stage.speed
}

function stepHero(world: World) {
  const { hero } = world
  if (hero.invincible > 0) hero.invincible--
  if (hero.flip > 0) hero.flip--

  if (hero.bubble) {
    const b = hero.bubble
    b.t++
    const k = Math.min(1, b.t / BUBBLE_FRAMES)
    const ease = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
    hero.x = b.fromX + (b.toX - b.fromX) * ease
    hero.y = b.fromY + (b.toY - b.fromY) * ease - Math.sin(k * Math.PI) * 30
    if (b.t >= BUBBLE_FRAMES) {
      hero.bubble = null
      hero.vy = 0
      hero.invincible = 60
      hero.airJumps = 1
      emit(world, { type: 'rescue', x: hero.x + HERO_W / 2, y: hero.y + HERO_H / 2 })
    }
    return
  }

  // ---- ジャンプ ----
  const canAct = world.state === 'play' && hero.stun === 0
  if (world.pressBuffer > 0) {
    if (canAct && (hero.onGround || hero.coyote > 0)) {
      hero.vy = -JUMP_V
      hero.onGround = false
      hero.coyote = 0
      hero.airJumps = 1
      hero.boost = false
      hero.air = 0
      world.pressBuffer = 0
      emit(world, { type: 'jump', x: hero.x + HERO_W / 2, y: hero.y + HERO_H })
    } else if (canAct && hero.airJumps > 0) {
      hero.vy = -AIR_JUMP_V
      hero.airJumps = 0
      hero.boost = false
      hero.flip = 24
      world.pressBuffer = 0
      emit(world, { type: 'double', x: hero.x + HERO_W / 2, y: hero.y + HERO_H })
    } else world.pressBuffer--
  }

  // ---- よこ ----
  const vx = heroSpeed(world)
  if (vx !== 0) {
    hero.x += vx
    const front = vx > 0 ? hero.x + HERO_W : hero.x
    let hit = false
    for (const y of [hero.y + 1, hero.y + HERO_H / 2, hero.y + HERO_H - 1]) {
      if (solidAt(world, front, y)) { hit = true; break }
    }
    if (hit) {
      const col = Math.floor(front / TILE)
      hero.x = vx > 0 ? col * TILE - HERO_W - .001 : (col + 1) * TILE + .001
      if (vx > 0 && world.state === 'play') hero.blocked++
    } else {
      hero.blocked = 0
      hero.hinted = false
      if (hero.onGround) hero.run += Math.abs(vx)
    }
  }
  if (hero.blocked > HINT_AFTER && !hero.hinted) {
    hero.hinted = true
    emit(world, { type: 'hint' })
  }

  // ---- たて ----
  const rising = hero.vy < 0
  const gravity = rising && (hero.boost || world.held) ? G_HOLD : G_FALL
  if (!rising) hero.boost = false
  hero.vy = Math.min(MAX_FALL, hero.vy + gravity)
  const prevBottom = hero.y + HERO_H
  hero.y += hero.vy
  const wasGround = hero.onGround
  hero.onGround = false
  const left = hero.x + .5, right = hero.x + HERO_W - .5
  if (hero.vy > 0) {
    const bottom = hero.y + HERO_H
    const row = Math.floor(bottom / TILE)
    const top = row * TILE
    const cells = [cellAt(world, Math.floor(left / TILE), row), cellAt(world, Math.floor(right / TILE), row)]
    const land = cells.some(isSolid) || (cells.includes('=') && prevBottom <= top + .01)
    if (land && prevBottom <= top + Math.max(2, hero.vy + .5)) {
      hero.y = top - HERO_H
      const hard = hero.vy > 3
      hero.vy = 0
      hero.onGround = true
      hero.airJumps = 0
      hero.boost = false
      if (!wasGround) emit(world, { type: 'land', x: hero.x + HERO_W / 2, y: hero.y + HERO_H, hard })
    }
  } else if (hero.vy < 0) {
    const top = hero.y
    const row = Math.floor(top / TILE)
    for (const x of [left, right]) {
      const col = Math.floor(x / TILE)
      const cell = cellAt(world, col, row)
      if (!isSolid(cell) || row < 0) continue
      hero.y = (row + 1) * TILE
      hero.vy = 0
      if (cell === '?') {
        world.cells[row][col] = 'u'
        world.bumps.push({ col, row, t: 0 })
        world.got.carrots++
        emit(world, { type: 'block', x: col * TILE + TILE / 2, y: row * TILE })
        emit(world, { type: 'carrot', x: col * TILE + TILE / 2, y: row * TILE - 10, count: world.got.carrots })
      } else if (cell === 'u') world.bumps.push({ col, row, t: 0 })
      break
    }
  }
  if (hero.onGround) {
    hero.coyote = COYOTE
    hero.air = 0
  } else {
    if (wasGround && hero.vy >= 0) hero.coyote = COYOTE
    else if (hero.coyote > 0) hero.coyote--
    hero.air++
  }

  if (hero.stun > 0) hero.stun--

  // ---- あなに おちた ----
  if (hero.y > WORLD_H + 20) {
    const to = rescueSpot(world, hero.x)
    hero.bubble = { t: 0, fromX: hero.x, fromY: hero.y, toX: to.x, toY: to.y }
    hero.vy = 0
    hero.stun = 0
    hero.blocked = 0
    emit(world, { type: 'fall', x: hero.x + HERO_W / 2, y: WORLD_H })
  }
}

function stepPickups(world: World) {
  const { hero } = world
  if (hero.bubble) return
  const hx = hero.x - 2, hy = hero.y - 3, hw = HERO_W + 4, hh = HERO_H + 5
  for (const c of world.carrots) {
    if (c.got || !overlaps(hx, hy, hw, hh, c.x - 5, c.y - 7, 10, 14)) continue
    c.got = true
    world.got.carrots++
    emit(world, { type: 'carrot', x: c.x, y: c.y, count: world.got.carrots })
  }
  for (const m of world.medals) {
    if (m.got || !overlaps(hx, hy, hw, hh, m.x - 8, m.y - 8, 16, 16)) continue
    m.got = true
    world.got.medals++
    emit(world, { type: 'medal', x: m.x, y: m.y, count: world.got.medals })
  }
  world.loose = world.loose.filter(l => {
    l.age++
    l.vy = Math.min(4, l.vy + .25)
    l.x += l.vx
    l.y += l.vy
    l.vx *= .985
    if (l.vy > 0 && solidAt(world, l.x, l.y + 6)) {
      l.y = Math.floor((l.y + 6) / TILE) * TILE - 6
      l.vy = Math.abs(l.vy) > 1 ? -l.vy * .45 : 0
      l.vx *= .8
    }
    if (l.age > LOOSE_READY && overlaps(hx, hy, hw, hh, l.x - 5, l.y - 7, 10, 14)) {
      world.got.carrots++
      emit(world, { type: 'carrot', x: l.x, y: l.y, count: world.got.carrots })
      return false
    }
    return l.age < LOOSE_LIFE && l.y < WORLD_H + 40
  })
  for (const s of world.springs) {
    if (s.t > 0) s.t--
    if (hero.vy < 0 || !overlaps(hero.x, hero.y, HERO_W, HERO_H, s.x + 2, s.y + 7, 12, 9)) continue
    hero.vy = -SPRING_V
    hero.boost = true
    hero.onGround = false
    // じめんの すぐ うえでも ばねで とんだら くうちゅう。つぎの ボタンは 2だんジャンプに する。
    hero.coyote = 0
    hero.airJumps = 1
    hero.flip = 0
    s.t = 14
    emit(world, { type: 'spring', x: s.x + TILE / 2, y: s.y + TILE })
  }
}

function hurt(world: World, from: Enemy) {
  const { hero } = world
  const dropped = Math.min(3, world.got.carrots)
  world.got.carrots -= dropped
  for (let i = 0; i < dropped; i++) {
    world.loose.push({ id: world.nextId++, x: hero.x + HERO_W / 2, y: hero.y + 2, vx: 1.1 + i * .55, vy: -3.2 - i * .5, age: 0 })
  }
  hero.stun = HURT_STUN
  hero.invincible = INVINCIBLE
  hero.vy = Math.min(hero.vy, -2.6)
  hero.onGround = false
  hero.airJumps = 0
  emit(world, { type: 'hurt', x: (hero.x + from.x) / 2 + HERO_W / 2, y: hero.y + HERO_H / 2, dropped })
}

function stepEnemies(world: World) {
  const { hero } = world
  for (const e of world.enemies) {
    e.t++
    if (e.state === 'sleep') {
      if (e.x - hero.x < 250) e.state = 'move'
      else continue
    }
    if (e.state === 'bye') {
      e.vy += .3
      e.x += e.vx
      e.y += e.vy
      continue
    }
    if (e.kind === 'walker') {
      const next = e.x + e.vx
      const front = e.vx < 0 ? next : next + e.w
      const floor = cellAt(world, Math.floor(front / TILE), Math.floor((e.y + e.h + 2) / TILE))
      const wall = solidAt(world, front, e.y + e.h / 2)
      if (wall || !(isSolid(floor) || floor === '=')) e.vx = -e.vx
      else e.x = next
    } else {
      e.x += e.vx
      e.y = e.baseY + Math.sin(e.t * .06) * 7
    }
    if (world.state !== 'play' || hero.bubble) continue
    if (!overlaps(hero.x, hero.y, HERO_W, HERO_H, e.x + 1, e.y + 1, e.w - 2, e.h - 1)) continue
    const feet = hero.y + HERO_H
    if (hero.vy > 0 && feet - e.y < 9) {
      e.state = 'bye'
      e.vx = 1.2
      e.vy = -3.5
      e.t = 0
      hero.vy = world.held ? -STOMP_V_HELD : -STOMP_V
      hero.y = e.y - HERO_H
      hero.airJumps = 1
      hero.boost = world.held
      emit(world, { type: 'stomp', x: e.x + e.w / 2, y: e.y })
    } else if (hero.invincible === 0) hurt(world, e)
  }
  world.enemies = world.enemies.filter(e => !(e.state === 'bye' && e.y > WORLD_H + 60) && e.x > -40)
}

export function stepWorld(world: World) {
  world.frame++
  world.stateT++
  if (world.state === 'ready' && world.stateT >= READY_FRAMES) {
    world.state = 'play'
    world.stateT = 0
    emit(world, { type: 'go' })
  }
  stepHero(world)
  stepPickups(world)
  stepEnemies(world)
  for (const b of world.bumps) b.t++
  world.bumps = world.bumps.filter(b => b.t < 12)
  const { hero } = world
  if (world.state === 'play' && hero.x + HERO_W / 2 >= world.goalX && !hero.bubble) {
    world.state = 'goal'
    world.stateT = 0
    world.pressBuffer = 0
    emit(world, { type: 'goal', x: world.goalX, y: GROUND_Y })
  } else if (world.state === 'goal') {
    // ゴールしたら とまって、ぴょんぴょん よろこぶ。
    if (world.stateT > 56 && hero.onGround && world.stateT % 34 === 0 && world.stateT < GOAL_FRAMES - 20) {
      hero.vy = -3.2
      hero.onGround = false
    }
    if (world.stateT >= GOAL_FRAMES) {
      world.state = 'done'
      world.stateT = 0
      emit(world, { type: 'done' })
    }
  }
}

export function runResult(world: World): RunResult {
  const medals = world.got.medals
  return {
    carrots: world.got.carrots,
    carrotTotal: world.carrotTotal,
    medals,
    medalTotal: world.medals.length,
    stars: Math.max(1, Math.min(3, medals)),
  }
}

/** ゴールまでの すすみぐあい（0〜1）。 */
export function progressRatio(world: World) {
  const start = 3 * TILE
  return Math.max(0, Math.min(1, (world.hero.x - start) / (world.goalX - start)))
}

/**
 * じどう そうじゅう（タイトル画面の おてほん と テストで つかう）。
 * まえに あな・いわ・いきものが あれば とび、あなの うえで おちはじめたら もう1かい とぶ。
 */
export function autoPilot(world: World) {
  const { hero } = world
  const feetRow = Math.floor((hero.y + HERO_H + 1) / TILE)
  const front = hero.x + HERO_W
  const col = (x: number) => Math.floor(x / TILE)
  let jump = false
  if (hero.onGround) {
    for (let dx = 4; dx <= 14; dx += 2) {
      const c = col(front + dx)
      if (feetRow >= 8 && cellAt(world, c, feetRow) === '.' && cellAt(world, c, feetRow + 1) === '.') jump = true
    }
    if (isSolid(cellAt(world, col(front + 6), feetRow - 1))) jump = true
    for (const e of world.enemies) {
      if (e.state === 'bye') continue
      const dx = e.x - front
      if (dx > -4 && dx < 34 && Math.abs(e.y + e.h - (hero.y + HERO_H)) < 20) jump = true
    }
  } else if (hero.vy > .5 && hero.airJumps > 0) {
    if ([col(hero.x), col(hero.x + HERO_W)].every(c => cellAt(world, c, 8) === '.')) jump = true
  }
  if (jump && !world.held) pressJump(world)
  else if (world.held && (hero.vy >= 0 || hero.onGround)) releaseJump(world)
}
