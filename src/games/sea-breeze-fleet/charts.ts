export type Point = { x: number; y: number }
export type Island = Point & { rx: number; ry: number }
export type Chart = {
  id: string
  name: string
  mission: string
  kind: 'harbor' | 'escort' | 'flagship'
  islands: Island[]
  pirates: Point[]
}

export const chartWidth = 600
export const chartHeight = 320
export const charts: readonly Chart[] = [
  {
    id: 'harbor', name: 'とうだいの みなと', kind: 'harbor', mission: 'かいぞくせんを 3せき おいかえそう',
    islands: [
      { x: 19, y: 12, rx: 107, ry: 58 }, { x: 563, y: -19, rx: 80, ry: 49 },
      { x: 586, y: 306, rx: 85, ry: 52 }, { x: -17, y: 296, rx: 45, ry: 24 },
    ],
    pirates: [{ x: 304, y: 75 }, { x: 449, y: 146 }, { x: 362, y: 249 }],
  },
  {
    id: 'lagoon', name: 'ひすいの さんごしょう', kind: 'escort', mission: 'ゆうびんせんを まもろう',
    islands: [
      { x: 83, y: 0, rx: 89, ry: 47 }, { x: 552, y: 47, rx: 62, ry: 43 },
      { x: 153, y: 323, rx: 75, ry: 43 }, { x: 620, y: 293, rx: 56, ry: 47 },
    ],
    pirates: [{ x: 287, y: 65 }, { x: 411, y: 215 }, { x: 499, y: 143 }, { x: 243, y: 252 }],
  },
  {
    id: 'sunset', name: 'ゆうやけの かいきょう', kind: 'flagship', mission: 'おおきな おやぶんせんに いどもう',
    islands: [
      { x: -9, y: 69, rx: 82, ry: 56 }, { x: 395, y: -23, rx: 100, ry: 49 },
      { x: 584, y: 302, rx: 82, ry: 54 }, { x: 93, y: 340, rx: 71, ry: 43 },
    ],
    pirates: [{ x: 369, y: 114 }, { x: 262, y: 57 }, { x: 471, y: 218 }],
  },
]

// The coast, the shoals and the navigation boundary share the same contour.
export function shoreDistance(x: number, y: number, islands: readonly Island[]) {
  let depth = Infinity
  for (const island of islands) {
    const dx = (x - island.x) / island.rx
    const dy = (y - island.y) / island.ry
    depth = Math.min(depth, (Math.sqrt(dx * dx + dy * dy) - 1) * island.ry)
  }
  return depth + 3 * Math.sin(x * 0.095 + y * 0.06) + 2 * Math.sin(y * 0.23 - x * 0.052)
}
