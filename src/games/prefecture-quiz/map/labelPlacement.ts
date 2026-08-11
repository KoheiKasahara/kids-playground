import type { Prefecture } from '../data/prefectures'
import { displayPiecesForPrefecture } from './features'
import { positionsForGeometry, splitPolygons } from './geometry'
import type { Bounds, Position, Projection } from './geometry'

export type LabelPlacementOptions = {
  /** バッジの直径相当。投影後bboxがこれより小さい県は視認性のため外向きにずらす。 */
  badgeDiameter: number
  /** バッジ同士をこの距離以上離す。 */
  minDistance: number
  /** アンカーからの移動量の上限。地図の形が分からなくなるほど動かさない。 */
  maxShift: number
  /** 小さい・細長い県をアンカーから外向きにずらす量。 */
  spreadOffset: number
  /** viewBoxの内側に確保する余白。 */
  padding: number
  /** 重なり緩和の反復回数の上限。 */
  maxIterations: number
}

const DEFAULT_OPTIONS: LabelPlacementOptions = {
  badgeDiameter: 20,
  minDistance: 22,
  maxShift: 20,
  spreadOffset: 14,
  padding: 12,
  maxIterations: 25,
}

const VIEW_WIDTH = 360
const VIEW_HEIGHT = 280

function boundsOfPositions(positions: readonly Position[]): Bounds {
  return positions.reduce<Bounds>(
    (bounds, [x, y]) => ({ minX: Math.min(bounds.minX, x), minY: Math.min(bounds.minY, y), maxX: Math.max(bounds.maxX, x), maxY: Math.max(bounds.maxY, y) }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  )
}

type Anchor = { id: string; x: number; y: number; width: number; height: number }

/**
 * 県の main geometry のうち、投影後bboxの面積が最大の polygon を選び、その bbox 中心をアンカーにする。
 * 離島など小さいpolygonに引っ張られて海上にアンカーが出るのを防ぐ。
 */
function anchorForPrefecture(prefecture: Prefecture, project: Projection): Anchor {
  const polygons = splitPolygons(displayPiecesForPrefecture(prefecture).main)
  let best: Bounds | null = null
  let bestArea = -1
  for (const polygon of polygons) {
    const positions = positionsForGeometry(polygon).map(project)
    if (positions.length === 0) continue
    const bounds = boundsOfPositions(positions)
    const area = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
    if (area > bestArea) {
      bestArea = area
      best = bounds
    }
  }
  if (!best) return { id: prefecture.id, x: VIEW_WIDTH / 2, y: VIEW_HEIGHT / 2, width: 0, height: 0 }
  return {
    id: prefecture.id,
    x: (best.minX + best.maxX) / 2,
    y: (best.minY + best.maxY) / 2,
    width: best.maxX - best.minX,
    height: best.maxY - best.minY,
  }
}

/**
 * 番号バッジの表示座標を県ごとに計算する。県ごとのif文・座標ハードコードはしない。
 * 1) 最大面積polygonのbbox中心をアンカーにする。
 * 2) 細長い・小さい県はitems全体の中心から外向きにずらす。
 * 3) バッジ同士が近すぎる組を反復して押し離す（アンカーからの移動量はmaxShiftで頭打ち）。
 * 4) viewBoxの内側へpadding付きでクランプする。
 */
export function labelPositionsFor(items: readonly Prefecture[], project: Projection, options?: Partial<LabelPlacementOptions>): Map<string, Position> {
  const opts: LabelPlacementOptions = { ...DEFAULT_OPTIONS, ...options }
  if (items.length === 0) return new Map()

  const anchors = items.map((prefecture) => anchorForPrefecture(prefecture, project))
  const centerX = anchors.reduce((sum, anchor) => sum + anchor.x, 0) / anchors.length
  const centerY = anchors.reduce((sum, anchor) => sum + anchor.y, 0) / anchors.length

  const points = anchors.map((anchor) => {
    let x = anchor.x
    let y = anchor.y
    if (anchor.width < opts.badgeDiameter || anchor.height < opts.badgeDiameter) {
      const dx = anchor.x - centerX
      const dy = anchor.y - centerY
      const distance = Math.hypot(dx, dy) || 1
      x += (dx / distance) * opts.spreadOffset
      y += (dy / distance) * opts.spreadOffset
    }
    return { id: anchor.id, anchorX: anchor.x, anchorY: anchor.y, x, y }
  })

  for (let iteration = 0; iteration < opts.maxIterations; iteration += 1) {
    let moved = false
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i]
        const b = points[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const distance = Math.hypot(dx, dy)
        if (distance > 0.0001 && distance < opts.minDistance) {
          const push = (opts.minDistance - distance) / 2
          const nx = dx / distance
          const ny = dy / distance
          a.x -= nx * push
          a.y -= ny * push
          b.x += nx * push
          b.y += ny * push
          moved = true
        } else if (distance <= 0.0001) {
          // 完全に重なっている場合はランダムに頼らず左右へ固定量ずらす
          a.x -= opts.minDistance / 2
          b.x += opts.minDistance / 2
          moved = true
        }
      }
    }
    if (!moved) break
  }

  for (const point of points) {
    const dx = point.x - point.anchorX
    const dy = point.y - point.anchorY
    const shift = Math.hypot(dx, dy)
    if (shift > opts.maxShift) {
      const scale = opts.maxShift / shift
      point.x = point.anchorX + dx * scale
      point.y = point.anchorY + dy * scale
    }
    point.x = Math.min(VIEW_WIDTH - opts.padding, Math.max(opts.padding, point.x))
    point.y = Math.min(VIEW_HEIGHT - opts.padding, Math.max(opts.padding, point.y))
  }

  return new Map(points.map((point) => [point.id, [point.x, point.y] as Position]))
}
