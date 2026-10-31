export const PLOT_COUNT = 6

export type PlotStage = 'soil' | 'sprout' | 'bud' | 'flower' | 'picked'
export type Garden = { round: number; plots: readonly PlotStage[]; rainUsed: boolean }
export type GardenTool = 'water' | 'sun'
export const FLOWER_NAMES = ['ももいろ チューリップ', 'きいろの おはな', 'むらさきの おはな', 'オレンジの チューリップ', 'ピンクの おはな', 'みずいろの おはな'] as const

export function flowerName(index: number, round: number): string {
  return FLOWER_NAMES[(index + round) % FLOWER_NAMES.length]
}

// 隣を順番に押すだけにならないよう、お願いは花壇を行き来する順にする。
export function requestedPlot(garden: Garden): number | undefined {
  return [2, 5, 0, 4, 1, 3].map((index) => (index + garden.round) % PLOT_COUNT)
    .find((index) => garden.plots[index] !== 'picked')
}

export const PLOT_ACTION: Record<PlotStage, string> = {
  soil: 'たねを まく',
  sprout: 'みずを あげる',
  bud: 'おひさまを あてる',
  flower: 'おはなを つむ',
  picked: 'つんだよ',
}

const NEXT: Record<PlotStage, PlotStage> = {
  soil: 'sprout', sprout: 'bud', bud: 'flower', flower: 'picked', picked: 'picked',
}

export function createGarden(round = 0): Garden {
  return { round, plots: Array.from({ length: PLOT_COUNT }, () => 'soil'), rainUsed: false }
}

export function rainOnGarden(garden: Garden): Garden {
  if (garden.rainUsed || !garden.plots.includes('sprout')) return garden
  return { ...garden, rainUsed: true, plots: garden.plots.map((stage) => stage === 'sprout' ? 'bud' : stage) }
}

export function tendPlot(garden: Garden, index: number, tool: GardenTool): Garden {
  if (!Number.isInteger(index) || index < 0 || index >= garden.plots.length || garden.plots[index] === 'picked') return garden
  const stage = garden.plots[index]
  if (stage === 'sprout' && tool !== 'water') return garden
  if (stage === 'bud' && tool !== 'sun') return garden
  if (stage === 'flower' && index !== requestedPlot(garden)) return garden
  return { ...garden, plots: garden.plots.map((stage, i) => i === index ? NEXT[stage] : stage) }
}

export function pickedCount(garden: Garden): number {
  return garden.plots.filter((stage) => stage === 'picked').length
}

export function gardenHint(garden: Garden): string {
  if (garden.plots.includes('soil')) return 'つちを タッチで たねまき'
  if (garden.plots.includes('sprout')) return '💧 おみずを えらんで めを タッチ'
  if (garden.plots.includes('bud')) return '☀ おひさまを えらんで つぼみを タッチ'
  return 'おねがいと おなじ おはなを つもう！'
}
