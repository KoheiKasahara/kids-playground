import type { World, PoiId } from './model'
import { getPois, getMap, STAGES, getObjective, TILE_SIZE } from './model'
import { COLUMNS, ROWS, bridgeCells, isWater, tileAt, type MapLayout } from './maps'
import {
  PALETTES, rect, oval, tree, flower, item, fox, animal, bubble, bush, boulder, sunflower, melon,
  lantern, lightPool, glowcap, duck,
  type Palette, type AnimalKind, type ItemKind,
} from './art'
import { activeAge, GET_HOLD, type Effect } from './effects'
import { drawEffects } from './drawEffects'

export { drawIcon } from './art'
export type { IconKind } from './art'

const W = 320, H = 288
const BANK = '#a4a185'

function hash(n: number) {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

function grass(ctx: CanvasRenderingContext2D, palette: Palette, map: MapLayout) {
  rect(ctx, palette.grass, 0, 0, W, H)
  for (const [x, y, w, h] of map.meadows) oval(ctx, palette.grassLight, x, y, w, h)
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

function cellsOf(map: MapLayout, match: (tile: string) => boolean) {
  const cells: { column: number; row: number; x: number; y: number }[] = []
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      if (match(tileAt(map, column, row))) cells.push({ column, row, x: column * TILE_SIZE, y: row * TILE_SIZE })
    }
  }
  return cells
}

/** Sandy footpaths follow the `:` cells, with a soft rim and rounded outer corners. */
function trails(ctx: CanvasRenderingContext2D, p: Palette, map: MapLayout) {
  const trail = (column: number, row: number) => {
    const tile = tileAt(map, column, row)
    return tile === ':' || tile === '='
  }
  const cells = cellsOf(map, (tile) => tile === ':')
  for (const { x, y } of cells) rect(ctx, p.pathDark, x - 1, y, TILE_SIZE + 2, TILE_SIZE + 2)
  for (const { x, y } of cells) rect(ctx, p.path, x, y, TILE_SIZE, TILE_SIZE)
  for (const { column, row, x, y } of cells) {
    if (!trail(column, row - 1)) {
      const left = trail(column - 1, row) && !trail(column - 1, row - 1) ? 0 : 1
      const right = trail(column + 1, row) && !trail(column + 1, row - 1) ? 0 : 1
      rect(ctx, p.pathLight, x + left, y + 1, TILE_SIZE - left - right, 2)
    }
    for (let i = 0; i < 3; i++) {
      const seed = column * 31 + row * 17 + i * 7
      rect(ctx, i ? p.pathLight : p.pathDark, x + 2 + Math.floor(hash(seed) * 12), y + 3 + Math.floor(hash(seed + 1) * 10), i === 0 ? 2 : 1, 1)
    }
    // Round off outer corners so paths read as trodden earth rather than tiles.
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      if (trail(column + dx, row) || trail(column, row + dy)) continue
      const cx = dx < 0 ? x - 1 : x + TILE_SIZE - 1
      const cy = dy < 0 ? y : y + TILE_SIZE + 1
      rect(ctx, p.grass, cx, cy - (dy < 0 ? 0 : 1), 2, 1)
      rect(ctx, p.grass, dx < 0 ? cx : cx + 1, dy < 0 ? cy + 1 : cy - 2, 1, 1)
    }
  }
}

const BANK_LAYERS = (p: Palette) => [[p.grassDeep, 8], [BANK, 5], [p.waterDark, 2], [p.water, 0]] as const
/** Radius used to round the land's corners where water wraps around them. */
const SHORE_CURVE = 12

