import { createFloaterState, stepFloater, type FloaterState } from './floatModel'
import { rectContainsPoint, type Rect, type StageDefinition, type WaterBodyId } from './types'
import {
  createWaterField,
  findWaterBody,
  requestWaterChange,
  stepWaterField,
  waterFillRatio,
  waterSurfaceY,
  surfaceYAt,
  type WaterBodyState,
  type WaterField,
} from './waterModel'

// ゲーム状態と1フレームの進行をまとめるモジュール。画面（React）はこの関数だけを呼ぶ。

export type PukupukaPhase = 'playing' | 'cleared'

/** 水位操作の入力。じゃぐち(#515)を押している間だけ 'fill'、離すと null。 */
export type WaterControl = 'fill' | null

export type PukupukaGameState = {
  readonly water: WaterField
  readonly floaters: readonly FloaterState[]
  readonly phase: PukupukaPhase
  readonly elapsedMs: number
  /** 固定ステップに割り切れなかった余り時間。次フレームへ持ち越す。 */
  readonly leftoverMs: number
  /** せん/排水(#516)が開いているか。開いている間、毎フレーム drainSourceBodyId から水を抜く。 */
  readonly drainOpen: boolean
  /** ゲート(#517)が開いているか。閉じている間、stage.gateも固定物として当たり判定に含める。 */
  readonly gateOpen: boolean
}

export type StepResult = {
  readonly state: PukupukaGameState
  /** クリアした瞬間のフレームだけ true。演出・効果音はこれを見て1回だけ動かす。 */
  readonly goalReached: boolean
}

/** 物理は常にこの固定ステップで進める（端末のfps差で挙動が変わらないようにする）。 */
export const FIXED_STEP_MS = 1000 / 60
/** 1フレームで進める最大ステップ数。タブ復帰などで巨大なdtが来ても暴走させない。 */
export const MAX_STEPS_PER_FRAME = 5

/** じゃぐちを押しっぱなしにしているあいだの注水速度（水位換算 / 秒）。 */
export const WATER_HOLD_RATE_LEVEL_PER_SEC = 24
/** タップ1回ぶんの増加量（水位換算）。押しっぱなしにしなくても変化が分かるようにする。 */
export const WATER_TAP_LEVEL = 10
/**
 * せん/排水が開いているあいだの排水速度（水位換算 / 秒）。
 * じゃぐちの注水速度と同じ値にすることで、両方同時にONでも
 * 「注水量 - 排水量 = 水位変化」がちょうど打ち消し合う予測しやすい挙動になる。
 */
export const DRAIN_RATE_LEVEL_PER_SEC = WATER_HOLD_RATE_LEVEL_PER_SEC

/** Phase 1で操作する水域。将来は操作対象の水域をUIから選べるようにする余地を残す。 */
export function primaryWaterBodyId(stage: StageDefinition): WaterBodyId {
  return stage.waterBodies[0].id
}

/** じゃぐちが注ぐ先の水域。将来ここが増えても、注ぎ先を変えるだけで済むようにしてある。 */
export function faucetTargetBodyId(stage: StageDefinition): WaterBodyId {
  return stage.faucet.targetBodyId
}

/** せん/排水が水を抜く元の水域。じゃぐちと対称に、ここだけを見ればよい構造にしてある。 */
export function drainSourceBodyId(stage: StageDefinition): WaterBodyId {
  return stage.drain.sourceBodyId
}

/**
 * 水に触れている浮遊物が流される向き。ゴールが右にあるステージなら右へ流れる。
 * ステージ定義に向きを持たせなくても、ゴールと開始位置から自然に決まる。
 */
export function stageDriftDirection(stage: StageDefinition): number {
  const goalCenterX = stage.goal.area.x + stage.goal.area.width / 2
  const target = stage.floaters.find((floater) => floater.id === stage.goal.floaterId)
  const startX = target ? target.startX : goalCenterX
  return Math.sign(goalCenterX - startX) || 1
}

export function createInitialState(stage: StageDefinition): PukupukaGameState {
  return {
    water: createWaterField(stage.waterBodies),
    floaters: stage.floaters.map(createFloaterState),
    phase: 'playing',
    elapsedMs: 0,
    leftoverMs: 0,
    drainOpen: false,
    gateOpen: false,
  }
}

/**
 * 物理判定に使う固定物の一覧（#517）。ゲートが閉じている間だけ、
 * stage.gateも他の固定物と同じ扱いで含める。開いている間は当たり判定ごと取り除く。
 */
export function activeSolids(stage: StageDefinition, gateOpen: boolean): readonly Rect[] {
  return gateOpen ? stage.solids : [...stage.solids, stage.gate]
}

export function getFloater(state: PukupukaGameState, floaterId: string): FloaterState | undefined {
  return state.floaters.find((floater) => floater.id === floaterId)
}

export function getWaterBodyState(
  state: PukupukaGameState,
  bodyId: WaterBodyId,
): WaterBodyState | undefined {
  return state.water[bodyId]
}

/** ゲージ表示用。指定水域の 0〜1。 */
export function waterRatioOf(stage: StageDefinition, state: PukupukaGameState, bodyId: WaterBodyId): number {
  const definition = findWaterBody(stage.waterBodies, bodyId)
  const bodyState = state.water[bodyId]
  if (!definition || !bodyState) return 0
  return waterFillRatio(definition, bodyState)
}

