import type { TileArtProps } from './PartArt'
import { findPart, isBuilding, partLabel, scaleLabel, spanOf } from './parts'
import {
  buildingCells, colOf, GROUND_LABELS, isConnected, neighborIndex, populationOf, railMask, roadMask, rowOf, scaleOf, wantsRoad, waterMask,
  type Dir, type Ground, type Town,
} from './town'

// ちずの マスの みため（え に わたす かず と よみあげる なまえ）。がめんを もたない じゅんすいな かんすう だけを おく。
// タップの たびに ぜんぶの マスを つくりなおさず、かわった マスと その まわり だけ つくりなおす。

function tileLabel(town: Town, index: number): string {
  const tile = town[index]
  const place = `${colOf(index) + 1}-${rowOf(index) + 1}`
  let name = GROUND_LABELS[tile.ground]
  if (tile.part) name = tile.ground === 'water' ? `${partLabel(tile.part)}の はし` : partLabel(tile.part)
  if (scaleOf(tile) > 1) name = `${scaleLabel(scaleOf(tile))} ${name}`
  return `${place} ${name}${wantsRoad(town, index) ? '・みちが ほしい' : ''}`
}

/** みずの かどから のぞく きしの じめん（となりの りくの じめん）。 */
function bankOf(town: Town, index: number): Ground {
  for (let dir = 0 as Dir; dir < 4; dir = (dir + 1) as Dir) {
    const next = neighborIndex(index, dir)
    if (next !== null && town[next].ground !== 'water') return town[next].ground
  }
  return 'grass'
}

export type TileView = Omit<TileArtProps, 'pop' | 'dust'> & { label: string }

export function describeTile(town: Town, index: number): TileView {
  const tile = town[index]
  const part = tile.part
  const needsRoad = isBuilding(part) && Boolean(findPart(part)?.needsRoad)
  const anchor = tile.anchor ?? index
  const scale = scaleOf(tile)
  const pieceCol = colOf(index) - colOf(anchor)
  const pieceRow = rowOf(index) - rowOf(anchor)
  // 「みちが ほしい」の しるしは おおきな たてものでも みぎうえの マスに 1つ だけ だす。
  const signTile = part === null || (pieceCol === spanOf(part, scale)[0] - 1 && pieceRow === 0)
  const water = tile.ground === 'water'
  return {
    ground: tile.ground,
    bank: water ? bankOf(town, index) : tile.ground,
    part,
    roadMask: part === 'road' || part === 'crossing' ? roadMask(town, index) : 0,
    railMask: part === 'rail' || part === 'crossing' ? railMask(town, index) : 0,
    waterMask: water ? waterMask(town, index) : 0,
    checker: (colOf(index) + rowOf(index)) % 2 === 0,
    lit: !needsRoad || isConnected(town, index),
    wantsRoad: signTile && wantsRoad(town, index),
    pieceCol,
    pieceRow,
    scale,
    label: tileLabel(town, index),
  }
}

/** TileView は かずと もじだけ なので、ならべて くらべられる。 */
function sameView(previous: TileView, next: TileView): boolean {
  return (Object.keys(next) as (keyof TileView)[]).every((key) => previous[key] === next[key])
}

/**
 * まえの まちから かわった マスと その となり（つながる たてものは まるごと）だけ みため を つくりなおす。
 * かわらない マスは まえと おなじ もの を つかうので、マスの memo が そのまま きく。
 */
export function updateViews(before: Town, views: readonly TileView[], after: Town): TileView[] {
  const dirty = new Set<number>()
  for (let index = 0; index < after.length; index += 1) {
  if (before[index] === after[index]) continue
  dirty.add(index)
  for (const dir of [0, 1, 2, 3] as const) {
    const next = neighborIndex(index, dir)
    if (next !== null) dirty.add(next)
  }
  }
  if (!dirty.size) return views as TileView[]
  for (const index of [...dirty]) for (const cell of buildingCells(after, index)) dirty.add(cell)
  const next = views.slice()
  for (const index of dirty) {
  const view = describeTile(after, index)
  next[index] = sameView(views[index], view) ? views[index] : view
  }
  return next
}

/** まちと、その みため・すむ ひとの かず。まちが かわる ときに いっしょに つくる。 */
export type Board = { readonly town: Town; readonly views: readonly TileView[]; readonly population: number }

export function boardOf(town: Town, previous?: Board): Board {
  const views = previous ? updateViews(previous.town, previous.views, town) : town.map((_, index) => describeTile(town, index))
  return { town, views, population: populationOf(town) }
}
