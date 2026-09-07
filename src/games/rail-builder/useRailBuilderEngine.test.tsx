import type { Camera, Scene } from 'three'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { createRailPiece, type RailPiece } from './railModel'
import { useRailBuilderEngine, type RailBuilderEngineHandle } from './useRailBuilderEngine'

// 描画だけを置換し、実際のイベントリスナー・カメラ・操作状態を検証する。
vi.mock('three', async (importOriginal) => ({
  ...await importOriginal<typeof import('three')>(),
  WebGLRenderer: class {
    domElement = document.createElement('canvas')
    shadowMap = {}
    setPixelRatio() {}
    setClearColor() {}
    setSize() {}
    render(scene: Scene, camera: Camera) {
      scene.updateMatrixWorld()
      camera.updateMatrixWorld()
    }
    dispose() {}
    forceContextLoss() {}
  },
}))

afterEach(() => { cleanup(); vi.restoreAllMocks() })

function setup(pieces: RailPiece[] = []) {
  let frame!: FrameRequestCallback
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frame = callback; return 1 })
  let engine!: RailBuilderEngineHandle
  const onPiecesChange = vi.fn()
  const onSelectPiece = vi.fn()
  const onZoomChange = vi.fn()
  function Harness() {
    engine = useRailBuilderEngine({
      pieces, selectedPieceId: null, selectedTrainId: null, zoom: 1,
      onPiecesChange, onSelectPiece, onSelectTrain: vi.fn(), onZoomChange,
      soundEnabled: false,
    })
    return <div ref={engine.registerContainer} data-testid="scene" />
  }
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600,
    toJSON: () => ({}),
  })
  const { getByTestId, unmount } = render(<Harness />)
  act(() => frame(0))
  const host = getByTestId('scene')
  const capture = vi.fn()
  Object.assign(host, { setPointerCapture: capture, releasePointerCapture: vi.fn() })
  function pointer(type: string, id: number, x = 200, primary = true, target: EventTarget = host) {
    act(() => {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.assign(event, { pointerId: id, clientX: x, clientY: 300, button: 0, isPrimary: primary, pointerType: 'touch' })
      target.dispatchEvent(event)
    })
  }
  function expectPan(id = 9, primary = true) {
    const before = engine.getCameraTarget()
    pointer('pointerdown', id, 200, primary)
    expect(onSelectPiece).toHaveBeenLastCalledWith(null)
    pointer('pointermove', id, 240)
    expect(engine.getCameraTarget()).not.toEqual(before)
    pointer('pointerup', id, 240)
  }
  return { host, pointer, expectPan, capture, onZoomChange, onPiecesChange, onSelectPiece, unmount }
}

describe('線路づくりの操作中断からの復帰', () => {
  test('終了通知が欠落しても新しい主ポインターでパン・選択を再開できる', () => {
    const { pointer, expectPan } = setup()
    pointer('pointerdown', 1)
    expectPan()
  })

  test('captureを失った指が残らず、非主ポインターでもパンを開始できる', () => {
    const { pointer, onZoomChange, expectPan } = setup()
    pointer('pointerdown', 1)
    pointer('lostpointercapture', 1)
    expectPan(2, false)
    expect(onZoomChange).not.toHaveBeenCalled()
  })

  test('capture失敗後にhost外で指を離しても古い接触が残らない', () => {
    const { pointer, capture, onZoomChange, expectPan } = setup()
    capture.mockImplementation(() => { throw new Error('capture unavailable') })
    pointer('pointerdown', 1)
    pointer('pointerup', 1, 200, true, window)
    expectPan(2, false)
    expect(onZoomChange).not.toHaveBeenCalled()
  })

  test.each(['blur', 'hidden'])('%sで全接触を解除する', (reason) => {
    const { pointer, onZoomChange, expectPan } = setup()
    pointer('pointerdown', 1)
    act(() => {
      if (reason === 'blur') window.dispatchEvent(new Event('blur'))
      else {
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
        document.dispatchEvent(new Event('visibilitychange'))
      }
    })
    expectPan(2, false)
    expect(onZoomChange).not.toHaveBeenCalled()
  })

  test('中断したレール移動を確定せず、次のドラッグで配置を確定できる', () => {
    const pieces = [
      createRailPiece('straight', 'train-track', { x: -20, y: 0, z: -20 }),
      createRailPiece('straight', 'movable'),
    ]
    const { pointer, onPiecesChange, onSelectPiece } = setup(pieces)
    pointer('pointerdown', 1)
    expect(onSelectPiece).toHaveBeenLastCalledWith('movable')
    pointer('pointermove', 1, 220)
    pointer('lostpointercapture', 1, 220)
    expect(onPiecesChange).not.toHaveBeenCalled()
    pointer('pointerdown', 2)
    pointer('pointermove', 2, 230)
    pointer('pointerup', 2, 230)
    // 正常なrelease後のlostpointercaptureでも確定を取り消さない。
    pointer('lostpointercapture', 2, 230)
    expect(onPiecesChange).toHaveBeenCalledTimes(1)
    expect(onPiecesChange.mock.calls[0]![0][1].position).not.toEqual(pieces[1]!.position)
  })

  test('正常な2本指ズームと、その後の1本指操作を維持する', () => {
    const { pointer, onZoomChange, expectPan } = setup()
    pointer('pointerdown', 1, 100)
    pointer('pointerdown', 2, 200, false)
    pointer('pointermove', 2, 230, false)
    expect(onZoomChange).toHaveBeenCalled()
    pointer('pointerup', 2, 230, false)
    pointer('pointerup', 1, 100)
    expectPan()
  })
})
