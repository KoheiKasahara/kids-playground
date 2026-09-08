export const ANIMALS = [
  { id: 'dog', name: 'いぬ', emoji: '🐶', color: '#edb875', dark: '#a76a42', cheek: '#f49b8f' },
  { id: 'rabbit', name: 'うさぎ', emoji: '🐰', color: '#fff3e6', dark: '#e3b1a5', cheek: '#f4a0af' },
  { id: 'bear', name: 'くま', emoji: '🐻', color: '#c99166', dark: '#875c43', cheek: '#ed9f8b' },
] as const
export type Animal = typeof ANIMALS[number]
export type Point = { x: number; y: number }

export const PATCHES: readonly Point[] = [
  { x: 129, y: 149 }, { x: 200, y: 123 }, { x: 271, y: 149 },
  { x: 133, y: 213 }, { x: 200, y: 218 }, { x: 267, y: 213 },
  { x: 139, y: 279 }, { x: 200, y: 295 }, { x: 261, y: 279 },
]

export const STEPS = [
  { name: 'せっけん', emoji: '🧼', instruction: 'どろんこを ごしごし！', next: 'シャワーで ながそう！' },
  { name: 'シャワー', emoji: '🚿', instruction: 'あわを じゃぶじゃぶ！', next: 'タオルで ふこう！' },
  { name: 'タオル', emoji: '🧺', instruction: 'しずくを ふきふき！', next: 'ぴかぴか！' },
] as const

export type BathState = { step: number; cleaned: readonly number[] }
export const initialBath: BathState = { step: 0, cleaned: [] }
export type BathAction = { type: 'stroke'; from: Point; to: Point } | { type: 'dab' } | { type: 'next' }

/** Segment distance keeps quick swipes effective even when pointermove events are sparse. */
export function touchesPatch(patch: Point, from: Point, to: Point): boolean {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((patch.x - from.x) * dx + (patch.y - from.y) * dy) / lengthSquared))
  return Math.hypot(patch.x - from.x - t * dx, patch.y - from.y - t * dy) <= 40
}

export function bathReducer(state: BathState, action: BathAction): BathState {
  if (action.type === 'next') {
    return state.cleaned.length === PATCHES.length && state.step < STEPS.length - 1
      ? { step: state.step + 1, cleaned: [] } : state
  }
  if (state.cleaned.length === PATCHES.length) return state
  const hits = action.type === 'dab'
    ? [PATCHES.findIndex((_, index) => !state.cleaned.includes(index))]
    : PATCHES.flatMap((patch, index) => touchesPatch(patch, action.from, action.to) ? [index] : [])
  const added = hits.filter((index) => !state.cleaned.includes(index))
  return added.length ? { ...state, cleaned: [...state.cleaned, ...added] } : state
}
