import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canVibrate, createBowlingHaptics } from './bowlingHaptics'

function setVibrateSupport(supported: boolean): void {
  Object.defineProperty(navigator, 'vibrate', {
    value: supported ? vi.fn(() => true) : undefined,
    writable: true,
    configurable: true,
  })
}

function setReducedMotion(reduced: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reduced && query === '(prefers-reduced-motion: reduce)',
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  })
}

describe('canVibrate', () => {
  afterEach(() => {
    setVibrateSupport(false)
  })

  it('navigator.vibrateが関数のときtrue', () => {
    setVibrateSupport(true)
    expect(canVibrate()).toBe(true)
  })

  it('navigator.vibrateが無い（非対応）ときfalse', () => {
    setVibrateSupport(false)
    expect(canVibrate()).toBe(false)
  })
})

describe('createBowlingHaptics', () => {
  beforeEach(() => {
    setReducedMotion(false)
  })

  afterEach(() => {
    setVibrateSupport(false)
    setReducedMotion(false)
    vi.useRealTimers()
  })

  it('非対応環境でも例外を投げず、vibrateを呼ばない', () => {
    setVibrateSupport(false)
    const haptics = createBowlingHaptics()
    expect(() => haptics.launch()).not.toThrow()
    expect(() => haptics.impact(1)).not.toThrow()
    expect(() => haptics.perfect()).not.toThrow()
    haptics.dispose()
  })

  it('対応環境ではlaunchで短い振動(10ms)が呼ばれる', () => {
    setVibrateSupport(true)
    const haptics = createBowlingHaptics()
    haptics.launch()
    expect(navigator.vibrate).toHaveBeenCalledWith(10)
    haptics.dispose()
  })

  it('impactはstrengthが0.5未満のとき振動しない（弱い当たりでは震わせない）', () => {
    setVibrateSupport(true)
    const haptics = createBowlingHaptics()
    haptics.impact(0.2)
    expect(navigator.vibrate).not.toHaveBeenCalled()
    haptics.dispose()
  })

  it('impactはstrengthが0.5以上のとき15〜25msの範囲で振動する', () => {
    setVibrateSupport(true)
    const haptics = createBowlingHaptics()
    haptics.impact(1)
    expect(navigator.vibrate).toHaveBeenCalledTimes(1)
    const vibrateMock = navigator.vibrate as ReturnType<typeof vi.fn>
    const ms = vibrateMock.mock.calls[0]![0] as number
    expect(ms).toBeGreaterThanOrEqual(15)
    expect(ms).toBeLessThanOrEqual(25)
    haptics.dispose()
  })

  it('perfectは[14, 60, 26]のパターンで振動する', () => {
    setVibrateSupport(true)
    const haptics = createBowlingHaptics()
    haptics.perfect()
    expect(navigator.vibrate).toHaveBeenCalledWith([14, 60, 26])
    haptics.dispose()
  })

  it('クールダウン未満の連続衝突では振動しっぱなしにしない', () => {
    setVibrateSupport(true)
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const haptics = createBowlingHaptics()
    haptics.impact(1)
    vi.setSystemTime(50)
    haptics.impact(1)
    expect(navigator.vibrate).toHaveBeenCalledTimes(1)
    vi.setSystemTime(200)
    haptics.impact(1)
    expect(navigator.vibrate).toHaveBeenCalledTimes(2)
    haptics.dispose()
  })

  it('prefers-reduced-motionのときは対応環境でも振動しない', () => {
    setVibrateSupport(true)
    setReducedMotion(true)
    const haptics = createBowlingHaptics()
    haptics.launch()
    haptics.impact(1)
    haptics.perfect()
    expect(navigator.vibrate).not.toHaveBeenCalled()
    haptics.dispose()
  })

  it('disposeで鳴っている振動を止め、そのあとは呼び出しても振動しない', () => {
    setVibrateSupport(true)
    const haptics = createBowlingHaptics()
    haptics.dispose()
    // 画面を離れたあとに振動が残らないよう、停止(0)だけは送る。
    expect(navigator.vibrate).toHaveBeenCalledTimes(1)
    expect(navigator.vibrate).toHaveBeenCalledWith(0)
    haptics.launch()
    haptics.impact(1)
    haptics.perfect()
    // 停止の1回きりで、以降の演出ぶんは1回も増えない。
    expect(navigator.vibrate).toHaveBeenCalledTimes(1)
  })

  it('vibrateが例外を投げる端末でも、呼び出し側には伝播しない', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: vi.fn(() => {
        throw new Error('拒否された')
      }),
      writable: true,
      configurable: true,
    })
    const haptics = createBowlingHaptics()
    expect(() => haptics.launch()).not.toThrow()
    haptics.dispose()
  })
})
