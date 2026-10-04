// 手で うった ドット絵。モンスターは ひだり はんぶんの かたち（シルエット）だけを うち、
// みぎ はんぶんは かがみうつし。かげ・ハイライト・ふちどりは うえひだりから ひかりが あたる ように
// プログラムで つけるので、いろちがいも パレットを かえるだけで できる。

import type { SnackId, SpeciesId } from './monsters'
import { bayer, flashed, makeCanvas, outlined, type Img } from './pixel'

type Ramp = readonly [shade: string, base: string, light: string]
type Look = { ramps: Readonly<Record<string, Ramp>>; flat?: Readonly<Record<string, string>>; outline: string }

const EYE = '#1c1428'
const WHITE = '#ffffff'
const CHEEK = '#ff8aa8'
const MOUTH = '#5a1c30'
const FLAT: Record<string, string> = { k: EYE, w: WHITE, p: CHEEK, m: MOUTH }

/**
 * もじの え に かげを つける。うえ・ひだりが そとなら あかるく、みぎ・したが そとなら くらく。
 * ramps に ない もじ（め・ほっぺ など）は flat の いろで そのまま ぬる。
 */
function shadeRows(rows: readonly string[], look: Look, extra?: (ctx: CanvasRenderingContext2D) => void): Img | null {
  const h = rows.length
  const w = Math.max(...rows.map(r => r.length))
  const made = makeCanvas(w, h)
  if (!made) return null
  const solid = (x: number, y: number) => y >= 0 && y < h && x >= 0 && x < w && (rows[y][x] ?? '.') !== '.'
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x] ?? '.'
      if (ch === '.') continue
      const ramp = look.ramps[ch]
      let color: string | undefined
      if (ramp) {
        const dark = !solid(x + 1, y) || !solid(x, y + 1)
        const light = !solid(x - 1, y) || !solid(x, y - 1)
        const dark2 = !solid(x + 2, y) || !solid(x, y + 2) || !solid(x + 1, y + 1)
        color = ramp[dark ? 0 : light ? 2 : dark2 && bayer(x, y) >= .5 ? 0 : 1]
      } else color = look.flat?.[ch] ?? FLAT[ch] ?? (ch === 'x' ? look.outline : undefined)
      if (!color) continue
      made.ctx.fillStyle = color
      made.ctx.fillRect(x, y, 1, 1)
    }
  }
  extra?.(made.ctx)
  return outlined(made.canvas, look.outline)
}

// ---------------- モンスター ----------------

/** かたちの きほん。ひだり はんぶん（11もじ × 22ぎょう）。a=からだ d=おなか e=つの・はね y=くちばし・あし n=みみの なか */
type Body = {
  half: readonly string[]
  /** ひだりの めの いち（2×3 の ひだりうえ）。みぎの めは かがみうつし。 */
  eye: readonly [number, number]
  /** かがみうつしで りょうがわに うつ てん。 */
  sym?: readonly (readonly [number, number, string])[]
  /** かたがわだけの てん（ひかり・ひび など）。 */
  marks?: readonly (readonly [number, number, string])[]
}

export const BODY_W = 22
export const BODY_H = 22

