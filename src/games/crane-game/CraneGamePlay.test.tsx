import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import CraneGamePlay from './CraneGamePlay'
import type { CraneFeedback } from './useCraneGameEngine'

type EngineOptions = Parameters<typeof import('./useCraneGameEngine').useCraneGameEngine>[0]
const engine = vi.hoisted(() => ({ move: vi.fn(), grab: vi.fn(), retry: vi.fn(), options: null as unknown as EngineOptions }))
vi.mock('./useCraneGameEngine', () => ({
  useCraneGameEngine: (options: EngineOptions) => {
    engine.options = options
    return { registerContainer: () => {}, registerMapMarker: () => {}, retry: engine.retry, move: engine.move, grab: engine.grab }
  },
}))

const READY: CraneFeedback = { phase: 'idle', axis: null, holding: false, ready: true, remaining: 14, collected: 0 }
beforeEach(() => { vi.clearAllMocks() })

const show = () => render(<MemoryRouter><CraneGamePlay /></MemoryRouter>)
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const ready = (feedback: Partial<CraneFeedback> = {}) => act(() => {
  engine.options.onStatus('ready')
  engine.options.onFeedback({ ...READY, ...feedback })
})

function start(feedback: Partial<CraneFeedback> = {}) {
  show()
  ready(feedback)
  click('あそぶ！')
}

it('きかいを えらんで あそびはじめられる', () => {
  show()
  expect(screen.getByRole('button', { name: 'あそぶ！' })).toBeDisabled()
  ready()
  for (const label of ['ぬいぐるみ', 'カプセル', 'おかし']) {
    expect(screen.getByRole('button', { name: `${label}の きかいを えらぶ` })).toBeEnabled()
  }
  expect(screen.getByRole('button', { name: 'ぬいぐるみの きかいを えらぶ' })).toHaveAttribute('aria-pressed', 'true')
  click('カプセルの きかいを えらぶ')
  expect(engine.options.machine.id).toBe('capsule')
  expect(screen.getByRole('status')).toHaveTextContent('すきな きかいを えらんでね')
  click('あそぶ！')
  expect(screen.getByRole('button', { name: 'つかむ' })).toBeEnabled()
  expect(screen.getByRole('status')).toHaveTextContent('ボタンか ケースを タップして')
})

it('よこ・おくのボタンでアームを動かし、押している軸がわかる', () => {
  start()
  click('よこに うごかす')
  expect(engine.move).toHaveBeenCalledWith('x')
  act(() => engine.options.onFeedback({ ...READY, axis: 'x' }))
  const moving = screen.getByRole('button', { name: 'よこに うごくのを とめる' })
  expect(moving).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(moving)
  expect(engine.move).toHaveBeenCalledTimes(2)
  click('おくに うごかす')
  expect(engine.move).toHaveBeenLastCalledWith('z')
})

it('つかむボタンは、アームが動いている間はおせない', () => {
  start()
  click('つかむ')
  expect(engine.grab).toHaveBeenCalledOnce()
  act(() => engine.options.onFeedback({ ...READY, phase: 'descend' }))
  expect(screen.getByRole('button', { name: 'つかむ' })).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('アームが おりていく')
  act(() => engine.options.onFeedback({ ...READY, phase: 'lift', holding: true }))
  expect(screen.getByRole('status')).toHaveTextContent('もちあげた！')
  act(() => engine.options.onFeedback(READY))
  expect(screen.getByRole('button', { name: 'つかむ' })).toBeEnabled()
})

it('けいひんが取れたら、数と絵が増える', () => {
  start()
  act(() => engine.options.onEvent({ kind: 'caught', prize: 'p1', label: 'くまさん', emoji: '🧸', species: 'bear', position: { x: 0, y: 0, z: 0 } }))
  expect(screen.getByRole('status')).toHaveTextContent('ゲット！ くまさんが とれたよ！')
  expect(screen.getByLabelText('とれた けいひん 1こ')).toHaveTextContent('1こ')
  act(() => engine.options.onEvent({ kind: 'caught', prize: 'p2', label: 'ひよこ', emoji: '🐥', species: 'chick', position: { x: 0, y: 0, z: 0 } }))
  expect(screen.getByLabelText('とれた けいひん 2こ')).toHaveTextContent('2こ')
})

it('すべったり からぶりしたりしても、やさしく知らせる', () => {
  start()
  act(() => engine.options.onEvent({ kind: 'slip', prize: 'p1', label: 'くまさん', position: { x: 0, y: 0, z: 0 } }))
  expect(screen.getByRole('status')).toHaveTextContent('すべっちゃった')
  act(() => engine.options.onEvent({ kind: 'miss' }))
  expect(screen.getByRole('status')).toHaveTextContent('つかめなかった')
  act(() => engine.options.onEvent({ kind: 'grip', prize: 'p1', label: 'くまさん', emoji: '🧸' }))
  expect(screen.getByRole('status')).not.toHaveTextContent('つかめなかった')
})

it('ならべなおすと、機械の並べ直しを頼む', () => {
  start()
  expect(engine.options.round).toBe(0)
  click('けいひんを ならべなおす')
  expect(engine.options.round).toBe(1)
  expect(screen.getByRole('status')).toHaveTextContent('ならべなおしたよ')
})

it('のこりが0になったら、ならべなおしを すすめる', () => {
  start({ remaining: 0 })
  expect(screen.getByText('ぜんぶ とれた！ ならべるを おしてね')).toBeInTheDocument()
})

it('見る向きを まえ・よこに 切り替えられる', () => {
  start()
  expect(screen.getByRole('button', { name: 'まえから みる' })).toHaveAttribute('aria-pressed', 'true')
  click('よこから みる')
  expect(engine.options.view).toBe('side')
  expect(screen.getByRole('button', { name: 'よこから みる' })).toHaveAttribute('aria-pressed', 'true')
})

it('きかいボタンと もどるで、えらびなおしに戻れる', () => {
  start()
  click('きかいを えらびなおす')
  expect(screen.getByRole('button', { name: 'あそぶ！' })).toBeInTheDocument()
  click('あそぶ！')
  fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
  expect(screen.getByRole('button', { name: 'あそぶ！' })).toBeInTheDocument()
})

it('読み込みに失敗したら、もういちどで やりなおせる', () => {
  show()
  act(() => engine.options.onStatus('error'))
  expect(screen.getByRole('alert')).toHaveTextContent('きかいを よみこめなかったよ')
  expect(screen.getByRole('button', { name: 'あそぶ！' })).toBeDisabled()
  click('もういちど')
  expect(engine.retry).toHaveBeenCalledOnce()
})

it('けいひんを ならべている間は つかめない', () => {
  start({ ready: false })
  expect(screen.getByRole('button', { name: 'つかむ' })).toBeDisabled()
  expect(screen.getByRole('status')).toHaveTextContent('けいひんを ならべているよ')
})

it('おとを 消したり つけたり できる', () => {
  show()
  const sound = screen.getByRole('button', { name: 'おと' })
  expect(sound).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(sound)
  expect(sound).toHaveAttribute('aria-pressed', 'false')
})
