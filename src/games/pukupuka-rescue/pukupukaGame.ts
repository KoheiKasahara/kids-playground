import { BOARD_PUSH_SPEED, createFloaterState, facingFromVelocity, stepFloater, type FloaterState } from './floatModel'
import {
  createInitialTrail,
  recordTrail,
  slotDistances,
  stepFollowers,
  type TrailPoint,
} from './followModel'
import {
  rectContainsPoint,
  type BoardFlowDirection,
  type FloaterDefinition,
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
  /** 0: 全閉、1: 全開。描画・衝突・通水で共用する。 */
  readonly gateLift: number
  /** 流れ板(#519)が現在押し流している向き。タップのたびに反転する。 */
  readonly boardFlowDirection: BoardFlowDirection
  /**
   * 隊長（アヒル）にふれて仲間になった順のID。仲間は以後この順で隊長のうしろに並び、
   * 救助を取り消さない。隊長自身は含めない。
   */
  readonly rescuedIds: readonly string[]
  readonly collectedStarIds: readonly string[]
  readonly wave: { x: number; y: number; bodyId: string; remainingMs: number } | null
  /** 実際の開門移送から導いた流れ。演出と浮遊物の力で同じ値を使う。 */
  readonly gateFlow: GateFlowState
  /** 隊長が通った道すじ（新しい順）。仲間はこの上を順番についてくる。 */
  readonly trail: readonly TrailPoint[]
  /** 鳴らしたベル。とびらは開いたままにする。 */
  readonly rungBellIds: readonly string[]
  /** とびらごとの開き具合（0: 全閉、1: 全開）。 */
  readonly doorLifts: Readonly<Record<string, number>>
  /** くじらのしおふきの残り時間(ms)。0なら止まっている。 */
  readonly whaleJetMs: number
  /** すべりだいをすべっている間の進み具合。すべっていなければ null。 */
  readonly slide: SlideTravel | null
  /** しぶき・ハート・ベルなど、一度だけ再生する演出。表示側がキーごとにアニメーションする。 */
  readonly effects: readonly GameEffect[]
}

export type SlideTravel = {
  readonly progress: number
  readonly fromX: number
  readonly fromY: number
}

export type GameEffectKind = 'join' | 'splash' | 'bell' | 'star' | 'launch'

