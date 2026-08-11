import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import App from '../../app/App'
import { prefecturesForRegion } from './data/regions'

describe('prefecture puzzle screens', () => {
  test('offers the puzzle from the prefecture quiz start screen', () => {
    render(<MemoryRouter initialEntries={['/games/prefecture-quiz']}><App /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '都道府県パズルで あそぶ' })).toBeInTheDocument()
  })

  test('supports selecting a tile and placing it by tapping the map', async () => {
    const user = userEvent.setup()
    const count = prefecturesForRegion('kanto').length
    render(<MemoryRouter initialEntries={['/games/prefecture-quiz/puzzle/kanto/play']}><App /></MemoryRouter>)
    const tray = screen.getByRole('region', { name: 'まだおいていないピース' })
    const pieces = within(tray).getAllByRole('button')
    expect(pieces).toHaveLength(count)
    expect(screen.getByRole('button', { name: 'こたえあわせ！' })).toBeDisabled()
    await user.click(pieces[0])
    await user.click(within(screen.getByRole('group', { name: '都道府県パズルの地図' })).getAllByRole('button')[0])
    expect(within(tray).getAllByRole('button')).toHaveLength(count - 1)
    expect(screen.getByText(`1 / ${count} おいたよ`)).toBeInTheDocument()
  })

  test('checks only after every tile is placed and resets for another round', async () => {
    const user = userEvent.setup()
    const count = prefecturesForRegion('shikoku').length
    render(<MemoryRouter initialEntries={['/games/prefecture-quiz/puzzle/shikoku/play']}><App /></MemoryRouter>)
    const tray = screen.getByRole('region', { name: 'まだおいていないピース' })
    const map = screen.getByRole('group', { name: '都道府県パズルの地図' })
    for (let index = 0; index < count; index += 1) {
      await user.click(within(tray).getAllByRole('button')[0])
      await user.click(within(map).getAllByRole('button')[index])
    }
    const check = screen.getByRole('button', { name: 'こたえあわせ！' })
    expect(check).toBeEnabled()
    await user.click(check)
    expect(screen.getByRole('button', { name: 'もういちど' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(within(screen.getByRole('region', { name: 'まだおいていないピース' })).getAllByRole('button')).toHaveLength(count)
    expect(screen.getByRole('button', { name: 'こたえあわせ！' })).toBeDisabled()
  })
})
