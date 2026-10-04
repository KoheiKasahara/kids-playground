// てきの うごき。てきは いつも マスの まんなかから まんなかへ うごき、まんなかで つぎの むきを きめる。

import {
  DIRS, DX, DY, T_FLOOR, T_SOFT, T_WATER, aliveEnemies, bombAt, bombTile, center, emit, heroTile, idx, inside, isHot,
  reverse, tileAt, tileOf, type Behave, type Dir, type Enemy, type World,
} from './core'
import type { EnemyKind } from './stages'

type Spec = { speed: number; hp: number; behave: Behave; flying: boolean; smart?: boolean; radius?: number }

export const ENEMY_SPECS: Record<EnemyKind, Spec> = {
  puni: { speed: .42, hp: 1, behave: 'wander', flying: false },
  tentou: { speed: .7, hp: 1, behave: 'straight', flying: false },
  sabo: { speed: .5, hp: 1, behave: 'wander', flying: false },
  sasori: { speed: .6, hp: 1, behave: 'chase', flying: false, smart: true, radius: 6 },
  yukidama: { speed: .55, hp: 1, behave: 'wander', flying: false },
  penguin: { speed: 1, hp: 1, behave: 'straight', flying: false },
  obake: { speed: .4, hp: 1, behave: 'ghost', flying: true },
  hinotama: { speed: .85, hp: 1, behave: 'wander', flying: false, smart: true },
  maguman: { speed: .5, hp: 2, behave: 'straight', flying: false },
  komori: { speed: .62, hp: 1, behave: 'ghost', flying: true },
  robo: { speed: .55, hp: 2, behave: 'chase', flying: false, smart: true, radius: 7 },
  neji: { speed: .9, hp: 1, behave: 'straight', flying: false },
}

export function spawnEnemy(w: World, kind: EnemyKind, tx: number, ty: number, wait = 40): Enemy {
  const spec = ENEMY_SPECS[kind]
  const e: Enemy = {
    id: w.nextId++, kind, x: center(tx), y: center(ty), fx: tx, fy: ty, tx, ty,
    dir: Math.floor(w.rand() * 4) as Dir, hp: spec.hp, inv: 0, speed: spec.speed, behave: spec.behave, flying: spec.flying,
    dead: 0, wait: wait + Math.floor(w.rand() * 40), stun: 0, age: Math.floor(w.rand() * 60),
  }
  w.enemies.push(e)
  return e
}

/** てきが その マスに はいれるか。おばけは ブロックも みずも とおりぬける。 */
export function enemyCanEnter(w: World, e: Enemy, tx: number, ty: number) {
  if (!inside(w, tx, ty)) return false
  const t = tileAt(w, tx, ty)
  if (t !== T_FLOOR && !(e.flying && (t === T_SOFT || t === T_WATER))) return false
  if (t === T_SOFT && w.burning.has(idx(w, tx, ty))) return false
  if (bombAt(w, tx, ty)) return false
  return true
}

/** もうすぐ ひが くる マス（かしこい てきは よける）。 */
function dangerMap(w: World) {
  const map = new Uint8Array(w.cols * w.rows)
  for (let i = 0; i < map.length; i++) if (w.fire[i] > 0) map[i] = 1
  for (const b of w.bombs) {
    if (b.fuse > 80 && b.chain < 0) continue
    const [bx, by] = bombTile(b)
    map[idx(w, bx, by)] = 1
    for (const d of DIRS) {
      for (let i = 1; i <= b.range; i++) {
        const x = bx + DX[d] * i, y = by + DY[d] * i
        const t = tileAt(w, x, y)
        if (t !== T_FLOOR && t !== T_WATER) break
        map[idx(w, x, y)] = 1
      }
    }
  }
  return map
}

/** ポンへの いちばん ちかい みちの さいしょの いっぽ。 */
function stepToward(w: World, e: Enemy, gx: number, gy: number): Dir | null {
  const start = idx(w, e.fx, e.fy)
  const goal = idx(w, gx, gy)
  if (start === goal) return null
  const first = new Int8Array(w.cols * w.rows).fill(-1)
  const seen = new Uint8Array(w.cols * w.rows)
  seen[start] = 1
  const queue = [start]
  for (let head = 0; head < queue.length && head < 220; head++) {
    const cur = queue[head]
    const cx = cur % w.cols, cy = Math.floor(cur / w.cols)
    for (const d of DIRS) {
      const nx = cx + DX[d], ny = cy + DY[d]
      if (!inside(w, nx, ny)) continue
      const ni = idx(w, nx, ny)
      if (seen[ni] || !enemyCanEnter(w, e, nx, ny)) continue
      seen[ni] = 1
      first[ni] = cur === start ? d : first[cur]
      if (ni === goal) return first[ni] as Dir
      queue.push(ni)
    }
  }
  return null
}

function pick<T>(w: World, list: readonly T[]): T {
  return list[Math.floor(w.rand() * list.length) % list.length]
}

