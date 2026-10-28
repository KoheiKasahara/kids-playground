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
    const plot = plots()[0]
    fireEvent.click(plot)
    expect(plot).toHaveAttribute('data-stage', 'sprout')
    expect(playGardenSound).toHaveBeenLastCalledWith('plant')
    fireEvent.click(plot)
    expect(plot).toHaveAttribute('data-stage', 'bud')
    expect(playGardenSound).toHaveBeenLastCalledWith('water')
    fireEvent.click(plot)
    expect(plot).toHaveAccessibleName('1ばんの はなだん：おはなを つむ')
    expect(playGardenSound).toHaveBeenLastCalledWith('bloom')
    fireEvent.click(plot)
    expect(screen.getByLabelText('つんだ おはな 1 / 6')).toBeInTheDocument()
    expect(playGardenSound).toHaveBeenLastCalledWith('pick')
    fireEvent.click(plot)
    expect(playGardenSound).toHaveBeenCalledTimes(4)
    for (const other of plots().slice(1)) for (let i = 0; i < 4; i++) fireEvent.click(other)
    expect(screen.getByRole('status')).toHaveTextContent('はなたば できたね！')
    expect(container.querySelector(`.${surfaceStyles.surface}`)).toBeNull()
    expect(screen.getByLabelText('つんだ おはな 6 / 6')).toBeInTheDocument()
    expect(playGardenSound).toHaveBeenLastCalledWith('complete')
    const replay = screen.getByRole('button', { name: 'もういちど' })
    expect(replay).toHaveFocus()
    fireEvent.click(replay)
    expect(container.querySelector(`.${surfaceStyles.surface}`)).not.toBeNull()
    expect(plots()[0]).toHaveFocus()
    expect(plots().every((button) => button.dataset.stage === 'soil')).toBe(true)
    expect(screen.getByText('2つめの はなたば')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'もういちど' })).not.toBeInTheDocument()
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
