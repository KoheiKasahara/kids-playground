export type GateLabel = `+${number}` | `−${number}` | `×${number}`
type Lane = -1 | 0 | 1

export type GateRow = {
  distance: number
  lanes: readonly [GateLabel | null, GateLabel | null, GateLabel | null]
  meteor?: { from: Lane; to: Lane }
}

type RowLayout = Omit<GateRow, 'distance'>

function opposite(lane: Lane): Lane {
  if (lane === 0) return 0
  return lane === 1 ? -1 : 1
}

function mirror(layout: RowLayout): RowLayout {
  const [left, center, right] = layout.lanes
  const meteor = layout.meteor
  return {
    lanes: [right, center, left],
    ...(meteor && { meteor: { from: opposite(meteor.from), to: opposite(meteor.to) } }),
  }
}

export function createCourse(random = Math.random): GateRow[] {
  const pick = (a: GateLabel, b: GateLabel) => random() < 0.5 ? a : b
  const layouts: RowLayout[] = [
    { lanes: ['+3', null, '×2'] },
    { lanes: [null, pick('+2', '+4'), null] },
    { lanes: [null, null, null], meteor: { from: -1, to: 0 } },
    { lanes: [pick('−2', '−3'), null, pick('+4', '+5')] },
    { lanes: [null, '×2', null], meteor: { from: 1, to: -1 } },
    { lanes: [pick('+4', '+6'), null, null] },
    { lanes: [null, null, null], meteor: { from: 0, to: 1 } },
    { lanes: [pick('+5', '+7'), '×2', null] },
  ]
  return layouts.map((layout, index) => ({
    ...(index > 0 && random() < 0.5 ? mirror(layout) : layout),
    distance: index + 1,
  }))
}
