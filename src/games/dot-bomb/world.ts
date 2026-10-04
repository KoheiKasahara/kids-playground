// せかいを つくって 1コマずつ すすめる ところ。
// ポンの うごき（かどで すっと まがれる おてつだい つき）、ボン、ピョンタの とくぎ、しかけを あつかう。

import {
  CHAIN_DELAY, DIRS, DX, DY, F_BELT, F_DOOR, F_ICE, F_VENT, F_WARP, FIRE_FRAMES, MAX_BOMBS, MAX_FIRE,
  MAX_HEARTS, MAX_SPEED, READY_FRAMES, START_HEARTS, T_FLOOR, T_HARD, T_SOFT, T_WALL, T_WATER, TILE, aliveEnemies, beltDir,
  bombAt, bombTile, center, emit, explodeBomb, explodeAt, floorAt, hashString, heroAirborne, heroTile, hurtHero, idx, inside,
  isBelt, isHot, isSolid, placeBombAt, rng, tileAt, tileOf, type Bomb, type Dir, type Hero, type ItemKind, type World,
} from './core'
import { hitEnemy, spawnEnemy, updateEnemies } from './enemies'
import { createBoss, updateBoss, updateShots } from './boss'
import type { RideColor, StageDef } from './stages'

export { READY_FRAMES } from './core'
export type { World, WorldEvent } from './core'

/** ポンの からだの はんぶん（マスより すこし ちいさく して すきまに はいりやすく）。 */
export const HERO_HALF = 7
/** かどを まがる おてつだいの はば。 */
const ASSIST = 10
const CLEAR_FRAMES = 150
const MISS_FRAMES = 120

const BELT_CHARS: Record<string, number> = { '^': 0, '>': 1, v: 2, '<': 3 }

