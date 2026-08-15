import {
  AREA_ENTRY_CLEARANCE,
  AREA_HEIGHT,
  AREA_COLUMN_STEP,
  AREA_WIDTH,
  BALL_RADIUS,
  CLOUD_ENTRY_LEFT_X,
  CLOUD_ENTRY_RIGHT_X,
  CLOUD_EXIT_X,
  CLOUD_EXIT_WIDTH,
  CLOUD_SOFT_BUMPER_RADIUS,
  CLOUD_SOFT_BUMPER_Y,
  CUP_INNER_DEPTH,
  EXIT_CENTER_OFFSET_FROM_BOTTOM,
  EXIT_SENSOR_HEIGHT,
  EXIT_WIDTH,
  FOREST_BRANCH_BUMPER_RADIUS,
  FOREST_BRANCH_BUMPER_X,
  FOREST_BRANCH_BUMPER_Y,
  FOREST_BRANCH_RIDGE_RADIUS,
  FOREST_BRANCH_RIDGE_Y,
  FOREST_BRANCH_ROOF_ANGLE,
  FOREST_BRANCH_ROOF_HEIGHT,
  FOREST_BRANCH_ROOF_LEFT_X,
  FOREST_BRANCH_ROOF_RIGHT_X,
  FOREST_BRANCH_ROOF_Y,
  FOREST_BRANCH_ROOF_WIDTH,
  FOREST_LEFT_EXIT_X,
  FOREST_RIGHT_EXIT_X,
  MERGE_ENTRY_SPEED,
  MERGE_ENTRY_VERTICAL_SPEED,
  PIN_RESTITUTION,
  RIVER_SWEEP_ANGLE,
  RIVER_SWEEP_BOTTOM_Y,
  RIVER_SWEEP_HEIGHT,
  RIVER_SWEEP_MIDDLE_Y,
  RIVER_SWEEP_TOP_Y,
  RIVER_SWEEP_WIDTH,
  WALL_RESTITUTION,
} from '../adventurePhysics'
import type { AdventureArea, AreaEntry, AreaExit } from '../types'

/** 入口の中心を上端の安全な余白より少し下へ置き、初速の揺らぎを受け止める。 */
const ENTRY_Y = AREA_ENTRY_CLEARANCE + BALL_RADIUS
/** 出口は床の左右に受け皿を残せる高さへ置き、穴へ落ちる途中のボールを検知する。 */
const EXIT_Y = AREA_HEIGHT - EXIT_CENTER_OFFSET_FROM_BOTTOM
/** Phase 1の最下段の斜面が最後にボールを寄せる側。出口だけをその流れに合わせる。 */
const SKY_EXIT_X = AREA_WIDTH - 80
const CAVE_EXIT_X = AREA_WIDTH - 80
const RIVER_EXIT_X = AREA_WIDTH - 80
const PORTAL_SIZE = { width: EXIT_WIDTH, height: EXIT_SENSOR_HEIGHT }

/** 開始エリアをデータから参照するためのid。分岐追加時も入口生成を自動にしない。 */
export const START_AREA_ID = 'sky'

/**
 * 6エリアを上下左右に配置したPhase 2 Task Bのコース。
 * 森で左右に分岐し、洞窟と川が雲で合流する流れを出口データで表す。
 * 出口左右の床とゴールの床・カップ本体は、出口/cupの寸法から物理側で生成する。
 */
