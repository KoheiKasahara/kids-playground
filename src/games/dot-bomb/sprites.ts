// てで うった ドット絵（1もじ＝1ドット、'.' は とうめい）。いろは パレットの もじで きめる。
// ポン・ピョンタ・てき・アイテムの え。ボスや ブロック・ひ などは art.ts が その場で かく。

import { mirrorRows } from './pixel'
import type { EnemyKind, RideColor } from './stages'

export const OUTLINE = '#1d1433'

// ---------------- ポン ----------------

export const HERO_PAL = {
  k: OUTLINE, w: '#ffffff', f: '#8a6a4a',
  b: '#3d74ff', B: '#2447b0', l: '#a6ccff',
  s: '#ffdcb8', S: '#f0ad86', p: '#ff86a2',
  r: '#ff4d5e', R: '#b52a44',
  y: '#ffd23c', Y: '#d9921c',
  g: '#ffffff', G: '#c6cde6',
  o: '#9a5430', O: '#5e2c18',
}

function patch(rows: readonly string[], dots: [number, number, string][]) {
  const out = rows.map(r => [...r])
  for (const [x, y, ch] of dots) out[y][x] = ch
  return out.map(r => r.join(''))
}

const HEAD_FRONT = patch(mirrorRows([
  '.......f',
  '.....kkf',
  '....kbbb',
  '...kbllb',
  '..kbllbb',
  '..kblbbb',
  '.kbbkkkk',
  '.kbkswks',
  '.kbkskks',
  '.kBkpsss',
  '..kkSsss',
]), [[9, 3, 'b'], [10, 3, 'b'], [11, 3, 'B'], [10, 4, 'b'], [11, 4, 'b'], [12, 4, 'B'], [11, 5, 'B'], [12, 5, 'B'], [13, 6, 'B'],
  [9, 7, 'w'], [10, 7, 'k'], [13, 7, 'B'], [13, 8, 'B']])

const HEAD_BACK = patch(mirrorRows([
  '.......f',
  '.....kkf',
  '....kbbb',
  '...kbbbb',
  '..kbbbbb',
  '..kbbbbb',
  '.kbbbbbb',
  '.kbbbbbb',
  '.kBbbbbb',
  '.kBBbbbb',
  '..kBBBBB',
]), [[5, 3, 'l'], [6, 3, 'l'], [4, 4, 'l'], [5, 4, 'l'], [4, 5, 'l'], [12, 5, 'B'], [13, 6, 'B'], [13, 7, 'B'], [12, 8, 'B']])

const HEAD_SIDE = [
  '........f.......',
  '......kkfkk.....',
  '....kkbbbbbkk...',
  '...kbllbbbbbbk..',
  '..kbllbbbbbbbbk.',
  '..kblbbbbbbbbbk.',
  '.kbbbbbbkkkkkkk.',
  '.kbbbbbkssswksk.',
  '.kBbbbbkssskksk.',
  '.kBBbbbkspssssk.',
  '..kBBBBkSssssk..',
]

const BODY = {
  front: {
    stand: ['...krrrrrrrrk...', '..kgkyyyyyykgk..', '...kkyyYYyykk...', '....kyykkyyk....', '...kook..kook...'],
    a: ['...krrrrrrrrk...', '..kgkyyyyyykgk..', '...kkyyYYyykk...', '....kyyk.kook...', '...kook.........'],
    b: ['...krrrrrrrrk...', '..kgkyyyyyykgk..', '...kkyyYYyykk...', '...kook.kyyk....', '.........kook...'],
  },
  back: {
    stand: ['...krrrRRrrrk...', '..kgkyyyyyykgk..', '...kkyyyyyykk...', '....kyykkyyk....', '...kook..kook...'],
    a: ['...krrrRRrrrk...', '..kgkyyyyyykgk..', '...kkyyyyyykk...', '....kyyk.kook...', '...kook.........'],
    b: ['...krrrRRrrrk...', '..kgkyyyyyykgk..', '...kkyyyyyykk...', '...kook.kyyk....', '.........kook...'],
  },
  side: {
    stand: ['...krrrrrrrrk...', '..Rkyyyyykgk....', '...kkyyYyyk.....', '....kyyyyyk.....', '....kookkook....'],
    a: ['...krrrrrrrrk...', '..Rkyyyyykgk....', '...kkyyYyyk.....', '...kyyk.kyyk....', '..kook....kook..'],
    b: ['...krrrrrrrrk...', '..Rkyyyyykgk....', '...kkyyYyyk.....', '.....kyyyk......', '.....kookook....'],
  },
} as const

