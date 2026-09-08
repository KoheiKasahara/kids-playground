import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { SnowSnapshot } from './useSnowballEngine'
import SnowballRoll from './SnowballRoll'

const engine = vi.hoisted(() => ({
  update: undefined as ((snapshot: SnowSnapshot) => void) | undefined,
  directionRef: { current: { x: 0, z: 0 } },
  status: 'ready' as 'ready' | 'error',
}))
vi.mock('./useSnowballEngine', () => ({
  INITIAL_SNAPSHOT: { count: 0, progress: 0, next: 'gift', message: 'どんぐりを あつめよう！', won: false },
  useSnowballEngine: (update: (snapshot: SnowSnapshot) => void) => {
    engine.update = update
    return { registerContainer: () => {}, status: engine.status, directionRef: engine.directionRef }
  },
}))
beforeEach(() => {
  engine.status = 'ready'
  engine.directionRef.current = { x: 0, z: 0 }
  vi.stubGlobal('PointerEvent', MouseEvent)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  HTMLElement.prototype.setPointerCapture = vi.fn()
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false)
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function start() {
  render(<MemoryRouter><SnowballRoll /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: /あそぶ/ }))
  return screen.getByRole('application')
}

test('start, keyboard play, success, replay and one-level back reset the game', () => {
  const field = start()
  fireEvent.keyDown(field, { key: 'ArrowRight' })
  expect(engine.directionRef.current.x).toBe(1)
  fireEvent.keyUp(field, { key: 'ArrowRight' })
  expect(engine.directionRef.current.x).toBe(0)
  act(() => engine.update!({ count: 48, progress: 1, next: null, message: 'やったー！', won: true }))
  expect(screen.getByRole('heading', { name: 'だいせいこう！' })).toBeInTheDocument()
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  fireEvent.click(screen.getByRole('button', { name: 'もういっかい あそぶ' }))
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  expect(screen.queryByRole('heading', { name: 'だいせいこう！' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /もどる/ }))
  expect(screen.getByRole('button', { name: /あそぶ/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /もどる/ })).toBeInTheDocument()
})

test('drag releases on cancel and keys do not remain held after app blur', () => {
  const field = start()
  fireEvent.pointerDown(field, { button: 0, clientX: 50, clientY: 50 })
  fireEvent.pointerMove(field, { clientX: 100, clientY: 50 })
  expect(engine.directionRef.current.x).toBe(1)
  fireEvent.pointerCancel(field)
  expect(engine.directionRef.current).toEqual({ x: 0, z: 0 })
  fireEvent.keyDown(field, { key: 'ArrowRight' })
  fireEvent(window, new Event('blur'))
  fireEvent.keyDown(field, { key: 'ArrowUp' })
  expect(engine.directionRef.current).toEqual({ x: 0, z: -1 })
  fireEvent.blur(field)
  expect(engine.directionRef.current).toEqual({ x: 0, z: 0 })
})

test('WebGL error provides retry and back, and disables movement', () => {
  engine.status = 'error'
  const field = start()
  expect(screen.getByRole('alert')).toHaveTextContent('3Dを ひょうじできなかったよ')
  fireEvent.keyDown(field, { key: 'ArrowRight' })
  expect(engine.directionRef.current.x).toBe(0)
  engine.status = 'ready'
  fireEvent.click(screen.getByRole('button', { name: 'もういちど' }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
