import { describe, expect, it } from 'vitest'
import {
  createKomaJudgeState,
  decideMatchOutcome,
  isOutOfArena,
  MATCH_TIME_LIMIT_MS,
  SIMULTANEOUS_WINDOW_MS,
  START_GRACE_MS,
  STOP_SUSTAIN_MS,
  TOPPLE_SUSTAIN_MS,
  TOPPLE_TILT_RAD,
  updateKomaJudge,
  type KomaJudgeState,
  type KomaSample,
} from './komaOutcome'
import { OUT_FLOOR_Y } from './komaPhysics'
import { OUT_RADIUS } from './komaStadium'

const SPINNING: KomaSample = {
  tiltRad: 0.05,
  spinSpeed: 60,
  linearSpeed: 0.8,
  radius: 1,
  y: -0.2,
}

/** 同じサンプルを一定時間流し込み、その間の状態遷移を確かめる補助。 */
function advance(
  state: KomaJudgeState,
  sample: KomaSample,
  durationMs: number,
  startElapsedMs: number,
  stepMs = 50,
): { state: KomaJudgeState; elapsedMs: number } {
  let current = state
  let elapsed = startElapsedMs
  for (let passed = 0; passed < durationMs; passed += stepMs) {
    elapsed += stepMs
    current = updateKomaJudge(current, sample, stepMs, elapsed)
  }
  return { state: current, elapsedMs: elapsed }
}

describe('isOutOfArena', () => {
  it('壁の内側は場外ではない', () => {
    expect(isOutOfArena({ radius: OUT_RADIUS - 0.1, y: -0.2 })).toBe(false)
  })

  it('外周より外は場外', () => {
    expect(isOutOfArena({ radius: OUT_RADIUS + 0.01, y: 0 })).toBe(true)
  })

  it('床より十分下へ落ちたら場外', () => {
    expect(isOutOfArena({ radius: 0, y: OUT_FLOOR_Y - 0.01 })).toBe(true)
  })

  it('NaNは場外として扱い、判定不能なコマを回し続けない', () => {
    expect(isOutOfArena({ radius: Number.NaN, y: 0 })).toBe(true)
    expect(isOutOfArena({ radius: 0, y: Number.POSITIVE_INFINITY })).toBe(true)
  })
})

describe('updateKomaJudge', () => {
  it('回転している間は敗北しない', () => {
    const { state } = advance(createKomaJudgeState(), SPINNING, 5000, 0)
    expect(state.defeatReason).toBeNull()
  })

  it('衝突で一瞬大きく傾いただけでは転倒にならない', () => {
    const tilted: KomaSample = { ...SPINNING, tiltRad: TOPPLE_TILT_RAD + 0.5 }
    // 継続時間の半分だけ大きく傾き、そのあと立て直す。
    const knocked = advance(
      createKomaJudgeState(),
      tilted,
      TOPPLE_SUSTAIN_MS / 2,
      START_GRACE_MS,
    )
    expect(knocked.state.defeatReason).toBeNull()

    // 立て直したら、たまっていた時間は0へ戻る。
    const recovered = advance(knocked.state, SPINNING, 300, knocked.elapsedMs)
    expect(recovered.state.toppledForMs).toBe(0)

    // その後もう一度同じ時間だけ傾いても、まだ転倒にはならない。
    const again = advance(
      recovered.state,
      tilted,
      TOPPLE_SUSTAIN_MS / 2,
      recovered.elapsedMs,
    )
    expect(again.state.defeatReason).toBeNull()
  })

  it('傾きが継続すれば転倒になる', () => {
    const tilted: KomaSample = { ...SPINNING, tiltRad: TOPPLE_TILT_RAD + 0.2 }
    const { state } = advance(
      createKomaJudgeState(),
      tilted,
      TOPPLE_SUSTAIN_MS + 100,
      START_GRACE_MS,
    )
    expect(state.defeatReason).toBe('toppled')
  })

  it('しきい値の間の傾きでは、たまった時間が増えも減りもしない（ヒステリシス）', () => {
    const tilted: KomaSample = { ...SPINNING, tiltRad: TOPPLE_TILT_RAD + 0.2 }
    const knocked = advance(createKomaJudgeState(), tilted, 200, START_GRACE_MS)
    expect(knocked.state.toppledForMs).toBe(200)

    // 解除しきい値(0.4)と判定しきい値(0.6)の間。
    const between: KomaSample = { ...SPINNING, tiltRad: 0.5 }
    const held = advance(knocked.state, between, 500, knocked.elapsedMs)
    expect(held.state.toppledForMs).toBe(200)
    expect(held.state.defeatReason).toBeNull()
  })

  it('低速が一定時間続けば停止になる', () => {
    const slow: KomaSample = { ...SPINNING, spinSpeed: 1, linearSpeed: 0.05 }
    const early = advance(createKomaJudgeState(), slow, STOP_SUSTAIN_MS - 100, START_GRACE_MS)
    expect(early.state.defeatReason).toBeNull()

    const later = advance(early.state, slow, 200, early.elapsedMs)
    expect(later.state.defeatReason).toBe('stopped')
  })

  it('まだ滑っている間は低速でも停止にしない', () => {
    const sliding: KomaSample = { ...SPINNING, spinSpeed: 1, linearSpeed: 2 }
    const { state } = advance(
      createKomaJudgeState(),
      sliding,
      STOP_SUSTAIN_MS + 500,
      START_GRACE_MS,
    )
    expect(state.defeatReason).toBeNull()
  })

  it('開始直後の猶予時間には転倒・停止で負けにならない', () => {
    const tilted: KomaSample = { ...SPINNING, tiltRad: TOPPLE_TILT_RAD + 0.5 }
    const { state } = advance(createKomaJudgeState(), tilted, START_GRACE_MS - 100, 0)
    expect(state.defeatReason).toBeNull()
  })

  it('場外は猶予時間中でも判定する', () => {
    const outside: KomaSample = { ...SPINNING, radius: OUT_RADIUS + 0.5 }
    const { state } = advance(createKomaJudgeState(), outside, 400, 0)
    expect(state.defeatReason).toBe('outOfArena')
  })

  it('一度決まった敗北は後から覆らない', () => {
    const tilted: KomaSample = { ...SPINNING, tiltRad: TOPPLE_TILT_RAD + 0.2 }
    const defeated = advance(
      createKomaJudgeState(),
      tilted,
      TOPPLE_SUSTAIN_MS + 100,
      START_GRACE_MS,
    )
    expect(defeated.state.defeatReason).toBe('toppled')

    const after = advance(defeated.state, SPINNING, 2000, defeated.elapsedMs)
    expect(after.state).toBe(defeated.state)
  })
})