export type GameEffect = {
  readonly id: string
  readonly kind: GameEffectKind
  readonly x: number
  readonly y: number
  readonly atMs: number
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
/** 隊長が仲間にふれたとみなす、半径の和に足すゆとり。 */
export const PICKUP_MARGIN = 1.5
/** ベルにふれたとみなす半径。 */
export const BELL_RADIUS = 3.6
/** とびら・ベルの開く速さ（全開までの秒数）。 */
const DOOR_OPEN_SECONDS = 0.8
/** くじらのしおふきが続く時間。 */
export const WHALE_JET_MS = 1300
/** 打ち上げの横移動を保つ最大時間。着水すればすぐ終わる。 */
const LAUNCH_CARRY_MS = 2600
/** すべりだいを進む速さ。 */
export const SLIDE_SPEED = 58
/** 演出を残す時間。 */
const EFFECT_LIFETIME_MS = 900
/** しぶきを出す落下の速さ。 */
const SPLASH_SPEED = 30

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

/** レスキュー隊長（プレイヤーが水で運ぶ主人公）。アヒルがいなければ先頭の浮遊物。 */
export function leaderIdOf(stage: StageDefinition): string {
  return stage.floaters.find((floater) => floater.kind === 'duck')?.id ?? stage.floaters[0].id
}

/** 助けに行く仲間（ゴールへ連れて帰る対象のうち、隊長以外）。 */
export function friendIdsOf(stage: StageDefinition): readonly string[] {
  const leaderId = leaderIdOf(stage)
  return stage.goal.floaterIds.filter((id) => id !== leaderId)
}

function definitionOf(stage: StageDefinition, id: string): FloaterDefinition | undefined {
  return stage.floaters.find((floater) => floater.id === id)
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

function trailKeepLength(stage: StageDefinition): number {
  const leader = definitionOf(stage, leaderIdOf(stage))
  const radii = friendIdsOf(stage).map((id) => definitionOf(stage, id)?.radius ?? 5)
  return (slotDistances(leader?.radius ?? 5, radii).at(-1) ?? 0) + 12
}

export function createInitialState(stage: StageDefinition): PukupukaGameState {
  const leader = definitionOf(stage, leaderIdOf(stage))
  const leaderBody = leader ? findWaterBodyAt(stage.waterBodies, leader.startX, leader.startY) : undefined
  const trail = leader
    ? createInitialTrail(
        { x: leader.startX, y: leader.startY },
        -stageDriftDirection(stage),
        (leaderBody?.left ?? 0) + leader.radius,
        (leaderBody?.right ?? stage.width) - leader.radius,
        trailKeepLength(stage),
      )
    : []
  return {
    water: createWaterField(stage.waterBodies),
    floaters: stage.floaters.map((definition) => {
      const floater = createFloaterState(definition)
      // 待っている仲間は隊長のいる方を向いて「たすけて」と呼ぶ。
      return leader && definition.id !== leader.id
        ? { ...floater, facing: (Math.sign(leader.startX - definition.startX) || 1) as -1 | 1 }
        : { ...floater, facing: (stageDriftDirection(stage) >= 0 ? 1 : -1) as -1 | 1 }
    }),
    phase: 'playing',
    elapsedMs: 0,
    leftoverMs: 0,
    drainOpen: false,
    gateOpen: false,
    gateLift: 0,
    boardFlowDirection: stage.board?.initialFlowDirection ?? 'goal',
    rescuedIds: [],
    collectedStarIds: [],
    wave: null,
    gateFlow: { direction: 0, strength: 0, transferredVolume: 0 },
    trail,
    rungBellIds: [],
    doorLifts: Object.fromEntries((stage.doors ?? []).map((door) => [door.id, 0])),
    whaleJetMs: 0,
    slide: null,
    effects: [],
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
  gateLift = gateOpen ? 1 : 0,
  doorLifts: Readonly<Record<string, number>> = {},
): readonly Rect[] {
  const solids: Rect[] = [...stage.solids]
  if (stage.gate && gateLift < 1) solids.push({ ...stage.gate, height: stage.gate.height * (1 - gateLift) })
  for (const door of stage.doors ?? []) {
    const lift = doorLifts[door.id] ?? 0
    if (lift < 1) solids.push({ ...door, height: door.height * (1 - lift) })
  }
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
  if (state.phase === 'cleared') {
    return state.effects.length === 0 && state.floaters.every((floater) =>
      Math.abs(floater.vx) <= SETTLED_SPEED && Math.abs(floater.vy) <= SETTLED_SPEED)
  }
  if (state.wave || state.gateLift !== (state.gateOpen ? 1 : 0)) return false
  if (state.whaleJetMs > 0 || state.slide || state.effects.length > 0) return false
  for (const door of stage.doors ?? []) {
    const target = isDoorOpen(stage, state, door.id) ? 1 : 0
    if ((state.doorLifts[door.id] ?? 0) !== target) return false
  }
  if (state.gateOpen && state.gateFlow.strength > 0) return false
  for (const definition of stage.waterBodies) {
    const bodyState = state.water[definition.id]
    if (bodyState && bodyState.volume !== bodyState.targetVolume) return false
  }
  for (const floater of state.floaters) {
    if ((floater.launchMs ?? 0) > 0) return false
    if (Math.abs(floater.vx) > SETTLED_SPEED || Math.abs(floater.vy) > SETTLED_SPEED) return false
  }
  return true
}

/** ベルが鳴っていて、そのとびらが開く（開いている）はずか。 */
export function isDoorOpen(stage: StageDefinition, state: PukupukaGameState, doorId: string): boolean {
  return (stage.bells ?? []).some((bell) => bell.doorId === doorId && state.rungBellIds.includes(bell.id))
}

/** 隊長がゴールに着いているか（着地が必要な面は着地まで）。仲間がそろっているかは見ない。 */
export function leaderAtGoal(stage: StageDefinition, state: PukupukaGameState): boolean {
  const leader = getFloater(state, leaderIdOf(stage))
  if (!leader) return false
  const solids = activeSolids(stage, state.gateOpen, state.drainOpen, state.gateLift, state.doorLifts)
  return isAtGoal(stage, solids, leader)
}

function isAtGoal(stage: StageDefinition, solids: readonly Rect[], floater: FloaterState): boolean {
  // ジャンプ中・落下中にゴールの上を通っただけではクリアにしない。
  if ((floater.launchMs ?? 0) > 0 || !rectContainsPoint(stage.goal.area, floater.x, floater.y)) return false
  if (!stage.goal.requiresLanding) return true
  const radius = definitionOf(stage, floater.id)?.radius ?? 0
  return solids.some((solid) =>
    Math.abs(floater.y + radius - solid.y) < 0.6 &&
    floater.x >= solid.x && floater.x <= solid.x + solid.width && Math.abs(floater.vy) < 1)
}

/**
 * くじらのしおふき。止まっているときだけ受け付け、しおふき中の連打では延長しない。
 * 真上の柱で水に浮いている隊長を、次のステップで打ち上げる。
 */
export function triggerWhale(stage: StageDefinition, state: PukupukaGameState): PukupukaGameState {
  if (state.phase !== 'playing' || !stage.whale || state.whaleJetMs > 0) return state
  return { ...state, whaleJetMs: WHALE_JET_MS }
}

/** しおふきの柱の上にいて、打ち上げられる状態か。 */
function inWhaleColumn(stage: StageDefinition, floater: FloaterState): boolean {
  const whale = stage.whale
  return !!whale && Math.abs(floater.x - whale.x) <= whale.halfWidth && floater.y < whale.y &&
    floater.submergedRatio > 0.05 && (floater.launchMs ?? 0) <= 0
}

function pathLength(points: readonly { x: number; y: number }[]): number {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y)
  }
  return total
}

function pointOnPath(points: readonly { x: number; y: number }[], distance: number): { x: number; y: number } {
  let remaining = distance
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]
    const to = points[index]
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    if (length > 0 && remaining <= length) {
      const t = remaining / length
      return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
    }
    remaining -= length
  }
  return points[points.length - 1]
}

