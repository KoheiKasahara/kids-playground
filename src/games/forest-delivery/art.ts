/** Original pixel artwork: all silhouettes and highlights land on the logical pixel grid. */
export type Season = 'spring' | 'summer' | 'dusk'
export type ItemKind = 'parcel' | 'carrot' | 'apple' | 'wood' | 'water' | 'bridge' | 'heart' | 'star'
export type IconKind = ItemKind | AnimalKind | 'fox'
export type AnimalKind = 'squirrel' | 'rabbit' | 'bear'
export type Facing = 'up' | 'down' | 'left' | 'right'

export interface Palette {
  grass: string; grassLight: string; grassDark: string; grassDeep: string
  leaf: string; leafLight: string; leafDark: string; leafDeep: string
  path: string; pathLight: string; pathDark: string
  water: string; waterDark: string; waterLight: string; foam: string
  shadow: string; outline: string; cream: string; flower: string
}
export const PALETTES: Record<Season, Palette> = {
  spring: {
    grass: '#8caf65', grassLight: '#a3c777', grassDark: '#719453', grassDeep: '#587a49',
    leaf: '#547c50', leafLight: '#7da66b', leafDark: '#3c6244', leafDeep: '#2f4e3f',
    path: '#dfc496', pathLight: '#eed7ac', pathDark: '#c4a775',
    water: '#65a7ae', waterDark: '#4b8394', waterLight: '#8dc8c4', foam: '#c2e3d1',
    shadow: '#597c50', outline: '#51413d', cream: '#fff0cb', flower: '#efb4bb',
  },
  summer: {
    grass: '#85aa5a', grassLight: '#a1bf68', grassDark: '#698d4a', grassDeep: '#507447',
    leaf: '#4d784a', leafLight: '#759b55', leafDark: '#355a3c', leafDeep: '#284839',
    path: '#dec08c', pathLight: '#f1d59f', pathDark: '#bd9d6c',
    water: '#5499a7', waterDark: '#3c758d', waterLight: '#7ab8bd', foam: '#b8dcce',
    shadow: '#547447', outline: '#51413d', cream: '#fff0cb', flower: '#ffd18a',
  },
  dusk: {
    grass: '#66796b', grassLight: '#7d8c74', grassDark: '#526359', grassDeep: '#444e50',
    leaf: '#4c625c', leafLight: '#708173', leafDark: '#374c4e', leafDeep: '#303f47',
    path: '#b3a18b', pathLight: '#c8b69c', pathDark: '#92836f',
    water: '#567d95', waterDark: '#416079', waterLight: '#799bae', foam: '#a9c1c5',
    shadow: '#465850', outline: '#45404a', cream: '#ffedbe', flower: '#e6afb5',
  },
}

