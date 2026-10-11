export type Side = 'left' | 'right'
export type Mode = 'solo' | 'duo'

export const WRESTLERS = [
  { name: 'おもち', color: '#fff9e9', accent: '#e67767', shape: 'mochi' },
  { name: 'そら', color: '#b9e2e0', accent: '#458f94', shape: 'cloud' },
  { name: 'まめ', color: '#cbdc9b', accent: '#718740', shape: 'bean' },
  { name: 'くま', color: '#e6b680', accent: '#98673f', shape: 'bear' },
] as const

export type SumoState = {
  position: number
  taps: Record<Side, number>
  lastTap: Record<Side, number>
  winner: Side | null
}

export const RING_EDGE = 9
export const TAP_COOLDOWN_MS = 110
export const COMPUTER_INTERVAL_MS = 1100

export function createSumoState(): SumoState {
  return {
    position: 0,
    taps: { left: 0, right: 0 },
    lastTap: { left: -Infinity, right: -Infinity },
    winner: null,
  }
}

/** A deliberate tap moves the paper pair. Debounce each side separately for fair multitouch. */
export function tapSumo(state: SumoState, side: Side, now: number): SumoState {
  if (state.winner || now - state.lastTap[side] < TAP_COOLDOWN_MS) return state
  const position = state.position + (side === 'left' ? 1 : -1)
  return {
    position,
    taps: { ...state.taps, [side]: state.taps[side] + 1 },
    lastTap: { ...state.lastTap, [side]: now },
    winner: position >= RING_EDGE ? 'left' : position <= -RING_EDGE ? 'right' : null,
  }
}