const BODIES: Record<SpeciesId, Body> = {
  puru: {
    half: [
      '...........',
      '...........',
      '...........',
      '...........',
      '..........a',
      '.........aa',
      '........aaa',
      '.......aaaa',
      '.....aaaaaa',
      '...aaaaaaaa',
      '..aaaaaaaaa',
      '.aaaaaaaaaa',
      '.aaaaaaaaaa',
      'aaaaaaaaaaa',
      'aaaaaaaaaaa',
      'aaaaaaaaaaa',
      'aaaaaaaaaaa',
      'aaaaaaaaaaa',
      'aaaaaaaaaaa',
      '.aaaaaaaaaa',
      '..aaaaaaaaa',
      '....aaaaaaa',
    ],
    eye: [6, 12],
    sym: [[3, 16, 'p'], [4, 16, 'p'], [9, 16, 'm'], [10, 17, 'm']],
    marks: [[4, 10, 'w'], [3, 11, 'w'], [9, 7, 'w']],
  },
  draco: {
    half: [
      '...........',
      '...e.......',
      '...ee......',
      '....ee.....',
      '....eaaaaaa',
      '...aaaaaaaa',
      '..aaaaaaaaa',
      '..aaaaaaaaa',
      '..aaaaaaaaa',
      '..aaaaaaaaa',
      '..aaaaaaadd',
      '...aaaaaddd',
      '....aaaaaaa',
      'e....aaaddd',
      'ee..aaadddd',
      'eee.aaadddd',
      '.eeeaaadddd',
      '..eeaaadddd',
      '....aaadddd',
      '....aaaaddd',
      '....aaaa...',
      '...aaaaa...',
    ],
    eye: [5, 6],
    sym: [[9, 10, 'x'], [8, 11, 'm'], [9, 12, 'm'], [10, 12, 'w']],
    marks: [[4, 5, 'w'], [3, 6, 'w']],
  },
  mofu: {
    half: [
      '...aa......',
      '..aaaa.....',
      '..anaa.....',
      '..anaa.....',
      '..anaa.....',
      '..anaa.....',
      '..aaaa.a.a.',
      '..aaaaaaaaa',
      '.aaaaaaaaaa',
      'aaaaaaaaaaa',
      'aaaaaaaaaaa',
      '.aaaaaaaaaa',
      'aaaaaaaaaaa',
      'aaaaaaaaaaa',
      '.aaaaaaaddd',
      'aaaaaaddddd',
      'aaaaaaddddd',
      '.aaaaaddddd',
      '.aaaaaadddd',
      '..aaaaaaaaa',
      '...dddd....',
      '...dddd....',
    ],
    eye: [5, 9],
    sym: [[3, 12, 'p'], [4, 12, 'p'], [10, 12, 'm'], [9, 11, 'm']],
    marks: [[3, 8, 'w'], [2, 9, 'w']],
  },
  goron: {
    half: [
      '...........',
      '...........',
      '...........',
      '.......eeee',
      '.....eeeeee',
      '.....eaaaaa',
      '....aaaaaaa',
      '....aaaaaaa',
      '....aaaaaaa',
      '....aaaaaaa',
      '.aaaaaaaaaa',
      'aaaaaaaaaaa',
      'aaaaaaddddd',
      'aaaaaaddddd',
      'aaaaaaddddd',
      'aaa.aaddddd',
      'aaa.aaaaaaa',
      'aaa.aaaaaaa',
      '.a..aaaaaaa',
      '....aaa....',
      '...aaaa....',
      '...aaaa....',
    ],
    eye: [7, 6],
    sym: [[10, 9, 'm']],
    marks: [[7, 13, 'x'], [8, 14, 'x'], [8, 15, 'x'], [14, 6, 'x'], [15, 7, 'x'], [2, 12, 'x'], [1, 13, 'x'], [18, 16, 'x'], [19, 17, 'x']],
  },
  piko: {
    half: [
      '...........',
      '..........e',
      '........e.e',
      '.........ee',
      '......aaaaa',
      '....aaaaaaa',
      '...aaaaaaaa',
      '..aaaaaaaaa',
      '..aaaaaaaaa',
      '.aaaaaaaaaa',
      '.aaaaaaaaaa',
      '.aaaaaaaaaa',
      '.aaaaaaaaaa',
      'eaaaaaaaddd',
      'eeaaaaadddd',
      'eeaaaaadddd',
      '.eaaaaadddd',
      '..aaaaadddd',
      '..aaaaaaddd',
      '...aaaaaaaa',
      '.....y.....',
      '....yyy....',
    ],
    eye: [5, 8],
    sym: [[9, 10, 'y'], [10, 10, 'y'], [10, 11, 'y'], [3, 12, 'p']],
    marks: [[6, 5, 'w'], [4, 6, 'w']],
  },
  fuwari: {
    half: [
      '...........',
      '...........',
      '..........e',
      '.........ee',
      '.......aaaa',
      '.....aaaaaa',
      '....aaaaaaa',
      '...aaaaaaaa',
      '...aaaaaaaa',
      '..aaaaaaaaa',
      '..aaaaaaaaa',
      '..aaaaaaaaa',
      '..aaaaaaaaa',
      'a.aaaaaaaaa',
      'aaaaaaaaaaa',
      '.aaaaaaaaaa',
      '..aaaaaaaaa',
      '..aaaaaaaaa',
      '..aaaaaaaaa',
      '..aaaaaaaaa',
      '..aaa.aaa.a',
      '..aa...a...',
    ],
    eye: [5, 10],
    sym: [[3, 13, 'p'], [4, 13, 'p'], [10, 14, 'm'], [10, 15, 'm']],
    marks: [[6, 6, 'w'], [5, 7, 'w']],
  },
}

