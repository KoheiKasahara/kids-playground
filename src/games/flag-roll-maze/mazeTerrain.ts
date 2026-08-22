import { CELL_SIZE, cellToWorld } from './mazeGrid'
import type { CellCoordinate } from './mazeGimmicks'
import {
  FLOOR_THICKNESS,
  TERRAIN_RAIL_THICKNESS,
  TERRAIN_RAMP_RAIL_HEIGHT,
  TERRAIN_RAMP_THICKNESS,
  TERRAIN_SLAB_RAIL_HEIGHT,
} from './mazePhysics'

/** front は +Z 側、back は -Z 側を表す。 */
export type TerrainSide = 'left' | 'right' | 'front' | 'back'

/** 地形の役割ごとに見た目を分け、物理の設定は配置の形から決める。 */
export type TerrainStyle =
  | 'platform'
  | 'step'
  | 'slide'
  | 'guard'
  | 'road'
  | 'roadMarking'

export type SlabPlacement = {
  kind: 'slab'
  id: string
  /** 中心のセル座標。半マスなどの小数指定も使える。 */
  cell: CellCoordinate
  widthCells: number
  depthCells: number
  /** 上面のワールドY。 */
  top: number
  /** 下面。省略時は地面の床と重なる位置まで伸ばす。 */
  bottom?: number
  /** 指定した辺へ、天面から立ち上がる落下防止の柵を作る。 */
  rails?: readonly TerrainSide[]
  railHeight?: number
  style?: TerrainStyle
}

export type RampPlacement = {
  kind: 'ramp'
  id: string
  /** 傾斜の中心セル。 */
  cell: CellCoordinate
  widthCells: number
  /** Z方向の水平投影の長さ。 */
  depthCells: number
  /** -Z 側の上面Y。 */
  topStart: number
  /** +Z 側の上面Y。 */
  topEnd: number
  thickness?: number
  rails?: readonly ('left' | 'right')[]
  railHeight?: number
  style?: TerrainStyle
}

/** X軸に沿って寝かせた円柱。平らな天面を作らず、段鼻や入口を滑らかにつなぐ。 */
export type RoundedBarPlacement = {
  kind: 'roundedBar'
  id: string
  cell: CellCoordinate
  widthCells: number
  y: number
  radius: number
  style?: TerrainStyle
}

export type TerrainPlacement = SlabPlacement | RampPlacement | RoundedBarPlacement

/** 物理と描画が共有する、ワールド座標へ解決済みの地形。 */
export type MazeTerrain = {
  boxes: {
    id: string
    x: number
    y: number
    z: number
    width: number
    height: number
    depth: number
    rotationX: number
    style: TerrainStyle
  }[]
  bars: {
    id: string
    x: number
    y: number
    z: number
    length: number
    radius: number
    style: TerrainStyle
  }[]
}

/** 柵も通常のboxへ解決し、物理と見た目で別の配置計算を持たないようにする。 */
function slabRailBox(
  id: string,
  side: TerrainSide,
  center: { x: number; z: number },
  width: number,
  depth: number,
  top: number,
  railHeight: number,
): MazeTerrain['boxes'][number] {
  const y = top + railHeight / 2
  if (side === 'left') {
    return {
      id: `${id}-rail-left`,
      x: center.x - width / 2,
      y,
      z: center.z,
      width: TERRAIN_RAIL_THICKNESS,
      height: railHeight,
      depth,
      rotationX: 0,
      style: 'guard',
    }
  }
  if (side === 'right') {
    return {
      id: `${id}-rail-right`,
      x: center.x + width / 2,
      y,
      z: center.z,
      width: TERRAIN_RAIL_THICKNESS,
      height: railHeight,
      depth,
      rotationX: 0,
      style: 'guard',
    }
  }
  if (side === 'front') {
    return {
      id: `${id}-rail-front`,
      x: center.x,
      y,
      z: center.z + depth / 2,
      width,
      height: railHeight,
      depth: TERRAIN_RAIL_THICKNESS,
      rotationX: 0,
      style: 'guard',
    }
  }
  return {
    id: `${id}-rail-back`,
    x: center.x,
    y,
    z: center.z - depth / 2,
    width,
    height: railHeight,
    depth: TERRAIN_RAIL_THICKNESS,
    rotationX: 0,
    style: 'guard',
  }
}

