import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlagRollMazeSelect from './FlagRollMazeSelect'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

describe('FlagRollMazeSelect', () => {
  beforeEach(() => navigateMock.mockClear())

  it('75個の国旗から1つだけを選べる', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <FlagRollMazeSelect />
      </MemoryRouter>,
    )

    const flags = screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-pressed'))
    expect(flags).toHaveLength(75)
    expect(screen.getByRole('button', { name: 'スタート！' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'にほん' }))
    expect(screen.getByRole('button', { name: 'にほん' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'かんこく' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'スタート！' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'かんこく' }))
    expect(screen.getByRole('button', { name: 'にほん' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'かんこく' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('選んだ国旗をstateに入れてプレイへ進む', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <FlagRollMazeSelect />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'にほん' }))
    await user.click(screen.getByRole('button', { name: 'スタート！' }))

    expect(navigateMock).toHaveBeenCalledWith('/games/flag-roll-maze/play', { state: { flagId: 'jp' } })
  })
})
