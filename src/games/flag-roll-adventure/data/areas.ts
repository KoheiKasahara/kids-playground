import {
  AREA_ENTRY_CLEARANCE,
  AREA_HEIGHT,
  AREA_COLUMN_STEP,
  AREA_WIDTH,
  BALL_RADIUS,
  CLOUD_BUMPER_CENTER_RADIUS,
  CLOUD_BUMPER_CENTER_X,
  CLOUD_BUMPER_CENTER_Y,
  CLOUD_BUMPER_LEFT_X,
  CLOUD_BUMPER_LEFT_Y,
  CLOUD_BUMPER_RIGHT_X,
  CLOUD_BUMPER_RIGHT_Y,
  CLOUD_BUMPER_SIDE_RADIUS,
  CLOUD_ENTRY_LEFT_X,
  CLOUD_ENTRY_RIGHT_X,
  CLOUD_EXIT_X,
  CLOUD_V_ANGLE,
  CLOUD_V_HEIGHT,
  CLOUD_V_LEFT_X,
  CLOUD_V_RIGHT_X,
  CLOUD_V_WIDTH,
  CLOUD_V_Y,
  CAVE_TOP_ROCK_RADIUS,
  CAVE_ROCK_BOTTOM_Y,
  CAVE_ROCK_BOTTOM_RIGHT_X,
  CAVE_ROCK_MIDDLE_LEFT_RADIUS,
  CAVE_ROCK_MIDDLE_LEFT_RESTITUTION,
  CAVE_ROCK_MIDDLE_LEFT_X,
  CAVE_ROCK_MIDDLE_LEFT_Y,
  CAVE_ROCK_TOP_Y,
  CAVE_ROCK_TOP_CENTER_X,
  CAVE_BOTTOM_ROCK_RADIUS,
  CAVE_BOTTOM_ROCK_RESTITUTION,
  CAVE_CANNON_POWER,
  CAVE_CANNON_APPROACH_RADIUS,
  CAVE_CANNON_APPROACH_X,
  CAVE_CANNON_APPROACH_Y,
  CAVE_CANNON_LANDING_RADIUS,
  CAVE_CANNON_LANDING_RESTITUTION,
  CAVE_CANNON_LANDING_X,
  CAVE_CANNON_LANDING_Y,
  CAVE_CHANNEL_ANGLE,
  CAVE_CHANNEL_HEIGHT,
  CAVE_CHANNEL_LEFT_X,
  CAVE_CHANNEL_RIGHT_X,
  CAVE_CHANNEL_WIDTH,
  CAVE_CHANNEL_Y,
  CAVE_ZIGZAG_ANGLE,
  CAVE_ZIGZAG_BOTTOM_Y,
  CAVE_ZIGZAG_BOTTOM_WIDTH,
  CAVE_ZIGZAG_BOTTOM_LEFT_X,
  CAVE_ZIGZAG_BOTTOM_RIGHT_X,
  CAVE_ZIGZAG_LEFT_X,
  CAVE_ZIGZAG_RIGHT_X,
  CAVE_ZIGZAG_SECOND_LEFT_X,
  CAVE_ZIGZAG_SECOND_RIGHT_X,
  CAVE_ZIGZAG_SECOND_Y,
  CAVE_ZIGZAG_TOP_Y,
  CAVE_ZIGZAG_WALL_HEIGHT,
  CAVE_ZIGZAG_WALL_WIDTH,
  CUP_INNER_DEPTH,
  BOOST_MAX_SPEED,
  CANNON_HOLD_MS,
  CANNON_SENSOR_RADIUS,
  EXIT_CENTER_OFFSET_FROM_BOTTOM,
  EXIT_SENSOR_HEIGHT,
  EXIT_WIDTH,
  FOREST_APPROACH_LOG_ANGLE,
  FOREST_APPROACH_LOG_HEIGHT,
  FOREST_APPROACH_LOG_LEFT_X,
  FOREST_APPROACH_LOG_RIGHT_X,
  FOREST_APPROACH_LOG_WIDTH,
  FOREST_APPROACH_LOG_Y,
  FOREST_BRANCH_PIN_RADIUS,
  FOREST_BRANCH_PIN_SIDE_LEFT_X,
  FOREST_BRANCH_PIN_SIDE_RADIUS,
  FOREST_BRANCH_PIN_SIDE_RIGHT_X,
  FOREST_BRANCH_PIN_TOP_X,
  FOREST_BRANCH_PIN_TOP_Y,
  FOREST_BRANCH_ROOF_ANGLE,
  FOREST_BRANCH_ROOF_HEIGHT,
  FOREST_BRANCH_ROOF_LEFT_X,
  FOREST_BRANCH_ROOF_RIGHT_X,
  FOREST_BRANCH_ROOF_Y,
  FOREST_BRANCH_ROOF_WIDTH,
  FOREST_EXIT_WIDTH,
  FOREST_EXIT_RAMP_ANGLE,
  FOREST_EXIT_RAMP_HEIGHT,
  FOREST_EXIT_RAMP_LEFT_X,
  FOREST_EXIT_RAMP_RIGHT_X,
  FOREST_EXIT_RAMP_WIDTH,
  FOREST_EXIT_RAMP_Y,
  FOREST_PIN_MIDDLE_LEFT_X,
  FOREST_PIN_MIDDLE_RIGHT_X,
  FOREST_PIN_RADIUS,
  FOREST_PIN_ROW_MIDDLE_Y,
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
  RIVER_JUMP_POWER,
  RIVER_PIN_RADIUS,
  RIVER_PIN_TOP_Y,
  RIVER_PIN_TOP_RIGHT_X,
  RIVER_SWEEP_ANGLE,
  RIVER_SWEEP_BOTTOM_Y,
  RIVER_SWEEP_HEIGHT,
  RIVER_SWEEP_SECOND_Y,
  RIVER_SWEEP_SECOND_X,
  RIVER_SWEEP_SECOND_WIDTH,
  RIVER_SWEEP_TOP_Y,
  RIVER_SWEEP_WIDTH,
  SKY_CLOUD_BUMPER_X,
  SKY_CLOUD_BUMPER_Y,
  SKY_CLOUD_BUMPER_RADIUS,
  SKY_CLOUD_PIN_LEFT_X,
  SKY_CLOUD_PIN_LEFT_Y,
  SKY_CLOUD_PIN_RADIUS,
  SKY_CLOUD_PIN_RIGHT_X,
  SKY_CLOUD_PIN_RIGHT_Y,
  SKY_CLOUD_SIDE_LEFT_X,
  SKY_CLOUD_SIDE_RIGHT_X,
  SKY_CLOUD_SIDE_RADIUS,
  SKY_CLOUD_SIDE_Y,
  SKY_SLOPE_ANGLE,
  SKY_SLOPE_BOTTOM_Y,
  SKY_SLOPE_BOTTOM_WIDTH,
  SKY_SLOPE_HEIGHT,
  SKY_SLOPE_MIDDLE_Y,
  SKY_SLOPE_MIDDLE_WIDTH,
  SKY_SLOPE_MIDDLE_LEFT_X,
  SKY_SLOPE_MIDDLE_RIGHT_X,
  SKY_SLOPE_TOP_Y,
  SKY_SLOPE_TOP_WIDTH,
  SKY_SLOPE_LEFT_X,
  SKY_SLOPE_RIGHT_X,
  SKY_SLOPE_BOTTOM_LEFT_X,
  SKY_SLOPE_BOTTOM_RIGHT_X,
  WALL_RESTITUTION,
} from '../adventurePhysics'
import type { AdventureArea, AreaEntry, AreaExit } from '../types'

