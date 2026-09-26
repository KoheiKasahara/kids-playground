// 手で うった ドット絵。1もじ＝1ドット、'.' は とうめい。
// 色は すべて パレットの もじで きめる（SFC の ように 1まいの 絵に つかう 色を しぼる）。

import { canvasFromPixels, pack } from './pixel'

export type Palette = Record<string, string>
export type SpriteArt = { rows: readonly string[]; palette: Palette }

/** 主人公の パレット。りんかくは まっくろではなく こい むらさき（SFC らしい やわらかさ）。 */
const HERO: Palette = {
  o: '#2b1a32',
  h: '#5a2c1c', H: '#8a4424', j: '#c06a30', J: '#eaa050',
  s: '#c8744c', S: '#f4b684', L: '#ffdcb4',
  e: '#2b1a32', w: '#ffffff', m: '#b8504a',
  r: '#9a2230', R: '#dc3c3c', q: '#ff8a64',
  t: '#1c4474', T: '#2c6cb4', u: '#58a4e4', U: '#9cd4ff',
  b: '#5e3a1e', B: '#f0c040',
  p: '#34284c', P: '#58487a',
  x: '#3c2014', X: '#7a4424', y: '#b4703c',
}

// ---- 主人公：まえ（した むき） ----
const HEAD_DOWN = [
  '......oooo......',
  '....ooJJjjoo....',
  '...oJJjjjjjHo...',
  '..oJjjjjjjjHHo..',
  '..ojjjjjjjHHHo..',
  '.ojjHjjjjHHHHho.',
  '.ohjHHjjHHHHhho.',
  '.ohHSSHHHHSSHho.',
  '.ohSLLSSSSSSShho',
  '.ohSLeSSSSeSShho',
  '..oSSeSSSSeSso..',
  '..osSSSmmSSsso..',
]
const BODY_DOWN = [
  '...orqRRRRRro...',
  '..oTrRRRRRRrto..',
  '.oTuTTrRRrTTtto.',
  '.oSuTTTrrTTTtSo.',
  '.osouTTTTTTtoso.',
  '..obbbbBBbbbbo..',
  '..oTuTTTTTTTto..',
  '..optPPPPPPpto..',
]
const BODY_DOWN_SWING = [
  '...orqRRRRRro...',
  '..oTrRRRRRRrto..',
  '.oTuTTrRRrTTtto.',
  '.oTuTTTrrTTTtSo.',
  '.oSuTTTTTTTtoso.',
  '.osbbbbBBbbbbo..',
  '..oTuTTTTTTTto..',
  '..optPPPPPPpto..',
]
const LEGS_DOWN = [
  [
    '...oPPpo.oPPpo..',
    '...opPpo.opPpo..',
    '...oyXxo.oyXxo..',
    '...ooooo.ooooo..',
  ],
  [
    '...oPPpo.oPPpo..',
    '...opPpo.oyXxo..',
    '...oyXxo.ooooo..',
    '...ooooo........',
  ],
]

// ---- 主人公：うしろ（うえ むき） ----
const HEAD_UP = [
  '......oooo......',
  '....ooJJjjoo....',
  '...oJJjjjjjHo...',
  '..oJjjjjjjjHHo..',
  '..ojjjjjjjHHHo..',
  '.ojjHjjjjHHHHho.',
  '.ojjjHjjjHHHhho.',
  '.ohjjjHHHHHHhho.',
  '.ohHjjHHHHHHhhoo',
  '.ohHHHHHHHHhhho.',
  '..ohHHHHHHHhho..',
  '..oshhhhhhhhso..',
]
const BODY_UP = [
  '...orRRRRRRro...',
  '..oTrRRRRRRrto..',
  '.oTuTTTRrTTTtto.',
  '.oSuTTTRrTTTtSo.',
  '.osouTTqRTTtoso.',
  '..obbbbbbbbbbo..',
  '..oTuTTTTTTTto..',
  '..optPPPPPPpto..',
]
const BODY_UP_SWING = [
  '...orRRRRRRro...',
  '..oTrRRRRRRrto..',
  '.oTuTTTRrTTTtto.',
  '.oTuTTTRrTTTtSo.',
  '.oSuTTTqRTTtoso.',
  '.osbbbbbbbbbbo..',
  '..oTuTTTTTTTto..',
  '..optPPPPPPpto..',
]

