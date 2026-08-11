import type { QuizLevel } from '../../quiz-core/types'
import type { ColorMixProblem } from '../types'

const easy: ColorMixProblem[] = [
  { id: 'red-yellow', inputColors: ['#e94b3c', '#f6d743'], resultColor: '#ef8a2f', choices: ['#ef8a2f', '#5aa95a', '#8054a5', '#e94b3c'] },
  { id: 'yellow-blue', inputColors: ['#f6d743', '#3977c7'], resultColor: '#58a85c', choices: ['#58a85c', '#ef8a2f', '#8054a5', '#e95c86'] },
  // Keep each pair in a canonical order: blue + red is intentionally not another problem.
  { id: 'red-blue', inputColors: ['#e94b3c', '#3977c7'], resultColor: '#7950a1', choices: ['#7950a1', '#58a85c', '#ef8a2f', '#e7c73e'] },
  { id: 'red-white', inputColors: ['#e94b3c', '#fffdf7'], resultColor: '#ef91a0', choices: ['#ef91a0', '#a7d7ee', '#f6dc83', '#c8c8c8'] },
  { id: 'blue-white', inputColors: ['#3977c7', '#fffdf7'], resultColor: '#9bcdea', choices: ['#9bcdea', '#ef91a0', '#c9e1ae', '#b4a0d0'] },
  { id: 'yellow-white', inputColors: ['#f6d743', '#fffdf7'], resultColor: '#f7e69a', choices: ['#f7e69a', '#9bcdea', '#ef91a0', '#7950a1'] },
]

const normal: ColorMixProblem[] = [
  { id: 'white-black', inputColors: ['#fffdf7', '#263238'], resultColor: '#888b89', choices: ['#888b89', '#b9bbba', '#555b59', '#9bcdea'] },
  { id: 'black-red', inputColors: ['#263238', '#e94b3c'], resultColor: '#913f43', choices: ['#913f43', '#b34a4b', '#6b4148', '#7950a1'] },
  { id: 'white-green', inputColors: ['#fffdf7', '#58a85c'], resultColor: '#a9d49e', choices: ['#a9d49e', '#b9e0ae', '#95c58c', '#a6c7b5'] },
  { id: 'white-purple', inputColors: ['#fffdf7', '#7950a1'], resultColor: '#b7a2c9', choices: ['#b7a2c9', '#c6b3d7', '#a48eb9', '#b49fbd'] },
  { id: 'black-yellow', inputColors: ['#263238', '#f6d743'], resultColor: '#8b8438', choices: ['#8b8438', '#a39b3e', '#68672f', '#913f43'] },
  { id: 'black-blue', inputColors: ['#263238', '#3977c7'], resultColor: '#354f78', choices: ['#354f78', '#3f6292', '#303c62', '#7950a1'] },
  { id: 'white-orange', inputColors: ['#fffdf7', '#ef8a2f'], resultColor: '#f3bb83', choices: ['#f3bb83', '#f6c99e', '#eaa66e', '#efb49d'] },
  { id: 'black-orange', inputColors: ['#263238', '#ef8a2f'], resultColor: '#a95d31', choices: ['#a95d31', '#bd6836', '#8d522f', '#913f43'] },
]

const hard: ColorMixProblem[] = [
  { id: 'hard-warm-orange', inputColors: ['#e94b3c', '#f6d743'], resultColor: '#ef8a2f', choices: ['#ef8a2f', '#ff9838', '#dd793a', '#e89348'] },
  { id: 'hard-leaf-green', inputColors: ['#3977c7', '#f6d743'], resultColor: '#58a85c', choices: ['#58a85c', '#68b866', '#48974e', '#69a94e'] },
  { id: 'hard-plum', inputColors: ['#3977c7', '#e94b3c'], resultColor: '#7950a1', choices: ['#7950a1', '#895fb0', '#68458f', '#7a64b5'] },
  { id: 'hard-rose', inputColors: ['#e94b3c', '#fffdf7'], resultColor: '#ef91a0', choices: ['#ef91a0', '#ff9faf', '#dc7e91', '#eaa8b3'] },
  { id: 'hard-sky', inputColors: ['#3977c7', '#fffdf7'], resultColor: '#9bcdea', choices: ['#9bcdea', '#aadcf8', '#89bddb', '#a1bbd9'] },
  { id: 'hard-olive', inputColors: ['#263238', '#f6d743'], resultColor: '#8b8438', choices: ['#8b8438', '#9d953f', '#777530', '#947247'] },
  { id: 'hard-navy', inputColors: ['#263238', '#3977c7'], resultColor: '#354f78', choices: ['#354f78', '#45618a', '#294265', '#484c84'] },
  { id: 'hard-gray', inputColors: ['#fffdf7', '#263238'], resultColor: '#888b89', choices: ['#888b89', '#9c9f9d', '#737878', '#84989b'] },
]

export const colorMixProblemsByLevel: Record<QuizLevel, readonly ColorMixProblem[]> = { easy, normal, hard }

export function problemsForColorMix(level: QuizLevel): readonly ColorMixProblem[] {
  return colorMixProblemsByLevel[level]
}
