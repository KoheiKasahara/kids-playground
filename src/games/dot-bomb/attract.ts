// タイトルの うしろで うごく おてほん。ほんものの せかいを つかって、ピョンタに のった ポンが
// あるきまわり、あちこちで ボンが はじけ、ブロックや てきが また あらわれる。

import { DIRS, DX, DY, T_FLOOR, T_SOFT, TILE, aliveEnemies, explodeAt, type Dir, type World } from './core'
import { spawnEnemy } from './enemies'
import { READY_FRAMES, createWorld, setDir, stepWorld } from './world'
import type { StageDef } from './stages'

const ATTRACT: StageDef = {
  id: 'attract', world: 'forest', no: '', name: '',
  map: [
    '###############',
    '#_____________#',
    '#_H.H.H.H.H.H_#',
    '#_..._..._..._#',
    '#_H.H.H.H.H.H_#',
    '#_..._.P._..._#',
    '#_H.H.H.H.H.H_#',
    '#_..._..._..._#',
    '#_H.H.H.H.H.H_#',
    '#_..._..._..._#',
    '#_H.H.H.H.H.H_#',
    '#_____________#',
    '###############',
  ],
  enemies: {}, density: .55, items: {}, egg: null, start: { bombs: 1, fire: 2 },
}

const KINDS = ['puni', 'tentou', 'obake'] as const

export function createAttract(): World {
  const w = createWorld(ATTRACT, 7)
  w.hero.ride = 'green'
  w.hero.inv = 1e9
  for (let i = 0; i < READY_FRAMES; i++) stepWorld(w)
  w.hero.inv = 1e9
  return w
}

function free(w: World, tx: number, ty: number) {
  return w.tiles[ty * w.cols + tx] === T_FLOOR
}

/** 1コマ すすめる（ポンの さんぽ・ときどき ばくはつ・ブロックと てきの おかわり）。 */
export function stepAttract(w: World) {
  const h = w.hero
  h.inv = 1e9
  h.hearts = 3
  const tx = Math.floor(h.x / TILE), ty = Math.floor(h.y / TILE)
  const centered = Math.abs(h.x - (tx * TILE + 8)) < 1.2 && Math.abs(h.y - (ty * TILE + 8)) < 1.2
  if (centered || w.input.dir === null) {
    const options = DIRS.filter(d => free(w, tx + DX[d], ty + DY[d]))
    const keep = w.input.dir !== null && options.includes(w.input.dir) && w.rand() < .6
    const next: Dir | null = keep ? w.input.dir : options.length ? options[Math.floor(w.rand() * options.length)] : null
    setDir(w, next)
  }
  if (w.frame % 46 === 0) {
    const spots: [number, number][] = []
    for (let y = 1; y < w.rows - 1; y++) for (let x = 1; x < w.cols - 1; x++) {
      if (!free(w, x, y)) continue
      if (Math.abs(x - tx) + Math.abs(y - ty) < 3) continue
      if (DIRS.some(d => w.tiles[(y + DY[d]) * w.cols + x + DX[d]] === T_SOFT)) spots.push([x, y])
    }
    if (spots.length) {
      const [x, y] = spots[Math.floor(w.rand() * spots.length)]
      explodeAt(w, x, y, 2, 'vent')
    }
  }
  if (w.frame % 30 === 0) {
    let softs = 0
    for (const t of w.tiles) if (t === T_SOFT) softs++
    if (softs < 40) {
      const x = 1 + Math.floor(w.rand() * (w.cols - 2)), y = 1 + Math.floor(w.rand() * (w.rows - 2))
      if (free(w, x, y) && Math.abs(x - tx) + Math.abs(y - ty) > 3 && !w.items.length) w.tiles[y * w.cols + x] = T_SOFT
    }
    if (aliveEnemies(w).length < 3) {
      const x = 1 + Math.floor(w.rand() * (w.cols - 2)), y = 1 + Math.floor(w.rand() * (w.rows - 2))
      if (free(w, x, y) && Math.abs(x - tx) + Math.abs(y - ty) > 4) spawnEnemy(w, KINDS[Math.floor(w.rand() * KINDS.length)], x, y, 10)
    }
  }
  w.items = []
  stepWorld(w)
}
