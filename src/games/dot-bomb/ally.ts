// なかまの ロボン。よぶと ポンの そばに あらわれて、てきを さがして ボンを おいてくれる。
// ロボンの ひは ポンに あたらず、ロボンは なにが あっても へいき。アイテムも ひろわない。

import {
  DIRS, DX, DY, FUSE, T_SOFT, aliveEnemies, bombAt, center, emit, heroTile, inside, isSolid, placeBombAt, tileAt, tileOf,
  type Ally, type Dir, type World,
} from './core'

export const ALLY_SPEED = 1.1
/** ロボンの ひの ながさ。 */
export const ALLY_FIRE = 2
/** ボンを おいてから つぎに おけるまで。 */
const ALLY_COOL = 100

export function summonAlly(w: World) {
  if (w.ally) return
  const [hx, hy] = heroTile(w)
  let at: [number, number] = [hx, hy]
  for (const d of [3, 1, 2, 0] as Dir[]) {
    const x = hx + DX[d], y = hy + DY[d]
    if (inside(w, x, y) && !isSolid(w, x, y)) { at = [x, y]; break }
  }
  const a: Ally = { x: center(at[0]), y: center(at[1]), tx: at[0], ty: at[1], dir: 2, moving: false, cool: 60, age: 0 }
  w.ally = a
  emit(w, { type: 'allyIn', x: a.x, y: a.y })
}

export function dismissAlly(w: World) {
  const a = w.ally
  if (!a) return
  w.ally = null
  emit(w, { type: 'allyOut', x: a.x, y: a.y })
}

type Goal = (tx: number, ty: number) => boolean

/** その マスに ボンを おくと ひが とどくか（ブロックや かべで とまる）。 */
function reaches(w: World, tx: number, ty: number, hit: Goal) {
  if (hit(tx, ty)) return true
  for (const d of DIRS) {
    for (let i = 1; i <= ALLY_FIRE; i++) {
      const x = tx + DX[d] * i, y = ty + DY[d] * i
      if (hit(x, y)) return true
      if (isSolid(w, x, y)) break
    }
  }
  return false
}

/** ゴールまでの さいしょの 1ぽ（もう ついていれば 'here'、いけなければ null）。ロボンは ボンの うえも とおれる。 */
function firstStep(w: World, sx: number, sy: number, goal: Goal): Dir | 'here' | null {
  if (goal(sx, sy)) return 'here'
  const first = new Int8Array(w.cols * w.rows).fill(-1)
  const start = sy * w.cols + sx
  first[start] = 4
  const queue = [start]
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q]
    const x = i % w.cols, y = Math.floor(i / w.cols)
    for (const d of DIRS) {
      const nx = x + DX[d], ny = y + DY[d]
      if (!inside(w, nx, ny) || isSolid(w, nx, ny)) continue
      const n = ny * w.cols + nx
      if (first[n] >= 0) continue
      first[n] = i === start ? d : first[i]
      if (goal(nx, ny)) return first[n] as Dir
      queue.push(n)
    }
  }
  return null
}

function bossHit(w: World): Goal | null {
  const b = w.boss
  if (!b || b.dead || b.hidden || b.z > 10) return null
  const x0 = tileOf(b.x - 10), x1 = tileOf(b.x + 10), y0 = tileOf(b.y - 10), y1 = tileOf(b.y + 10)
  return (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1
}

/** いま ねらう もの: ボス → てき → こわれる ブロック。 */
function targets(w: World): Goal[] {
  const list: Goal[] = []
  const boss = bossHit(w)
  if (boss) list.push(boss)
  const enemies = aliveEnemies(w)
  if (enemies.length) list.push((x, y) => enemies.some(e => tileOf(e.x) === x && tileOf(e.y) === y))
  list.push((x, y) => tileAt(w, x, y) === T_SOFT && !w.burning.has(y * w.cols + x))
  return list
}

/** マスの まんなかで つぎを きめる。うごく むきを かえす。 */
function think(w: World, a: Ally): Dir | null {
  const tx = a.tx, ty = a.ty
  const waiting = w.bombs.some(b => b.owner === 'ally')
  const aims = targets(w)
  if (!waiting && a.cool === 0 && !bombAt(w, tx, ty) && aims.some(hit => reaches(w, tx, ty, hit))) {
    if (placeBombAt(w, tx, ty, ALLY_FIRE, 'ally', FUSE)) {
      a.cool = ALLY_COOL
      emit(w, { type: 'allyBomb', x: center(tx), y: center(ty) })
    }
  }
  if (!w.bombs.some(b => b.owner === 'ally')) {
    for (const hit of aims) {
      const step = firstStep(w, tx, ty, (x, y) => reaches(w, x, y, hit))
      if (step === 'here') return null
      if (step !== null) return step
    }
  }
  // ボンの ばくはつを まつ あいだや する ことが ない ときは ポンの そばへ。
  const [hx, hy] = heroTile(w)
  const step = firstStep(w, tx, ty, (x, y) => Math.abs(x - hx) + Math.abs(y - hy) <= 1)
  return step === 'here' ? null : step
}

export function updateAlly(w: World) {
  const a = w.ally
  if (!a) return
  a.age++
  if (a.cool > 0) a.cool--
  const gx = center(a.tx), gy = center(a.ty)
  if (a.x === gx && a.y === gy) {
    const d = think(w, a)
    a.moving = d !== null
    if (d === null) return
    a.dir = d
    a.tx += DX[d]
    a.ty += DY[d]
  }
  const nx = center(a.tx), ny = center(a.ty)
  const dist = Math.abs(nx - a.x) + Math.abs(ny - a.y)
  if (dist <= ALLY_SPEED) { a.x = nx; a.y = ny } else {
    a.x += Math.sign(nx - a.x) * ALLY_SPEED
    a.y += Math.sign(ny - a.y) * ALLY_SPEED
  }
}
