import {
  AREA_ENTRY_CLEARANCE,
  AREA_HEIGHT,
  AREA_COLUMN_STEP,
  AREA_WIDTH,
  BALL_RADIUS,
  CLOUD_ENTRY_LEFT_X,
  CLOUD_ENTRY_RIGHT_X,
  CLOUD_EXIT_X,
  CLOUD_V_ANGLE,
  CLOUD_V_HEIGHT,
  CLOUD_V_LEFT_X,
  CLOUD_V_RIGHT_X,
  CLOUD_V_WIDTH,
  CLOUD_V_Y,
  CAVE_ROCK_RADIUS,
  CAVE_ROCK_BOTTOM_Y,
  CAVE_ROCK_TOP_Y,
  CAVE_ROCK_X,
  CAVE_ZIGZAG_ANGLE,
  CAVE_ZIGZAG_BOTTOM_Y,
  CAVE_ZIGZAG_LEFT_X,
  CAVE_ZIGZAG_RIGHT_X,
  CAVE_ZIGZAG_SECOND_Y,
  CAVE_ZIGZAG_TOP_Y,
  CAVE_ZIGZAG_WALL_HEIGHT,
  CAVE_ZIGZAG_WALL_WIDTH,
  CUP_INNER_DEPTH,
  EXIT_CENTER_OFFSET_FROM_BOTTOM,
  EXIT_SENSOR_HEIGHT,
  EXIT_WIDTH,
  FOREST_APPROACH_LOG_ANGLE,
  FOREST_APPROACH_LOG_HEIGHT,
  FOREST_APPROACH_LOG_LEFT_X,
  FOREST_APPROACH_LOG_RIGHT_X,
  FOREST_APPROACH_LOG_WIDTH,
  FOREST_APPROACH_LOG_Y,
  FOREST_APPROACH_MUSHROOM_LEFT_X,
  FOREST_APPROACH_MUSHROOM_RADIUS,
  FOREST_APPROACH_MUSHROOM_RIGHT_X,
  FOREST_APPROACH_MUSHROOM_Y,
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
  GOAL_CUP_BOTTOM_MARGIN,
  GOAL_FUNNEL_LOWER_ANGLE,
  GOAL_FUNNEL_LOWER_LEFT_X,
  GOAL_FUNNEL_LOWER_RIGHT_X,
  GOAL_FUNNEL_LOWER_WIDTH,
  GOAL_FUNNEL_LOWER_Y,
  GOAL_FUNNEL_TOP_ANGLE,
  GOAL_FUNNEL_TOP_LEFT_X,
  GOAL_FUNNEL_TOP_RIGHT_X,
  GOAL_FUNNEL_TOP_WIDTH,
  GOAL_FUNNEL_TOP_Y,
  GOAL_FUNNEL_WALL_HEIGHT,
  GOAL_SPARK_RADIUS,
  GOAL_SPARK_X,
  GOAL_SPARK_Y,
  MERGE_ENTRY_SPEED,
  MERGE_ENTRY_VERTICAL_SPEED,
  PIN_RESTITUTION,
  RIVER_SWEEP_ANGLE,
  RIVER_SWEEP_BOTTOM_Y,
  RIVER_SWEEP_HEIGHT,
  RIVER_SWEEP_SECOND_Y,
  RIVER_SWEEP_TOP_Y,
  RIVER_SWEEP_WIDTH,
  SIDE_EXIT_INSET,
  SKY_CLOUD_PIN_BOTTOM_Y,
  SKY_CLOUD_PIN_LEFT_X,
  SKY_CLOUD_PIN_MIDDLE_Y,
  SKY_CLOUD_PIN_RADIUS,
  SKY_CLOUD_PIN_RIGHT_X,
  SKY_CLOUD_PIN_TOP_Y,
  SKY_SLOPE_ANGLE,
  SKY_SLOPE_BOTTOM_Y,
  SKY_SLOPE_HEIGHT,
  SKY_SLOPE_MIDDLE_Y,
  SKY_SLOPE_TOP_Y,
  SKY_SLOPE_WIDTH,
  SKY_SLOPE_X,
  WALL_RESTITUTION,
} from '../adventurePhysics'
import type { AdventureArea, AreaEntry, AreaExit } from '../types'

