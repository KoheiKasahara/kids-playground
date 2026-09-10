import type { Point } from './stroke'

export const WIDTH = 400
export const HEIGHT = 600
export const BALL_RADIUS = 16
export const LINE_WIDTH = 12
export const STAR_RADIUS = 13
export const WARP_RADIUS = 30
export type Platform = { x: number; y: number; width: number; height?: number; angle?: number; bounce?: boolean }
// Wind pushes the ball while it is inside the box. `push` is measured in gravity, so 1 cancels falling.
export type Wind = { x: number; y: number; width: number; height: number; push: Point }
export type Warp = { from: Point; to: Point }
export type Stage = { name: string; hint: string; ball: Point; goal: Point; platforms: Platform[]; stars?: Point[]; winds?: Wind[]; warp?: Warp }

// All stages share a portrait board. The wide cup leaves room for different paths.
// Stars are a bonus on the way, never a lock on the goal: missing one still finishes the stage.
export const STAGES: Stage[] = [
  {
    name: 'みぎへ コロコロ', hint: 'みぎさがりの さかを かこう',
    ball: { x: 100, y: 90 }, goal: { x: 285, y: 480 }, platforms: [],
    stars: [{ x: 208, y: 360 }],
  },
  {
    name: 'ひだりへ コロコロ', hint: 'ひだりさがりの さかを かこう',
    ball: { x: 300, y: 90 }, goal: { x: 115, y: 480 }, platforms: [],
    stars: [{ x: 192, y: 360 }],
  },
  {
    name: 'はしを かけよう', hint: 'みちの つづきを かこう',
    ball: { x: 65, y: 80 }, goal: { x: 290, y: 480 }, platforms: [{ x: 85, y: 180, width: 130, angle: .28 }],
    stars: [{ x: 218, y: 316 }],
  },
  {
    name: 'いわを こえて', hint: 'いわの うえを とおろう',
    ball: { x: 90, y: 80 }, goal: { x: 290, y: 480 }, platforms: [{ x: 165, y: 330, width: 110, height: 62 }],
    stars: [{ x: 172, y: 196 }],
  },
  {
    name: 'ぴょんと はずむ', hint: 'ピンクの みちは はずむよ',
    ball: { x: 80, y: 80 }, goal: { x: 290, y: 480 }, platforms: [{ x: 100, y: 280, width: 150, angle: .28, bounce: true }],
    stars: [{ x: 270, y: 330 }],
  },
  {
    name: 'だんだん みち', hint: 'だんさを せんで つなごう',
    ball: { x: 70, y: 70 }, goal: { x: 295, y: 480 }, platforms: [{ x: 70, y: 155, width: 90, angle: .2 }, { x: 205, y: 330, width: 100, angle: .18 }],
    stars: [{ x: 150, y: 232 }, { x: 285, y: 400 }],
  },
  {
    name: 'ワープで ひとっとび', hint: 'あおい わっかに ボールを おとそう',
    ball: { x: 60, y: 80 }, goal: { x: 280, y: 480 },
    platforms: [{ x: 200, y: 430, width: 300, angle: Math.PI / 2 }, { x: 155, y: 500, width: 150, angle: .16 }],
    warp: { from: { x: 175, y: 477 }, to: { x: 280, y: 235 } },
    stars: [{ x: 280, y: 330 }],
  },
  {
    name: 'かぜに のって', hint: 'みずいろの かぜで ふわりと とぼう',
    ball: { x: 70, y: 80 }, goal: { x: 300, y: 480 }, platforms: [],
    winds: [{ x: 210, y: 340, width: 260, height: 220, push: { x: .3, y: -.5 } }],
    stars: [{ x: 210, y: 300 }, { x: 285, y: 400 }],
  },
  {
    name: 'すきまを ねらえ', hint: 'ゆかの すきまへ おとそう',
    ball: { x: 70, y: 80 }, goal: { x: 300, y: 480 },
    platforms: [{ x: 50, y: 300, width: 140, height: 22 }, { x: 315, y: 300, width: 190, height: 22 }, { x: 170, y: 415, width: 200, angle: .2 }],
    stars: [{ x: 160, y: 345 }, { x: 215, y: 385 }, { x: 300, y: 455 }],
  },
  {
    name: 'さいごの ぼうけん', hint: 'かぜに のって ワープまで すすもう',
    ball: { x: 70, y: 70 }, goal: { x: 320, y: 480 },
    platforms: [{ x: 250, y: 350, width: 260, angle: Math.PI / 2 }, { x: 180, y: 495, width: 150, angle: -.14 }],
    winds: [{ x: 180, y: 330, width: 140, height: 200, push: { x: -.18, y: -.55 } }],
    warp: { from: { x: 112, y: 478 }, to: { x: 320, y: 250 } },
    stars: [{ x: 175, y: 300 }, { x: 320, y: 380 }],
  },
]
