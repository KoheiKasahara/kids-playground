import { AREA_WIDTH } from '../adventurePhysics'
import type { AreaPin, AreaWall } from '../types'

export type PinRowOptions = {
  idPrefix: string
  startX: number
  y: number
  count: number
  spacing: number
  radius: number
  restitution?: number
}

/** 同じ高さの木の実やピンを、中心間隔を明示して並べる。 */
export function pinRow(options: PinRowOptions): AreaPin[] {
  return Array.from({ length: options.count }, (_, index) => ({
    kind: 'pin' as const,
    id: `${options.idPrefix}-${index + 1}`,
    x: options.startX + index * options.spacing,
    y: options.y,
    radius: options.radius,
    ...(options.restitution === undefined ? {} : { restitution: options.restitution }),
  }))
}

export type StaggeredPinRowsOptions = Omit<PinRowOptions, 'startX' | 'y' | 'idPrefix'> & {
  idPrefix: string
  startX: number
  firstY: number
  rowCount: number
  rowSpacing: number
  rowOffset: number
}

/** 偶数行と奇数行を横へずらし、直線の抜け道を千鳥で塞ぐ。 */
export function staggeredPinRows(options: StaggeredPinRowsOptions): AreaPin[] {
  return Array.from({ length: options.rowCount }, (_, rowIndex) =>
    pinRow({
      idPrefix: `${options.idPrefix}-row-${rowIndex + 1}`,
      startX: options.startX + (rowIndex % 2 === 0 ? 0 : options.rowOffset),
      y: options.firstY + rowIndex * options.rowSpacing,
      count: options.count,
      spacing: options.spacing,
      radius: options.radius,
      restitution: options.restitution,
    }),
  ).flat()
}

export type VRailOptions = {
  idPrefix: string
  centerX: number
  apexY: number
  span: number
  rise: number
  throatWidth: number
  /** 1本のレールの長さ。spanとは別に短くして、他の障害物との余白を確保できる。 */
  width: number
  /** レールの厚さ。 */
  height: number
  restitution?: number
}

/** 入口側を広く、下側の喉を狭くしたV字の2枚の受け板を作る。 */
export function vRail(options: VRailOptions): AreaWall[] {
  const angle = Math.atan2(options.rise, options.span)
  const centerY = options.apexY - options.rise / 2
  return [
    {
      kind: 'wall',
      id: `${options.idPrefix}-left`,
      x: options.centerX - options.throatWidth / 2 - options.span / 2,
      y: centerY,
      width: options.width,
      height: options.height,
      angle,
      ...(options.restitution === undefined ? {} : { restitution: options.restitution }),
    },
    {
      kind: 'wall',
      id: `${options.idPrefix}-right`,
      x: options.centerX + options.throatWidth / 2 + options.span / 2,
      y: centerY,
      width: options.width,
      height: options.height,
      angle: -angle,
      ...(options.restitution === undefined ? {} : { restitution: options.restitution }),
    },
  ]
}

export type ZigzagRailsOptions = {
  idPrefix: string
  centerX: number
  firstY: number
  count: number
  rowSpacing: number
  span: number
  rise: number
  width: number
  height: number
  startSide?: 'left' | 'right'
  restitution?: number
}

/** 左右を交互に切り替える短い枝状レールを、指定した間隔で作る。 */
export function zigzagRails(options: ZigzagRailsOptions): AreaWall[] {
  const angle = Math.atan2(options.rise, options.span)
  const firstSide = options.startSide === 'right' ? 1 : -1
  return Array.from({ length: options.count }, (_, index) => {
    const side = index % 2 === 0 ? firstSide : -firstSide
    return {
      kind: 'wall' as const,
      id: `${options.idPrefix}-${index + 1}`,
      x: options.centerX + side * options.span / 2,
      y: options.firstY + index * options.rowSpacing,
      width: options.width,
      height: options.height,
      angle: side < 0 ? angle : -angle,
      ...(options.restitution === undefined ? {} : { restitution: options.restitution }),
    }
  })
}

export type WallKickerOptions = {
  id: string
  side: 'left' | 'right'
  y: number
  width?: number
  height?: number
  angle?: number
  restitution?: number
}

/**
 * 外壁へ端をめり込ませる蹴り出し板を作る。
 * 中心xを丸めた定数にせず、回転後の外接半径から計算することで、壁との切り欠きを作らない。
 * 左は壁側が高くなる正角度、右は壁側が高くなる負角度に固定する。
 */
export function wallKicker(options: WallKickerOptions): AreaWall {
  const width = options.width ?? 84
  const height = options.height ?? 12
  const magnitude = Math.abs(options.angle ?? 0.34)
  const angle = options.side === 'left' ? magnitude : -magnitude
  const halfWidth = width / 2
  const halfHeight = height / 2
  const outerExtentX = Math.cos(magnitude) * halfWidth + Math.sin(magnitude) * halfHeight
  const outerEdgeX = options.side === 'left' ? 4 : AREA_WIDTH - 4
  const x = options.side === 'left' ? outerEdgeX + outerExtentX : outerEdgeX - outerExtentX

  return {
    kind: 'wall',
    id: options.id,
    x,
    y: options.y,
    width,
    height,
    angle,
    ...(options.restitution === undefined ? {} : { restitution: options.restitution }),
  }
}

export type FloorRampOptions = {
  id: string
  side: 'left' | 'right'
  /** 出口開口のうち、このスロープが向かう側の縁のx */
  openingEdgeX: number
  /** 床の上面y。通常エリアは AREA_HEIGHT - PORTAL_FLOOR_HEIGHT、ゴールはカップのリムy */
  floorTop: number
  /** 外壁側を床からどれだけ上げるか。急なほど平らな床の停滞を防げる。 */
  rise?: number
  height?: number
  restitution?: number
}

/**
 * 出口開口の左右に、外壁から開口の縁へ下る床スロープを作る。
 *
 * 密度を上げると、ボールが床へ着くころには勢いを失っていて、開口の横の平らな床の上で
 * そのまま止まってしまう（実測では停滞ナッジのほぼ全部がこの「y=床上面-ボール半径」で起きていた）。
 * 外壁側を高く開口側を低くした板を床の上に重ね、最後は必ず開口へ転がり込むようにする。
 * 外側の端は外壁へめり込ませ、壁との間に切り欠きを作らない。
 */
export function floorRamp(options: FloorRampOptions): AreaWall {
  const height = options.height ?? 12
  const rise = options.rise ?? 44
  // 端点を壁の中へ寄せつつ、回転矩形の角がエリア外へ出ないように8pxを基準にする。
  const outerX = options.side === 'left' ? 8 : AREA_WIDTH - 8
  const outerY = options.floorTop - rise
  const innerY = options.floorTop - 2
  const deltaX = options.openingEdgeX - outerX
  const deltaY = innerY - outerY
  // 右側は deltaX が負になり atan2 が π 付近を返すが、矩形はπ回転で同じ形なので向きを揃える。
  const rawAngle = Math.atan2(deltaY, deltaX)
  const angle = options.side === 'left' ? rawAngle : rawAngle - Math.PI

  return {
    kind: 'wall',
    id: options.id,
    x: (outerX + options.openingEdgeX) / 2,
    y: (outerY + innerY) / 2,
    width: Math.hypot(deltaX, deltaY),
    height,
    angle,
    ...(options.restitution === undefined ? {} : { restitution: options.restitution }),
  }
}