export function rect(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

/** Pixel ellipses are built from integer scanlines, never antialiased canvas curves. */
export function oval(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  const left = Math.round(x), top = Math.round(y)
  for (let row = 0; row < h; row++) {
    const dy = (row + 0.5) / h * 2 - 1
    const inset = Math.round(w / 2 * (1 - Math.sqrt(1 - dy * dy)))
    rect(ctx, color, left + inset, top + row, w - inset * 2, 1)
  }
}

export function sprite(
  ctx: CanvasRenderingContext2D, rows: readonly string[],
  colors: Record<string, string>, x: number, y: number, flip = false,
) {
  const width = Math.max(...rows.map(row => row.length))
  for (let py = 0; py < rows.length; py++) {
    const row = rows[py]
    for (let px = 0; px < row.length; px++) {
      const color = colors[row[px]]
      if (color) rect(ctx, color, x + (flip ? width - px - 1 : px), y + py, 1, 1)
    }
  }
}

const ICONS: Record<ItemKind, readonly string[]> = {
  parcel: [
    '................', '....oooooooo....', '..oooaaaacc ooo..'.replace(' ', 'a'), '..oaaaaccaaaao..',
    '..oaabbccbbaao..', '..oaabbccbbaao..', '..oaaaaccaaaao..', '..occcccccccco..',
    '..occcccccccco..', '..oaaaaccaaaao..', '..oaaaaccaaaao..', '..oaaaddddaaao..',
    '..oaaddddddaao..', '..oaaaaccaaaao..', '..oooooooooooo..', '................',
  ],
  carrot: [
    '.....gg...gg....', '......gg.gg.....', '.......ggg......', '.....ooogoo.....',
    '....oaaaaaao....', '....oabbbbbao...', '....oaaaabbao...', '.....oabbbao....',
    '.....oaaabao....', '......oabbo.....', '......oabao.....', '.......oao......',
    '.......oao......', '........o.......', '................', '................',
  ],
  apple: [
    '.........oo.....', '........ogg.....', '.......ogggg....', '...ooo.oo.......',
    '..oaaaoaaaao....', '.oaaaaaaabbao...', '.oaadaaaabbbao..', '.oadddaaabbbao..',
    '.oaadaaaabbbao..', '.oaaaaaabbbbao..', '..oaaaaabbbao...', '..oaaabbbbbao...',
    '...oaabbbbao....', '....oooooo......', '................', '................',
  ],
  wood: [
    '................', '.....oooooooo...', '....oaabbbbbbo..', '...oaabbbbbbbo..',
    '..oaabbbbbbbbo..', '..oaaobbbbbbbo..', '.oaadoobbbbbo...', '.oadadoobbbo....',
    '.oaadaaoooo.....', '..ooooooo.......', '.....oooooooo...', '....oaabbbbbo...',
    '...oadabbbbo....', '...oaabbbbo.....', '....oooooo......', '................',
  ],
  water: [
    '........oo......', '.......oaao.....', '......oaabao....', '.....oaaabbao...',
    '....oaaaabbbao..', '....oaadabbbao..', '...oaaddabbbbao.', '...oaaddabbbbao.',
    '...oaadabbbbbao.', '....oaaabbbbao..', '.....ooooooo....', '................',
    '................', '................', '................', '................',
  ],
  bridge: [
    '................', '..oo........oo..', '..aa........aa..', '..aa........aa..',
    '..oooooooooooo..', '..aaaaaaaaaaaa..', '..oooooooooooo..', '..aa.aa.aa..aa..',
    '..oooooooooooo..', '..aaaaaaaaaaaa..', '..oooooooooooo..', '..aa........aa..',
    '..aa........aa..', '..oo........oo..', '................', '................',
  ],
  heart: [
    '................', '..oooo...oooo...', '.oaaaao.oaaaao..', '.oaaddaoaaaabo..',
    '.oaaddaaaaaabo..', '.oaaaaaaaaabbo..', '..oaaaaaabbbo...', '...oaaaabbbo....',
    '....oaabbbo.....', '.....obbbo......', '......obo.......', '.......o........',
    '................', '................', '................', '................',
  ],
  star: [
    '................', '.......o........', '......oao.......', '......oao.......',
    '.....oaabo......', '..ooooaaboooo...', '.oaaaaaaabbbbo..', '..oaaaaddbbbo...',
    '...oaaadbbbo....', '....oaabbbo.....', '...oaabbabbo....', '...oabboabbo....',
    '..oaboooobbbo...', '..ooo....oooo...', '................', '................',
  ],
}

const ICON_COLORS: Record<ItemKind, Record<string, string>> = {
  parcel: { o: '#755747', a: '#dca569', b: '#bf8556', c: '#e57661', d: '#fff0ca' },
  carrot: { o: '#875b3e', a: '#f8b451', b: '#e58642', g: '#4e8b4b' },
  apple: { o: '#78413b', a: '#e67762', b: '#c44d4b', d: '#ffccb0', g: '#6b954b' },
  wood: { o: '#72523e', a: '#d6ac71', b: '#93674b', d: '#f2d092' },
  water: { o: '#477b96', a: '#90d1db', b: '#64adca', d: '#d9f3e5' },
  bridge: { o: '#765843', a: '#ddb77e' },
  heart: { o: '#b65b64', a: '#ed93a0', b: '#d27487', d: '#ffd0c7' },
  star: { o: '#c68b44', a: '#ffe099', b: '#efb95d', d: '#fff2cb' },
}

export function item(ctx: CanvasRenderingContext2D, kind: ItemKind, x: number, y: number) {
  sprite(ctx, ICONS[kind], ICON_COLORS[kind], x, y)
}

export function drawIcon(ctx: CanvasRenderingContext2D, kind: IconKind, size = 24) {
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.clearRect(0, 0, size, size)
  const scale = Math.max(1, Math.floor(size / 16))
  ctx.translate(Math.floor((size - 16 * scale) / 2), Math.floor((size - 16 * scale) / 2))
  ctx.scale(scale, scale)
  if (kind === 'fox') {
    sprite(ctx, FOX.slice(0, 12), FOX_COLORS, -2, 2)
  } else if (kind === 'squirrel' || kind === 'rabbit' || kind === 'bear') {
    const colors = kind === 'rabbit'
      ? { o: '#756052', a: '#eab2a3', b: '#d7c6a4', d: '#fff0cf', c: '#8ca793' }
      : kind === 'bear'
        ? { o: '#6b4c3d', a: '#d7a465', b: '#b7814c', d: '#f7ddb0', c: '#bb7f77' }
        : { o: '#684637', a: '#bb7c4f', b: '#956243', d: '#f4d5ac', c: '#819267' }
    sprite(ctx, ANIMALS[kind].slice(0, kind === 'rabbit' ? 11 : 10), colors, -1, kind === 'rabbit' ? 1 : 3)
  } else item(ctx, kind, 0, 0)
  ctx.restore()
}

const FOX = [
  '...oo.........oo....',
  '..oaao.......oaao...',
  '..odbao.....oadbo...',
  '..odbaooooooadbbo...',
  '...oaaaabbbbbboo....',
  '..oaaaaaabbbbbbo....',
  '.oaaaaaaaabbbbbbo...',
  '.oaaaoaaaaaoabbbo...',
  '.oaaaoddddaoabbbo...',
  '..oaaddodddabbbo....',
  '...oddddddddboo.....',
  '....ooddddooo.......',
  '....otttttto....oo..',
  '...ottTTtttto..oado.',
  '...otoaaaabo..oaaddo',
  '..oaoaaaacbbooaabddo',
  '..oooaaaaaccboaabbdo',
  '...oaaaaaaacoabbbdo.',
  '...oaaabbaaccooooo..',
  '...oaaooabbo........',
  '...ooo..oooo........',
]
const FOX_COLORS = { o: '#473b35', a: '#e6a15b', b: '#c97445', d: '#fff0d0', t: '#3e8180', T: '#7ab2a0', c: '#9e6844' }

export function fox(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Facing, walking: boolean, time: number, palette: Palette) {
  const step = walking ? Math.floor(time * 8) % 4 : 0
  const bob = step === 1 || step === 3 ? -1 : 0
  oval(ctx, palette.shadow, x - 8, y - 3, 17, 5)
  sprite(ctx, FOX, FOX_COLORS, Math.round(x) - 10, Math.round(y) - 22 + bob, facing === 'left')
  if (facing === 'up') {
    rect(ctx, '#e6a15b', x - 5, y - 16 + bob, 10, 5)
    rect(ctx, '#c97445', x + 2, y - 16 + bob, 4, 5)
    rect(ctx, '#473b35', x - 4, y - 10 + bob, 9, 1)
    rect(ctx, '#d09a61', x - 4, y - 8 + bob, 9, 6)
    rect(ctx, '#9e6844', x - 4, y - 8 + bob, 9, 1)
    rect(ctx, '#f8cf88', x, y - 6 + bob, 2, 2)
  }
  if (walking) {
    rect(ctx, '#473b35', x - 6, y - 2 + (step < 2 ? 1 : 0), 4, 2)
    rect(ctx, '#473b35', x + 1, y - 2 + (step >= 2 ? 1 : 0), 4, 2)
  }
}

const ANIMALS: Record<AnimalKind, readonly string[]> = {
  squirrel: [
    '...oo.....oo........',
    '..oaao...oaao...ooo.',
    '..oaaoooooaao..obbo',
    '...oaaaaaabo..obaabo',
    '..oaaaaaaabbo.obaabo',
    '..oaaoaaaoabo.obabbo',
    '..oaadoodabbo.obabbo',
    '...oddddddbo..obbbo',
    '....oooooo....obbo.',
    '...occcccco..obbo..',
    '..ocdccccdcooabo...',
    '..ooaaaaabbooao....',
    '...oaaaaabbooo.....',
    '...oaaaoabbo.......',
    '...oooo.oooo.......',
  ],
  rabbit: [
    '...ooo...ooo.......',
    '..odado.odado......',
    '..odado.odado......',
    '..odado.odado......',
    '..odddo.odddo......',
    '...oddoooodo.......',
    '..odddddddddo......',
    '..oddodddoddo......',
    '..oddddad ddo......'.replace(' ', 'd'),
    '...odddodddo.......',
    '....ooooooo........',
    '...occccccco.......',
    '..ocdccccc dco.....'.replace(' ', 'c'),
    '..ooodddd dooo.....'.replace(' ', 'd'),
    '....odddddo........',
    '...oddoddddo.......',
    '...oooo.oooo.......',
  ],
  bear: [
    '..oooo.....oooo....',
    '.obbbbo...obbbbo...',
    '.obaabooooobaabo...',
    '..obbaaaaaabbbo....',
    '..oaaaaaaaaaabo....',
    '.oaaaoaaaaoaabbo...',
    '.oaaaaddddaaabbo...',
    '.oaaaddooddaabbo...',
    '..oaaddddddaabo....',
    '...ooaaaaaaooo.....',
    '...occccccccco.....',
    '..occdccccc dcco...'.replace(' ', 'c'),
    '..ooaaaaaaaaboo....',
    '...oaaaaaaaabo.....',
    '...oaaoooaabbo.....',
    '...oooo.oooooo.....',
  ],
}

export function animal(ctx: CanvasRenderingContext2D, kind: AnimalKind, x: number, y: number, time: number, happy: boolean, palette: Palette) {
  const bounce = happy ? Math.round(Math.max(0, Math.sin(time * 4)) * 2) : 0
  oval(ctx, palette.shadow, x - 7, y - 2, 16, 4)
  const colors = kind === 'rabbit'
    ? { o: '#756052', a: '#eab2a3', b: '#d7c6a4', d: '#fff0cf', c: '#8ca793' }
    : kind === 'bear'
      ? { o: '#6b4c3d', a: '#d7a465', b: '#b7814c', d: '#f7ddb0', c: '#bb7f77' }
      : { o: '#684637', a: '#bb7c4f', b: '#956243', d: '#f4d5ac', c: '#819267' }
  const rows = ANIMALS[kind]
  sprite(ctx, rows, colors, x - 9, y - rows.length - bounce)
  if (happy) item(ctx, 'heart', x - 7, y - rows.length - 19 - bounce)
}

export function tree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, palette: Palette, fruit = false) {
  oval(ctx, palette.shadow, x - size / 2 + 1, y - 5, size - 2, 9)
  rect(ctx, '#664f3e', x - 3, y - 20, 7, 20)
  rect(ctx, '#99734d', x - 2, y - 19, 3, 18)
  rect(ctx, '#b48c59', x - 1, y - 13, 1, 8)
  const top = y - size - 12
  oval(ctx, palette.leafDeep, x - size / 2, top + 8, size, size - 8)
  oval(ctx, palette.leafDark, x - size / 2 + 1, top + 2, size - 2, size - 6)
  oval(ctx, palette.leaf, x - size / 2 + 3, top, size - 8, size - 10)
  oval(ctx, palette.leafLight, x - size / 2 + 5, top + 2, size / 2 + 2, size / 3)
  rect(ctx, palette.leaf, x - size / 2 + 7, top + 2, 6, 2)
  rect(ctx, palette.leafDark, x + 3, top + 13, 6, 2)
  rect(ctx, palette.leafLight, x - 10, top + 15, 5, 2)
  rect(ctx, palette.leaf, x + 7, top + 8, 4, 3)
  rect(ctx, palette.leafDark, x - 6, top + size - 8, 7, 2)
  rect(ctx, palette.leaf, x + 2, top + size - 10, 4, 2)
  if (fruit) {
    for (const [dx, dy] of [[-8, 13], [8, 8], [3, 23]]) {
      rect(ctx, '#7a4b3c', x + dx + 1, top + dy - 1, 1, 2)
      rect(ctx, '#d87558', x + dx, top + dy, 4, 4)
      rect(ctx, '#f0b27f', x + dx, top + dy, 2, 1)
      rect(ctx, '#b75c49', x + dx + 2, top + dy + 3, 2, 1)
    }
  }
}

export function flower(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, palette: Palette) {
  rect(ctx, palette.grassDeep, x, y, 1, 4)
  rect(ctx, palette.grassDark, x - 2, y + 2, 2, 1)
  rect(ctx, color, x - 1, y - 2, 3, 3)
  rect(ctx, color, x - 2, y - 1, 5, 1)
  rect(ctx, '#ffe5aa', x, y - 1, 1, 1)
}

export function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, kind: ItemKind, active: boolean, palette: Palette) {
  rect(ctx, active ? '#d49c4e' : palette.outline, x - 12, y - 13, 24, 24)
  rect(ctx, active ? '#d49c4e' : palette.outline, x - 13, y - 12, 26, 22)
  rect(ctx, palette.cream, x - 11, y - 12, 22, 22)
  rect(ctx, palette.cream, x - 12, y - 11, 24, 20)
  rect(ctx, active ? '#d49c4e' : palette.outline, x - 3, y + 11, 6, 2)
  rect(ctx, active ? '#d49c4e' : palette.outline, x - 1, y + 13, 2, 2)
  rect(ctx, palette.cream, x - 2, y + 10, 4, 2)
  item(ctx, kind, x - 8, y - 8)
}
