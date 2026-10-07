import type { PoiId } from './model'

export const COLUMNS = 20
export const ROWS = 18

type XY = readonly [x: number, y: number]

/**
 * One village drawn on a 20×18 grid of 16px cells.
 *
 * Tiles: `.` meadow, `:` trail, `~` water, `=` broken bridge (walkable once repaired),
 * `#` forest edge, `T` tree, `P` fruit tree, `b` bush, `r` boulder.
 * Only `.`, `:` and a repaired `=` can be walked on; the outer ring is always blocked.
 */
export type MapLayout = {
  tiles: readonly string[]
  positions: Readonly<Record<PoiId, XY>>
  /** Soft light patches under the meadow texture. [x, y, w, h] */
  meadows: readonly (readonly [number, number, number, number])[]
  /** Decorative trees that do not block (frame and canopy). [x, y, size] */
  trees: readonly (readonly [number, number, number])[]
  fences: readonly (readonly [x: number, y: number, count: number])[]
  mushrooms: readonly XY[]
  stones: readonly XY[]
  lilies: readonly XY[]
  reeds: readonly XY[]
  sunflowers: readonly XY[]
  melons: readonly XY[]
  lanterns: readonly XY[]
  glowcaps: readonly XY[]
  /** Moon reflected on still water (dusk only). */
  moon?: XY
  /** Ducks paddle back and forth along this horizontal water lane. [x0, x1, y] */
  ducks?: readonly [number, number, number]
  butterflies: readonly XY[]
  flowers: number
}

const NONE: readonly XY[] = []

/** Pine-and-oak frame shared by the villages; each map trims it where buildings stand. */
function frameTrees(skip: (x: number, y: number) => boolean = () => false) {
  const trees: [number, number, number][] = []
  for (let i = 0; i < 9; i++) {
    const y = 20 + i * 33
    for (const x of [7 + (i % 2) * 3, 314 - (i % 2) * 3]) trees.push([x, y, 30 + i % 3 * 3])
  }
  return trees.filter(([x, y]) => !skip(x, y))
}