const CREAM: Ramp = ['#d8b060', '#f8e0a0', '#fff8d8']
const MOSS: Ramp = ['#3a8a30', '#5cb848', '#a0e078']
const BEAK: Ramp = ['#d06010', '#f08820', '#ffb860']

/** しゅるいごとの いろ。3ばんめ（さいご）が いろちがい。 */
const LOOKS: Record<SpeciesId, readonly Look[]> = {
  puru: [
    { ramps: { a: ['#2f6fd8', '#4f9cf0', '#9ed8ff'] }, outline: '#173068' },
    { ramps: { a: ['#3c9a3c', '#62c85a', '#b0f090'] }, outline: '#1a4420' },
    { ramps: { a: ['#d0508e', '#f080b4', '#ffc4e0'] }, outline: '#5a1c40', flat: { p: '#ff5a8a' } },
    { ramps: { a: ['#c08a18', '#f0c030', '#fff0a0'] }, outline: '#5a3a08' },
  ],
  draco: [
    { ramps: { a: ['#3a8a3a', '#5cb84c', '#a0e070'], d: CREAM, e: ['#c06a20', '#f09838', '#ffd080'] }, outline: '#1c3a18' },
    { ramps: { a: ['#b02c28', '#e8503c', '#ff9a7a'], d: CREAM, e: ['#7a4420', '#b0763a', '#e8b070'] }, outline: '#4a1010' },
    { ramps: { a: ['#2a4ab0', '#4a78e0', '#90c0ff'], d: CREAM, e: ['#8a8a9a', '#c8c8d8', '#ffffff'] }, outline: '#141e50' },
    { ramps: { a: ['#2a1c40', '#4a3468', '#7a62a0'], d: ['#c09020', '#f0c838', '#fff0a0'], e: ['#a01c2c', '#e0303c', '#ff8080'] }, outline: '#0e0818' },
  ],
  mofu: [
    { ramps: { a: ['#d8b888', '#f4e0c0', '#fffaf0'], d: ['#f0d8b8', '#fff4e4', '#ffffff'] }, flat: { n: '#ff9ab0' }, outline: '#5a4030' },
    { ramps: { a: ['#8a5a30', '#b07a48', '#e0b078'], d: ['#d8b888', '#f4e0c0', '#fffaf0'] }, flat: { n: '#ff9ab0' }, outline: '#3a2010' },
    { ramps: { a: ['#d878a8', '#f8a8cc', '#ffe0f0'], d: ['#f8d8e8', '#fff0f8', '#ffffff'] }, flat: { n: '#ff6a9a', p: '#ff5a8a' }, outline: '#5a2040' },
    { ramps: { a: ['#4ab0a0', '#7ad8c8', '#c8fff0'], d: ['#c8f0e8', '#e8fff8', '#ffffff'] }, flat: { n: '#ffb0d0' }, outline: '#1c4a44' },
  ],
  goron: [
    { ramps: { a: ['#6a6a78', '#9a9aa8', '#d0d0dc'], d: ['#8a8a96', '#b8b8c4', '#e0e0ea'], e: MOSS }, outline: '#2a2a34' },
    { ramps: { a: ['#9a5030', '#c87850', '#f0b088'], d: ['#b88a60', '#e0b890', '#fff0d0'], e: MOSS }, outline: '#4a2010' },
    { ramps: { a: ['#3a5a9a', '#5a88c8', '#a8d0ff'], d: ['#70a0d8', '#a8d8ff', '#e8f8ff'], e: ['#9a50d0', '#c080f0', '#f0c8ff'] }, outline: '#18284a' },
    { ramps: { a: ['#a07018', '#d8a830', '#fff090'], d: ['#e0b840', '#ffe070', '#fffad0'], e: ['#40a8a0', '#60d8c8', '#b0fff0'] }, outline: '#4a3008' },
  ],
  piko: [
    { ramps: { a: ['#e0a818', '#f8d038', '#fff4a0'], d: ['#f0e0a0', '#fff4d0', '#ffffff'], e: ['#e06020', '#f88830', '#ffc070'], y: BEAK }, outline: '#5a3a08' },
    { ramps: { a: ['#b8c0d0', '#e8eef8', '#ffffff'], d: ['#d8e0ec', '#f4f8ff', '#ffffff'], e: ['#d03030', '#f05050', '#ff9090'], y: BEAK }, outline: '#3a4050' },
    { ramps: { a: ['#3a88d0', '#68b8f0', '#b8e8ff'], d: ['#c0e0f8', '#e0f0ff', '#ffffff'], e: ['#2a4aa0', '#4a6ad0', '#90a8ff'], y: ['#d0a010', '#f8d030', '#fff0a0'] }, outline: '#183a60' },
    { ramps: { a: ['#d03860', '#f86890', '#ffb0c8'], d: ['#f8c8d8', '#ffe8f0', '#ffffff'], e: ['#f0c020', '#ffe040', '#fff8a0'], y: BEAK }, outline: '#5a1028' },
  ],
  fuwari: [
    { ramps: { a: ['#a8a0d8', '#e0dcf8', '#ffffff'], e: ['#5ab0f0', '#88d8ff', '#e0f8ff'] }, outline: '#3a3468' },
    { ramps: { a: ['#58c0a0', '#98e8c8', '#e0fff0'], e: ['#e0b020', '#f8d840', '#fff8b0'] }, outline: '#1c4a3a' },
    { ramps: { a: ['#e07020', '#f8a040', '#ffd890'], e: ['#3a9a30', '#60c040', '#b0f080'] }, outline: '#5a2808' },
    { ramps: { a: ['#2a2440', '#4a4070', '#7a70b0'], e: ['#c040f0', '#e080ff', '#ffd0ff'] }, outline: '#0e0a1c', flat: { m: '#e080ff' } },
  ],
}