/** Water is assembled cell by cell: grassy bank, sand, a dark lip, then the surface. */
function waterBody(ctx: CanvasRenderingContext2D, p: Palette, map: MapLayout) {
  const cells = cellsOf(map, (tile) => tile === '~' || tile === '=')
  const wet = (column: number, row: number) => isWater(map, column, row)
  // Land corners poking into the water (inside of a bend) are rounded off too.
  const capes = cellsOf(map, (tile) => tile !== '~' && tile !== '=').flatMap(({ column, row, x, y }) =>
    ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const)
      .filter(([dx, dy]) => wet(column + dx, row) && wet(column, row + dy))
      .map(([dx, dy]) => ({ x: dx < 0 ? x : x + TILE_SIZE, y: dy < 0 ? y : y + TILE_SIZE, dx, dy })))
  for (const [color, grow] of BANK_LAYERS(p)) {
    for (const { column, row, x, y } of cells) {
      const left = wet(column - 1, row) ? 0 : grow
      const right = wet(column + 1, row) ? 0 : grow
      const top = wet(column, row - 1) ? 0 : grow
      const bottom = wet(column, row + 1) ? 0 : grow
      const width = TILE_SIZE + left + right, height = TILE_SIZE + top + bottom
      // Convex corners are cut into quarter circles so ponds and bends look soft.
      for (let line = 0; line < height; line++) {
        const fromTop = line < top ? top - line : 0
        const fromBottom = line >= height - bottom ? line - (height - bottom) + 1 : 0
        const inset = (edge: number, depth: number) => {
          if (!edge || !depth) return 0
          const d = depth - 0.5
          return Math.round(edge - Math.sqrt(Math.max(0, edge * edge - d * d)))
        }
        const insetLeft = left ? inset(left, top ? fromTop : 0) + inset(left, bottom ? fromBottom : 0) : 0
        const insetRight = right ? inset(right, top ? fromTop : 0) + inset(right, bottom ? fromBottom : 0) : 0
        rect(ctx, color, x - left + insetLeft, y - top + line, width - insetLeft - insetRight, 1)
      }
    }
    const reach = SHORE_CURVE - grow
    for (const cape of capes) {
      for (let line = 0; line < SHORE_CURVE; line++) {
        const dy = SHORE_CURVE - line - 0.5
        const span = reach * reach - dy * dy
        const count = span < 0 ? SHORE_CURVE : Math.ceil(SHORE_CURVE - Math.sqrt(span) - 0.5)
        if (count <= 0) continue
        const py = cape.dy < 0 ? cape.y + line : cape.y - line - 1
        rect(ctx, color, cape.dx < 0 ? cape.x : cape.x - count, py, count, 1)
      }
    }
  }
  for (const { column, row, x, y } of cells) {
    const seed = column * 13 + row * 29
    if (!wet(column - 1, row)) rect(ctx, p.waterLight, x, y, 2, TILE_SIZE)
    if (!wet(column, row - 1)) rect(ctx, p.waterLight, x, y, TILE_SIZE, 1)
    // Grass tufts overhang the banks.
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      if (wet(column + dx, row + dy) || hash(seed + dx * 3 + dy * 5) < 0.35) continue
      const offset = 2 + Math.floor(hash(seed + dx + dy * 7) * 9)
      const bx = dx < 0 ? x - 7 : dx > 0 ? x + TILE_SIZE + 3 : x + offset
      const by = dy < 0 ? y - 7 : dy > 0 ? y + TILE_SIZE + 2 : y + offset
      rect(ctx, p.grassDark, bx, by, dx ? 4 : 5, dx ? 6 : 4)
      rect(ctx, p.grassLight, bx, by, 3, 2)
    }
  }
}

