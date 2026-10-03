import { lazy, type ReactNode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test } from 'vitest'
import GameRouteBoundary from './GameRouteBoundary'

test('keeps initial content through lazy loading and swaps once the route commits', async () => {
  document.body.innerHTML = '<main id="initial-page"><h1>Initial game</h1><a href="/">Home</a></main><div id="root" inert aria-hidden="true" style="visibility:hidden;position:absolute;inset:0"></div>'
  let resolve!: (value: { default: () => ReactNode }) => void
  const Game = lazy(() => new Promise<{ default: () => ReactNode }>((ready) => { resolve = ready }))
  const root = document.getElementById('root')!
  render(<MemoryRouter><GameRouteBoundary><Game /></GameRouteBoundary></MemoryRouter>, { container: root })
  expect(screen.getByRole('heading', { name: 'Initial game' })).toBeVisible()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  screen.getByRole('link', { name: 'Home' }).focus()
  await act(async () => { resolve({ default: () => <main><h1>Live game</h1><p>Game description</p></main> }) })
  expect(document.getElementById('initial-page')).toBeNull()
  expect(root.hasAttribute('inert')).toBe(false)
  expect(screen.getByRole('heading', { name: 'Live game' })).toBeVisible()
  expect(screen.getAllByRole('main')).toHaveLength(1)
  expect(document.activeElement).toBe(root)
})
