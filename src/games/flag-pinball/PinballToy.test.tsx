import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import PinballToy from './PinballToy'
import { normalTheme } from './themes/normalTheme'
import { normalBoard } from './boardConfigs'

const toy = normalBoard.toys[0]

if (!toy) {
  throw new Error('flag-pinball: テスト対象のおもちゃがありません')
}

function renderToy(onActivate: (toyId: string) => void = vi.fn()) {
  render(
    <PinballToy
      toy={toy}
      theme={normalTheme}
      registerToy={() => () => {}}
      onActivate={onActivate}
    />,
  )

  return screen.getByRole('button', { name: toy.labelJa })
}

describe('PinballToy', () => {
  test('ポインタ由来のpointerdownとclickでは二重発動しない', () => {
    const onActivate = vi.fn()
    const button = renderToy(onActivate)

    fireEvent.pointerDown(button)
    fireEvent.click(button, { detail: 1 })

    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(onActivate).toHaveBeenCalledWith(toy.id)
  })

  test('キーボードのEnterとSpaceによるclickで発動する', async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()
    const button = renderToy(onActivate)
    button.focus()

    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(onActivate).toHaveBeenCalledTimes(2)
    expect(onActivate).toHaveBeenNthCalledWith(1, toy.id)
    expect(onActivate).toHaveBeenNthCalledWith(2, toy.id)
  })

  test('実機スケール0.70倍でもタップ領域は64px以上ある', () => {
    const button = renderToy()
    const logicalDiameter = toy.tapRadius * 2
    const practicalDiameter = logicalDiameter * 0.7

    expect(button.style.width).toBe(`${logicalDiameter}px`)
    expect(button.style.height).toBe(`${logicalDiameter}px`)
    expect(practicalDiameter).toBeGreaterThanOrEqual(64)
  })
})