export function createWorld(stage: StageDef, seed = 0): World {
  const rand = rng(hashString(stage.id) ^ seed)
  const rows = stage.map.length
  const cols = stage.map[0].length
  const tiles = new Uint8Array(cols * rows)
  const floor = new Uint8Array(cols * rows)
  const fillable: number[] = []
  const reserved = new Set<number>()
  const spawns: { kind: NonNullable<StageDef['enemies'][keyof StageDef['enemies']]>; tx: number; ty: number }[] = []
  const warpIds = new Map<string, number[]>()
  let start = { tx: 1, ty: 1 }
  let door: World['door'] = null
  let bossAt: { tx: number; ty: number } | null = null
  const vents: World['vents'] = []

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const ch = stage.map[ty][tx] ?? '#'
      const i = ty * cols + tx
      switch (ch) {
        case '#': tiles[i] = T_WALL; break
        case 'H': tiles[i] = T_HARD; break
        case 's': tiles[i] = T_SOFT; break
        case '~': tiles[i] = T_WATER; break
        case '.': fillable.push(i); break
        case 'i': floor[i] = F_ICE; fillable.push(i); break
        case 'I': floor[i] = F_ICE; break
        case 'P': start = { tx, ty }; break
        case 'D': floor[i] = F_DOOR; door = { tx, ty, open: false }; break
        case 'o': floor[i] = F_VENT; vents.push({ tx, ty, period: 330, phase: 0, range: 2 }); break
        case 'B': bossAt = { tx, ty }; break
        default:
          if (ch in BELT_CHARS) floor[i] = F_BELT + BELT_CHARS[ch]
          else if (/[1-9]/.test(ch)) { floor[i] = F_WARP; warpIds.set(ch, [...(warpIds.get(ch) ?? []), i]) }
          else if (/[a-f]/.test(ch)) {
            const kind = stage.enemies[ch as keyof StageDef['enemies']]
            if (kind) spawns.push({ kind, tx, ty })
          }
      }
    }
  }

  // てきの まわりと ボスの まわりは あけておく。
  for (const s of spawns) for (const d of DIRS) reserved.add((s.ty + DY[d]) * cols + s.tx + DX[d])
  if (bossAt) {
    for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) reserved.add((bossAt.ty + dy) * cols + bossAt.tx + dx)
  }
  const softs: number[] = []
  for (const i of fillable) {
    if (reserved.has(i)) continue
    if (rand() < stage.density) { tiles[i] = T_SOFT; softs.push(i) }
  }

  // ブロックの なかに アイテムを かくす。
  const hidden: World['hidden'] = new Array(cols * rows).fill(null)
  const free = [...softs]
  const takeFrom = (list: number[]) => {
    if (!list.length) return null
    const i = list[Math.floor(rand() * list.length)]
    free.splice(free.indexOf(i), 1)
    return i
  }
  const dist = (i: number) => Math.abs((i % cols) - start.tx) + Math.abs(Math.floor(i / cols) - start.ty)
  if (stage.egg) {
    const near = free.filter(i => dist(i) >= 2 && dist(i) <= 5)
    const at = takeFrom(near.length ? near : free)
    if (at !== null) hidden[at] = { kind: 'egg', color: stage.egg }
  }
  {
    const far = free.filter(i => dist(i) >= 9)
    const at = takeFrom(far.length ? far : free)
    if (at !== null) hidden[at] = { kind: 'star' }
  }
  for (const [kind, count] of Object.entries(stage.items) as [ItemKind, number][]) {
    for (let n = 0; n < count; n++) {
      const at = takeFrom(free)
      if (at !== null) hidden[at] = { kind }
    }
  }

  const warps = new Map<number, number>()
  for (const pair of warpIds.values()) {
    if (pair.length === 2) { warps.set(pair[0], pair[1]); warps.set(pair[1], pair[0]) }
  }
  vents.forEach((v, i) => { v.phase = 90 + i * 83 })

  const hero: Hero = {
    x: center(start.tx), y: center(start.ty), z: 0, dir: 2, moving: false, walk: 0,
    speedLv: 0, bombs: stage.start.bombs, fire: stage.start.fire, hearts: START_HEARTS,
    inv: 0, ride: null, act: null, cool: 0, slide: 0, slideDir: 2, warpLock: -1, placePose: 0,
  }

  const w: World = {
    stage, cols, rows, tiles, floor, hidden, burning: new Map(), fire: new Uint8Array(cols * rows), fireOwner: new Uint8Array(cols * rows),
    blasts: [], bombs: [], items: [], enemies: [], boss: null, shots: [], runaways: [], hero, door, warps, vents,
    state: 'ready', stateT: 0, frame: 0, hitStop: 0, input: { dir: null, bomb: 0, skill: 0 }, events: [],
    stats: { damage: 0, star: false, frames: 0, defeated: 0, bombs: 0 }, nextId: 1, rand,
  }
  for (const s of spawns) spawnEnemy(w, s.kind, s.tx, s.ty, 50)
  if (stage.boss && bossAt) w.boss = createBoss(stage.boss, bossAt.tx, bossAt.ty)
  return w
}

// ---------------- そうさ ----------------

export function setDir(w: World, dir: Dir | null) {
  w.input.dir = dir
}

export function pressBomb(w: World) {
  if (w.state === 'play') w.input.bomb++
}

export function pressSkill(w: World) {
  if (w.state === 'play') w.input.skill++
}

export function drainEvents(w: World) {
  const list = w.events
  w.events = []
  return list
}

// ---------------- ポンの うごき ----------------

export function heroSpeed(h: Hero) {
  return 1.05 + h.speedLv * .24
}

function overlapsTile(x: number, y: number, half: number, tx: number, ty: number) {
  return x + half > tx * TILE && x - half < (tx + 1) * TILE && y + half > ty * TILE && y - half < (ty + 1) * TILE
}

