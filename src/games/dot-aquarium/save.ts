// すいそうを ブラウザに ほぞんする。ほぞん できなくても あそべる。
// ばしょは すいそうの はばに たいする わりあいで のこす（がめんの おおきさが かわっても くずれない）。

import { isDecor, isSpecies } from './data'
import { SURFACE, addCreature, addDecor, checkCreature, checkDecor, createWorld, floorY, sandTop, type World } from './sim'

const KEY = 'dot-aquarium-v1'
const MUSIC_KEY = 'dot-aquarium-music-v1'

type Saved = {
  c: { s: string; x: number; y: number; z: number; h: number }[]
  d: { k: string; x: number; z: number; seed: number }[]
  m: { x: number; y: number; r: number; a: number; seed: number }[]
  clock: number
  pearls: number
}

const r2 = (v: number) => Math.round(v * 1000) / 1000

export function serialize(world: World): Saved {
  const waterH = sandTop(world) - SURFACE
  return {
    c: world.creatures.map(c => ({ s: c.species, x: r2((c.species === 'eel' ? c.homeX : c.x) / world.W), y: r2((c.y - SURFACE) / waterH), z: r2(c.z), h: r2(c.hunger) })),
    d: world.decor.map(d => ({ k: d.kind, x: r2(d.x / world.W), z: r2(d.z), seed: d.seed })),
    m: world.moss.map(m => ({ x: r2(m.x / world.W), y: r2(m.y / world.H), r: Math.round(m.r), a: r2(m.a), seed: m.seed })),
    clock: r2(world.clock),
    pearls: world.pearls,
  }
}

const num = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

/** ほぞんした ものを もどす。へんな データは すてて、ルールに あう ものだけ ならべる。 */
export function restore(data: unknown, W = 400, H = 225, seed = 1): World {
  const world = createWorld(seed, W, H)
  if (!data || typeof data !== 'object') return world
  const { c, d, m, clock, pearls } = data as Record<string, unknown>
  if (num(clock, 0, .9999)) { world.clock = clock; world.night = clock >= .7 }
  if (Number.isInteger(pearls) && (pearls as number) >= 0 && (pearls as number) < 100000) world.pearls = pearls as number
  const tapY = (z: number) => floorY(world, z)
  if (Array.isArray(d)) {
    for (const o of d) {
      if (!o || typeof o !== 'object') continue
      const { k, x, z, seed: s } = o as Record<string, unknown>
      if (!isDecor(k) || !num(x, 0, 1) || !num(z, 0, 1)) continue
      const px = x * W, py = tapY(z)
      if (!checkDecor(world, k, px, py).ok) continue
      addDecor(world, k, px, py, Number.isInteger(s) ? (s as number) : undefined)
    }
  }
  if (Array.isArray(c)) {
    const waterH = sandTop(world) - SURFACE
    for (const o of c) {
      if (!o || typeof o !== 'object') continue
      const { s, x, y, z, h } = o as Record<string, unknown>
      if (!isSpecies(s) || !num(x, 0, 1) || !num(y, -.2, 1.5) || !num(z, 0, 1)) continue
      const floorish = s === 'eel' || s === 'crab'
      const px = x * W, py = floorish ? tapY(z) : SURFACE + y * waterH
      if (!checkCreature(world, s, px, py).ok) continue
      addCreature(world, s, px, py, { hunger: num(h, 0, 1) ? h : .4, ...(floorish ? {} : { z, tz: z }) })
    }
  }
  if (Array.isArray(m)) {
    for (const o of m.slice(0, 8)) {
      if (!o || typeof o !== 'object') continue
      const { x, y, r, a, seed: s } = o as Record<string, unknown>
      if (!num(x, 0, 1) || !num(y, 0, 1) || !num(r, 3, 20) || !num(a, 0, 1)) continue
      world.moss.push({ id: world.nextId++, x: x * W, y: y * H, r, a, seed: Number.isInteger(s) ? (s as number) : 1 })
    }
  }
  return world
}

export function readTank(W?: number, H?: number): World | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return restore(JSON.parse(raw), W, H)
  } catch { return null }
}

export function writeTank(world: World) {
  try { localStorage.setItem(KEY, JSON.stringify(serialize(world))) } catch { /* ほぞん できなくても つづけられる。 */ }
}

export function clearTank() {
  try { localStorage.removeItem(KEY) } catch { /* つづけられる。 */ }
}

export function readMusic(): boolean {
  try { return localStorage.getItem(MUSIC_KEY) !== 'off' } catch { return true }
}

export function writeMusic(on: boolean) {
  try { localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off') } catch { /* つづけられる。 */ }
}

/** はじめての ひとむけの おてほん。 */
export function starterTank(W = 400, H = 225): World {
  const world = createWorld(7, W, H)
  const put = (k: Parameters<typeof addDecor>[1], x: number, z: number) => {
    const px = x * W, py = floorY(world, z)
    if (checkDecor(world, k, px, py).ok) addDecor(world, k, px, py, 11 + Math.round(x * 100))
  }
  put('rock', .12, .2); put('kelp', .05, .5); put('kelp', .27, .1); put('wood', .72, .15); put('coral', .45, .35)
  put('anemone', .3, .75); put('clam', .6, .8); put('kelp', .92, .6); put('bubbler', .85, .2); put('coral', .9, .9)
  const add = (s: Parameters<typeof addCreature>[1], x: number, y: number) => {
    const py = y < 0 ? floorY(world, -y) : SURFACE + y * (sandTop(world) - SURFACE)
    if (checkCreature(world, s, x * W, py).ok) addCreature(world, s, x * W, py)
  }
  add('clown', .32, .6); add('clown', .36, .7); add('tang', .6, .35); add('neon', .2, .4); add('neon', .22, .45); add('neon', .18, .42)
  add('neon', .24, .38); add('jelly', .8, .3); add('crab', .55, -.6); add('eel', .5, -.45); add('eel', .53, -.3)
  return world
}