export type HeroFacing = 'front' | 'back' | 'side'
export type HeroStep = 'stand' | 'a' | 'b'

export function heroRows(facing: HeroFacing, step: HeroStep) {
  const head = facing === 'front' ? HEAD_FRONT : facing === 'back' ? HEAD_BACK : HEAD_SIDE
  return [...head, ...BODY[facing][step]]
}

/** ばんざいの ポーズ（クリア）。 */
export const HERO_CHEER = [
  ...HEAD_FRONT.slice(0, 9),
  'g' + HEAD_FRONT[9].slice(1, 15) + 'g',
  'k' + HEAD_FRONT[10].slice(1, 15) + 'k',
  '.kkrrrrrrrrrrkk.',
  '..kkyyyyyyyykk..',
  '...kkyyYYyykk...',
  '....kyykkyyk....',
  '...kook..kook...',
]

/** めを とじた（いたい・ミス）。 */
export const HERO_OUCH = patch(heroRows('front', 'stand'), [[5, 7, 's'], [6, 7, 's'], [9, 7, 's'], [10, 7, 's'], [5, 8, 'k'], [6, 8, 'k'], [9, 8, 'k'], [10, 8, 'k']])

// ---------------- ピョンタ（のりもの） ----------------

export const RIDE_PALS: Record<RideColor, { c: string; C: string; h: string }> = {
  green: { c: '#5fd35a', C: '#2f9a45', h: '#b6f59a' },
  blue: { c: '#4fb6ff', C: '#2a6fd0', h: '#b8e8ff' },
  pink: { c: '#ff8fc8', C: '#d9529a', h: '#ffd0ea' },
  yellow: { c: '#ffd33a', C: '#d68f12', h: '#fff2a0' },
}

export function ridePalette(color: RideColor) {
  return { k: OUTLINE, w: '#ffffff', m: '#fff1d6', M: '#e8c79c', p: '#ff9ab4', n: '#7a3a3a', ...RIDE_PALS[color] }
}

export const RIDE_SIDE = [
  '..........kk....',
  '.........kpck...',
  '.........kpck...',
  '........kkpckk..',
  '.......khccccck.',
  '.......kcccwkcck',
  '.......kccckkcmk',
  '..kkk..kcccccmnk',
  '.kcchkkkCccmmmk.',
  'kcchccccCCkkkk..',
  'kCcccccmmmmk....',
  '.kCCccmmmmmk....',
  '..kCCCCmmMk.....',
  '...kCCkkkkk.....',
  '...kmmk.kmmmmk..',
  '...kkkk.kkkkkk..',
]

export const RIDE_SIDE_HOP = [
  '.........kk.....',
  '........kpck....',
  '........kpck....',
  '.......kkpckk...',
  '......khccccck..',
  '......kcccwkcck.',
  '..kk..kccckkcmk.',
  '.kchk.kcccccmnk.',
  'kcchkkkCccmmmk..',
  'kCccccCCCkkkk...',
  'kCcccmmmmmk.....',
  '.kCCcmmmmmk.....',
  '..kCCCCmmk......',
  '..kmmkkkkmmk....',
  '.kmmmk..kmmmk...',
  '.kkkk....kkkk...',
]

export const RIDE_FRONT = patch(mirrorRows([
  '..kk....',
  '.kpck...',
  '.kpck...',
  '.kpcckkk',
  '..kccccc',
  '.khccccc',
  '.kcwkccc',
  '.kckkccc',
  '.kcccmmn',
  '..kcmmmm',
  '.kccckkm',
  'kcccmmmm',
  'kCccmmmm',
  '.kCCmmMM',
  '.kmmkkkk',
  '.kkkk...',
]), [[9, 6, 'w'], [10, 6, 'k'], [8, 8, 'm']])

