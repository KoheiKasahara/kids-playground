import {
  AREA_HEIGHT,
  AREA_WIDTH,
  CUP_FRONT_LIP_TOP_OFFSET,
  CUP_INNER_DEPTH,
  CUP_INNER_WIDTH,
  CUP_SENSOR_HEIGHT,
  CUP_SENSOR_TOP_OFFSET,
  CUP_WALL_THICKNESS,
  PORTAL_FLOOR_HEIGHT,
  PORTAL_FRONT_LIP_HEIGHT,
} from './adventurePhysics'
import type { AdventureArea, AreaCup, AreaEntry, AreaExit } from './types'

export type AdventureRect = {
  left: number
  top: number
  width: number
  height: number
}

type PortalRect = Pick<AreaExit, 'x' | 'y' | 'width' | 'height'>

function openGroundRects(openingCenterX: number, openingWidth: number, top: number): AdventureRect[] {
  const openingLeft = openingCenterX - openingWidth / 2
  const openingRight = openingCenterX + openingWidth / 2
  return [
    { left: 0, top, width: openingLeft, height: AREA_HEIGHT - top },
    { left: openingRight, top, width: AREA_WIDTH - openingRight, height: AREA_HEIGHT - top },
  ]
}

/** 通常出口は下端の薄い受け皿、カップエリアはリムから下端までの地面になる。 */
export function areaGroundRects(area: AdventureArea): AdventureRect[] {
  if (area.cup) return openGroundRects(area.cup.x, CUP_INNER_WIDTH, area.cup.rimY)
  const exit = area.exits[0]
  return exit
    ? openGroundRects(exit.x, exit.width, AREA_HEIGHT - PORTAL_FLOOR_HEIGHT)
    : []
}

/** カップの暗い井戸。リムから底の内側までを描画と物理の共通座標にする。 */
export function cupWellRect(cup: AreaCup): AdventureRect {
  return {
    left: cup.x - CUP_INNER_WIDTH / 2,
    top: cup.rimY,
    width: CUP_INNER_WIDTH,
    height: CUP_INNER_DEPTH,
  }
}

/** 地面ブロックの内側の面に接するカップ底。上面がrimY+depthになる。 */
export function cupBottomRect(cup: AreaCup): AdventureRect {
  return {
    left: cup.x - CUP_INNER_WIDTH / 2,
    top: cup.rimY + CUP_INNER_DEPTH,
    width: CUP_INNER_WIDTH,
    height: CUP_WALL_THICKNESS,
  }
}

/** ボール中心の判定線を越えてから接触が始まる内部センサー。 */
export function cupSensorRect(cup: AreaCup): AdventureRect {
  return {
    left: cup.x - CUP_INNER_WIDTH / 2,
    top: cup.rimY + CUP_SENSOR_TOP_OFFSET,
    width: CUP_INNER_WIDTH,
    height: CUP_SENSOR_HEIGHT,
  }
}

/** 底で静止したボールを手前から隠す前景。下端まで覆うことで床との空白を残さない。 */
export function cupFrontLipRect(cup: AreaCup): AdventureRect {
  const top = cup.rimY + CUP_FRONT_LIP_TOP_OFFSET
  return { left: cup.x - CUP_INNER_WIDTH / 2, top, width: CUP_INNER_WIDTH, height: AREA_HEIGHT - top }
}

/** ポータル楕円の下側だけを覆う前景。吸い込み/出現の最後を穴の裏へ隠す。 */
export function portalFrontLipRect(portal: PortalRect): AdventureRect {
  return {
    left: portal.x - portal.width / 2,
    top: portal.y + portal.height / 2 - PORTAL_FRONT_LIP_HEIGHT,
    width: portal.width,
    height: PORTAL_FRONT_LIP_HEIGHT,
  }
}

export function entryPortalRect(entry: AreaEntry, width: number, height: number): PortalRect {
  return { x: entry.x, y: entry.y, width, height }
}