/** その いちに ポンが いられないか。いま かさなっている ボンは ぬけられる（おいた ばかりの ボンから にげられる）。 */
function heroBlocked(w: World, x: number, y: number) {
  const h = w.hero
  const x0 = tileOf(x - HERO_HALF), x1 = tileOf(x + HERO_HALF - .01)
  const y0 = tileOf(y - HERO_HALF), y1 = tileOf(y + HERO_HALF - .01)
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isSolid(w, tx, ty)) return true
      if (bombAt(w, tx, ty) && !overlapsTile(h.x, h.y, HERO_HALF, tx, ty)) return true
    }
  }
  return false
}

/** ポンを うごかす。かどに すこし ずれて ぶつかったら、すっと よこに よせて とおす。うごいた きょりを かえす。 */
function moveHero(w: World, d: Dir, dist: number, assist = true) {
  const h = w.hero
  let left = dist, moved = 0
  while (left > 1e-6) {
    const s = Math.min(1, left)
    left -= s
    const nx = h.x + DX[d] * s, ny = h.y + DY[d] * s
    const horizontal = DX[d] !== 0
    const pos = horizontal ? h.y : h.x
    const near = Math.round((pos - TILE / 2) / TILE) * TILE + TILE / 2
    if (!heroBlocked(w, nx, ny)) {
      h.x = nx; h.y = ny; moved += s
      // あるいている みちの まんなかへ すこしずつ よせて、マスに そろえる。
      if (assist && pos !== near) {
        const step = Math.sign(near - pos) * Math.min(Math.abs(near - pos), s * .5)
        if (horizontal ? !heroBlocked(w, h.x, h.y + step) : !heroBlocked(w, h.x + step, h.y)) {
          if (horizontal) h.y += step; else h.x += step
        }
      }
      continue
    }
    if (!assist) break
    const candidates = pos === near ? [near] : [near, near + Math.sign(pos - near) * TILE]
    let slid = false
    for (const c of candidates) {
      if (Math.abs(c - pos) > ASSIST) continue
      if (horizontal ? heroBlocked(w, h.x + DX[d] * s, c) : heroBlocked(w, c, h.y + DY[d] * s)) continue
      const step = Math.sign(c - pos) * Math.min(s, Math.abs(c - pos))
      if (horizontal ? heroBlocked(w, h.x, h.y + step) : heroBlocked(w, h.x + step, h.y)) continue
      if (horizontal) h.y += step; else h.x += step
      moved += Math.abs(step)
      slid = true
      break
    }
    if (!slid) break
  }
  return moved
}

/** ボンが その マスへ すべって いけるか。 */
function bombCanEnter(w: World, tx: number, ty: number, self: Bomb) {
  if (!inside(w, tx, ty) || isSolid(w, tx, ty)) return false
  for (const o of w.bombs) {
    if (o === self) continue
    const [ox, oy] = bombTile(o)
    if (ox === tx && oy === ty) return false
  }
  for (const e of w.enemies) if (e.dead === 0 && tileOf(e.x) === tx && tileOf(e.y) === ty) return false
  const h = w.hero
  if (!heroAirborne(h) && overlapsTile(h.x, h.y, HERO_HALF - 1, tx, ty)) return false
  const b = w.boss
  if (b && !b.hidden && b.dead === 0 && b.z < 8 && overlapsTile(b.x, b.y, 12, tx, ty)) return false
  return true
}

function frontTile(w: World): [number, number] {
  const [tx, ty] = heroTile(w)
  return [tx + DX[w.hero.dir], ty + DY[w.hero.dir]]
}