export const RIDE_BACK = patch(mirrorRows([
  '..kk....',
  '.kcck...',
  '.kcck...',
  '.kccckkk',
  '..kccccc',
  '.khccccc',
  '.kcccccc',
  '.kcccccc',
  '..kccccc',
  '..kCcccc',
  '.kccccCC',
  'kcccccCC',
  'kCcccCkm',
  '.kCCCkmm',
  '.kmmkkkk',
  '.kkkk...',
]), [[7, 12, 'k'], [8, 12, 'k'], [7, 13, 'm'], [8, 13, 'm']])

/** たまご（ピョンタの いろの もよう）。 */
export const EGG = [
  '.....kkkk.....',
  '....kwwwwk....',
  '...kwwccwwk...',
  '..kwwccccwwk..',
  '..kwwwccwwwk..',
  '.kwccwwwwccwk.',
  '.kcccwwwwcccWk',
  '.kwccwwwwccwWk',
  '.kwwwwccwwwWWk',
  '..kwwccccwWWk.',
  '..kWwwccwWWWk.',
  '...kWWWWWWWk..',
  '....kkkkkkk...',
]

// ---------------- アイテム ----------------

export const ITEM_PAL = {
  k: OUTLINE, w: '#ffffff', W: '#c9d0e6', d: '#3a3450', D: '#1f1a30',
  r: '#ff4d5e', R: '#b52a44', o: '#ff9a2e', y: '#ffe14a', Y: '#e0a020',
  b: '#58b6ff', B: '#2c6bd0', g: '#62d86a', G: '#2c9a4a', p: '#ff8ab8',
}

export const ITEM_ICONS = {
  bomb: [
    '......kk..',
    '.....kyk..',
    '....kkk...',
    '..kkddkk..',
    '.kddwdddk.',
    '.kdwddddk.',
    '.kddddddk.',
    '.kdddddDk.',
    '..kdddDk..',
    '...kkkk...',
  ],
  fire: [
    '....k.....',
    '...kyk....',
    '...kyok...',
    '..kyyok.k.',
    '..kyoorkok',
    '.kyoowoork',
    '.kyowwwork',
    '.kyowwyork',
    '..kyyyyrk.',
    '...kkkkk..',
  ],
  speed: [
    '..........',
    '...kkkk...',
    '..kbbbbk..',
    '..kbwbbk..',
    '..kbbbbkk.',
    '.kbbbbbbbk',
    '.kBBBBBBBk',
    '..kkkkkkk.',
    '...k...k..',
    '..kkk.kkk.',
  ],
  heart: [
    '..........',
    '.kkk..kkk.',
    'krrrkkrrrk',
    'krwrrrrrrk',
    'krwrrrrrRk',
    '.krrrrrRk.',
    '..krrrRk..',
    '...krRk...',
    '....kk....',
    '..........',
  ],
  star: [
    '....kk....',
    '....kyk...',
    '...kyyk...',
    'kkkkywykkk',
    'kyyywwyyyk',
    '.kyyyyyyk.',
    '..kyyyyk..',
    '.kyyykyyk.',
    '.kyk..kyk.',
    '.kk....kk.',
  ],
} as const

// ---------------- てき ----------------

type EnemyArt = { rows: readonly string[]; pal: Record<string, string> }

const EK = { k: OUTLINE, w: '#ffffff', e: OUTLINE }

