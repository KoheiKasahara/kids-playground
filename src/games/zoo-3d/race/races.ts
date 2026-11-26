// どうぶつレースの種目（生き物の種類ごと）と、その会場（コース）のデータ。
// 種目ごとに、出走する動物・コースの形・地面（つち・しばふ・こおり・みず・どろんこ）・ハードルを変える。
// 動物園の32種類が、どれかの種目に1回ずつ出る。

import type { TreeKind } from '../zooMap'
import type { SpeciesId } from '../species'
import { stadiumPoints, type Vec2 } from './course'

/** 地面の種類。速さへの影響は raceSim.ts で決める。 */
export type Terrain = 'dirt' | 'turf' | 'trail' | 'bush' | 'ice' | 'water' | 'mud' | 'grass'

export type RaceId = 'savanna' | 'derby' | 'forest' | 'ice' | 'mud' | 'hurdle'

/** ゼッケン（レーン）の色。3Dの名札と、画面の出走表・順位で同じ色にする。 */
export const LANE_COLORS = ['#ff5c5c', '#3f86ff', '#ffc928', '#2fbf62', '#a66bff', '#ff8c2e']

export type CourseTheme = {
  sky: string
  /** コースの外の地面。 */
  ground: string
  /** コースの両はしの さく。 */
  fence: 'white' | 'wood' | 'rope' | 'snow'
  trees: TreeKind[]
  /** 岩の色（なければ岩を置かない）。 */
  rock?: string
  /** 雪をかぶった景色（木の色・地面の雪玉）。 */
  snow?: boolean
  /** ほしくさの ロール（ぼくじょう）。 */
  hay?: boolean
  /** レーンの白い線を引く。 */
  lanes?: boolean
}

export type CourseSpec = {
  /** 会場の名前。 */
  name: string
  points: Vec2[]
  closed?: boolean
  /** false なら点をそのまま結ぶ（すでに細かい点列）。 */
  smooth?: boolean
  /** レースの きょり（m）。輪のコースは1周。輪でないコースは、ゴールの先に止まるための道がある。 */
  distance: number
  base: Terrain
  /** 地面が変わる区間（スタートからの m）。 */
  zones: { from: number; to: number; terrain: Terrain }[]
  /** ハードル・丸太の位置（m）。 */
  jumps: number[]
  jumpKind: 'hurdle' | 'log'
  /** レーンの はば（m）。いちばん大きい動物が並べる はば。 */
  laneWidth: number
  theme: CourseTheme
}

export type RaceDef = {
  id: RaceId
  name: string
  emoji: string
  /** どんな なかまの レースか。 */
  group: string
  /** 出走表に出す、コースの ひとこと。 */
  description: string
  /** カードの色。 */
  color: string
  runners: SpeciesId[]
  course: CourseSpec
  /** いちばん速い動物が、何も起きなければ ゴールする だいたいの秒数（速さの基準）。 */
  time: number
}