/** めのまえの ボン（または のっている ボン）を けとばす。 */
function kickFront(w: World) {
  const h = w.hero
  const [tx, ty] = heroTile(w)
  const [fx, fy] = frontTile(w)
  const b = [bombAt(w, fx, fy), bombAt(w, tx, ty)].find(bomb => bomb && (bomb.slide === null || bomb.belt))
  if (!b) return false
  if (b.slide !== null) return false
  if (!bombCanEnter(w, b.tx + DX[h.dir], b.ty + DY[h.dir], b)) {
    emit(w, { type: 'bump', x: center(b.tx), y: center(b.ty) })
    return false
  }
  b.slide = h.dir
  b.speed = 3.2
  b.kicked = true
  b.belt = false
  b.off = 0
  emit(w, { type: 'skill', x: h.x, y: h.y, skill: 'kick' })
  return true
}

function placeHeroBomb(w: World) {
  const h = w.hero
  if (heroAirborne(h)) return
  const [tx, ty] = heroTile(w)
  const own = w.bombs.filter(b => b.owner === 'hero').length
  if (own >= h.bombs) return
  if (placeBombAt(w, tx, ty, h.fire, 'hero')) {
    h.placePose = 12
    w.stats.bombs++
    emit(w, { type: 'place', x: center(tx), y: center(ty) })
  }
}

function triggerSkill(w: World) {
  const h = w.hero
  if (!h.ride || h.cool > 0) return
  const [tx, ty] = heroTile(w)
  switch (h.ride) {
    case 'green':
      h.act = { kind: 'dash', t: 0, dir: h.dir }
      h.cool = 30
      emit(w, { type: 'skill', x: h.x, y: h.y, skill: 'dash' })
      break
    case 'blue':
      kickFront(w)
      h.cool = 10
      break
    case 'pink': {
      const gx = tx + DX[h.dir] * 2, gy = ty + DY[h.dir] * 2
      const ok = inside(w, gx, gy) && tileAt(w, gx, gy) === T_FLOOR && !bombAt(w, gx, gy) && tileAt(w, tx + DX[h.dir], ty + DY[h.dir]) !== T_WALL
      h.act = ok
        ? { kind: 'jump', t: 0, dur: 30, fx: h.x, fy: h.y, tx: center(gx), ty: center(gy) }
        : { kind: 'hop', t: 0, dur: 16 }
      h.cool = 18
      emit(w, { type: 'skill', x: h.x, y: h.y, skill: 'jump' })
      break
    }
    case 'yellow': {
      let own = w.bombs.filter(b => b.owner === 'hero').length
      let placed = 0
      for (let i = 0; i < 12 && own < h.bombs; i++) {
        const x = tx + DX[h.dir] * i, y = ty + DY[h.dir] * i
        if (isSolid(w, x, y)) break
        if (bombAt(w, x, y)) { if (i === 0) continue; break }
        if (placeBombAt(w, x, y, h.fire, 'hero')) { own++; placed++ }
      }
      h.cool = 20
      if (placed) {
        h.placePose = 12
        w.stats.bombs += placed
        emit(w, { type: 'skill', x: h.x, y: h.y, skill: 'line' })
      }
      break
    }
  }
}

function stepAct(w: World) {
  const h = w.hero
  const a = h.act
  if (!a) return
  a.t++
  switch (a.kind) {
    case 'hatch':
      h.moving = false
      if (a.t === 20) { h.ride = a.color; emit(w, { type: 'ride', x: h.x, y: h.y, color: a.color }) }
      h.z = a.t > 14 && a.t < 30 ? Math.sin((a.t - 14) / 16 * Math.PI) * 10 : 0
      if (a.t >= 32) { h.act = null; h.z = 0 }
      break
    case 'dash': {
      h.moving = true
      h.dir = a.dir
      const moved = a.t > 900 ? 0 : moveHero(w, a.dir, 3.6, false)
      for (const e of w.enemies) {
        if (e.dead === 0 && e.inv === 0 && Math.abs(e.x - h.x) < 15 && Math.abs(e.y - h.y) < 15) hitEnemy(w, e)
      }
      if (moved < 1.8 || a.t > 80) {
        h.act = null
        h.moving = false
        emit(w, { type: 'bump', x: h.x + DX[a.dir] * 8, y: h.y + DY[a.dir] * 8 })
        w.hitStop = Math.max(w.hitStop, 3)
      }
      break
    }
    case 'jump': {
      const p = Math.min(1, a.t / a.dur)
      h.x = a.fx + (a.tx - a.fx) * p
      h.y = a.fy + (a.ty - a.fy) * p
      h.z = Math.sin(Math.PI * p) * 18
      h.moving = false
      if (p >= 1) { h.z = 0; h.act = null; emit(w, { type: 'land', x: h.x, y: h.y }) }
      break
    }
    case 'hop':
      h.z = Math.sin(Math.PI * a.t / a.dur) * 8
      if (a.t >= a.dur) { h.z = 0; h.act = null }
      break
  }
}

