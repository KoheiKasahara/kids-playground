import {
  getDominoFlagDefinition,
  type DominoFlagId,
  type FlagCellColor,
  type FlagGridSize,
} from './flagDefinitions'

type Point = readonly [number, number]
type Paint = (x: number, y: number) => FlagCellColor

const FLAG_ASPECT = 8 / 5
const SAMPLE_OFFSETS = [-1 / 3, 0, 1 / 3] as const

function scenePoint(x: number, y: number): Point {
  return [(x - 0.5) * FLAG_ASPECT, y - 0.5]
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point[0] - start[0], point[1] - start[1])
  const ratio = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared))
  return Math.hypot(point[0] - (start[0] + dx * ratio), point[1] - (start[1] + dy * ratio))
}

function inPolygon(x: number, y: number, points: readonly Point[]): boolean {
  let inside = false
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const [currentX, currentY] = points[index]!
    const [previousX, previousY] = points[previous]!
    if ((currentY > y) === (previousY > y)) continue
    const crossingX = (previousX - currentX) * (y - currentY) / (previousY - currentY) + currentX
    if (x < crossingX) inside = !inside
  }
  return inside
}

function starPoints(cx: number, cy: number, outerRadius: number, innerRadius = outerRadius * 0.42, rotation = -Math.PI / 2): Point[] {
  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outerRadius : innerRadius
    const angle = rotation + index * Math.PI / 5
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]
  })
}

function inCircle(x: number, y: number, cx: number, cy: number, radius: number): boolean {
  const point = scenePoint(x, y)
  const center = scenePoint(cx, cy)
  return Math.hypot(point[0] - center[0], point[1] - center[1]) <= radius
}

function horizontalBands(colors: readonly FlagCellColor[], weights?: readonly number[]): Paint {
  const total = weights?.reduce((sum, weight) => sum + weight, 0) ?? colors.length
  return (_x, y) => {
    let edge = 0
    for (let index = 0; index < colors.length; index += 1) {
      edge += (weights?.[index] ?? 1) / total
      if (y < edge || index === colors.length - 1) return colors[index]!
    }
    return colors.at(-1)!
  }
}

function verticalBands(colors: readonly FlagCellColor[], weights?: readonly number[]): Paint {
  const total = weights?.reduce((sum, weight) => sum + weight, 0) ?? colors.length
  return (x) => {
    let edge = 0
    for (let index = 0; index < colors.length; index += 1) {
      edge += (weights?.[index] ?? 1) / total
      if (x < edge || index === colors.length - 1) return colors[index]!
    }
    return colors.at(-1)!
  }
}

function nordicCross(background: FlagCellColor, cross: FlagCellColor, inner?: FlagCellColor): Paint {
  return (x, y) => {
    const outer = x >= 0.31 && x <= 0.44 || y >= 0.41 && y <= 0.59
    if (!outer) return background
    if (!inner) return cross
    return x >= 0.345 && x <= 0.405 || y >= 0.455 && y <= 0.545 ? inner : cross
  }
}

function unionJack(x: number, y: number): FlagCellColor {
  const point = scenePoint(x, y)
  const topLeft: Point = [-0.8, -0.5]
  const bottomRight: Point = [0.8, 0.5]
  const topRight: Point = [0.8, -0.5]
  const bottomLeft: Point = [-0.8, 0.5]
  const diagonalWhite = distanceToSegment(point, topLeft, bottomRight) < 0.12 || distanceToSegment(point, topRight, bottomLeft) < 0.12
  let color: FlagCellColor = diagonalWhite ? 'white' : 'blue'
  const diagonalRed = distanceToSegment(point, topLeft, bottomRight) < 0.052 || distanceToSegment(point, topRight, bottomLeft) < 0.052
  if (diagonalRed) color = 'red'
  if (Math.abs(point[0]) < 0.16 || Math.abs(point[1]) < 0.16) color = 'white'
  if (Math.abs(point[0]) < 0.085 || Math.abs(point[1]) < 0.085) color = 'red'
  return color
}

function mapleLeaf(x: number, y: number): boolean {
  return inPolygon(x, y, [
    [0.5, 0.14], [0.47, 0.27], [0.41, 0.22], [0.42, 0.35], [0.31, 0.31],
    [0.39, 0.43], [0.27, 0.48], [0.41, 0.53], [0.37, 0.68], [0.47, 0.63],
    [0.5, 0.82], [0.53, 0.63], [0.63, 0.68], [0.59, 0.53], [0.73, 0.48],
    [0.61, 0.43], [0.69, 0.31], [0.58, 0.35], [0.59, 0.22], [0.53, 0.27],
  ])
}

function southAfrica(x: number, y: number): FlagCellColor {
  const point = scenePoint(x, y)
  const diagonal = 0.13
  const left = -0.8
  const middle = 0.15
  const inY = point[0] <= middle && Math.abs(point[1]) <= Math.max(0.12, 0.5 - (point[0] - left) * 0.45)
  if (inY) return 'green'
  const inYellowBorder = point[0] < 0.05 && Math.abs(point[1]) <= 0.5 - (point[0] - left) * 0.36 + diagonal
  if (inYellowBorder) return 'yellow'
  if (point[0] < -0.35 && Math.abs(point[1]) < 0.5 - (point[0] + 0.8) * 0.5) return 'black'
  if (Math.abs(point[1] - (0.13 + point[0] * 0.35)) < 0.065 || Math.abs(point[1] - (-0.13 - point[0] * 0.35)) < 0.065) return 'white'
  return y < 0.5 ? 'red' : 'blue'
}

