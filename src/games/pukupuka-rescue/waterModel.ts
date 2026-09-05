import type { WaterBodyDefinition, WaterBodyId } from './types'

// 水域の状態と、その純粋な計算だけを持つモジュール。
//
// 方針（Issue #514「設計上の重要事項」）:
// - 水は粒子として物理演算しない。水域ごとに「水量」をひとつ持つだけにする。
// - ゲーム判定に使うのは水量から求めた水面Yだけで、波・泡・しぶきは表示側の演出に切り離す。
// - 状態の正は水量(volume)。水位(level)は volume / 幅 で導出する。
//   将来ゲート(#517)や排水(#516)で水域間を移動させるとき、幅の違う水槽同士でも
//   「移した量を足し引きするだけ」で水が増減しない計算になるため。

export type WaterBodyState = {
  /** 現在の水量。表示・判定に使う正の値。 */
  readonly volume: number
  /** 目標水量。タップ1回ぶんの水はここへ入り、volumeが時間をかけて追いつく。 */
  readonly targetVolume: number
}

export type WaterField = Readonly<Record<WaterBodyId, WaterBodyState>>

/**
 * 目標水量へ追いつく速さ（水位換算 / 秒）。
 * タップで水位が瞬間的に跳ねると「水が増えた」ことが見えないため、必ず時間をかけて動かす。
 */
export const WATER_FILL_SPEED_LEVEL_PER_SEC = 55

export function waterBodyWidth(definition: WaterBodyDefinition): number {
  return definition.right - definition.left
}

/** 水位の最大値（底から満水面まで）。 */
export function waterBodyMaxLevel(definition: WaterBodyDefinition): number {
  return definition.floorY - definition.ceilingY
}

export function waterBodyCapacity(definition: WaterBodyDefinition): number {
  return waterBodyWidth(definition) * waterBodyMaxLevel(definition)
}

export function levelToVolume(definition: WaterBodyDefinition, level: number): number {
  return level * waterBodyWidth(definition)
}

export function volumeToLevel(definition: WaterBodyDefinition, volume: number): number {
  return volume / waterBodyWidth(definition)
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

export function waterLevelOf(definition: WaterBodyDefinition, state: WaterBodyState): number {
  return clamp(volumeToLevel(definition, state.volume), 0, waterBodyMaxLevel(definition))
}

/** 水面のY座標。水位0なら底、満水なら ceilingY を返す。 */
export function waterSurfaceY(definition: WaterBodyDefinition, state: WaterBodyState): number {
  return definition.floorY - waterLevelOf(definition, state)
}

/** 0（空）〜1（満水）。ゲージ表示に使う。 */
export function waterFillRatio(definition: WaterBodyDefinition, state: WaterBodyState): number {
  const maxLevel = waterBodyMaxLevel(definition)
  if (maxLevel <= 0) return 0
  return clamp(waterLevelOf(definition, state) / maxLevel, 0, 1)
}

export function createWaterField(definitions: readonly WaterBodyDefinition[]): WaterField {
  const field: Record<WaterBodyId, WaterBodyState> = {}
  for (const definition of definitions) {
    const volume = clamp(levelToVolume(definition, definition.initialLevel), 0, waterBodyCapacity(definition))
    field[definition.id] = { volume, targetVolume: volume }
  }
  return field
}

export function findWaterBody(
  definitions: readonly WaterBodyDefinition[],
  id: WaterBodyId,
): WaterBodyDefinition | undefined {
  return definitions.find((definition) => definition.id === id)
}

/**
 * 水域の目標水量を水位換算で増減させる（じゃぐち#515・排水#516の置き換え先）。
 * 容量を超える・0を下回る指示は静かに丸める（連打しても壊れない）。
 */
export function requestWaterChange(
  definitions: readonly WaterBodyDefinition[],
  field: WaterField,
  id: WaterBodyId,
  deltaLevel: number,
): WaterField {
  const definition = findWaterBody(definitions, id)
  const state = field[id]
  if (!definition || !state) return field

  const target = clamp(
    state.targetVolume + levelToVolume(definition, deltaLevel),
    0,
    waterBodyCapacity(definition),
  )
  if (target === state.targetVolume) return field
  return { ...field, [id]: { ...state, targetVolume: target } }
}

/** 目標水量へ一定速度で近づける。到達済みなら同じオブジェクトを返す。 */
export function stepWaterField(
  definitions: readonly WaterBodyDefinition[],
  field: WaterField,
  deltaSeconds: number,
): WaterField {
  let changed = false
  const next: Record<WaterBodyId, WaterBodyState> = { ...field }

  for (const definition of definitions) {
    const state = field[definition.id]
    if (!state) continue
    const diff = state.targetVolume - state.volume
    if (diff === 0) continue

    const maxStep = levelToVolume(definition, WATER_FILL_SPEED_LEVEL_PER_SEC * deltaSeconds)
    const step = clamp(diff, -maxStep, maxStep)
    const volume = clamp(state.volume + step, 0, waterBodyCapacity(definition))
    if (volume === state.volume) continue
    next[definition.id] = { ...state, volume }
    changed = true
  }

  return changed ? next : field
}

/**
 * 点(x, y)がどの水域に属するかを返す。
 * Phase 1は水域が1つだけだが、浮遊物は常に「自分がいる水域」を見て浮くようにしておく。
 *
 * 水面より上にいる浮遊物も同じ水域に属してほしいため、Xが範囲内で底より上にある水域を
 * すべて候補にし、そのうち「いちばん近い底」を持つものを選ぶ。上段水槽・下段水槽のように
 * 縦に重なる水域が増えても、落ちていく先の水域が選ばれる（定義の並び順に依存しない）。
 */
export function findWaterBodyAt(
  definitions: readonly WaterBodyDefinition[],
  x: number,
  y: number,
): WaterBodyDefinition | undefined {
  let found: WaterBodyDefinition | undefined
  for (const definition of definitions) {
    if (x < definition.left || x > definition.right) continue
    if (y > definition.floorY) continue
    if (!found || definition.floorY < found.floorY) found = definition
  }
  return found
}

/** 点(x, y)の位置での水面Y。水域の外なら undefined。 */
export function surfaceYAt(
  definitions: readonly WaterBodyDefinition[],
  field: WaterField,
  x: number,
  y: number,
): number | undefined {
  const definition = findWaterBodyAt(definitions, x, y)
  if (!definition) return undefined
  const state = field[definition.id]
  if (!state) return undefined
  return waterSurfaceY(definition, state)
}
