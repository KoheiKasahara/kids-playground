import type { AreaWall } from '../types'

/** 両端を指定する滑走路。斜面をつないで次の仕掛けへ運ぶ。 */
export function slide(id: string, x1: number, y1: number, x2: number, y2: number): AreaWall {
  return {
    kind: 'wall',
    id,
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2,
    width: Math.hypot(x2 - x1, y2 - y1),
    height: 12,
    angle: Math.atan2(y2 - y1, x2 - x1),
    restitution: 0.12,
  }
}

/** 壁際から仕掛けの直上へ集める。喉はボール直径より広く取る。 */
export function funnel(id: string, y: number, center = 240, gap = 76): AreaWall[] {
  return [
    slide(`${id}-left`, 12, y - 100, center - gap / 2, y),
    slide(`${id}-right`, center + gap / 2, y, 468, y - 100),
  ]
}