/** モンスターの いろ（UI の わくの いろに つかう）。 */
export function monsterColor(species: SpeciesId, variant: number) {
  const look = LOOKS[species][variant] ?? LOOKS[species][0]
  return { main: look.ramps.a[1], light: look.ramps.a[2], dark: look.outline }
}

export type Expr = 'normal' | 'blink' | 'happy' | 'hurt' | 'tired'

// め（2×3）。'.' は そのまま。happy は 3はばで そとがわへ はみだす。
const EYES: Record<Expr, { left: readonly string[]; right: readonly string[]; wide?: boolean }> = {
  normal: { left: ['wk', 'kk', 'kk'], right: ['wk', 'kk', 'kk'] },
  blink: { left: ['..', '..', 'kk'], right: ['..', '..', 'kk'] },
  tired: { left: ['..', 'kk', 'kk'], right: ['..', 'kk', 'kk'] },
  hurt: { left: ['k.', '.k', 'k.'], right: ['.k', 'k.', '.k'] },
  happy: { left: ['.k.', 'k.k', '...'], right: ['.k.', 'k.k', '...'], wide: true },
}

/** かたちと しるしを 22×22 の もじの えに する。 */
export function bodyRows(species: SpeciesId): string[] {
  const body = BODIES[species]
  const rows = body.half.map(row => (row + [...row].reverse().join('')).split(''))
  const put = (x: number, y: number, ch: string) => { if (rows[y]?.[x] !== undefined && rows[y][x] !== '.') rows[y][x] = ch }
  for (const [x, y, ch] of body.sym ?? []) { put(x, y, ch); put(BODY_W - 1 - x, y, ch) }
  for (const [x, y, ch] of body.marks ?? []) put(x, y, ch)
  return rows.map(r => r.join(''))
}

