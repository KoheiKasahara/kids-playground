// いきもの ごとの もけいを えらんで、ポーズごとの ドット絵（コマ）を つくる。
// おなじ コマは 1かいだけ つくって しまっておく。

import type { Species, SpriteKind } from './data'
import { frog, newt, toad } from './amphibians'
import { centipede, hornet, lizard, scorpion, spider } from './bugs'
import { cone, lionfish, octopus, starfish, stonefish, urchin } from './sea'
import { snake } from './snakes'
import type { Builder, ClipName, Pose } from './pose'
import { Model, rasterize, type Frame } from './raster'

export { SPRITE_H, SPRITE_W, type Frame } from './raster'

const BUILDERS: Record<SpriteKind, Builder> = {
  octopus, stonefish, lionfish, cone, starfish, urchin,
  frog, toad, newt,
  spider, hornet, centipede, scorpion, lizard,
  snake, serpent: snake, viper: snake, cobra: snake, 'sea-snake': snake,
}

/** いきものの ポーズを 1コマ ドット絵に する。 */
export function renderFrame(sp: Species, pose: Pose): Frame {
  const model = new Model()
  const look = BUILDERS[sp.sprite](model, pose, sp)
  return rasterize(model, sp.colors, look?.tint ?? undefined)
}

/** コマを しまっておく いきものの かず（スマホでも メモリを つかいすぎない ように）。 */
const KEEP = 12
const cache = new Map<string, Map<string, Frame>>()
/** ひまな ときに つくる コマの まちぎょうれつ と、ならべた いきもの。 */
const queue: (() => void)[] = []
const queued = new Set<string>()

/** clip の count コマの うち index ばんめ。 */
export function frameOf(sp: Species, clip: ClipName, index: number, count: number): Frame {
  let frames = cache.get(sp.id)
  if (frames) cache.delete(sp.id)
  else frames = new Map()
  // いちばん さいきん つかった いきものを うしろへ。ふるい ものから すてる。
  cache.set(sp.id, frames)
  if (cache.size > KEEP) {
    const oldest = cache.keys().next().value!
    cache.delete(oldest)
    queued.delete(oldest)
  }
  const key = `${clip}|${index}/${count}`
  let frame = frames.get(key)
  if (!frame) {
    frame = renderFrame(sp, { clip, t: count <= 1 ? 0 : clip === 'act' ? index / (count - 1) : index / count })
    frames.set(key, frame)
  }
  return frame
}

// ---------------- さきに つくっておく ----------------

let scheduled = false

function pump(deadline?: { timeRemaining: () => number }) {
  scheduled = false
  const start = performance.now()
  // まちきれずに よばれた ときも 1コマは すすめる。
  do queue.shift()?.()
  while (queue.length && (deadline ? deadline.timeRemaining() > 3 : performance.now() - start < 6))
  if (queue.length) schedule()
}

function schedule() {
  if (scheduled) return
  scheduled = true
  if (typeof requestIdleCallback === 'function') requestIdleCallback(pump, { timeout: 400 })
  else setTimeout(pump, 16)
}

/**
 * うごきはじめて すぐ カクッと しない ように、ひまな ときに コマを つくっておく。
 * いきづかい・あるく → とくいわざ の じゅん。
 */
export function prewarm(sp: Species, counts: Record<ClipName, number>) {
  if (queued.has(sp.id)) return
  queued.add(sp.id)
  for (const clip of ['idle', 'move', 'act'] as const) {
    for (let i = 0; i < counts[clip]; i++) queue.push(() => { if (queued.has(sp.id)) frameOf(sp, clip, i, counts[clip]) })
  }
  schedule()
}
