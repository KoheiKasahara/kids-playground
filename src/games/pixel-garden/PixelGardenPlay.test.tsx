import { StrictMode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import App from '../../app/App'
import { isSoundEnabled } from '../../audio/sound'
import { resetGameShelfCache } from '../../pages/gameShelfStore'
import surfaceStyles from '../../components/GamePlaySurface.module.css'
import PixelGardenPlay from './PixelGardenPlay'
import { playGardenSound } from './sounds'

vi.mock('./sounds', () => ({ playGardenSound: vi.fn() }))
vi.mock('../../utils/haptics', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../utils/haptics')>(),
  vibrate: vi.fn(),
}))

afterEach(() => vi.clearAllMocks())

const plots = () => within(screen.getByRole('group', { name: 'おはなばたけ' })).getAllByRole('button')
const renderGame = () => render(<StrictMode><MemoryRouter><PixelGardenPlay /></MemoryRouter></StrictMode>)

describe('PixelGardenPlay', () => {
  test('たねまき→水やり→開花→花つみ→花束→もういちどを通せる', () => {
    const { container } = renderGame()
    expect(container.querySelector(`.${surfaceStyles.surface}`)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'おと' })).toHaveAttribute('aria-pressed', 'true')
    expect(plots()).toHaveLength(6)
    const plot = plots()[2]
    fireEvent.click(plot)
    expect(plot).toHaveAttribute('data-stage', 'sprout')
    expect(playGardenSound).toHaveBeenLastCalledWith('plant')
    fireEvent.click(plot)
    expect(plot).toHaveAttribute('data-stage', 'bud')
    expect(playGardenSound).toHaveBeenLastCalledWith('water')
    fireEvent.click(screen.getByRole('button', { name: '☀ おひさま' }))
    fireEvent.click(plot)
    expect(plot).toHaveAccessibleName('3ばんの はなだん：おはなを つむ')
    expect(playGardenSound).toHaveBeenLastCalledWith('bloom')
    fireEvent.click(plot)
    expect(screen.getByLabelText('つんだ おはな 1 / 6')).toBeInTheDocument()
    expect(playGardenSound).toHaveBeenLastCalledWith('pick')
    fireEvent.click(plot)
    expect(playGardenSound).toHaveBeenCalledTimes(5)
    for (const index of [5, 0, 4, 1, 3]) {
      const other = plots()[index]
      fireEvent.click(screen.getByRole('button', { name: '💧 おみず' }))
      fireEvent.click(other)
      fireEvent.click(other)
      fireEvent.click(screen.getByRole('button', { name: '☀ おひさま' }))
      fireEvent.click(other)
      fireEvent.click(other)
    }
    expect(screen.getByRole('status')).toHaveTextContent('はなたば できたね！')
    expect(container.querySelector(`.${surfaceStyles.surface}`)).toBeNull()
    expect(screen.getByLabelText('つんだ おはな 6 / 6')).toBeInTheDocument()
    expect(playGardenSound).toHaveBeenLastCalledWith('complete')
    const replay = screen.getByRole('button', { name: 'もういちど' })
    expect(replay).toHaveFocus()
    fireEvent.click(replay)
    expect(container.querySelector(`.${surfaceStyles.surface}`)).not.toBeNull()
    expect(plots()[0]).toHaveFocus()
    expect(screen.getByRole('button', { name: '💧 おみず' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: 'うさぎさんの おねがい：4ばんの ピンクの おはな' })).toBeInTheDocument()
    expect(plots().every((button) => button.dataset.stage === 'soil')).toBe(true)
    expect(screen.getByText('2つめの はなたば')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'もういちど' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('つんだ おはな 0 / 6')).toBeInTheDocument()
  })

  test('道具とお願いを見て選び、違う操作はヒントからやり直せる', () => {
    renderGame()
    fireEvent.click(plots()[0])
    fireEvent.click(screen.getByRole('button', { name: '☀ おひさま' }))
    fireEvent.click(plots()[0])
    expect(plots()[0]).toHaveAttribute('data-stage', 'sprout')
    expect(screen.getByRole('status')).toHaveTextContent('めには おみず')
    fireEvent.click(screen.getByRole('button', { name: '💧 おみず' }))
    fireEvent.click(plots()[0])
    fireEvent.click(plots()[0])
    expect(plots()[0]).toHaveAttribute('data-stage', 'bud')
    expect(screen.getByRole('status')).toHaveTextContent('つぼみには おひさま')
    fireEvent.click(screen.getByRole('button', { name: '☀ おひさま' }))
    fireEvent.click(plots()[0])
    fireEvent.click(plots()[0])
    expect(plots()[0]).toHaveAttribute('data-stage', 'flower')
    expect(screen.getByRole('status')).toHaveTextContent('おねがいと おなじ')
    expect(screen.getByLabelText('つんだ おはな 0 / 6')).toBeInTheDocument()
  })

  test('Enter・Spaceで遊べて、音OFFのまま進行し、退出後は音ONに戻る', async () => {
    const user = userEvent.setup()
    const { unmount } = renderGame()
    await user.click(screen.getByRole('button', { name: 'おと' }))
    expect(isSoundEnabled()).toBe(false)
    plots()[0].focus()
    await user.keyboard('{Enter} ')
    expect(plots()[0]).toHaveAttribute('data-stage', 'bud')
    expect(isSoundEnabled()).toBe(false)
    unmount()
    expect(isSoundEnabled()).toBe(true)
    renderGame()
    expect(plots()[0]).toHaveAttribute('data-stage', 'soil')
  })
})

test('ホーム→遅延ルート→操作で説明を隠す→ホーム→直接再入場', async () => {
  localStorage.clear()
  resetGameShelfCache()
  const user = userEvent.setup()
  const { unmount } = render(<MemoryRouter><App /></MemoryRouter>)
  await user.click(screen.getByRole('link', { name: 'ドットの おはなばたけ' }))
  expect(await screen.findByRole('heading', { name: 'ドットの おはなばたけ' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
  await user.click(plots()[0])
  expect(screen.queryByRole('heading', { name: 'このゲームについて' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'もどる' })).toHaveLength(1)
  await user.click(screen.getByRole('button', { name: 'もどる' }))
  expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
  unmount()
  render(<MemoryRouter initialEntries={['/games/pixel-garden']}><App /></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'ドットの おはなばたけ' })).toBeInTheDocument()
  expect(plots().every((button) => button.dataset.stage === 'soil')).toBe(true)
})