export const MAPS: readonly MapLayout[] = [
  {
    // はる: one river straight down the middle of the village.
    tiles: [
      '#########~~#########',
      '#........~~........#',
      '#........~~........#',
      '#.....:..~~........#',
      '#.....:..~~........#',
      '#.....:..~~....:...#',
      '#.....:..~~....:...#',
      '#.....:..~~....:...#',
      '#...:.:..~~....:...#',
      '#..::::::==::::::..#',
      '#..:.....~~....:...#',
      '#..:.....~~....:...#',
      '#..:.....~~....:...#',
      '#..:.....~~....:...#',
      '#........~~........#',
      '#........~~........#',
      '#........~~........#',
      '#########~~#########',
    ],
    positions: {
      post: [56, 216], wood: [104, 88], bridge: [136, 152], garden: [72, 136],
      apple: [104, 56], squirrel: [248, 88], rabbit: [248, 216], bear: [264, 152],
    },
    meadows: [[17, 22, 116, 220], [188, 38, 116, 205]],
    trees: [
      ...frameTrees(),
      [38, 25, 34], [73, 21, 32], [127, 16, 31], [193, 22, 35], [225, 17, 33], [266, 18, 32], [292, 29, 35],
      [33, 287, 35], [73, 292, 39], [113, 286, 34], [201, 287, 38], [240, 293, 39], [280, 287, 35],
    ],
    fences: [[23, 245, 10], [208, 242, 10]],
    mushrooms: [[26, 72], [124, 204], [202, 97], [288, 230], [87, 249]],
    stones: [[129, 62], [193, 197], [120, 243], [294, 125]],
    lilies: [[151, 41], [165, 108], [152, 220], [165, 267]],
    reeds: [[134, 34], [181, 73], [134, 193], [181, 243]],
    sunflowers: NONE, melons: NONE, lanterns: NONE, glowcaps: NONE,
    butterflies: [[27, 155], [203, 224]],
    flowers: 42,
  },
  {
    // なつ: a wide river runs across the map; houses line the far bank,
    // and the orchard, garden and post office share the sunny near bank.
    tiles: [
      '####################',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..:::::::::::::...#',
      '#...........:......#',
      '~~~~~~~~~~~~=~~~~~~~',
      '~~~~~~~~~~~~=~~~~~~~',
      '#...........:......#',
      '#...........:......#',
      '#...........:......#',
      '#.....:::::::::::..#',
      '#.....:............#',
      '#.....:............#',
      '#..:::::::...P...P.#',
      '#..................#',
      '####################',
    ],
    positions: {
      post: [56, 232], wood: [120, 200], bridge: [200, 152], garden: [152, 248],
      apple: [264, 200], rabbit: [56, 72], squirrel: [136, 72], bear: [248, 72],
    },
    meadows: [[16, 150, 290, 120], [24, 6, 270, 90]],
    trees: [
      ...frameTrees((_, y) => y > 90 && y < 160),
      [98, 18, 30], [188, 14, 32], [222, 22, 28], [300, 22, 32],
      [30, 300, 38], [92, 304, 36], [156, 300, 38], [222, 304, 36], [290, 300, 38],
    ],
    fences: [],
    mushrooms: NONE,
    stones: [[26, 164], [292, 166], [110, 96]],
    lilies: [[40, 132], [92, 118], [236, 134], [300, 120]],
    reeds: [[22, 108], [116, 150], [166, 108], [284, 150]],
    sunflowers: [[94, 60], [104, 64], [172, 58], [184, 62], [214, 60], [290, 58], [200, 226], [212, 230], [240, 228], [252, 232], [298, 236]],
    melons: [[116, 222], [130, 230], [190, 252]],
    lanterns: NONE, glowcaps: NONE,
    ducks: [28, 292, 126],
    butterflies: [[96, 170], [236, 170]],
    flowers: 40,
  },
  {
    // よる: a stream bends through a moonlit pond; the only bridge waits deep in the woods.
    tiles: [
      '############~~######',
      '#...........~~.....#',
      '#.....:::...~~.....#',
      '#.....:....~~~.....#',
      '#.....:..~~~~~.....#',
      '#.....:.~~~~~~..:..#',
      '#..::::~~~~~~...:..#',
      '#...:..~~~~.....:..#',
      '#T..:..~~.......:.T#',
      '#T..:TT~~...:::::..#',
      '#...:TT~~.....:....#',
      '#.T.:..~~.....:....#',
      '#...:..~~.....:....#',
      '#...:::==::::::....#',
      '#...:..~~.....::::.#',
      '#..::..~~.T........#',
      '#......~~.T........#',
      '#######~~###########',
    ],
    positions: {
      post: [56, 88], wood: [136, 40], bridge: [104, 216], garden: [56, 248],
      apple: [200, 152], squirrel: [264, 72], bear: [184, 200], rabbit: [280, 216],
    },
    meadows: [[14, 100, 90, 180], [150, 140, 150, 130], [180, 20, 120, 80]],
    trees: [
      ...frameTrees(),
      [40, 22, 34], [96, 16, 36], [212, 18, 34], [292, 24, 32],
      [36, 302, 38], [92, 300, 34], [150, 304, 36], [204, 300, 38], [262, 304, 36],
    ],
    fences: [],
    mushrooms: [[40, 170], [186, 262], [232, 120]],
    stones: [[96, 120], [234, 104], [214, 248]],
    lilies: [[150, 84], [176, 70], [132, 104]],
    reeds: [[136, 64], [228, 60], [176, 122], [102, 196], [146, 188], [100, 262]],
    sunflowers: NONE, melons: NONE,
    lanterns: [[40, 136], [88, 184], [148, 236], [244, 172], [280, 120]],
    glowcaps: [[22, 186], [36, 232], [166, 160], [292, 112], [230, 36], [302, 240]],
    moon: [168, 84],
    butterflies: NONE,
    flowers: 26,
  },
]

export function tileAt(map: MapLayout, column: number, row: number): string {
  return map.tiles[row]?.[column] ?? '#'
}

export function isWater(map: MapLayout, column: number, row: number): boolean {
  // Off-map water continues, so rivers run past the frame instead of stopping at it.
  const clampedColumn = Math.max(0, Math.min(COLUMNS - 1, column))
  const clampedRow = Math.max(0, Math.min(ROWS - 1, row))
  const tile = tileAt(map, clampedColumn, clampedRow)
  return tile === '~' || tile === '='
}

export function bridgeCells(map: MapLayout): { column: number; row: number }[] {
  const cells: { column: number; row: number }[] = []
  map.tiles.forEach((line, row) => [...line].forEach((tile, column) => { if (tile === '=') cells.push({ column, row }) }))
  return cells
}
