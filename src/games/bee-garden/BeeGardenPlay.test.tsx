import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import BeeGardenPlay from './BeeGardenPlay'
vi.mock('./sounds', () => ({ playBeeSound: vi.fn() }))
beforeEach(() => localStorage.clear())
function cell(label: string) { return screen.getByRole('button', { name: new RegExp(label) }) }
it('plays, undoes, resets, completes, persists progress and replays', () => {
  render(<MemoryRouter><BeeGardenPlay /></MemoryRouter>)
  fireEvent.click(cell('1. ちいさな'))
  fireEvent.click(cell('2だん 3れつ'))
  expect(screen.getByText(/あと 2こ/)).toBeInTheDocument()
  fireEvent.click(cell('ひとつ もどす'))
  expect(screen.getByText(/あと 3こ/)).toBeInTheDocument()
  fireEvent.click(cell('ヒント'))
  expect(screen.getByRole('status')).toHaveTextContent('✨')
  fireEvent.click(cell('2だん 3れつ'))
  fireEvent.click(cell('はじめから'))
  expect(screen.getByText(/あと 3こ/)).toBeInTheDocument()
  for (const label of ['2だん 3れつ', '3だん 3れつ', '3だん 2れつ', '2だん 2れつ']) fireEvent.click(cell(label))
  expect(screen.getByRole('region', { name: 'クリア' })).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('bee-garden-progress-v1')!)).toEqual({ '0': 3 })
  fireEvent.click(cell('もういちど'))
  expect(screen.getByText(/あと 3こ/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /もどる/ }))
  expect(screen.getByRole('img', { name: 'クリアずみ ほし 3こ' })).toBeInTheDocument()
})
it('explains early hive entry without losing progress and can mute', () => {
  render(<MemoryRouter><BeeGardenPlay /></MemoryRouter>)
  fireEvent.click(cell('1. ちいさな'))
  fireEvent.click(cell('2だん 3れつ'))
  fireEvent.click(cell('2だん 2れつ'))
  expect(screen.getByRole('status')).toHaveTextContent('ぜんぶ')
  expect(screen.getByText(/あと 2こ/)).toBeInTheDocument()
  fireEvent.click(cell('おとを けす'))
  expect(cell('おとを だす')).toBeInTheDocument()
})
