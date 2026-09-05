import { createFloaterState, stepFloater, type FloaterState } from './floatModel'
import { rectContainsPoint, type StageDefinition, type WaterBodyId } from './types'
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

/**
 * 水位操作の入力。'fill' はじゃぐち(#515)、'drain' はPhase 1由来の仮の「みずをへらす」操作で、
 * 正式な せん/排水(#516) に置き換わるまでの暫定入力として残している。
 */
export type WaterControl = 'fill' | 'drain' | null

export type PukupukaGameState = {
  readonly water: WaterField
  readonly floaters: readonly FloaterState[]
  readonly phase: PukupukaPhase
  readonly elapsedMs: number
  /** 固定ステップに割り切れなかった余り時間。次フレームへ持ち越す。 */
  readonly leftoverMs: number
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

/** ボタンを押しっぱなしにしているあいだの増減速度（水位換算 / 秒）。 */
export const WATER_HOLD_RATE_LEVEL_PER_SEC = 24
/** タップ1回ぶんの増減量（水位換算）。押しっぱなしにしなくても変化が分かるようにする。 */
export const WATER_TAP_LEVEL = 10

/** Phase 1で操作する水域。将来は操作対象の水域をUIから選べるようにする余地を残す。 */
export function primaryWaterBodyId(stage: StageDefinition): WaterBodyId {
  return stage.waterBodies[0].id
}

/** じゃぐちが注ぐ先の水域。#517でゲート越しに別水域へ注ぐ構成になっても、ここだけを見ればよい。 */
export function faucetTargetBodyId(stage: StageDefinition): WaterBodyId {
  return stage.faucet.targetBodyId
}

/**
 * 水位操作(WaterControl)が作用する水域。'fill' はじゃぐちの注ぎ先、'drain' は暫定の
 * primaryWaterBodyId を使う（#516で正式な排水先に置き換える想定）。
 */
function controlTargetBodyId(stage: StageDefinition, direction: 'fill' | 'drain'): WaterBodyId {
  return direction === 'fill' ? faucetTargetBodyId(stage) : primaryWaterBodyId(stage)
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
  }
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

/** タップ1回ぶんの水を足す/減らす。クリア後は受け付けない。 */
export function applyWaterTap(
  stage: StageDefinition,
  state: PukupukaGameState,
  direction: 'fill' | 'drain',
): PukupukaGameState {
  if (state.phase !== 'playing') return state
  const deltaLevel = direction === 'fill' ? WATER_TAP_LEVEL : -WATER_TAP_LEVEL
  const water = requestWaterChange(
    stage.waterBodies,
    state.water,
    controlTargetBodyId(stage, direction),
    deltaLevel,
  )
  if (water === state.water) return state
  return { ...state, water }
}

function advanceOneStep(
  stage: StageDefinition,
  state: PukupukaGameState,
  control: WaterControl,
  driftDirection: number,
): StepResult {
  const deltaSeconds = FIXED_STEP_MS / 1000

  let water = state.water
  if (control !== null && state.phase === 'playing') {
    const deltaLevel =
      (control === 'fill' ? WATER_HOLD_RATE_LEVEL_PER_SEC : -WATER_HOLD_RATE_LEVEL_PER_SEC) * deltaSeconds
    water = requestWaterChange(stage.waterBodies, water, controlTargetBodyId(stage, control), deltaLevel)
  }
  water = stepWaterField(stage.waterBodies, water, deltaSeconds)

  const floaters = state.floaters.map((floater) => {
    const definition = stage.floaters.find((candidate) => candidate.id === floater.id)
    if (!definition) return floater
    return stepFloater(
      definition,
      floater,
      {
        surfaceY: surfaceYAt(stage.waterBodies, water, floater.x, floater.y),
        solids: stage.solids,
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