/** すべりだいの道すじ（すべり始めた位置から入口の道へつなぐ）。 */
export function slidePath(stage: StageDefinition, travel: SlideTravel): readonly { x: number; y: number }[] {
  return [{ x: travel.fromX, y: travel.fromY }, ...(stage.slide?.path ?? [])]
}

/** じゃぐちタップ1回ぶんの水を足す。クリア後は受け付けない。 */
export function applyWaterTap(stage: StageDefinition, state: PukupukaGameState): PukupukaGameState {
  if (state.phase !== 'playing') return state
  const water = requestWaterChange(stage.waterBodies, state.water, faucetTargetBodyId(stage), WATER_TAP_LEVEL)
  if (water === state.water) return state
  return { ...state, water }
}

/** 水をタップして左右へ広がる波を作る。乾いた場所・壁では作れない。
 * 連打は加算せず置き換えるので速度が際限なく増えない。 */
export function applyWave(stage: StageDefinition, state: PukupukaGameState, x: number, y: number): PukupukaGameState {
  if (state.phase !== 'playing' || !Number.isFinite(x) || !Number.isFinite(y)) return state
  const body = findWaterBodyAt(stage.waterBodies, x, y)
  if (!body || !state.water[body.id]) return state
  const surface = waterSurfaceY(body, state.water[body.id])
  if (surface >= body.floorY - 1 || y < surface - 8 || y > body.floorY) return state
  if (activeSolids(stage, state.gateOpen, state.drainOpen, state.gateLift).some((solid) => rectContainsPoint(solid, x, y))) return state
  return { ...state, wave: { x, y: Math.max(surface, y), bodyId: body.id, remainingMs: 1000 } }
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

type LeaderStep = {
  readonly leader: FloaterState
  readonly slide: SlideTravel | null
  readonly launched: boolean
}

/** 隊長を1ステップ進める。すべりだい中は道すじをなぞり、それ以外は水と仕掛けの力で動かす。 */
function stepLeader(
  stage: StageDefinition,
  state: PukupukaGameState,
  leader: FloaterState,
  definition: FloaterDefinition,
  context: {
    water: WaterField
    solids: readonly Rect[]
    gateFlow: GateFlowState
    driftDirection: number
    whaleActive: boolean
  },
  deltaSeconds: number,
): LeaderStep {
  const slide = stage.slide
  if (state.slide && slide) {
    const path = slidePath(stage, state.slide)
    const progress = state.slide.progress + SLIDE_SPEED * deltaSeconds
    if (progress >= pathLength(path)) {
      const end = path[path.length - 1]
      return {
        leader: {
          ...leader, x: end.x, y: end.y, vx: slide.exitVx, vy: slide.exitVy, submergedRatio: 0,
          facing: facingFromVelocity(slide.exitVx, leader.facing ?? 1), launchMs: LAUNCH_CARRY_MS, carryVx: slide.exitVx,
        },
        slide: null,
        launched: true,
      }
    }
    const point = pointOnPath(path, progress)
    const vx = (point.x - leader.x) / deltaSeconds
    return {
      leader: {
        ...leader, x: point.x, y: point.y, vx, vy: (point.y - leader.y) / deltaSeconds,
        submergedRatio: 0, facing: facingFromVelocity(vx, leader.facing ?? 1),
      },
      slide: { ...state.slide, progress },
      launched: false,
    }
  }

  const { water, solids, gateFlow, driftDirection } = context
  // Legacy互換面（同じ水域ID同士のゲート）だけ、従来の接触板として扱う。
  const board = stage.board && stage.gate?.leftBodyId === stage.gate?.rightBodyId
    ? { rect: stage.board, pushSpeed: boardFlowSpeed(state, driftDirection) }
    : undefined
  const body = findWaterBodyAt(stage.waterBodies, leader.x, leader.y)
  const bodyId = body?.id
  let flowDirection = gateFlow.direction
  if (bodyId === gateFlow.toBodyId && bodyId === stage.board?.targetBodyId) {
    flowDirection = Math.sign(boardFlowSpeed(state, driftDirection)) as -1 | 1
  }
  const affectedByGate = bodyId === gateFlow.fromBodyId || bodyId === gateFlow.toBodyId
  const directedReleaseBoard =
    stage.gate !== undefined && stage.gate.leftBodyId !== stage.gate.rightBodyId && bodyId === stage.board?.targetBodyId
  const circulation = stage.board?.circulation && bodyId === stage.board.targetBodyId && body &&
    waterSurfaceY(body, water[body.id]) < body.floorY - 2
  const circulationSpeed = circulation ? 150 * Math.sign(boardFlowSpeed(state, driftDirection)) : 0
  const ambientScale = directedReleaseBoard || circulation ? 0 : (stage.ambientDriftScale ?? 1)
  const wave = state.wave
  const waveDistance = wave ? Math.abs(leader.x - wave.x) : Infinity
  // 同じ水域でだけ作用する。水門を閉めた向こう岸を遠隔操作しない。
  const waveSpeed = wave && bodyId === wave.bodyId && waveDistance < 38
    ? (Math.sign(leader.x - wave.x) || driftDirection) * 110 *
      (1 - waveDistance / 38) * wave.remainingMs / 1000
    : 0
  let next = stepFloater(
    definition,
    leader,
    {
      surfaceY: surfaceYAt(stage.waterBodies, water, leader.x, leader.y),
      solids,
      bounds: { width: stage.width, height: stage.height },
      driftDirection: driftDirection * ambientScale,
      gateFlowSpeed: (circulation ? circulationSpeed : affectedByGate ? GATE_FLOW_SPEED * gateFlow.strength * flowDirection : 0) + waveSpeed,
      board,
    },
    deltaSeconds,
  )

  let launched = false
  if (context.whaleActive && stage.whale && inWhaleColumn(stage, next)) {
    next = { ...next, vy: stage.whale.launchVy, launchMs: LAUNCH_CARRY_MS, carryVx: stage.whale.carryVx }
    launched = true
  }
  let nextSlide: SlideTravel | null = null
  if (slide && (next.launchMs ?? 0) <= 0 && rectContainsPoint(slide.entry, next.x, next.y)) {
    nextSlide = { progress: 0, fromX: next.x, fromY: next.y }
  }
  return { leader: next, slide: nextSlide, launched }
}

/**
 * 待っている仲間は、その場で水に浮き沈みするだけで横へは流されない。
 * 足場で待ち続け、隊長が来るまで先に流れていってしまわないようにする。
 */
function stepWaitingFriend(
  stage: StageDefinition,
  friend: FloaterState,
  definition: FloaterDefinition,
  leader: FloaterState,
  water: WaterField,
  solids: readonly Rect[],
  deltaSeconds: number,
): FloaterState {
  const next = stepFloater(
    definition,
    { ...friend, launchMs: 0 },
    {
      surfaceY: surfaceYAt(stage.waterBodies, water, friend.x, friend.y),
      solids,
      bounds: { width: stage.width, height: stage.height },
      driftDirection: 0,
      gateFlowSpeed: 0,
    },
    deltaSeconds,
  )
  const toward = Math.sign(leader.x - definition.startX)
  return {
    ...next,
    x: definition.startX,
    vx: 0,
    facing: toward > 0 ? 1 : toward < 0 ? -1 : friend.facing,
  }
}

/**
 * 隊列に並ぶ仲間（先頭が隊長のすぐ後ろ）。新しく仲間になった子ほど前に入る。ふれた場所から
 * いちばん近い位置へ入り、前からいた子は1つずつ後ろへ下がる。
 */
function partyFollowers(
  stage: StageDefinition,
  state: Pick<PukupukaGameState, 'rescuedIds' | 'floaters'>,
  overrides: ReadonlyMap<string, FloaterState>,
) {
  return [...state.rescuedIds].reverse().flatMap((id) => {
    const floater = overrides.get(id) ?? getFloater(state as PukupukaGameState, id)
    const definition = definitionOf(stage, id)
    return floater && definition ? [{ state: floater, radius: definition.radius }] : []
  })
}

function stepDoorLifts(stage: StageDefinition, state: PukupukaGameState, deltaSeconds: number): Readonly<Record<string, number>> {
  if (!stage.doors?.length) return state.doorLifts
  let changed = false
  const next: Record<string, number> = { ...state.doorLifts }
  for (const door of stage.doors) {
    const current = state.doorLifts[door.id] ?? 0
    const target = isDoorOpen(stage, state, door.id) ? 1 : 0
    if (current === target) continue
    next[door.id] = Math.max(0, Math.min(1, current + Math.sign(target - current) * deltaSeconds / DOOR_OPEN_SECONDS))
    changed = true
  }
  return changed ? next : state.doorLifts
}

function advanceOneStep(
  stage: StageDefinition,
  state: PukupukaGameState,
  control: WaterControl,
  driftDirection: number,
): StepResult {
  const deltaSeconds = FIXED_STEP_MS / 1000
  const elapsedMs = state.elapsedMs + FIXED_STEP_MS

  const gateLift = Math.max(0, Math.min(1, state.gateLift + (state.gateOpen ? 1 : -1) * deltaSeconds / 0.65))
  const doorLifts = stepDoorLifts(stage, state, deltaSeconds)
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
      const drainBody = findWaterBody(stage.waterBodies, stage.drain.sourceBodyId)
      if (drainBody) {
        const minimumVolume = Math.max(0, drainBody.floorY - stage.drain.y) * (drainBody.right - drainBody.left)
        const current = water[drainBody.id]
        // 壁の排水口より低い水位では吸い上げない。空になった後の再描画も増やさない。
        if (current.targetVolume > minimumVolume) {
          water = { ...water, [drainBody.id]: { ...current,
            targetVolume: Math.max(minimumVolume, current.targetVolume - DRAIN_RATE_LEVEL_PER_SEC * deltaSeconds * (drainBody.right - drainBody.left)),
          } }
        }
      }
    }
  }
  water = stepWaterField(stage.waterBodies, water, deltaSeconds)
  let gateFlow: GateFlowState = { direction: 0, strength: 0, transferredVolume: 0 }
  if (state.phase === 'playing' && gateLift > 0 && stage.gate) {
    const transfer = transferWaterThroughGate(
      stage.waterBodies,
      water,
      stage.gate.leftBodyId,
      stage.gate.rightBodyId,
      deltaSeconds,
      { sillY: stage.gate.y + stage.gate.height, fraction: gateLift },
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
    // 全閉になった時点で残流も止める。閉まり途中は実際の開口に応じた通水を続ける。
    if (transfer.direction === 0 && state.gateFlow.direction !== 0) {
      const strength = Math.max(0, state.gateFlow.strength - deltaSeconds * 0.42)
      if (strength > 0) gateFlow = { ...state.gateFlow, strength, transferredVolume: 0 }
    }
  }

  const effects = state.effects.filter((effect) => elapsedMs - effect.atMs < EFFECT_LIFETIME_MS)
  const baseState = {
    ...state,
    water,
    elapsedMs,
    gateLift,
    doorLifts,
    gateFlow,
    whaleJetMs: Math.max(0, state.whaleJetMs - FIXED_STEP_MS),
    effects,
    wave: state.wave && state.wave.remainingMs > FIXED_STEP_MS && state.phase === 'playing'
      ? { ...state.wave, remainingMs: state.wave.remainingMs - FIXED_STEP_MS } : null,
  }

  // クリア後は浮遊物を止めた絵のままにする(#518)。隊長と仲間が並んだ隊列のまま止め、
  // 水の操作も受け付けなくなるのと合わせて「ここでおしまい」を見た目でも表す。
  const leaderId = leaderIdOf(stage)
  const leaderDefinition = definitionOf(stage, leaderId)
  const currentLeader = getFloater(state, leaderId)
  if (state.phase !== 'playing' || !leaderDefinition || !currentLeader) {
    // クリア後も、ジャンプやすべりだいの途中だった仲間は道すじを最後までたどって隊長の後ろへそろう。
    const settling = leaderDefinition && currentLeader
      ? stepFollowers(currentLeader, leaderDefinition.radius, false, state.trail, partyFollowers(stage, state, new Map()), {
        solids: activeSolids(stage, state.gateOpen, state.drainOpen, gateLift, doorLifts), waterBodies: stage.waterBodies, water,
      }, deltaSeconds)
      : []
    const settled = new Map(settling.map((follower) => [follower.id, follower]))
    const floaters = settling.length ? state.floaters.map((floater) => settled.get(floater.id) ?? floater) : state.floaters
    return { state: { ...baseState, floaters, wave: null }, goalReached: false }
  }

  const solids = activeSolids(stage, state.gateOpen, state.drainOpen, gateLift, doorLifts)
  const leaderStep = stepLeader(stage, state, currentLeader, leaderDefinition, {
    water, solids, gateFlow, driftDirection, whaleActive: state.whaleJetMs > 0,
  }, deltaSeconds)
  const leader = leaderStep.leader
  const addEffect = (kind: GameEffectKind, key: string, x: number, y: number) => {
    effects.push({ id: `${kind}-${key}-${Math.round(elapsedMs)}`, kind, x, y, atMs: elapsedMs })
  }
  if (leaderStep.launched) addEffect('launch', leader.id, leader.x, leader.y)

  // ベル: 隊長がふれたら鳴り、つながったとびらが開き続ける。
  const rungBellIds = [...state.rungBellIds]
  for (const bell of stage.bells ?? []) {
    if (rungBellIds.includes(bell.id)) continue
    if (Math.hypot(leader.x - bell.x, leader.y - bell.y) <= leaderDefinition.radius + BELL_RADIUS) {
      rungBellIds.push(bell.id)
      addEffect('bell', bell.id, bell.x, bell.y)
    }
  }

  // 待っている仲間と、隊長がふれたときの合流。
  const rescuedIds = [...state.rescuedIds]
  const friendIds = friendIdsOf(stage)
  const waiting = new Map<string, FloaterState>()
  for (const floater of state.floaters) {
    if (floater.id === leaderId || rescuedIds.includes(floater.id)) continue
    const definition = definitionOf(stage, floater.id)
    if (!definition) continue
    const next = stepWaitingFriend(stage, floater, definition, leader, water, solids, deltaSeconds)
    if (friendIds.includes(floater.id) &&
      Math.hypot(next.x - leader.x, next.y - leader.y) <= leaderDefinition.radius + definition.radius + PICKUP_MARGIN) {
      rescuedIds.push(floater.id)
      addEffect('join', floater.id, next.x, next.y)
      waiting.set(floater.id, floater)
    } else {
      waiting.set(floater.id, next)
    }
  }

  const leaderExact = leaderStep.slide !== null || (leader.launchMs ?? 0) > 0
  const trail = recordTrail(state.trail, leader, leaderExact, trailKeepLength(stage))
  const followers = stepFollowers(
    leader,
    leaderDefinition.radius,
    leaderExact,
    trail,
    partyFollowers(stage, { ...state, rescuedIds }, waiting),
    { solids, waterBodies: stage.waterBodies, water },
    deltaSeconds,
  )
  const followerById = new Map(followers.map((follower) => [follower.id, follower]))
  const floaters = state.floaters.map((floater) =>
    floater.id === leaderId ? leader : followerById.get(floater.id) ?? waiting.get(floater.id) ?? floater)

  // 高いところから水へ落ちた瞬間に、しぶきを1回だけ出す。
  for (const floater of [leader, ...followers]) {
    const before = getFloater(state, floater.id)
    if (before && before.submergedRatio < 0.05 && floater.submergedRatio >= 0.05 && floater.vy > SPLASH_SPEED) {
      addEffect('splash', floater.id, floater.x, floater.y + (definitionOf(stage, floater.id)?.radius ?? 0))
    }
  }

  // ほしは隊長と、ついてきている仲間が拾える（待っている仲間は拾わない）。
  const collectedStarIds = [...state.collectedStarIds]
  const party = [leader, ...followers]
  for (const star of stage.stars ?? []) {
    if (collectedStarIds.includes(star.id)) continue
    if (party.some((floater) =>
      Math.hypot(floater.x - star.x, floater.y - star.y) <= (definitionOf(stage, floater.id)?.radius ?? 0) + 4)) {
      collectedStarIds.push(star.id)
      addEffect('star', star.id, star.x, star.y)
    }
  }

  let phase: PukupukaPhase = 'playing'
  let goalReached = false
  if (friendIds.every((id) => rescuedIds.includes(id)) && isAtGoal(stage, solids, leader)) {
    phase = 'cleared'
    goalReached = true
  }

  return {
    state: {
      ...baseState,
      floaters,
      phase,
      rescuedIds,
      collectedStarIds,
      trail,
      rungBellIds,
      slide: leaderStep.slide,
      effects,
      wave: phase === 'playing' ? baseState.wave : null,
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
