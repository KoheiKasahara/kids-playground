// どうぶつえんを ブラウザに ほぞんする。ほぞん できなくても あそべる。

import { GRID, OBJECTS, SPECIES, type ObjectKind, type SpeciesId } from './data'
import { addAnimal, addObject, checkAnimal, checkObject, createWorld, type World } from './sim'

const KEY = 'dot-zoo-v1'
const MUSIC_KEY = 'dot-zoo-music-v1'

type Saved = {
  animals: { s: SpeciesId; x: number; z: number; h: number }[]
  objects: { k: ObjectKind; x: number; z: number; seed: number }[]
  clock: number
}

const speciesIds = new Set<string>(SPECIES.map(s => s.id))
const objectKinds = new Set<string>(OBJECTS.map(o => o.kind))

export function serialize(world: World): Saved {
  return {
    animals: world.animals.map(a => ({ s: a.species, x: Math.round(a.x * 100) / 100, z: Math.round(a.z * 100) / 100, h: Math.round(a.hunger * 100) / 100 })),
    objects: world.objects.map(o => ({ k: o.kind, x: o.x, z: o.z, seed: o.seed })),
    clock: Math.round(world.clock * 1000) / 1000,
  }
}

/** ほぞんした ものを もどす。へんな データは すてて、ルールに あう ものだけ ならべる。 */
export function restore(data: unknown, seed = 1): World {
  const world = createWorld(seed)
  if (!data || typeof data !== 'object') return world
  const { animals, objects, clock } = data as Record<string, unknown>
  if (typeof clock === 'number' && clock >= 0 && clock < 1) world.clock = clock
  if (Array.isArray(objects)) {
    for (const o of objects) {
      if (!o || typeof o !== 'object') continue
      const { k, x, z, seed: s } = o as Record<string, unknown>
      if (typeof k !== 'string' || !objectKinds.has(k) || !Number.isInteger(x) || !Number.isInteger(z)) continue
      const kind = k as ObjectKind
      if (!checkObject(world, kind, x as number, z as number).ok) continue
      addObject(world, kind, x as number, z as number, Number.isInteger(s) ? (s as number) : undefined)
    }
  }
  if (Array.isArray(animals)) {
    for (const a of animals) {
      if (!a || typeof a !== 'object') continue
      const { s, x, z, h } = a as Record<string, unknown>
      if (typeof s !== 'string' || !speciesIds.has(s) || typeof x !== 'number' || typeof z !== 'number') continue
      if (!(x >= 0 && x < GRID && z >= 0 && z < GRID)) continue
      const id = s as SpeciesId
      const tx = Math.floor(x), tz = Math.floor(z)
      if (!checkAnimal(world, id, tx, tz).ok) continue
      addAnimal(world, id, tx, tz, { x, z, hunger: typeof h === 'number' && h >= 0 && h <= 1 ? h : .4, bubble: null, bubbleTime: 0, hop: 0 })
    }
  }
  return world
}

export function readZoo(): World | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return restore(JSON.parse(raw))
  } catch { return null }
}

export function writeZoo(world: World) {
  try { localStorage.setItem(KEY, JSON.stringify(serialize(world))) } catch { /* ほぞん できなくても つづけられる。 */ }
}

export function clearZoo() {
  try { localStorage.removeItem(KEY) } catch { /* つづけられる。 */ }
}

export function readMusic(): boolean {
  try { return localStorage.getItem(MUSIC_KEY) !== 'off' } catch { return true }
}

export function writeMusic(on: boolean) {
  try { localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off') } catch { /* つづけられる。 */ }
}

/** はじめての ひとむけの おてほん（すこしだけ おいておく）。 */
export function starterZoo(): World {
  const world = createWorld(7)
  const put = (k: ObjectKind, x: number, z: number) => { if (checkObject(world, k, x, z).ok) addObject(world, k, x, z) }
  put('pond', 7, 5)
  put('tree', 2, 2); put('tree', 9, 2); put('bush', 3, 8); put('rock', 8, 9); put('flowers', 5, 3); put('flowers', 4, 9); put('palm', 10, 5); put('lamp', 6, 1)
  const add = (s: SpeciesId, x: number, z: number) => { if (checkAnimal(world, s, x, z).ok) addAnimal(world, s, x, z, { bubble: null, bubbleTime: 0, hop: 0 }) }
  add('elephant', 5, 6); add('zebra', 3, 4); add('penguin', 8, 6); add('lion', 9, 9)
  return world
}