export function waterSurfaceYOf(
  stage: StageDefinition,
  state: PukupukaGameState,
  bodyId: WaterBodyId,
): number {
  const definition = findWaterBody(stage.waterBodies, bodyId)
  const bodyState = state.water[bodyId]
  if (!definition || !bodyState) return 0
  return waterSurfaceY(definition, bodyState)
}

/** 位置・速度が「止まっている」とみなす速さ（ステージ座標 / 秒）。 */
const SETTLED_SPEED = 0.05

/**
 * 水も浮遊物も動いていない状態かどうか。
 * 画面側はこれが true のあいだ再描画を省き、置きっぱなしのときの負荷を下げる
 * （水位が目標に届いていない・浮遊物が揺れているあいだは false なので、演出は途切れない）。
 */
export function isSettled(stage: StageDefinition, state: PukupukaGameState): boolean {
  for (const definition of stage.waterBodies) {
    const bodyState = state.water[definition.id]
    if (bodyState && bodyState.volume !== bodyState.targetVolume) return false
  }
  for (const floater of state.floaters) {
    if (Math.abs(floater.vx) > SETTLED_SPEED || Math.abs(floater.vy) > SETTLED_SPEED) return false
  }
  return true
}

/** じゃぐちタップ1回ぶんの水を足す。クリア後は受け付けない。 */
export function applyWaterTap(stage: StageDefinition, state: PukupukaGameState): PukupukaGameState {
  if (state.phase !== 'playing') return state
  const water = requestWaterChange(stage.waterBodies, state.water, faucetTargetBodyId(stage), WATER_TAP_LEVEL)
  if (water === state.water) return state
  return { ...state, water }
}

/**
 * せん/排水のON/OFFを切り替える（#516）。タップのたびに開⇔閉が反転する単純な操作にすることで、
 * 「ここを開けると水が抜ける」という因果を幼児にも分かりやすくする。クリア後は受け付けない。
 */
export function toggleDrain(state: PukupukaGameState): PukupukaGameState {
  if (state.phase !== 'playing') return state
  return { ...state, drainOpen: !state.drainOpen }
}

/**
 * ゲートのON/OFFを切り替える（#517）。せんと同じくタップのたびに開⇔閉が反転する単純な操作。
 * クリア後は受け付けない。
 */
export function toggleGate(state: PukupukaGameState): PukupukaGameState {
  if (state.phase !== 'playing') return state
  return { ...state, gateOpen: !state.gateOpen }
}

function advanceOneStep(
  stage: StageDefinition,
  state: PukupukaGameState,
  control: WaterControl,
  driftDirection: number,
): StepResult {
  const deltaSeconds = FIXED_STEP_MS / 1000

  let water = state.water
  if (state.phase === 'playing') {
    if (control === 'fill') {
      water = requestWaterChange(
        stage.waterBodies,
        water,
        faucetTargetBodyId(stage),
        WATER_HOLD_RATE_LEVEL_PER_SEC * deltaSeconds,
      )
    }
    // じゃぐちと同時に開いていても、それぞれ別々に目標水量を押し合うだけなので
    // 「注水量 - 排水量」に相当する結果へ自然に収束する（特別な合成処理は不要）。
    if (state.drainOpen) {
      water = requestWaterChange(
        stage.waterBodies,
        water,
        drainSourceBodyId(stage),
        -DRAIN_RATE_LEVEL_PER_SEC * deltaSeconds,
      )
    }
  }
  water = stepWaterField(stage.waterBodies, water, deltaSeconds)

  const solids = activeSolids(stage, state.gateOpen)
  const floaters = state.floaters.map((floater) => {
    const definition = stage.floaters.find((candidate) => candidate.id === floater.id)
    if (!definition) return floater
    return stepFloater(
      definition,
      floater,
      {
        surfaceY: surfaceYAt(stage.waterBodies, water, floater.x, floater.y),
        solids,
        bounds: { width: stage.width, height: stage.height },
        driftDirection,
      },
      deltaSeconds,
    )
  })

  let phase = state.phase
  let goalReached = false
  if (phase === 'playing') {
    const target = floaters.find((floater) => floater.id === stage.goal.floaterId)
    if (target && rectContainsPoint(stage.goal.area, target.x, target.y)) {
      phase = 'cleared'
      goalReached = true
    }
  }

  return {
    state: {
      water,
      floaters,
      phase,
      elapsedMs: state.elapsedMs + FIXED_STEP_MS,
      leftoverMs: state.leftoverMs,
      drainOpen: state.drainOpen,
      gateOpen: state.gateOpen,
    },
    goalReached,
  }
}

/**
 * 経過時間ぶんゲームを進める。固定ステップに分割して進めるため、
 * 呼び出し間隔がばらついても同じ結果になる。
 *
 * goalReached はクリアへ移った1ステップだけ true になり、クリア後は
 * 何度呼んでも false のままなので、ゴール演出が連続発火しない。
 */
export function stepGame(
  stage: StageDefinition,
  state: PukupukaGameState,
  deltaMs: number,
  control: WaterControl = null,
): StepResult {
  const safeDelta = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0
  const maxAccumulated = FIXED_STEP_MS * MAX_STEPS_PER_FRAME
  let accumulated = Math.min(state.leftoverMs + safeDelta, maxAccumulated)

  const driftDirection = stageDriftDirection(stage)
  let current = state
  let goalReached = false

  while (accumulated >= FIXED_STEP_MS) {
    const result = advanceOneStep(stage, current, control, driftDirection)
    current = result.state
    goalReached = goalReached || result.goalReached
    accumulated -= FIXED_STEP_MS
  }

  return { state: { ...current, leftoverMs: accumulated }, goalReached }
}