// ---- 主人公：よこ（みぎ むき。ひだりは はんてん） ----
const HEAD_SIDE = [
  '.....oooo.......',
  '...ooJJjjoo.....',
  '..oJJjjjjjHo....',
  '.oJjjjjjjjHHo...',
  '.ojjjjjjjHHHHo..',
  'ojjjHjjjHHHHSSo.',
  'ohjHHjjHHHHSSSo.',
  'ohHHHHHHHHSSLSo.',
  'ohhHHHHHHSSSSSSo',
  'ohhhHHHHhSSSeSSo',
  '.ohhhhhhhsSSeSo.',
  '..ohhhhhosSSmso.',
]
const BODY_SIDE = [
  '....orRRRRRro...',
  '...ouRqRRRrro...',
  '..ouTTrRRRTto...',
  '..oTuTTTrqTto...',
  '..otTTSSTTtto...',
  '...obbbSbbbo....',
  '...oTuTTTTto....',
  '...optPPPPpo....',
]
const BODY_SIDE_SWING = [
  '....orRRRRRro...',
  '...ouRqRRRrro...',
  '..ouTTrRRRTto...',
  '..oTuTTTrqTSSo..',
  '..otTTTTTTtso...',
  '...obbbbbbbo....',
  '...oTuTTTTto....',
  '...optPPPPpo....',
]
const LEGS_SIDE = [
  [
    '....oPPppo......',
    '....opPPpo......',
    '....oyXXxxo.....',
    '....oooooooo....',
  ],
  [
    '...oPPo.oppo....',
    '..oyXpo.opPpo...',
    '..oooo..oyXXxo..',
    '........oooooo..',
  ],
  [
    '...oppo.oPPo....',
    '..opPpo.oyXpo...',
    '..oyXXxo.ooo....',
    '..oooooo........',
  ],
]
const LEGS_UP = [
  [
    '...oPPpo.oPPpo..',
    '...opPpo.opPpo..',
    '...oxXxo.oxXxo..',
    '...ooooo.ooooo..',
  ],
  [
    '...oPPpo.oPPpo..',
    '...oxXxo.opPpo..',
    '...ooooo.oxXxo..',
    '.........ooooo..',
  ],
]

export type Facing = 'down' | 'up' | 'side'

/**
 * 主人公の 1コマを くみたてる（16x25）。step: 0=たち、1=みぎあし、2=たち、3=ひだりあし。
 * あるく コマでは 上半身が 1ドット はずむ（SFC の RPG らしい あるきかた）。
 */
export function heroRows(facing: Facing, step: number): string[] {
  const moving = step % 2 === 1
  const other = step === 3
  const head = facing === 'down' ? HEAD_DOWN : facing === 'up' ? HEAD_UP : HEAD_SIDE
  let body = facing === 'down' ? (moving ? BODY_DOWN_SWING : BODY_DOWN) : facing === 'up' ? (moving ? BODY_UP_SWING : BODY_UP) : (moving ? BODY_SIDE_SWING : BODY_SIDE)
  let legs: readonly string[]
  if (facing === 'side') legs = LEGS_SIDE[moving ? (other ? 2 : 1) : 0]
  else {
    const set = facing === 'down' ? LEGS_DOWN : LEGS_UP
    legs = moving ? set[1] : set[0]
    // まえ・うしろは 左右を いれかえて ぎゃくの 足を だす。
    if (moving && other) { legs = legs.map(mirrorRow); body = body.map(mirrorRow) }
  }
  const blank = '.'.repeat(16)
  if (moving) return [...head, ...body, legs[0], ...legs]
  return [blank, ...head, ...body, ...legs]
}

function mirrorRow(row: string) {
  return row.split('').reverse().join('')
}

export const HERO_PALETTE = HERO

// ---- カニ ----
const CRAB: Palette = { o: '#3a1414', r: '#9c2a1c', R: '#e0482c', q: '#ff9060', w: '#ffffff', e: '#1a0a0a', y: '#ffd0a0' }
export const CRAB_FRAMES: readonly SpriteArt[] = [
  {
    palette: CRAB, rows: [
      '.oo..........oo.',
      'oqRo........oRqo',
      'oRRo.o....o.oRRo',
      '.oRooweoowe.oRo.',
      '..oo.oo..oo.oo..',
      '...oqRRRRRRro...',
      '..oqRRRRRRRRro..',
      '.orRRRyRRyRRRro.',
      '.orrRRRRRRRRrro.',
      '..orrrrrrrrrro..',
      '.o.o.o.oo.o.o.o.',
      'o..o..o..o..o..o',
    ],
  },
  {
    palette: CRAB, rows: [
      '................',
      '.oo..........oo.',
      'oqRo.o....o.oRqo',
      'oRRooweoowe.oRRo',
      '.ooo.oo..oo.ooo.',
      '...oqRRRRRRro...',
      '..oqRRRRRRRRro..',
      '.orRRRyRRyRRRro.',
      '.orrRRRRRRRRrro.',
      '..orrrrrrrrrro..',
      '..o.o.o..o.o.o..',
      '.o..o.o..o.o..o.',
    ],
  },
]

