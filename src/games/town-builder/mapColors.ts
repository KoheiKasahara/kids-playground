import type { BuildingId, TilePart } from './parts'
import type { Ground, Tile, Town } from './town'

// 「ちず」に かく いろ。1マスを 1つの いろで あらわす。

const GROUND_COLORS: Record<Ground, string> = { grass: '#93cf67', water: '#5bbde8', sand: '#f0d9a0', snow: '#f4f8fc' }
const NATURE_COLORS: Partial<Record<BuildingId, string>> = {
  tree: '#3f9d48', pine: '#2f7d4a', palm: '#4fae5b', cactus: '#5fa55a', sakura: '#f6a8c4', flowers: '#ff9fc0',
  farm: '#b07a4a', park: '#7cc35a', fountain: '#8fd3f4', snowman: '#dfe9f2', pyramid: '#d9a441', tent: '#ff922b',
}

function partColor(part: TilePart, bridge: boolean): string {
  if (part === 'road') return bridge ? '#8d6e52' : '#6b7280'
  if (part === 'rail') return '#8b5a2b'
  if (part === 'crossing') return '#3d3d3d'
  return NATURE_COLORS[part] ?? '#e8590c'
}

export function mapColor(tile: Tile): string {
  return tile.part ? partColor(tile.part, tile.ground === 'water') : GROUND_COLORS[tile.ground]
}

export function drawTownMap(context: CanvasRenderingContext2D, town: Town, cols: number, scale: number): void {
  town.forEach((tile, index) => {
    context.fillStyle = mapColor(tile)
    context.fillRect((index % cols) * scale, Math.floor(index / cols) * scale, scale, scale)
  })
}