function paintFlag(id: DominoFlagId, x: number, y: number): FlagCellColor {
  switch (id) {
    case 'jp': return inCircle(x, y, 0.5, 0.5, 0.3) ? 'red' : 'white'
    case 'fr': return verticalBands(['blue', 'white', 'red'])(x, y)
    case 'it': return verticalBands(['green', 'white', 'red'])(x, y)
    case 'be': return verticalBands(['black', 'yellow', 'red'])(x, y)
    case 'ro': return verticalBands(['blue', 'yellow', 'red'])(x, y)
    case 'ie': return verticalBands(['green', 'white', 'orange'])(x, y)
    case 'de': return horizontalBands(['black', 'red', 'yellow'])(x, y)
    case 'nl': return horizontalBands(['red', 'white', 'blue'])(x, y)
    case 'pl': return horizontalBands(['white', 'red'])(x, y)
    case 'ua': return horizontalBands(['blue', 'yellow'])(x, y)
    case 'id': return horizontalBands(['red', 'white'])(x, y)
    case 'at': return horizontalBands(['red', 'white', 'red'])(x, y)
    case 'hu': return horizontalBands(['red', 'white', 'green'])(x, y)
    case 'bg': return horizontalBands(['white', 'green', 'red'])(x, y)
    case 'th': return horizontalBands(['red', 'white', 'blue', 'white', 'red'], [1, 1, 2, 1, 1])(x, y)
    case 'ch': return (x >= 0.405 && x <= 0.595 || y >= 0.34 && y <= 0.66) && x >= 0.31 && x <= 0.69 && y >= 0.25 && y <= 0.75 ? 'white' : 'red'
    case 'se': return nordicCross('blue', 'yellow')(x, y)
    case 'fi': return nordicCross('white', 'blue')(x, y)
    case 'dk': return nordicCross('red', 'white')(x, y)
    case 'no': return nordicCross('red', 'white', 'blue')(x, y)
    case 'bd': return inCircle(x, y, 0.46, 0.5, 0.285) ? 'red' : 'green'
    case 'gb': return unionJack(x, y)
    case 'br': {
      if (Math.abs(x - 0.5) / 0.36 + Math.abs(y - 0.5) / 0.43 <= 1) {
        return inCircle(x, y, 0.5, 0.5, 0.255) ? 'blue' : 'yellow'
      }
      return 'green'
    }
    case 'vn': return inPolygon(x, y, starPoints(0.5, 0.5, 0.31)) ? 'yellow' : 'red'
    case 'cn': {
      if (inPolygon(x, y, starPoints(0.25, 0.28, 0.15))) return 'yellow'
      const smallStars: readonly Point[] = [[0.43, 0.16], [0.50, 0.28], [0.50, 0.41], [0.42, 0.51]]
      return smallStars.some(([cx, cy]) => inPolygon(x, y, starPoints(cx, cy, 0.052, 0.022, Math.atan2(0.28 - cy, 0.25 - cx) - Math.PI / 2))) ? 'yellow' : 'red'
    }
    case 'ca': return x < 0.25 || x > 0.75 || mapleLeaf(x, y) ? 'red' : 'white'
    case 'in': {
      const band = horizontalBands(['orange', 'white', 'green'])(x, y)
      if (band !== 'white') return band
      const point = scenePoint(x, y)
      const center = scenePoint(0.5, 0.5)
      const radius = Math.hypot(point[0] - center[0], point[1] - center[1])
      if (radius >= 0.105 && radius <= 0.13) return 'blue'
      const angle = Math.atan2(point[1] - center[1], point[0] - center[0])
      return radius <= 0.13 && Math.abs(Math.sin(angle * 12)) < 0.17 ? 'blue' : 'white'
    }
    case 'tr': {
      const outer = inCircle(x, y, 0.41, 0.5, 0.255)
      const inner = inCircle(x, y, 0.47, 0.5, 0.205)
      return outer && !inner || inPolygon(x, y, starPoints(0.62, 0.5, 0.105)) ? 'white' : 'red'
    }
    case 'pk': {
      if (x < 0.25) return 'white'
      const outer = inCircle(x, y, 0.57, 0.49, 0.22)
      const inner = inCircle(x, y, 0.62, 0.45, 0.18)
      return outer && !inner || inPolygon(x, y, starPoints(0.69, 0.35, 0.08)) ? 'white' : 'green'
    }
    case 'gr': {
      const base = horizontalBands(['blue', 'white', 'blue', 'white', 'blue', 'white', 'blue', 'white', 'blue'])(x, y)
      if (x > 0.34 || y > 0.56) return base
      return x >= 0.135 && x <= 0.205 || y >= 0.21 && y <= 0.35 ? 'white' : 'blue'
    }
    case 'jm': {
      const point = scenePoint(x, y)
      const onCross = distanceToSegment(point, [-0.8, -0.5], [0.8, 0.5]) < 0.11 || distanceToSegment(point, [0.8, -0.5], [-0.8, 0.5]) < 0.11
      if (onCross) return 'yellow'
      return y < 0.5 ? 'green' : 'black'
    }
    case 'cz': return inPolygon(x, y, [[0, 0], [0, 1], [0.5, 0.5]]) ? 'blue' : y < 0.5 ? 'white' : 'red'
    case 'mk': {
      const point = scenePoint(x, y)
      const center = scenePoint(0.5, 0.5)
      const distance = Math.hypot(point[0] - center[0], point[1] - center[1])
      const angle = Math.atan2(point[1] - center[1], point[0] - center[0])
      return distance < 0.12 || Math.abs(Math.sin(angle * 4)) < 0.19 ? 'yellow' : 'red'
    }
    case 'za': return southAfrica(x, y)
    case 'es': return x > 0.14 && x < 0.22 && y > 0.34 && y < 0.68 ? 'red' : horizontalBands(['red', 'yellow', 'red'], [1, 2, 1])(x, y)
    case 'pt': return inCircle(x, y, 0.38, 0.5, 0.115) ? 'yellow' : verticalBands(['green', 'red'], [2, 3])(x, y)
    case 'ph': {
      if (inPolygon(x, y, [[0, 0], [0, 1], [0.48, 0.5]])) {
        return inCircle(x, y, 0.18, 0.5, 0.08) || [[0.08, 0.12], [0.08, 0.88], [0.38, 0.5]].some(([cx, cy]) => inPolygon(x, y, starPoints(cx, cy, 0.045))) ? 'yellow' : 'white'
      }
      return y < 0.5 ? 'blue' : 'red'
    }
    case 'ar': {
      const base = horizontalBands(['lightBlue', 'white', 'lightBlue'])(x, y)
      return base === 'white' && (inCircle(x, y, 0.5, 0.5, 0.095) || Math.abs(Math.sin(Math.atan2(y - 0.5, x - 0.5) * 12)) < 0.1 && Math.hypot(x - 0.5, y - 0.5) < 0.14) ? 'yellow' : base
    }
    case 'us': {
      const stripe = Math.floor(y * 13) % 2 === 0 ? 'red' : 'white'
      if (x > 0.42 || y > 0.54) return stripe
      const column = Math.floor(x / 0.052)
      const row = Math.floor(y / 0.09)
      const starX = (column + (row % 2) * 0.5) * 0.052 + 0.028
      const starY = row * 0.09 + 0.045
      return inPolygon(x, y, starPoints(starX, starY, 0.018)) ? 'white' : 'blue'
    }
    case 'kr': {
      const point = scenePoint(x, y)
      const center = scenePoint(0.5, 0.5)
      const distance = Math.hypot(point[0] - center[0], point[1] - center[1])
      if (distance < 0.22) return point[1] < center[1] ? 'red' : 'blue'
      const trigrams: readonly [number, number, number][] = [[0.28, 0.28, -0.55], [0.72, 0.28, 0.55], [0.28, 0.72, 0.55], [0.72, 0.72, -0.55]]
      return trigrams.some(([cx, cy, angle]) => {
        const dx = x - cx
        const dy = y - cy
        const localX = dx * Math.cos(angle) + dy * Math.sin(angle)
        const localY = -dx * Math.sin(angle) + dy * Math.cos(angle)
        return Math.abs(localX) < 0.065 && Math.abs(localY) < 0.12 && Math.abs((localY + 0.12) % 0.08 - 0.04) > 0.01
      }) ? 'black' : 'white'
    }
  }
}

