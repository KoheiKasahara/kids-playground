import { BOARD_PUSH_SPEED, createFloaterState, stepFloater, type FloaterState } from './floatModel'
import {
  rectContainsPoint,
  type BoardFlowDirection,
  type Rect,
  type StageDefinition,
  type WaterBodyId,
} from './types'
import {
  createWaterField,
  findWaterBody,
  findWaterBodyAt,
  requestWaterChange,
  stepWaterField,
  transferWaterThroughGate,
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
  /** 流れ板(#519)が現在押し流している向き。タップのたびに反転する。 */
  readonly boardFlowDirection: BoardFlowDirection
  /** 実際の開門移送から導いた流れ。演出と浮遊物の力で同じ値を使う。 */
  readonly gateFlow: GateFlowState
}

export type GateFlowState = {
  readonly direction: -1 | 0 | 1
  readonly strength: number
  readonly transferredVolume: number
  readonly fromBodyId?: WaterBodyId
  readonly toBodyId?: WaterBodyId
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
/** 最大水位差での放水目標速度。既存の速度追従・上限を通すため直接加速はしない。 */
export const GATE_FLOW_SPEED = 108

/** Phase 1で操作する水域。将来は操作対象の水域をUIから選べるようにする余地を残す。 */
export function primaryWaterBodyId(stage: StageDefinition): WaterBodyId {
  return stage.waterBodies[0].id
}

/** じゃぐちが注ぐ先の水域。将来ここが増えても、注ぎ先を変えるだけで済むようにしてある。 */
export function faucetTargetBodyId(stage: StageDefinition): WaterBodyId {
  return stage.faucet?.targetBodyId ?? primaryWaterBodyId(stage)
}

/** せん/排水が水を抜く元の水域。じゃぐちと対称に、ここだけを見ればよい構造にしてある。 */
export function drainSourceBodyId(stage: StageDefinition): WaterBodyId {
  return stage.drain?.sourceBodyId ?? primaryWaterBodyId(stage)
}

/**
 * 水に触れている浮遊物が流される向き。ゴールが右にあるステージなら右へ流れる。
 * ステージ定義に向きを持たせなくても、ゴールと開始位置から自然に決まる。
 * 対象が複数(#518)でも、代表して先頭のIDの開始位置だけを見れば向きは同じになる
 * （どの対象も同じ側から同じゴールへ向かうレイアウトを前提にしている）。
 */
export function stageDriftDirection(stage: StageDefinition): number {
  const goalCenterX = stage.goal.area.x + stage.goal.area.width / 2
  const target = stage.floaters.find((floater) => floater.id === stage.goal.floaterIds[0])
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
    boardFlowDirection: stage.board?.initialFlowDirection ?? 'goal',
    gateFlow: { direction: 0, strength: 0, transferredVolume: 0 },
  }
}

/**
 * 物理判定に使う固定物の一覧。操作ゲートと水車連動水門は、閉じている間だけ
 * 他の固定物と同じ扱いで含め、開くと当たり判定ごと取り除く。
 */
export function activeSolids(
  stage: StageDefinition,
  gateOpen: boolean,
  drainOpen = false,
): readonly Rect[] {
  const solids: Rect[] = [...stage.solids]
  if (stage.gate && !gateOpen) solids.push(stage.gate)
  if (stage.waterWheel?.linkedGateBlocksPassage && !drainOpen) {
    solids.push(stage.waterWheel.linkedGate)
  }
  return solids
}

export function getFloater(state: PukupukaGameState, floaterId: string): FloaterState | undefined {
  return state.floaters.find((floater) => floater.id === floaterId)
}

/**
 * ゴール判定の共通処理(#518)。対象がアヒル1体でもボート・浮き輪など複数でも、
 * ここを1本通すだけで済むようにしてあり、浮遊物の種類ごとに判定をコピーしない。
 * すべての対象がゴール領域に入っていたら true。
 */
