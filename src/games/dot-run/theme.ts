// ステージごとの いろ。1つの けしきに つかう 色を しぼって、ドット絵らしい まとまりを だす。

import type { StageId } from './stages'

export type Theme = {
  /** そらの いろ（うえ → ちへいせん）。ベイヤーで まぜて 段を つくる。 */
  sky: string[]
  /** そらの いちばん うえの 色が おわる 高さと、ちへいせんの 高さ（せかいの y）。 */
  skyTop: number
  horizon: number
  celestial: 'sun' | 'sunset' | 'moon'
  /** じめんの うえの 部分（ハイライト・あかるい・ふつう・かげ）。 */
  top: [string, string, string, string]
  /** つちの 部分（あかるい → くらい）。 */
  dirt: string[]
  outline: string
  /** つちに まざる こいし（あかるい・くらい）。 */
  pebble: [string, string]
  topKind: 'grass' | 'sand' | 'snow'
  platform: { top: string; light: string; main: string; dark: string; outline: string; kind: 'wood' | 'drift' | 'ice' }
  rock: { o: string; L: string; l: string; m: string; d: string; cap: 'moss' | 'star' | 'snow' }
  far: { kind: 'mountains' | 'sea' | 'peaks'; colors: string[]; snow: string[] }
  mid: { kind: 'hills' | 'palms' | 'pines'; colors: string[]; accent: string[] }
  near: { colors: string[] }
  cloud: [string, string, string] | null
  weather: 'petals' | 'sparkle' | 'snow'
  deco: 'flowers' | 'shells' | 'snow'
  prop: 'tree' | 'palm' | 'pine'
  /** HUD や タイトルの カードの 色あい。 */
  card: string
}

export const THEMES: Record<StageId, Theme> = {
  meadow: {
    sky: ['#3f8fe6', '#4ea3ef', '#62b8f6', '#7fcbfa', '#9fdcfc', '#c4ecfd', '#e2f7fe'],
    skyTop: -140,
    horizon: 112,
    celestial: 'sun',
    top: ['#e2ff8a', '#98e44e', '#56bc3c', '#2f8a36'],
    dirt: ['#c98244', '#ae6a34', '#915428', '#71401e', '#522c14'],
    outline: '#35180a',
    pebble: ['#e8c090', '#6e4424'],
    topKind: 'grass',
    platform: { top: '#ffd49a', light: '#e8a060', main: '#c07638', dark: '#8a4a20', outline: '#3a1a0c', kind: 'wood' },
    rock: { o: '#2c2a3c', L: '#eeeef6', l: '#c4c4d6', m: '#9696b0', d: '#66668a', cap: 'moss' },
    far: { kind: 'mountains', colors: ['#b4c8f4', '#98b0e8', '#8098d8', '#6c84c4'], snow: ['#ffffff', '#e0ecff'] },
    mid: { kind: 'hills', colors: ['#8ad866', '#6cc454', '#52aa48', '#3c8c40', '#2c7038'], accent: ['#ff6a7a', '#fff080', '#ffffff'] },
    near: { colors: ['#3a9a44', '#2c8040', '#206838', '#18542e'] },
    cloud: ['#ffffff', '#e6f2ff', '#b4d0f0'],
    weather: 'petals',
    deco: 'flowers',
    prop: 'tree',
    card: '#3aa84a',
  },
  beach: {
    sky: ['#262058', '#3a2a72', '#5a3486', '#86408e', '#b8508a', '#e46a78', '#fb9066', '#ffb870', '#ffdc92'],
    skyTop: -160,
    horizon: 100,
    celestial: 'sunset',
    top: ['#fff4d4', '#ffe2a4', '#f4c878', '#d6a45a'],
    dirt: ['#e6b46e', '#cf9858', '#b37c46', '#8f6036', '#6a4426'],
    outline: '#46260f',
    pebble: ['#fff0e8', '#c48a74'],
    topKind: 'sand',
    platform: { top: '#f4e0c4', light: '#d8bc98', main: '#b0926e', dark: '#7c6048', outline: '#34200f', kind: 'drift' },
    rock: { o: '#3a1e28', L: '#ffe6d6', l: '#f0c4b0', m: '#d09a8c', d: '#a0706e', cap: 'star' },
    far: { kind: 'sea', colors: ['#ff9c78', '#e2708a', '#a8528e', '#6a3a86', '#44307a'], snow: ['#ffe8a8', '#ffc070'] },
    mid: { kind: 'palms', colors: ['#5a2a64', '#4a2258', '#3a1a4a', '#2c1238'], accent: ['#ff8a6a', '#ffb070'] },
    near: { colors: ['#e0a468', '#c88a52', '#aa7042', '#8a5834'] },
    cloud: ['#ffc8a8', '#f090a0', '#9a5a92'],
    weather: 'sparkle',
    deco: 'shells',
    prop: 'palm',
    card: '#e0703a',
  },
  snow: {
    sky: ['#050820', '#0a1030', '#10193f', '#18244f', '#22305e', '#2e3e6c', '#3c4e7a'],
    skyTop: -160,
    horizon: 110,
    celestial: 'moon',
    top: ['#ffffff', '#eef6ff', '#cfe0f8', '#98b4e2'],
    dirt: ['#6a78aa', '#57639a', '#475189', '#394175', '#2b315d'],
    outline: '#161a36',
    pebble: ['#b4d8ff', '#262c56'],
    topKind: 'snow',
    platform: { top: '#ffffff', light: '#d4f0ff', main: '#94d0f4', dark: '#5a96d0', outline: '#1a3466', kind: 'ice' },
    rock: { o: '#161a36', L: '#c8d0ec', l: '#9aa4cc', m: '#7480ac', d: '#525c88', cap: 'snow' },
    far: { kind: 'peaks', colors: ['#5a6c9c', '#4a5a8a', '#3c4a78', '#303c66'], snow: ['#e8f0ff', '#b8c8ec', '#8a9cc8'] },
    mid: { kind: 'pines', colors: ['#24345e', '#1c2a50', '#162244', '#101a38'], accent: ['#e8f2ff', '#b0c4e8'] },
    near: { colors: ['#dce8fa', '#bcd0f0', '#96acd8', '#7488bc'] },
    cloud: null,
    weather: 'snow',
    deco: 'snow',
    prop: 'pine',
    card: '#3a5ab0',
  },
}