function walk(w: World) {
  const h = w.hero
  const d = w.input.dir
  const [tx, ty] = heroTile(w)
  const onIce = floorAt(w, tx, ty) === F_ICE
  const speed = heroSpeed(h)
  if (d !== null) {
    h.dir = d
    const moved = moveHero(w, d, speed * (onIce ? 1.08 : 1))
    h.moving = moved > 0
    h.walk += moved
    h.slide = onIce && moved > 0 ? 22 : 0
    h.slideDir = d
    // あおピョンタは ボンに ぶつかると けとばす。
    if (h.ride === 'blue' && moved < speed * .5) {
      const [fx, fy] = frontTile(w)
      const b = bombAt(w, fx, fy)
      const along = DX[d] !== 0 ? Math.abs(h.y - center(ty)) : Math.abs(h.x - center(tx))
      if (b && along < 3) kickFront(w)
    }
  } else if (onIce && h.slide > 0) {
    const s = Math.min(h.slide, Math.max(.4, speed * .9 * (h.slide / 22)))
    const moved = moveHero(w, h.slideDir, s, false)
    h.slide = moved > 0 ? h.slide - moved : 0
    h.moving = false
  } else {
    h.moving = false
    h.slide = 0
  }
}

function pickup(w: World) {
  const h = w.hero
  if (heroAirborne(h) || h.act?.kind === 'hatch') return
  const [tx, ty] = heroTile(w)
  const i = w.items.findIndex(it => it.tx === tx && it.ty === ty)
  if (i < 0) return
  const item = w.items[i]
  w.items.splice(i, 1)
  emit(w, { type: 'item', x: center(tx), y: center(ty), kind: item.kind })
  switch (item.kind) {
    case 'bomb': h.bombs = Math.min(MAX_BOMBS, h.bombs + 1); break
    case 'fire': h.fire = Math.min(MAX_FIRE, h.fire + 1); break
    case 'speed': h.speedLv = Math.min(MAX_SPEED, h.speedLv + 1); break
    case 'heart': h.hearts = Math.min(MAX_HEARTS, h.hearts + 1); emit(w, { type: 'heal', x: h.x, y: h.y }); break
    case 'star': w.stats.star = true; break
    case 'egg': {
      const color: RideColor = item.color ?? 'green'
      if (h.ride) w.runaways.push({ x: h.x, y: h.y, vx: (h.dir === 1 ? -1 : 1) * 1.2, vy: -.3, t: 0, color: h.ride })
      h.ride = null
      h.act = { kind: 'hatch', t: 0, color }
      h.x = center(tx); h.y = center(ty)
      emit(w, { type: 'hatch', x: h.x, y: h.y, color })
      break
    }
    case 'gold':
      winStage(w)
      break
  }
}

function winStage(w: World) {
  const h = w.hero
  w.state = 'clear'
  w.stateT = 0
  h.act = null
  h.z = 0
  h.moving = false
  emit(w, { type: 'clear', x: h.x, y: h.y })
}