export function allFloatersAtGoal(
  stage: StageDefinition,
  floaters: readonly FloaterState[],
): boolean {
  return stage.goal.floaterIds.every((floaterId) => {
    const floater = floaters.find((candidate) => candidate.id === floaterId)
    return floater !== undefined && rectContainsPoint(stage.goal.area, floater.x, floater.y)
  })
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
  // クリア後は浮遊物を止めているため(#518)、クリアした瞬間の速度が残っていても
  // 動き続けているとは扱わない。
  if (state.phase === 'cleared') return true
  if (state.gateOpen && state.gateFlow.strength > 0) return false
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

/**
 * 流れ板の向きを反転させる（#519）。せん・ゲートと同じくタップのたびに反転する単純な操作。
 * クリア後は受け付けない。
 */
export function toggleBoard(state: PukupukaGameState): PukupukaGameState {
  if (state.phase !== 'playing') return state
  return { ...state, boardFlowDirection: state.boardFlowDirection === 'goal' ? 'back' : 'goal' }
}

/**
 * 水車が回っているか（#520）。専用の状態は持たせず、せん/排水(#516)が開いている
 * あいだ＝水が流れ出ているあいだだけ回る完全自動の導出値にすることで、
 * 「せんを あける→水が流れる→水車がまわる」という既存の因果へそのまま乗せる。
 * トグル操作を持たないため、水車専用のリセット処理も不要になる（drainOpenのリセットに
 * そのまま追従する）。
 */
export function waterWheelSpinning(state: PukupukaGameState): boolean {
  return state.drainOpen
}

/**
 * 流れ板が浮遊物へ加える、向きも込みの押し流す速さ。ゴールの向き(driftDirection)を基準に、
 * boardFlowDirectionが'goal'ならそのまま後押しし、'back'なら逆向きに押し流す。
 * ステージのゴールがどちら向きでも同じ設定（'goal'/'back'）で意味が通じるようにするため、
 * 符号付きの絶対向き(driftDirection)と組み合わせてここで具体的な速度に変換する。
 */
export function boardFlowSpeed(state: PukupukaGameState, driftDirection: number): number {
  const sign = state.boardFlowDirection === 'goal' ? 1 : -1
  return BOARD_PUSH_SPEED * driftDirection * sign
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
    if (state.drainOpen && stage.drain) {
      water = requestWaterChange(
        stage.waterBodies,
        water,
        stage.drain.sourceBodyId,
        -DRAIN_RATE_LEVEL_PER_SEC * deltaSeconds,
      )
    }
  }
  water = stepWaterField(stage.waterBodies, water, deltaSeconds)
  let gateFlow: GateFlowState = { direction: 0, strength: 0, transferredVolume: 0 }
  if (state.phase === 'playing' && state.gateOpen && stage.gate) {
    const transfer = transferWaterThroughGate(
      stage.waterBodies,
      water,
      stage.gate.leftBodyId,
      stage.gate.rightBodyId,
      deltaSeconds,
    )
    water = transfer.field
    const carriedStrength =
      state.gateFlow.direction === transfer.direction
        ? Math.max(0, state.gateFlow.strength - deltaSeconds * 0.42)
        : 0
    gateFlow = {
      direction: transfer.direction,
      strength: Math.max(transfer.strength, carriedStrength),
      transferredVolume: transfer.transferredVolume,
      fromBodyId: transfer.fromBodyId,
      toBodyId: transfer.toBodyId,
    }
    // 水位差がそろった瞬間に流れが消えると因果が見えにくいため、短い残流だけ滑らかに減衰させる。
    // 閉門時はこの分岐へ入らず即リセットされるので、開閉の繰り返しにも状態を持ち越さない。
    if (transfer.direction === 0 && state.gateFlow.direction !== 0) {
      const strength = Math.max(0, state.gateFlow.strength - deltaSeconds * 0.42)
      if (strength > 0) gateFlow = { ...state.gateFlow, strength, transferredVolume: 0 }
    }
  }

  // クリア後は浮遊物を止めた絵のままにする(#518)。複数の浮遊物が同じゴールへ集まる
  // 構成では、止めずに動かし続けると、みな同じ水の流れに乗って結局ほぼ同じ場所へ
  // 寄っていってしまい、せっかく描き分けたシルエットが重なって見分けにくくなる。
  // クリアした瞬間の(まだ少しばらけている)並びのまま止めることで、常にきれいに
  // 見分けられる状態を保つ。アヒル1体だけの時と同じく、クリア後に水の操作を
  // 受け付けなくなるのと合わせて「ここでおしまい」を見た目でも表す。
  const solids = activeSolids(stage, state.gateOpen, state.drainOpen)
  // Legacy互換面（同じ水域ID同士のゲート）だけ、従来の接触板として扱う。
  const board = stage.board && stage.gate?.leftBodyId === stage.gate?.rightBodyId
    ? { rect: stage.board, pushSpeed: boardFlowSpeed(state, driftDirection) }
    : undefined
  const floaters =
    state.phase === 'playing'
      ? state.floaters.map((floater) => {
          const definition = stage.floaters.find((candidate) => candidate.id === floater.id)
          if (!definition) return floater
          const body = findWaterBodyAt(stage.waterBodies, floater.x, floater.y)
          let flowDirection = gateFlow.direction
          const bodyId = body?.id
          if (bodyId === gateFlow.toBodyId && bodyId === stage.board?.targetBodyId) {
            flowDirection = Math.sign(boardFlowSpeed(state, driftDirection)) as -1 | 1
          }
          const affectedByGate = body?.id === gateFlow.fromBodyId || body?.id === gateFlow.toBodyId
          const directedReleaseBoard =
            stage.gate?.leftBodyId !== stage.gate?.rightBodyId && bodyId === stage.board?.targetBodyId
          const ambientScale = directedReleaseBoard ? 0 : (stage.ambientDriftScale ?? 1)
          return stepFloater(
            definition,
            floater,
            {
              surfaceY: surfaceYAt(stage.waterBodies, water, floater.x, floater.y),
              solids,
              bounds: { width: stage.width, height: stage.height },
              driftDirection: driftDirection * ambientScale,
              gateFlowSpeed: affectedByGate ? GATE_FLOW_SPEED * gateFlow.strength * flowDirection : 0,
              board,
            },
            deltaSeconds,
          )
        })
      : state.floaters

  let phase = state.phase
  let goalReached = false
  if (phase === 'playing' && allFloatersAtGoal(stage, floaters)) {
    phase = 'cleared'
    goalReached = true
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
      boardFlowDirection: state.boardFlowDirection,
      gateFlow,
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
