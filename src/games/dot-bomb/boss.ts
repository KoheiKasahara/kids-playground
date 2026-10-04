// ボスの うごき。どの ボスも「あぶない じかん」と「ねらいめの じかん」が はっきり わかれるように して、
// ちいさな こでも「いまだ！」が わかるように する。

import {
  DX, T_FLOOR, T_HARD, T_SOFT, T_WALL, T_WATER, TILE, aliveEnemies, bombAt, burnSoft, center, distance, emit, explodeAt, heroAirborne,
  hurtHero, ignite, isHeroFire, placeBombAt, tileAt, tileOf, type Boss, type Shot, type World,
} from './core'
import { hitEnemy, spawnNear } from './enemies'
import type { BossKind } from './stages'

/** ボスの からだの はんぶんの おおきさ（2×2マス）。 */
export const BOSS_HALF = 13
const HP: Record<BossKind, number> = { puni: 5, worm: 5, penguin: 6, dragon: 6, king: 8 }

/** はじめは すこし まって、にげる じかんを あげる（t が マイナスから はじまる）。 */
export function createBoss(kind: BossKind, tx: number, ty: number): Boss {
  return {
    kind, x: (tx + 1) * TILE, y: (ty + 1) * TILE, z: 0, vx: 0, vy: 0, hp: HP[kind], maxHp: HP[kind], inv: 0,
    state: kind === 'worm' ? 'up' : 'wait', t: kind === 'worm' ? -40 : -60, face: -1, count: 0, phase: 1, gx: 0, gy: 0, mark: null, dead: 0, hidden: false,
  }
}

function boxTiles(x: number, y: number, half: number) {
  return [tileOf(x - half), tileOf(y - half), tileOf(x + half - .01), tileOf(y + half - .01)] as const
}

function blockedBox(w: World, x: number, y: number, half = BOSS_HALF) {
  const [x0, y0, x1, y1] = boxTiles(x, y, half)
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = tileAt(w, tx, ty)
      if (t === T_WALL || t === T_HARD || t === T_WATER) return true
    }
  }
  return false
}

function crush(w: World, b: Boss) {
  const [x0, y0, x1, y1] = boxTiles(b.x, b.y, BOSS_HALF)
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (tileAt(w, tx, ty) === T_SOFT) burnSoft(w, tx, ty)
}

function setState(b: Boss, state: string) {
  b.state = state
  b.t = 0
}

/** ボスが おりられる ところ（マスの かど）を ねらいの ちかくで さがす。 */
function landingSpot(w: World, x: number, y: number): [number, number] {
  const gx = Math.round(x / TILE) * TILE, gy = Math.round(y / TILE) * TILE
  for (let r = 0; r <= 8; r++) {
    let best: [number, number] | null = null, bestDist = Infinity
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const px = gx + dx * TILE, py = gy + dy * TILE
        if (blockedBox(w, px, py)) continue
        const dist = distance(px, py, x, y)
        if (dist < bestDist) { bestDist = dist; best = [px, py] }
      }
    }
    if (best) return best
  }
  return [x, y]
}

function vulnerable(b: Boss) {
  if (b.dead || b.hidden || b.z > 6) return false
  if (b.kind === 'worm') return b.state === 'up' || b.state === 'emerge' || (b.state === 'dive' && b.t < 14)
  if (b.kind === 'king') return b.state !== 'break'
  return true
}

/** さわると いたい ときか。 */
export function bossTouchy(b: Boss) {
  if (b.dead || b.hidden || b.z > 10) return false
  if (b.kind === 'king' && b.state === 'break') return false
  return true
}

function heroFireOnBoss(w: World, b: Boss) {
  const [x0, y0, x1, y1] = boxTiles(b.x, b.y, BOSS_HALF - 2)
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isHeroFire(w, tx, ty)) return true
  return false
}

