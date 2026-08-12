import type { ColorMixProblem, SubtractionProblem, ThreeColorAdditionProblem, TwoColorAdditionProblem } from '../types'

// Every choice is a distinct, easy-to-name colour family. We intentionally avoid
// gray, black, brown and near-identical shade choices.
const RED = '#e94b3c'
const YELLOW = '#f6d743'
const BLUE = '#3977c7'
const ORANGE = '#ef8a2f'
const GREEN = '#58a85c'
const PURPLE = '#7950a1'
const CORAL = '#ef6c5b'
const GOLD = '#e9b83f'
const LIME = '#9acb3c'
const TEAL = '#319b9d'
const INDIGO = '#5366ad'
const MAGENTA = '#bc4d99'
const PEACH = '#f2a46d'
const WHITE = '#fffdf7'
const BLACK = '#2f3542'
const PINK = '#ed8eaa'
const LIGHT_BLUE = '#83c7e8'
const MINT = '#8fd1ac'
const LAVENDER = '#ad9bd1'
const NAVY = '#34436f'
const LIGHT_PURPLE = '#a884cf'
const AQUA = '#70c9c2'
const SPRING_GREEN = '#b7d65a'
const MAROON = '#873d4b'

export const twoColorAdditionProblems: readonly TwoColorAdditionProblem[] = [
  { id: 'red-yellow-orange', kind: 'two-color-addition', inputColors: [RED, YELLOW], resultColor: ORANGE, choices: [ORANGE, GREEN, PURPLE, BLUE] },
  { id: 'yellow-blue-green', kind: 'two-color-addition', inputColors: [YELLOW, BLUE], resultColor: GREEN, choices: [GREEN, ORANGE, PURPLE, RED] },
  { id: 'red-blue-purple', kind: 'two-color-addition', inputColors: [RED, BLUE], resultColor: PURPLE, choices: [PURPLE, ORANGE, GREEN, YELLOW] },
  { id: 'red-orange-coral', kind: 'two-color-addition', inputColors: [RED, ORANGE], resultColor: CORAL, choices: [CORAL, GREEN, PURPLE, BLUE] },
  { id: 'yellow-orange-gold', kind: 'two-color-addition', inputColors: [YELLOW, ORANGE], resultColor: GOLD, choices: [GOLD, RED, GREEN, PURPLE] },
  { id: 'yellow-green-lime', kind: 'two-color-addition', inputColors: [YELLOW, GREEN], resultColor: LIME, choices: [LIME, RED, BLUE, PURPLE] },
  { id: 'blue-green-teal', kind: 'two-color-addition', inputColors: [BLUE, GREEN], resultColor: TEAL, choices: [TEAL, RED, ORANGE, PURPLE] },
  { id: 'blue-purple-indigo', kind: 'two-color-addition', inputColors: [BLUE, PURPLE], resultColor: INDIGO, choices: [INDIGO, RED, YELLOW, GREEN] },
  { id: 'red-purple-magenta', kind: 'two-color-addition', inputColors: [RED, PURPLE], resultColor: MAGENTA, choices: [MAGENTA, YELLOW, GREEN, BLUE] },
  { id: 'red-white-pink', kind: 'two-color-addition', inputColors: [RED, WHITE], resultColor: PINK, choices: [PINK, GREEN, BLUE, ORANGE] },
  { id: 'blue-white-light-blue', kind: 'two-color-addition', inputColors: [BLUE, WHITE], resultColor: LIGHT_BLUE, choices: [LIGHT_BLUE, RED, YELLOW, PURPLE] },
  { id: 'green-white-mint', kind: 'two-color-addition', inputColors: [GREEN, WHITE], resultColor: MINT, choices: [MINT, RED, ORANGE, PURPLE] },
  { id: 'purple-white-lavender', kind: 'two-color-addition', inputColors: [PURPLE, WHITE], resultColor: LAVENDER, choices: [LAVENDER, RED, YELLOW, GREEN] },
  { id: 'blue-black-navy', kind: 'two-color-addition', inputColors: [BLUE, BLACK], resultColor: NAVY, choices: [NAVY, RED, YELLOW, GREEN] },
  { id: 'red-black-maroon', kind: 'two-color-addition', inputColors: [RED, BLACK], resultColor: MAROON, choices: [MAROON, YELLOW, GREEN, BLUE] },
  { id: 'orange-white-peach', kind: 'two-color-addition', inputColors: [ORANGE, WHITE], resultColor: PEACH, choices: [PEACH, GREEN, PURPLE, BLUE] },
]

// These are only reverse forms of the first three, familiar two-colour recipes.
// e.g. purple - blue = red; they are a game rule, not a colour-theory claim.
export const subtractionProblems: readonly SubtractionProblem[] = [
  { id: 'purple-minus-blue-red', kind: 'subtraction', recipeId: 'red-blue-purple', inputColors: [PURPLE, BLUE], resultColor: RED, choices: [RED, YELLOW, GREEN, ORANGE] },
  { id: 'purple-minus-red-blue', kind: 'subtraction', recipeId: 'red-blue-purple', inputColors: [PURPLE, RED], resultColor: BLUE, choices: [BLUE, YELLOW, GREEN, ORANGE] },
  { id: 'green-minus-blue-yellow', kind: 'subtraction', recipeId: 'yellow-blue-green', inputColors: [GREEN, BLUE], resultColor: YELLOW, choices: [YELLOW, RED, PURPLE, ORANGE] },
  { id: 'green-minus-yellow-blue', kind: 'subtraction', recipeId: 'yellow-blue-green', inputColors: [GREEN, YELLOW], resultColor: BLUE, choices: [BLUE, RED, PURPLE, ORANGE] },
  { id: 'orange-minus-yellow-red', kind: 'subtraction', recipeId: 'red-yellow-orange', inputColors: [ORANGE, YELLOW], resultColor: RED, choices: [RED, BLUE, GREEN, PURPLE] },
  { id: 'orange-minus-red-yellow', kind: 'subtraction', recipeId: 'red-yellow-orange', inputColors: [ORANGE, RED], resultColor: YELLOW, choices: [YELLOW, BLUE, GREEN, PURPLE] },
]

export const threeColorAdditionProblems: readonly ThreeColorAdditionProblem[] = [
  { id: 'red-yellow-white-peach', kind: 'three-color-addition', inputColors: [RED, YELLOW, WHITE], resultColor: PEACH, choices: [PEACH, GREEN, PURPLE, BLUE] },
  { id: 'red-blue-white-light-purple', kind: 'three-color-addition', inputColors: [RED, BLUE, WHITE], resultColor: LIGHT_PURPLE, choices: [LIGHT_PURPLE, ORANGE, GREEN, YELLOW] },
  { id: 'blue-green-white-aqua', kind: 'three-color-addition', inputColors: [BLUE, GREEN, WHITE], resultColor: AQUA, choices: [AQUA, RED, ORANGE, PURPLE] },
  { id: 'yellow-green-white-spring-green', kind: 'three-color-addition', inputColors: [YELLOW, GREEN, WHITE], resultColor: SPRING_GREEN, choices: [SPRING_GREEN, RED, BLUE, PURPLE] },
]

export const colorMixProblems: readonly ColorMixProblem[] = [
  ...twoColorAdditionProblems,
  ...subtractionProblems,
  ...threeColorAdditionProblems,
]
