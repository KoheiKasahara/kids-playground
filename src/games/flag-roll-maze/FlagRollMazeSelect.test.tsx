import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlagRollMazeSelect from './FlagRollMazeSelect'
import { DEFAULT_MAZE_STAGE_ID, MAZE_STAGES } from './mazeStages'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

function stageButton(stage: (typeof MAZE_STAGES)[number]) {
  return screen.getByRole('button', { name: new RegExp(stage.nameJa) })
}

describe('FlagRollMazeSelect', () => {
  beforeEach(() => navigateMock.mockClear())

  it('75個の国旗から1つだけを選べ、未選択ではつぎへ進めない', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <FlagRollMazeSelect />
      </MemoryRouter>,
    )

    const flags = screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-pressed'))
    expect(flags).toHaveLength(75)
    expect(screen.getByRole('button', { name: 'つぎへ' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'にほん' }))
    expect(screen.getByRole('button', { name: 'にほん' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'かんこく' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'つぎへ' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'かんこく' }))
    expect(screen.getByRole('button', { name: 'にほん' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'かんこく' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('国旗の次にカタログどおりのステージ一覧を出す', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <FlagRollMazeSelect />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'にほん' }))
    await user.click(screen.getByRole('button', { name: 'つぎへ' }))

    const group = screen.getByRole('group', { name: 'ステージ' })
    expect(within(group).getAllByRole('button')).toHaveLength(MAZE_STAGES.length)
    for (const stage of MAZE_STAGES) {
      expect(within(group).getByText(stage.nameJa)).toBeInTheDocument()
      expect(within(group).getByText(stage.hintJa)).toBeInTheDocument()
    }

    const defaultStage = MAZE_STAGES.find((stage) => stage.id === DEFAULT_MAZE_STAGE_ID)!
    expect(stageButton(defaultStage)).toHaveAttribute('aria-pressed', 'true')
    for (const stage of MAZE_STAGES.filter((stage) => stage.id !== DEFAULT_MAZE_STAGE_ID)) {
      expect(stageButton(stage)).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('別のステージを押すと選択がちょうど1つ移る', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <FlagRollMazeSelect />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'にほん' }))
    await user.click(screen.getByRole('button', { name: 'つぎへ' }))
    const otherStage = MAZE_STAGES.find((stage) => stage.id !== DEFAULT_MAZE_STAGE_ID)!

    await user.click(stageButton(otherStage))

    expect(stageButton(otherStage)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  it('選んだ国旗とステージをstateに入れてプレイへ進む', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <FlagRollMazeSelect />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'にほん' }))
    await user.click(screen.getByRole('button', { name: 'つぎへ' }))
    const selectedStage = MAZE_STAGES.find((stage) => stage.id !== DEFAULT_MAZE_STAGE_ID)!
    await user.click(stageButton(selectedStage))
    await user.click(screen.getByRole('button', { name: 'スタート！' }))

    expect(navigateMock).toHaveBeenCalledWith('/games/flag-roll-maze/play', {
      state: { flagId: 'jp', stageId: selectedStage.id },
    })
  })

  it('アスレチックを選んでプレイへ進める', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <FlagRollMazeSelect />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'にほん' }))
    await user.click(screen.getByRole('button', { name: 'つぎへ' }))
    const athletic = MAZE_STAGES.find((stage) => stage.id === 'athletic')
    expect(athletic).toBeDefined()
    if (athletic === undefined) return

    expect(screen.getByText('アスレチック')).toBeInTheDocument()
    await user.click(stageButton(athletic))
    await user.click(screen.getByRole('button', { name: 'スタート！' }))

    expect(navigateMock).toHaveBeenCalledWith('/games/flag-roll-maze/play', {
      state: { flagId: 'jp', stageId: 'athletic' },
    })
  })

  it('こっきをかえるで国旗の選択を保ったまま前の手順へ戻る', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <FlagRollMazeSelect />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'にほん' }))
    await user.click(screen.getByRole('button', { name: 'つぎへ' }))
    await user.click(screen.getByRole('button', { name: 'こっきを かえる' }))

    expect(screen.getByText('こっきを 1こ えらんでね！')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'にほん' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'つぎへ' })).toBeEnabled()
  })
})
