export type QuizResultState = {
  correctCount: number
  totalCount: number
}

/** Validates the score state passed to a quiz result route. */
export function isQuizResultState(
  value: unknown,
  expectedTotalCount?: number,
): value is QuizResultState {
  if (typeof value !== 'object' || value === null) return false
  const state = value as Record<string, unknown>
  if (
    typeof state.correctCount !== 'number' ||
    !Number.isInteger(state.correctCount) ||
    typeof state.totalCount !== 'number' ||
    !Number.isInteger(state.totalCount) ||
    state.totalCount <= 0 ||
    state.correctCount < 0 ||
    state.correctCount > state.totalCount
  ) {
    return false
  }
  return expectedTotalCount === undefined || state.totalCount === expectedTotalCount
}
