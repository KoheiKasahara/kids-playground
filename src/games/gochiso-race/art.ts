import type { Animal } from './animals'
import type { FoodKind } from './foods'
import { Grid, outlinedSprite, shade, type Img, type Palette } from './pixel'

// どうぶつ・ごちそう・はち などの ドット絵。画像ファイルは つかわず、1ドットずつ コードで かく オリジナル。
// どうぶつは みぎむき。あしもとの まんなか（ANCHOR_X, ANCHOR_Y）を じめんに あわせて かく。

export type AnimalState = 'stand' | 'run' | 'jump' | 'brake' | 'hurt' | 'squash' | 'cheer' | 'sad'
export type EyeMode = 'open' | 'happy' | 'dizzy' | 'closed'

export type SpritePose = {
  state: AnimalState
  /** はしる・よろこぶ コマの ばんごう。 */
  frame: number
  eyes: EyeMode
  /** くちを あけて たべている。 */
  munch: boolean
}

/** どうぶつの 絵の おおきさ（ドット）。 */
export const SPRITE_W = 30
export const SPRITE_H = 36
/** あしもとの まんなか。 */
export const ANCHOR_X = 14
export const ANCHOR_Y = 35
/** はしる コマの かず。 */
export const RUN_FRAMES = 4

const EYE = '#21162b'
const BLUSH = '#ff8fa3'
const NOSE = '#2b1d22'
const MOUTH = '#9c2b3a'
const PANDA_BLACK = '#2b2b33'

type Limbs = {
  front: [number, number]
  back: [number, number]
  armF: [number, number]
  armB: [number, number]
  /** からだと あたまを うえに あげる ドット（マイナスが うえ）。 */
  bob: number
  /** あたまを よこに ずらす ドット。 */
  lean: number
  /** あたまを したに さげる ドット。 */
  droop: number
}

const RUN: readonly Limbs[] = [
  { front: [16.5, 30.2], back: [9.5, 30.2], armF: [16.4, 24.4], armB: [19.6, 23.6], bob: 0, lean: 0, droop: 0 },
  { front: [13.5, 29.2], back: [12.5, 30.2], armF: [18.2, 24], armB: [8.6, 24], bob: -1, lean: 0, droop: 0 },
  { front: [9.5, 30.2], back: [16.5, 30.2], armF: [19.8, 23.2], armB: [7.6, 23.6], bob: 0, lean: 0, droop: 0 },
  { front: [12.5, 30.2], back: [13.5, 29.2], armF: [18.2, 24], armB: [8.6, 24], bob: -1, lean: 0, droop: 0 },
]

function limbsFor(state: AnimalState, frame: number): Limbs {
  switch (state) {
    case 'run':
      return RUN[((frame % RUN_FRAMES) + RUN_FRAMES) % RUN_FRAMES]
    case 'jump':
      return { front: [16, 29], back: [10.5, 29.6], armF: [19.2, 20.6], armB: [8.2, 20.6], bob: -1, lean: 0, droop: 0 }
    case 'brake':
      return { front: [18.5, 30.2], back: [14, 30.2], armF: [19.6, 22.4], armB: [9.4, 22.4], bob: 0, lean: -2, droop: 0 }
    case 'hurt':
      return { front: [16, 29.6], back: [10, 29.6], armF: [20.2, 21.2], armB: [7, 21.2], bob: 0, lean: -1, droop: 0 }
    case 'cheer':
      return frame % 2
        ? { front: [15.5, 30.2], back: [10.5, 30.2], armF: [19.4, 19.4], armB: [8, 19.4], bob: 0, lean: 0, droop: 0 }
        : { front: [15.5, 29.4], back: [10.5, 29.4], armF: [19.2, 18], armB: [8.2, 18], bob: -2, lean: 0, droop: 0 }
    case 'sad':
      return { front: [15.5, 30.2], back: [10.5, 30.2], armF: [18, 25.4], armB: [8.6, 25.4], bob: 0, lean: 0, droop: 1 }
    default:
      return { front: [15.5, 30.2], back: [10.5, 30.2], armF: [18.6, 24.2], armB: [8, 24.2], bob: 0, lean: 0, droop: 0 }
  }
}

