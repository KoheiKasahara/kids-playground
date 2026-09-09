import type { Point } from './stroke'

export const WIDTH = 400
export const HEIGHT = 600
export const BALL_RADIUS = 16
export const LINE_WIDTH = 12
export type Platform = { x: number; y: number; width: number; angle?: number; bounce?: boolean }
export type Stage = { name: string; hint: string; ball: Point; goal: Point; platforms: Platform[] }

// All stages share a portrait board. The wide cup leaves room for different paths.
export const STAGES: Stage[] = [
  { name: 'みぎへ コロコロ', hint: 'みぎさがりの さかを かこう', ball: { x: 100, y: 90 }, goal: { x: 285, y: 480 }, platforms: [] },
  { name: 'ひだりへ コロコロ', hint: 'ひだりさがりの さかを かこう', ball: { x: 300, y: 90 }, goal: { x: 115, y: 480 }, platforms: [] },
  { name: 'はしを かけよう', hint: 'みちの つづきを かこう', ball: { x: 65, y: 80 }, goal: { x: 290, y: 480 }, platforms: [{ x: 85, y: 180, width: 130, angle: .28 }] },
  { name: 'いわを こえて', hint: 'いわの よこに みちを かこう', ball: { x: 90, y: 80 }, goal: { x: 290, y: 480 }, platforms: [{ x: 160, y: 330, width: 100 }] },
  { name: 'ぴょんと はずむ', hint: 'ピンクの みちは はずむよ', ball: { x: 80, y: 80 }, goal: { x: 290, y: 480 }, platforms: [{ x: 100, y: 280, width: 150, angle: .28, bounce: true }] },
  { name: 'だんだん みち', hint: 'だんさを せんで つなごう', ball: { x: 70, y: 70 }, goal: { x: 295, y: 480 }, platforms: [{ x: 70, y: 155, width: 90, angle: .2 }, { x: 205, y: 330, width: 100, angle: .18 }] },
]
