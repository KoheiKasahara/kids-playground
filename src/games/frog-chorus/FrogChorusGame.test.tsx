import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import FrogChorusGame from './FrogChorusGame'
import { playFrog } from './sounds'

vi.mock('./sounds')

function openPond() {
  return render(<MemoryRouter><FrogChorusGame /></MemoryRouter>)
}

const button = (name: string) => screen.getByRole('button', { name })
const tap = (name: string) => fireEvent.click(button(name))

function advanceBeat() {
  act(() => { vi.advanceTimersByTime(560) })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

it('places a singer on an empty leaf, swaps voices, removes it and undoes the edit', () => {
  openPond()
  expect(button('ひとつ もどす')).toBeDisabled()
  tap('きいろの かえる')
  tap('2ばんの はっぱ、あいている')
  tap('そらいろの かえる')
  tap('2ばんの はっぱ、きいろの かえる')
  tap('2ばんの はっぱ、そらいろの かえる')
  expect(button('2ばんの はっぱ、あいている')).toBeInTheDocument()
  tap('ひとつ もどす')
  expect(button('2ばんの はっぱ、そらいろの かえる')).toBeInTheDocument()
})

it('sings each occupied beat, rests on empty leaves and loops until stopped', () => {
  openPond()
  tap('えんそうする')
  expect(vi.mocked(playFrog).mock.calls).toEqual([['meadow']])
  advanceBeat()
  advanceBeat()
  expect(playFrog).toHaveBeenCalledTimes(1)
  advanceBeat()
  expect(playFrog).toHaveBeenLastCalledWith('sunny')
  advanceBeat()
  advanceBeat()
  expect(playFrog).toHaveBeenLastCalledWith('sky')
  advanceBeat()
  advanceBeat()
  advanceBeat()
  expect(vi.mocked(playFrog).mock.calls).toEqual([['meadow'], ['sunny'], ['sky'], ['meadow']])

  tap('とめる')
  expect(button('えんそうする')).toBeInTheDocument()
  act(() => { vi.advanceTimersByTime(10_000) })
  expect(playFrog).toHaveBeenCalledTimes(4)
})

it('plays live edits at the new tempo and shows the active leaf with sound switched off', () => {
  openPond()
  tap('えんそうする')
  tap('そらいろの かえる')
  tap('2ばんの はっぱ、あいている')
  tap('はやい')
  vi.mocked(playFrog).mockClear()

  act(() => { vi.advanceTimersByTime(360) })
  expect(playFrog).toHaveBeenCalledOnce()
  expect(playFrog).toHaveBeenCalledWith('sky')
  expect(button('2ばんの はっぱ、そらいろの かえる')).toHaveAttribute('aria-current', 'step')
  tap('おと')
  expect(button('おと')).toHaveAttribute('aria-pressed', 'false')
  act(() => { vi.advanceTimersByTime(360) })
  expect(button('3ばんの はっぱ、あいている')).toHaveAttribute('aria-current', 'step')
})

it('resumes on the next beat after a hidden tab and cancels playback on exit', () => {
  const { unmount } = openPond()
  tap('えんそうする')
  advanceBeat()
  advanceBeat()

  const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  fireEvent(document, new Event('visibilitychange'))
  act(() => { vi.advanceTimersByTime(10_000) })
  expect(playFrog).toHaveBeenCalledTimes(1)
  hidden.mockReturnValue(false)
  fireEvent(document, new Event('visibilitychange'))
  advanceBeat()
  expect(vi.mocked(playFrog).mock.calls).toEqual([['meadow'], ['sunny']])
  unmount()
  expect(vi.getTimerCount()).toBe(0)
  act(() => { vi.advanceTimersByTime(10_000) })
  expect(playFrog).toHaveBeenCalledTimes(2)
})