function lineColor(a: Animal): string {
  const n = Number.parseInt(a.body.slice(1), 16)
  const light = ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255) > 640
  return light ? '#5c4a63' : shade(a.body, .62)
}

function eyes(g: Grid, hx: number, hy: number, mode: EyeMode, color: string, dot = false) {
  const ey = Math.floor(hy - .5)
  for (const ex of [Math.floor(hx - 3), Math.floor(hx + 3)]) {
    if (mode === 'open') {
      g.set(ex, ey, color)
      if (!dot) g.set(ex, ey + 1, color)
    } else if (mode === 'happy') {
      g.set(ex - 1, ey + 1, color)
      g.set(ex, ey, color)
      g.set(ex + 1, ey + 1, color)
    } else if (mode === 'dizzy') {
      for (const [dx, dy] of [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]]) g.set(ex + dx, ey + dy, color)
    } else {
      for (const dx of [-1, 0, 1]) g.set(ex + dx, ey + 1, color)
    }
  }
}

/** みみ（さんかく）。tip が あれば さきっぽの いろ。 */
function pointyEars(g: Grid, hx: number, hy: number, outer: string, inner: string, tip?: string) {
  g.triangle(hx - 7.4, hy - 3.2, hx - 2.2, hy - 6.6, hx - 6, hy - 11, outer)
  g.triangle(hx + 2.2, hy - 6.6, hx + 7.4, hy - 3.2, hx + 6.4, hy - 11, outer)
  g.triangle(hx - 6, hy - 4.6, hx - 3.6, hy - 6.2, hx - 5.6, hy - 8.8, inner)
  g.triangle(hx + 3.6, hy - 6.2, hx + 6, hy - 4.6, hx + 6, hy - 8.8, inner)
  if (tip) {
    g.triangle(hx - 6.8, hy - 8.6, hx - 4.6, hy - 9, hx - 6, hy - 11, tip)
    g.triangle(hx + 4.8, hy - 9, hx + 7, hy - 8.6, hx + 6.4, hy - 11, tip)
  }
}

function roundEars(g: Grid, hx: number, hy: number, r: number, outer: string, inner: string, spread = 5.5, up = 5.5) {
  for (const s of [-1, 1]) {
    g.ellipse(hx + s * spread, hy - up, r, r, outer)
    g.ellipse(hx + s * spread, hy - up + .3, r * .5, r * .5, inner)
  }
}

function thinTail(g: Grid, b: number, color: string, tuft: string) {
  g.path([[8, 26 + b], [6.5, 26 + b], [5.5, 25 + b], [4.8, 23.8 + b]], .6, color)
  g.ellipse(4.6, 22.6 + b, 1.5, 1.5, tuft)
}

