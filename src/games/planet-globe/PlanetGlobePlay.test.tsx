import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UsePlanetEngineOptions } from './types'
import App from '../../app/App'
import { resetSpeechEnabledCache } from '../../speech'
import { installSpeechSynthesisMock, uninstallSpeechSynthesisMock } from '../../test/speechSynthesisMock'
import type { SpeechSynthesisMock } from '../../test/speechSynthesisMock'

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
    expect(await screen.findByRole('heading', { name: /たいようけい/ }, { timeout: 3_000 }))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
  })

  it('shows eleven body buttons with moon selected initially and passed to the engine', async () => {
    renderApp('/games/planet-globe')
    await screen.findByRole('heading', { name: /たいようけい/ })

    const moonButton = screen.getByRole('button', { name: 'つき' })
    expect(moonButton).toHaveAttribute('aria-pressed', 'true')
    const otherNames = [
      'たいよう',
      'すいせい',
      'きんせい',
      'ちきゅう',
      'かせい',
      'もくせい',
      'どせい',
      'てんのうせい',
      'かいおうせい',
      'めいおうせい',
    ]
    for (const name of otherNames) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
    }
    expect(planetEngineMock.options?.body.id).toBe('moon')
    expect(planetEngineMock.options?.zoomLevel).toBe(0)
  })

  it('tracks the selected body and engine options across consecutive switches', async () => {
    const user = userEvent.setup()
    renderApp('/games/planet-globe')
    await screen.findByRole('heading', { name: /たいようけい/ })

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

  it('passes the correct feature spots for each body to the engine', async () => {
    const user = userEvent.setup()
    renderApp('/games/planet-globe')
    await screen.findByRole('heading', { name: /たいようけい/ })

    expect(planetEngineMock.options?.spots.map((spot) => spot.id)).toEqual(
      expect.arrayContaining(['moon-mare', 'moon-crater', 'moon-far-side']),
    )

    await user.click(screen.getByRole('button', { name: 'もくせい' }))
    expect(planetEngineMock.options?.spots.map((spot) => spot.id)).toEqual(
      expect.arrayContaining(['jupiter-great-red-spot', 'jupiter-belts', 'jupiter-gas']),
    )
  })

  it('shows the feature card with name and description when the engine selects a spot', async () => {
    const user = userEvent.setup()
    renderApp('/games/planet-globe')
    await screen.findByRole('heading', { name: /たいようけい/ })

    await user.click(screen.getByRole('button', { name: 'もくせい' }))
    act(() => {
      planetEngineMock.options?.onSpotSelect('jupiter-great-red-spot')
    })

    expect(screen.getByText('だいせきはん')).toBeInTheDocument()
    expect(
      screen.getByText('もくせいに ある、とても おおきな あらしだよ。ちきゅうより おおきいんだ。'),
    ).toBeInTheDocument()
  })

  it('closes the card when it is tapped', async () => {
    const user = userEvent.setup()
    renderApp('/games/planet-globe')
    await screen.findByRole('heading', { name: /たいようけい/ })

    act(() => {
      planetEngineMock.options?.onSpotSelect('moon-mare')
    })
    const card = await screen.findByRole('button', { name: /つきの うみ/ })

    await user.click(card)
    expect(screen.queryByText('つきの うみ')).not.toBeInTheDocument()
  })

  it('clears the selection and hides the card when switching bodies', async () => {
    const user = userEvent.setup()
    renderApp('/games/planet-globe')
    await screen.findByRole('heading', { name: /たいようけい/ })

    act(() => {
      planetEngineMock.options?.onSpotSelect('moon-mare')
    })
    expect(screen.getByText('つきの うみ')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'かせい' }))
    expect(screen.queryByText('つきの うみ')).not.toBeInTheDocument()
    expect(planetEngineMock.options?.selectedSpotId).toBeNull()
  })

  it('hides the card when the engine reports no spot selected', async () => {
    renderApp('/games/planet-globe')
    await screen.findByRole('heading', { name: /たいようけい/ })

    act(() => {
      planetEngineMock.options?.onSpotSelect('moon-crater')
    })
    expect(screen.getByText('クレーター')).toBeInTheDocument()

    act(() => {
      planetEngineMock.options?.onSpotSelect(null)
    })
    expect(screen.queryByText('クレーター')).not.toBeInTheDocument()
  })

  it('switches to Phase 4で追加した天体 and passes their kind/spots to the engine', async () => {
    const user = userEvent.setup()
    renderApp('/games/planet-globe')
    await screen.findByRole('heading', { name: /たいようけい/ })

    await user.click(screen.getByRole('button', { name: 'たいよう' }))
    expect(planetEngineMock.options?.body.id).toBe('sun')
    expect(planetEngineMock.options?.body.kind).toBe('star')
    expect(planetEngineMock.options?.spots.map((spot) => spot.id)).toEqual(
      expect.arrayContaining(['sun-self-lit', 'sun-sunspot']),
    )

    await user.click(screen.getByRole('button', { name: 'ちきゅう' }))
    expect(planetEngineMock.options?.body.id).toBe('earth')
    expect(planetEngineMock.options?.body.kind).toBe('planet')
    expect(planetEngineMock.options?.spots.map((spot) => spot.id)).toEqual(
      expect.arrayContaining(['continent-asia', 'ocean-pacific', 'earth-north-pole', 'earth-south-pole']),
    )

    await user.click(screen.getByRole('button', { name: 'めいおうせい' }))
    expect(planetEngineMock.options?.body.id).toBe('pluto')
    expect(planetEngineMock.options?.body.kind).toBe('dwarf-planet')
  })
})

describe('PlanetGlobePlay のよみあげ挙動', () => {
  let mock: SpeechSynthesisMock

  beforeEach(() => {
    localStorage.clear()
    resetSpeechEnabledCache()
    mock = installSpeechSynthesisMock()
  })

  afterEach(() => {
    uninstallSpeechSynthesisMock()
  })

  it('よみあげONのとき、スポット選択で特徴名＋説明が読み上げられる', async () => {
    const user = userEvent.setup()
    renderApp('/games/planet-globe')
    await screen.findByRole('heading', { name: /たいようけい/ })

    await user.click(screen.getByRole('button', { name: /よみあげ/ }))

    act(() => {
      planetEngineMock.options?.onSpotSelect('moon-mare')
    })

    expect(mock.spoken).toEqual([
      'つきの うみ。くろく みえる たいらな ところだよ。うみと よばれるけど、みずは ないんだ。',
    ])
  })

  it('よみあげOFF(既定)のときは、スポットを選んでも読み上げられない', async () => {
    renderApp('/games/planet-globe')
    await screen.findByRole('heading', { name: /たいようけい/ })

    act(() => {
      planetEngineMock.options?.onSpotSelect('moon-mare')
    })

    expect(mock.spoken).toEqual([])
  })
})
