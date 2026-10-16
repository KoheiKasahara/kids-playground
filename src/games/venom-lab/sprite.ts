// いきもの ごとの もけいを えらんで、ポーズごとの ドット絵（コマ）を つくる。
// おなじ コマは 1かいだけ つくって しまっておく。

import type { Species, SpriteKind } from './data'
import { frog, newt, toad } from './amphibians'
import { centipede, hornet, lizard, scorpion, spider } from './bugs'
import { cone, lionfish, octopus, starfish, stonefish, urchin } from './sea'
import { snake } from './snakes'
import type { Builder, ClipName, Pose } from './pose'
import { DETAIL, Model, rasterize, type Frame } from './raster'

export { DETAIL, rgbaOf, SPRITE_H, SPRITE_W, type Frame } from './raster'

const BUILDERS: Record<SpriteKind, Builder> = {
  octopus, stonefish, lionfish, cone, starfish, urchin,
  frog, toad, newt,
  spider, hornet, centipede, scorpion, lizard,
  snake, serpent: snake, viper: snake, cobra: snake, 'sea-snake': snake,
}

/** いきものの ポーズを 1コマ ドット絵に する。scale は こまかさ（ちいさな カードは 1）。 */
export function renderFrame(sp: Species, pose: Pose, scale = DETAIL): Frame {
  const model = new Model()
  const look = BUILDERS[sp.sprite](model, pose, sp)
  return rasterize(model, sp.colors, look?.tint ?? undefined, scale)
}

/** コマを しまっておく いきものの かず（スマホでも メモリを つかいすぎない ように）。 */
const KEEP = 12
const cache = new Map<string, Map<string, Frame>>()
/** ひまな ときに つくる コマの まちぎょうれつ と、ならべた いきもの。 */
const queue: (() => void)[] = []
const queued = new Set<string>()

function framesOf(id: string) {
  let frames = cache.get(id)
  if (frames) cache.delete(id)
  else frames = new Map()
  // いちばん さいきん つかった いきものを うしろへ。ふるい ものから すてる。
  cache.set(id, frames)
  if (cache.size > KEEP) {
    const oldest = cache.keys().next().value!
    cache.delete(oldest)
    queued.delete(oldest)
  }
  return frames
}

/**
 * この がめんで つかう こまかさ。がめんの てんが あらい（1ばい）なら 3ばいで かいて そのまま、
 * こまかい がめんなら 2ばいで かいて 整数ばいに ひろげる。どちらも おなじくらいの おおきさに なる。
 */
export function detailScale() {
  return typeof window !== 'undefined' && (window.devicePixelRatio || 1) < 1.5 ? 3 : DETAIL
}

const poseAt = (clip: ClipName, index: number, count: number) => ({ clip, t: count <= 1 ? 0 : clip === 'act' || clip === 'habit' ? index / (count - 1) : index / count })

/** clip の count コマの うち index ばんめ。 */
export function frameOf(sp: Species, clip: ClipName, index: number, count: number, scale = DETAIL): Frame {
  const frames = framesOf(sp.id)
  const key = `${clip}|${index}/${count}@${scale}`
  let frame = frames.get(key)
  if (!frame) {
    frame = renderFrame(sp, poseAt(clip, index, count), scale)
    frames.set(key, frame)
  }
  return frame
}

let budgetEnd = Infinity

/** アニメーションの 1フレームの なかで、あたらしい コマを つくって よい じかんの おわり。 */
export function setRenderBudget(until: number) {
  budgetEnd = until
}

/**
 * できている コマ。まだ なくて、この フレームの じかんが のこって いなければ null（つぎに まわす）。
 * うごきだしで まとめて つくって カクッと しない ように する。
 */
export function readyFrame(sp: Species, clip: ClipName, index: number, count: number, scale = DETAIL): Frame | null {
  const frame = framesOf(sp.id).get(`${clip}|${index}/${count}@${scale}`)
  if (frame) return frame
  if (performance.now() > budgetEnd) {
    queue.unshift(() => { frameOf(sp, clip, index, count, scale) })
    schedule()
    return null
  }
  return frameOf(sp, clip, index, count, scale)
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
 * いきづかい・あるく → とくいわざ → くらしの ようす の じゅん。
 */
export function prewarm(sp: Species, counts: Record<ClipName, number>, scale = DETAIL) {
  if (queued.has(sp.id)) return
  queued.add(sp.id)
  for (const clip of ['idle', 'move', 'act', 'habit'] as const) {
    for (let i = 0; i < counts[clip]; i++) queue.push(() => { if (queued.has(sp.id)) frameOf(sp, clip, i, counts[clip], scale) })
  }
  schedule()
}
