import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import Zoo3dPlay from './Zoo3dPlay'
import type { ZooEngineOptions } from './useZooEngine'

const engine = vi.hoisted(() => ({
  options: undefined as ZooEngineOptions | undefined,
  select: vi.fn(), feed: vi.fn(), special: vi.fn(), setFollow: vi.fn(), overview: vi.fn(), retry: vi.fn(),
}))
vi.mock('./useZooEngine', () => ({
  useZooEngine: (options: ZooEngineOptions) => {
    engine.options = options
    return {
      registerContainer: () => {}, retry: engine.retry, select: engine.select, feed: engine.feed,
      special: engine.special, setFollow: engine.setFollow, overview: engine.overview,
    }
  },
}))
vi.mock('./sounds', () => ({ playZooSound: vi.fn() }))

function renderZoo() {
  render(<MemoryRouter><Zoo3dPlay /></MemoryRouter>)
}
afterEach(() => vi.clearAllMocks())

describe('3Dどうぶつえんの画面', () => {
  test('読み込み中は進み具合を出し、失敗したら「もういちど」で読み直せる', async () => {
    const user = userEvent.setup()
    renderZoo()
    expect(screen.getByRole('heading', { name: '3Dどうぶつえん' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('じゅんびちゅう')
    act(() => engine.options?.onStatus('error'))
    await user.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(engine.retry).toHaveBeenCalled()
  })

  test('動物のボタンで選ぶと追いかけ、えさ・アクション・じょうほうで ふれあえる', async () => {
    const user = userEvent.setup()
    renderZoo()
    act(() => engine.options?.onStatus('ready'))
    await user.click(screen.getByRole('button', { name: 'ゾウの おかあさんを みる' }))
    expect(engine.select).toHaveBeenCalledWith('elephant-mom')
    expect(engine.setFollow).toHaveBeenCalledWith(true)
    act(() => { engine.options?.onSelect('elephant-mom'); engine.options?.onFollow(true) })

    await user.click(screen.getByRole('button', { name: 'りんごを あげる' }))
    expect(engine.feed).toHaveBeenCalled()
    // アクションは押すたびに、その動物の固有アクションを順番に見せる
    await user.click(screen.getByRole('button', { name: 'パオーンを みる' }))
    expect(engine.special).toHaveBeenLastCalledWith('Trumpet')
    await user.click(screen.getByRole('button', { name: 'みずあびを みる' }))
    expect(engine.special).toHaveBeenLastCalledWith('Bath')

    await user.click(screen.getByRole('button', { name: 'じょうほうを みる' }))
    expect(screen.getByRole('dialog', { name: 'ゾウ' })).toHaveTextContent('はなで みずを')
    await user.click(screen.getByRole('button', { name: 'とじる' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    expect(screen.getByRole('button', { name: 'おいかける' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'ぜんたい' }))
    expect(engine.overview).toHaveBeenCalled()
  })

  test('タップで選ばれた動物に合わせて、えさと アクションが かわる', async () => {
    renderZoo()
    act(() => engine.options?.onStatus('ready'))
    act(() => engine.options?.onSelect('lion-cub'))
    expect(screen.getByRole('button', { name: 'おにくを あげる' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'がおーを みる' })).toBeEnabled()
    act(() => engine.options?.onSelect('giraffe-dad'))
    expect(screen.getByRole('button', { name: 'はっぱを あげる' })).toBeEnabled()
    act(() => engine.options?.onSelect(null))
    expect(screen.getByRole('group', { name: 'どうぶつを えらぶ' })).toBeInTheDocument()
  })
})