function buildAnimal(a: Animal, pose: SpritePose): Grid {
  const g = new Grid(SPRITE_W, SPRITE_H, 1, 4)
  const l = limbsFor(pose.state, pose.frame)
  const b = l.bob
  const line = lineColor(a)
  const body = a.body
  const bodyShade = shade(body, .16)
  const panda = a.id === 'panda'
  const penguin = a.id === 'penguin'
  const giraffe = a.id === 'giraffe'
  const limbFront = panda ? PANDA_BLACK : body
  const limbBack = panda ? '#1b1b22' : bodyShade
  const footFront = penguin ? a.accent : limbFront
  const footBack = penguin ? shade(a.accent, .18) : limbBack
  const hx = (giraffe ? 16 : 14) + l.lean
  const hy = (giraffe ? 8.5 : 13.5) + b + l.droop
  const hrx = a.id === 'hamster' ? 8.2 : giraffe ? 6.6 : 7.6
  const hry = a.id === 'hamster' ? 7 : giraffe ? 5.8 : 6.6
  const onHead = (c: string | null) => c === body || c === bodyShade
  const tx = l.lean < 0 ? -1 : 0

  // しっぽ（からだの うしろ）。
  switch (a.id) {
    case 'dog':
      g.ellipse(7, 21.5 + b, 2.6, 2.6, body)
      g.set(7, 21 + b, a.belly)
      break
    case 'cat':
      g.path([[8, 26 + b], [6.6, 25 + b], [5.6, 23.6 + b], [5.2, 22 + b], [5.2, 20.4 + b], [5.8, 19 + b]], .7, body)
      g.ellipse(5.9, 18.6 + b, 1, 1, '#f0a04b')
      break
    case 'rabbit':
      g.ellipse(7.6, 26 + b, 2, 2, '#ffffff')
      break
    case 'panda':
      g.ellipse(7.8, 26 + b, 1.5, 1.5, '#ffffff')
      break
    case 'penguin':
      g.triangle(8, 27 + b, 8, 29.5 + b, 5.5, 29.5 + b, body)
      break
    case 'lion':
      thinTail(g, b, shade(body, .1), a.accent)
      break
    case 'giraffe':
      thinTail(g, b, shade(body, .1), '#7a4a24')
      break
    case 'elephant':
      thinTail(g, b, shade(body, .1), shade(body, .35))
      break
    case 'bear':
      g.ellipse(7.8, 25 + b, 1.5, 1.5, body)
      break
    case 'fox':
      g.path([[8, 25 + b], [6.2, 23.6 + b], [4.8, 22 + b], [3.9, 20.2 + b], [3.6, 18.6 + b]], 2.2, body)
      g.ellipse(3.6, 17.4 + b, 1.9, 1.9, a.belly)
      break
  }

  // うしろの あし・て。
  g.ellipse(l.back[0], l.back[1], 2.4, 1.5, footBack)
  g.ellipse(l.armB[0] + tx, l.armB[1] + b, penguin ? 1.5 : 1.6, penguin ? 3.2 : 2.4, limbBack)

  // からだ。
  const bx = 13 + tx
  g.ellipse(bx, 25 + b, 5.6, 4.8, body)
  g.shadeRim(bx, 25 + b, 5.6, 4.8, body, bodyShade)
  if (penguin) g.ellipse(bx + 1.4, 25.6 + b, 4, 4, a.belly)
  else if (panda) g.ellipse(bx, 21.4 + b, 6.4, 2.4, PANDA_BLACK, c => c === body || c === bodyShade)
  else if (giraffe) {
    for (const [x, y] of [[10, 24], [15.4, 22.6], [15.8, 27.2], [11, 28]]) g.ellipse(bx - 13 + x, y + b, 1.3, 1.1, a.accent, onHead)
  } else g.ellipse(bx + 1.6, 26.2 + b, 3.2, 2.8, a.belly)

  // キリンの くび。
  if (giraffe) {
    g.rect(13 + l.lean, Math.floor(hy + 3), 4, Math.ceil(22 + b - hy - 3), body)
    g.ellipse(14.5 + l.lean, hy + 7, 1, 1, a.accent)
    g.ellipse(15.5 + l.lean, hy + 10.5, 1, 1, a.accent)
  }

  // あたまの うしろ（みみ・たてがみ）。
  switch (a.id) {
    case 'dog':
      pointyEars(g, hx, hy, body, a.belly)
      break
    case 'cat':
      pointyEars(g, hx, hy, body, a.accent)
      break
    case 'fox':
      pointyEars(g, hx, hy, body, a.belly, a.accent)
      break
    case 'rabbit': {
      const back = pose.state === 'run' || pose.state === 'jump' ? 2 : 0
      for (const [dx, up] of [[-2.6, 10], [2.4, 10.6]]) {
        g.ellipse(hx + dx - back, hy - up, 1.9, 5.2, body)
        g.ellipse(hx + dx - back, hy - up + .6, .8, 3.6, a.accent)
      }
      break
    }
    case 'panda':
      roundEars(g, hx, hy, 2.6, PANDA_BLACK, '#45454f')
      break
    case 'bear':
      roundEars(g, hx, hy, 2.6, body, a.belly)
      break
    case 'hamster':
      roundEars(g, hx, hy, 1.9, body, a.accent, 5.6, 6.2)
      break
    case 'koala':
      roundEars(g, hx, hy, 3.6, body, a.accent, 7.2, 3.2)
      break
    case 'lion':
      g.ellipse(hx, hy, 10, 9.4, a.accent)
      for (let y = Math.floor(hy - 10); y <= hy + 10; y++) {
        for (let x = Math.floor(hx - 11); x <= hx + 11; x++) {
          const dx = (x + .5 - hx) / 10, dy = (y + .5 - hy) / 9.4
          const d = dx * dx + dy * dy
          if (d > .78 && d <= 1 && (x + y) % 2 === 0) g.set(x, y, null)
        }
      }
      g.shadeRim(hx, hy, 10, 9.4, a.accent, shade(a.accent, .18))
      roundEars(g, hx, hy, 1.9, body, a.belly, 5, 5.6)
      break
    case 'giraffe':
      g.ellipse(hx - 6.6, hy - 2.6, 2.2, 1.1, body)
      g.ellipse(hx + 7, hy - 3, 2.2, 1.1, body)
      for (const dx of [-2.5, 2.5]) {
        g.rect(Math.floor(hx + dx), Math.floor(hy - 8), 1, 3, shade(body, .25))
        g.ellipse(hx + dx + .5, hy - 8.4, 1.1, 1.1, a.accent)
      }
      break
    case 'elephant':
      g.ellipse(hx - 5.6, hy + 1, 4.6, 5.6, body)
      g.shadeRim(hx - 5.6, hy + 1, 4.6, 5.6, body, bodyShade)
      g.ellipse(hx - 5.8, hy + 1.4, 3, 4, a.accent)
      break
  }

  // あたま。
  g.ellipseLined(hx, hy, hrx, hry, body, line)
  g.shadeRim(hx, hy, hrx, hry, body, bodyShade)

  // あたまの もよう。
  switch (a.id) {
    case 'dog':
    case 'fox':
      g.ellipse(hx + .8, hy + 4.4, 6.6, 3.1, a.belly, onHead)
      if (a.id === 'dog') {
        g.set(Math.floor(hx - 3), Math.floor(hy - 2.5), a.belly)
        g.set(Math.floor(hx + 3), Math.floor(hy - 2.5), a.belly)
      }
      break
    case 'cat':
      g.ellipse(hx - 4.4, hy - 4.6, 3.6, 3, '#f0a04b', onHead)
      g.ellipse(hx + 5, hy - 5.2, 2.6, 2.2, '#5a4636', onHead)
      for (const x of [hx - 7, hx - 6, hx + 6.2, hx + 7.2]) g.set(Math.floor(x), Math.floor(hy + 1.6), '#9b8f96')
      break
    case 'panda':
      g.ellipse(hx - 2.6, hy + .6, 1.6, 2.1, PANDA_BLACK)
      g.ellipse(hx + 3.6, hy + .6, 1.6, 2.1, PANDA_BLACK)
      break
    case 'penguin':
      g.ellipse(hx - 2, hy + 1, 3, 4, a.belly, onHead)
      g.ellipse(hx + 3, hy + 1, 3, 4, a.belly, onHead)
      break
    case 'hamster':
      g.ellipse(hx, hy + 4.8, 8.6, 3.8, a.belly, onHead)
      break
    case 'giraffe':
      g.ellipse(hx - 4, hy - 2.6, 1.2, 1.1, a.accent, onHead)
      g.ellipse(hx + .6, hy - 4, 1, 1, a.accent, onHead)
      break
  }

  // かお。
  eyes(g, hx, hy, pose.eyes, panda ? '#ffffff' : EYE, panda)
  const nx = Math.floor(hx)
  const ny = Math.floor(hy + 1.5)
  if (!penguin) {
    for (const x of [hx - 5.4, hx - 4.4, hx + 4.8, hx + 5.8]) g.set(Math.floor(x), Math.floor(hy + 2.2), panda ? '#ffb3c1' : BLUSH)
  }
  switch (a.id) {
    case 'dog':
    case 'bear':
    case 'lion':
      g.ellipse(hx + .5, hy + 2.6, 3.2, 2.2, a.belly)
      break
    case 'giraffe':
      g.ellipse(hx + 1.6, hy + 2.6, 3.4, 2.2, a.belly)
      g.set(nx, ny, '#7a4a24')
      g.set(nx + 3, ny, '#7a4a24')
      break
  }
  const noseColor = a.id === 'lion' ? '#7a3f1d' : a.id === 'cat' || a.id === 'rabbit' ? '#f08aa0' : a.id === 'hamster' ? '#e8838f' : NOSE
  if (a.id === 'koala') g.ellipse(hx + .5, hy + 1.6, 1.3, 1.9, '#3b3a44')
  else if (!penguin && !giraffe && a.id !== 'elephant') {
    g.set(nx, ny, noseColor)
    g.set(nx + 1, ny, noseColor)
  }
  if (penguin) {
    g.triangle(hx + 2.6, hy + 1.2, hx + 2.6, hy + 3.4, hx + (pose.munch ? 7 : 8), hy + 2.2, a.accent)
    if (pose.munch) g.triangle(hx + 2.6, hy + 3.4, hx + 2.6, hy + 4.4, hx + 6, hy + 4.6, shade(a.accent, .2))
  } else if (a.id === 'elephant') {
    const curl = pose.state === 'run' ? (pose.frame % 2 ? -.8 : .3) : pose.munch ? -1.4 : 0
    if (pose.munch) g.rect(nx - 2, ny + 2, 2, 2, MOUTH)
    g.path([[hx + 1.2, hy + 1.6], [hx + 1.6, hy + 3.2], [hx + 2, hy + 4.8], [hx + 2.6, hy + 6.4], [hx + 3.6, hy + 7.4 + curl / 2], [hx + 4.8, hy + 7 + curl]], .9, body, line)
  } else {
    const my = ny + (a.id === 'koala' ? 2 : 1)
    if (pose.munch) g.rect(nx, my, 2, 2, MOUTH)
    else if (pose.state === 'sad') {
      g.set(nx, my + 1, EYE)
      g.set(nx + 1, my + 1, EYE)
    } else {
      g.set(nx - 1, my, EYE)
      g.set(nx + 2, my, EYE)
    }
  }

  // まえの あし・て。
  g.ellipseLined(l.front[0], l.front[1], 2.4, 1.5, footFront, line)
  g.ellipseLined(l.armF[0] + tx, l.armF[1] + b, penguin ? 1.5 : 1.6, penguin ? 3.2 : 2.4, limbFront, line)

  g.outline(line)
  return g
}

