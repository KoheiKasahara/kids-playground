/**
 * 魚の図鑑データ。
 * - pulls: 釣り上げるまでのおおよその連打回数（少し減っても釣れるよう緩めにしている）
 * - speed: ふだん泳ぐ速さ（海の幅に対する %/秒）
 * - depth: 好んで泳ぐ深さ（海の高さに対する %）
 */
export const FISH = [
  { id: 'clownfish', name: 'くまのみ', pulls: 6, speed: 7, depth: 48, size: 0.9 },
  { id: 'tang', name: 'なんようはぎ', pulls: 7, speed: 9, depth: 56, size: 1 },
  { id: 'puffer', name: 'ふぐ', pulls: 6, speed: 5, depth: 66, size: 0.95 },
  { id: 'butterflyfish', name: 'ちょうちょううお', pulls: 7, speed: 8, depth: 74, size: 0.95 },
  { id: 'bream', name: 'たい', pulls: 9, speed: 10, depth: 62, size: 1.1 },
  { id: 'sunfish', name: 'まんぼう', pulls: 11, speed: 4, depth: 80, size: 1.25 },
] as const

export type Fish = (typeof FISH)[number]
export type FishId = Fish['id']

export type FishingPhase = 'title' | 'fishing' | 'hooked' | 'caught' | 'complete'
export type FishingState = {
  phase: FishingPhase
  /** かかった魚（hooked/caught/complete で有効）。 */
  hookedId: FishId | null
  /** 釣り上げの進み具合 0〜1。 */
  progress: number
  /** 最後に巻いてからの時間[ms]。長く巻かないと逃げる。 */
  idleMs: number
  /** 直前に魚が逃げたか（はげましの文言用）。 */
  escaped: boolean
  caught: readonly FishId[]
}
export type FishingAction =
  | { type: 'start' | 'back' | 'reel' | 'next' }
  | { type: 'bite'; fishId: FishId }
  | { type: 'tick'; ms: number }

/** 巻かずにいてもゆっくりしか戻らない。 */
export const PROGRESS_DECAY_PER_SEC = 0.06
/** 巻くのをやめてから戻り始めるまでの猶予[ms]。 */
export const DECAY_GRACE_MS = 900
/** これだけ巻かないと魚が逃げる[ms]。幼児が迷っても十分待てる長さ。 */
export const ESCAPE_MS = 8000

export function findFish(id: FishId | null): Fish | undefined {
  return FISH.find((fish) => fish.id === id)
}

export function initialFishingState(): FishingState {
  return { phase: 'title', hookedId: null, progress: 0, idleMs: 0, escaped: false, caught: [] }
}

/** 1回巻いたときに進む量。最後の1〜2回は省けるよう、必要回数より少し多めに進める。 */
export function reelStep(fish: Fish): number {
  return 1.15 / fish.pulls
}

/** 操作を状態ごとに制限し、連打・古い合図・重複捕獲でも釣果を壊さない。 */
export function fishingReducer(state: FishingState, action: FishingAction): FishingState {
  switch (action.type) {
    case 'start':
      return { ...initialFishingState(), phase: 'fishing' }
    case 'back':
      return initialFishingState()
    case 'bite':
      if (state.phase !== 'fishing' || state.caught.includes(action.fishId) || !findFish(action.fishId)) return state
      return { ...state, phase: 'hooked', hookedId: action.fishId, progress: 0, idleMs: 0, escaped: false }
    case 'reel': {
      const fish = findFish(state.hookedId)
      if (state.phase !== 'hooked' || !fish) return state
      const progress = Math.min(1, state.progress + reelStep(fish))
      if (progress < 1) return { ...state, progress, idleMs: 0 }
      const caught = [...state.caught, fish.id]
      return { ...state, progress: 1, idleMs: 0, caught, phase: caught.length === FISH.length ? 'complete' : 'caught' }
    }
    case 'tick': {
      if (state.phase !== 'hooked' || action.ms <= 0) return state
      const idleMs = state.idleMs + action.ms
      if (idleMs >= ESCAPE_MS) return { ...state, phase: 'fishing', hookedId: null, progress: 0, idleMs: 0, escaped: true }
      const decayMs = Math.max(0, idleMs - Math.max(DECAY_GRACE_MS, state.idleMs))
      const progress = Math.max(0, state.progress - (decayMs / 1000) * PROGRESS_DECAY_PER_SEC)
      return { ...state, idleMs, progress }
    }
    case 'next':
      if (state.phase !== 'caught') return state
      return { ...state, phase: 'fishing', hookedId: null, progress: 0, idleMs: 0 }
  }
}