function damageBoss(w: World, b: Boss) {
  b.hp--
  b.inv = 70
  w.hitStop = Math.max(w.hitStop, 9)
  emit(w, { type: 'bossHit', x: b.x, y: b.y - b.z, hp: b.hp })
  if (b.hp <= 0) {
    b.dead = 1
    b.mark = null
    b.hidden = false
    w.hitStop = 26
    w.bombs = w.bombs.filter(bomb => bomb.owner !== 'boss')
    w.shots = []
    emit(w, { type: 'bossDown', x: b.x, y: b.y })
    return
  }
  if (b.kind === 'king' && b.phase === 1 && b.hp <= HP.king / 2) { setState(b, 'break'); emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'break' }) }
  else if (b.kind === 'worm' && b.state === 'up') b.t = Math.max(b.t, 118)
  else if (b.kind === 'penguin' && b.state === 'dizzy') b.t = Math.max(b.t, 70)
  else if (b.kind === 'dragon' && b.state === 'ground') b.t = Math.max(b.t, 118)
}

function aimShot(w: World, b: Boss, kind: Shot['kind'], speed: number, spread: number) {
  const h = w.hero
  const base = Math.atan2(h.y - b.y, h.x - b.x)
  w.shots.push({ id: w.nextId++, kind, x: b.x + Math.cos(base) * 12, y: b.y + Math.sin(base) * 10, z: 8, vx: Math.cos(base + spread) * speed, vy: Math.sin(base + spread) * speed, vz: 0, life: 220 })
}

/** ほのおの たま。ねらった マスに おちて ちいさく ばくはつする。 */
function lobFireball(w: World, b: Boss, gx: number, gy: number) {
  const n = 50, g = .12
  const z0 = b.z + 6
  w.shots.push({
    id: w.nextId++, kind: 'fireball', x: b.x + b.face * 10, y: b.y, z: z0,
    vx: (gx - b.x - b.face * 10) / n, vy: (gy - b.y) / n, vz: (g * n * n / 2 - z0) / n, life: n, gx, gy,
  })
}

function goldSpot(w: World, x: number, y: number): [number, number] {
  let best: [number, number] = [tileOf(x), tileOf(y)], bestDist = Infinity
  for (let ty = 0; ty < w.rows; ty++) {
    for (let tx = 0; tx < w.cols; tx++) {
      if (tileAt(w, tx, ty) !== T_FLOOR || bombAt(w, tx, ty)) continue
      const d = distance(center(tx), center(ty), x, y)
      if (d < bestDist) { bestDist = d; best = [tx, ty] }
    }
  }
  return best
}

function moveBox(w: World, b: Boss, dx: number, dy: number) {
  let hitX = false, hitY = false
  if (dx) { if (blockedBox(w, b.x + dx, b.y)) hitX = true; else b.x += dx }
  if (dy) { if (blockedBox(w, b.x, b.y + dy)) hitY = true; else b.y += dy }
  return { hitX, hitY }
}

function updatePuni(w: World, b: Boss) {
  const angry = b.hp <= 2
  const h = w.hero
  switch (b.state) {
    case 'wait': if (b.t > 50) setState(b, 'rest'); break
    case 'rest': if (b.t > (angry ? 38 : 72)) setState(b, 'crouch'); break
    case 'crouch':
      if (b.t >= 18) {
        const [gx, gy] = landingSpot(w, h.x + (w.rand() - .5) * 28, h.y + (w.rand() - .5) * 28)
        b.vx = b.x; b.vy = b.y; b.gx = gx; b.gy = gy
        b.face = gx < b.x ? -1 : 1
        b.mark = { x: gx, y: gy, r: 20 }
        setState(b, 'hop')
        emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'charge' })
      }
      break
    case 'hop': {
      const dur = angry ? 44 : 56
      const p = Math.min(1, b.t / dur)
      const e = p * p * (3 - 2 * p)
      b.x = b.vx + (b.gx - b.vx) * e
      b.y = b.vy + (b.gy - b.vy) * e
      b.z = Math.sin(Math.PI * p) * 50
      if (p >= 1) {
        b.z = 0
        b.mark = null
        crush(w, b)
        emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'land' })
        if (!heroAirborne(h) && distance(h.x, h.y, b.x, b.y) < 30) hurtHero(w)
        b.count++
        if (b.count % 2 === 0 && aliveEnemies(w).length < 3) {
          spawnNear(w, 'puni', b.x, b.y, angry ? 2 : 1)
          emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'spawn' })
        }
        setState(b, 'rest')
      }
      break
    }
  }
}