/** 入口の中心を上端の安全な余白より少し下へ置き、初速の揺らぎを受け止める。 */
const ENTRY_Y = AREA_ENTRY_CLEARANCE + BALL_RADIUS
/** 出口は床の左右に受け皿を残せる高さへ置き、穴へ落ちる途中のボールを検知する。 */
const EXIT_Y = AREA_HEIGHT - EXIT_CENTER_OFFSET_FROM_BOTTOM
/** 最下段の斜面が最後にボールを寄せる側。出口だけをその流れに合わせる。 */
const SKY_EXIT_X = AREA_WIDTH / 2
const CAVE_EXIT_X = AREA_WIDTH / 2
const RIVER_EXIT_X = AREA_WIDTH - 160
const RIVER_EXIT_Y = AREA_HEIGHT - 200
const PORTAL_SIZE = { width: EXIT_WIDTH, height: EXIT_SENSOR_HEIGHT }
const FOREST_PORTAL_SIZE = { width: FOREST_EXIT_WIDTH, height: EXIT_SENSOR_HEIGHT }

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
      // 坂を長く保ち、坂の端から逃げた球は左右の雲風ピンへ落ちて次の坂へ戻る。
      { kind: 'wall', id: 'sky-slide-top-left', x: SKY_SLOPE_LEFT_X, y: SKY_SLOPE_TOP_Y, width: SKY_SLOPE_TOP_WIDTH, height: SKY_SLOPE_HEIGHT, angle: SKY_SLOPE_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'sky-slide-top-right', x: SKY_SLOPE_RIGHT_X, y: SKY_SLOPE_TOP_Y, width: SKY_SLOPE_TOP_WIDTH, height: SKY_SLOPE_HEIGHT, angle: -SKY_SLOPE_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'sky-slide-middle-left', x: SKY_SLOPE_MIDDLE_LEFT_X, y: SKY_SLOPE_MIDDLE_Y, width: SKY_SLOPE_MIDDLE_WIDTH, height: SKY_SLOPE_HEIGHT, angle: SKY_SLOPE_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'sky-slide-middle-right', x: SKY_SLOPE_MIDDLE_RIGHT_X, y: SKY_SLOPE_MIDDLE_Y, width: SKY_SLOPE_MIDDLE_WIDTH, height: SKY_SLOPE_HEIGHT, angle: -SKY_SLOPE_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'sky-slide-lower-left', x: SKY_SLOPE_BOTTOM_LEFT_X, y: SKY_SLOPE_BOTTOM_Y, width: SKY_SLOPE_BOTTOM_WIDTH, height: SKY_SLOPE_HEIGHT, angle: SKY_SLOPE_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'sky-slide-lower-right', x: SKY_SLOPE_BOTTOM_RIGHT_X, y: SKY_SLOPE_BOTTOM_Y, width: SKY_SLOPE_BOTTOM_WIDTH, height: SKY_SLOPE_HEIGHT, angle: -SKY_SLOPE_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'pin', id: 'sky-cloud-left', x: SKY_CLOUD_PIN_LEFT_X, y: SKY_CLOUD_PIN_LEFT_Y, radius: SKY_CLOUD_PIN_RADIUS, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'sky-cloud-right', x: SKY_CLOUD_PIN_RIGHT_X, y: SKY_CLOUD_PIN_RIGHT_Y, radius: SKY_CLOUD_PIN_RADIUS, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'sky-cloud-bumper', x: SKY_CLOUD_BUMPER_X, y: SKY_CLOUD_BUMPER_Y, radius: SKY_CLOUD_BUMPER_RADIUS, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'sky-cloud-side-left', x: SKY_CLOUD_SIDE_LEFT_X, y: SKY_CLOUD_SIDE_Y, radius: SKY_CLOUD_SIDE_RADIUS, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'sky-cloud-side-right', x: SKY_CLOUD_SIDE_RIGHT_X, y: SKY_CLOUD_SIDE_Y, radius: SKY_CLOUD_SIDE_RADIUS, restitution: PIN_RESTITUTION },
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
      // 入口直後は左右対称の短い受け板で初速の揺らぎを残し、中央の分岐へ渡す。
      { kind: 'wall', id: 'forest-approach-log-left', x: FOREST_APPROACH_LOG_LEFT_X, y: FOREST_APPROACH_LOG_Y, width: FOREST_APPROACH_LOG_WIDTH, height: FOREST_APPROACH_LOG_HEIGHT, angle: FOREST_APPROACH_LOG_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'forest-approach-log-right', x: FOREST_APPROACH_LOG_RIGHT_X, y: FOREST_APPROACH_LOG_Y, width: FOREST_APPROACH_LOG_WIDTH, height: FOREST_APPROACH_LOG_HEIGHT, angle: -FOREST_APPROACH_LOG_ANGLE, restitution: WALL_RESTITUTION },
      // 木の実・キノコ風の丸い障害物を、左右へ一段ずつずらして3段にする。
      { kind: 'pin', id: 'forest-branch-pin-top', x: FOREST_BRANCH_PIN_TOP_X, y: FOREST_BRANCH_PIN_TOP_Y, radius: FOREST_BRANCH_PIN_RADIUS, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'forest-branch-pin-side-left', x: FOREST_BRANCH_PIN_SIDE_LEFT_X, y: FOREST_BRANCH_PIN_TOP_Y, radius: FOREST_BRANCH_PIN_SIDE_RADIUS, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'forest-branch-pin-side-right', x: FOREST_BRANCH_PIN_SIDE_RIGHT_X, y: FOREST_BRANCH_PIN_TOP_Y, radius: FOREST_BRANCH_PIN_SIDE_RADIUS, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'forest-pin-middle-left', x: FOREST_PIN_MIDDLE_LEFT_X, y: FOREST_PIN_ROW_MIDDLE_Y, radius: FOREST_PIN_RADIUS, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'forest-pin-middle-right', x: FOREST_PIN_MIDDLE_RIGHT_X, y: FOREST_PIN_ROW_MIDDLE_Y, radius: FOREST_PIN_RADIUS, restitution: PIN_RESTITUTION },
      // 短い屋根と中央尾根で、ピン群の反射結果を左右の出口へ運ぶ。
      { kind: 'wall', id: 'forest-branch-roof-left', x: FOREST_BRANCH_ROOF_LEFT_X, y: FOREST_BRANCH_ROOF_Y, width: FOREST_BRANCH_ROOF_WIDTH, height: FOREST_BRANCH_ROOF_HEIGHT, angle: -FOREST_BRANCH_ROOF_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'forest-branch-roof-right', x: FOREST_BRANCH_ROOF_RIGHT_X, y: FOREST_BRANCH_ROOF_Y, width: FOREST_BRANCH_ROOF_WIDTH, height: FOREST_BRANCH_ROOF_HEIGHT, angle: FOREST_BRANCH_ROOF_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'forest-exit-ramp-left', x: FOREST_EXIT_RAMP_LEFT_X, y: FOREST_EXIT_RAMP_Y, width: FOREST_EXIT_RAMP_WIDTH, height: FOREST_EXIT_RAMP_HEIGHT, angle: FOREST_EXIT_RAMP_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'forest-exit-ramp-right', x: FOREST_EXIT_RAMP_RIGHT_X, y: FOREST_EXIT_RAMP_Y, width: FOREST_EXIT_RAMP_WIDTH, height: FOREST_EXIT_RAMP_HEIGHT, angle: -FOREST_EXIT_RAMP_ANGLE, restitution: WALL_RESTITUTION },
    ],
    exits: [
      {
        id: 'forest-to-cave',
        kind: 'tunnel',
        x: FOREST_LEFT_EXIT_X,
        y: EXIT_Y,
        ...FOREST_PORTAL_SIZE,
        to: 'cave',
        toEntry: 'cave-entry',
      },
      {
        id: 'forest-to-river',
        kind: 'hole',
        x: FOREST_RIGHT_EXIT_X,
        y: EXIT_Y,
        ...FOREST_PORTAL_SIZE,
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
      // 短い板を左右交互に置き、岩群へ当たりながら進む狭いジグザグを作る。
      { kind: 'wall', id: 'cave-zigzag-left-top', x: CAVE_ZIGZAG_LEFT_X, y: CAVE_ZIGZAG_TOP_Y, width: CAVE_ZIGZAG_WALL_WIDTH, height: CAVE_ZIGZAG_WALL_HEIGHT, angle: CAVE_ZIGZAG_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'cave-zigzag-right-top', x: CAVE_ZIGZAG_RIGHT_X, y: CAVE_ZIGZAG_TOP_Y, width: CAVE_ZIGZAG_WALL_WIDTH, height: CAVE_ZIGZAG_WALL_HEIGHT, angle: -CAVE_ZIGZAG_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'cave-zigzag-left-second', x: CAVE_ZIGZAG_SECOND_LEFT_X, y: CAVE_ZIGZAG_SECOND_Y, width: CAVE_ZIGZAG_WALL_WIDTH, height: CAVE_ZIGZAG_WALL_HEIGHT, angle: -CAVE_ZIGZAG_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'cave-zigzag-right-second', x: CAVE_ZIGZAG_SECOND_RIGHT_X, y: CAVE_ZIGZAG_SECOND_Y, width: CAVE_ZIGZAG_WALL_WIDTH, height: CAVE_ZIGZAG_WALL_HEIGHT, angle: CAVE_ZIGZAG_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'cave-zigzag-left-bottom', x: CAVE_ZIGZAG_BOTTOM_LEFT_X, y: CAVE_ZIGZAG_BOTTOM_Y, width: CAVE_ZIGZAG_BOTTOM_WIDTH, height: CAVE_ZIGZAG_WALL_HEIGHT, angle: CAVE_ZIGZAG_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'cave-zigzag-right-bottom', x: CAVE_ZIGZAG_BOTTOM_RIGHT_X, y: CAVE_ZIGZAG_BOTTOM_Y, width: CAVE_ZIGZAG_BOTTOM_WIDTH, height: CAVE_ZIGZAG_WALL_HEIGHT, angle: -CAVE_ZIGZAG_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'cave-channel-left', x: CAVE_CHANNEL_LEFT_X, y: CAVE_CHANNEL_Y, width: CAVE_CHANNEL_WIDTH, height: CAVE_CHANNEL_HEIGHT, angle: CAVE_CHANNEL_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'cave-channel-right', x: CAVE_CHANNEL_RIGHT_X, y: CAVE_CHANNEL_Y, width: CAVE_CHANNEL_WIDTH, height: CAVE_CHANNEL_HEIGHT, angle: -CAVE_CHANNEL_ANGLE, restitution: WALL_RESTITUTION },
      // 岩を2段の千鳥にし、中央をまっすぐ抜けず左右へジグザグに落とす。
      { kind: 'pin', id: 'cave-rock-top-center', x: CAVE_ROCK_TOP_CENTER_X, y: CAVE_ROCK_TOP_Y, radius: CAVE_TOP_ROCK_RADIUS, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'cave-cannon-landing-pin', x: CAVE_CANNON_LANDING_X, y: CAVE_CANNON_LANDING_Y, radius: CAVE_CANNON_LANDING_RADIUS, restitution: CAVE_CANNON_LANDING_RESTITUTION },
      { kind: 'pin', id: 'cave-rock-middle-left', x: CAVE_ROCK_MIDDLE_LEFT_X, y: CAVE_ROCK_MIDDLE_LEFT_Y, radius: CAVE_ROCK_MIDDLE_LEFT_RADIUS, restitution: CAVE_ROCK_MIDDLE_LEFT_RESTITUTION },
      { kind: 'pin', id: 'cave-rock-middle-center', x: CAVE_ROCK_BOTTOM_RIGHT_X, y: CAVE_ROCK_BOTTOM_Y, radius: CAVE_BOTTOM_ROCK_RADIUS, restitution: CAVE_BOTTOM_ROCK_RESTITUTION },
    ],
    zones: [
      {
        kind: 'cannon',
        id: 'cave-cannon-left-low',
        x: 120,
        y: 540,
        radius: CANNON_SENSOR_RADIUS,
        angle: -0.8,
        power: CAVE_CANNON_POWER,
        holdMs: CANNON_HOLD_MS,
      },
      {
        kind: 'cannon',
        id: 'cave-cannon-center-approach',
        x: CAVE_CANNON_APPROACH_X,
        y: CAVE_CANNON_APPROACH_Y,
        radius: CAVE_CANNON_APPROACH_RADIUS,
        angle: -2.34,
        power: CAVE_CANNON_POWER,
        holdMs: CANNON_HOLD_MS,
      },
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
      // 反対側まで届く長い板をゆるく反転させ、板の端のピンで向きを変える。
      { kind: 'wall', id: 'river-sweep-top', x: AREA_WIDTH / 2, y: RIVER_SWEEP_TOP_Y, width: RIVER_SWEEP_WIDTH, height: RIVER_SWEEP_HEIGHT, angle: RIVER_SWEEP_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'wall', id: 'river-sweep-second', x: RIVER_SWEEP_SECOND_X, y: RIVER_SWEEP_SECOND_Y, width: RIVER_SWEEP_SECOND_WIDTH, height: RIVER_SWEEP_HEIGHT, angle: -RIVER_SWEEP_ANGLE, restitution: WALL_RESTITUTION },
      { kind: 'jump', id: 'river-jump-end', x: 440, y: RIVER_SWEEP_BOTTOM_Y, width: 60, height: 6, angle: 0, launchAngle: -2.2, power: RIVER_JUMP_POWER },
      { kind: 'pin', id: 'river-pin-left-turn', x: 100, y: 280, radius: 10, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'river-pin-landing', x: 220, y: 470, radius: 10, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'river-pin-top-right', x: RIVER_PIN_TOP_RIGHT_X, y: RIVER_PIN_TOP_Y, radius: RIVER_PIN_RADIUS, restitution: PIN_RESTITUTION },
    ],
    zones: [
      {
        kind: 'boost',
        id: 'river-sweep-boost',
        x: 340,
        y: 400,
        width: 240,
        height: 80,
        angle: -RIVER_SWEEP_ANGLE,
        force: 0.1,
        maxSpeed: BOOST_MAX_SPEED,
      },
    ],
    exits: [
      {
        id: 'river-to-cloud',
        kind: 'hole',
        x: RIVER_EXIT_X,
        y: RIVER_EXIT_Y,
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
      // 左右の入口から下りる2枚の板をV字にし、大きな雲バンパーを順にくぐって中央へ集める。
      { kind: 'pin', id: 'cloud-bumper-left', x: CLOUD_BUMPER_LEFT_X, y: CLOUD_BUMPER_LEFT_Y, radius: CLOUD_BUMPER_SIDE_RADIUS, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'cloud-bumper-right', x: CLOUD_BUMPER_RIGHT_X, y: CLOUD_BUMPER_RIGHT_Y, radius: CLOUD_BUMPER_SIDE_RADIUS, restitution: PIN_RESTITUTION },
      { kind: 'pin', id: 'cloud-bumper-center', x: CLOUD_BUMPER_CENTER_X, y: CLOUD_BUMPER_CENTER_Y, radius: CLOUD_BUMPER_CENTER_RADIUS, restitution: PIN_RESTITUTION },
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
