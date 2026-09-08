import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import GameBackButton from './GameBackButton'
import { gameBackPath } from './gameBackPath'

function LocationView() {
  const { pathname } = useLocation()
  return <output>{pathname}</output>
}

describe('gameBackPath', () => {
  test.each([
    ['/games/flag-pinball', '/'],
    ['/games/flag-pinball/play', '/games/flag-pinball'],
    ['/games/flag-quiz/name-to-flag', '/games/flag-quiz'],
    ['/games/flag-quiz/name-to-flag/easy/play', '/games/flag-quiz/name-to-flag'],
    ['/games/math-quiz/add/easy/result', '/games/math-quiz/add'],
    ['/games/world-travel-quiz/europe/answer-mode', '/games/world-travel-quiz'],
    ['/games/world-travel-quiz/europe/flag/play', '/games/world-travel-quiz/europe/answer-mode'],
    ['/games/prefecture-quiz/puzzle/kanto/play', '/games/prefecture-quiz/puzzle'],
    ['/games/prefecture-quiz/name-to-map/result', '/games/prefecture-quiz'],
  ])('%s の親画面は %s', (path, expected) => {
    expect(gameBackPath(path)).toBe(expected)
  })

  test('ゲーム外では表示対象にしない', () => {
    expect(gameBackPath('/')).toBeNull()
  })
})

test('共通ボタンでひとつ上の画面へ移動する', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/games/flag-pinball/play']}>
      <GameBackButton />
      <LocationView />
    </MemoryRouter>,
  )

  await user.click(screen.getByRole('button', { name: 'もどる' }))
  expect(screen.getByText('/games/flag-pinball')).toBeInTheDocument()
})
