import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DominoEngineOptions } from './useDominoEngine'
import DominoFlagPlay from './DominoFlagPlay'
import { dominoFlags } from './flagDefinitions'

const originalMatchMediaDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia')

function stubMatchMedia(reducedMotion: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: reducedMotion,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  })
}

// WebGLとRapierはjsdomで動かさず、フックに渡された状態とコールバックだけを使って画面を検証する。
const engineMock = vi.hoisted(() => ({
  options: undefined as DominoEngineOptions | undefined,
  start: vi.fn(),
}))
const soundMock = vi.hoisted(() => ({
  primeAudio: vi.fn(),
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

vi.mock('../../utils/quizSound', () => ({
  primeAudio: soundMock.primeAudio,
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

beforeEach(() => {
  stubMatchMedia(false)
})

afterEach(() => {
  engineMock.options = undefined
  engineMock.start.mockReset()
  soundMock.primeAudio.mockReset()
  if (originalMatchMediaDescriptor) {
    Object.defineProperty(window, 'matchMedia', originalMatchMediaDescriptor)
  } else {
    delete (window as unknown as Record<string, unknown>).matchMedia
  }
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

  it('初期コースはふつうが選択されている', () => {
    renderPlay()

    const courseGroup = screen.getByRole('group', { name: 'コース' })
    expect(within(courseGroup).getByRole('button', { name: 'ふつう みじかい' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(courseGroup).getByRole('button', { name: 'ロング ながい' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(
      within(courseGroup).getByRole('button', { name: 'ビッグ でっかい' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(within(courseGroup).getAllByRole('button')).toHaveLength(3)
    expect(engineMock.options?.courseType).toBe('normal')
  })

  it('ロングを選ぶと表示とエンジンのcourseTypeが切り替わる', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'ロング ながい' }))

    expect(screen.getByRole('button', { name: 'ロング ながい' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(engineMock.options?.courseType).toBe('long')
  })

  it('ビッグを選ぶとビッグだけが選択される', async () => {
    const user = userEvent.setup()
    renderPlay()

    const courseGroup = screen.getByRole('group', { name: 'コース' })
    await user.click(
      within(courseGroup).getByRole('button', { name: 'ビッグ でっかい' }),
    )

    expect(
      within(courseGroup).getByRole('button', { name: 'ビッグ でっかい' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(within(courseGroup).getByRole('button', { name: 'ふつう みじかい' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(within(courseGroup).getByRole('button', { name: 'ロング ながい' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(engineMock.options?.courseType).toBe('big')
  })

  it('ビッグを含むコース切り替えでrunIdを進めて物理世界を作り直す', async () => {
    const user = userEvent.setup()
    renderPlay()
    const courseGroup = screen.getByRole('group', { name: 'コース' })

    expect(engineMock.options?.runId).toBe(0)
    await user.click(
      within(courseGroup).getByRole('button', { name: 'ビッグ でっかい' }),
    )
    expect(engineMock.options?.courseType).toBe('big')
    expect(engineMock.options?.runId).toBe(1)

    await user.click(within(courseGroup).getByRole('button', { name: 'ロング ながい' }))
    expect(engineMock.options?.courseType).toBe('long')
    expect(engineMock.options?.runId).toBe(2)
  })

  it('国旗を選んだready画面にコース名を表示する', async () => {
    const user = userEvent.setup()
    renderPlay()
    await chooseAmerica(user)

    expect(screen.getByText('ふつう コース')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('アメリカの こっき！')
  })

  it('こっきをかえるで戻ってもコース選択を維持する', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(screen.getByRole('button', { name: 'ロング ながい' }))
    await chooseAmerica(user)
    await user.click(screen.getByRole('button', { name: 'こっきをかえる' }))

    expect(screen.getByRole('button', { name: 'ロング ながい' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(engineMock.options?.courseType).toBe('long')
  })

  it('ロング＋アメリカからふつう＋にほんへ切り替えると状態を初期化する', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(screen.getByRole('button', { name: 'ロング ながい' }))
    await chooseAmerica(user)
    await user.click(screen.getByRole('button', { name: 'こっきをかえる' }))
    await user.click(screen.getByRole('button', { name: 'ふつう みじかい' }))
    await chooseFlag(user, 'にほん')

    expect(engineMock.options?.courseType).toBe('normal')
    expect(engineMock.options?.flagId).toBe('jp')
    expect(engineMock.options?.runId).toBe(2)
  })

  it('アメリカを選ぶとreadyになり、スタートを押せる', async () => {
    const user = userEvent.setup()
    renderPlay()

    await chooseAmerica(user)

    expect(screen.getByRole('heading', { name: 'こっきドミノ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'スタート！' })).toBeEnabled()
    expect(engineMock.options?.flagId).toBe('us')
  })

  it('スタートを押すとprimeAudioを呼ぶ', async () => {
    const user = userEvent.setup()
    renderPlay()
    await chooseAmerica(user)
    soundMock.primeAudio.mockClear()

    await user.click(screen.getByRole('button', { name: 'スタート！' }))

    expect(soundMock.primeAudio).toHaveBeenCalledTimes(1)
  })

  it('ミュートボタンでエンジンへ渡すsoundEnabledを切り替える', async () => {
    const user = userEvent.setup()
    renderPlay()

    expect(engineMock.options?.soundEnabled).toBe(true)
    const muteButton = screen.getByRole('button', { name: 'おとを けす' })
    expect(muteButton).not.toHaveAttribute('aria-pressed')

    await user.click(muteButton)

    expect(engineMock.options?.soundEnabled).toBe(false)
    const unmuteButton = screen.getByRole('button', { name: 'おとを だす' })
    expect(unmuteButton).not.toHaveAttribute('aria-pressed')

    await user.click(unmuteButton)

    expect(engineMock.options?.soundEnabled).toBe(true)
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

  it('完成前は紙吹雪を表示しない', async () => {
    const user = userEvent.setup()
    renderPlay()
    expect(screen.queryByTestId('domino-complete-confetti')).not.toBeInTheDocument()

    await chooseAmerica(user)
    expect(screen.queryByTestId('domino-complete-confetti')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'スタート！' }))
    expect(screen.queryByTestId('domino-complete-confetti')).not.toBeInTheDocument()
  })

  it('完成通知後に紙吹雪を表示する', async () => {
    const user = userEvent.setup()
    renderPlay()
    await completeAmerica(user)

    expect(screen.getByTestId('domino-complete-confetti')).toBeInTheDocument()
  })

  it('紙吹雪は最大28個を超えない', async () => {
    const user = userEvent.setup()
    renderPlay()
    await completeAmerica(user)

    const confetti = screen.getByTestId('domino-complete-confetti')
    expect(confetti.querySelectorAll('span').length).toBeLessThanOrEqual(28)
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

    expect(screen.queryByTestId('domino-complete-confetti')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('アメリカの こっき！')
    expect(screen.getByRole('button', { name: 'スタート！' })).toBeEnabled()
    expect(engineMock.options?.flagId).toBe('us')
    expect(engineMock.options?.runId).toBe(1)

    await user.click(screen.getByRole('button', { name: 'スタート！' }))
    act(() => engineMock.options!.onComplete())
    expect(screen.getByTestId('domino-complete-confetti')).toBeInTheDocument()
  })

  it('こっきをかえるで選択画面へ戻り、3Dを止めるflagIdがnullになる', async () => {
    const user = userEvent.setup()
    renderPlay()
    await completeAmerica(user)

    await user.click(screen.getByRole('button', { name: 'こっきをかえる' }))

    expect(screen.queryByTestId('domino-complete-confetti')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'こっきドミノ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'にほん' })).toBeInTheDocument()
    expect(engineMock.options?.flagId).toBeNull()
  })

  it('国を変えても同じ紙吹雪演出を表示する', async () => {
    const user = userEvent.setup()
    renderPlay()
    await completeAmerica(user)
    expect(screen.getByTestId('domino-complete-confetti')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'こっきをかえる' }))
    await chooseFlag(user, 'にほん')
    await user.click(screen.getByRole('button', { name: 'スタート！' }))
    act(() => engineMock.options!.onComplete())

    expect(screen.getByRole('status')).toHaveTextContent('にほん！')
    expect(screen.getByTestId('domino-complete-confetti')).toBeInTheDocument()
  })

  it('reduced-motionでは紙吹雪を表示せず完成表示は残す', async () => {
    stubMatchMedia(true)
    const user = userEvent.setup()
    renderPlay()
    await completeAmerica(user)

    expect(screen.getByRole('status')).toHaveTextContent('アメリカ！')
    expect(screen.queryByTestId('domino-complete-confetti')).not.toBeInTheDocument()
  })

  it('完成後ももういちどとこっきをかえるをクリックできる', async () => {
    const user = userEvent.setup()
    renderPlay()
    await completeAmerica(user)

    await user.click(screen.getByRole('button', { name: 'こっきをかえる' }))
    expect(screen.getByRole('button', { name: 'にほん' })).toBeInTheDocument()

    await chooseAmerica(user)
    await user.click(screen.getByRole('button', { name: 'スタート！' }))
    act(() => engineMock.options!.onComplete())
    await user.click(screen.getByRole('button', { name: 'もういちど' }))

    expect(screen.getByRole('status')).toHaveTextContent('アメリカの こっき！')
  })
})