/** Ripples drift with the current; wide still water twinkles in place instead. */
function waterRipples(ctx: CanvasRenderingContext2D, p: Palette, map: MapLayout, time: number) {
  const wet = (column: number, row: number) => isWater(map, column, row)
  for (const { column, row, x, y } of cellsOf(map, (tile) => tile === '~')) {
    const run = (dx: number, dy: number) => {
      let length = 1
      for (const sign of [-1, 1]) for (let step = 1; step < 3 && wet(column + dx * step * sign, row + dy * step * sign); step++) length++
      return length
    }
    const across = run(1, 0), down = run(0, 1)
    const seed = column * 13 + row * 29
    if (across >= 3 && down >= 3) {
      for (let i = 0; i < 2; i++) {
        if (Math.sin(time * 1.3 + seed + i * 2.1) < 0.2) continue
        rect(ctx, i ? p.foam : p.waterLight, x + 2 + Math.floor(hash(seed + i) * 10), y + 3 + Math.floor(hash(seed + i + 5) * 10), 3 + i, 1)
      }
      continue
    }
    const flowsDown = down >= across
    for (let i = 0; i < 2; i++) {
      const along = Math.floor((hash(seed + i * 3) * TILE_SIZE + time * 4) % TILE_SIZE)
      const side = 2 + Math.floor(hash(seed + i * 3 + 1) * 9)
      const length = 3 + Math.floor(hash(seed + i) * 4)
      const color = (seed + i) % 3 === 0 ? p.foam : p.waterLight
      if (flowsDown) {
        rect(ctx, color, x + side, y + along, length, 1)
        if (i === 0) rect(ctx, p.waterDark, x + side - 1, y + (along + 3) % TILE_SIZE, 4, 1)
      } else {
        rect(ctx, color, x + (along + side) % (TILE_SIZE - length), y + side + 2, length, 1)
      }
    }
  }
}

const terrainCache = new Map<number, HTMLCanvasElement>()

/** Meadow, paths and banks never move, so each village paints them once and reuses the picture. */
function terrain(ctx: CanvasRenderingContext2D, world: World, p: Palette, map: MapLayout) {
  const paint = (target: CanvasRenderingContext2D) => {
    grass(target, p, map)
    trails(target, p, map)
    waterBody(target, p, map)
  }
  let cached = terrainCache.get(world.stageIndex)
  if (!cached && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const target = canvas.getContext('2d')
    if (target) {
      target.imageSmoothingEnabled = false
      paint(target)
      terrainCache.set(world.stageIndex, canvas)
      cached = canvas
    }
  }
  if (cached) ctx.drawImage(cached, 0, 0)
  else paint(ctx)
}

function waterLife(ctx: CanvasRenderingContext2D, p: Palette, map: MapLayout, time: number) {
  if (map.moon) {
    const [x, y] = map.moon
    oval(ctx, '#7d97a3', x - 9, y - 5, 19, 10)
    oval(ctx, '#efe7bd', x - 7, y - 4, 15, 8)
    oval(ctx, '#fff7d8', x - 5, y - 3, 7, 4)
    for (let i = 0; i < 4; i++) {
      const shift = Math.round(Math.sin(time * 1.5 + i) * 2)
      rect(ctx, '#d9d2a8', x - 8 + shift + i * 2, y + 6 + i * 2, 12 - i * 3, 1)
    }
  }
  map.lilies.forEach(([x, y], index) => {
    oval(ctx, p.waterDark, x - 3, y + 2, 10, 5)
    oval(ctx, p.leaf, x - 4, y, 10, 5)
    rect(ctx, p.leafLight, x - 2, y, 6, 1)
    rect(ctx, p.water, x + 3, y + 2, 3, 2)
    if (index % 3 === 2) flower(ctx, x, y, '#e8afb7', p)
  })
  for (const [x, y] of map.reeds) {
    rect(ctx, p.grassDeep, x, y - 6, 1, 9)
    rect(ctx, p.leafLight, x + 2, y - 9, 1, 11)
    rect(ctx, '#a38353', x + 2, y - 11, 2, 4)
    rect(ctx, p.grassDeep, x + 4, y - 5, 1, 8)
  }
  if (map.ducks) {
    // A duck family paddles up and down the river, ducklings in tow.
    const [x0, x1, y] = map.ducks
    const span = x1 - x0
    const at = (offset: number) => {
      const s = ((time * 9 - offset) % (span * 2) + span * 2) % (span * 2)
      return { x: s < span ? x0 + s : x1 - (s - span), left: s >= span }
    }
    for (const [index, offset] of [[2, 18], [1, 10], [0, 0]] as const) {
      const spot = at(offset)
      duck(ctx, Math.round(spot.x), y + (index ? 2 : 0), spot.left, time + index, p, index > 0)
    }
  }
}

