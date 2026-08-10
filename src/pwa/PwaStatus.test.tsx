import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import PwaStatus from './PwaStatus'
import {
  __resetPwaRegisterStub,
  __setMockRegistration,
  __setNeedRefresh,
  __setOfflineReady,
  updateServiceWorkerMock,
} from '../test/pwaRegisterStub'

function createMockRegistration(): ServiceWorkerRegistration {
  return {
    update: vi.fn().mockResolvedValue(undefined),
  } as unknown as ServiceWorkerRegistration
}

// visibilitychange のテストで document.visibilityState を書き換えるためのヘルパー。
// テスト後に必ず元の定義に戻す。
function setVisibilityState(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => value,
  })
}

describe('PwaStatus', () => {
  const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(
    Document.prototype,
    'visibilityState',
  )

  beforeEach(() => {
    localStorage.clear()
    __resetPwaRegisterStub()
  })

  afterEach(() => {
    if (originalVisibilityDescriptor) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityDescriptor)
    }
    vi.useRealTimers()
  })

  test('初期状態では何も表示されない', () => {
    const { container } = render(<PwaStatus />)
    expect(container).toBeEmptyDOMElement()
  })

  test('更新が検知されると案内文と「こうしんする」ボタンが表示される', async () => {
    render(<PwaStatus />)

    act(() => {
      __setNeedRefresh(true)
    })

    expect(await screen.findByText('あたらしい バージョンが あります')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'こうしんする' })).toBeInTheDocument()
  })

  test('「こうしんする」を押すと updateServiceWorker が true 付きで1回呼ばれる', async () => {
    const user = userEvent.setup()
    render(<PwaStatus />)

    act(() => {
      __setNeedRefresh(true)
    })

    await user.click(await screen.findByRole('button', { name: 'こうしんする' }))

    expect(updateServiceWorkerMock).toHaveBeenCalledTimes(1)
    expect(updateServiceWorkerMock).toHaveBeenCalledWith(true)
  })

  test('onRegisteredSW が呼ばれると起動時に1回 registration.update() が実行される', async () => {
    const registration = createMockRegistration()
    __setMockRegistration(registration)

    render(<PwaStatus />)

    await waitFor(() => {
      expect(registration.update).toHaveBeenCalledTimes(1)
    })
  })

  test('visibilitychange で visible になると registration.update() が追加で呼ばれる', async () => {
    const registration = createMockRegistration()
    __setMockRegistration(registration)

    render(<PwaStatus />)

    await waitFor(() => {
      expect(registration.update).toHaveBeenCalledTimes(1)
    })

    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    // hidden への切り替わりでは追加確認しない。
    expect(registration.update).toHaveBeenCalledTimes(1)

    setVisibilityState('visible')
    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => {
      expect(registration.update).toHaveBeenCalledTimes(2)
    })
  })

  test('60分経過すると registration.update() が呼ばれる', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const registration = createMockRegistration()
    __setMockRegistration(registration)

    render(<PwaStatus />)

    expect(registration.update).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    })

    expect(registration.update).toHaveBeenCalledTimes(2)

    // このテストでは user は未使用だが、fake timers 併用時の setup 手順を明示するために残す。
    void user
  })

  test('registration が undefined でも例外を投げない', () => {
    __setMockRegistration(undefined)
    expect(() => render(<PwaStatus />)).not.toThrow()
  })

  test('オフライン準備完了トーストが表示される（既存挙動）', async () => {
    render(<PwaStatus />)

    act(() => {
      __setOfflineReady(true)
    })

    expect(
      await screen.findByText('オフラインでも あそべるように なりました'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'とじる' })).toBeInTheDocument()
  })
})
