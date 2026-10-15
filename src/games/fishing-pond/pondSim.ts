import { FISH, findFish, type FishId } from './fishingGame'

/**
 * 海の中を泳ぐ魚と釣り針の動き。座標は海の枠に対する %（x: 左→右、y: 上→下）。
 * 描画から切り離した純粋な状態更新なので、乱数を渡せば単体テストで再現できる。
 */

/** 水面の高さ（%）。 */
export const SURFACE_Y = 28
export const HOOK_BOUNDS = { minX: 8, maxX: 92, minY: 38, maxY: 88 } as const
export const SWIM_BOUNDS = { minX: 7, maxX: 93, minY: 40, maxY: 88 } as const
/** 魚の中心から口までのずれ（%）。 */
export const MOUTH_OFFSET = 7
/** 釣り針にこの距離まで近いと魚が気づく（判定は緩め）。 */
export const NOTICE_RADIUS = 24
/** 誰も寄ってこないまま、この秒数たつと近い魚が自分から寄ってくる。 */
export const LURE_AFTER_SEC = 5
/** 口が針にこの距離まで来たら、つんつん（あたり前）になる。 */
const NIBBLE_RADIUS = 3
const NIBBLE_SEC = 0.9
const HOOK_SPEED = 55
const FLEE_SEC = 1.6
const GIVE_UP_COOLDOWN_SEC = 1.5
const FLEE_COOLDOWN_SEC = 4
const ESCAPE_PAUSE_SEC = 2

export type SwimMode = 'swim' | 'approach' | 'nibble' | 'hooked' | 'flee'
export type SwimFish = {
  id: FishId
  x: number
  y: number
  baseY: number
  dir: 1 | -1
  speed: number
  wobble: number
  mode: SwimMode
  /** nibble/flee の残り時間などに使う秒数。 */
  timer: number
  /** また寄ってくるまでの待ち秒数。 */
  cooldown: number
  /** 寄せ餌などで呼ばれた魚は、少し離れても諦めない。 */
  lured: boolean
}
export type Point = { x: number; y: number }
export type Pond = {
  fish: SwimFish[]
  hook: Point
  target: Point
  /** 誰も寄ってこない時間[秒]。 */
  quietSec: number
  time: number
}
export type StepInput = {
  /** 針を下ろして魚を待っている間だけ true。 */
  active: boolean
  hookedId: FishId | null
  /** 釣り上げの進み具合 0〜1（かかった魚を水面へ引き上げる）。 */
  progress: number
}
export type Random = () => number

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function homeHook(): Point {
  return { x: 62, y: 52 }
}

export function createPond(caught: readonly FishId[], random: Random = Math.random): Pond {
  const swimmers = FISH.filter((fish) => !caught.includes(fish.id))
  return {
    fish: swimmers.map((fish, index) => {
      const lane = (index + 0.5) / swimmers.length
      const baseY = clamp(fish.depth + (random() - 0.5) * 8, SWIM_BOUNDS.minY + 2, SWIM_BOUNDS.maxY - 2)
      return {
        id: fish.id,
        x: SWIM_BOUNDS.minX + 6 + lane * (SWIM_BOUNDS.maxX - SWIM_BOUNDS.minX - 12),
        y: baseY,
        baseY,
        dir: random() < 0.5 ? -1 : 1,
        speed: fish.speed * (0.85 + random() * 0.3),
        wobble: random() * Math.PI * 2,
        mode: 'swim',
        timer: 0,
        cooldown: 1 + index * 0.4,
        lured: false,
      }
    }),
    hook: homeHook(),
    target: homeHook(),
    quietSec: 0,
    time: 0,
  }
}

export function setHookTarget(pond: Pond, point: Point): void {
  pond.target = {
    x: clamp(point.x, HOOK_BOUNDS.minX, HOOK_BOUNDS.maxX),
    y: clamp(point.y, HOOK_BOUNDS.minY, HOOK_BOUNDS.maxY),
  }
}

