import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UseGlobeEngineOptions } from './types'
import App from '../../app/App'

const globeEngineMock = vi.hoisted(() => ({
  status: 'ready' as 'loading' | 'ready' | 'error',
  options: undefined as UseGlobeEngineOptions | undefined,
}))

vi.mock('./three/useGlobeEngine', () => ({
  useGlobeEngine: (options: UseGlobeEngineOptions) => {
    globeEngineMock.options = options
    return { registerContainer: () => undefined, status: globeEngineMock.status }
  },
}))

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  )
}

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  })
})

afterEach(() => {
  globeEngineMock.status = 'ready'
  globeEngineMock.options = undefined
})

describe('EarthGlobePlay', () => {
  it('keeps the incomplete globe and controls hidden until ready', async () => {
    globeEngineMock.status = 'loading'
    const view = renderApp('/games/earth-globe')
    await screen.findByRole('heading', { name: 'ちきゅうぎ' })
    expect(screen.getByRole('status')).toHaveTextContent('よみこみちゅう')
    expect(screen.queryByRole('button', { name: 'もっと ちかづく' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeEnabled()
    globeEngineMock.status = 'ready'
    view.rerender(
      <MemoryRouter initialEntries={['/games/earth-globe']}>
        <App key={globeEngineMock.status} />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もっと ちかづく' })).toBeEnabled()
  })

  it('shows an error instead of endless loading if WebGL initialization fails', async () => {
    globeEngineMock.status = 'error'
    renderApp('/games/earth-globe')
    expect(await screen.findByRole('alert')).toHaveTextContent('うまく よみこめませんでした')
    expect(screen.getByRole('button', { name: 'もどる' })).toBeEnabled()
  })

  it('opens from the earth-globe route with the main controls', async () => {
    renderApp('/games/earth-globe')

    // three.js と世界地図データを含む lazy route は、初回のモジュール評価だけ
    // 標準の1秒をわずかに超えることがある。
    expect(await screen.findByRole('heading', { name: 'ちきゅうぎ' }, { timeout: 3_000 }))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もっと ちかづく' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'もっと はなれる' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'ぜんたいに もどる' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
    expect(globeEngineMock.options?.zoomLevel).toBe(0)
  })

  it('clamps zoom controls at both ends of the four-level range', async () => {
    const user = userEvent.setup()
    renderApp('/games/earth-globe')

    const zoomInButton = await screen.findByRole('button', { name: 'もっと ちかづく' })
    const zoomOutButton = screen.getByRole('button', { name: 'もっと はなれる' })

    expect(zoomOutButton).toBeDisabled()

    await user.click(zoomInButton)
    expect(zoomOutButton).toBeEnabled()
    await user.click(zoomInButton)
    await user.click(zoomInButton)
    expect(globeEngineMock.options?.zoomLevel).toBe(3)
    expect(zoomInButton).toBeDisabled()

    await user.click(zoomInButton)
    expect(globeEngineMock.options?.zoomLevel).toBe(3)

    await user.click(zoomOutButton)
    expect(globeEngineMock.options?.zoomLevel).toBe(2)
  })

  it('shows the selected country flag and name when the engine selects a country', async () => {
    renderApp('/games/earth-globe')
    await screen.findByRole('heading', { name: 'ちきゅうぎ' })

    act(() => {
      globeEngineMock.options?.onCountrySelect('jp')
    })

    expect(screen.getByText('にほん')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /にほん/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /にほん/ }).querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('flags/jp.svg'),
    )
  })

  it('replays selection feedback when the same country is tapped again', async () => {
    renderApp('/games/earth-globe')
    await screen.findByRole('heading', { name: 'ちきゅうぎ' })

    act(() => {
      globeEngineMock.options?.onCountrySelect('jp')
    })
    expect(globeEngineMock.options?.selectionFeedbackKey).toBe(1)

    act(() => {
      globeEngineMock.options?.onCountrySelect('jp')
    })
    expect(globeEngineMock.options?.selectionFeedbackKey).toBe(2)
  })

  it('returns home from the viewer', async () => {
    const user = userEvent.setup()
    renderApp('/games/earth-globe')

    await user.click(await screen.findByRole('button', { name: 'もどる' }))

    expect(await screen.findByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
  })
})
