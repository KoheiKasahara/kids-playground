/**
 * シーソー(レバー)ギミック。フラグピンボールのseesawToy.tsと同じ考え方で、
 * 「板の上に乗っている球の位置から目標角度を毎フレーム計算し、一定の速さで近づける」
 * 疑似物理として実装する。Rapierのrevolute jointで揺れを物理任せにする案も検討したが、
 * 最大角度を絶対に超えない・暴れ続けないことを構造で保証できるこの方式を選んだ。
 * 板はkinematicPositionBasedにして、球やドミノへの一方向の力積はRapierの
 * 通常の剛体衝突にまかせる。
 */

/** 支点から前後に伸びる板の半長。球を受ける側とドミノを叩く側の両方を確保する。 */
export const SEESAW_PLANK_HALF_LENGTH = 0.82
export const SEESAW_PLANK_WIDTH = 0.62
export const SEESAW_PLANK_THICKNESS = 0.12
export const SEESAW_PLANK_FRICTION = 0.62
/** 支点の高さ(地面基準)。ボール区間側の出口サーフェスと合わせる。 */
export const SEESAW_PIVOT_HEIGHT = 0.7
/**
 * 最大傾斜角(rad)。約26度。半長0.82との組み合わせで、叩く側の先端が
 * 支点の高さから約0.36上がり、ドミノの下半身へ確実に届く(見た目にも十分な"ガタン"になる)。
 */
export const SEESAW_MAX_TILT_RAD = 0.46
/** 目標角度へ近づく速さ(rad/s)。0→最大角を約0.22秒で駆け抜け、はっきり分かる速さにする。 */
export const SEESAW_ANGLE_SLEW_RATE = SEESAW_MAX_TILT_RAD / 0.22
/** 板の上に球が乗っていると判定する前後・左右方向の余裕。 */
export const SEESAW_CONTACT_MARGIN = 0.32
/** 板面に沿っていると判定する高さ方向の許容範囲。 */
export const SEESAW_CONTACT_HEIGHT_MARGIN = 0.55
/**
 * 叩かれる側のドミノを支点の高さより少し高い台へ乗せ、静止時(傾き0)では板の先端が
 * ドミノの下に隠れて接触しないようにする。傾いたときだけ先端がドミノの下半身へ食い込む。
 */
export const SEESAW_STRIKE_DOMINO_CLEARANCE = 0.05
/**
 * 保険処理。板がほぼ最大角へ達したのにドミノがこの時間倒れなければ、1回だけ軽く後押しする。
 * 通常は物理接触だけで倒れるため、実運用では発火しないことを想定した最低限の安全網。
 */
export const SEESAW_ASSIST_DELAY_MS = 700

export type DominoSeesawSection = {
  pivot: { x: number; y: number; z: number }
  /** 板の初期の向き(ヨー)。受け側→叩く側への進行方向と一致させる。 */
  yaw: number
  /** 傾いた板の先端が当てにいく、後段の先頭ドミノ。 */
  strikeDominoId: string
  /** strikeDominoIdの配置に必要なbaseY(支点の高さ+わずかな隙間)。 */
  strikeDominoBaseY: number
}

/**
 * ボール区間の出口点(受け側)と、叩く対象のドミノ位置から支点を求める。
 * 支点は「ドミノ位置から進行方向を半長ぶん戻した点」にすることで、
 * 反対側の腕(受け側)がボールレール出口のすぐ近くに来るようにする。
 */
export function createDominoSeesawSection(
  approachPath: readonly { x: number; z: number; yaw: number }[],
  strikeIndex: number,
): DominoSeesawSection {
  const strike = approachPath[strikeIndex]
  if (!strike) throw new Error(`シーソー先のドミノ approach-${strikeIndex} がありません`)
  const forward = { x: Math.sin(strike.yaw), z: Math.cos(strike.yaw) }
  return {
    pivot: {
      x: strike.x - forward.x * SEESAW_PLANK_HALF_LENGTH,
      y: SEESAW_PIVOT_HEIGHT,
      z: strike.z - forward.z * SEESAW_PLANK_HALF_LENGTH,
    },
    yaw: strike.yaw,
    strikeDominoId: `approach-${strikeIndex}`,
    // 板の静止時の上面(支点の高さ+厚みの半分)より上に、わずかな隙間を挟んで置く。
    strikeDominoBaseY:
      SEESAW_PIVOT_HEIGHT + SEESAW_PLANK_THICKNESS / 2 + SEESAW_STRIKE_DOMINO_CLEARANCE,
  }
}

/**
 * 現在の傾きにおける板ローカル座標へ球の位置を変換し、支点からの符号付きオフセットを
 * plankHalfLengthで正規化した値(-1..1)で返す。板の上に乗っていなければnull。
 * 符号は受け側(球が乗る側)が負、叩く側(ドミノ側)が正になるよう、
 * createDominoSeesawSectionのforward(受け側→叩く側)を+1側に揃えている。
 */
