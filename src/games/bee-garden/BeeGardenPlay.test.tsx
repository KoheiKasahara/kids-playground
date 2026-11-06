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
  expect(cell('1だん 2れつ')).toHaveAccessibleName(/みぎへ とべる/)
  expect(cell('2だん 1れつ')).toHaveAccessibleName(/したへ とべる/)
  expect(screen.getByRole('status')).toHaveTextContent('やじるし')
  fireEvent.click(cell('1だん 2れつ'))
  expect(screen.getByText(/あと 2こ/)).toBeInTheDocument()
  expect(cell('1だん 2れつ')).toHaveAccessibleName(/とおった おはな はちさん/)
  expect(cell('2だん 2れつ')).toHaveAccessibleName(/したへ とべる/)
  fireEvent.click(cell('ひとつ もどす'))
  expect(screen.getByText(/あと 3こ/)).toBeInTheDocument()
  fireEvent.click(cell('ヒント'))
  expect(screen.getByRole('status')).toHaveTextContent('✨')
  expect(screen.getAllByRole('button', { name: /れつ.* ヒント$/ })).toHaveLength(1)
  fireEvent.click(cell('1だん 2れつ'))
  fireEvent.click(cell('はじめから'))
  expect(screen.getByText(/あと 3こ/)).toBeInTheDocument()
  for (const label of ['1だん 2れつ', '2だん 2れつ', '2だん 1れつ']) fireEvent.click(cell(label))
  expect(screen.getByText(/かえろう/, { selector: 'span' })).toBeInTheDocument()
  expect(cell('1だん 1れつ')).toHaveAccessibleName(/おうち うえへ とべる/)
  fireEvent.click(cell('1だん 1れつ'))
  expect(screen.getByRole('region', { name: 'クリア' })).toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem('bee-garden-progress-v1')!)).toEqual({ '0': 3 })
  fireEvent.click(cell('もういちど'))
  expect(screen.getByText(/あと 3こ/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /もどる/ }))
  expect(screen.getByRole('img', { name: 'クリアずみ ほし 3こ' })).toBeInTheDocument()
})

it('explains blocked taps without losing progress and can mute', () => {
  render(<MemoryRouter><BeeGardenPlay /></MemoryRouter>)
  fireEvent.click(cell('1. ちいさな'))
  fireEvent.click(cell('1だん 2れつ'))
  fireEvent.click(cell('1だん 1れつ'))
  expect(screen.getByRole('status')).toHaveTextContent('ぜんぶ')
  fireEvent.click(cell('2だん 1れつ'))
  expect(screen.getByRole('status')).toHaveTextContent('やじるし')
  expect(screen.getByText(/あと 2こ/)).toBeInTheDocument()
  fireEvent.click(cell('おとを けす'))
  expect(cell('おとを だす')).toBeInTheDocument()
})

it('guides back from a dead end in a larger garden', () => {
  render(<MemoryRouter><BeeGardenPlay /></MemoryRouter>)
  fireEvent.click(cell('4. わかれみち'))
  for (const label of ['1だん 2れつ', '2だん 2れつ', '2だん 1れつ', '3だん 1れつ', '3だん 2れつ']) fireEvent.click(cell(label))
  expect(screen.getByRole('status')).toHaveTextContent('いきどまり')
  fireEvent.click(cell('ヒント'))
  expect(screen.getByRole('status')).toHaveTextContent('いきどまり')
  fireEvent.click(cell('ひとつ もどす'))
  expect(screen.getByRole('status')).not.toHaveTextContent('いきどまり')
})

it('lets a finger trace the route, slide back to undo and finish without stray taps', () => {
  render(<MemoryRouter><BeeGardenPlay /></MemoryRouter>)
  fireEvent.click(cell('1. ちいさな'))
  const board = screen.getByLabelText('おはなの おにわ')
  let under: Element | null = null
  document.elementFromPoint = vi.fn(() => under)
  const over = (label: string, type: 'pointerDown' | 'pointerMove' = 'pointerMove') => {
    under = cell(label)
    fireEvent[type](board, { clientX: 1, clientY: 1 })
  }
  over('1だん 1れつ', 'pointerDown')
  over('1だん 2れつ')
  over('2だん 2れつ')
  expect(screen.getByText(/あと 1こ/)).toBeInTheDocument()
  over('1だん 2れつ')
  expect(screen.getByText(/あと 2こ/)).toBeInTheDocument()
  over('2だん 1れつ')
  expect(screen.getByText(/あと 2こ/)).toBeInTheDocument()
  over('2だん 2れつ')
  over('2だん 1れつ')
  fireEvent.pointerUp(board)
  fireEvent.click(cell('1だん 1れつ'))
  expect(screen.getByText(/かえろう/, { selector: 'span' })).toBeInTheDocument()
  expect(screen.getByRole('status')).not.toHaveTextContent('ぜんぶ')
  fireEvent.click(cell('1だん 1れつ'))
  expect(screen.getByRole('region', { name: 'クリア' })).toBeInTheDocument()
})