/** Planks are laid across the gap; while being mended they drop in one by one. */
function bridge(ctx: CanvasRenderingContext2D, world: World, map: MapLayout, buildAge: number | null, p: Palette) {
  const repaired = world.flags.bridgeRepaired
  const cells = bridgeCells(map)
  if (cells.length === 0) return
  const x0 = Math.min(...cells.map((cell) => cell.column)) * TILE_SIZE
  const x1 = (Math.max(...cells.map((cell) => cell.column)) + 1) * TILE_SIZE
  const y0 = Math.min(...cells.map((cell) => cell.row)) * TILE_SIZE
  const y1 = (Math.max(...cells.map((cell) => cell.row)) + 1) * TILE_SIZE
  const across = x1 - x0 >= y1 - y0
  // Local frame: u runs along the walkway, v across it.
  const u0 = across ? x0 : y0, v0 = across ? y0 : x0, length = across ? x1 - x0 : y1 - y0
  const r = (color: string, u: number, v: number, du: number, dv: number) => across
    ? rect(ctx, color, u, v, du, dv)
    : rect(ctx, color, v, u, dv, du)
  r(p.waterDark, u0 - 6, v0 + 17, length + 12, 4)
  const count = Math.round((length + 18) / 5)
  // Mending starts on the courier's side of the gap.
  const site = getPois(world).find((poi) => poi.id === 'bridge')!
  const fromFar = (across ? site.x : site.y) > u0 + length / 2
  for (let n = 0; n < count; n++) {
    const end = n < 2 || n >= count - 2
    let drop = 0
    if (!end) {
      if (!repaired) continue
      if (buildAge !== null) {
        const order = fromFar ? count - 1 - n : n
        const t = (buildAge - 0.12 - (order - 2) / Math.max(1, count - 5) * 0.72) / 0.16
        if (t < 0) continue
        drop = t < 1 ? -Math.round(12 * (1 - t) * (1 - t)) : 0
      }
    }
    const u = u0 - 9 + n * 5
    ctx.save()
    ctx.translate(0, drop)
    r('#735744', u, v0, 5, 18)
    r('#d0a677', u, v0 + 1, 4, 15)
    r('#e6c38b', u, v0 + 1, 4, 2)
    r('#b2865c', u + 1, v0 + 8 + n % 3, 2, 1)
    r('#806248', u + 1, v0 + 4, 1, 1)
    r('#806248', u + 1, v0 + 14, 1, 1)
    ctx.restore()
  }
  if (repaired && (buildAge === null || buildAge > 0.95)) {
    for (const v of [v0 - 7, v0 + 15]) {
      r('#795b46', u0 - 11, v, length + 21, 3)
      r('#d7b985', u0 - 11, v, length + 21, 1)
    }
  }
  for (const u of [u0 - 10, u0 + length + 6]) {
    r('#735744', u, v0 - 11, 3, 13)
    r('#e2be85', u, v0 - 11, 2, 2)
    r('#735744', u, v0 + 11, 3, 12)
    r('#e2be85', u, v0 + 11, 2, 2)
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

/** Decorations stay off paths, water, and the footprint of every building. */
function isOpenMeadow(world: World, map: MapLayout, x: number, y: number) {
  const column = Math.floor(x / TILE_SIZE), row = Math.floor(y / TILE_SIZE)
  if (tileAt(map, column, row) !== '.') return false
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isWater(map, column + dx, row + dy)) return false
  return getPois(world).every((poi) => {
    const dx = x - poi.x, dy = y - poi.y
    switch (poi.kind) {
      case 'post': return !(Math.abs(dx - 5) < 38 && dy > -76 && dy < 12)
      case 'animal': return !(dx > -42 && dx < 34 && dy > -64 && dy < 10)
      case 'garden': return !(dx > -32 && dx < 40 && dy > -46 && dy < 6)
      case 'apple': return !(Math.abs(dx) < 22 && dy > -60 && dy < 6)
      default: return !(Math.abs(dx) < 20 && dy > -24 && dy < 6)
    }
  })
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

function groundDetails(ctx: CanvasRenderingContext2D, world: World, map: MapLayout, p: Palette, time: number) {
  for (const [x, y] of map.lanterns) lightPool(ctx, x, y, p)
  let placed = 0
  for (let i = 0; placed < map.flowers && i < map.flowers * 4; i++) {
    const x = 20 + Math.floor(hash(i + 400) * 280)
    const y = 22 + Math.floor(hash(i + 700) * 240)
    if (!isOpenMeadow(world, map, x, y)) continue
    flower(ctx, x, y, i % 3 === 0 ? '#f1ddb0' : p.flower, p)
    placed++
  }
  for (const [x, y] of map.mushrooms) {
    oval(ctx, p.shadow, x - 4, y - 1, 9, 3)
    rect(ctx, '#e3d1aa', x, y - 4, 2, 5)
    oval(ctx, '#b67659', x - 3, y - 7, 8, 4)
    rect(ctx, '#f2d4a7', x - 1, y - 7, 2, 1)
    rect(ctx, '#f2d4a7', x + 2, y - 5, 1, 1)
  }
  for (const [x, y] of map.stones) {
    oval(ctx, '#6e7961', x - 3, y - 3, 8, 5)
    rect(ctx, '#b3b69a', x - 2, y - 3, 5, 2)
    rect(ctx, '#89947c', x + 2, y - 2, 2, 2)
  }
  for (const [x, y] of map.melons) melon(ctx, x, y, p)
  for (const [x, y] of map.glowcaps) glowcap(ctx, x, y, time)
  for (const [x, y, count] of map.fences) fence(ctx, x, y, count)
}

function airLife(ctx: CanvasRenderingContext2D, map: MapLayout, p: Palette, time: number, season: string) {
  // Tiny butterflies drift over unoccupied meadow clearings.
  map.butterflies.forEach(([bx, by], i) => {
    const x = Math.round(bx + Math.sin(time * 0.7 + i * 2) * 5)
    const y = Math.round(by + Math.sin(time + i) * 4)
    rect(ctx, p.outline, x, y, 1, 3)
    const open = Math.floor(time * 5 + i) % 2 === 0
    rect(ctx, i % 2 ? '#f4daa1' : '#efb7b2', x - (open ? 2 : 1), y - 1, open ? 2 : 1, 3)
    rect(ctx, i % 2 ? '#f4daa1' : '#efb7b2', x + 1, y - 1, open ? 2 : 1, 3)
  })
  if (season === 'dusk') {
    for (let i = 0; i < 16; i++) {
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
  const target = getPois(world).find(poi => poi.id === objective.targetId)
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
  const bubbleY = target.id === 'post' ? y - 63 : target.id === 'apple' ? Math.max(18, y - 28) : y - 39
  bubble(ctx, bubbleX, bubbleY + phase, targetKind(target.id, world), true, p)
}

export function drawScene(ctx: CanvasRenderingContext2D, world: World, timeSeconds: number, reducedMotion = false, effects: readonly Effect[] = []) {
  const time = reducedMotion ? 0 : timeSeconds
  // Celebrations are motion by nature; with reduced motion the world simply updates.
  const fx = reducedMotion ? [] : effects
  const now = timeSeconds
  const season = STAGES[world.stageIndex]?.season ?? 'spring'
  const p = PALETTES[season]
  const dusk = season === 'dusk'
  const map = getMap(world)
  const pois = getPois(world)
  const at = (id: PoiId) => pois.find(poi => poi.id === id)!
  const moved = (dx: number, dy: number, draw: () => void) => {
    ctx.save(); ctx.translate(dx, dy); draw(); ctx.restore()
  }
  ctx.save()
  ctx.imageSmoothingEnabled = false
  terrain(ctx, world, p, map)
  waterRipples(ctx, p, map, time)
  waterLife(ctx, p, map, time)
  bridge(ctx, world, map, activeAge(fx, now, 'repair'), p)
  moved(at('garden').x - 72, at('garden').y - 136, () => garden(ctx, world, p))
  groundDetails(ctx, world, map, p, time)

  const scenery: { y: number; draw: () => void }[] = []
  for (const [x, y, size] of map.trees) scenery.push({ y, draw: () => tree(ctx, x, y, size, p) })
  for (const { column, row, x, y } of cellsOf(map, (tile) => 'TPbr'.includes(tile))) {
    const tile = tileAt(map, column, row)
    const cx = x + TILE_SIZE / 2, base = y + TILE_SIZE - 2
    const size = 31 + Math.floor(hash(column * 7 + row) * 3) * 3
    scenery.push({
      y: base,
      draw: () => tile === 'b' ? bush(ctx, cx, base, p, hash(column + row * 3) > 0.5)
        : tile === 'r' ? boulder(ctx, cx, base, p)
          : tree(ctx, cx, base, size, p, tile === 'P' ? 'pear' : false),
    })
  }
  for (const [x, y] of map.sunflowers) scenery.push({ y, draw: () => sunflower(ctx, x, y, time) })
  for (const [x, y] of map.lanterns) scenery.push({ y, draw: () => lantern(ctx, x, y, time) })
  const appleAge = activeAge(fx, now, 'get', 'apple')
  const shake = appleAge !== null && appleAge < 0.4 ? Math.round(Math.sin(appleAge * 55) * 1.5) : 0
  scenery.push({ y: at('apple').y - 12, draw: () => tree(ctx, at('apple').x + shake, at('apple').y - 12, 35, p, world.flags.appleTaken ? false : 'apple') })
  scenery.push({ y: at('wood').y - 4, draw: () => moved(at('wood').x - 104, at('wood').y - 88, () => woodpile(ctx, world.flags.woodCollected, p)) })
  scenery.push({ y: at('post').y - 17, draw: () => postOffice(ctx, at('post').x, at('post').y - 17, p, dusk) })
  for (const kind of ['squirrel', 'rabbit', 'bear'] as const) {
    const poi = at(kind)
    const giftAge = activeAge(fx, now, 'deliver', kind)
    const jump = giftAge !== null && giftAge > 0.5 && giftAge < 0.9 ? Math.round(Math.sin((giftAge - 0.5) / 0.4 * Math.PI) * 6) : 0
    scenery.push({ y: poi.y - 17, draw: () => cottage(ctx, poi.x, poi.y - 17, kind, p, dusk) })
    scenery.push({ y: poi.y + 1, draw: () => animal(ctx, kind, poi.x, poi.y + 1 - jump, time, world.delivered.includes(kind), p) })
  }
  const getAge = activeAge(fx, now, 'get')
  // The courier hops and turns to face us while holding up a new find.
  const hop = getAge !== null && getAge < 0.3 ? Math.round(Math.sin(getAge / 0.3 * Math.PI) * 4) : 0
  const facing = getAge !== null && getAge < GET_HOLD ? 'down' : world.player.facing
  scenery.push({
    y: world.player.y,
    draw: () => fox(ctx, world.player.x, world.player.y - hop, facing, world.player.walking && !reducedMotion, time, p),
  })
  scenery.sort((a, b) => a.y - b.y).forEach(object => object.draw())
  // Compact picture requests let non-readers match their bag to each animal.
  const objectiveId = getObjective(world).targetId
  for (const recipient of STAGES[world.stageIndex].deliveries) {
    if (world.delivered.includes(recipient) || objectiveId === recipient) continue
    const poi = at(recipient)
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
  airLife(ctx, map, p, time, season)
  drawEffects(ctx, fx, now)
  ctx.restore()
}