/** 傾斜面に沿う柵は、同じ回転を与えて上面との隙間を作らない。 */
function rampRailBox(
  id: string,
  side: 'left' | 'right',
  center: { x: number; y: number; z: number },
  width: number,
  depth: number,
  thickness: number,
  rotationX: number,
  railHeight: number,
): MazeTerrain['boxes'][number] {
  const localY = thickness / 2 + railHeight / 2
  return {
    id: `${id}-rail-${side}`,
    x: center.x + (side === 'left' ? -width / 2 : width / 2),
    y: center.y + localY * Math.cos(rotationX),
    z: center.z + localY * Math.sin(rotationX),
    width: TERRAIN_RAIL_THICKNESS,
    height: railHeight,
    depth,
    rotationX,
    style: 'guard',
  }
}

/**
 * セル単位の地形配置を、RapierとThree.jsがそのまま使えるワールド座標へ変換する。
 * 高さを持たない既存ステージでは空配列を返すため、従来の盤面生成を変えない。
 */
export function resolveTerrain(
  placements: readonly TerrainPlacement[],
  columnCount: number,
  rowCount: number,
  cellSize = CELL_SIZE,
): MazeTerrain {
  const boxes: MazeTerrain['boxes'] = []
  const bars: MazeTerrain['bars'] = []

  for (const placement of placements) {
    const center = cellToWorld(
      placement.cell.column,
      placement.cell.row,
      columnCount,
      rowCount,
      cellSize,
    )
    const style = placement.style ?? 'platform'

    if (placement.kind === 'slab') {
      const width = placement.widthCells * cellSize
      const depth = placement.depthCells * cellSize
      const bottom = placement.bottom ?? -FLOOR_THICKNESS
      boxes.push({
        id: placement.id,
        x: center.x,
        y: (placement.top + bottom) / 2,
        z: center.z,
        width,
        height: placement.top - bottom,
        depth,
        rotationX: 0,
        style,
      })
      const railHeight = placement.railHeight ?? TERRAIN_SLAB_RAIL_HEIGHT
      for (const side of placement.rails ?? []) {
        boxes.push(
          slabRailBox(
            placement.id,
            side,
            center,
            width,
            depth,
            placement.top,
            railHeight,
          ),
        )
      }
      continue
    }

    if (placement.kind === 'ramp') {
      const width = placement.widthCells * cellSize
      const horizontalDepth = placement.depthCells * cellSize
      const rotationX = Math.atan2(
        placement.topStart - placement.topEnd,
        horizontalDepth,
      )
      const thickness = placement.thickness ?? TERRAIN_RAMP_THICKNESS
      // 水平投影の両端で上面Yを指定値へ合わせるため、斜面の実長と中心Yを補正する。
      const depth = horizontalDepth / Math.cos(rotationX)
      const y =
        (placement.topStart + placement.topEnd) / 2 -
        thickness / (2 * Math.cos(rotationX))
      const rampCenter = { x: center.x, y, z: center.z }
      boxes.push({
        id: placement.id,
        ...rampCenter,
        width,
        height: thickness,
        depth,
        rotationX,
        style,
      })
      const railHeight = placement.railHeight ?? TERRAIN_RAMP_RAIL_HEIGHT
      for (const side of placement.rails ?? []) {
        boxes.push(
          rampRailBox(
            placement.id,
            side,
            rampCenter,
            width,
            depth,
            thickness,
            rotationX,
            railHeight,
          ),
        )
      }
      continue
    }

    bars.push({
      id: placement.id,
      x: center.x,
      y: placement.y,
      z: center.z,
      length: placement.widthCells * cellSize,
      radius: placement.radius,
      style,
    })
  }

  return { boxes, bars }
}