export function nudgeHookTarget(pond: Pond, dx: number, dy: number): void {
  setHookTarget(pond, { x: pond.target.x + dx, y: pond.target.y + dy })
}

function mouthOf(fish: SwimFish): Point {
  return { x: fish.x + fish.dir * MOUTH_OFFSET, y: fish.y }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function isBusy(pond: Pond): boolean {
  return pond.fish.some((fish) => fish.mode === 'approach' || fish.mode === 'nibble' || fish.mode === 'hooked')
}

/** 針にいちばん近い、寄ってこられる魚を呼ぶ。呼べたら true。 */
export function lureNearest(pond: Pond, maxDistance = Infinity): boolean {
  if (isBusy(pond)) return false
  const candidates = pond.fish
    .filter((fish) => fish.mode === 'swim')
    .map((fish) => ({ fish, d: distance(mouthOf(fish), pond.hook) }))
    .filter(({ d }) => d <= maxDistance)
    .sort((a, b) => a.d - b.d)
  const chosen = candidates[0]?.fish
  if (!chosen) return false
  chosen.mode = 'approach'
  chosen.lured = true
  chosen.cooldown = 0
  return true
}

/** 釣られた・逃げた結果を魚へ反映する。 */
export function syncPond(pond: Pond, caught: readonly FishId[], hookedId: FishId | null): void {
  pond.fish = pond.fish.filter((fish) => !caught.includes(fish.id))
  for (const fish of pond.fish) {
    if (fish.mode === 'hooked' && fish.id !== hookedId) {
      fish.mode = 'flee'
      fish.timer = FLEE_SEC
      fish.dir = fish.x < 50 ? -1 : 1
      fish.cooldown = FLEE_COOLDOWN_SEC
      pond.hook = homeHook()
      pond.target = homeHook()
      pond.quietSec = 0
      // 「にげちゃった」を見られるよう、ほかの魚もすぐには寄ってこない。
      for (const other of pond.fish) other.cooldown = Math.max(other.cooldown, ESCAPE_PAUSE_SEC)
    }
  }
}

/** 1フレーム進める。魚が食いついたらその魚のidを返す。 */
export function stepPond(pond: Pond, dt: number, input: StepInput, random: Random = Math.random): FishId | null {
  pond.time += dt
  let bite: FishId | null = null
  const hooked = input.hookedId ? pond.fish.find((fish) => fish.id === input.hookedId) : undefined

  if (hooked) {
    // 連打の進み具合に合わせて、針ごと水面へ引き上げる。暴れて左右にゆれる。
    const depth = clamp(hooked.baseY, HOOK_BOUNDS.minY, HOOK_BOUNDS.maxY)
    const pullY = depth + (SURFACE_Y + 9 - depth) * input.progress
    pond.hook.y += (pullY - pond.hook.y) * Math.min(1, dt * 8)
    pond.hook.x = clamp(pond.target.x + Math.sin(pond.time * 9) * 2.2, HOOK_BOUNDS.minX, HOOK_BOUNDS.maxX)
  } else {
    const dx = pond.target.x - pond.hook.x
    const dy = pond.target.y - pond.hook.y
    const d = Math.hypot(dx, dy)
    const move = Math.min(d, HOOK_SPEED * dt)
    if (d > 0) {
      pond.hook.x += (dx / d) * move
      pond.hook.y += (dy / d) * move
    }
  }

  for (const fish of pond.fish) {
    fish.cooldown = Math.max(0, fish.cooldown - dt)
    if (fish.mode === 'hooked') {
      if (fish.id !== input.hookedId) continue
      fish.x = pond.hook.x - fish.dir * MOUTH_OFFSET
      fish.y = pond.hook.y
      continue
    }
    if (fish.mode === 'flee') {
      fish.x = clamp(fish.x + fish.dir * fish.speed * 3 * dt, SWIM_BOUNDS.minX, SWIM_BOUNDS.maxX)
      fish.timer -= dt
      if (fish.timer <= 0) fish.mode = 'swim'
      continue
    }
    if (fish.mode === 'swim') {
      swim(fish, dt, pond.time, random)
      continue
    }
    if (!input.active) {
      fish.mode = 'swim'
      fish.lured = false
      continue
    }
    // approach / nibble: 口を針へ合わせる。
    const towardRight = pond.hook.x >= fish.x
    if (Math.abs(pond.hook.x - fish.x) > MOUTH_OFFSET * 1.6) fish.dir = towardRight ? 1 : -1
    const goal = { x: pond.hook.x - fish.dir * MOUTH_OFFSET, y: pond.hook.y }
    const gap = distance(mouthOf(fish), pond.hook)
    if (fish.mode === 'approach') {
      if (!fish.lured && gap > NOTICE_RADIUS * 1.6) {
        fish.mode = 'swim'
        fish.cooldown = GIVE_UP_COOLDOWN_SEC
        continue
      }
      const speed = fish.speed * 1.8 + 4
      const ddx = goal.x - fish.x
      const ddy = goal.y - fish.y
      const dd = Math.hypot(ddx, ddy)
      const move = Math.min(dd, speed * dt)
      if (dd > 0) {
        fish.x += (ddx / dd) * move
        fish.y += (ddy / dd) * move
      }
      if (distance(mouthOf(fish), pond.hook) <= NIBBLE_RADIUS) {
        fish.mode = 'nibble'
        fish.timer = NIBBLE_SEC
      }
    } else if (fish.mode === 'nibble') {
      if (gap > NIBBLE_RADIUS * 3) {
        // 針が大きく動いたら、もう一度追いかける。
        fish.mode = 'approach'
        continue
      }
      fish.x = goal.x + Math.sin(pond.time * 14) * 0.8
      fish.y = goal.y
      fish.timer -= dt
      if (fish.timer <= 0 && bite === null) {
        fish.mode = 'hooked'
        fish.baseY = fish.y
        fish.lured = false
        pond.target = { ...pond.hook }
        bite = fish.id
      }
    }
  }

  if (input.active && !bite) {
    if (isBusy(pond)) {
      pond.quietSec = 0
    } else {
      const noticed = pond.fish
        .filter((fish) => fish.mode === 'swim' && fish.cooldown <= 0)
        .map((fish) => ({ fish, d: distance(mouthOf(fish), pond.hook) }))
        .filter(({ d }) => d <= NOTICE_RADIUS)
        .sort((a, b) => a.d - b.d)[0]
      if (noticed) {
        noticed.fish.mode = 'approach'
        pond.quietSec = 0
      } else {
        pond.quietSec += dt
        if (pond.quietSec >= LURE_AFTER_SEC && lureNearest(pond)) pond.quietSec = 0
      }
    }
  } else {
    pond.quietSec = 0
  }
  return bite
}

function swim(fish: SwimFish, dt: number, time: number, random: Random): void {
  fish.x += fish.dir * fish.speed * dt
  if (fish.x <= SWIM_BOUNDS.minX || fish.x >= SWIM_BOUNDS.maxX || random() < dt * 0.06) {
    fish.x = clamp(fish.x, SWIM_BOUNDS.minX, SWIM_BOUNDS.maxX)
    fish.dir = fish.x <= SWIM_BOUNDS.minX ? 1 : fish.x >= SWIM_BOUNDS.maxX ? -1 : (fish.dir === 1 ? -1 : 1)
    const home = findFish(fish.id)?.depth ?? 60
    fish.baseY = clamp(home + (random() - 0.5) * 16, SWIM_BOUNDS.minY + 2, SWIM_BOUNDS.maxY - 2)
  }
  const wave = fish.baseY + Math.sin(time * 1.4 + fish.wobble) * 2.4
  fish.y += (wave - fish.y) * Math.min(1, dt * 2.5)
}