const animalCache = new Map<string, Img | null>()

/** どうぶつの ドット絵（つくれない ところでは null）。 */
export function animalSprite(a: Animal, pose: SpritePose): Img | null {
  const key = `${a.id}|${pose.state}|${pose.frame}|${pose.eyes}|${pose.munch ? 1 : 0}`
  let img = animalCache.get(key)
  if (img === undefined) {
    img = buildAnimal(a, pose).toCanvas()
    animalCache.set(key, img)
  }
  return img
}

// ---------------- ごちそう ----------------

const FOOD_LINE = '#4a2a2a'

const FOOD_ART: Record<FoodKind, { rows: readonly string[]; palette: Palette }> = {
  apple: {
    palette: { r: '#ef3b3b', R: '#b8243a', h: '#ffb3b3', n: '#7a4a24', g: '#4caf50' },
    rows: [
      '....n....',
      '....n.gg.',
      '.rrrnrgg.',
      'rrhrrrrrr',
      'rhhrrrrrR',
      'rhrrrrrrR',
      'rrrrrrrRR',
      '.rrrrrRR.',
      '..rRRRR..',
    ],
  },
  strawberry: {
    palette: { r: '#f03e5a', R: '#b8243a', y: '#ffe58a', g: '#4caf50', G: '#2f7d32' },
    rows: [
      '.g.ggg.g.',
      '..gGgGg..',
      '.rrrrrrr.',
      'rryrrryrr',
      'rrrrrrrrR',
      'ryrrryrrR',
      '.rrrrrrR.',
      '.rryrrRR.',
      '..rrrRR..',
      '...rRR...',
    ],
  },
  banana: {
    palette: { y: '#ffd43b', Y: '#e0a800', n: '#7a4a24' },
    rows: [
      'n.........',
      'yy........',
      'yyy.......',
      '.yyy....nn',
      '.yyyy..yyY',
      '..yyyyyyyY',
      '...YyyyyYY',
      '....YYYY..',
    ],
  },
  onigiri: {
    palette: { w: '#ffffff', W: '#d9e2ec', k: '#26323b', K: '#3d5260' },
    rows: [
      '....ww....',
      '...wwww...',
      '..wwwwww..',
      '..wwwwwwW.',
      '.wwwwwwwW.',
      '.wwkkkkwW.',
      'wwwkKkkwWW',
      'wwwkkkkwWW',
      '.wwkkkkWW.',
    ],
  },
  donut: {
    palette: { d: '#d8964f', D: '#a86a2f', p: '#ff8fb8', P: '#e0608f', b: '#5ac8fa', y: '#ffd43b', w: '#ffffff' },
    rows: [
      '...pppp...',
      '.ppbppypp.',
      'pppppppppP',
      'ppyp..pbpP',
      'pppp..ppPP',
      'dpwppppPPD',
      'ddpppPPPDD',
      '.ddddDDDD.',
      '...DDDD...',
    ],
  },
  burger: {
    palette: { t: '#e8a24c', T: '#b8742a', s: '#fff6d8', g: '#69c34d', c: '#ffd43b', m: '#7a3f1d', M: '#552a12', b: '#e8a24c', B: '#b8742a' },
    rows: [
      '..ttttttt..',
      '.ttsttsttt.',
      'ttttttttsTT',
      'tsttttttTTT',
      'ggggggggggg',
      'cmcmmmmmmcm',
      'mmmmmmmmmMM',
      '.bbbbbbbbB.',
      '..bbbbbbB..',
    ],
  },
  pudding: {
    palette: { c: '#9a4f1d', y: '#ffd86b', Y: '#e6a93a', p: '#dfe7f0', P: '#b5c3d3', r: '#e8193c', R: '#a3102a' },
    rows: [
      '....rr....',
      '....rR....',
      '..cccccc..',
      '.cccccccc.',
      '.ycccyccy.',
      '.yyyyyyyY.',
      'yyyyyyyyYY',
      'yyyyyyyyYY',
      'pppppppppP',
      '.PPPPPPPP.',
    ],
  },
  cake: {
    palette: { w: '#fff8ee', W: '#e7d6c0', s: '#ffd98a', S: '#e6b25a', r: '#f03e5a', R: '#b8243a', g: '#4caf50' },
    rows: [
      '......gg...',
      '.....rrrr..',
      '.....rRRr..',
      '.wwwwwwwwww',
      'wwwwwwwwwwW',
      'sssssssssSS',
      'rwrwrwrwrwW',
      'sssssssssSS',
      'wwwwwwwwwWW',
      '.WWWWWWWWW.',
    ],
  },
  parfait: {
    palette: { g: '#cfe8ff', w: '#ffffff', p: '#ff8fb8', b: '#8b5a2b', y: '#ffd43b', r: '#e8193c', R: '#a3102a', s: '#e8a24c' },
    rows: [
      '.....rr....',
      '....rrR..s.',
      '...wwwwwws.',
      '..wwwwwwwws',
      '.wwwwwwwwww',
      '.gpppppppg.',
      '.gwwwwwwwg.',
      '..gbbbbbg..',
      '..gyyyyyg..',
      '...gpppg...',
      '....ggg....',
      '.....g.....',
      '...ggggg...',
    ],
  },
}