export const RACES: RaceDef[] = [
  {
    id: 'savanna',
    name: 'サバンナ ダッシュ',
    emoji: '🐆',
    group: 'あしの はやい どうぶつ',
    description: 'まっすぐな つちの みちで、はやさ くらべ！',
    color: '#f4cf73',
    runners: ['cheetah', 'lion', 'ostrich', 'zebra', 'giraffe'],
    time: 19,
    course: {
      name: 'まっすぐ サバンナ コース',
      points: [{ x: 0, z: 46 }, { x: 0, z: -66 }],
      smooth: false,
      distance: 90,
      base: 'dirt',
      zones: [],
      jumps: [],
      jumpKind: 'hurdle',
      laneWidth: 2.1,
      theme: { sky: '#bfe7fb', ground: '#c9c47c', fence: 'wood', trees: ['acacia', 'bush', 'acacia'], rock: '#c9b48e', lanes: true },
    },
  },
  {
    id: 'derby',
    name: 'ぼくじょう ダービー',
    emoji: '🐎',
    group: 'ひづめの ある どうぶつ',
    description: 'しばふの コースを ぐるっと 1しゅう。カーブが ポイント',
    color: '#a8dc7c',
    runners: ['horse', 'camel', 'deer', 'alpaca', 'sheep'],
    time: 26,
    course: {
      name: 'しばふの ダービー コース',
      points: stadiumPoints(30, 11),
      closed: true,
      smooth: false,
      // 1しゅう（30 * 2 + 2π * 11）
      distance: 60 + 2 * Math.PI * 11,
      base: 'turf',
      zones: [],
      jumps: [],
      jumpKind: 'hurdle',
      laneWidth: 1.85,
      theme: { sky: '#c6ecfb', ground: '#8fcb62', fence: 'white', trees: ['round', 'pine', 'round'], hay: true, lanes: true },
    },
  },
  {
    id: 'forest',
    name: 'もりの クロスカントリー',
    emoji: '🐺',
    group: 'もりに すむ どうぶつ',
    description: 'くねくねの もりの みちと やぶ。まるたも とびこえよう',
    color: '#8cc47a',
    runners: ['wolf', 'tiger', 'fox', 'panda', 'red_panda', 'raccoon'],
    time: 25,
    course: {
      name: 'くねくね もりの コース',
      points: [
        { x: 0, z: 52 }, { x: 7, z: 40 }, { x: 9, z: 27 }, { x: 1, z: 15 }, { x: -9, z: 4 }, { x: -9, z: -9 },
        { x: 0, z: -20 }, { x: 9, z: -32 }, { x: 7, z: -46 }, { x: 0, z: -58 }, { x: 0, z: -74 },
      ],
      distance: 112,
      base: 'trail',
      zones: [
        { from: 36, to: 48, terrain: 'bush' },
        { from: 66, to: 78, terrain: 'bush' },
      ],
      jumps: [26, 56, 86],
      jumpKind: 'log',
      laneWidth: 1.55,
      theme: { sky: '#c8ecf3', ground: '#79b257', fence: 'rope', trees: ['pine', 'round', 'pine', 'bush'], rock: '#a9a294' },
    },
  },
  {
    id: 'ice',
    name: 'こおりと みずの レース',
    emoji: '🐧',
    group: 'みずべに すむ どうぶつ',
    description: 'つるつるの こおりと プール。およぐのが はやいのは だれ？',
    color: '#9fd8f2',
    runners: ['polar_bear', 'penguin', 'capybara', 'crocodile', 'flamingo'],
    time: 25,
    course: {
      name: 'こおりと プールの コース',
      points: [{ x: 0, z: 50 }, { x: 5, z: 26 }, { x: 0, z: 2 }, { x: -5, z: -22 }, { x: 0, z: -46 }, { x: 0, z: -66 }],
      distance: 96,
      base: 'ice',
      zones: [{ from: 22, to: 76, terrain: 'water' }],
      jumps: [],
      jumpKind: 'hurdle',
      laneWidth: 2,
      theme: { sky: '#d3eefa', ground: '#eef5f8', fence: 'snow', trees: ['pine'], rock: '#e6f2f8', snow: true },
    },
  },
  {
    id: 'mud',
    name: 'どろんこ グランプリ',
    emoji: '🦏',
    group: 'からだの おおきな どうぶつ',
    description: 'ぬかるみが 3かしょ。どろんこが へいきなのは だれ？',
    color: '#c9a57a',
    runners: ['rhino', 'bear', 'hippo', 'elephant', 'gorilla'],
    time: 25,
    course: {
      name: 'ぐるっと どろんこ コース',
      points: [
        { x: -18, z: 26 }, { x: -20, z: 6 }, { x: -13, z: -12 }, { x: 0, z: -20 }, { x: 13, z: -12 },
        { x: 20, z: 6 }, { x: 18, z: 26 }, { x: 17, z: 40 },
      ],
      distance: 104,
      base: 'dirt',
      zones: [
        { from: 14, to: 30, terrain: 'mud' },
        { from: 46, to: 62, terrain: 'mud' },
        { from: 76, to: 90, terrain: 'mud' },
      ],
      jumps: [],
      jumpKind: 'hurdle',
      laneWidth: 2.7,
      theme: { sky: '#c4e6f5', ground: '#b4c877', fence: 'wood', trees: ['acacia', 'round', 'bush'], rock: '#b7a98f' },
    },
  },
  {
    id: 'hurdle',
    name: 'ぴょんぴょん ハードル',
    emoji: '🦘',
    group: 'ちいさな どうぶつと はねる どうぶつ',
    description: 'ほしくさの ハードルが 5つと、ぬかるみが 2かしょ',
    color: '#ffc0d0',
    runners: ['kangaroo', 'rabbit', 'goat', 'monkey', 'meerkat', 'pig'],
    time: 22,
    course: {
      name: 'ハードルの はらっぱ コース',
      points: [{ x: 0, z: 46 }, { x: 4, z: 20 }, { x: -4, z: -10 }, { x: 0, z: -40 }, { x: 0, z: -62 }],
      distance: 90,
      base: 'grass',
      zones: [{ from: 34, to: 44, terrain: 'mud' }, { from: 68, to: 76, terrain: 'mud' }],
      jumps: [14, 28, 50, 64, 78],
      jumpKind: 'hurdle',
      laneWidth: 1.6,
      theme: { sky: '#c6ecfb', ground: '#a3d66f', fence: 'wood', trees: ['round', 'bush', 'round'], hay: true, lanes: true },
    },
  },
]

export function raceById(id: RaceId): RaceDef {
  const found = RACES.find(r => r.id === id)
  if (!found) throw new Error(`unknown race: ${id}`)
  return found
}

export function isRaceId(value: unknown): value is RaceId {
  return typeof value === 'string' && RACES.some(r => r.id === value)
}

/** その位置の地面。 */
export function terrainAt(course: CourseSpec, s: number): Terrain {
  for (const z of course.zones) if (s >= z.from && s < z.to) return z.terrain
  return course.base
}

/** プールの入口・出口の坂の長さ（m）。 */
export const POOL_RAMP = 2.5

/** プールの深さの割合（0: 地面、1: いちばん深い）。入口と出口は坂になっている。 */
export function waterDepth(course: CourseSpec, s: number): number {
  for (const z of course.zones) {
    if (z.terrain !== 'water' || s < z.from || s >= z.to) continue
    return Math.min(1, (s - z.from) / POOL_RAMP, (z.to - s) / POOL_RAMP)
  }
  return 0
}