function chooseDir(w: World, e: Enemy, danger: Uint8Array | null): Dir | null {
  let options = DIRS.filter(d => enemyCanEnter(w, e, e.fx + DX[d], e.fy + DY[d]))
  if (danger) {
    const safe = options.filter(d => !danger[idx(w, e.fx + DX[d], e.fy + DY[d])])
    const here = danger[idx(w, e.fx, e.fy)]
    if (safe.length) options = safe
    else if (!here) return null
  }
  if (!options.length) return null
  const back = reverse(e.dir)
  const forward = options.filter(d => d !== back)
  const wander = () => (options.includes(e.dir) && w.rand() < .7 ? e.dir : pick(w, forward.length ? forward : options))
  const [hx, hy] = heroTile(w)
  switch (e.behave) {
    case 'straight':
      return options.includes(e.dir) ? e.dir : pick(w, forward.length ? forward : options)
    case 'chase': {
      const radius = ENEMY_SPECS[e.kind].radius ?? 6
      if (Math.abs(hx - e.fx) + Math.abs(hy - e.fy) <= radius && w.rand() < .85) {
        const d = stepToward(w, e, hx, hy)
        if (d !== null && options.includes(d)) return d
      }
      return wander()
    }
    case 'ghost': {
      if (w.rand() < .45) {
        let best = options[0], bestDist = Infinity
        for (const d of options) {
          const dist = Math.abs(hx - (e.fx + DX[d])) + Math.abs(hy - (e.fy + DY[d]))
          if (dist < bestDist) { bestDist = dist; best = d }
        }
        return best
      }
      return wander()
    }
    default:
      return wander()
  }
}

export function hitEnemy(w: World, e: Enemy) {
  if (e.dead > 0 || e.inv > 0) return
  e.hp--
  if (e.hp <= 0) {
    e.dead = 1
    w.stats.defeated++
    w.hitStop = Math.max(w.hitStop, 4)
    emit(w, { type: 'enemyHit', x: e.x, y: e.y, kind: e.kind, dead: true })
  } else {
    e.inv = 60
    e.speed *= 1.3
    w.hitStop = Math.max(w.hitStop, 3)
    emit(w, { type: 'enemyHit', x: e.x, y: e.y, kind: e.kind, dead: false })
  }
}

export function updateEnemies(w: World) {
  let danger: Uint8Array | null | undefined
  for (const e of w.enemies) {
    e.age++
    if (e.dead > 0) { e.dead++; continue }
    if (e.inv > 0) e.inv--
    if (e.inv === 0 && isHot(w, tileOf(e.x), tileOf(e.y))) {
      hitEnemy(w, e)
      if (e.dead > 0) continue
    }
    if (e.stun > 0) { e.stun--; continue }
    if (e.wait > 0) { e.wait--; continue }
    const gx = center(e.tx), gy = center(e.ty)
    if (e.x === gx && e.y === gy) {
      e.fx = e.tx
      e.fy = e.ty
      if (danger === undefined) danger = aliveEnemies(w).some(o => ENEMY_SPECS[o.kind].smart) ? dangerMap(w) : null
      const d = chooseDir(w, e, ENEMY_SPECS[e.kind].smart ? danger : null)
      if (d === null) { e.wait = 10 + Math.floor(w.rand() * 14); continue }
      e.dir = d
      e.tx = e.fx + DX[d]
      e.ty = e.fy + DY[d]
    } else if (!enemyCanEnter(w, e, e.tx, e.ty) && (tileOf(e.x) !== e.tx || tileOf(e.y) !== e.ty)) {
      // むかう さきに ボンが おかれたら ひきかえす。
      const fx = e.fx, fy = e.fy
      e.fx = e.tx; e.fy = e.ty
      e.tx = fx; e.ty = fy
      e.dir = reverse(e.dir)
    }
    const tx = center(e.tx), ty = center(e.ty)
    const dist = Math.abs(tx - e.x) + Math.abs(ty - e.y)
    if (dist <= e.speed) { e.x = tx; e.y = ty } else {
      e.x += Math.sign(tx - e.x) * e.speed
      e.y += Math.sign(ty - e.y) * e.speed
    }
  }
  w.enemies = w.enemies.filter(e => e.dead === 0 || e.dead < 40)
}

/** ボスが よびだす てき。ボスの まわりの あいている マスに だす。 */
export function spawnNear(w: World, kind: EnemyKind, x: number, y: number, count: number) {
  const tx0 = tileOf(x), ty0 = tileOf(y)
  const spots: [number, number][] = []
  for (let r = 1; r <= 3 && spots.length < count; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const tx = tx0 + dx, ty = ty0 + dy
        if (tileAt(w, tx, ty) !== T_FLOOR || bombAt(w, tx, ty)) continue
        const [hx, hy] = heroTile(w)
        if (Math.abs(hx - tx) + Math.abs(hy - ty) < 2) continue
        if (!spots.some(([sx, sy]) => sx === tx && sy === ty)) spots.push([tx, ty])
      }
    }
  }
  for (let i = 0; i < count && spots.length; i++) {
    const [tx, ty] = spots.splice(Math.floor(w.rand() * spots.length), 1)[0]
    spawnEnemy(w, kind, tx, ty, 20)
  }
}