function updateHero(w: World) {
  const h = w.hero
  if (h.inv > 0) h.inv--
  if (h.cool > 0) h.cool--
  if (h.placePose > 0) h.placePose--
  const bomb = w.input.bomb > 0
  const skill = w.input.skill > 0
  w.input.bomb = 0
  w.input.skill = 0
  if (h.act) stepAct(w)
  else {
    if (bomb) placeHeroBomb(w)
    if (skill) triggerSkill(w)
    if (!h.act) walk(w)
  }
  if (w.state !== 'play') return
  const [tx, ty] = heroTile(w)
  const f = floorAt(w, tx, ty)
  if (!heroAirborne(h) && !h.act && isBelt(f)) moveHero(w, beltDir(f), .6, false)
  pickup(w)
  if (w.state !== 'play') return
  // ワープつぼ
  const here = idx(w, tx, ty)
  if (h.warpLock !== here) h.warpLock = -1
  if (f === F_WARP && h.warpLock < 0 && !heroAirborne(h) && Math.abs(h.x - center(tx)) < 4 && Math.abs(h.y - center(ty)) < 4) {
    const to = w.warps.get(here)
    if (to !== undefined) {
      const nx = to % w.cols, ny = Math.floor(to / w.cols)
      emit(w, { type: 'warp', x: h.x, y: h.y, tx: center(nx), ty: center(ny) })
      h.x = center(nx); h.y = center(ny)
      h.warpLock = to
      h.slide = 0
    }
  }
  if (!heroAirborne(h) && isHot(w, tileOf(h.x), tileOf(h.y))) hurtHero(w)
  if (w.state !== 'play') return
  const door = w.door
  if (door?.open && !heroAirborne(h) && tileOf(h.x) === door.tx && tileOf(h.y) === door.ty
    && Math.abs(h.x - center(door.tx)) < 6 && Math.abs(h.y - center(door.ty)) < 6) winStage(w)
}

// ---------------- ボン・ひ・ブロック ----------------

function slideBomb(w: World, b: Bomb) {
  let left = b.speed
  while (left > 1e-6 && b.slide !== null) {
    if (b.off === 0) {
      if (b.belt) {
        const f = floorAt(w, b.tx, b.ty)
        if (!isBelt(f)) { b.slide = null; b.belt = false; break }
        b.slide = beltDir(f)
      }
      if (!bombCanEnter(w, b.tx + DX[b.slide], b.ty + DY[b.slide], b)) {
        if (b.kicked) emit(w, { type: 'bump', x: center(b.tx), y: center(b.ty) })
        b.slide = null
        b.kicked = false
        b.belt = false
        break
      }
    }
    const step = Math.min(left, TILE - b.off)
    b.off += step
    left -= step
    if (b.off >= TILE - 1e-6) {
      b.tx += DX[b.slide]
      b.ty += DY[b.slide]
      b.off = 0
    }
  }
}

function updateBombs(w: World) {
  for (const b of [...w.bombs]) {
    if (!w.bombs.includes(b)) continue
    b.age++
    if (b.slide === null && isBelt(floorAt(w, b.tx, b.ty))) {
      b.slide = beltDir(floorAt(w, b.tx, b.ty))
      b.speed = .6
      b.belt = true
      b.off = 0
    }
    if (b.slide !== null) slideBomb(w, b)
    const [tx, ty] = bombTile(b)
    if (b.chain < 0 && isHot(w, tx, ty)) b.chain = CHAIN_DELAY
    if (b.chain >= 0) {
      if (b.chain-- <= 0) explodeBomb(w, b)
    } else if (--b.fuse <= 0) explodeBomb(w, b)
  }
}