describe('decideMatchOutcome', () => {
  const defeated = (atMs: number): KomaJudgeState => ({
    ...createKomaJudgeState(),
    defeatReason: 'toppled',
    defeatedAtMs: atMs,
  })

  it('両方とも回っている間は決まらない', () => {
    expect(decideMatchOutcome([createKomaJudgeState(), createKomaJudgeState()], 5000)).toBeNull()
  })

  it('片方が決着した直後は、相手が続かないか確かめるまで確定しない', () => {
    const states = [defeated(5000), createKomaJudgeState()]
    expect(decideMatchOutcome(states, 5000 + SIMULTANEOUS_WINDOW_MS - 10)).toBeNull()
  })

  it('同時判定の窓を過ぎたら、先に条件を満たした側の負けで確定する', () => {
    const states = [defeated(5000), createKomaJudgeState()]
    expect(decideMatchOutcome(states, 5000 + SIMULTANEOUS_WINDOW_MS + 10)).toEqual({
      kind: 'win',
      winnerIndex: 1,
      loserIndex: 0,
      reason: 'toppled',
    })
  })

  it('ほぼ同時に倒れた場合は引き分けになる', () => {
    const states = [defeated(5000), defeated(5000 + SIMULTANEOUS_WINDOW_MS - 10)]
    expect(decideMatchOutcome(states, 6000)).toEqual({
      kind: 'draw',
      reason: 'simultaneous',
    })
  })

  it('十分な差があれば、あとから倒れた側の勝ちになる', () => {
    const states = [defeated(5000 + SIMULTANEOUS_WINDOW_MS + 100), defeated(5000)]
    expect(decideMatchOutcome(states, 6000)).toEqual({
      kind: 'win',
      winnerIndex: 0,
      loserIndex: 1,
      reason: 'toppled',
    })
  })

  it('制限時間まで決着しなければ引き分けにする', () => {
    const states = [createKomaJudgeState(), createKomaJudgeState()]
    expect(decideMatchOutcome(states, MATCH_TIME_LIMIT_MS)).toEqual({
      kind: 'draw',
      reason: 'timeLimit',
    })
  })

  it('1個モードは勝敗ではなく終了として扱う', () => {
    expect(decideMatchOutcome([createKomaJudgeState()], 5000)).toBeNull()
    expect(decideMatchOutcome([defeated(5000)], 5200)).toEqual({
      kind: 'soloFinished',
      reason: 'toppled',
    })
  })

  it('1個モードでも制限時間で終了する', () => {
    expect(decideMatchOutcome([createKomaJudgeState()], MATCH_TIME_LIMIT_MS)).toEqual({
      kind: 'soloFinished',
      reason: 'stopped',
    })
  })
})
