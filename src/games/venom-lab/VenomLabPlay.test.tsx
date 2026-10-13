import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import VenomLabPlay from './VenomLabPlay'
import App from '../../app/App'
import { isSoundEnabled } from '../../audio/sound'
import { SPECIES } from './data'

beforeEach(() => { localStorage.clear(); vi.spyOn(window, 'scrollTo').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

const openLab = () => render(<MemoryRouter><VenomLabPlay /></MemoryRouter>)
const area = () => screen.getByRole('group', { name: 'かんさつエリア' })
const animalButtons = () => within(area()).getAllByRole('button')

describe('どくの いきものラボ', () => {
  test('observe, add another of the same species, remove one, and preserve each habitat', () => {
    openLab()
    expect(animalButtons()).toHaveLength(3)
    fireEvent.click(animalButtons()[0])
    expect(screen.getByRole('heading', { name: 'ヒョウモンダコのなかま' })).toBeVisible()
    expect(screen.getByLabelText('かんさつずかん 1 / 9')).toBeVisible()
    fireEvent.click(screen.getByText('毒のひみつ・出典をみる'))
    expect(screen.getByRole('link', { name: /海洋科学研究所/ })).toHaveAttribute('href', SPECIES[0].source.url)
    fireEvent.click(screen.getByRole('button', { name: 'ヒョウモンダコのなかまを ふやす' }))
    expect(animalButtons()).toHaveLength(4)
    fireEvent.click(animalButtons()[3])
    expect(screen.getByLabelText('かんさつずかん 1 / 9')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /この1ぴきを もどす/ }))
    expect(animalButtons()).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: /AREA 02 あめのもり/ }))
    expect(animalButtons().every(button => button.getAttribute('aria-label')?.includes('ガエル'))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'モウドクフキヤガエルを ふやす' }))
    fireEvent.click(screen.getByRole('button', { name: /AREA 01 サンゴのうみ/ }))
    expect(animalButtons()).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: /AREA 02 あめのもり/ }))
    expect(animalButtons()).toHaveLength(4)
  })

  test('capacity prevents adding, and removing the selected animal opens a place', () => {
    openLab()
    const add = screen.getByRole('button', { name: 'ヒョウモンダコのなかまを ふやす' })
    for (let i = 0; i < 8; i++) fireEvent.click(add)
    expect(animalButtons()).toHaveLength(9)
    expect(add).toBeDisabled()
    fireEvent.click(animalButtons()[0])
    fireEvent.click(screen.getByRole('button', { name: /この1ぴきを もどす/ }))
    expect(add).toBeEnabled()
    fireEvent.click(add)
    expect(animalButtons()).toHaveLength(9)
  })

  test('ranking explains its limits and opens the right habitat and facts', () => {
    openLab()
    fireEvent.click(screen.getByRole('button', { name: /毒のつよさランキング/ }))
    expect(screen.getByText(/科学的な順位ではありません/)).toBeVisible()
    const entries = screen.getAllByRole('button', { name: /の かいせつをみる/ })
    expect(entries).toHaveLength(SPECIES.length)
    fireEvent.click(screen.getByRole('button', { name: 'アメリカドクトカゲの かいせつをみる' }))
    expect(screen.getByRole('heading', { name: 'ソノラのさばく' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'アメリカドクトカゲ' })).toBeVisible()
    expect(screen.getByLabelText('かんさつずかん 1 / 9')).toBeVisible()
  })

  test('all habitats can be observed to complete the notebook, which survives reopening', () => {
    const view = openLab()
    for (const name of [/AREA 01 サンゴのうみ/, /AREA 02 あめのもり/, /AREA 03 ソノラのさばく/]) {
      fireEvent.click(screen.getByRole('button', { name }))
      for (const button of animalButtons()) fireEvent.click(button)
    }
    expect(screen.getByRole('status')).toHaveTextContent('ずかん かんせい')
    view.unmount()
    openLab()
    expect(screen.getByLabelText('かんさつずかん 9 / 9')).toBeVisible()
  })

  test('empty exhibit can be repopulated, and pause and mute are controllable', () => {
    const view = openLab()
    for (let i = 0; i < 3; i++) {
      fireEvent.click(animalButtons()[0])
      fireEvent.click(screen.getByRole('button', { name: /この1ぴきを もどす/ }))
    }
    expect(within(area()).queryAllByRole('button')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'オニダルマオコゼを ふやす' }))
    expect(animalButtons()).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /とめてみる/ }))
    expect(area()).toHaveAttribute('data-paused', 'true')
    fireEvent.click(screen.getByRole('button', { name: /うごかす/ }))
    expect(area()).toHaveAttribute('data-paused', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'おと' }))
    expect(isSoundEnabled()).toBe(false)
    view.unmount()
    expect(isSoundEnabled()).toBe(true)
  })

  test('damaged or unavailable storage does not prevent observation', () => {
    localStorage.setItem('venom-lab-observed-v1', '{broken')
    const view = openLab()
    expect(screen.getByLabelText('かんさつずかん 0 / 9')).toBeVisible()
    view.unmount()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    openLab()
    fireEvent.click(animalButtons()[0])
    expect(screen.getByLabelText('かんさつずかん 1 / 9')).toBeVisible()
  })

  test('direct route has one back button and returns to the home catalog', async () => {
    render(<MemoryRouter initialEntries={['/games/venom-lab']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'どくの いきものラボ' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'もどる' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(await screen.findByRole('heading', { name: 'こどもミニゲーム' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'どくの いきものラボ' })).toHaveAttribute('href', '/games/venom-lab')
  })
})
