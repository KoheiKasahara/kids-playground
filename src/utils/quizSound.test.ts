import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

/**
 * jsdom には Web Audio API が実装されていないため、
 * オシレーター/ゲインノードの生成・再生呼び出しだけを最小限に模したモックを window に生やして検証する。
 * quizSound.ts は AudioContext を1つだけ使い回す実装のため、
 * テストごとに vi.resetModules() でモジュール内の状態をリセットしてから読み込み直す。
 */

class MockOscillatorNode {
  type = 'sine'
  frequency = { value: 0 }
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class MockGainNode {
  gain = {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  }
  connect = vi.fn()
}

let instances: MockAudioContext[] = []

class MockAudioContext {
  currentTime = 0
  state: 'running' | 'suspended' = 'running'
  resume = vi.fn().mockResolvedValue(undefined)
  createOscillator = vi.fn(() => new MockOscillatorNode())
  createGain = vi.fn(() => new MockGainNode())
  destination = {}

  constructor() {
    instances.push(this)
  }
}

describe('quizSound', () => {
  const originalAudioContext = (window as unknown as { AudioContext?: unknown }).AudioContext

  beforeEach(() => {
    instances = []
  })

  afterEach(() => {
    ;(window as unknown as { AudioContext?: unknown }).AudioContext = originalAudioContext
    vi.resetModules()
  })

  test('playCorrectSound は「ピンポーン」の2音を鳴らす', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playCorrectSound } = await import('./quizSound')

    playCorrectSound()

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(2)
  })

  test('playIncorrectSound は「ブブー」の2音を鳴らす', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playIncorrectSound } = await import('./quizSound')

