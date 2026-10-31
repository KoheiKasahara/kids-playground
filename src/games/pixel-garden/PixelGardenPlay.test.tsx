import { StrictMode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from '../../app/App'
import { isSoundEnabled } from '../../audio/sound'
import { resetGameShelfCache } from '../../pages/gameShelfStore'
import surfaceStyles from '../../components/GamePlaySurface.module.css'
import PixelGardenPlay from './PixelGardenPlay'
import { playGardenSound } from './sounds'
import { FRIENDS_KEY } from './friends'

vi.mock('./sounds', () => ({ playGardenSound: vi.fn() }))
vi.mock('../../utils/haptics', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../utils/haptics')>(),
  vibrate: vi.fn(),
}))

beforeEach(() => localStorage.removeItem(FRIENDS_KEY))
afterEach(() => vi.restoreAllMocks())

const plots = () => within(screen.getByRole('group', { name: 'おはなばたけ' })).getAllByRole('button')
const renderGame = () => render(<StrictMode><MemoryRouter><PixelGardenPlay /></MemoryRouter></StrictMode>)
const finishWithRain = (round = 0) => {
  for (const plot of plots()) fireEvent.click(plot)
  fireEvent.click(screen.getByRole('button', { name: /あめを よぶ/ }))
  fireEvent.click(screen.getByRole('button', { name: '☀ おひさま' }))
  for (const plot of plots()) fireEvent.click(plot)
  for (const index of [2, 5, 0, 4, 1, 3]) fireEvent.click(plots()[(index + round) % 6])
}

describe('PixelGardenPlay', () => {
  test('雨を使う時機を選び、次の花束では再び使える', () => {
    renderGame()
    const rain = screen.getByRole('button', { name: /あめを よぶ/ })
    expect(rain).toBeDisabled()
    fireEvent.click(plots()[0])
    fireEvent.click(plots()[1])
    expect(rain).toBeEnabled()
    fireEvent.click(rain)
    expect(plots()[0]).toHaveAttribute('data-stage', 'bud')
    expect(plots()[1]).toHaveAttribute('data-stage', 'bud')
    expect(plots()[2]).toHaveAttribute('data-stage', 'soil')
    expect(screen.getByRole('button', { name: /あめは おやすみ/ })).toBeDisabled()
    fireEvent.click(plots()[2])
    expect(screen.getByRole('button', { name: /あめは おやすみ/ })).toBeDisabled()
  })

  test('届けるたびに仲間が増え、飾り方を再入場後も復元する', () => {
    const { unmount } = renderGame()
    for (let round = 0; round < 4; round++) {
      finishWithRain(round)
      const delivery = screen.getByRole('button', { name: 'はなたばを とどける' })
      fireEvent.click(delivery)
      fireEvent.click(delivery)
      expect(JSON.parse(localStorage.getItem(FRIENDS_KEY)!)).toMatchObject({ unlocked: Math.min(round + 1, 3) })
      if (round === 3) expect(screen.getByRole('status')).toHaveTextContent('みんな はなたばに おおよろこび！')
      fireEvent.click(screen.getByRole('button', { name: 'もういちど' }))
      expect(screen.getByRole('button', { name: /あめを よぶ/ })).toBeDisabled()
    }
    fireEvent.click(screen.getByText('にわの なかま 3 / 3'))
    fireEvent.click(screen.getByRole('button', { name: 'はちを かざる' }))
    expect(screen.queryByRole('img', { name: 'にわの はち' })).not.toBeInTheDocument()
    unmount()
    renderGame()
    expect(screen.getByRole('img', { name: 'にわの ちょうちょ' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'にわの ことり' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'にわの はち' })).not.toBeInTheDocument()
    expect(plots().every((plot) => plot.dataset.stage === 'soil')).toBe(true)
  })

  test('保存できなくても受け取った仲間と次の花束で遊べる', () => {
    renderGame()
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    finishWithRain()
    fireEvent.click(screen.getByRole('button', { name: 'はなたばを とどける' }))
    expect(screen.getByText(/きろくを ほぞんできなかったよ/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'にわの ちょうちょ' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(plots()).toHaveLength(6)
    write.mockRestore()
    fireEvent.click(screen.getByText('にわの なかま 1 / 3'))
    fireEvent.click(screen.getByRole('button', { name: 'ちょうちょを かざる' }))
    expect(screen.queryByText(/きろくを ほぞんできなかったよ/)).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(FRIENDS_KEY)!)).toEqual({ unlocked: 1, decorations: [] })
  })

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
    const delivery = screen.getByRole('button', { name: 'はなたばを とどける' })
    expect(delivery).toHaveFocus()
    fireEvent.click(delivery)
    expect(screen.getByRole('status')).toHaveTextContent('ちょうちょが あそびに きたよ！')
    expect(screen.getByRole('img', { name: 'にわの ちょうちょ' })).toBeInTheDocument()
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