export function eyeSpots(species: SpeciesId): [[number, number], [number, number]] {
  const [x, y] = BODIES[species].eye
  return [[x, y], [BODY_W - 2 - x, y]]
}

const monsterCache = new Map<string, Img | null>()
/** 24×24 の モンスターの え（ふちどり こみ）。canvas が つかえない ところでは null。 */
export function monsterImage(species: SpeciesId, variant: number, expr: Expr = 'normal'): Img | null {
  const key = `${species}:${variant}:${expr}`
  if (!monsterCache.has(key)) {
    const look = LOOKS[species][variant] ?? LOOKS[species][0]
    const [[lx, ly], [rx, ry]] = eyeSpots(species)
    const eyes = EYES[expr]
    const img = shadeRows(bodyRows(species), look, ctx => {
      const draw = (glyph: readonly string[], ox: number, oy: number) => glyph.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.') return
        ctx.fillStyle = ch === 'w' ? WHITE : EYE
        ctx.fillRect(ox + x, oy + y, 1, 1)
      }))
      draw(eyes.left, eyes.wide ? lx - 1 : lx, ly)
      draw(eyes.right, rx, ry)
    })
    monsterCache.set(key, img)
  }
  return monsterCache.get(key) ?? null
}

const flashCache = new Map<string, Img | null>()
/** ひかった え（ダメージ・うまれる ときの ひかり）や かげえ。 */
export function monsterTinted(species: SpeciesId, variant: number, color: string, expr: Expr = 'normal'): Img | null {
  const key = `${species}:${variant}:${expr}:${color}`
  if (!flashCache.has(key)) {
    const img = monsterImage(species, variant, expr)
    flashCache.set(key, img ? flashed(img, color) : null)
  }
  return flashCache.get(key) ?? null
}

// ---------------- こもの（アイコン） ----------------

const STONE_ROWS = [
  '...aaaa...',
  '..aaaaaa..',
  '.aaaaaaaa.',
  '.aaaaaaaa.',
  'aaaaaaaaaa',
  'aaaaaaaaaa',
  'aaaaaaaaaa',
  'aaaaaaaaaa',
  'aaaaaaaaaa',
  '.aaaaaaaa.',
  '.aaaaaaaa.',
  '..aaaaaa..',
]

function ramp(color: string): Ramp {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16))
  const tone = (f: number, add: number) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v * f + add))).toString(16).padStart(2, '0')).join('')
  return [tone(.62, 0), color, tone(.6, 110)]
}

const stoneCache = new Map<string, Img | null>()
/** ふしぎな いし。まんなかに ひかる もよう。 */
export function stoneImage(color: string): Img | null {
  if (!stoneCache.has(color)) {
    const rows = STONE_ROWS.map(r => r.split(''))
    for (const [x, y] of [[4, 4], [5, 4], [6, 5], [5, 6], [4, 6], [3, 7], [4, 8], [5, 8], [6, 8]]) rows[y][x] = 'g'
    rows[2][3] = 'w'
    rows[3][2] = 'w'
    const r = ramp(color)
    stoneCache.set(color, shadeRows(rows.map(row => row.join('')), { ramps: { a: r }, flat: { g: r[2] }, outline: ramp(r[0])[0] }))
  }
  return stoneCache.get(color) ?? null
}

