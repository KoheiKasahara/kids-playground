import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PukupukaFaucet from './PukupukaFaucet'
import type { FaucetDefinition } from './types'

const faucet: FaucetDefinition = { id: 'main-faucet', targetBodyId: 'main', x: 38, y: 10 }

describe('PukupukaFaucet', () => {
  test('OFFのときは水の線を出さない', () => {
    render(
      <svg>
        <PukupukaFaucet
          faucet={faucet}
          active={false}
          disabled={false}
          surfaceY={112}
          onHoldStart={() => {}}
          onHoldEnd={() => {}}
          onTap={() => {}}
        />
      </svg>,
    )

    expect(screen.getByTestId('pukupuka-faucet')).toHaveAttribute('data-faucet-active', 'false')
    expect(screen.queryByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  test('ONのときはaria-pressedがtrueになり、水面が吐水口より下にあれば水の線を出す', () => {
    const { container } = render(
      <svg>
        <PukupukaFaucet
          faucet={faucet}
          active={true}
          disabled={false}
          surfaceY={112}
          onHoldStart={() => {}}
          onHoldEnd={() => {}}
          onTap={() => {}}
        />
      </svg>,
    )

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelector('line')).not.toBeNull()
  })

  test('水面が吐水口より上（満水近く）のときは水の線を出さない', () => {
    const { container } = render(
      <svg>
        <PukupukaFaucet
          faucet={faucet}
          active={true}
          disabled={false}
          surfaceY={faucet.y}
          onHoldStart={() => {}}
          onHoldEnd={() => {}}
          onTap={() => {}}
        />
      </svg>,
    )

    expect(container.querySelector('line')).toBeNull()
  })

  test('押しはじめでonHoldStart、離すとonHoldEndが呼ばれる（ポインタ操作は二重発火しない）', () => {
    const onHoldStart = vi.fn()
    const onHoldEnd = vi.fn()
    const onTap = vi.fn()

    render(
      <svg>
        <PukupukaFaucet
          faucet={faucet}
          active={false}
          disabled={false}
          surfaceY={112}
          onHoldStart={onHoldStart}
          onHoldEnd={onHoldEnd}
          onTap={onTap}
        />
      </svg>,
    )

    const button = screen.getByRole('button')
    fireEvent.pointerDown(button)
    fireEvent.pointerUp(button)
    fireEvent.click(button)

    expect(onHoldStart).toHaveBeenCalledTimes(1)
    expect(onHoldEnd).toHaveBeenCalledTimes(1)
    expect(onTap).not.toHaveBeenCalled()
  })

  test('キーボード操作（pointerを介さないclick）はonTapを1回だけ呼ぶ', () => {
    const onHoldStart = vi.fn()
    const onTap = vi.fn()

    render(
      <svg>
        <PukupukaFaucet
          faucet={faucet}
          active={false}
          disabled={false}
          surfaceY={112}
          onHoldStart={onHoldStart}
          onHoldEnd={() => {}}
          onTap={onTap}
        />
      </svg>,
    )

    fireEvent.click(screen.getByRole('button'))

    expect(onTap).toHaveBeenCalledTimes(1)
    expect(onHoldStart).not.toHaveBeenCalled()
  })

  test('disabledのときは押せない', () => {
    render(
      <svg>
        <PukupukaFaucet
          faucet={faucet}
          active={false}
          disabled={true}
          surfaceY={112}
          onHoldStart={() => {}}
          onHoldEnd={() => {}}
          onTap={() => {}}
        />
      </svg>,
    )

    expect(screen.getByRole('button')).toBeDisabled()
  })
})
