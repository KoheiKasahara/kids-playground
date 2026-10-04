// ワールドごとの いろ。ゆか・かべ・ブロック・そとがわ（はいけい）・てんき を きめる。

import type { WorldId } from './stages'

export type BlockColors = { top: string; top2: string; light: string; side: string; dark: string; accent: string; accent2: string }

export type Theme = {
  id: WorldId
  /** ゆか（あかるい → くらい）。 */
  floor: readonly [string, string, string, string]
  /** ゆかの こまかい もよう。 */
  speck: string
  hard: BlockColors
  wall: BlockColors
  soft: BlockColors
  water: readonly [string, string, string]
  /** ボードの そとがわ。 */
  back: readonly [string, string, string]
  shadow: string
  weather: 'leaf' | 'sand' | 'snow' | 'ember' | 'dust'
  /** くらい ステージの やみの いろ。 */
  night: string
}

export const THEMES: Record<WorldId, Theme> = {
  forest: {
    id: 'forest',
    floor: ['#8fdc5c', '#76c84a', '#5eae3e', '#468c34'],
    speck: '#b6f07a',
    hard: { top: '#b4b8c8', top2: '#9aa0b6', light: '#e2e6f0', side: '#6e7490', dark: '#4a4e68', accent: '#6cc04a', accent2: '#3e8a3a' },
    wall: { top: '#3e8a46', top2: '#2f7440', light: '#6cc06a', side: '#285a32', dark: '#183c24', accent: '#8a5a34', accent2: '#5e3a20' },
    soft: { top: '#5cc048', top2: '#44a23e', light: '#9ae46c', side: '#2e7a36', dark: '#1e5228', accent: '#ff5a6a', accent2: '#ffd0d8' },
    water: ['#5ab4f0', '#3a88d8', '#bfe8ff'],
    back: ['#2e6a3a', '#24532e', '#3c8048'],
    shadow: 'rgba(16,40,20,.32)',
    weather: 'leaf',
    night: '#0a1410',
  },
  desert: {
    id: 'desert',
    floor: ['#ffe6a0', '#f5d27e', '#e3b862', '#c89a48'],
    speck: '#fff4cc',
    hard: { top: '#e8c08a', top2: '#d4a470', light: '#fff0c8', side: '#b07a48', dark: '#7a5030', accent: '#3aa0c8', accent2: '#d05a3a' },
    wall: { top: '#c88e58', top2: '#b07848', light: '#ecc088', side: '#8a5634', dark: '#5e3820', accent: '#e8c08a', accent2: '#7a4a2a' },
    soft: { top: '#f0b878', top2: '#dc9c60', light: '#ffdcaa', side: '#b8743e', dark: '#84502a', accent: '#c06a3a', accent2: '#ffe8c0' },
    water: ['#5ac8e0', '#2e98c0', '#c8f4ff'],
    back: ['#e8a860', '#d48c48', '#f4c47c'],
    shadow: 'rgba(110,60,20,.28)',
    weather: 'sand',
    night: '#1a0e06',
  },
  ice: {
    id: 'ice',
    floor: ['#f4faff', '#dceafa', '#c0d4f0', '#9cb4e0'],
    speck: '#ffffff',
    hard: { top: '#a8ecff', top2: '#7cd2f4', light: '#e8fcff', side: '#4aa0d8', dark: '#2a6aa8', accent: '#ffffff', accent2: '#c8f0ff' },
    wall: { top: '#8ab0e0', top2: '#7298cc', light: '#c8dcf8', side: '#4a6aa8', dark: '#2e4680', accent: '#ffffff', accent2: '#a8c4ec' },
    soft: { top: '#ffffff', top2: '#e2eefc', light: '#ffffff', side: '#a8c0e4', dark: '#7890c0', accent: '#9ad0ff', accent2: '#d8ecff' },
    water: ['#7ad0f8', '#4aa4e0', '#e0f8ff'],
    back: ['#3a5c9c', '#2c4a84', '#5a7cbc'],
    shadow: 'rgba(40,70,140,.22)',
    weather: 'snow',
    night: '#060a1a',
  },
  volcano: {
    id: 'volcano',
    floor: ['#76585a', '#644a4e', '#523c42', '#3e2c34'],
    speck: '#ff8a3a',
    hard: { top: '#4a4060', top2: '#3c3450', light: '#7a6c96', side: '#2a2440', dark: '#18142a', accent: '#ff6a2a', accent2: '#ffc040' },
    wall: { top: '#3a2a30', top2: '#2e2026', light: '#5e464c', side: '#22161c', dark: '#140c10', accent: '#ff5a1e', accent2: '#ffb030' },
    soft: { top: '#8a6a60', top2: '#76584e', light: '#b08e80', side: '#563e38', dark: '#3a2824', accent: '#ff7a2a', accent2: '#ffd050' },
    water: ['#ff8a2a', '#e0461e', '#ffe080'],
    back: ['#2a1418', '#1e0e12', '#4a1e1a'],
    shadow: 'rgba(10,0,4,.38)',
    weather: 'ember',
    night: '#0c0406',
  },
  castle: {
    id: 'castle',
    floor: ['#c8c0d8', '#b2a8c8', '#9a90b4', '#7e7498'],
    speck: '#e8e2f4',
    hard: { top: '#a0aac4', top2: '#8892b0', light: '#d8e0f0', side: '#5e6688', dark: '#3c4262', accent: '#ffd23c', accent2: '#c08a18' },
    wall: { top: '#6a4e8c', top2: '#5a4078', light: '#9474b8', side: '#422c5e', dark: '#2a1a40', accent: '#ffd23c', accent2: '#a07a20' },
    soft: { top: '#c08a50', top2: '#a8743e', light: '#e0b07a', side: '#7a5028', dark: '#523418', accent: '#9aa4c0', accent2: '#5e6688' },
    water: ['#6a8ad0', '#4a62a8', '#c0d4ff'],
    back: ['#2e2040', '#241834', '#3e2c54'],
    shadow: 'rgba(20,10,40,.3)',
    weather: 'dust',
    night: '#08040e',
  },
}