    playIncorrectSound()

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(2)
  })

  test('playColorMixSound は短い混ざる音を2音鳴らす', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playColorMixSound } = await import('./quizSound')

    playColorMixSound()

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(2)
  })

  test('AudioContext 非対応環境では例外を投げず何もしない', async () => {
    ;(window as unknown as { AudioContext?: unknown }).AudioContext = undefined
    vi.resetModules()
    const {
      playCorrectSound,
      playIncorrectSound,
      playDominoTickSound,
      playDominoCompleteSound,
      playMazeWallHitSound,
      playMazeStarSound,
      playMazeGoalSound,
      playCarDepartureSound,
      playCarGoalSound,
      createCarRoadSoundController,
      playKomaBattleStartSound,
      createKomaBattleSoundController,
    } = await import('./quizSound')

    expect(() => playCorrectSound()).not.toThrow()
    expect(() => playIncorrectSound()).not.toThrow()
    expect(() => playDominoTickSound(0.5)).not.toThrow()
    expect(() => playDominoCompleteSound()).not.toThrow()
    expect(() => playMazeWallHitSound(0.5)).not.toThrow()
    expect(() => playMazeStarSound(0)).not.toThrow()
    expect(() => playMazeGoalSound()).not.toThrow()
    expect(() => playCarDepartureSound()).not.toThrow()
    expect(() => playCarGoalSound()).not.toThrow()
    expect(() => createCarRoadSoundController().setRunning(true)).not.toThrow()
    expect(() => playKomaBattleStartSound()).not.toThrow()
    expect(() => createKomaBattleSoundController().updateSpin(70)).not.toThrow()
    expect(instances).toHaveLength(0)
  })

  test('primeAudio は AudioContext を作成する（iOS対策で操作イベント内から先に用意する用）', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { primeAudio } = await import('./quizSound')

    primeAudio()

    expect(instances).toHaveLength(1)
  })

  test('playPanelOpenSound はオシレーターを1つ生成し、600Hz〜1kHz帯の音を鳴らす', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playPanelOpenSound } = await import('./quizSound')

    playPanelOpenSound()

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(1)
    const oscillator = instances[0].createOscillator.mock.results[0].value as MockOscillatorNode
    expect(oscillator.frequency.value).toBeGreaterThanOrEqual(600)
    expect(oscillator.frequency.value).toBeLessThanOrEqual(1000)
  })

  test('playGlobeCountrySelectSound は短い上行2音を鳴らし、クールダウン内では重ねない', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playGlobeCountrySelectSound } = await import('./quizSound')

    playGlobeCountrySelectSound()
    playGlobeCountrySelectSound()

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(2)
    const first = instances[0].createOscillator.mock.results[0].value as MockOscillatorNode
    const second = instances[0].createOscillator.mock.results[1].value as MockOscillatorNode
    expect(second.frequency.value).toBeGreaterThan(first.frequency.value)
  })

  test('playPanelRevealSound は step が進むほど周波数が高くなる', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playPanelRevealSound } = await import('./quizSound')

    playPanelRevealSound(1, 5)
    playPanelRevealSound(3, 5)

    const first = instances[0].createOscillator.mock.results[0].value as MockOscillatorNode
    const third = instances[0].createOscillator.mock.results[1].value as MockOscillatorNode
    expect(third.frequency.value).toBeGreaterThan(first.frequency.value)
  })

  test('playPanelRevealSound は最後の1枚(step === total)で、その手前より高い音を鳴らす', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playPanelRevealSound } = await import('./quizSound')

    playPanelRevealSound(4, 5)
    playPanelRevealSound(5, 5)

    const secondLast = instances[0].createOscillator.mock.results[0].value as MockOscillatorNode
    const last = instances[0].createOscillator.mock.results[1].value as MockOscillatorNode
    expect(last.frequency.value).toBeGreaterThan(secondLast.frequency.value)
  })

  test('playPanelRevealSound は残り枚数が多くても（残り15枚）甲高くなりすぎない（全て1500Hz以下）', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playPanelRevealSound } = await import('./quizSound')

    const total = 15
    for (let step = 1; step <= total; step += 1) {
      playPanelRevealSound(step, total)
    }

    expect(instances[0].createOscillator).toHaveBeenCalledTimes(total)
    for (let i = 0; i < total; i += 1) {
      const oscillator = instances[0].createOscillator.mock.results[i].value as MockOscillatorNode
      expect(oscillator.frequency.value).toBeLessThanOrEqual(1500)
    }
  })

  test('setSoundEnabled(false) の間は AudioContext を作らず、どの音も鳴らない', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const {
      playPanelOpenSound,
      playPanelRevealSound,
      playCorrectSound,
      playDominoTickSound,
      playDominoCompleteSound,
      playMazeWallHitSound,
      playMazeStarSound,
      playMazeGoalSound,
      setSoundEnabled,
      isSoundEnabled,
    } = await import('./quizSound')

    setSoundEnabled(false)
    expect(isSoundEnabled()).toBe(false)

    playPanelOpenSound()
    playPanelRevealSound(1, 3)
    playCorrectSound()
    playDominoTickSound(1)
    playDominoCompleteSound()
    playMazeWallHitSound(1)
    playMazeStarSound(0)
    playMazeGoalSound()

    expect(instances).toHaveLength(0)
  })

  test('こっきドミノの倒伏音は2音、完成音は上行5音を鳴らす', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playDominoTickSound, playDominoCompleteSound } = await import('./quizSound')

    playDominoTickSound(1.5)
    playDominoCompleteSound()

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(7)
  })

  test('こっきころころめいろの壁・星・ゴール音は規定本数だけ鳴らす', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const {
      playMazeWallHitSound,
      playMazeStarSound,
      playMazeGoalSound,
    } = await import('./quizSound')

    playMazeWallHitSound(0.5)
    playMazeStarSound(0)
    playMazeGoalSound()

    expect(instances).toHaveLength(1)
    // 壁1音、星2音、ゴール4音。連続衝突用の壁音もオシレーターを増やしすぎない。
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(7)
  })

  test('playPinballLaunchSound は低→高の2音を鳴らす', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playPinballLaunchSound } = await import('./quizSound')

    playPinballLaunchSound()

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(2)
    const first = instances[0].createOscillator.mock.results[0].value as MockOscillatorNode
    const second = instances[0].createOscillator.mock.results[1].value as MockOscillatorNode
    expect(second.frequency.value).toBeGreaterThan(first.frequency.value)
  })

  test('playPinballBumperSound はクールダウン内での2回目を鳴らさない', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playPinballBumperSound } = await import('./quizSound')

    playPinballBumperSound()
    playPinballBumperSound()

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(1)
  })

  test('playPinballScoreSound は得点が高いほど高い音を鳴らす', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playPinballScoreSound } = await import('./quizSound')

    playPinballScoreSound(100)
    playPinballScoreSound(1000)

    const low = instances[0].createOscillator.mock.results[0].value as MockOscillatorNode
    const high = instances[0].createOscillator.mock.results[1].value as MockOscillatorNode
    expect(high.frequency.value).toBeGreaterThan(low.frequency.value)
  })

  test('playPinballTotalSound はペンタトニックで3音鳴らす', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playPinballTotalSound } = await import('./quizSound')

    playPinballTotalSound()

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(3)
  })

  test('サウンドOFFのときピンボール系の音はどれも鳴らさない', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const {
      playPinballLaunchSound,
      playPinballBumperSound,
      playPinballScoreSound,
      playPinballTotalSound,
      setSoundEnabled,
    } = await import('./quizSound')

    setSoundEnabled(false)

    playPinballLaunchSound()
    playPinballBumperSound()
    playPinballScoreSound(1000)
    playPinballTotalSound()

    expect(instances).toHaveLength(0)
  })

  test('コマバトルの開始音は低音から高音へ2音で鳴る', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playKomaBattleStartSound } = await import('./quizSound')

    playKomaBattleStartSound()

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(2)
    const first = instances[0].createOscillator.mock.results[0].value as MockOscillatorNode
    const second = instances[0].createOscillator.mock.results[1].value as MockOscillatorNode
    expect(second.frequency.value).toBeGreaterThan(first.frequency.value)
  })

  test('コマバトルの回転音は1組のノードを速度更新で再利用し、停止・disposeできる', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { createKomaBattleSoundController } = await import('./quizSound')

    const controller = createKomaBattleSoundController()
    controller.startSpin()
    controller.updateSpin(75)
    controller.updateSpin(24)
    controller.setSuspended(true)
    controller.updateSpin(75)
    controller.setSuspended(false)
    controller.updateSpin(12)

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(1)
    expect(instances[0].createGain).toHaveBeenCalledTimes(1)
    const oscillator = instances[0].createOscillator.mock.results[0].value as MockOscillatorNode
    expect(oscillator.frequency.value).toBeGreaterThan(78)

    controller.stopSpin()
    controller.dispose()
    controller.dispose()
    controller.updateSpin(75)
    expect(oscillator.stop).toHaveBeenCalledTimes(1)
  })

  test('コマバトルの衝突音は強いコマ衝突だけ薄い高音を重ね、結果音を1回に抑える', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { createKomaBattleSoundController } = await import('./quizSound')

    const controller = createKomaBattleSoundController()
    controller.playImpact('koma', 1)
    controller.playImpact('koma', 1)

    expect(instances).toHaveLength(1)
    // 強い衝突は本体音+薄い高音、直後の2回目はcooldownで抑制する。
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(2)
    controller.playVictory()
    controller.playVictory()
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(6)
    controller.dispose()
  })

  test('コマバトルの結果音はdisposeで予約分も停止し、再戦へ持ち越さない', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { createKomaBattleSoundController } = await import('./quizSound')

    const controller = createKomaBattleSoundController()
    controller.playVictory()
    const resultTones = instances[0].createOscillator.mock.results.map(
      (result) => result.value as MockOscillatorNode,
    )

    controller.dispose()

    expect(resultTones).toHaveLength(4)
    // 1回目は終了時刻の予約、2回目はdisposeによる途中停止。
    resultTones.forEach((tone) => expect(tone.stop).toHaveBeenCalledTimes(2))
    controller.playVictory()
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(4)
  })

  test('コマバトルの場外・転倒・停止をそれぞれ下降音で聞き分けられる', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { createKomaBattleSoundController } = await import('./quizSound')

    const outController = createKomaBattleSoundController()
    const toppledController = createKomaBattleSoundController()
    const stoppedController = createKomaBattleSoundController()
    outController.playDefeat('outOfArena')
    toppledController.playDefeat('toppled')
    stoppedController.playDefeat('stopped')

    const frequencies = instances[0].createOscillator.mock.results.map(
      (result) => (result.value as MockOscillatorNode).frequency.value,
    )
    expect(frequencies).toEqual([250, 145, 230, 135, 190, 120])
    outController.dispose()
    toppledController.dispose()
    stoppedController.dispose()
  })

  test('レールの4種類のone-shotは規定本数だけ鳴る', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const {
      playRailSnapSound,
      playRailDepartureSound,
      playRailStationStopSound,
      playRailStationDepartureSound,
    } = await import('./quizSound')

    playRailSnapSound()
    playRailDepartureSound()
    playRailStationStopSound()
    playRailStationDepartureSound()

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(7)
  })

  test('レール走行音は1組だけ生成し、停止・disposeできる', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { createRailTrainSoundController } = await import('./quizSound')

    const controller = createRailTrainSoundController()
    controller.update(1.2, 'running')
    controller.update(2.4, 'running')
    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(1)
    expect(instances[0].createGain).toHaveBeenCalledTimes(1)
    controller.update(0, 'stoppedAtStation')
    const gainNode = instances[0].createGain.mock.results[0].value as MockGainNode
    const stopRampCount = gainNode.gain.linearRampToValueAtTime.mock.calls.length
    const stopRamp = gainNode.gain.linearRampToValueAtTime.mock.lastCall
    expect(stopRamp?.[0]).toBe(0)
    controller.update(0, 'stoppedAtStation')
    expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledTimes(stopRampCount)
    controller.dispose()
    expect((instances[0].createOscillator.mock.results[0].value as MockOscillatorNode).stop).toHaveBeenCalledTimes(1)
    expect(() => controller.update(1, 'running')).not.toThrow()
  })

  test('くるまの出発音と走行音は、再走行しても音源を重ねず停止できる', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playCarDepartureSound, createCarRoadSoundController } = await import('./quizSound')

    playCarDepartureSound()
    playCarDepartureSound()
    const controller = createCarRoadSoundController()
    controller.setRunning(true)
    controller.setRunning(true)
    controller.setRunning(false)
    controller.setRunning(true)

    expect(instances).toHaveLength(1)
    // 出発音2音 + 走行音1音。出発音はクールダウンで間引き、走行の再開では同じ音源を再利用する。
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(3)
    expect(instances[0].createGain).toHaveBeenCalledTimes(3)
    const drivingGain = instances[0].createGain.mock.results[2].value as MockGainNode
    expect(drivingGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.045)

    controller.dispose()
    expect((instances[0].createOscillator.mock.results[2].value as MockOscillatorNode).stop).toHaveBeenCalledTimes(1)
  })

  test('くるまのゴール音は短い3音で、短時間の重複再生を抑える', async () => {
    ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContext
    vi.resetModules()
    const { playCarGoalSound } = await import('./quizSound')

    playCarGoalSound()
    playCarGoalSound()

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(3)
  })

  test('くるま用SEはAudio APIの失敗をゲーム側へ投げない', async () => {
    class BrokenAudioContext {
      currentTime = 0
      state = 'running' as const
      destination = {}
      createOscillator(): never { throw new Error('audio unavailable') }
      createGain(): never { throw new Error('audio unavailable') }
    }

    ;(window as unknown as { AudioContext: unknown }).AudioContext = BrokenAudioContext
    vi.resetModules()
    const { playCarDepartureSound, createCarRoadSoundController } = await import('./quizSound')
    const controller = createCarRoadSoundController()

    expect(() => playCarDepartureSound()).not.toThrow()
    expect(() => controller.setRunning(true)).not.toThrow()
    expect(() => controller.dispose()).not.toThrow()
  })

  test('レール音もAudioContext非対応環境では例外を投げない', async () => {
    ;(window as unknown as { AudioContext?: unknown }).AudioContext = undefined
    vi.resetModules()
    const {
      playRailSnapSound,
      playRailDepartureSound,
      createRailTrainSoundController,
    } = await import('./quizSound')

    const controller = createRailTrainSoundController()
    expect(() => playRailSnapSound()).not.toThrow()
    expect(() => playRailDepartureSound()).not.toThrow()
    expect(() => controller.update(1, 'running')).not.toThrow()
    expect(() => controller.dispose()).not.toThrow()
  })
})
