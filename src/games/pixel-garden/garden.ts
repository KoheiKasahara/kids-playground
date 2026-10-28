export const PLOT_COUNT = 6

export type PlotStage = 'soil' | 'sprout' | 'bud' | 'flower' | 'picked'
export type Garden = { round: number; plots: readonly PlotStage[] }

export const PLOT_ACTION: Record<PlotStage, string> = {
  soil: 'たねを まく',
  sprout: 'みずを あげる',
  bud: 'みずを あげる',
  flower: 'おはなを つむ',
  picked: 'つんだよ',
}

const NEXT: Record<PlotStage, PlotStage> = {
  soil: 'sprout', sprout: 'bud', bud: 'flower', flower: 'picked', picked: 'picked',
}

export function createGarden(round = 0): Garden {
  return { round, plots: Array.from({ length: PLOT_COUNT }, () => 'soil') }
}

export function tendPlot(garden: Garden, index: number): Garden {
  if (!Number.isInteger(index) || index < 0 || index >= garden.plots.length || garden.plots[index] === 'picked') return garden
  return { ...garden, plots: garden.plots.map((stage, i) => i === index ? NEXT[stage] : stage) }
}

export function pickedCount(garden: Garden): number {
  return garden.plots.filter((stage) => stage === 'picked').length
}

export function gardenHint(garden: Garden): string {
  if (garden.plots.includes('soil')) return 'つちを タッチで たねまき'
  if (garden.plots.some((stage) => stage === 'sprout' || stage === 'bud')) return 'めを タッチで おみず'
  return 'さいた おはなを タッチ！'
}