function updateWorm(w: World, b: Boss) {
  const h = w.hero
  switch (b.state) {
    case 'under': {
      b.hidden = true
      const d = distance(h.x, h.y, b.x, b.y)
      if (d > 2) {
        b.x += (h.x - b.x) / d * 1.05
        b.y += (h.y - b.y) / d * 1.05
      }
      b.x = Math.max(2 * TILE, Math.min((w.cols - 2) * TILE, b.x))
      b.y = Math.max(2 * TILE, Math.min((w.rows - 2) * TILE, b.y))
      b.face = h.x < b.x ? -1 : 1
      if (b.t > 120 || (b.t > 40 && d < 6)) {
        const [gx, gy] = landingSpot(w, b.x, b.y)
        b.x = gx; b.y = gy
        b.mark = { x: gx, y: gy, r: 22 }
        setState(b, 'rumble')
      }
      break
    }
    case 'rumble':
      if (b.t >= 52) {
        b.hidden = false
        b.mark = null
        crush(w, b)
        emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'emerge' })
        if (!heroAirborne(h) && distance(h.x, h.y, b.x, b.y) < 24) hurtHero(w)
        setState(b, 'up')
      }
      break
    case 'up':
      b.face = h.x < b.x ? -1 : 1
      if (b.t === 45 || b.t === 105) {
        for (const s of [-.4, 0, .4]) aimShot(w, b, 'sand', 1.45, s)
        emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'shoot' })
      }
      if (b.t >= 150) { setState(b, 'dive'); emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'dive' }) }
      break
    case 'dive':
      if (b.t >= 26) { b.hidden = true; setState(b, 'under') }
      break
  }
}

function updatePenguin(w: World, b: Boss) {
  const h = w.hero
  const angry = b.hp <= 3
  switch (b.state) {
    case 'wait': if (b.t > 50) setState(b, 'aim'); break
    case 'aim': {
      const dx = h.x - b.x, dy = h.y - b.y
      if (Math.abs(dx) > 2) b.face = Math.sign(dx)
      if (Math.abs(dx) >= Math.abs(dy)) { b.gx = Math.sign(dx) || b.face; b.gy = 0 } else { b.gx = 0; b.gy = Math.sign(dy) }
      if (b.t >= (angry ? 32 : 46)) {
        const speed = angry ? 3.6 : 3.1
        b.vx = b.gx * speed; b.vy = b.gy * speed
        setState(b, 'slide')
        emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'charge' })
      }
      break
    }
    case 'slide': {
      const steps = Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)))
      let bonk = false
      for (let i = 0; i < steps && !bonk; i++) {
        const { hitX, hitY } = moveBox(w, b, b.vx / steps, b.vy / steps)
        bonk = hitX || hitY
      }
      crush(w, b)
      if (bonk || b.t > 150) {
        b.vx = b.vy = 0
        setState(b, 'dizzy')
        emit(w, { type: 'bossAct', x: b.x + b.gx * 14, y: b.y + b.gy * 14, act: 'bonk' })
      }
      break
    }
    case 'dizzy':
      if (b.t >= 110) {
        b.count++
        setState(b, b.count % 2 === 0 ? 'throw' : 'aim')
      }
      break
    case 'throw':
      b.face = h.x < b.x ? -1 : 1
      if (b.t === 12 || b.t === 32 || b.t === 52) {
        aimShot(w, b, 'snow', 1.7, 0)
        emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'shoot' })
      }
      if (b.t >= 72) setState(b, 'aim')
      break
  }
}

