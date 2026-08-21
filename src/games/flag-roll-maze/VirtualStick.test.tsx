import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import VirtualStick from './VirtualStick'
import { NEUTRAL_TILT } from './tiltInput'

/** 中心(60,60)・半径60のスティックとして測定させるためのモック矩形。 */
function stubStickRect(element: HTMLElement) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    width: 120,
    height: 120,
    left: 0,
    top: 0,
    right: 120,
    bottom: 120,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
}

function renderStick(onTiltChange = vi.fn(), disabled = false) {
  render(<VirtualStick onTiltChange={onTiltChange} disabled={disabled} />)
  const base = screen.getByTestId('virtual-stick')
  stubStickRect(base)
  return { onTiltChange, base, knob: screen.getByTestId('virtual-stick-knob') }
}

describe('VirtualStick', () => {
  test('中心より右へドラッグするとx>0・y≈0の傾きになる', () => {
    const { onTiltChange, base } = renderStick()

    fireEvent.pointerDown(base, { pointerId: 1, clientX: 100, clientY: 60 })

    const tilt = onTiltChange.mock.calls.at(-1)?.[0]
    expect(tilt.x).toBeGreaterThan(0)
    expect(tilt.y).toBeCloseTo(0, 5)
  })

  test('画面の上方向へドラッグするとy<0の傾きになる（下がプラスの符号規約）', () => {
    const { onTiltChange, base } = renderStick()

    fireEvent.pointerDown(base, { pointerId: 1, clientX: 60, clientY: 20 })

    const tilt = onTiltChange.mock.calls.at(-1)?.[0]
    expect(tilt.y).toBeLessThan(0)
  })

  test('半径を大きく超えて引いても傾きの大きさは1を超えない', () => {
    const { onTiltChange, base } = renderStick()

    fireEvent.pointerDown(base, { pointerId: 1, clientX: 60, clientY: 60 })
    fireEvent.pointerMove(base, { pointerId: 1, clientX: 660, clientY: 660 })

    const tilt = onTiltChange.mock.calls.at(-1)?.[0]
    expect(Math.hypot(tilt.x, tilt.y)).toBeLessThanOrEqual(1 + 1e-9)
  })

  test('デッドゾーン内のわずかな移動ではNEUTRAL_TILTのまま、ノブだけ見た目が動く', () => {
    const { onTiltChange, base, knob } = renderStick()

    // 半径60に対して5pxはデッドゾーン(0.18)の内側。
    fireEvent.pointerDown(base, { pointerId: 1, clientX: 65, clientY: 60 })

    const tilt = onTiltChange.mock.calls.at(-1)?.[0]
    expect(tilt).toEqual(NEUTRAL_TILT)
    expect(knob.style.transform).not.toBe('translate(0px, 0px)')
  })

  test('指を離すとNEUTRAL_TILTを1回通知し、ノブは中央へ戻る', () => {
    const { onTiltChange, base, knob } = renderStick()

    fireEvent.pointerDown(base, { pointerId: 1, clientX: 100, clientY: 100 })
    onTiltChange.mockClear()
    fireEvent.pointerUp(base, { pointerId: 1, clientX: 100, clientY: 100 })

    expect(onTiltChange).toHaveBeenCalledTimes(1)
    expect(onTiltChange).toHaveBeenCalledWith(NEUTRAL_TILT)
    expect(knob.style.transform).toBe('translate(0px, 0px)')
  })

  test('disabledのときはpointerdownを押しても何も通知しない', () => {
    const { onTiltChange, base } = renderStick(vi.fn(), true)

    fireEvent.pointerDown(base, { pointerId: 1, clientX: 100, clientY: 100 })

    expect(onTiltChange).not.toHaveBeenCalled()
  })
})
