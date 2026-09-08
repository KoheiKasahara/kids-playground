import { afterEach, expect, test, vi } from 'vitest'
import { bindBentoPointer } from './bentoPointer'
const cleanups: (() => void)[] = []
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); document.body.innerHTML = '' })
function setup() {
  const host = document.createElement('div')
  document.body.append(host)
  let captured: number | null = null
  host.setPointerCapture = vi.fn(id => { captured = id })
  host.hasPointerCapture = id => captured === id
  host.releasePointerCapture = vi.fn(() => { captured = null })
  const callbacks = {
    enabled: () => true,
    hit: () => ({ id: 7, position: { x: 10, z: 20 } }),
    project: (event: PointerEvent) => ({ x: event.clientX, z: event.clientY }),
    select: vi.fn(), preview: vi.fn(), drop: vi.fn(), cancel: vi.fn(),
  }
  const binding = bindBentoPointer(host, callbacks)
  cleanups.push(binding.dispose)
  function pointer(type: string, x: number, y: number, id = 1, pointerType = 'touch') {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, { clientX: x, clientY: y, pointerId: id, button: 0, isPrimary: id === 1, pointerType })
    host.dispatchEvent(event)
    return event
  }
  return { host, callbacks, pointer, binding }
}
for (const type of ['touch', 'mouse']) test(`${type}: 掴んだ位置のずれを保ち、箱外で離しても1回確定する`, () => {
  const { host, callbacks, pointer } = setup()
  expect(pointer('pointerdown', 9, 18, 1, type).defaultPrevented).toBe(true)
  expect(host.setPointerCapture).toHaveBeenCalledWith(1)
  pointer('pointermove', 100, 200, 1, type)
  expect(callbacks.preview).toHaveBeenLastCalledWith(7, { x: 101, z: 202 })
  pointer('pointerup', 100, 200, 1, type)
  pointer('lostpointercapture', 100, 200, 1, type)
  expect(callbacks.drop).toHaveBeenCalledExactlyOnceWith(7, { x: 101, z: 202 })
  expect(callbacks.cancel).not.toHaveBeenCalled()
})
for (const event of ['pointercancel', 'lostpointercapture', 'blur']) test(`${event}で復元し次のドラッグもできる`, () => {
  const { callbacks, pointer } = setup()
  pointer('pointerdown', 0, 0)
  if (event === 'blur') window.dispatchEvent(new Event('blur'))
  else pointer(event, 0, 0)
  expect(callbacks.cancel).toHaveBeenCalledOnce()
  expect(callbacks.drop).not.toHaveBeenCalled()
  pointer('pointerdown', 0, 0)
  pointer('pointerup', 1, 1)
  expect(callbacks.drop).toHaveBeenCalledOnce()
})
test('2本目の指で横取りしない・dispose後はイベントが動かない', () => {
  const { callbacks, pointer, binding } = setup()
  pointer('pointerdown', 0, 0)
  pointer('pointerdown', 1, 1, 2)
  pointer('pointermove', 20, 20, 2)
  pointer('pointerup', 20, 20, 2)
  expect(callbacks.preview).not.toHaveBeenCalled()
  pointer('pointermove', 2, 2)
  expect(callbacks.preview).toHaveBeenCalledOnce()
  binding.dispose()
  pointer('pointerup', 2, 2)
  expect(callbacks.drop).not.toHaveBeenCalled()
})
