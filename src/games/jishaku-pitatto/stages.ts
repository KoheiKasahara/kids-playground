import type { KindId } from './items'

export type StageId = 'desk' | 'sand' | 'sea'

/** うごかない どうぐ（いれもの・だい・いわ）。 */
export type PropKind = 'cup' | 'books' | 'bucket' | 'rock' | 'chest' | 'frame'

export type PropDef = {
  id: string
  kind: PropKind
  /** よこの いち（あそべる はばの 0〜1）。 */
  x: number
  w: number
  h: number
  variant?: number
}

export type Placement = {
  kind: KindId
  /** よこの いち（あそべる はばの 0〜1）。on が あるときは その どうぐの まんなか。 */
  x: number
  variant?: number
  angle?: number
  /** どうぐの うえ・なかに おく。 */
  on?: string
  /** on の どうぐの まんなかからの ずれ（単位）。 */
  dx?: number
  /** おく たかさを すこし あげる（単位）。 */
  lift?: number
  /** すなの なかに うまっている ふかさ（単位）。 */
  buried?: number
  /** およぐ（0 = みずの うえ、1 = うみの そこ）。 */
  swim?: { depth: number; range: number; speed: number; phase?: number }
  /** みずに うかぶ。 */
  float?: boolean
}

export type IronSandPatch = { x: number; spread: number; count: number }

export type StageDef = {
  id: StageId
  name: string
  lead: string
  /** はじめの あんない。 */
  hint: string
  sand?: boolean
  water?: boolean
  props: readonly PropDef[]
  items: readonly Placement[]
  ironSand?: readonly IronSandPatch[]
}

export const STAGES: readonly StageDef[] = [
  {
    id: 'desk',
    name: 'つくえの うえ',
    lead: 'クリップや くぎを あつめよう',
    hint: 'じしゃくを うごかして てつを くっつけよう',
    props: [
      { id: 'cup', kind: 'cup', x: 0.13, w: 46, h: 58 },
      { id: 'books', kind: 'books', x: 0.88, w: 86, h: 42 },
    ],
    items: [
      { kind: 'star', x: 0 },
      { kind: 'pencil', x: 0.13, on: 'cup', dx: -8, angle: -Math.PI / 2 + 0.12, variant: 0 },
      { kind: 'pencil', x: 0.13, on: 'cup', dx: 9, angle: -Math.PI / 2 - 0.1, variant: 1 },
      { kind: 'star', x: 0.13, on: 'cup', dx: 0 },
      { kind: 'marble', x: 0.13, on: 'cup', dx: 1, lift: 26 },
      { kind: 'clip', x: 0.27, variant: 0, angle: 0.15 },
      { kind: 'nail', x: 0.4, angle: 0.05 },
      { kind: 'eraser', x: 0.51 },
      { kind: 'clip', x: 0.6, variant: 1, angle: -0.2 },
      { kind: 'screw', x: 0.69, angle: 0.1 },
      { kind: 'block', x: 0.88, on: 'books', dx: -26, variant: 0 },
      { kind: 'star', x: 0.88, on: 'books', dx: 2 },
      { kind: 'nut', x: 0.88, on: 'books', dx: 28 },
    ],
  },
  {
    id: 'sand',
    name: 'すなば',
    lead: 'すなの なかにも かくれているよ',
    hint: 'すなの うえを なぞって さがそう',
    sand: true,
    props: [
      { id: 'frameL', kind: 'frame', x: 0, w: 16, h: 26 },
      { id: 'frameR', kind: 'frame', x: 1, w: 16, h: 26 },
      { id: 'bucket', kind: 'bucket', x: 0.81, w: 46, h: 44 },
    ],
    items: [
      { kind: 'clip', x: 0.05, variant: 2, angle: 0.3 },
      { kind: 'bolt', x: 0.15, buried: 2, angle: 0.5 },
      { kind: 'shell', x: 0.25, variant: 0 },
      { kind: 'star', x: 0.345, buried: 5, angle: 0.3 },
      { kind: 'spring', x: 0.45, angle: 0.05 },
      { kind: 'pebble', x: 0.55, variant: 0 },
      { kind: 'ball', x: 0.61 },
      { kind: 'gear', x: 0.675, buried: 3 },
      { kind: 'star', x: 0.81, on: 'bucket', dx: 0 },
      { kind: 'acorn', x: 0.925 },
      { kind: 'star', x: 0.99, buried: 6, angle: -0.4 },
    ],
    ironSand: [
      { x: 0.16, spread: 0.07, count: 90 },
      { x: 0.46, spread: 0.09, count: 110 },
      { x: 0.62, spread: 0.05, count: 60 },
      { x: 0.93, spread: 0.05, count: 70 },
    ],
  },
  {
    id: 'sea',
    name: 'うみの なか',
    lead: 'およぐ さかなを つりあげよう',
    hint: 'くちに わが ある さかなは くっつくよ',
    water: true,
    props: [
      { id: 'rockL', kind: 'rock', x: 0.1, w: 74, h: 30 },
      { id: 'chest', kind: 'chest', x: 0.52, w: 60, h: 32 },
      { id: 'rockR', kind: 'rock', x: 0.93, w: 52, h: 44, variant: 1 },
    ],
    items: [
      { kind: 'fish', x: 0.3, variant: 0, swim: { depth: 0.2, range: 0.28, speed: 0.34, phase: 0 } },
      { kind: 'fish', x: 0.65, variant: 1, swim: { depth: 0.42, range: 0.3, speed: 0.27, phase: 2.1 } },
      { kind: 'fish', x: 0.42, variant: 2, swim: { depth: 0.63, range: 0.32, speed: 0.3, phase: 4 } },
      { kind: 'fish', x: 0.6, variant: 3, swim: { depth: 0.8, range: 0.22, speed: 0.38, phase: 1.2 } },
      { kind: 'jelly', x: 0.78, swim: { depth: 0.3, range: 0.1, speed: 0.12, phase: 0.5 } },
      { kind: 'duck', x: 0.2, float: true },
      { kind: 'boot', x: 0.27 },
      { kind: 'anchor', x: 0.37 },
      { kind: 'star', x: 0.52, on: 'chest', dx: 0 },
      { kind: 'alcan', x: 0.665 },
      { kind: 'steelcan', x: 0.755 },
      { kind: 'star', x: 0.1, on: 'rockL', dx: -18 },
      { kind: 'starfish', x: 0.1, on: 'rockL', dx: 16 },
      { kind: 'star', x: 0.93, on: 'rockR', dx: 2 },
    ],
  },
]

export function findStage(id: string): StageDef | undefined {
  return STAGES.find((stage) => stage.id === id)
}