/**
 * ビッグモード用の国旗を任意のグリッドへ直接ラスタライズする。
 * 1セル=1色は守りつつ、3×3の占有率で境界色を決めるため、16×10の最近傍拡大には戻らない。
 */
export function createBigFlagGrid(id: DominoFlagId, size: FlagGridSize): FlagCellColor[][] {
  if (!Number.isInteger(size.cols) || !Number.isInteger(size.rows) || size.cols <= 0 || size.rows <= 0) {
    throw new Error(`ビッグ国旗のサイズは正の整数である必要があります: ${size.cols}×${size.rows}`)
  }
  getDominoFlagDefinition(id)

  return Array.from({ length: size.rows }, (_, row) =>
    Array.from({ length: size.cols }, (_, col) => {
      const counts = new Map<FlagCellColor, number>()
      for (const offsetY of SAMPLE_OFFSETS) {
        for (const offsetX of SAMPLE_OFFSETS) {
          const color = paintFlag(id, (col + 0.5 + offsetX / 2) / size.cols, (row + 0.5 + offsetY / 2) / size.rows)
          counts.set(color, (counts.get(color) ?? 0) + 1)
        }
      }
      return [...counts.entries()].reduce((winner, entry) => entry[1] > winner[1] ? entry : winner)[0]
    }),
  )
}
