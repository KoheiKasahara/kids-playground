import { describe, expect, it } from 'vitest'
import { ALL_FLAGS_LAUNCH_INTERVAL_MS, launchDelaysMs, SCORE_ZONES } from './boardLayout'
import { candyBoard, oceanBoard, skyBoard, spaceBoard } from './boardConfigs'
import { PINBALL_FLAG_IDS } from './data/pinballFlags'
import { SIMULATION_BALL_COUNT, STEP_MS } from './pinballPhysics'
import { simulatePinballRun } from './pinballSimulation'

const TRIAL_COUNT = 32
const SEED_BASE = 0x1f2e3d4c
const SEED_STEP = 7919
const RAPID_TAP_TRIAL_COUNT = 12
const RAPID_TAP_INTERVAL_MS = 100

describe('pinball fixed-step play-time simulation', () => {
  it('おもちゃをタップしない32個のシード付き試行が、従来と同程度の時間で完了する', () => {
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, { toyTapIntervalMs: null }),
    )
    const seconds = results.map((result) => result.durationSeconds).sort((a, b) => a - b)
    const median = (seconds[TRIAL_COUNT / 2 - 1] + seconds[TRIAL_COUNT / 2]) / 2
    const min = seconds[0]
    const max = seconds[seconds.length - 1]
    const mean = seconds.reduce((sum, value) => sum + value, 0) / seconds.length

    // このログは調整時の実測値を残すためのもの。アサーションは緩い境界だけにする。
    console.info(
      `pinball simulation (${TRIAL_COUNT} trials): min=${min.toFixed(3)}s median=${median.toFixed(3)}s mean=${mean.toFixed(3)}s max=${max.toFixed(3)}s`,
    )

    expect(results.every((result) => result.completed)).toBe(true)
    expect(results.every((result) => !result.usedSafetyTimeout)).toBe(true)
    expect(results.every((result) => result.steps * STEP_MS === result.durationMs)).toBe(true)
    // おもちゃのBodyは含めるがタップはしないため、従来の測定値から少しずれる。
    // 物理エンジンや受動的な接触のわずかな差で壊れないよう、実測値より広く取る。
    expect(min).toBeGreaterThanOrEqual(3)
    expect(median).toBeGreaterThanOrEqual(7)
    expect(median).toBeLessThan(20)
    expect(max).toBeLessThan(35)
  })

  it('おもちゃを100ms間隔で連打しても、安全タイマーなしで全試行が完了する', () => {
    const results = Array.from({ length: RAPID_TAP_TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, {
        toyTapIntervalMs: RAPID_TAP_INTERVAL_MS,
      }),
    )
    const seconds = results.map((result) => result.durationSeconds).sort((a, b) => a - b)
    const median =
      (seconds[RAPID_TAP_TRIAL_COUNT / 2 - 1] + seconds[RAPID_TAP_TRIAL_COUNT / 2]) / 2
    const min = seconds[0]
    const max = seconds[seconds.length - 1]
    const mean = seconds.reduce((sum, value) => sum + value, 0) / seconds.length

    // launch/stall と各おもちゃへ同じ seeded random を渡すため、同じシードで再現できる。
    console.info(
      `pinball rapid toy taps (${RAPID_TAP_TRIAL_COUNT} trials, ${RAPID_TAP_INTERVAL_MS}ms): min=${min.toFixed(3)}s median=${median.toFixed(3)}s mean=${mean.toFixed(3)}s max=${max.toFixed(3)}s`,
    )

    expect(results.every((result) => result.completed)).toBe(true)
    expect(results.every((result) => !result.usedSafetyTimeout)).toBe(true)
    expect(results.every((result) => result.steps * STEP_MS === result.durationMs)).toBe(true)
    // 45秒の安全タイマーより5秒以上短い余裕を残し、連打で停滞していないことを確認する。
    expect(max).toBeLessThan(40)
  })

  it('scoredZoneIdsが球数と一致し、すべて既知のゾーンIDになる', () => {
    const knownZoneIds = new Set(SCORE_ZONES.map((zone) => zone.id))
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, { toyTapIntervalMs: null }),
    )

    for (const result of results) {
      expect(result.scoredZoneIds).toHaveLength(SIMULATION_BALL_COUNT)
      expect(result.scoredZoneIds).toHaveLength(result.scoreSteps.length)
      expect(result.scoredZoneIds.every((zoneId) => knownZoneIds.has(zoneId))).toBe(true)
    }
  })

  it('おもちゃの乱数を含むシミュレーションも同じシードで再現する', () => {
    const spaceOptions = { toyTapIntervalMs: RAPID_TAP_INTERVAL_MS, boardConfig: spaceBoard }
    const firstSpaceRun = simulatePinballRun(SEED_BASE, spaceOptions)
    const secondSpaceRun = simulatePinballRun(SEED_BASE, spaceOptions)
    expect(secondSpaceRun).toEqual(firstSpaceRun)

    const oceanOptions = { toyTapIntervalMs: RAPID_TAP_INTERVAL_MS, boardConfig: oceanBoard }
    const firstOceanRun = simulatePinballRun(SEED_BASE, oceanOptions)
    const secondOceanRun = simulatePinballRun(SEED_BASE, oceanOptions)
    expect(secondOceanRun).toEqual(firstOceanRun)
  })
})