const SNACK_ART: Record<SnackId, { rows: readonly string[]; look: Look }> = {
  meat: {
    rows: [
      '............',
      '.bb.........',
      'bbbb........',
      '.bbaaaa.....',
      '..aaaaaaa...',
      '.aaaaaaaaa..',
      '.aaaaaaaaa..',
      '.aaaaaaaaa..',
      '..aaaaaaa...',
      '....aaaabb..',
      '........bbbb',
      '.........bb.',
    ],
    look: { ramps: { a: ['#a03c20', '#d8643a', '#f8a070'], b: ['#d8d0c0', '#f8f4ec', '#ffffff'] }, outline: '#401808' },
  },
  fish: {
    rows: [
      '............',
      '............',
      '...aaaa.....',
      '.aaaaaaaa..a',
      'aakaaaaaaaaa',
      'aaaaaaaaaaa.',
      '.aaaaaaaaaaa',
      '..aaaaaaa..a',
      '....aaa.....',
      '............',
    ],
    look: { ramps: { a: ['#3a70b8', '#5a9ae0', '#b0dcff'] }, outline: '#142a50' },
  },
  fruit: {
    rows: [
      '.....g......',
      '.....gll....',
      '..aaagaaa...',
      '.aaaaaaaaa..',
      'aaaaaaaaaaa.',
      'aaaaaaaaaaa.',
      'aaaaaaaaaaa.',
      'aaaaaaaaaaa.',
      '.aaaaaaaaa..',
      '..aaa.aaa...',
    ],
    look: { ramps: { a: ['#b8202c', '#e83c40', '#ff9a90'], l: ['#3a8a30', '#5cb848', '#a0e078'] }, flat: { g: '#6a4020' }, outline: '#4a0c10' },
  },
  cookie: {
    rows: [
      '...aaaaa....',
      '.aaaaaaaaa..',
      '.aacaaaaca..',
      'aaaaaaaaaaa.',
      'aaaaacaaaaa.',
      'aacaaaaaaca.',
      'aaaaaaaaaaa.',
      '.aaaaacaaa..',
      '.aaaaaaaaa..',
      '...aaaaa....',
    ],
    look: { ramps: { a: ['#b07830', '#e0aa58', '#f8d898'] }, flat: { c: '#5a3018' }, outline: '#4a2808' },
  },
}

const snackCache = new Map<SnackId, Img | null>()
export function snackImage(id: SnackId): Img | null {
  if (!snackCache.has(id)) snackCache.set(id, shadeRows(SNACK_ART[id].rows, SNACK_ART[id].look))
  return snackCache.get(id) ?? null
}

export type IconId = 'rock' | 'book' | 'shoe' | 'water' | 'log' | 'heart' | 'trophy' | 'star' | 'moon' | 'medal'

