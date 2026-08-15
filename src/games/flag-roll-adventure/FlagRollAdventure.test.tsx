import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import type { AdventureEngineOptions } from './useAdventureEngine'

// matter-jsはjsdomで回さず、物理から画面へ渡るイベントだけをテスト側から発火する。
// これにより、軌道の偶然性ではなく、選択・エリア表示・ゴール遷移を安定して検証できる。
const engineMock = vi.hoisted(() => ({ options: undefined as AdventureEngineOptions | undefined }))
vi.mock('./useAdventureEngine', () => ({
  useAdventureEngine: (options: AdventureEngineOptions) => {
    engineMock.options = options
    return { registerBall: () => {}, registerWorld: () => {} }
  },
}))

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

async function clickButton(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name }))
}

async function selectJapanAndPlay(user: ReturnType<typeof userEvent.setup>) {
  await clickButton(user, 'にほん')
  await clickButton(user, 'スタート！')
  await screen.findByRole('button', { name: 'やめる' })
  expect(engineMock.options).toBeDefined()
}

/**
 * ゴール通知後の800msだけfake timersで進める。
 * userEventとfake timersを同時に使うとハングするため、クリックはreal timersへ戻してから行う。
 */
async function reachGoal() {
  vi.useFakeTimers()
  act(() => {
    engineMock.options?.onGoal()
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(799)
  })
  expect(screen.queryByRole('heading', { name: 'ゴール！' })).not.toBeInTheDocument()
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1)
  })
  vi.useRealTimers()
  await screen.findByRole('heading', { name: 'ゴール！' })
}

afterEach(() => {
  engineMock.options = undefined
  vi.useRealTimers()
  cleanup()
})

describe('FlagRollAdventure 選択画面', () => {
  test('ホームの「こっきコロコロぼうけん」から選択画面へ行ける', async () => {
    const user = userEvent.setup()
    renderApp('/')
    await user.click(screen.getByRole('button', { name: 'こっきコロコロぼうけん' }))
    expect(await screen.findByRole('heading', { name: 'こっきコロコロぼうけん' })).toBeInTheDocument()
    expect(screen.getByText('こっきを 1こ えらんでね！')).toBeInTheDocument()
  })

  test('40個の国旗が並び、2つ目を押すと1つ目の選択が置き換わる', async () => {
    const user = userEvent.setup()
    renderApp('/games/flag-roll-adventure')
    await screen.findByRole('heading', { name: 'こっきコロコロぼうけん' })
    const flagButtons = screen.getAllByRole('button').filter((button) => button.hasAttribute('aria-pressed'))
    expect(flagButtons).toHaveLength(40)

    await clickButton(user, 'にほん')
    await clickButton(user, 'かんこく')
    expect(screen.getByRole('button', { name: 'にほん' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'かんこく' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1)
  })

  test('未選択では「スタート！」が押せない', async () => {
    renderApp('/games/flag-roll-adventure')
    const startButton = await screen.findByRole('button', { name: 'スタート！' })
    expect(startButton).toBeDisabled()
  })
})

describe('FlagRollAdventure プレイとゴール', () => {
  test('スタートすると選んだ国旗がプレイ画面に表示される', async () => {
    const user = userEvent.setup()
    renderApp('/games/flag-roll-adventure')
    await selectJapanAndPlay(user)

    expect(screen.getByRole('button', { name: 'やめる' })).toBeInTheDocument()
    expect(screen.getByText('そら')).toBeInTheDocument()
    const flagImages = Array.from(document.querySelectorAll('img'))
    expect(flagImages.length).toBeGreaterThanOrEqual(2)
    expect(flagImages.every((image) => image.getAttribute('src')?.endsWith('/jp.svg'))).toBe(true)
  })

  test('onAreaEnterでヘッダのエリア名が変わる', async () => {
    const user = userEvent.setup()
    renderApp('/games/flag-roll-adventure')
    await selectJapanAndPlay(user)

    act(() => {
      engineMock.options?.onAreaEnter('forest')
    })
    expect(await screen.findByText('もり')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('もりエリアに はいったよ')
  })

  test('onGoal発火から800ms後にゴール画面へ進み、国名を表示する', async () => {
    const user = userEvent.setup()
    renderApp('/games/flag-roll-adventure')
    await selectJapanAndPlay(user)
    await reachGoal()

    expect(screen.getByRole('heading', { name: 'ゴール！' })).toBeInTheDocument()
    expect(screen.getByText('にほん')).toBeInTheDocument()
  })

  test('「もういっかい」で同じ国旗の初期プレイへ戻る', async () => {
    const user = userEvent.setup()
    renderApp('/games/flag-roll-adventure')
    await selectJapanAndPlay(user)
    await reachGoal()

    await clickButton(user, 'もういっかい')
    await screen.findByRole('button', { name: 'やめる' })
    expect(screen.getByText('そら')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'やめる' })).toBeInTheDocument()
    expect(engineMock.options).toBeDefined()
  })

  test('「べつの こっき」で選択画面へ戻り、選択がリセットされる', async () => {
    const user = userEvent.setup()
    renderApp('/games/flag-roll-adventure')
    await selectJapanAndPlay(user)
    await reachGoal()

    await clickButton(user, 'べつの こっき')
    expect(await screen.findByRole('heading', { name: 'こっきコロコロぼうけん' })).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'スタート！' })).toBeDisabled()
  })

  test('「やめる」でホームへ戻る', async () => {
    const user = userEvent.setup()
    renderApp('/games/flag-roll-adventure')
    await selectJapanAndPlay(user)
    await reachGoal()

    await clickButton(user, 'やめる')
    expect(await screen.findByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
  })

  test('stateなしでplay/goalを直接開くと選択画面へ戻る', async () => {
    const playView = renderApp('/games/flag-roll-adventure/play')
    expect(await playView.findByRole('heading', { name: 'こっきコロコロぼうけん' })).toBeInTheDocument()
    playView.unmount()

    const goalView = renderApp('/games/flag-roll-adventure/goal')
    expect(await goalView.findByRole('heading', { name: 'こっきコロコロぼうけん' })).toBeInTheDocument()
  })
})
