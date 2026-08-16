import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DominoEngineOptions } from './useDominoEngine'
import DominoFlagPlay from './DominoFlagPlay'
import { dominoFlags } from './flagDefinitions'

// WebGLとRapierはjsdomで動かさず、フックに渡された状態とコールバックだけを使って画面を検証する。
const engineMock = vi.hoisted(() => ({
  options: undefined as DominoEngineOptions | undefined,
  start: vi.fn(),
}))

vi.mock('./useDominoEngine', () => ({
  useDominoEngine: (options: DominoEngineOptions) => {
    engineMock.options = options
    return {
      registerContainer: () => undefined,
      start: engineMock.start,
    }
  },
}))

function renderPlay() {
  return render(
    <MemoryRouter initialEntries={['/games/domino-flag']}>
      <DominoFlagPlay />
    </MemoryRouter>,
  )
}

type User = ReturnType<typeof userEvent.setup>

async function chooseFlag(user: User, name: string) {
  await user.click(screen.getByRole('button', { name }))
  expect(screen.getByRole('status')).toHaveTextContent(`${name}の こっき！`)
}

async function chooseAmerica(user: User) {
  await chooseFlag(user, 'アメリカ')
}

async function completeAmerica(user: User) {
  await chooseAmerica(user)
  await user.click(screen.getByRole('button', { name: 'スタート！' }))
  expect(engineMock.options).toBeDefined()
  act(() => engineMock.options!.onComplete())
}

async function completeFlag(user: User, name: string) {
  await chooseFlag(user, name)
  await user.click(screen.getByRole('button', { name: 'スタート！' }))
  expect(engineMock.options).toBeDefined()
  act(() => engineMock.options!.onComplete())
}

afterEach(() => {
  engineMock.options = undefined
  engineMock.start.mockReset()
})

describe('DominoFlagPlay', () => {
  it('初期表示でdominoFlagsの全20か国を定義順にカード表示する', () => {
    renderPlay()

    expect(screen.getByRole('heading', { name: 'こっきドミノ' })).toBeInTheDocument()
    expect(screen.getByText('どの こっきに する？')).toBeInTheDocument()
    const selection = screen.getByRole('region', { name: 'どの こっきに する？' })
    const flagButtons = within(selection).getAllByRole('button')

    expect(flagButtons).toHaveLength(dominoFlags.length)
    expect(flagButtons.map((button) => button.getAttribute('aria-label'))).toEqual(
      dominoFlags.map((flag) => flag.nameJa),
    )
    for (const button of flagButtons) {
      expect(button).not.toHaveAttribute('aria-pressed')
    }
    expect(engineMock.options?.flagId).toBeNull()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
  })

  it('アメリカを選ぶとreadyになり、スタートを押せる', async () => {
    const user = userEvent.setup()
    renderPlay()

    await chooseAmerica(user)

    expect(screen.getByRole('heading', { name: 'こっきドミノ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'スタート！' })).toBeEnabled()
    expect(engineMock.options?.flagId).toBe('us')
  })

  it('スタート後はrunningになり、操作ボタンが押せなくなる', async () => {
    const user = userEvent.setup()
    renderPlay()
    await chooseAmerica(user)

    await user.click(screen.getByRole('button', { name: 'スタート！' }))

    expect(screen.getByRole('status')).toHaveTextContent('たおれているよ！')
    expect(screen.getByRole('button', { name: 'スタート！' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'こっきをかえる' })).toBeDisabled()
    expect(engineMock.start).toHaveBeenCalledTimes(1)
  })

  it('完成時に選んだ国名と、もういちど・こっきをかえるを表示する', async () => {
    const user = userEvent.setup()
    renderPlay()
    await completeAmerica(user)

    expect(screen.getByRole('status')).toHaveTextContent('アメリカ！')
    expect(screen.getByRole('button', { name: 'もういちど' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'こっきをかえる' })).toBeEnabled()
  })

  it('バングラデシュを選んで完成すると長い国名も表示する', async () => {
    const user = userEvent.setup()
    renderPlay()
    await completeFlag(user, 'バングラデシュ')

    expect(screen.getByRole('status')).toHaveTextContent('バングラデシュ！')
  })

  it('もういちどで同じ国のreadyへ戻り、runIdを進める', async () => {
    const user = userEvent.setup()
    renderPlay()
    await completeAmerica(user)

    await user.click(screen.getByRole('button', { name: 'もういちど' }))

    expect(screen.getByRole('status')).toHaveTextContent('アメリカの こっき！')
    expect(screen.getByRole('button', { name: 'スタート！' })).toBeEnabled()
    expect(engineMock.options?.flagId).toBe('us')
    expect(engineMock.options?.runId).toBe(1)
  })

  it('こっきをかえるで選択画面へ戻り、3Dを止めるflagIdがnullになる', async () => {
    const user = userEvent.setup()
    renderPlay()
    await completeAmerica(user)

    await user.click(screen.getByRole('button', { name: 'こっきをかえる' }))

    expect(screen.getByRole('heading', { name: 'こっきドミノ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'にほん' })).toBeInTheDocument()
    expect(engineMock.options?.flagId).toBeNull()
  })
})