describe('pinball 宇宙盤面（spaceBoard）のシミュレーション', () => {
  it('おもちゃをタップしない32個のシード付き試行が、安全タイマーに頼らず全球得点確定する', () => {
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, { toyTapIntervalMs: null, boardConfig: spaceBoard }),
    )
    const seconds = results.map((result) => result.durationSeconds).sort((a, b) => a - b)
    const median = (seconds[TRIAL_COUNT / 2 - 1] + seconds[TRIAL_COUNT / 2]) / 2
    const min = seconds[0]
    const max = seconds[seconds.length - 1]
    const mean = seconds.reduce((sum, value) => sum + value, 0) / seconds.length

    console.info(
      `space board simulation (${TRIAL_COUNT} trials): min=${min.toFixed(3)}s median=${median.toFixed(3)}s mean=${mean.toFixed(3)}s max=${max.toFixed(3)}s`,
    )

    expect(results.every((result) => result.completed)).toBe(true)
    expect(results.every((result) => !result.usedSafetyTimeout)).toBe(true)
    // 宇宙盤面はジャンプ台の上下移動ぶん通常盤面より多少長くなってよいが、
    // 極端に長時間ボールが残る盤面にはしない（目安の10〜20秒に対して十分な余裕を持たせた上限）。
    expect(min).toBeGreaterThanOrEqual(3)
    expect(median).toBeGreaterThanOrEqual(7)
    expect(median).toBeLessThan(25)
    expect(max).toBeLessThan(40)
  })

  it('おもちゃを100ms間隔で連打しても、安全タイマーなしで全試行が完了する', () => {
    const results = Array.from({ length: RAPID_TAP_TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, {
        toyTapIntervalMs: RAPID_TAP_INTERVAL_MS,
        boardConfig: spaceBoard,
      }),
    )
    const seconds = results.map((result) => result.durationSeconds).sort((a, b) => a - b)
    const max = seconds[seconds.length - 1]

    expect(results.every((result) => result.completed)).toBe(true)
    expect(results.every((result) => !result.usedSafetyTimeout)).toBe(true)
    expect(results.every((result) => result.steps * STEP_MS === result.durationMs)).toBe(true)
    // 安全タイマー(45秒)より短い範囲であることの緩い境界確認。宇宙盤面はゴール手前の
    // ピン・バンパーぶん、通常盤面より連打時の跳ね返りが長引くことがあるため、
    // 安全タイマーに対して5秒弱の余裕を残す44秒を上限にしている。
    expect(max).toBeLessThan(44)
  })

  it('3球が時間差射出のあいだ同時に盤面上へ存在する（射出間隔は通常テーマと共通のため）', () => {
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, { toyTapIntervalMs: null, boardConfig: spaceBoard }),
    )
    expect(results.every((result) => result.maxConcurrentBalls > 1)).toBe(true)
  })

  it('scoredZoneIdsが球数と一致し、すべて既知のゾーンIDになる', () => {
    const knownZoneIds = new Set(SCORE_ZONES.map((zone) => zone.id))
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, { toyTapIntervalMs: null, boardConfig: spaceBoard }),
    )

    for (const result of results) {
      expect(result.scoredZoneIds).toHaveLength(SIMULATION_BALL_COUNT)
      expect(result.scoredZoneIds.every((zoneId) => knownZoneIds.has(zoneId))).toBe(true)
    }
  })

  it('5つの得点ゾーンすべてに実際にボールが入る（明確なデッドスペースがないこと）', () => {
    // ゴール直前の配置は「均等な分布」ではなく「どのゾーンにも到達できること」を狙っている。
    // 1000点・右側の300点/100点ゾーンは意図的にレア寄りのままでよいが、十分な試行数の中で
    // 一度も入らないゾーンが残っていないかを確認する（複数のシード範囲で確認し、
    // 1つの乱数列だけに依存する偶然の結果でないようにする）。
    const seedBases = [SEED_BASE, 0x9a8b7c6d, 0x55aa77bb]
    const zoneCounts = new Map<string, number>(SCORE_ZONES.map((zone) => [zone.id, 0]))
    for (const seedBase of seedBases) {
      const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
        simulatePinballRun(seedBase + index * SEED_STEP, { toyTapIntervalMs: null, boardConfig: spaceBoard }),
      )
      for (const result of results) {
        for (const zoneId of result.scoredZoneIds) {
          zoneCounts.set(zoneId, (zoneCounts.get(zoneId) ?? 0) + 1)
        }
      }
    }

    console.info(
      'space board zone distribution:',
      SCORE_ZONES.map((zone) => `${zone.id}(${zone.score})=${zoneCounts.get(zone.id) ?? 0}`).join(' '),
    )

    for (const zone of SCORE_ZONES) {
      expect(
        zoneCounts.get(zone.id),
        `space board zone distribution: ${zone.id}(${zone.score})=${zoneCounts.get(zone.id) ?? 0}`,
      ).toBeGreaterThan(0)
    }
  })
})

