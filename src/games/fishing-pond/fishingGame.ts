export const FISH = [
  { id: 'clownfish', name: 'くまのみ', color: '#ff934b', accent: '#fff9e5', shape: 'oval', pattern: 'stripes', x: 29, y: 42, waitMs: 1600 },
  { id: 'tang', name: 'なんようはぎ', color: '#5599ed', accent: '#ffe276', shape: 'oval', pattern: 'patch', x: 72, y: 42, waitMs: 2000 },
  { id: 'puffer', name: 'ふぐ', color: '#f1ce67', accent: '#fff5d5', shape: 'round', pattern: 'dots', x: 28, y: 64, waitMs: 1800 },
  { id: 'butterflyfish', name: 'ちょうちょううお', color: '#ffe26d', accent: '#385372', shape: 'diamond', pattern: 'stripes', x: 73, y: 64, waitMs: 2200 },
  { id: 'bream', name: 'たい', color: '#f28da3', accent: '#ffe0e6', shape: 'oval', pattern: 'dots', x: 30, y: 85, waitMs: 1400 },
  { id: 'sunfish', name: 'まんぼう', color: '#99c9d5', accent: '#e6f6ef', shape: 'tall', pattern: 'plain', x: 72, y: 85, waitMs: 2400 },
] as const

export type Fish = (typeof FISH)[number]
export type FishId = Fish['id']
export type FishingState = {
  phase: 'title' | 'choosing' | 'waiting' | 'bite' | 'caught' | 'complete'
  selectedId: FishId | null
  caught: readonly FishId[]
}
export type FishingAction =
  | { type: 'start' | 'back' | 'reel' | 'next' }
  | { type: 'choose' | 'bite'; fishId: FishId }

export function initialFishingState(): FishingState {
  return { phase: 'title', selectedId: null, caught: [] }
}

/** 操作を状態ごとに制限し、連打・古い合図・重複捕獲でも釣果を壊さない。 */
export function fishingReducer(state: FishingState, action: FishingAction): FishingState {
  switch (action.type) {
    case 'start':
      return { phase: 'choosing', selectedId: null, caught: [] }
    case 'back':
      return initialFishingState()
    case 'choose':
      if (state.phase !== 'choosing' || state.caught.includes(action.fishId) || !FISH.some((fish) => fish.id === action.fishId)) return state
      return { ...state, phase: 'waiting', selectedId: action.fishId }
    case 'bite':
      if (state.phase !== 'waiting' || state.selectedId !== action.fishId) return state
      return { ...state, phase: 'bite' }
    case 'reel': {
      if (state.phase !== 'bite' || state.selectedId === null || state.caught.includes(state.selectedId)) return state
      const caught = [...state.caught, state.selectedId]
      return { ...state, caught, phase: caught.length === FISH.length ? 'complete' : 'caught' }
    }
    case 'next':
      if (state.phase !== 'caught') return state
      return { ...state, phase: 'choosing', selectedId: null }
  }
}