export function seesawLocalOffset(
  section: DominoSeesawSection,
  currentTiltRad: number,
  ballPosition: { x: number; y: number; z: number },
): number | null {
  const dx = ballPosition.x - section.pivot.x
  const dz = ballPosition.z - section.pivot.z
  const forwardX = Math.sin(section.yaw)
  const forwardZ = Math.cos(section.yaw)
  const lateralX = Math.cos(section.yaw)
  const lateralZ = -Math.sin(section.yaw)
  const forwardOffset = dx * forwardX + dz * forwardZ
  const lateralOffset = dx * lateralX + dz * lateralZ
  if (Math.abs(lateralOffset) > SEESAW_PLANK_WIDTH / 2 + SEESAW_CONTACT_MARGIN) return null
  if (Math.abs(forwardOffset) > SEESAW_PLANK_HALF_LENGTH + SEESAW_CONTACT_MARGIN) return null
  // 板面の高さは傾きに応じてforwardOffset*sin(tilt)だけ支点から上下する。
  const surfaceY = section.pivot.y + forwardOffset * Math.sin(currentTiltRad)
  if (Math.abs(ballPosition.y - surfaceY) > SEESAW_CONTACT_HEIGHT_MARGIN) return null
  return Math.min(1, Math.max(-1, forwardOffset / SEESAW_PLANK_HALF_LENGTH))
}

/**
 * 目標角度(球の位置から決まる)へ、1フレーム分の最大変化量までしか動かさない。
 * seesawToy.tsのANGLE_SLEW_RATEと同じ「構造で最大角度を保証する」方式。
 */
export function advanceSeesawTilt(
  currentTiltRad: number,
  targetTiltRad: number,
  deltaSeconds: number,
): number {
  const maxStep = SEESAW_ANGLE_SLEW_RATE * Math.max(0, deltaSeconds)
  let next = currentTiltRad
  if (currentTiltRad < targetTiltRad) {
    next = Math.min(currentTiltRad + maxStep, targetTiltRad)
  } else if (currentTiltRad > targetTiltRad) {
    next = Math.max(currentTiltRad - maxStep, targetTiltRad)
  }
  return Math.min(SEESAW_MAX_TILT_RAD, Math.max(-SEESAW_MAX_TILT_RAD, next))
}

export type SeesawRuntimeState = {
  tiltRad: number
  /** 一度受け側で検出したら、球がその後どこへ動いても傾き続ける「作動済み」フラグ。 */
  activated: boolean
  /** 最大角へ到達し、以後は動かないと確定したフレームでtrueのまま変わらなくなる。 */
  settled: boolean
  /** settledへ変わった、まさにそのフレームだけtrue。呼び出し側はこの回だけ
   *  kinematic剛体をFixedへ切り替える(下のコメント参照)。 */
  justSettled: boolean
}

export function createSeesawRuntimeState(): SeesawRuntimeState {
  return { tiltRad: 0, activated: false, settled: false, justSettled: false }
}

/**
 * 球の速度が速いと、受け側にいる間だけ角度を追従させる方式では最大角度への
 * 立ち上がり(SEESAW_ANGLE_SLEW_RATE)に間に合わず、通り過ぎた瞬間に反対方向へ
 * 戻ってしまうことがある。そのため「受け側で一度検出したら、後は球の位置に関わらず
 * 最大角度まで傾き切る」という一方向のラッチにし、実際の遊具の"ガタン"に近づける。
 */
export function advanceSeesawState(
  state: SeesawRuntimeState,
  section: DominoSeesawSection,
  ballPosition: { x: number; y: number; z: number },
  deltaSeconds: number,
): SeesawRuntimeState {
  const offset = seesawLocalOffset(section, state.tiltRad, ballPosition)
  const activated = state.activated || (offset !== null && offset < 0)
  const targetTiltRad = activated ? -SEESAW_MAX_TILT_RAD : 0
  const tiltRad = advanceSeesawTilt(state.tiltRad, targetTiltRad, deltaSeconds)
  // kinematic剛体はRapierが「いつでも動きうる」ものとして扱うため、接触したドミノは
  // 傾ききって静止したあとも接触island判定でsleepできず起き続けてしまう。
  // 板が最大角へ到達しもう動かないと分かった時点で、呼び出し側がFixed(完全な固定物)へ
  // 切り替えられるよう、そのフレームだけjustSettledを立てる。
  const settled = activated && tiltRad === -SEESAW_MAX_TILT_RAD
  const justSettled = settled && !state.settled
  return { tiltRad, activated, settled, justSettled }
}

/** 板のヨー・傾きを合成したクォータニオンを、ボールレールのピース姿勢と同じ式で求める。 */
export function seesawPlankRotation(
  yaw: number,
  tiltRad: number,
): { x: number; y: number; z: number; w: number } {
  const halfYaw = yaw / 2
  const halfTilt = tiltRad / 2
  return {
    x: Math.cos(halfYaw) * Math.sin(halfTilt),
    y: Math.sin(halfYaw) * Math.cos(halfTilt),
    z: -Math.sin(halfYaw) * Math.sin(halfTilt),
    w: Math.cos(halfYaw) * Math.cos(halfTilt),
  }
}