const foodCache = new Map<FoodKind, Img | null>()

/** ごちそうの ドット絵（ふちどり つき）。 */
export function foodSprite(kind: FoodKind): Img | null {
  let img = foodCache.get(kind)
  if (img === undefined) {
    const art = FOOD_ART[kind]
    img = outlinedSprite(art.rows, art.palette, FOOD_LINE)
    foodCache.set(kind, img)
  }
  return img
}

// ---------------- はち ----------------

const BEE_PALETTE: Palette = { y: '#ffd23f', Y: '#e0a800', k: '#3a2a20', w: '#ffffff', W: '#cfe3ff', e: '#21162b' }
const BEE_FRAMES = [
  [
    '...ww.ww....',
    '..wwWwWww...',
    '...wwwww....',
    '..yykyykyy..',
    '.yeykyykyyk.',
    '.yyykyykyyyk',
    '..yykyykYY..',
    '...YkYYkY...',
  ],
  [
    '............',
    '............',
    '.wwwW.Wwww..',
    '..yykyykyy..',
    '.yeykyykyyk.',
    '.yyykyykyyyk',
    '..yykyykYY..',
    '...YkYYkY...',
  ],
]
const beeCache: (Img | null | undefined)[] = []

export function beeSprite(frame: number): Img | null {
  const i = frame % BEE_FRAMES.length
  if (beeCache[i] === undefined) beeCache[i] = outlinedSprite(BEE_FRAMES[i], BEE_PALETTE, '#3a2a20')
  return beeCache[i] ?? null
}