export const ENEMY_ART: Record<EnemyKind, EnemyArt> = {
  puni: {
    pal: { ...EK, a: '#7ee06a', b: '#3fae4e', c: '#d8ffb8', p: '#ff8aa8' },
    rows: [
      '................',
      '................',
      '................',
      '.......kk.......',
      '.....kkaakk.....',
      '....kacaaaak....',
      '...kaccaaaaak...',
      '...kacaaaaaak...',
      '..kaawkaawkaak..',
      '..kaakkaakkaak..',
      '..kapaaaaaapak..',
      '..kaaakkkkaaak..',
      '..kbaaaaaaaabk..',
      '...kbbbbbbbbk...',
      '....kkkkkkkk....',
      '................',
    ],
  },
  tentou: {
    pal: { ...EK, a: '#ff4d4d', b: '#b02c3a', d: '#1d1433', h: '#ffb0a0', f: '#2a2440' },
    rows: [
      '................',
      '................',
      '.....k....k.....',
      '......k..k......',
      '.....kffffk.....',
      '....kfwfwffk....',
      '...kkffffffkk...',
      '..kahakffkaaak..',
      '..kahddkkdaaak..',
      '.kaaaddkkddaaak.',
      '.kaaaaakkaadaak.',
      '.kadaaakkaaaaak.',
      '..kbaaakkaaabk..',
      '..kkbbbkkbbbkk..',
      '..k.kkkkkkkk.k..',
      '................',
    ],
  },
  sabo: {
    pal: { ...EK, a: '#5cc85a', b: '#2f8a3e', c: '#a8ee8a', t: '#fff6c8', r: '#ff6b8a', o: '#d77a3a', O: '#9a4a24' },
    rows: [
      '.......rr.......',
      '......krrk......',
      '.....kaaaak.....',
      '....kacaaatk....',
      '....kacaaaak....',
      '.kk.kawkawak.kk.',
      'kack.kkakkak.kak',
      'kcak.kaaaaak.kak',
      'kaakkaaatkaakkbk',
      '.kbaaaaaaaaaabk.',
      '..kkbaacaaabkk..',
      '....kaaaaaak....',
      '...kooooooook...',
      '...kOooooooOk...',
      '....kOOOOOOk....',
      '.....kkkkkk.....',
    ],
  },
  sasori: {
    pal: { ...EK, a: '#e08a3a', b: '#a0522a', c: '#ffc27a', r: '#ff4d5e' },
    rows: [
      '.........kkk....',
      '........kaack...',
      '........kak.k...',
      '.........kak....',
      '..kk......kak...',
      '.kack.....kak...',
      'kak.ak....kak...',
      'kaa.ak.kkkak....',
      '.kaaakkaaaak....',
      '..kkaaawkwak....',
      '...kacaakaaak...',
      '..kaaaaaaaaabk..',
      '.kbkbaaaaabkbk..',
      'kbk.kkbbbkk.kbk.',
      'kk..k.kkk.k..kk.',
      '................',
    ],
  },
  yukidama: {
    pal: { ...EK, a: '#ffffff', b: '#bcd4f0', c: '#8aa8d8', r: '#ff6060', o: '#ff9a3a', n: '#3a3450' },
    rows: [
      '................',
      '.....kkkkkk.....',
      '....krrrrrrk....',
      '...krrrrrrrrk...',
      '...kkkkkkkkkk...',
      '...kaaaaaaabk...',
      '..kaakaaakaabk..',
      '..kaakaaakaabk..',
      '..kaaaaooaaabk..',
      '...kbaaaaaabk...',
      '..kaaaaaaaaabk..',
      '.kaaaaanaaaabbk.',
      '.kaaaaaaaaabbck.',
      '.kbaaaanaaabcck.',
      '..kbbbbbbbbcck..',
      '...kkkkkkkkkk...',
    ],
  },
  penguin: {
    pal: { ...EK, a: '#2c3a6a', b: '#18203e', c: '#ffffff', d: '#d0dcf0', o: '#ffaa30', O: '#d07010' },
    rows: [
      '................',
      '.....kkkkkk.....',
      '....kaaaaaak....',
      '...kaaaaaaaak...',
      '...kacwkcwkak...',
      '...kacckcckak...',
      '...kaacooccak...',
      '..kkaacOOccakk..',
      '.kaakcccccckaak.',
      '.kak.kcccccdkak.',
      '.kk.kcccccccdkk.',
      '....kccccccdk...',
      '....kdcccccdk...',
      '.....kddddddk...',
      '....koook.ooook.',
      '....kkkkk.kkkkk.',
    ],
  },
  obake: {
    pal: { ...EK, a: '#f2f0ff', b: '#c4c0f0', c: '#8f88d8', p: '#ff9ac0' },
    rows: [
      '................',
      '.....kkkkkk.....',
      '....kaaaaaak....',
      '...kaaaaaaaak...',
      '..kaaaaaaaaabk..',
      '..kaakkaakkabk..',
      '..kaakkaakkabk..',
      '.kaapaaaaaapabk.',
      'kaaaaakkkaaaabbk',
      '.kkaaaaaaaaabbk.',
      '...kaaaaaaaabk..',
      '...kaaaaaaabbk..',
      '...kbaaaaabbck..',
      '...kbbabbbabck..',
      '...kckbck.kcck..',
      '....k..k...kk...',
    ],
  },
  hinotama: {
    pal: { ...EK, a: '#ffd23c', b: '#ff8a1e', c: '#ff3e3e', d: '#fff6b0' },
    rows: [
      '.......k........',
      '......kck...k...',
      '.....kcbk..kck..',
      '....kcbbk.kcbk..',
      '...kcbbabkcbbk..',
      '...kcbaaabbbbk..',
      '..kcbaaaaaabck..',
      '..kcbadaaaabck..',
      '.kcbaawkaawkbck.',
      '.kcbaakkaakkbck.',
      '.kcbaaaaaaaabck.',
      '.kcbbaakkaabbck.',
      '..kcbbaaaabbck..',
      '...kccbbbbcck...',
      '....kkccccck....',
      '......kkkkk.....',
    ],
  },
  maguman: {
    pal: { ...EK, a: '#5a4a5a', b: '#3a2e40', c: '#8a7a8a', o: '#ff7a1e', y: '#ffd23c' },
    rows: [
      '................',
      '.....kkkkkk.....',
      '....kccaaaak....',
      '...kcaaoaaaak...',
      '..kcaaoyoaaabk..',
      '..kaaaaoaaaabk..',
      '..kayykaayykbk..',
      '..kakkkaakkkbk..',
      '.kcaaaaaaaaaabk.',
      '.kaoaakkkkaaobk.',
      '.kaaoaaaaaaoabk.',
      '.kbaaaaoaaaaabk.',
      '..kbbaaaaaabbk..',
      '..kkbbbbbbbbkk..',
      '..kbk.kkkk.kbk..',
      '..kk........kk..',
    ],
  },
  komori: {
    pal: { ...EK, a: '#7a5ac8', b: '#4a3290', c: '#b49aff', r: '#ff5a7a', y: '#ffe14a' },
    rows: [
      '................',
      '................',
      '...k........k...',
      '..kak.kkkk.kak..',
      '.kaaakaaaakaaak.',
      '.kaaaacaaaaaaak.',
      'kaaaakywkywkaaak',
      'kaabakkkkkkkbaak',
      'kab.kaaaaaaak.bk',
      'kb..kaarrraak..k',
      'k...kbaaaaabk...',
      '.....kbkkbbk....',
      '......k..kk.....',
      '................',
      '................',
      '................',
    ],
  },
  robo: {
    pal: { ...EK, a: '#b8c4d8', b: '#7a88a8', c: '#eef2fa', r: '#ff3e5a', y: '#ffd23c', d: '#4a5470' },
    rows: [
      '.......kk.......',
      '.......ky.......',
      '....kkkkkkkk....',
      '...kccaaaaaak...',
      '...kcdddddddbk..',
      '...kadrdddrdbk..',
      '...kaddddddddk..',
      '...kbaaaaaaabk..',
      '..kkkkkkkkkkkkk.',
      '.kbkcaaaaaaabkbk',
      '.kbkayaayaaabkbk',
      '.kk.kaaaaaaabkkk',
      '....kbbbbbbbbk..',
      '....kdk....kdk..',
      '...kddk...kddk..',
      '...kkkk...kkkk..',
    ],
  },
  neji: {
    pal: { ...EK, a: '#ffd23c', b: '#c08a18', c: '#fff4a0', d: '#7a5410' },
    rows: [
      '................',
      '.....kkkkkk.....',
      '....kcaaaaak....',
      '...kcaabaaabk...',
      '...kaaabaaabk...',
      '...kkkkkkkkkk...',
      '....kawkawkk....',
      '....kakkakkk....',
      '....kaaaaabk....',
      '....kdadadbk....',
      '....kadadabk....',
      '....kdadadbk....',
      '....kadadabk....',
      '.....kdadbk.....',
      '......kdbk......',
      '.......kk.......',
    ],
  },
}
