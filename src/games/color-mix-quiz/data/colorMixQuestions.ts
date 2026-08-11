import { LEVEL_RANK } from '../types'
import type { ColorMixProblem, QuizLevel } from '../types'

// Base paints. Every problem's inputColors is either one of these or a SECONDARY_* below
// (which is itself defined as the resultColor of the problem that produces it).
const BASE_RED = '#e94b3c'
const BASE_YELLOW = '#f6d743'
const BASE_BLUE = '#3977c7'
const BASE_WHITE = '#fffdf7'
const BASE_BLACK = '#263238'

// Secondary paints. Their hex MUST equal the resultColor of the problem that mixes them
// (red-yellow, yellow-blue, red-blue, red-white, blue-white below) — see validateColorMixProblems.
const SECONDARY_ORANGE = '#ef8a2f'
const SECONDARY_GREEN = '#58a85c'
const SECONDARY_PURPLE = '#7950a1'
const SECONDARY_PINK = '#ef91a0'
const SECONDARY_LIGHT_BLUE = '#9bcdea'

// Mixing model: each listed input paint contributes one equal part. A secondary paint is never
// decomposed into its primaries, so {green, red} and {red, blue, yellow} are different questions
// and may have different (both plausible) results. A three-colour mix carries proportionally more
// pigment relative to white than the equivalent two-colour mix, so e.g. red+yellow+white comes out
// as a deeper peach than orange+white. Every result is hand-authored to look like real poster paint,
// never computed from the inputs. See docs/COLOR_MIX_QUIZ_DESIGN.md for the full rationale.
const colorMixProblems: readonly ColorMixProblem[] = [
  // --- easy: 12 ---------------------------------------------------------
  { id: 'red-yellow', level: 'easy', inputColors: [BASE_RED, BASE_YELLOW], resultColor: SECONDARY_ORANGE, choices: [SECONDARY_ORANGE, SECONDARY_GREEN, SECONDARY_PURPLE, BASE_BLUE] },
  { id: 'yellow-blue', level: 'easy', inputColors: [BASE_YELLOW, BASE_BLUE], resultColor: SECONDARY_GREEN, choices: [SECONDARY_GREEN, SECONDARY_ORANGE, SECONDARY_PURPLE, SECONDARY_PINK] },
  { id: 'red-blue', level: 'easy', inputColors: [BASE_RED, BASE_BLUE], resultColor: SECONDARY_PURPLE, choices: [SECONDARY_PURPLE, SECONDARY_GREEN, SECONDARY_ORANGE, BASE_YELLOW] },
  { id: 'red-white', level: 'easy', inputColors: [BASE_RED, BASE_WHITE], resultColor: SECONDARY_PINK, choices: [SECONDARY_PINK, SECONDARY_LIGHT_BLUE, '#f7e69a', '#888b89'] },
  { id: 'blue-white', level: 'easy', inputColors: [BASE_BLUE, BASE_WHITE], resultColor: SECONDARY_LIGHT_BLUE, choices: [SECONDARY_LIGHT_BLUE, SECONDARY_PINK, SECONDARY_PURPLE, '#913f43'] },
  { id: 'yellow-white', level: 'easy', inputColors: [BASE_YELLOW, BASE_WHITE], resultColor: '#f7e69a', choices: ['#f7e69a', SECONDARY_LIGHT_BLUE, SECONDARY_PINK, SECONDARY_PURPLE] },
  { id: 'white-black', level: 'easy', inputColors: [BASE_WHITE, BASE_BLACK], resultColor: '#888b89', choices: ['#888b89', BASE_RED, SECONDARY_PINK, SECONDARY_PURPLE] },
  { id: 'green-white', level: 'easy', inputColors: [SECONDARY_GREEN, BASE_WHITE], resultColor: '#a9d49e', choices: ['#a9d49e', SECONDARY_PURPLE, SECONDARY_PINK, BASE_RED] },
  { id: 'orange-white', level: 'easy', inputColors: [SECONDARY_ORANGE, BASE_WHITE], resultColor: '#f3bb83', choices: ['#f3bb83', SECONDARY_PURPLE, '#2f9a91', BASE_RED] },
  { id: 'purple-white', level: 'easy', inputColors: [SECONDARY_PURPLE, BASE_WHITE], resultColor: '#b7a2c9', choices: ['#b7a2c9', SECONDARY_GREEN, SECONDARY_ORANGE, BASE_BLACK] },
  { id: 'yellow-green', level: 'easy', inputColors: [BASE_YELLOW, SECONDARY_GREEN], resultColor: '#a8c93f', choices: ['#a8c93f', SECONDARY_PURPLE, SECONDARY_ORANGE, BASE_BLUE] },
  { id: 'blue-green', level: 'easy', inputColors: [BASE_BLUE, SECONDARY_GREEN], resultColor: '#2f9a91', choices: ['#2f9a91', BASE_RED, SECONDARY_ORANGE, SECONDARY_PURPLE] },

  // --- normal: +10 (22 total) --------------------------------------------
  { id: 'red-black', level: 'normal', inputColors: [BASE_RED, BASE_BLACK], resultColor: '#913f43', choices: ['#913f43', BASE_RED, '#a95d31', SECONDARY_PURPLE] },
  { id: 'blue-black', level: 'normal', inputColors: [BASE_BLUE, BASE_BLACK], resultColor: '#354f78', choices: ['#354f78', BASE_BLUE, SECONDARY_PURPLE, '#37613c'] },
  { id: 'yellow-black', level: 'normal', inputColors: [BASE_YELLOW, BASE_BLACK], resultColor: '#8b8438', choices: ['#8b8438', BASE_YELLOW, '#37613c', '#a95d31'] },
  { id: 'green-black', level: 'normal', inputColors: [SECONDARY_GREEN, BASE_BLACK], resultColor: '#37613c', choices: ['#37613c', SECONDARY_GREEN, '#8b8438', '#354f78'] },
  { id: 'orange-black', level: 'normal', inputColors: [SECONDARY_ORANGE, BASE_BLACK], resultColor: '#a95d31', choices: ['#a95d31', SECONDARY_ORANGE, '#913f43', '#8b8438'] },
  { id: 'purple-black', level: 'normal', inputColors: [SECONDARY_PURPLE, BASE_BLACK], resultColor: '#4b3560', choices: ['#4b3560', SECONDARY_PINK, '#354f78', '#913f43'] },
  { id: 'red-orange', level: 'normal', inputColors: [BASE_RED, SECONDARY_ORANGE], resultColor: '#ec6a33', choices: ['#ec6a33', SECONDARY_PURPLE, BASE_YELLOW, '#2f9a91'] },
  { id: 'green-red', level: 'normal', inputColors: [SECONDARY_GREEN, BASE_RED], resultColor: '#8f5a3c', choices: ['#8f5a3c', SECONDARY_LIGHT_BLUE, SECONDARY_PURPLE, '#f7e69a'] },
  { id: 'orange-blue', level: 'normal', inputColors: [SECONDARY_ORANGE, BASE_BLUE], resultColor: '#7d6a4f', choices: ['#7d6a4f', SECONDARY_PINK, '#a8c93f', SECONDARY_LIGHT_BLUE] },
  { id: 'purple-yellow', level: 'normal', inputColors: [SECONDARY_PURPLE, BASE_YELLOW], resultColor: '#8a7b4a', choices: ['#8a7b4a', SECONDARY_LIGHT_BLUE, SECONDARY_PINK, '#2f9a91'] },

  // --- hard: +10 (32 total). 4 complex two-colour mixes, then 6 three-colour mixes. ------
  // A "near" distractor (ΔE within [HARD_NEAR_MIN_DELTA_E, HARD_NEAR_MAX_DELTA_E]) is deliberately
  // authored for just these two problems, both two-colour — never on a three-colour problem.
  { id: 'purple-green', level: 'hard', inputColors: [SECONDARY_PURPLE, SECONDARY_GREEN], resultColor: '#5b6b4b', choices: ['#5b6b4b', '#6e8e58', SECONDARY_PURPLE, '#a95d31'] },
  { id: 'orange-purple', level: 'hard', inputColors: [SECONDARY_ORANGE, SECONDARY_PURPLE], resultColor: '#a05a4a', choices: ['#a05a4a', '#b67b55', '#4b3560', '#7f9a4e'] },
  { id: 'green-orange', level: 'hard', inputColors: [SECONDARY_GREEN, SECONDARY_ORANGE], resultColor: '#7f9a4e', choices: ['#7f9a4e', SECONDARY_PURPLE, SECONDARY_LIGHT_BLUE, SECONDARY_PINK] },
  { id: 'pink-green', level: 'hard', inputColors: [SECONDARY_PINK, SECONDARY_GREEN], resultColor: '#b79a8f', choices: ['#b79a8f', BASE_BLUE, '#354f78', BASE_YELLOW] },
  { id: 'red-blue-yellow', level: 'hard', inputColors: [BASE_RED, BASE_BLUE, BASE_YELLOW], resultColor: '#8c6239', choices: ['#8c6239', '#2f9a91', SECONDARY_PINK, '#a8c93f'] },
  { id: 'red-yellow-white', level: 'hard', inputColors: [BASE_RED, BASE_YELLOW, BASE_WHITE], resultColor: '#f0a463', choices: ['#f0a463', SECONDARY_PURPLE, '#354f78', '#2f9a91'] },
  { id: 'blue-yellow-white', level: 'hard', inputColors: [BASE_BLUE, BASE_YELLOW, BASE_WHITE], resultColor: '#86c68a', choices: ['#86c68a', BASE_RED, SECONDARY_PURPLE, '#a95d31'] },
  { id: 'red-blue-white', level: 'hard', inputColors: [BASE_RED, BASE_BLUE, BASE_WHITE], resultColor: '#a186c0', choices: ['#a186c0', '#354f78', SECONDARY_ORANGE, '#8a7b4a'] },
  { id: 'red-green-white', level: 'hard', inputColors: [BASE_RED, SECONDARY_GREEN, BASE_WHITE], resultColor: '#c2a184', choices: ['#c2a184', SECONDARY_PURPLE, '#354f78', '#2f9a91'] },
  { id: 'red-white-black', level: 'hard', inputColors: [BASE_RED, BASE_WHITE, BASE_BLACK], resultColor: '#b58f8c', choices: ['#b58f8c', '#2f9a91', BASE_BLUE, '#a8c93f'] },
]

export { colorMixProblems }

export function problemsForColorMix(level: QuizLevel): readonly ColorMixProblem[] {
  return colorMixProblems.filter((problem) => LEVEL_RANK[problem.level] <= LEVEL_RANK[level])
}