// ---------------- もじ ----------------

const GLYPHS: Record<string, readonly string[]> = {
  '+': ['.....', '..o..', '..o..', 'ooooo', '..o..', '..o..', '.....'],
  '0': ['.ooo.', 'oo.oo', 'oo.oo', 'oo.oo', 'oo.oo', 'oo.oo', '.ooo.'],
  '1': ['..oo.', '.ooo.', '..oo.', '..oo.', '..oo.', '..oo.', '.oooo'],
  '2': ['.ooo.', 'oo.oo', '...oo', '..oo.', '.oo..', 'oo...', 'ooooo'],
  '3': ['oooo.', '...oo', '...oo', '.ooo.', '...oo', '...oo', 'oooo.'],
  '4': ['...oo', '..ooo', '.o.oo', 'o..oo', 'ooooo', '...oo', '...oo'],
  '5': ['ooooo', 'oo...', 'oooo.', '...oo', '...oo', 'oo.oo', '.ooo.'],
  '6': ['.ooo.', 'oo...', 'oooo.', 'oo.oo', 'oo.oo', 'oo.oo', '.ooo.'],
  '7': ['ooooo', '...oo', '...oo', '..oo.', '..oo.', '.oo..', '.oo..'],
  '8': ['.ooo.', 'oo.oo', 'oo.oo', '.ooo.', 'oo.oo', 'oo.oo', '.ooo.'],
  '9': ['.ooo.', 'oo.oo', 'oo.oo', '.oooo', '...oo', '...oo', '.ooo.'],
}
const textCache = new Map<string, Img | null>()

