import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import MarbleCoursePlay from './MarbleCoursePlay'
import type { EngineOptions } from './useMarbleEngine'

const engine = vi.hoisted(() => ({ roll: vi.fn(), stop: vi.fn(), retry: vi.fn(), status: 'ready', options: null as EngineOptions | null, id: 0 }))
vi.mock('./useMarbleEngine', () => ({
  useMarbleEngine: (options: EngineOptions) => {
    engine.options = options
    return { registerContainer: () => {}, status: engine.status, roll: engine.roll, stop: engine.stop, palette: () => {}, nextId: () => `new-${engine.id++}`, retry: engine.retry, zoom: () => {}, overview: () => {} }
  },
}))
beforeEach(() => { vi.clearAllMocks(); engine.status = 'ready'; engine.id = 0 })
const show = () => render(<MemoryRouter><MarbleCoursePlay /></MemoryRouter>)
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

it('builds and rotates, changes the start, and restores a cleared course with undo', () => {
  show()
  for (const name of ['まっすぐ', 'さかみち', 'カーブ', 'ぶんき', 'ゴール']) expect(screen.getByRole('button', { name: `${name}を ついか` })).toBeEnabled()
  click('まっすぐを ついか')
  expect(engine.options!.course.parts).toHaveLength(2)
  click('まわす')
  expect(engine.options!.course.parts[1]!.rotation).toBe(1)
  click('スタート')
  expect(engine.options!.course.startId).toBe('new-0')
  click('クリア')
  expect(screen.getByRole('button', { name: 'ビーだま ころがす！' })).toBeDisabled()
  click('もどす')
  expect(engine.options!.course.parts).toHaveLength(2)
  expect(engine.options!.course.startId).toBe('new-0')
})

it('supports rolling, success, quiet retries and editing without a failure state', () => {
  show()
  click('ビーだま ころがす！')
  expect(engine.roll).toHaveBeenCalledOnce()
  act(() => engine.options!.onPhase('rolling'))
  expect(screen.getByRole('button', { name: 'まわす' })).toBeDisabled()
  click('もういちど ころがす！')
  expect(engine.roll).toHaveBeenCalledTimes(2)
  act(() => engine.options!.onPhase('goal'))
  expect(screen.getByRole('status')).toHaveTextContent('⭐ ゴール！ やったね！')
  act(() => engine.options!.onPhase('ready'))
  expect(screen.getByRole('status')).toHaveTextContent('みちを つないで また ころがそう！')
  expect(screen.getByRole('button', { name: 'ビーだま ころがす！' })).toBeEnabled()
  act(() => engine.options!.onPhase('rolling'))
  click('つくるに もどる')
  expect(engine.stop).toHaveBeenCalledOnce()
})

it('offers a retry when initialization fails and preserves the course', () => {
  engine.status = 'error'
  show()
  expect(screen.getByRole('button', { name: 'まっすぐを ついか' })).toBeDisabled()
  click('もういちど')
  expect(engine.retry).toHaveBeenCalledOnce()
  expect(engine.options!.course.parts).toHaveLength(1)
})

it('switches palettes without changing selection or history and undoes spinner settings independently', () => {
  show()
  fireEvent.click(screen.getByRole('tab', { name: 'しかけ' }))
  for (const name of ['ジャンプ', 'くるくる', 'ぐるぐる', 'びゅーん', 'ぎったん']) expect(screen.getByRole('button', { name: `${name}を ついか` })).toBeEnabled()
  expect(engine.options!.course.parts).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'もどす' })).toBeDisabled()
  click('くるくるを ついか')
  const selected = engine.options!.selectedId
  const course = engine.options!.course
  fireEvent.click(screen.getByRole('tab', { name: 'みち' }))
  expect(engine.options!.selectedId).toBe(selected)
  expect(engine.options!.course).toBe(course)
  click('はやさ：ゆっくり')
  click('ぎゃくまわり')
  expect(engine.options!.course.parts[1]).toMatchObject({ rotation: 0, settings: { speed: 'fast', reverse: true } })
  click('もどす')
  expect(engine.options!.course.parts[1]).toMatchObject({ settings: { speed: 'fast', reverse: false } })
  click('もどす')
  expect(engine.options!.course.parts[1]).toMatchObject({ settings: { speed: 'slow', reverse: false } })
  click('まわす')
  expect(engine.options!.course.parts[1]).toMatchObject({ rotation: 1, settings: { speed: 'slow', reverse: false } })
  act(() => engine.options!.onPhase('rolling'))
  expect(screen.getByRole('button', { name: 'はやさ：ゆっくり' })).toBeDisabled()
})

it('uses keyboard tabs, announces a gadget hint once, and keeps additions undoable as one part', () => {
  show()
  fireEvent.keyDown(screen.getByRole('tab', { name: 'みち' }), { key: 'ArrowRight' })
  expect(screen.getByRole('tab', { name: 'しかけ' })).toHaveFocus()
  click('ジャンプを ついか')
  expect(screen.getByRole('status')).toHaveTextContent('さかみちの つぎに')
  expect(engine.options!.course.parts).toHaveLength(2)
  click('もどす')
  expect(engine.options!.course.parts).toHaveLength(1)
  click('ジャンプを ついか')
  expect(screen.getByRole('status')).toHaveTextContent('つづきを つなごう')
  click('スタート')
  const startId = engine.options!.course.startId
  click('クリア')
  click('もどす')
  expect(engine.options!.course.startId).toBe(startId)
})
