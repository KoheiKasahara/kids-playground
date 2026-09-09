import type { RaceCarId } from './raceConfig'

export const SPECIAL_CHARGE_SECONDS = 12
export const SPECIAL_DURATION_SECONDS = 3
export const SPECIAL_SPEED_MULTIPLIER = 2.8
export type SpecialState = { charge: number; remaining: number }
export const SPECIALS: Record<RaceCarId, { label: string; icon: string; colors: [string, string]; shape: 'flame' | 'star' | 'cloud' | 'ring' }> = {
  sportsCar: { label: 'ファイアダッシュ', icon: '🔥', colors: ['#ff581c', '#ffdd39'], shape: 'flame' },
  car: { label: 'スターダッシュ', icon: '⭐', colors: ['#ffcf32', '#fff3ac'], shape: 'star' },
  suv: { label: 'どろんこダッシュ', icon: '🌪️', colors: ['#dd994d', '#ffe0a0'], shape: 'cloud' },
  policeCar: { label: 'パトロールダッシュ', icon: '🚨', colors: ['#ff4055', '#398dff'], shape: 'ring' },
  ambulance: { label: 'レスキューダッシュ', icon: '💗', colors: ['#ff719f', '#ffffff'], shape: 'ring' },
  taxi: { label: 'キラキラダッシュ', icon: '✨', colors: ['#ffd21f', '#72ffb2'], shape: 'star' },
  pickup: { label: 'パワーダッシュ', icon: '💪', colors: ['#ff963d', '#f5e0b4'], shape: 'cloud' },
  van: { label: 'にじいろダッシュ', icon: '🌈', colors: ['#ac78ff', '#64edff'], shape: 'ring' },
}

export function activateSpecial(state: SpecialState): boolean {
  if (state.charge < 1 || state.remaining > 0) return false
  state.charge = 0
  state.remaining = SPECIAL_DURATION_SECONDS
  return true
}

/** Called only for visible, running frames. Returns the active part of this frame. */
export function advanceSpecial(state: SpecialState, delta: number): number {
  const active = Math.min(state.remaining, delta)
  state.remaining = Math.max(0, state.remaining - delta)
  state.charge = Math.min(1, state.charge + (delta - active) / SPECIAL_CHARGE_SECONDS)
  return active
}