export const AREAS: readonly AdventureArea[] = [
  {
    id: 'sky',
    nameJa: 'そら',
    theme: 'sky',
    origin: { x: 1 * AREA_COLUMN_STEP, y: 0 * AREA_HEIGHT },
    entries: [{ id: 'sky-entry', kind: 'hole', x: AREA_WIDTH / 2, y: ENTRY_Y }],
    objects: [
      // 中央の板で受けてから左右へ送るため、入口直後でも落下の向きが毎回少し変わる。
      { kind: 'wall', id: 'sky-slide-left', x: 240, y: 170, width: 300, height: 18, angle: 0.36, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'sky-slide-right', x: 240, y: 360, width: 300, height: 18, angle: -0.36, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'sky-slide-lower', x: 240, y: 550, width: 300, height: 18, angle: 0.36, restitution: WALL_RESTITUTION },
      { kind: 'pin', id: 'sky-cloud-1', x: 20, y: 80, radius: 16, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'sky-cloud-2', x: 460, y: 260, radius: 16, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'sky-cloud-3', x: 20, y: 640, radius: 16, restitution: PIN_RESTITUTION },
    ],
    exits: [
      {
        id: 'sky-to-forest',
        kind: 'hole',
        x: SKY_EXIT_X,
        y: EXIT_Y,
        ...PORTAL_SIZE,
        to: 'forest',
        toEntry: 'forest-entry',
      },
    ],
  },
  {
    id: 'forest',
    nameJa: 'もり',
    theme: 'forest',
    origin: { x: 1 * AREA_COLUMN_STEP, y: 1 * AREA_HEIGHT },
    entries: [{ id: 'forest-entry', kind: 'hole', x: AREA_WIDTH / 2, y: ENTRY_Y }],
    objects: [
      // 中央の大きなキノコ風バンパーで、初速の違いを左右の分岐へ広げる。
      { kind: 'pin', id: 'forest-mushroom-bumper', x: FOREST_BRANCH_BUMPER_X, y: FOREST_BRANCH_BUMPER_Y, radius: FOREST_BRANCH_BUMPER_RADIUS, restitution: PIN_RESTITUTION },
      // 中央を高くした屋根を左右に分け、落下したボールをそれぞれの出口側へ送る。
      { kind: 'wall', id: 'forest-branch-roof-left', x: FOREST_BRANCH_ROOF_LEFT_X, y: FOREST_BRANCH_ROOF_Y, width: FOREST_BRANCH_ROOF_WIDTH, height: FOREST_BRANCH_ROOF_HEIGHT, angle: -FOREST_BRANCH_ROOF_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'forest-branch-roof-right', x: FOREST_BRANCH_ROOF_RIGHT_X, y: FOREST_BRANCH_ROOF_Y, width: FOREST_BRANCH_ROOF_WIDTH, height: FOREST_BRANCH_ROOF_HEIGHT, angle: FOREST_BRANCH_ROOF_ANGLE, restitution: WALL_RESTITUTION },
      // 出口間の帯は44pxより広いため、中央の尾根でボールが帯の上に静止しないようにする。
      { kind: 'pin', id: 'forest-branch-ridge', x: FOREST_BRANCH_BUMPER_X, y: FOREST_BRANCH_RIDGE_Y, radius: FOREST_BRANCH_RIDGE_RADIUS, restitution: PIN_RESTITUTION },
    ],
    exits: [
      {
        id: 'forest-to-cave',
        kind: 'tunnel',
        x: FOREST_LEFT_EXIT_X,
        y: EXIT_Y,
        ...PORTAL_SIZE,
        to: 'cave',
        toEntry: 'cave-entry',
      },
      {
        id: 'forest-to-river',
        kind: 'hole',
        x: FOREST_RIGHT_EXIT_X,
        y: EXIT_Y,
        ...PORTAL_SIZE,
        to: 'river',
        toEntry: 'river-entry',
      },
    ],
  },
  {
    id: 'cave',
    nameJa: 'どうくつ',
    theme: 'cave',
    origin: { x: 0 * AREA_COLUMN_STEP, y: 2 * AREA_HEIGHT },
    entries: [{ id: 'cave-entry', kind: 'tunnel', x: AREA_WIDTH / 2, y: ENTRY_Y }],
    objects: [
      { kind: 'wall', id: 'cave-slope-left', x: 240, y: 160, width: 220, height: 18, angle: 0.3, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'cave-slope-right', x: 240, y: 330, width: 220, height: 18, angle: -0.3, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'cave-slope-left-lower', x: 240, y: 500, width: 220, height: 18, angle: 0.3, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'cave-slope-right-lower', x: 240, y: 650, width: 180, height: 18, angle: -0.2, restitution: WALL_RESTITUTION },
      { kind: 'pin', id: 'cave-rock-1', x: 20, y: 80, radius: 17, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'cave-rock-2', x: 460, y: 260, radius: 17, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'cave-rock-3', x: 20, y: 440, radius: 17, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'cave-rock-4', x: 460, y: 620, radius: 17, restitution: PIN_RESTITUTION },
    ],
    exits: [
      {
        id: 'cave-to-cloud',
        kind: 'pipe',
        x: CAVE_EXIT_X,
        y: EXIT_Y,
        ...PORTAL_SIZE,
        to: 'cloud',
        toEntry: 'cloud-entry-left',
      },
    ],
  },
  {
    id: 'river',
    nameJa: 'かわ',
    theme: 'river',
    origin: { x: 2 * AREA_COLUMN_STEP, y: 2 * AREA_HEIGHT },
    entries: [{ id: 'river-entry', kind: 'hole', x: AREA_WIDTH / 2, y: ENTRY_Y }],
    objects: [
      { kind: 'wall', id: 'river-sweep-top', x: AREA_WIDTH / 2, y: RIVER_SWEEP_TOP_Y, width: RIVER_SWEEP_WIDTH, height: RIVER_SWEEP_HEIGHT, angle: RIVER_SWEEP_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'river-sweep-middle', x: AREA_WIDTH / 2, y: RIVER_SWEEP_MIDDLE_Y, width: RIVER_SWEEP_WIDTH, height: RIVER_SWEEP_HEIGHT, angle: -RIVER_SWEEP_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'river-sweep-bottom', x: AREA_WIDTH / 2, y: RIVER_SWEEP_BOTTOM_Y, width: RIVER_SWEEP_WIDTH, height: RIVER_SWEEP_HEIGHT, angle: RIVER_SWEEP_ANGLE, restitution: WALL_RESTITUTION },
    ],
    exits: [
      {
        id: 'river-to-cloud',
        kind: 'hole',
        x: RIVER_EXIT_X,
        y: EXIT_Y,
        ...PORTAL_SIZE,
        to: 'cloud',
        toEntry: 'cloud-entry-right',
      },
    ],
  },
  {
    id: 'cloud',
    nameJa: 'くも',
    theme: 'cloud',
    origin: { x: 1 * AREA_COLUMN_STEP, y: 3 * AREA_HEIGHT },
    entries: [
      {
        id: 'cloud-entry-left',
        kind: 'pipe',
        x: CLOUD_ENTRY_LEFT_X,
        y: ENTRY_Y,
        velocity: { x: MERGE_ENTRY_SPEED, y: MERGE_ENTRY_VERTICAL_SPEED },
      },
      {
        id: 'cloud-entry-right',
        kind: 'hole',
        x: CLOUD_ENTRY_RIGHT_X,
        y: ENTRY_Y,
        velocity: { x: -MERGE_ENTRY_SPEED, y: MERGE_ENTRY_VERTICAL_SPEED },
      },
    ],
    objects: [
      { kind: 'pin', id: 'cloud-soft-bumper', x: CLOUD_EXIT_X, y: CLOUD_SOFT_BUMPER_Y, radius: CLOUD_SOFT_BUMPER_RADIUS, restitution: PIN_RESTITUTION },
    ],
    exits: [
      {
        id: 'cloud-to-goal',
        kind: 'pipe',
        x: CLOUD_EXIT_X,
        y: EXIT_Y,
        ...PORTAL_SIZE,
        width: CLOUD_EXIT_WIDTH,
        to: 'goal',
        toEntry: 'goal-entry',
      },
    ],
  },
  {
    id: 'goal',
    nameJa: 'ゴール',
    theme: 'goal',
    origin: { x: 1 * AREA_COLUMN_STEP, y: 4 * AREA_HEIGHT },
    entries: [{ id: 'goal-entry', kind: 'pipe', x: AREA_WIDTH / 2, y: ENTRY_Y }],
    objects: [
      // 上側のV字はそのまま残し、ボールを中央へ寄せるコースの流れを維持する。
      { kind: 'wall', id: 'goal-funnel-left', x: 110, y: 250, width: 160, height: 18, angle: 0.35, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'goal-funnel-right', x: 370, y: 250, width: 160, height: 18, angle: -0.35, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'goal-funnel-lower-left', x: 106, y: 505, width: 180, height: 18, angle: 0.55, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'goal-funnel-lower-right', x: 374, y: 505, width: 180, height: 18, angle: -0.55, restitution: WALL_RESTITUTION },
      { kind: 'pin', id: 'goal-spark', x: 240, y: 370, radius: 18, restitution: PIN_RESTITUTION },
    ],
    exits: [],
    cup: { id: 'goal-cup', x: AREA_WIDTH / 2, rimY: AREA_HEIGHT - CUP_INNER_DEPTH - 34 },
  },
]

