import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from '../../app/App'
import OrigamiPlay from './OrigamiPlay'
import { ORIGAMI_TEMPLATES, PAPER_COLORS } from './origamiTemplates'
import { playFinishSound, playFoldSound } from './sounds'

vi.mock('./sounds', () => ({ playFinishSound: vi.fn(), playFoldSound: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
  localStorage.clear()
})

function renderGame() {
  return render(<MemoryRouter initialEntries={['/games/origami-play']}><OrigamiPlay /></MemoryRouter>)
}

function advanceFold() {
  act(() => { vi.advanceTimersByTime(850) })
}

function progress() {
  return screen.getByRole('progressbar', { name: 'おった かず' })
}

describe('ぱたぱた おりがみのあそび', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })
  test('大きな作品選択と紙の色を選んで始められる', () => {
    renderGame()
    expect(screen.getByRole('heading', { name: 'ぱたぱた おりがみ' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'もどる' })).toHaveLength(1)
    for (const template of ORIGAMI_TEMPLATES) {
      expect(screen.getByRole('button', { name: `${template.name}を おる` })).toBeEnabled()
    }
    const chosenColor = PAPER_COLORS[1]!
    fireEvent.click(screen.getByRole('button', { name: chosenColor.name }))
    for (const color of PAPER_COLORS) {
      expect(screen.getByRole('button', { name: color.name }))
        .toHaveAttribute('aria-pressed', String(color === chosenColor))
    }

    const template = ORIGAMI_TEMPLATES[0]!
    fireEvent.click(screen.getByRole('button', { name: `${template.name}を おる` }))
    expect(progress()).toHaveAttribute('aria-valuenow', '0')
    expect(progress()).toHaveAttribute('aria-valuemax', String(template.steps.length))
    expect(screen.getByRole('status')).toHaveTextContent(template.steps[0]!.instruction)
    expect(screen.getAllByRole('button', { name: 'ここを おる' })).toHaveLength(1)
  })

  test.each(ORIGAMI_TEMPLATES)('$nameを最後まで折り、同じ作品をもう一度作れる', (template) => {
    renderGame()
    const chosenColor = PAPER_COLORS[1]!
    fireEvent.click(screen.getByRole('button', { name: chosenColor.name }))
    fireEvent.click(screen.getByRole('button', { name: `${template.name}を おる` }))

    template.steps.forEach((step, index) => {
      expect(screen.getByRole('status')).toHaveTextContent(step.instruction)
      fireEvent.click(screen.getByRole('button', { name: 'ここを おる' }))
      advanceFold()
      expect(progress()).toHaveAttribute('aria-valuenow', String(index + 1))
    })

    expect(screen.getByText('できた！')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ここを おる' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ほかの おりがみ' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'もういちど おる' }))
    expect(progress()).toHaveAttribute('aria-valuenow', '0')
    expect(progress()).toHaveAttribute('aria-valuemax', String(template.steps.length))
    expect(screen.getByRole('status')).toHaveTextContent(template.steps[0]!.instruction)
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: chosenColor.name })).toHaveAttribute('aria-pressed', 'true')
  })

  test('連打してもアニメーションの途中で次の折り方へ飛ばない', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: `${ORIGAMI_TEMPLATES[0]!.name}を おる` }))
    const fold = screen.getByRole('button', { name: 'ここを おる' })
    for (let tap = 0; tap < 8; tap += 1) fireEvent.click(fold)
    act(() => { vi.advanceTimersByTime(849) })
    expect(progress()).toHaveAttribute('aria-valuenow', '0')
    act(() => { vi.advanceTimersByTime(1) })
    expect(progress()).toHaveAttribute('aria-valuenow', '1')
    advanceFold()
    expect(progress()).toHaveAttribute('aria-valuenow', '1')
  })

  test('折っている途中で戻るとタイマーを止め、別の作品に影響を残さない', () => {
    renderGame()
    const schedule = vi.spyOn(window, 'setTimeout')
    const cancel = vi.spyOn(window, 'clearTimeout')
    fireEvent.click(screen.getByRole('button', { name: `${ORIGAMI_TEMPLATES[0]!.name}を おる` }))
    fireEvent.click(screen.getByRole('button', { name: 'ここを おる' }))
    const foldTimer = schedule.mock.results.at(-1)!.value
    expect(schedule).toHaveBeenLastCalledWith(expect.any(Function), 850)
    act(() => { vi.advanceTimersByTime(400) })
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(cancel).toHaveBeenCalledWith(foldTimer)

    const next = ORIGAMI_TEMPLATES[1]!
    fireEvent.click(screen.getByRole('button', { name: `${next.name}を おる` }))
    advanceFold()
    expect(progress()).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByRole('status')).toHaveTextContent(next.steps[0]!.instruction)
    fireEvent.click(screen.getByRole('button', { name: 'ここを おる' }))
    advanceFold()
    expect(progress()).toHaveAttribute('aria-valuenow', '1')
  })

  test('画面を離れると折りアニメーションのタイマーを解除する', () => {
    const { unmount } = renderGame()
    const schedule = vi.spyOn(window, 'setTimeout')
    const cancel = vi.spyOn(window, 'clearTimeout')
    fireEvent.click(screen.getByRole('button', { name: `${ORIGAMI_TEMPLATES[0]!.name}を おる` }))
    fireEvent.click(screen.getByRole('button', { name: 'ここを おる' }))
    const foldTimer = schedule.mock.results.at(-1)!.value
    expect(schedule).toHaveBeenLastCalledWith(expect.any(Function), 850)
    unmount()
    expect(cancel).toHaveBeenCalledWith(foldTimer)
  })

  test('作品選択も紙を折る操作もEnterとSpaceで遊べる', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    renderGame()
    const template = ORIGAMI_TEMPLATES[0]!
    screen.getByRole('button', { name: `${template.name}を おる` }).focus()
    await user.keyboard('{Enter}')
    const fold = screen.getByRole('button', { name: 'ここを おる' })
    expect(fold).toHaveFocus()
    for (let step = 0; step < template.steps.length; step += 1) {
      await user.keyboard(step === 0 ? '{Enter}' : ' ')
      await waitFor(() => expect(progress()).toHaveAttribute('aria-valuenow', String(step + 1)))
      if (step < template.steps.length - 1) {
        expect(screen.getByRole('button', { name: 'ここを おる' })).toHaveFocus()
      }
    }
    expect(screen.getByRole('button', { name: 'もういちど おる' })).toHaveFocus()
  })

  test('音のオンとオフを切り替えられる', () => {
    renderGame()
    const sound = screen.getByRole('button', { name: 'おと' })
    expect(sound).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(sound)
    expect(sound).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(sound)
    expect(sound).toHaveAttribute('aria-pressed', 'false')
  })

  test('完成の音は最後の折りが終わってから一度だけ鳴る', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'おと' }))
    const template = ORIGAMI_TEMPLATES[0]!
    fireEvent.click(screen.getByRole('button', { name: `${template.name}を おる` }))
    for (let step = 0; step < template.steps.length; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'ここを おる' }))
      expect(playFoldSound).toHaveBeenCalledTimes(step + 1)
      expect(playFinishSound).not.toHaveBeenCalled()
      advanceFold()
    }
    expect(playFinishSound).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'おと' }))
    fireEvent.click(screen.getByRole('button', { name: 'おと' }))
    expect(playFinishSound).toHaveBeenCalledOnce()
  })

  test('完成記録は再入場しても残り、ほかの作品は最初の一折りから始まる', () => {
    const { unmount } = renderGame()
    const first = ORIGAMI_TEMPLATES[0]!
    fireEvent.click(screen.getByRole('button', { name: `${first.name}を おる` }))
    for (let step = 0; step < first.steps.length; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'ここを おる' }))
      advanceFold()
    }
    fireEvent.click(screen.getByRole('button', { name: 'ほかの おりがみ' }))
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: `${first.name}を おる` }))
      .getByRole('img', { name: 'クリアずみ ほし 3こ' })).toBeInTheDocument()
    const second = ORIGAMI_TEMPLATES[1]!
    fireEvent.click(screen.getByRole('button', { name: `${second.name}を おる` }))
    expect(progress()).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByRole('status')).toHaveTextContent(second.steps[0]!.instruction)
    unmount()
    renderGame()
    expect(within(screen.getByRole('button', { name: `${first.name}を おる` }))
      .getByRole('img', { name: 'クリアずみ ほし 3こ' })).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: `${second.name}を おる` }))
      .queryByRole('img', { name: /クリアずみ/ })).not.toBeInTheDocument()
  })
})

describe('ホームとおりがみのルート', () => {
  test('ホームから遅延読込でき、説明と戻るボタンがプレイ状態に合わせて切り替わる', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: 'ぱたぱた おりがみ' }))
    expect(await screen.findByRole('heading', { name: 'ぱたぱた おりがみ' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'もどる' })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: `${ORIGAMI_TEMPLATES[0]!.name}を おる` }))
    expect(screen.queryByRole('heading', { name: 'このゲームについて' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('link', { name: 'ぱたぱた おりがみ' })).toBeInTheDocument()
  })

  test('直接URLを開いても作品選択画面を表示する', async () => {
    render(<MemoryRouter initialEntries={['/games/origami-play']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'ぱたぱた おりがみ' })).toBeInTheDocument()
    for (const template of ORIGAMI_TEMPLATES) {
      expect(screen.getByRole('button', { name: `${template.name}を おる` })).toBeInTheDocument()
    }
  })
})