function updateFire(w: World) {
  for (let i = 0; i < w.fire.length; i++) if (w.fire[i] > 0) w.fire[i]--
  for (const blast of w.blasts) blast.t++
  w.blasts = w.blasts.filter(blast => blast.t < FIRE_FRAMES)
  for (const [i, left] of [...w.burning]) {
    if (left > 1) { w.burning.set(i, left - 1); continue }
    w.burning.delete(i)
    w.tiles[i] = T_FLOOR
    const hide = w.hidden[i]
    if (hide) {
      w.hidden[i] = null
      const tx = i % w.cols, ty = Math.floor(i / w.cols)
      w.items.push({ id: w.nextId++, tx, ty, kind: hide.kind, color: hide.color, age: 0 })
      emit(w, { type: 'reveal', x: center(tx), y: center(ty), kind: hide.kind })
    }
  }
  for (const item of w.items) item.age++
}

function updateVents(w: World) {
  for (const v of w.vents) {
    const p = (w.frame + v.phase) % v.period
    if (p === v.period - 70) emit(w, { type: 'ventWarn', x: center(v.tx), y: center(v.ty) })
    if (p === 0) explodeAt(w, v.tx, v.ty, v.range, 'vent')
  }
}

/** ひの あなが あと どれくらいで ふきだすか（0〜1、1 で ふきだす）。絵で つかう。 */
export function ventCharge(w: World, vent: World['vents'][number]) {
  const p = (w.frame + vent.phase) % vent.period
  return p >= vent.period - 70 ? (p - (vent.period - 70)) / 70 : 0
}

function updateRunaways(w: World) {
  for (const r of w.runaways) { r.t++; r.x += r.vx; r.y += r.vy; r.vy *= .96 }
  w.runaways = w.runaways.filter(r => r.t < 70)
}

function checkEnemiesTouch(w: World) {
  const h = w.hero
  if (heroAirborne(h)) return
  for (const e of w.enemies) {
    if (e.dead > 0) continue
    if (Math.abs(e.x - h.x) < 11 && Math.abs(e.y - h.y) < 11) {
      if (h.act?.kind === 'dash') { hitEnemy(w, e); continue }
      hurtHero(w)
      if (w.state !== 'play') return
    }
  }
}

function checkDoor(w: World) {
  const door = w.door
  if (!door || door.open || w.boss) return
  if (aliveEnemies(w).length === 0) {
    door.open = true
    emit(w, { type: 'doorOpen', x: center(door.tx), y: center(door.ty) })
  }
}

// ---------------- 1コマ すすめる ----------------

export function stepWorld(w: World) {
  w.frame++
  if (w.hitStop > 0) { w.hitStop--; return }
  w.stateT++
  switch (w.state) {
    case 'ready':
      w.input.bomb = 0
      w.input.skill = 0
      if (w.stateT >= READY_FRAMES) {
        w.state = 'play'
        w.stateT = 0
        emit(w, { type: 'go' })
        if (w.boss) emit(w, { type: 'bossAct', x: w.boss.x, y: w.boss.y, act: 'roar' })
      }
      break
    case 'play':
      w.stats.frames++
      updateHero(w)
      if (w.state !== 'play') break
      updateBombs(w)
      updateFire(w)
      updateVents(w)
      updateEnemies(w)
      updateBoss(w)
      updateShots(w)
      checkEnemiesTouch(w)
      checkDoor(w)
      updateRunaways(w)
      break
    case 'clear':
      updateFire(w)
      updateRunaways(w)
      if (w.stateT === CLEAR_FRAMES) emit(w, { type: 'done' })
      break
    case 'miss':
      updateFire(w)
      updateRunaways(w)
      if (w.stateT === MISS_FRAMES) emit(w, { type: 'missDone' })
      break
  }
}

export type StageResult = { stars: number; noDamage: boolean; star: boolean; seconds: number; defeated: number }

/** ★は 3つ: クリア・ハートを へらさない・ほしの かけらを みつける。 */
export function stageResult(w: World): StageResult {
  const noDamage = w.stats.damage === 0
  return { stars: 1 + (noDamage ? 1 : 0) + (w.stats.star ? 1 : 0), noDamage, star: w.stats.star, seconds: Math.round(w.stats.frames / 60), defeated: w.stats.defeated }
}

