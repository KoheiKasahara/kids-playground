import type { World, PoiId } from './model'
import { POIS, STAGES, getObjective } from './model'
import {
  PALETTES, rect, oval, tree, flower, item, fox, animal, bubble,
  type Palette, type AnimalKind, type ItemKind,
} from './art'

export { drawIcon } from './art'
export type { IconKind } from './art'

const W = 320, H = 288

function hash(n: number) {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

function grass(ctx: CanvasRenderingContext2D, palette: Palette) {
  rect(ctx, palette.grass, 0, 0, W, H)
  oval(ctx, palette.grassLight, 17, 22, 116, 220)
  oval(ctx, palette.grassLight, 188, 38, 116, 205)
  for (let i = 0; i < 480; i++) {
    const x = Math.floor(hash(i * 2) * W), y = Math.floor(hash(i * 2 + 1) * H)
    const shade = i % 4 === 0 ? palette.grassDark : palette.grass
    rect(ctx, shade, x, y, 2, 1)
    if (i % 6 === 0) {
      rect(ctx, palette.grassDark, x + 2, y - 2, 1, 3)
      rect(ctx, palette.grassDark, x - 1, y - 1, 1, 2)
    }
  }
}

function trails(ctx: CanvasRenderingContext2D, p: Palette) {
  const strips = [
    [47, 81, 20, 156], [56, 126, 62, 20], [94, 51, 20, 111],
    [104, 142, 147, 20], [238, 76, 20, 146], [248, 143, 23, 18],
  ]
  for (const [x, y, w, h] of strips) rect(ctx, p.pathDark, x - 1, y, w + 2, h + 2)
  for (const [x, y, w, h] of strips) {
    rect(ctx, p.path, x, y, w, h)
    rect(ctx, p.pathLight, x + 1, y + 1, w - 2, 2)
  }
  for (let i = 0; i < 160; i++) {
    const s = strips[i % strips.length]
    const x = s[0] + 2 + Math.floor(hash(i + 1000) * (s[2] - 4))
    const y = s[1] + 3 + Math.floor(hash(i + 2000) * (s[3] - 6))
    rect(ctx, i % 3 ? p.pathLight : p.pathDark, x, y, i % 4 === 0 ? 2 : 1, 1)
  }
  // Gently stepped edges keep the trails organic while preserving a crisp pixel grid.
  for (const [x, y] of [[46, 100], [47, 187], [66, 205], [95, 66], [114, 108], [236, 122], [257, 187]]) {
    rect(ctx, p.grass, x, y, 2, 5)
    rect(ctx, p.grassDark, x - 1, y + 3, 2, 2)
  }
}

function river(ctx: CanvasRenderingContext2D, p: Palette, time: number) {
  rect(ctx, p.grassDeep, 136, 0, 47, H)
  rect(ctx, '#a4a185', 139, 0, 42, H)
  rect(ctx, p.waterDark, 142, 0, 36, H)
  rect(ctx, p.water, 145, 0, 31, H)
  rect(ctx, p.waterLight, 145, 0, 2, H)
  for (let i = 0; i < 29; i++) {
    const y = (i * 11 + Math.floor(time * 3)) % H
    const x = 149 + Math.floor(hash(i + 40) * 19)
    rect(ctx, i % 3 === 0 ? p.foam : p.waterLight, x, y, 4 + i % 5, 1)
    if (i % 3 === 0) rect(ctx, p.waterDark, x - 1, y + 3, 4, 1)
  }
  for (let i = 0; i < 24; i++) {
    const y = i * 13
    rect(ctx, p.grassDark, 137 + (i % 3), y, 4, 7)
    rect(ctx, p.grassLight, 137 + (i % 3), y, 3, 2)
    rect(ctx, p.grassDark, 179, y + 5, 4, 8)
    rect(ctx, p.grassLight, 180, y + 5, 3, 2)
  }
  for (const [x, y] of [[151, 41], [165, 108], [152, 220], [165, 267]]) {
    oval(ctx, p.waterDark, x - 3, y + 2, 10, 5)
    oval(ctx, p.leaf, x - 4, y, 10, 5)
    rect(ctx, p.leafLight, x - 2, y, 6, 1)
    rect(ctx, p.water, x + 3, y + 2, 3, 2)
    if (y === 220) flower(ctx, x, y, '#e8afb7', p)
  }
  for (const [x, y] of [[134, 34], [181, 73], [134, 193], [181, 243]]) {
    rect(ctx, p.grassDeep, x, y - 6, 1, 9)
    rect(ctx, p.leafLight, x + 2, y - 9, 1, 11)
    rect(ctx, '#a38353', x + 2, y - 11, 2, 4)
    rect(ctx, p.grassDeep, x + 4, y - 5, 1, 8)
  }
}

function bridge(ctx: CanvasRenderingContext2D, repaired: boolean, p: Palette) {
  rect(ctx, p.waterDark, 138, 161, 44, 4)
  const planks = repaired ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [0, 1, 8, 9]
  for (const n of planks) {
    const x = 135 + n * 5
    rect(ctx, '#735744', x, 144, 5, 18)
    rect(ctx, '#d0a677', x, 145, 4, 15)
    rect(ctx, '#e6c38b', x, 145, 4, 2)
    rect(ctx, '#b2865c', x + 1, 152 + n % 3, 2, 1)
    rect(ctx, '#806248', x + 1, 148, 1, 1)
    rect(ctx, '#806248', x + 1, 158, 1, 1)
  }
  if (repaired) {
    rect(ctx, '#795b46', 133, 137, 53, 3)
    rect(ctx, '#d7b985', 133, 137, 53, 1)
    rect(ctx, '#795b46', 133, 159, 53, 3)
    rect(ctx, '#d7b985', 133, 159, 53, 1)
  }
  for (const x of [134, 182]) {
    rect(ctx, '#735744', x, 133, 3, 13)
    rect(ctx, '#e2be85', x, 133, 2, 2)
    rect(ctx, '#735744', x, 155, 3, 12)
    rect(ctx, '#e2be85', x, 155, 2, 2)
  }
}

function windowLight(ctx: CanvasRenderingContext2D, x: number, y: number, p: Palette, dusk: boolean) {
  rect(ctx, '#7b6552', x - 1, y - 1, 10, 11)
  rect(ctx, dusk ? '#f4c781' : '#afc5b9', x, y, 8, 8)
  rect(ctx, dusk ? '#ffe2a3' : '#d4dfca', x, y, 3, 7)
  rect(ctx, '#9a7d57', x + 3, y, 1, 8)
  rect(ctx, '#9a7d57', x, y + 4, 8, 1)
  rect(ctx, p.cream, x - 1, y + 9, 10, 2)
}

function cottage(ctx: CanvasRenderingContext2D, x: number, y: number, kind: AnimalKind, p: Palette, dusk: boolean) {
  const roof = kind === 'rabbit'
    ? ['#715e7b', '#a48a9c', '#c4a1ae']
    : kind === 'bear' ? ['#7a6952', '#baa16d', '#e0c58c'] : ['#8c5547', '#c18061', '#e3a480']
  oval(ctx, p.shadow, x - 24, y - 4, 49, 9)
  rect(ctx, '#82735b', x - 19, y - 25, 39, 27)
  rect(ctx, '#e3d3ac', x - 18, y - 24, 35, 24)
  rect(ctx, '#c2b18a', x + 11, y - 24, 8, 24)
  rect(ctx, '#f2e4c0', x - 17, y - 22, 27, 2)
  for (let row = 0; row < 4; row++) {
    rect(ctx, '#ccb990', x - 17, y - 16 + row * 5, 34, 1)
  }
  // Low, stepped roof with alternating highlighted shingle rows.
  for (let row = 0; row < 5; row++) {
    const width = 15 + row * 8
    const left = x - Math.floor(width / 2)
    rect(ctx, roof[0], left - 1, y - 43 + row * 4, width + 2, 5)
    rect(ctx, roof[1], left, y - 43 + row * 4, width, 3)
    rect(ctx, roof[2], left + 1, y - 43 + row * 4, width - 2, 1)
    for (let col = 5; col < width; col += 9) rect(ctx, roof[0], left + col, y - 41 + row * 4, 1, 2)
  }
  rect(ctx, roof[0], x - 25, y - 23, 51, 3)
  rect(ctx, '#786045', x - 5, y - 16, 12, 17)
  rect(ctx, '#ad8760', x - 4, y - 15, 10, 15)
  rect(ctx, '#c6a175', x - 3, y - 14, 3, 14)
  rect(ctx, '#f3d593', x + 3, y - 7, 2, 2)
  rect(ctx, '#ccbea0', x - 7, y + 1, 16, 3)
  windowLight(ctx, x - 16, y - 16, p, dusk)
  windowLight(ctx, x + 9, y - 16, p, dusk)
  rect(ctx, '#8c7651', x - 17, y - 4, 11, 4)
  rect(ctx, '#638352', x - 17, y - 6, 11, 3)
  flower(ctx, x - 15, y - 7, kind === 'rabbit' ? '#ecc0c8' : '#edc17e', p)
  flower(ctx, x - 9, y - 7, '#f2dfb2', p)
  // A small shaped plaque identifies each cottage before children can read.
  if (kind === 'rabbit') {
    rect(ctx, '#fff0cc', x - 3, y - 34, 2, 6)
    rect(ctx, '#fff0cc', x + 2, y - 34, 2, 6)
    rect(ctx, '#fff0cc', x - 4, y - 29, 9, 5)
    rect(ctx, roof[0], x - 2, y - 27, 1, 1)
    rect(ctx, roof[0], x + 2, y - 27, 1, 1)
  } else if (kind === 'bear') {
    oval(ctx, '#f2d3a1', x - 6, y - 33, 4, 4)
    oval(ctx, '#f2d3a1', x + 3, y - 33, 4, 4)
    oval(ctx, '#f2d3a1', x - 5, y - 31, 11, 8)
    rect(ctx, roof[0], x - 2, y - 28, 1, 1)
    rect(ctx, roof[0], x + 2, y - 28, 1, 1)
  } else {
    oval(ctx, '#f7d4a1', x - 6, y - 31, 9, 7)
    oval(ctx, '#f7d4a1', x + 1, y - 34, 6, 9)
    rect(ctx, roof[0], x - 3, y - 29, 1, 1)
  }
  // Chimney and lantern, with a warm two-pixel reflection at night.
  rect(ctx, '#887363', x + 11, y - 43, 6, 11)
  rect(ctx, '#bc9c82', x + 11, y - 43, 4, 10)
  rect(ctx, '#e2c49e', x + 10, y - 44, 8, 2)
  rect(ctx, '#7b644c', x + 25, y - 15, 2, 16)
  rect(ctx, '#7b644c', x + 22, y - 17, 7, 2)
  rect(ctx, dusk ? '#f9d493' : '#d4b981', x + 23, y - 15, 5, 5)
  rect(ctx, '#7b644c', x + 23, y - 10, 5, 1)
  if (dusk) rect(ctx, '#bea573', x + 24, y + 1, 5, 2)
}

function postOffice(ctx: CanvasRenderingContext2D, x: number, y: number, p: Palette, dusk: boolean) {
  oval(ctx, p.shadow, x - 26, y - 3, 53, 10)
  rect(ctx, '#a78c67', x - 19, y - 33, 39, 35)
  rect(ctx, '#f5e5bf', x - 18, y - 34, 35, 34)
  rect(ctx, '#d2bf96', x + 12, y - 34, 7, 34)
  rect(ctx, '#fdf0cb', x - 15, y - 28, 4, 22)
  // Mushroom cap: wide, scalloped silhouette, dusky underside, cream speckles.
  oval(ctx, '#985d52', x - 28, y - 53, 56, 28)
  oval(ctx, '#c57864', x - 27, y - 55, 54, 27)
  oval(ctx, '#e39879', x - 22, y - 55, 42, 18)
  oval(ctx, '#efac89', x - 17, y - 53, 27, 9)
  rect(ctx, '#955749', x - 28, y - 31, 56, 4)
  rect(ctx, '#edc09a', x - 26, y - 30, 52, 2)
  for (const [dx, dy, size] of [[-14, -48, 7], [7, -50, 8], [-22, -38, 6], [18, -39, 5], [-1, -39, 6]]) {
    oval(ctx, '#f9dfb9', x + dx, y + dy, size, 4)
    rect(ctx, '#ffeccb', x + dx + 1, y + dy, size - 2, 1)
  }
  rect(ctx, '#7d6450', x - 6, y - 19, 13, 21)
  rect(ctx, '#ad805a', x - 5, y - 18, 11, 19)
  rect(ctx, '#cea570', x - 4, y - 17, 3, 17)
  rect(ctx, '#f7d88f', x + 3, y - 9, 2, 2)
  windowLight(ctx, x - 17, y - 18, p, dusk)
  windowLight(ctx, x + 10, y - 18, p, dusk)
  rect(ctx, '#dfc99d', x - 10, y - 28, 21, 7)
  rect(ctx, '#885d46', x - 8, y - 26, 17, 1)
  rect(ctx, '#885d46', x - 1, y - 26, 3, 5)
  rect(ctx, '#cabc99', x - 8, y + 1, 18, 4)
  // Red roadside letterbox.
  rect(ctx, '#886743', x + 30, y - 10, 3, 14)
  rect(ctx, '#914f45', x + 26, y - 19, 12, 11)
  rect(ctx, '#d88267', x + 27, y - 18, 10, 8)
  rect(ctx, '#f2b08c', x + 28, y - 18, 8, 1)
  rect(ctx, '#734e40', x + 28, y - 15, 7, 1)
  rect(ctx, '#fbe3b9', x + 30, y - 12, 3, 1)
}

function garden(ctx: CanvasRenderingContext2D, world: World, p: Palette) {
  const x = 66, y = 112
  rect(ctx, '#715a43', x - 18, y - 9, 37, 21)
  rect(ctx, '#a07c51', x - 17, y - 8, 35, 18)
  for (let row = 0; row < 3; row++) rect(ctx, '#825f42', x - 16, y - 4 + row * 5, 33, 1)
  for (let i = 0; i < 6; i++) {
    const px = x - 12 + i % 3 * 12, py = y - 5 + Math.floor(i / 3) * 10
    if (!world.flags.carrotHarvested || i !== 4) {
      rect(ctx, '#db9350', px, py + 3, 3, 3)
      rect(ctx, '#486e42', px + 1, py - 1, 1, 5)
      rect(ctx, '#6c964d', px - 2, py, 3, 2)
      rect(ctx, '#7eaa57', px + 2, py - 1, 3, 2)
    }
    if (world.flags.carrotWatered) rect(ctx, '#bb9868', px - 1, py + 5, 6, 1)
  }
  rect(ctx, '#e0c69a', x - 20, y - 13, 41, 2)
  for (const px of [x - 20, x - 7, x + 7, x + 20]) {
    rect(ctx, '#ad8c60', px, y - 17, 2, 10)
    rect(ctx, '#edcf9e', px, y - 17, 2, 2)
  }
  // Watering can with long spout and one-pixel rim.
  rect(ctx, '#597e7a', x + 26, y + 1, 9, 8)
  rect(ctx, '#8daf9b', x + 26, y + 1, 7, 6)
  rect(ctx, '#bed1b0', x + 27, y + 1, 5, 1)
  rect(ctx, '#597e7a', x + 33, y + 3, 7, 2)
  rect(ctx, '#597e7a', x + 38, y, 2, 4)
  rect(ctx, '#597e7a', x + 24, y - 2, 6, 1)
  rect(ctx, '#597e7a', x + 23, y - 1, 1, 6)
  if (world.flags.carrotWatered && !world.flags.carrotHarvested) item(ctx, 'carrot', x - 1, y + 4)
  flower(ctx, 40, 133, '#f2d394', p)
}

function woodpile(ctx: CanvasRenderingContext2D, collected: boolean, p: Palette) {
  oval(ctx, p.shadow, 89, 79, 29, 8)
  for (const [x, y] of [[91, 76], [102, 77], [97, 70]]) {
    if (collected && y === 70) continue
    rect(ctx, '#74533e', x, y, 16, 7)
    rect(ctx, '#a47b4e', x + 1, y + 1, 13, 4)
    rect(ctx, '#bd9662', x + 1, y + 1, 13, 1)
    oval(ctx, '#e3c291', x, y, 6, 6)
    rect(ctx, '#a47b4e', x + 2, y + 2, 2, 2)
  }
  rect(ctx, '#59734a', 117, 82, 2, 3)
  rect(ctx, '#729155', 119, 80, 2, 4)
}

function fence(ctx: CanvasRenderingContext2D, x: number, y: number, count: number) {
  rect(ctx, '#9e835e', x, y - 8, count * 8, 2)
  rect(ctx, '#d0b78a', x, y - 8, count * 8, 1)
  rect(ctx, '#9e835e', x, y - 3, count * 8, 2)
  for (let i = 0; i <= count; i++) {
    rect(ctx, '#967a56', x + i * 8, y - 11, 3, 13)
    rect(ctx, '#e0c99c', x + i * 8, y - 11, 2, 2)
    rect(ctx, '#c6ad7e', x + i * 8, y - 9, 1, 10)
  }
}

function smallDetails(ctx: CanvasRenderingContext2D, p: Palette, time: number, season: string) {
  for (let i = 0; i < 42; i++) {
    const left = i % 2 === 0
    const x = left ? 23 + Math.floor(hash(i + 400) * 104) : 193 + Math.floor(hash(i + 400) * 106)
    const y = 22 + Math.floor(hash(i + 700) * 234)
    if ((left && x > 44 && x < 117 && y < 238) || (!left && x > 222 && y < 224)) continue
    flower(ctx, x, y, i % 3 === 0 ? '#f1ddb0' : p.flower, p)
  }
  for (const [x, y] of [[26, 72], [124, 204], [202, 97], [288, 230], [87, 249]]) {
    oval(ctx, p.shadow, x - 4, y - 1, 9, 3)
    rect(ctx, '#e3d1aa', x, y - 4, 2, 5)
    oval(ctx, '#b67659', x - 3, y - 7, 8, 4)
    rect(ctx, '#f2d4a7', x - 1, y - 7, 2, 1)
    rect(ctx, '#f2d4a7', x + 2, y - 5, 1, 1)
  }
  for (const [x, y] of [[129, 62], [193, 197], [120, 243], [294, 125]]) {
    oval(ctx, '#6e7961', x - 3, y - 3, 8, 5)
    rect(ctx, '#b3b69a', x - 2, y - 3, 5, 2)
    rect(ctx, '#89947c', x + 2, y - 2, 2, 2)
  }
  fence(ctx, 23, 245, 10)
  fence(ctx, 208, 242, 10)
  // Two tiny butterflies drift over unoccupied meadow clearings.
  for (let i = 0; i < 2; i++) {
    const x = Math.round(27 + i * 176 + Math.sin(time * 0.7 + i * 2) * 5)
    const y = Math.round(155 + i * 69 + Math.sin(time + i) * 4)
    rect(ctx, p.outline, x, y, 1, 3)
    const open = Math.floor(time * 5 + i) % 2 === 0
    rect(ctx, i ? '#f4daa1' : '#efb7b2', x - (open ? 2 : 1), y - 1, open ? 2 : 1, 3)
    rect(ctx, i ? '#f4daa1' : '#efb7b2', x + 1, y - 1, open ? 2 : 1, 3)
  }
  if (season === 'dusk') {
    for (let i = 0; i < 13; i++) {
      const x = Math.round(25 + hash(i + 900) * 270 + Math.sin(time * 0.4 + i) * 4)
      const y = Math.round(28 + hash(i + 950) * 229 + Math.cos(time * 0.6 + i) * 3)
      if (Math.sin(time * 1.7 + i) > -0.3) {
        rect(ctx, '#bacb89', x - 1, y, 3, 1)
        rect(ctx, '#e8e6a6', x, y - 1, 1, 3)
        rect(ctx, '#fff0be', x, y, 1, 1)
      }
    }
  }
}

function targetKind(id: PoiId, world: World): ItemKind {
  if (id === 'post' || id === 'squirrel') return 'parcel'
  if (id === 'garden') return world.flags.carrotWatered ? 'carrot' : 'water'
  if (id === 'rabbit') return 'carrot'
  if (id === 'apple' || id === 'bear') return 'apple'
  if (id === 'bridge') return 'bridge'
  return 'wood'
}

function guidance(ctx: CanvasRenderingContext2D, world: World, time: number, p: Palette) {
  const objective = getObjective(world)
  const target = POIS.find(poi => poi.id === objective.targetId)
  for (let i = 0; i < world.path.length; i += 2) {
    const point = world.path[i]
    rect(ctx, '#f8e4ac', point.x - 1, point.y - 1, 3, 3)
    rect(ctx, '#b9a16c', point.x, point.y + 2, 1, 1)
  }
  if (!target) return
  const phase = Math.round(Math.sin(time * 3) * 1)
  const x = target.x, y = target.y
  const color = '#fff0b6'
  rect(ctx, color, x - 12 - phase, y - 5, 5, 2)
  rect(ctx, color, x - 12 - phase, y - 5, 2, 5)
  rect(ctx, color, x + 8 + phase, y - 5, 5, 2)
  rect(ctx, color, x + 11 + phase, y - 5, 2, 5)
  rect(ctx, color, x - 12 - phase, y + 5, 5, 2)
  rect(ctx, color, x + 8 + phase, y + 5, 5, 2)
  const bubbleX = target.id === 'apple' ? x + 21 : target.id === 'post' ? x - 4 : x
  const bubbleY = target.id === 'post' ? y - 63 : target.id === 'apple' ? 28 : y - 39
  bubble(ctx, bubbleX, bubbleY + phase, targetKind(target.id, world), true, p)
}

export function drawScene(ctx: CanvasRenderingContext2D, world: World, timeSeconds: number, reducedMotion = false) {
  const time = reducedMotion ? 0 : timeSeconds
  const season = STAGES[world.stageIndex]?.season ?? 'spring'
  const p = PALETTES[season]
  ctx.save()
  ctx.imageSmoothingEnabled = false
  grass(ctx, p)
  trails(ctx, p)
  river(ctx, p, time)
  bridge(ctx, world.flags.bridgeRepaired, p)
  garden(ctx, world, p)
  smallDetails(ctx, p, time, season)
  const scenery: { y: number; draw: () => void }[] = []
  // Border trees create a sheltered, miniature woodland village.
  for (let i = 0; i < 9; i++) {
    const y = 20 + i * 33
    for (const x of [7 + (i % 2) * 3, 314 - (i % 2) * 3]) {
      scenery.push({ y, draw: () => tree(ctx, x, y, 30 + i % 3 * 3, p) })
    }
  }
  for (const [x, y, size] of [[38, 25, 34], [73, 21, 32], [127, 16, 31], [193, 22, 35], [225, 17, 33], [266, 18, 32], [292, 29, 35], [33, 287, 35], [73, 292, 39], [113, 286, 34], [201, 287, 38], [240, 293, 39], [280, 287, 35]]) {
    scenery.push({ y, draw: () => tree(ctx, x, y, size, p) })
  }
  scenery.push({ y: 44, draw: () => tree(ctx, 104, 44, 35, p, !world.flags.appleTaken) })
  scenery.push({ y: 84, draw: () => woodpile(ctx, world.flags.woodCollected, p) })
  scenery.push({ y: 199, draw: () => postOffice(ctx, 56, 199, p, season === 'dusk') })
  for (const kind of ['squirrel', 'rabbit', 'bear'] as const) {
    const poi = POIS.find(candidate => candidate.id === kind)
    if (!poi) continue
    scenery.push({ y: poi.y - 17, draw: () => cottage(ctx, poi.x, poi.y - 17, kind, p, season === 'dusk') })
    scenery.push({ y: poi.y + 1, draw: () => animal(ctx, kind, poi.x, poi.y + 1, time, world.delivered.includes(kind), p) })
  }
  scenery.push({
    y: world.player.y,
    draw: () => fox(ctx, world.player.x, world.player.y, world.player.facing, world.player.walking && !reducedMotion, time, p),
  })
  scenery.sort((a, b) => a.y - b.y).forEach(object => object.draw())
  // Compact picture requests let non-readers match their bag to each animal.
  const objectiveId = getObjective(world).targetId
  for (const recipient of STAGES[world.stageIndex].deliveries) {
    if (world.delivered.includes(recipient) || objectiveId === recipient) continue
    const poi = POIS.find(candidate => candidate.id === recipient)!
    const x = poi.x - 31, y = poi.y - 10
    rect(ctx, '#897b61', x - 10, y - 10, 21, 20)
    rect(ctx, p.cream, x - 9, y - 9, 19, 18)
    rect(ctx, '#897b61', x + 10, y + 4, 3, 3)
    rect(ctx, p.cream, x + 9, y + 4, 3, 2)
    item(ctx, targetKind(recipient, world), x - 8, y - 8)
  }
  guidance(ctx, world, time, p)
  // A tiny seal on the courier's satchel makes carrying a parcel visible in the world.
  if (world.inventory.parcel) {
    rect(ctx, '#e4b674', world.player.x + (world.player.facing === 'left' ? -9 : 5), world.player.y - 9, 5, 5)
    rect(ctx, '#c47b52', world.player.x + (world.player.facing === 'left' ? -7 : 7), world.player.y - 9, 1, 5)
  }
  ctx.restore()
}