const areaById = new Map(AREAS.map((area) => [area.id, area]))

/** idからエリアを引く。未知のidはデータ不整合を呼び出し側で扱えるようundefinedを返す。 */
export function findArea(id: string): AdventureArea | undefined {
  return areaById.get(id)
}

/** ボールのローカルx座標に応じて、開口内を優先し、それ以外は中心が最も近い出口を選ぶ。 */
export function pickExitForBallX(area: AdventureArea, localX: number): AreaExit | undefined {
  const containingExit = area.exits.find((exit) => {
    const halfWidth = exit.width / 2
    return localX >= exit.x - halfWidth && localX <= exit.x + halfWidth
  })
  if (containingExit) return containingExit

  const firstExit = area.exits[0]
  if (!firstExit) return undefined

  let nearestExit = firstExit
  let nearestDistance = Math.abs(localX - firstExit.x)
  for (const exit of area.exits.slice(1)) {
    const distance = Math.abs(localX - exit.x)
    if (distance < nearestDistance) {
      nearestExit = exit
      nearestDistance = distance
    }
  }
  return nearestExit
}

export type ResolvedExitTarget = {
  areaId: string
  entry: AreaEntry
}

/** 出口idから接続先のエリアと入口を解決し、未知idや壊れた接続は安全にundefinedへ落とす。 */
export function resolveExitTarget(areaId: string, exitId: string): ResolvedExitTarget | undefined {
  const area = findArea(areaId)
  const exit: AreaExit | undefined = area?.exits.find((candidate) => candidate.id === exitId)
  if (!exit) return undefined

  const targetArea = findArea(exit.to)
  const entry = targetArea?.entries.find((candidate) => candidate.id === exit.toEntry)
  if (!targetArea || !entry) return undefined
  return { areaId: targetArea.id, entry }
}