describe('pinball 海盤面（oceanBoard）のシミュレーション', () => {
  it('おもちゃをタップしない32個のシード付き試行が、安全タイマーに頼らず全球得点確定する', () => {
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, { toyTapIntervalMs: null, boardConfig: oceanBoard }),
    )
    const seconds = results.map((result) => result.durationSeconds).sort((a, b) => a - b)
    const median = (seconds[TRIAL_COUNT / 2 - 1] + seconds[TRIAL_COUNT / 2]) / 2
    const min = seconds[0]
    const max = seconds[seconds.length - 1]
    const mean = seconds.reduce((sum, value) => sum + value, 0) / seconds.length

    console.info(
      `ocean board simulation (${TRIAL_COUNT} trials): min=${min.toFixed(3)}s median=${median.toFixed(3)}s mean=${mean.toFixed(3)}s max=${max.toFixed(3)}s`,
    )

    expect(results.every((result) => result.completed)).toBe(true)
    expect(results.every((result) => !result.usedSafetyTimeout)).toBe(true)
    // 海盤面は蛇行ぶん通常盤面より多少長くなってよいが、目安の10〜20秒に対して
    // 十分な余裕を持たせた上限にする（極端に長時間ボールが残る盤面にはしない）。
    expect(min).toBeGreaterThanOrEqual(3)
    expect(median).toBeGreaterThanOrEqual(7)
    expect(median).toBeLessThan(25)
    expect(max).toBeLessThan(40)
  })

  it('おもちゃを100ms間隔で連打しても、安全タイマーなしで全試行が完了する', () => {
    const results = Array.from({ length: RAPID_TAP_TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, {
        toyTapIntervalMs: RAPID_TAP_INTERVAL_MS,
        boardConfig: oceanBoard,
      }),
    )
    const seconds = results.map((result) => result.durationSeconds).sort((a, b) => a - b)
    const max = seconds[seconds.length - 1]

    expect(results.every((result) => result.completed)).toBe(true)
    expect(results.every((result) => !result.usedSafetyTimeout)).toBe(true)
    expect(results.every((result) => result.steps * STEP_MS === result.durationMs)).toBe(true)
    // 安全タイマー(45秒)より短い範囲であることの緩い境界確認。
    expect(max).toBeLessThan(44)
  })

  it('3球が時間差射出のあいだ同時に盤面上へ存在する（射出間隔は通常テーマと共通のため）', () => {
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, { toyTapIntervalMs: null, boardConfig: oceanBoard }),
    )
    expect(results.every((result) => result.maxConcurrentBalls > 1)).toBe(true)
  })

  it('scoredZoneIdsが球数と一致し、すべて既知のゾーンIDになる', () => {
    const knownZoneIds = new Set(SCORE_ZONES.map((zone) => zone.id))
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, { toyTapIntervalMs: null, boardConfig: oceanBoard }),
    )

    for (const result of results) {
      expect(result.scoredZoneIds).toHaveLength(SIMULATION_BALL_COUNT)
      expect(result.scoredZoneIds.every((zoneId) => knownZoneIds.has(zoneId))).toBe(true)
    }
  })

  it('5つの得点ゾーンすべてに実際にボールが入る（明確なデッドスペースがないこと）', () => {
    // 1000点・端の100点ゾーンは意図的にレア寄りのままでよいが、十分な試行数の中で
    // 一度も入らないゾーンが残っていないかを確認する（複数のシード範囲で確認し、
    // 1つの乱数列だけに依存する偶然の結果でないようにする）。
    const seedBases = [SEED_BASE, 0x9a8b7c6d, 0x55aa77bb]
    const zoneCounts = new Map<string, number>(SCORE_ZONES.map((zone) => [zone.id, 0]))
    for (const seedBase of seedBases) {
      const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
        simulatePinballRun(seedBase + index * SEED_STEP, { toyTapIntervalMs: null, boardConfig: oceanBoard }),
      )
      for (const result of results) {
        for (const zoneId of result.scoredZoneIds) {
          zoneCounts.set(zoneId, (zoneCounts.get(zoneId) ?? 0) + 1)
        }
      }
    }

    for (const zone of SCORE_ZONES) {
      expect(zoneCounts.get(zone.id)).toBeGreaterThan(0)
    }
  })
})