const ICON_ART: Record<IconId, { rows: readonly string[]; look: Look }> = {
  rock: {
    rows: [
      '............',
      '....aaaa....',
      '..aaaaaaaa..',
      '.aaaaaaxaaa.',
      '.aaaaaaxaaa.',
      'aaaaaaxaaaaa',
      'aaaaaaaxaaaa',
      'aaaaaaaaaaaa',
      '.aaaaaaaaaa.',
    ],
    look: { ramps: { a: ['#6a6a78', '#9a9aa8', '#d0d0dc'] }, outline: '#2a2a34' },
  },
  book: {
    rows: [
      '.aaaaaaaaaa.',
      '.abbbbbbbba.',
      '.abwwwwwwba.',
      '.abbbbbbbba.',
      '.abwwwwwba..',
      '.abbbbbbbba.',
      '.abbbbbbbba.',
      '.aaaaaaaaaa.',
      '.cccccccccc.',
    ],
    look: { ramps: { a: ['#a02c3c', '#d84a5a', '#ff9aa0'], b: ['#d8c8a8', '#f8ecd0', '#fffaf0'], c: ['#d8d0c0', '#f8f4ec', '#ffffff'] }, flat: { w: '#8a7a68' }, outline: '#401018' },
  },
  shoe: {
    rows: [
      '...aaaa.....',
      '...awaa.....',
      '...aawa.....',
      '...aaaaaa...',
      '..aaaaaaaaa.',
      '.aaaaaaaaaaa',
      '.bbbbbbbbbbb',
    ],
    look: { ramps: { a: ['#2a7ad0', '#4aa0f0', '#a0d8ff'], b: ['#d8d8d8', '#ffffff', '#ffffff'] }, outline: '#102a50' },
  },
  water: {
    rows: [
      '.....a......',
      '.....a......',
      '....aaa.....',
      '....aaa.....',
      '...aaaaa....',
      '..aaaaaaa...',
      '..aawaaaa...',
      '..awaaaaa...',
      '...aaaaa....',
      '....aaa.....',
    ],
    look: { ramps: { a: ['#2a7ad0', '#4ab0f0', '#b0e8ff'] }, outline: '#10305a' },
  },
  log: {
    rows: [
      '..aaaaaaaaa.',
      '.aaaaaaaabba',
      '.aaaaaaabcbb',
      '.aaaaaaabbcb',
      '.aaaaaaabbbb',
      '..aaaaaaabb.',
    ],
    look: { ramps: { a: ['#7a4420', '#a8683a', '#d8a068'], b: ['#d0a060', '#f0d090', '#fff0c0'] }, flat: { c: '#a8683a' }, outline: '#3a1c08' },
  },
  heart: {
    rows: [
      '.aa.aa.',
      'awaaaaa',
      'aaaaaaa',
      '.aaaaa.',
      '..aaa..',
      '...a...',
    ],
    look: { ramps: { a: ['#d02050', '#ff4a78', '#ff9ab4'] }, outline: '#5a0c24' },
  },
  trophy: {
    rows: [
      'aaaaaaaaaa',
      'a.aaaaaa.a',
      'a.aaaaaa.a',
      '.aaaaaaaa.',
      '..aaaaaa..',
      '....aa....',
      '....aa....',
      '..bbbbbb..',
      '..bbbbbb..',
    ],
    look: { ramps: { a: ['#c08a18', '#f0c030', '#fff0a0'], b: ['#6a4020', '#8a5a30', '#b07a48'] }, outline: '#4a3008' },
  },
  star: {
    rows: [
      '...a...',
      '...a...',
      '..aaa..',
      'aaaaaaa',
      '.aaaaa.',
      '.aa.aa.',
      'aa...aa',
    ],
    look: { ramps: { a: ['#e0a010', '#ffd838', '#fff4b0'] }, outline: '#5a3a00' },
  },
  moon: {
    rows: [
      '..aaa..',
      '.aa....',
      'aa.....',
      'aa.....',
      'aa.....',
      '.aa....',
      '..aaa..',
    ],
    look: { ramps: { a: ['#e0b020', '#ffe060', '#fff8c0'] }, outline: '#4a3800' },
  },
  medal: {
    rows: [
      '.bb..bb.',
      '..bbbb..',
      '..aaaa..',
      '.aaaaaa.',
      'aaawwaaa',
      'aaawwaaa',
      '.aaaaaa.',
      '..aaaa..',
    ],
    look: { ramps: { a: ['#c08a18', '#f0c030', '#fff0a0'], b: ['#b02030', '#e04050', '#ff8a90'] }, outline: '#4a3008' },
  },
}

const iconCache = new Map<IconId, Img | null>()
export function iconImage(id: IconId): Img | null {
  if (!iconCache.has(id)) iconCache.set(id, shadeRows(ICON_ART[id].rows, ICON_ART[id].look))
  return iconCache.get(id) ?? null
}

/** テスト用: え の もじの しゅるいを しらべる。 */
export const SPRITE_DATA = { BODIES, LOOKS, SNACK_ART, ICON_ART }