// ---- ペンギン ----
const PENGUIN: Palette = {
  o: '#10182a', k: '#243048', K: '#3a4a6a', w: '#f4f8ff', W: '#c8d4ea',
  e: '#10182a', y: '#e08a10', Y: '#ffc848', p: '#ff9ab0', f: '#ff9020',
}
/** よちよち あるく 2コマ。 */
export const PENGUIN_FRAMES: readonly SpriteArt[] = [
  {
    palette: PENGUIN, rows: [
      '.....oooooo.....',
      '....okKKKKko....',
      '...okKKKKKKko...',
      '...okwwKKwwko...',
      '..okwewwwwewko..',
      '..okwpwYYwpwko..',
      '.okkwwwyywwwkko.',
      'okKkwwwwwwwwkKko',
      'okKkwwwwwwwwkKko',
      '.okkwwwwwwwwkko.',
      '..okWwwwwwwWko..',
      '..okkWWWWWWkko..',
      '...ookkkkkkoo...',
      '...offo..offo...',
      '...oooo..oooo...',
    ],
  },
  {
    palette: PENGUIN, rows: [
      '................',
      '.....oooooo.....',
      '....okKKKKko....',
      '...okKKKKKKko...',
      '...okwwKKwwko...',
      '..okwewwwwewko..',
      '..okwpwYYwpwko..',
      '.okkwwwyywwwkko.',
      'okKkwwwwwwwwkKko',
      'okKkwwwwwwwwkKko',
      '.okkwwwwwwwwkko.',
      '..okWwwwwwwWko..',
      '..okkWWWWWWkko..',
      '...ookkkkkkoo...',
      '..offoo..ooffo..',
    ],
  },
]

// ---- たからばこ ----
const CHEST: Palette = {
  o: '#2a160c', b: '#5a2e14', B: '#8a4a20', c: '#b86a2c', C: '#dc9a4c',
  g: '#a86a10', G: '#f0b828', Y: '#fff08a', k: '#3a2410', d: '#1a0c06',
}
export const CHEST_CLOSED: SpriteArt = {
  palette: CHEST, rows: [
    '..oooooooooooo..',
    '.oCCCCGGGCCCCco.',
    'oCcccgGYGgcccbbo',
    'oGGGGGGGGGGGGGGo',
    'ogggggGYGgggggGo',
    'oBBBBBoGoBBBBBbo',
    'ocCCCCgGgCCCCbbo',
    'ocCCCCoGoCCCCbbo',
    'ocCccCgggCccCbbo',
    'oGGGGGGGGGGGGGgo',
    'ocCCCCCCCCCCCbbo',
    'ocCCCCCCCCCCCbbo',
    'obbbbbbbbbbbbbbo',
    '.oooooooooooooo.',
  ],
}
export const CHEST_OPEN: SpriteArt = {
  palette: CHEST, rows: [
    '..oooooooooooo..',
    '.oCCCCGGGCCCCco.',
    'oCcccgGYGgcccbbo',
    'oGGGGGGGGGGGGGGo',
    'odddddddddddddo.',
    'odkkkkkkkkkkkdo.',
    'oGGGGGGGGGGGGGgo',
    'ocCCCCoGoCCCCbbo',
    'ocCccCgggCccCbbo',
    'oGGGGGGGGGGGGGgo',
    'ocCCCCCCCCCCCbbo',
    'ocCCCCCCCCCCCbbo',
    'obbbbbbbbbbbbbbo',
    '.oooooooooooooo.',
  ],
}

// ---- ハートと きらきら ----
export const HEART: SpriteArt = {
  palette: { o: '#6a1030', r: '#e83c64', R: '#ff7c9c', w: '#ffffff' },
  rows: [
    '.oo.oo.',
    'oRwRrro',
    'oRRrrro',
    '.orrro.',
    '..oro..',
    '...o...',
  ],
}

export const NOTE: SpriteArt = {
  palette: { o: '#1a2a5a', w: '#ffffff', y: '#fff0a0' },
  rows: [
    '..oooo',
    '..owyo',
    '..oo.o',
    '..o..o',
    'ooo.oo',
    'owoowo',
    'ooo.oo',
  ],
}