describe('pinball おかし盤面（candyBoard）のシミュレーション', () => {
  it('おもちゃをタップしない32個のシード付き試行が、安全タイマーに頼らず全球得点確定する', () => {
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, { toyTapIntervalMs: null, boardConfig: candyBoard }),
    )
    const seconds = results.map((result) => result.durationSeconds).sort((a, b) => a - b)
    const median = (seconds[TRIAL_COUNT / 2 - 1] + seconds[TRIAL_COUNT / 2]) / 2
    const min = seconds[0]
    const max = seconds[seconds.length - 1]
    const mean = seconds.reduce((sum, value) => sum + value, 0) / seconds.length

    console.info(
      `candy board simulation (${TRIAL_COUNT} trials): min=${min.toFixed(3)}s median=${median.toFixed(3)}s mean=${mean.toFixed(3)}s max=${max.toFixed(3)}s`,
    )

    expect(results.every((result) => result.completed)).toBe(true)
    expect(results.every((result) => !result.usedSafetyTimeout)).toBe(true)
    // おかし盤面は当たり回数が多いぶん通常盤面より多少長くなってよいが、
    // 目安の10〜20秒に対して十分な余裕を持たせた上限にする（極端に長時間停滞しないこと）。
    expect(min).toBeGreaterThanOrEqual(3)
    expect(median).toBeGreaterThanOrEqual(7)
    expect(median).toBeLessThan(25)
    expect(max).toBeLessThan(40)
  })

  it('おもちゃを100ms間隔で連打しても、安全タイマーなしで全試行が完了する', () => {
    const results = Array.from({ length: RAPID_TAP_TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, {
        toyTapIntervalMs: RAPID_TAP_INTERVAL_MS,
        boardConfig: candyBoard,
      }),
    )
    const seconds = results.map((result) => result.durationSeconds).sort((a, b) => a - b)
    const max = seconds[seconds.length - 1]

    expect(results.every((result) => result.completed)).toBe(true)
    expect(results.every((result) => !result.usedSafetyTimeout)).toBe(true)
    expect(results.every((result) => result.steps * STEP_MS === result.durationMs)).toBe(true)
    // 安全タイマー(45秒)より短い範囲であることの緩い境界確認。
    expect(max).toBeLessThan(44)
  })

  it('3球が時間差射出のあいだ同時に盤面上へ存在する（射出間隔は通常テーマと共通のため）', () => {
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, { toyTapIntervalMs: null, boardConfig: candyBoard }),
    )
    expect(results.every((result) => result.maxConcurrentBalls > 1)).toBe(true)
  })

  it('scoredZoneIdsが球数と一致し、すべて既知のゾーンIDになる', () => {
    const knownZoneIds = new Set(SCORE_ZONES.map((zone) => zone.id))
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, { toyTapIntervalMs: null, boardConfig: candyBoard }),
    )

    for (const result of results) {
      expect(result.scoredZoneIds).toHaveLength(SIMULATION_BALL_COUNT)
      expect(result.scoredZoneIds.every((zoneId) => knownZoneIds.has(zoneId))).toBe(true)
    }
  })

  it('5つの得点ゾーンすべてに実際にボールが入る（明確なデッドスペースがないこと）', () => {
    // 1000点ゾーンは意図的にレア寄りのままでよいが、十分な試行数の中で一度も入らない
    // ゾーンが残っていないかを確認する（複数のシード範囲で確認し、1つの乱数列だけに
    // 依存する偶然の結果でないようにする）。
    const seedBases = [SEED_BASE, 0x9a8b7c6d, 0x55aa77bb]
    const zoneCounts = new Map<string, number>(SCORE_ZONES.map((zone) => [zone.id, 0]))
    for (const seedBase of seedBases) {
      const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
        simulatePinballRun(seedBase + index * SEED_STEP, { toyTapIntervalMs: null, boardConfig: candyBoard }),
      )
      for (const result of results) {
        for (const zoneId of result.scoredZoneIds) {
          zoneCounts.set(zoneId, (zoneCounts.get(zoneId) ?? 0) + 1)
        }
      }
    }

    for (const zone of SCORE_ZONES) {
      expect(zoneCounts.get(zone.id)).toBeGreaterThan(0)
    }
  })
})

