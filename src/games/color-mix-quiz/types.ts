/** A paint colour is always authored explicitly; it is never calculated from its inputs. */
type ColorMixProblemBase = {
  id: string
  resultColor: string
  /** Four visible paint swatches, including resultColor exactly once. */
  choices: readonly [string, string, string, string]
}

/** Two paint blobs are added together. */
export type TwoColorAdditionProblem = ColorMixProblemBase & {
  kind: 'two-color-addition'
  inputColors: readonly [string, string]
}

/** One ingredient is removed using the game's reverse-recipe rule. */
export type SubtractionProblem = ColorMixProblemBase & {
  kind: 'subtraction'
  /** The first colour is the finished paint; the second is the removed ingredient. */
  inputColors: readonly [string, string]
  recipeId: string
}

/** A small bonus set of three bright paint additions. */
export type ThreeColorAdditionProblem = ColorMixProblemBase & {
  kind: 'three-color-addition'
  inputColors: readonly [string, string, string]
}

export type ColorMixProblem = TwoColorAdditionProblem | SubtractionProblem | ThreeColorAdditionProblem

export type ColorMixQuestion = {
  problem: ColorMixProblem
  choices: string[]
}