function updateDragon(w: World, b: Boss) {
  const h = w.hero
  switch (b.state) {
    case 'wait': if (b.t > 40) { setState(b, 'rise'); emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'roar' }) } break
    case 'rise':
      b.z = Math.min(34, b.z + 1.1)
      if (b.z >= 34) setState(b, 'fly')
      break
    case 'fly': {
      const tx = Math.max(3 * TILE, Math.min((w.cols - 3) * TILE, h.x))
      const ty = Math.max(3 * TILE, Math.min((w.rows - 3) * TILE, h.y - 20))
      const d = distance(tx, ty, b.x, b.y)
      if (d > 1) { b.x += (tx - b.x) / d * Math.min(d, .85); b.y += (ty - b.y) / d * Math.min(d, .85) }
      if (Math.abs(tx - b.x) > 4) b.face = Math.sign(tx - b.x)
      b.z = 34 + Math.sin(b.t / 9) * 3
      if (b.t % 52 === 26) {
        lobFireball(w, b, center(tileOf(h.x)), center(tileOf(h.y)))
        emit(w, { type: 'bossAct', x: b.x, y: b.y - b.z, act: 'shoot' })
      }
      if (b.t >= (b.hp <= 3 ? 150 : 180)) {
        const [gx, gy] = landingSpot(w, b.x, b.y + 10)
        b.vx = b.x; b.vy = b.y; b.gx = gx; b.gy = gy
        b.mark = { x: gx, y: gy, r: 20 }
        setState(b, 'descend')
      }
      break
    }
    case 'descend': {
      const p = Math.min(1, b.t / 34)
      b.x = b.vx + (b.gx - b.vx) * p
      b.y = b.vy + (b.gy - b.vy) * p
      b.z = 34 * (1 - p * p)
      if (p >= 1) {
        b.z = 0
        b.mark = null
        crush(w, b)
        emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'land' })
        if (!heroAirborne(h) && distance(h.x, h.y, b.x, b.y) < 24) hurtHero(w)
        setState(b, 'ground')
      }
      break
    }
    case 'ground':
      if (b.t < 50 && Math.abs(h.x - b.x) > 4) b.face = Math.sign(h.x - b.x)
      if (b.t === 82) breathFire(w, b)
      if (b.t >= 150) { setState(b, 'rise'); emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'roar' }) }
      break
  }
}

/** くちから よこ いっせんに ほのおを はく。 */
function breathFire(w: World, b: Boss) {
  const dir = b.face > 0 ? 1 : 3
  const startX = b.face > 0 ? tileOf(b.x + TILE) : tileOf(b.x - TILE - 1)
  for (const ty of [tileOf(b.y - 8), tileOf(b.y + 8)]) {
    let len = 0
    for (let i = 0; i < 5; i++) {
      const tx = startX + DX[dir] * i
      const t = tileAt(w, tx, ty)
      if (t === T_WALL || t === T_HARD) break
      ignite(w, tx, ty, 'boss')
      len = i + 1
      if (t === T_SOFT) { burnSoft(w, tx, ty); break }
    }
    if (len > 0) {
      const arms: [number, number, number, number] = [0, 0, 0, 0]
      arms[dir] = len - 1
      w.blasts.push({ tx: startX, ty, arms, t: 0, power: 2 })
    }
  }
  emit(w, { type: 'bossAct', x: b.x + b.face * 20, y: b.y, act: 'breath' })
}