/** 入口の中心を上端の安全な余白より少し下へ置き、初速の揺らぎを受け止める。 */
const ENTRY_Y = AREA_ENTRY_CLEARANCE + BALL_RADIUS
/** 出口は床の左右に受け皿を残せる高さへ置き、穴へ落ちる途中のボールを検知する。 */
const EXIT_Y = AREA_HEIGHT - EXIT_CENTER_OFFSET_FROM_BOTTOM
/** 最下段の斜面が最後にボールを寄せる側。出口だけをその流れに合わせる。 */
const SKY_EXIT_X = AREA_WIDTH - SIDE_EXIT_INSET
const CAVE_EXIT_X = AREA_WIDTH / 2
const RIVER_EXIT_X = AREA_WIDTH - SIDE_EXIT_INSET
const PORTAL_SIZE = { width: EXIT_WIDTH, height: EXIT_SENSOR_HEIGHT }

/** 開始エリアをデータから参照するためのid。分岐追加時も入口生成を自動にしない。 */
export const START_AREA_ID = 'sky'

/**
 * 6エリアを上下左右に配置したPhase 2 Task Cのコース。
 * 森で左右に分岐し、洞窟と川が雲で合流する流れを、エリアごとに異なる板とピンで見せる。
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
      { kind: 'wall', id: 'sky-slide-left', x: SKY_SLOPE_X, y: SKY_SLOPE_TOP_Y, width: SKY_SLOPE_WIDTH, height: SKY_SLOPE_HEIGHT, angle: SKY_SLOPE_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'sky-slide-right', x: SKY_SLOPE_X, y: SKY_SLOPE_MIDDLE_Y, width: SKY_SLOPE_WIDTH, height: SKY_SLOPE_HEIGHT, angle: -SKY_SLOPE_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'sky-slide-lower', x: SKY_SLOPE_X, y: SKY_SLOPE_BOTTOM_Y, width: SKY_SLOPE_WIDTH, height: SKY_SLOPE_HEIGHT, angle: SKY_SLOPE_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'pin', id: 'sky-cloud-1', x: SKY_CLOUD_PIN_LEFT_X, y: SKY_CLOUD_PIN_TOP_Y, radius: SKY_CLOUD_PIN_RADIUS, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'sky-cloud-2', x: SKY_CLOUD_PIN_RIGHT_X, y: SKY_CLOUD_PIN_MIDDLE_Y, radius: SKY_CLOUD_PIN_RADIUS, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'sky-cloud-3', x: SKY_CLOUD_PIN_LEFT_X, y: SKY_CLOUD_PIN_BOTTOM_Y, radius: SKY_CLOUD_PIN_RADIUS, restitution: PIN_RESTITUTION },
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
      // 分岐へ入る前に左右の丸太を横切り、キノコで森を通った感触を足す。左右対称にして分岐の偏りを増やさない。
      { kind: 'wall', id: 'forest-approach-log-left', x: FOREST_APPROACH_LOG_LEFT_X, y: FOREST_APPROACH_LOG_Y, width: FOREST_APPROACH_LOG_WIDTH, height: FOREST_APPROACH_LOG_HEIGHT, angle: FOREST_APPROACH_LOG_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'forest-approach-log-right', x: FOREST_APPROACH_LOG_RIGHT_X, y: FOREST_APPROACH_LOG_Y, width: FOREST_APPROACH_LOG_WIDTH, height: FOREST_APPROACH_LOG_HEIGHT, angle: -FOREST_APPROACH_LOG_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'pin', id: 'forest-approach-mushroom-left', x: FOREST_APPROACH_MUSHROOM_LEFT_X, y: FOREST_APPROACH_MUSHROOM_Y, radius: FOREST_APPROACH_MUSHROOM_RADIUS, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'forest-approach-mushroom-right', x: FOREST_APPROACH_MUSHROOM_RIGHT_X, y: FOREST_APPROACH_MUSHROOM_Y, radius: FOREST_APPROACH_MUSHROOM_RADIUS, restitution: PIN_RESTITUTION },
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
      // 短い板を左右交互に置き、長い斜面とは違う狭いジグザグを作る。
      { kind: 'wall', id: 'cave-zigzag-left-top', x: CAVE_ZIGZAG_LEFT_X, y: CAVE_ZIGZAG_TOP_Y, width: CAVE_ZIGZAG_WALL_WIDTH, height: CAVE_ZIGZAG_WALL_HEIGHT, angle: CAVE_ZIGZAG_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'cave-zigzag-right-second', x: CAVE_ZIGZAG_RIGHT_X, y: CAVE_ZIGZAG_SECOND_Y, width: CAVE_ZIGZAG_WALL_WIDTH, height: CAVE_ZIGZAG_WALL_HEIGHT, angle: -CAVE_ZIGZAG_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'cave-zigzag-left-bottom', x: CAVE_ZIGZAG_LEFT_X, y: CAVE_ZIGZAG_BOTTOM_Y, width: CAVE_ZIGZAG_WALL_WIDTH, height: CAVE_ZIGZAG_WALL_HEIGHT, angle: CAVE_ZIGZAG_ANGLE, restitution: WALL_RESTITUTION },
      // 岩は板の間隔を広く取った位置に置き、中央の縦落下路を塞ぎながら静止点を作らない。
      { kind: 'pin', id: 'cave-rock-top', x: CAVE_ROCK_X, y: CAVE_ROCK_TOP_Y, radius: CAVE_ROCK_RADIUS, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'cave-rock-bottom', x: CAVE_ROCK_X, y: CAVE_ROCK_BOTTOM_Y, radius: CAVE_ROCK_RADIUS, restitution: PIN_RESTITUTION },
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
      // 反対側まで届く長い板をゆるく反転させ、落差より左右への渡りを目立たせる。
      { kind: 'wall', id: 'river-sweep-top', x: AREA_WIDTH / 2, y: RIVER_SWEEP_TOP_Y, width: RIVER_SWEEP_WIDTH, height: RIVER_SWEEP_HEIGHT, angle: RIVER_SWEEP_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'river-sweep-second', x: AREA_WIDTH / 2, y: RIVER_SWEEP_SECOND_Y, width: RIVER_SWEEP_WIDTH, height: RIVER_SWEEP_HEIGHT, angle: -RIVER_SWEEP_ANGLE, restitution: WALL_RESTITUTION },
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
      // 左右の入口から下りる2枚の板をV字にし、中央の通常幅ポータルへ自然に集める。
      { kind: 'wall', id: 'cloud-v-left', x: CLOUD_V_LEFT_X, y: CLOUD_V_Y, width: CLOUD_V_WIDTH, height: CLOUD_V_HEIGHT, angle: CLOUD_V_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'cloud-v-right', x: CLOUD_V_RIGHT_X, y: CLOUD_V_Y, width: CLOUD_V_WIDTH, height: CLOUD_V_HEIGHT, angle: -CLOUD_V_ANGLE, restitution: WALL_RESTITUTION },
    ],
    exits: [
      {
        id: 'cloud-to-goal',
        kind: 'pipe',
        x: CLOUD_EXIT_X,
        y: EXIT_Y,
        ...PORTAL_SIZE,
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
      { kind: 'wall', id: 'goal-funnel-left', x: GOAL_FUNNEL_TOP_LEFT_X, y: GOAL_FUNNEL_TOP_Y, width: GOAL_FUNNEL_TOP_WIDTH, height: GOAL_FUNNEL_WALL_HEIGHT, angle: GOAL_FUNNEL_TOP_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'goal-funnel-right', x: GOAL_FUNNEL_TOP_RIGHT_X, y: GOAL_FUNNEL_TOP_Y, width: GOAL_FUNNEL_TOP_WIDTH, height: GOAL_FUNNEL_WALL_HEIGHT, angle: -GOAL_FUNNEL_TOP_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'goal-funnel-lower-left', x: GOAL_FUNNEL_LOWER_LEFT_X, y: GOAL_FUNNEL_LOWER_Y, width: GOAL_FUNNEL_LOWER_WIDTH, height: GOAL_FUNNEL_WALL_HEIGHT, angle: GOAL_FUNNEL_LOWER_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'goal-funnel-lower-right', x: GOAL_FUNNEL_LOWER_RIGHT_X, y: GOAL_FUNNEL_LOWER_Y, width: GOAL_FUNNEL_LOWER_WIDTH, height: GOAL_FUNNEL_WALL_HEIGHT, angle: -GOAL_FUNNEL_LOWER_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'pin', id: 'goal-spark', x: GOAL_SPARK_X, y: GOAL_SPARK_Y, radius: GOAL_SPARK_RADIUS, restitution: PIN_RESTITUTION },
    ],
    exits: [],
    cup: { id: 'goal-cup', x: AREA_WIDTH / 2, rimY: AREA_HEIGHT - CUP_INNER_DEPTH - GOAL_CUP_BOTTOM_MARGIN },
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
