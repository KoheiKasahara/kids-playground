import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { celestialBodies } from '../data/celestialBodies'
import type { CelestialBodyId } from '../types'
import BodySelector from './BodySelector'

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView

function ControlledBodySelector() {
  const [selectedId, setSelectedId] = useState<CelestialBodyId>('moon')
  return <BodySelector bodies={celestialBodies} selectedId={selectedId} onSelect={setSelectedId} />
}

describe('BodySelector', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    if (originalScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: originalScrollIntoView,
      })
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
    }
  })

  it('選択中のカードを横スクロールで見える位置へ移動する', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    })
    const user = userEvent.setup()

    render(<ControlledBodySelector />)

    await user.click(screen.getByRole('button', { name: 'めいおうせい' }))

    expect(scrollIntoView).toHaveBeenCalledTimes(2)
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  })

  it('11天体を1列の選択肢として表示し、選択状態を通知する', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()

    render(<BodySelector bodies={celestialBodies} selectedId="moon" onSelect={onSelect} />)

    expect(screen.getAllByRole('button')).toHaveLength(celestialBodies.length)
    expect(screen.getByRole('button', { name: 'つき' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'てんのうせい' }))

    expect(onSelect).toHaveBeenCalledWith('uranus')
  })
})
