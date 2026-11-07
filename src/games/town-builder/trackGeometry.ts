// みち・せんろの まんなかの せん（マスの 0〜100 の ざひょう）。つながる むきの ビット（N=1, E=2, S=4, W=8）から つくる。

type Point = readonly [number, number]
type Segment = { from: Point; to: Point; center?: Point }

const EDGES: readonly Point[] = [[50, 0], [100, 50], [50, 100], [0, 50]]
const MIDDLE: Point = [50, 50]
/** となりあう 2つの むきの あいだの かど。 */
function cornerOf(a: number, b: number): Point {
  const x = a === 1 || b === 1 ? 100 : 0
  const y = a === 2 || b === 2 ? 100 : 0
  return [x, y]
}

export function directions(mask: number): number[] {
  return [0, 1, 2, 3].filter((dir) => mask & (1 << dir))
}

/** つながる むきから、みちの まんなかの せんを つくる。 */
export function segmentsOf(mask: number): { segments: Segment[]; junction: boolean } {
  const dirs = directions(mask)
  if (dirs.length === 0) return { segments: [{ from: [12, 50], to: [88, 50] }], junction: false }
  if (dirs.length === 2) {
    const [a, b] = dirs
    if (b - a === 2) return { segments: [{ from: EDGES[a], to: EDGES[b] }], junction: false }
    return { segments: [{ from: EDGES[a], to: EDGES[b], center: cornerOf(a, b) }], junction: false }
  }
  return { segments: dirs.map((dir) => ({ from: EDGES[dir], to: MIDDLE })), junction: dirs.length > 2 }
}

function shift(point: Point, by: Point, amount: number): Point {
  return [point[0] + by[0] * amount, point[1] + by[1] * amount]
}

/** まんなかの せんから offset だけ よこに ずらした みち（せんろの レール）。 */
export function pathOf(segment: Segment, offset = 0, until = 1): string {
  const { from, to, center } = segment
  if (center) {
    const radius = 50 + offset
    const scale = radius / 50
    const start: Point = [center[0] + (from[0] - center[0]) * scale, center[1] + (from[1] - center[1]) * scale]
    const end: Point = [center[0] + (to[0] - center[0]) * scale, center[1] + (to[1] - center[1]) * scale]
    const cross = (from[0] - center[0]) * (to[1] - center[1]) - (from[1] - center[1]) * (to[0] - center[0])
    return `M${start[0]} ${start[1]} A${radius} ${radius} 0 0 ${cross > 0 ? 1 : 0} ${end[0]} ${end[1]}`
  }
  const length = Math.hypot(to[0] - from[0], to[1] - from[1])
  const normal: Point = [-(to[1] - from[1]) / length, (to[0] - from[0]) / length]
  const start = shift(from, normal, offset)
  const end = shift(start, [(to[0] - from[0]) * until, (to[1] - from[1]) * until], 1)
  return `M${start[0]} ${start[1]} L${end[0]} ${end[1]}`
}