/** 5x7 ドットの すうじ（「+3」など）。ふちどり つき。 */
export function numberSprite(text: string, color: string): Img | null {
  const key = `${text}|${color}`
  let img = textCache.get(key)
  if (img === undefined) {
    const rows = ['', '', '', '', '', '', '']
    for (const ch of text) {
      const glyph = GLYPHS[ch]
      if (!glyph) continue
      glyph.forEach((row, i) => { rows[i] += (rows[i] ? '.' : '') + row })
    }
    img = outlinedSprite(rows, { o: color }, '#3a2026')
    textCache.set(key, img)
  }
  return img
}

const GOAL_ROWS = [
  '.....o.o...........o..o...',
  'ooooo..............o..o...',
  '....o..............o..o...',
  '....o....oooooo....o..o..o',
  '....o..............o..o.o.',
  'ooooo.............o...oo..',
  '.................o....o...',
]
let goalImg: Img | null | undefined

/** 「ゴール」の かんばん（オレンジの いたに しろい もじ）。 */
export function goalSign(): Img | null {
  if (goalImg === undefined) {
    const w = GOAL_ROWS[0].length + 6
    const h = GOAL_ROWS.length + 5
    const g = new Grid(w + 2, h + 2)
    g.rect(1, 1, w, h, '#ff6b3d')
    g.rect(1, h - 1, w, 2, '#d9481c')
    g.rect(2, 1, w - 2, 1, '#ff9a6b')
    g.set(1, 1, null)
    g.set(w, 1, null)
    g.set(1, h, null)
    g.set(w, h, null)
    GOAL_ROWS.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === 'o') g.set(x + 4, y + 3, '#ffffff')
    })
    g.outline('#7a2410')
    goalImg = g.toCanvas()
  }
  return goalImg
}
