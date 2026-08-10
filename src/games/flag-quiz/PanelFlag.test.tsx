import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import PanelFlag, { PANEL_COLUMNS, PANEL_COUNT } from './PanelFlag'
import { countries } from './data/countries'

const sampleCountry = countries[0]

describe('PanelFlag', () => {
  test('PANEL_COUNT (16) 枚のパネルが表示される', () => {
    render(<PanelFlag country={sampleCountry} openedPanels={[]} />)
    for (let i = 0; i < PANEL_COUNT; i += 1) {
      expect(screen.getByTestId(`panel-${i}`)).toBeInTheDocument()
    }
  })

  test('4列 × 4行になる（PANEL_COUNT / PANEL_COLUMNS === 4）', () => {
    expect(PANEL_COUNT).toBe(16)
    expect(PANEL_COLUMNS).toBe(4)
    expect(PANEL_COUNT / PANEL_COLUMNS).toBe(4)
  })

  test('openedPanels に含まれる index のパネルだけ data-open="true" になる', () => {
    render(<PanelFlag country={sampleCountry} openedPanels={[0, 3, 5]} />)
    for (let i = 0; i < PANEL_COUNT; i += 1) {
      const expected = [0, 3, 5].includes(i) ? 'true' : 'false'
      expect(screen.getByTestId(`panel-${i}`)).toHaveAttribute('data-open', expected)
    }
  })

  test('openedPanels が空のときは1枚も開いていない', () => {
    render(<PanelFlag country={sampleCountry} openedPanels={[]} />)
    for (let i = 0; i < PANEL_COUNT; i += 1) {
      expect(screen.getByTestId(`panel-${i}`)).toHaveAttribute('data-open', 'false')
    }
  })

  test('revealAll が true のときは openedPanels に関わらず全パネルが開く', () => {
    render(<PanelFlag country={sampleCountry} openedPanels={[]} revealAll />)
    for (let i = 0; i < PANEL_COUNT; i += 1) {
      expect(screen.getByTestId(`panel-${i}`)).toHaveAttribute('data-open', 'true')
    }
  })

  test('パネルは答えに関わらない装飾要素なので aria-hidden="true" が付く', () => {
    render(<PanelFlag country={sampleCountry} openedPanels={[]} />)
    for (let i = 0; i < PANEL_COUNT; i += 1) {
      expect(screen.getByTestId(`panel-${i}`)).toHaveAttribute('aria-hidden', 'true')
    }
  })

  test('国旗画像が1枚だけ表示される（画像の分割生成はしない）', () => {
    const { container } = render(<PanelFlag country={sampleCountry} openedPanels={[]} />)
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(1)
    expect(images[0].getAttribute('src')).toContain(sampleCountry.flag)
    expect(images[0].getAttribute('alt')).toBe('')
  })
})
