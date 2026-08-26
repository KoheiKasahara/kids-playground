import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UsePlanetEngineOptions } from './types'
import App from '../../app/App'

const planetEngineMock = vi.hoisted(() => ({
  options: undefined as UsePlanetEngineOptions | undefined,
}))

vi.mock('./three/usePlanetEngine', () => ({
  usePlanetEngine: (options: UsePlanetEngineOptions) => {
    planetEngineMock.options = options
    return { registerContainer: () => undefined }
  },
}))

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
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
  planetEngineMock.options = undefined
})

describe('PlanetGlobePlay', () => {
  it('opens from the planet-globe route with the main controls', async () => {
    renderApp('/games/planet-globe')

    // three.js を含む lazy route は、初回のモジュール評価だけ標準の1秒をわずかに超えることがある。
    expect(await screen.findByRole('heading', { name: /わくせいぎ/ }, { timeout: 3_000 }))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
  })

  it('shows four body buttons with moon selected initially and passed to the engine', async () => {
    renderApp('/games/planet-globe')
    await screen.findByRole('heading', { name: /わくせいぎ/ })

    const moonButton = screen.getByRole('button', { name: 'つき' })
    expect(moonButton).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'かせい' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'もくせい' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'どせい' })).toHaveAttribute('aria-pressed', 'false')
    expect(planetEngineMock.options?.body.id).toBe('moon')
    expect(planetEngineMock.options?.zoomLevel).toBe(0)
  })

  it('tracks the selected body and engine options across consecutive switches', async () => {
    const user = userEvent.setup()
    renderApp('/games/planet-globe')
    await screen.findByRole('heading', { name: /わくせいぎ/ })

    await user.click(screen.getByRole('button', { name: 'かせい' }))
    expect(planetEngineMock.options?.body.id).toBe('mars')
    expect(screen.getByRole('button', { name: 'かせい' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'つき' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'もくせい' }))
    expect(planetEngineMock.options?.body.id).toBe('jupiter')
    expect(screen.getByRole('button', { name: 'もくせい' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'かせい' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'どせい' }))
    expect(planetEngineMock.options?.body.id).toBe('saturn')
    expect(screen.getByRole('button', { name: 'どせい' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'もくせい' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'つき' }))
    expect(planetEngineMock.options?.body.id).toBe('moon')
    expect(screen.getByRole('button', { name: 'つき' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'どせい' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('clamps zoom controls at both ends of the four-level range', async () => {
    const user = userEvent.setup()
    renderApp('/games/planet-globe')

    const zoomInButton = await screen.findByRole('button', { name: 'もっと ちかづく' })
    const zoomOutButton = screen.getByRole('button', { name: 'もっと はなれる' })

    expect(zoomOutButton).toBeDisabled()
    expect(planetEngineMock.options?.zoomLevel).toBe(0)

    await user.click(zoomInButton)
    expect(zoomOutButton).toBeEnabled()
    await user.click(zoomInButton)
    await user.click(zoomInButton)
    expect(planetEngineMock.options?.zoomLevel).toBe(3)
    expect(zoomInButton).toBeDisabled()

    await user.click(zoomInButton)
    expect(planetEngineMock.options?.zoomLevel).toBe(3)

    await user.click(zoomOutButton)
    expect(planetEngineMock.options?.zoomLevel).toBe(2)
  })

  it('resets zoom to level 0 when switching to a different body', async () => {
    const user = userEvent.setup()
    renderApp('/games/planet-globe')

    const zoomInButton = await screen.findByRole('button', { name: 'もっと ちかづく' })
    await user.click(zoomInButton)
    await user.click(zoomInButton)
    expect(planetEngineMock.options?.zoomLevel).toBe(2)

    await user.click(screen.getByRole('button', { name: 'もくせい' }))
    expect(planetEngineMock.options?.zoomLevel).toBe(0)
    expect(screen.getByRole('button', { name: 'もっと はなれる' })).toBeDisabled()
  })

  it('returns home from the viewer', async () => {
    const user = userEvent.setup()
    renderApp('/games/planet-globe')

    await user.click(await screen.findByRole('button', { name: 'もどる' }))

    expect(await screen.findByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
  })
})