/** はっぱ（おちば）・ちょうちょ の ちいさな 絵。 */
export const BUTTERFLY: readonly SpriteArt[] = [
  { palette: { o: '#3a1a40', a: '#ffd23f', b: '#ffffff' }, rows: ['oa.ao', 'aboba', '.aoa.'] },
  { palette: { o: '#3a1a40', a: '#ffd23f', b: '#ffffff' }, rows: ['.....', 'oaoao', '.aoa.'] },
]

export function spritePixels({ rows, palette }: SpriteArt): { w: number; h: number; pixels: Uint32Array } {
  const h = rows.length
  const w = Math.max(...rows.map(r => r.length))
  const pixels = new Uint32Array(w * h)
  const cache: Record<string, number> = {}
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x]
      if (c === '.' || c === ' ') continue
      const color = palette[c]
      if (!color) continue
      pixels[y * w + x] = cache[c] ??= pack(color)
    }
  })
  return { w, h, pixels }
}

/** 絵を canvas に する。flip で 左右 はんてん。 */
export function spriteCanvas(art: SpriteArt, flip = false): HTMLCanvasElement | null {
  const { w, h, pixels } = spritePixels(art)
  if (flip) {
    const out = new Uint32Array(w * h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = pixels[y * w + (w - 1 - x)]
    return canvasFromPixels(w, h, out)
  }
  return canvasFromPixels(w, h, pixels)
}

// ---- じめんの こもの ----
export const SHELL: SpriteArt = {
  palette: { o: '#7a3a4a', p: '#ffb0c0', P: '#ffe0e8', q: '#e07890' },
  rows: ['.oPo.', 'oPpPo', 'opqpo', '.ooo.'],
}
export const STARFISH: SpriteArt = {
  palette: { o: '#8a3010', y: '#ff9a3c', Y: '#ffd080' },
  rows: ['..o..', 'ooYoo', '.oyo.', 'o.o.o'],
}
export const LILY: SpriteArt = {
  palette: { o: '#0c3a1c', g: '#2c8a3a', G: '#5cbc4c', H: '#9ce070' },
  rows: ['..ooooo..', '.oHGGoGo.', 'oGGGGogGo', 'oGgGGGggo', '.oggggoo.', '..oooo...'],
}
export const LILY_FLOWER: SpriteArt = {
  palette: { o: '#0c3a1c', g: '#2c8a3a', G: '#5cbc4c', H: '#9ce070', p: '#ff8ab0', P: '#ffe0ec', y: '#ffe060' },
  rows: ['...oPo...', '.ooPyPoo.', 'oGpPPPpGo', 'oGgpppggo', '.oggggoo.', '..oooo...'],
}

// ---- たからもの ----
export const CROWN: SpriteArt = {
  palette: { o: '#4a2400', g: '#c07810', G: '#f0b828', Y: '#fff08a', r: '#e02848', b: '#3080ff', w: '#ffffff' },
  rows: [
    '.o....o....o.',
    'oYo..oYo..oYo',
    'oGo.oGwGo.oGo',
    'oGGoGGGGGoGGo',
    'oGYGGGGGGGYGo',
    'oGGrGGbGGrGGo',
    'oggGGGGGGGggo',
    'oYYYYYYYYYYYo',
    '.ooooooooooo.',
  ],
}
export const RAINBOW_SHELL: SpriteArt = {
  palette: { o: '#5a2a5a', a: '#ff8ab0', b: '#ffd060', c: '#80e0a0', d: '#70b8ff', e: '#c098ff', w: '#ffffff' },
  rows: [
    '....ooooo....',
    '..oowabcdoo..',
    '.owabbcdddeo.',
    'oaabbccdddeeo',
    'oaabbccddeeeo',
    '.oabbccddeeo.',
    '..oabccddeo..',
    '...ooooooo...',
    '....oo.oo....',
  ],
}
export const SNOW_CRYSTAL: SpriteArt = {
  palette: { o: '#1c3a6a', b: '#5aa0e8', B: '#a8dcff', w: '#ffffff' },
  rows: [
    '.....oBo.....',
    '..o..oBo..o..',
    '.obo.oBo.obo.',
    '..oboBBBobo..',
    '...obBwBbo...',
    'oooooBwBooooo',
    'oBBBBwwwBBBBo',
    'oooooBwBooooo',
    '...obBwBbo...',
    '..oboBBBobo..',
    '.obo.oBo.obo.',
    '..o..oBo..o..',
    '.....oBo.....',
  ],
}