function updateKing(w: World, b: Boss) {
  const h = w.hero
  if (b.phase === 1) {
    switch (b.state) {
      case 'wait': if (b.t > 60) setState(b, 'walk'); break
      case 'walk': {
        const dx = h.x - b.x, dy = h.y - b.y
        const d = Math.hypot(dx, dy) || 1
        if (Math.abs(dx) > 3) b.face = Math.sign(dx)
        const { hitX, hitY } = moveBox(w, b, dx / d * .42, dy / d * .42)
        if (hitX && !hitY) moveBox(w, b, 0, (dy >= 0 ? 1 : -1) * .42)
        if (hitY && !hitX) moveBox(w, b, (dx >= 0 ? 1 : -1) * .42, 0)
        crush(w, b)
        if (b.t >= 150) { b.count++; setState(b, b.count % 2 ? 'drop' : 'shoot') }
        break
      }
      case 'drop':
        if (b.t === 18) {
          for (const side of [-1, 1]) placeBombAt(w, tileOf(b.x + side * 24), tileOf(b.y), 2, 'boss', 120)
          emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'spawn' })
        }
        if (b.t >= 46) setState(b, 'walk')
        break
      case 'shoot':
        if (b.t === 14 || b.t === 30 || b.t === 46) {
          aimShot(w, b, 'bolt', 1.6, (b.t - 30) / 80)
          emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'shoot' })
        }
        if (b.t >= 62) setState(b, 'walk')
        break
      case 'break':
        if (b.t % 8 === 0) emit(w, { type: 'bossPop', x: b.x + (w.rand() - .5) * 28, y: b.y + (w.rand() - .5) * 24 })
        if (b.t >= 100) {
          b.phase = 2
          b.vx = (h.x < b.x ? -1 : 1) * 1.15
          b.vy = (h.y < b.y ? -1 : 1) * .95
          spawnNear(w, 'robo', b.x, b.y, 2)
          setState(b, 'zoom')
          emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'roar' })
        }
        break
    }
    return
  }
  switch (b.state) {
    case 'zoom': {
      const { hitX, hitY } = moveBox(w, b, b.vx, b.vy)
      if (hitX) b.vx = -b.vx
      if (hitY) b.vy = -b.vy
      if (b.vx) b.face = Math.sign(b.vx)
      crush(w, b)
      if (b.t % 140 === 70) {
        placeBombAt(w, tileOf(b.x), tileOf(b.y), 2, 'boss', 120)
        emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'spawn' })
      }
      if (b.t >= 260) setState(b, 'tired')
      break
    }
    case 'tired':
      if (b.t >= 96) { setState(b, 'zoom'); emit(w, { type: 'bossAct', x: b.x, y: b.y, act: 'roar' }) }
      break
  }
}

export function updateBoss(w: World) {
  const b = w.boss
  if (!b) return
  b.t++
  if (b.dead > 0) {
    b.dead++
    b.z = Math.max(0, b.z - 1)
    if (b.dead % 9 === 0 && b.dead < 112) emit(w, { type: 'bossPop', x: b.x + (w.rand() - .5) * 30, y: b.y - b.z + (w.rand() - .5) * 26 })
    if (b.dead === 120) {
      for (const e of aliveEnemies(w)) { e.inv = 0; e.hp = 1; hitEnemy(w, e) }
      const [tx, ty] = goldSpot(w, b.x, b.y)
      w.items.push({ id: w.nextId++, tx, ty, kind: 'gold', age: 0 })
      emit(w, { type: 'reveal', x: center(tx), y: center(ty), kind: 'gold' })
    }
    if (b.dead > 150) w.boss = null
    return
  }
  if (b.inv > 0) b.inv--
  switch (b.kind) {
    case 'puni': updatePuni(w, b); break
    case 'worm': updateWorm(w, b); break
    case 'penguin': updatePenguin(w, b); break
    case 'dragon': updateDragon(w, b); break
    case 'king': updateKing(w, b); break
  }
  if (vulnerable(b) && b.inv === 0 && heroFireOnBoss(w, b)) damageBoss(w, b)
  const h = w.hero
  if (bossTouchy(b) && !heroAirborne(h) && Math.abs(h.x - b.x) < 19 && Math.abs(h.y - b.y) < 19) {
    if (h.act?.kind === 'dash') h.act.t = 999
    hurtHero(w)
  }
}

export function updateShots(w: World) {
  const h = w.hero
  for (const s of w.shots) {
    s.life--
    s.x += s.vx
    s.y += s.vy
    if (s.kind === 'fireball') {
      s.vz -= .12
      s.z = Math.max(0, s.z + s.vz)
      if (s.life <= 0) explodeAt(w, tileOf(s.gx ?? s.x), tileOf(s.gy ?? s.y), 1, 'boss')
      continue
    }
    const t = tileAt(w, tileOf(s.x), tileOf(s.y))
    if (t !== T_FLOOR && t !== T_WATER) { s.life = 0; emit(w, { type: 'bump', x: s.x, y: s.y }); continue }
    if (!heroAirborne(h) && Math.abs(s.x - h.x) < 8 && Math.abs(s.y - h.y) < 9) { s.life = 0; hurtHero(w) }
  }
  w.shots = w.shots.filter(s => s.life > 0)
}