describe('pinball 空盤面（skyBoard）のシミュレーション', () => {
  it('おもちゃをタップしない32個のシード付き試行が、安全タイマーに頼らず全球得点確定する', () => {
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, { toyTapIntervalMs: null, boardConfig: skyBoard }),
    )
    const seconds = results.map((result) => result.durationSeconds).sort((a, b) => a - b)
    const median = (seconds[TRIAL_COUNT / 2 - 1] + seconds[TRIAL_COUNT / 2]) / 2
    const min = seconds[0]
    const max = seconds[seconds.length - 1]
    const mean = seconds.reduce((sum, value) => sum + value, 0) / seconds.length

    console.info(
      `sky board simulation (${TRIAL_COUNT} trials): min=${min.toFixed(3)}s median=${median.toFixed(3)}s mean=${mean.toFixed(3)}s max=${max.toFixed(3)}s`,
    )

    expect(results.every((result) => result.completed)).toBe(true)
    expect(results.every((result) => !result.usedSafetyTimeout)).toBe(true)
    // 空テーマは広い空間・風による滞空感を狙っているため他テーマよりやや長くなってよいが、
    // 目安の10〜20秒に対して十分な余裕を持たせた上限にする（数秒での直落ち・永久滞空を防ぐ）。
    expect(min).toBeGreaterThanOrEqual(3)
    expect(median).toBeGreaterThanOrEqual(7)
    expect(median).toBeLessThan(25)
    expect(max).toBeLessThan(40)
  })

  it('おもちゃを100ms間隔で連打しても、安全タイマーなしで全試行が完了する', () => {
    const results = Array.from({ length: RAPID_TAP_TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, {
        toyTapIntervalMs: RAPID_TAP_INTERVAL_MS,
        boardConfig: skyBoard,
      }),
    )
    const seconds = results.map((result) => result.durationSeconds).sort((a, b) => a - b)
    const max = seconds[seconds.length - 1]

    expect(results.every((result) => result.completed)).toBe(true)
    expect(results.every((result) => !result.usedSafetyTimeout)).toBe(true)
    expect(results.every((result) => result.steps * STEP_MS === result.durationMs)).toBe(true)
    // 安全タイマー(45秒)より短い範囲であることの緩い境界確認。
    expect(max).toBeLessThan(44)
  })

  it('3球が時間差射出のあいだ同時に盤面上へ存在する（射出間隔は通常テーマと共通のため）', () => {
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, { toyTapIntervalMs: null, boardConfig: skyBoard }),
    )
    expect(results.every((result) => result.maxConcurrentBalls > 1)).toBe(true)
  })

  it('scoredZoneIdsが球数と一致し、すべて既知のゾーンIDになる', () => {
    const knownZoneIds = new Set(SCORE_ZONES.map((zone) => zone.id))
    const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
      simulatePinballRun(SEED_BASE + index * SEED_STEP, { toyTapIntervalMs: null, boardConfig: skyBoard }),
    )

    for (const result of results) {
      expect(result.scoredZoneIds).toHaveLength(SIMULATION_BALL_COUNT)
      expect(result.scoredZoneIds.every((zoneId) => knownZoneIds.has(zoneId))).toBe(true)
    }
  })

  it('5つの得点ゾーンすべてに実際にボールが入る（風の向きが一方へ偏りすぎていないこと）', () => {
    // 1000点ゾーンは意図的にレア寄りのままでよいが、十分な試行数の中で一度も入らない
    // ゾーンが残っていないかを確認する（複数のシード範囲で確認し、1つの乱数列だけに
    // 依存する偶然の結果でないようにする）。
    const seedBases = [SEED_BASE, 0x9a8b7c6d, 0x55aa77bb]
    const zoneCounts = new Map<string, number>(SCORE_ZONES.map((zone) => [zone.id, 0]))
    for (const seedBase of seedBases) {
      const results = Array.from({ length: TRIAL_COUNT }, (_, index) =>
        simulatePinballRun(seedBase + index * SEED_STEP, { toyTapIntervalMs: null, boardConfig: skyBoard }),
      )
      for (const result of results) {
        for (const zoneId of result.scoredZoneIds) {
          zoneCounts.set(zoneId, (zoneCounts.get(zoneId) ?? 0) + 1)
        }
      }
    }

    console.info(
      'sky board zone distribution:',
      SCORE_ZONES.map((zone) => `${zone.id}(${zone.score})=${zoneCounts.get(zone.id)}`).join(' '),
    )

    for (const zone of SCORE_ZONES) {
      expect(zoneCounts.get(zone.id)).toBeGreaterThan(0)
    }
  })
})

describe('pinball 全射出モードのシミュレーション', () => {
  it('40球・800ms間隔でも全球が得点確定し、安全タイマーに頼らない', () => {
    const ballCount = PINBALL_FLAG_IDS.length
    const result = simulatePinballRun(0x2468ace0, {
      ballCount,
      launchDelaysMs: launchDelaysMs('allFlags', ballCount),
      mode: 'allFlags',
    })

    expect(result.completed).toBe(true)
    expect(result.usedSafetyTimeout).toBe(false)
    expect(result.scoreSteps).toHaveLength(ballCount)
    // 射出間隔どおりに時間差で射出されるため、常に何球かは同時に盤面上にいる
    // （1球だけが順番に進んでいくわけではない）ことを確認する。
    expect(result.maxConcurrentBalls).toBeGreaterThan(1)
    expect(result.maxConcurrentBalls).toBeLessThanOrEqual(ballCount)
    expect(ALL_FLAGS_LAUNCH_INTERVAL_MS).toBeGreaterThan(0)
  })
})
