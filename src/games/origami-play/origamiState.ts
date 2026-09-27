export type OrigamiState = { step: number; folding: boolean }

export const initialOrigamiState: OrigamiState = { step: 0, folding: false }

export type OrigamiAction =
  | { type: 'fold'; total: number }
  | { type: 'settle'; total: number }
  | { type: 'reset' }

/** Count a fold only when its animation finishes; rapid taps cannot skip a step. */
export function origamiReducer(state: OrigamiState, action: OrigamiAction): OrigamiState {
  switch (action.type) {
    case 'reset':
      return initialOrigamiState
    case 'fold':
      if (state.folding || state.step >= action.total) return state
      return { ...state, folding: true }
    case 'settle':
      if (!state.folding) return state
      return { step: Math.min(state.step + 1, action.total), folding: false }
  }
}
