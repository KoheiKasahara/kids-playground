import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import RhythmPlay from './RhythmPlay'
import { MODE_RULES, buildRhythmChart, type RhythmMode } from './rhythmChart'
import { findRhythmSong, melodyForRhythmSong } from './rhythmSongs'

function renderGame() {
  return render(<MemoryRouter initialEntries={['/games/rhythm-pon']}><RhythmPlay /></MemoryRouter>)
}

function chartFor(songId: string, mode: RhythmMode) {
  const song = findRhythmSong(songId)!
  const chart = buildRhythmChart(melodyForRhythmSong(song), song.tempoBpm, mode)
  const leadIn = Math.max(MODE_RULES[mode].approachMs + 500, chart.beatMs * 4.2)
  return { chart, leadIn }
}

describe('RhythmPlay', () => {
  const originalAudioContext = window.AudioContext

  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] })
    // 音はなしで判定と進行だけを確かめる。Canvasも描かない環境として扱う。
    ;(window as unknown as { AudioContext: undefined }).AudioContext = undefined
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    ;(window as unknown as { AudioContext: typeof AudioContext }).AudioContext = originalAudioContext
  })

  test('選曲画面にクラシックの曲と、たいこの数の切り替えが出る', () => {
    renderGame()
    expect(screen.getByRole('heading', { name: 'どの きょくで あそぶ？' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /きらきらぼし/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /エリーゼのために（ベートーヴェン）/ })).toBeInTheDocument()
    const easy = screen.getByRole('button', { name: /ひとつ たいこ/ })
    const normal = screen.getByRole('button', { name: /みっつ たいこ/ })
    expect(easy).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(normal)
    expect(normal).toHaveAttribute('aria-pressed', 'true')
    expect(easy).toHaveAttribute('aria-pressed', 'false')
  })

  test('タイミングよく たたくと れんぞく が出て、さいごに★と記録が残る', () => {
    const { chart, leadIn } = chartFor('twinkle-twinkle-little-star', 'easy')
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /きらきらぼし/ }))
    const pad = screen.getByRole('button', { name: 'たいこ' })
    expect(screen.getByText('よーい')).toBeInTheDocument()

    let elapsed = 0
    const targets = chart.notes.filter((note) => note.target)
    for (const note of targets) {
      act(() => vi.advanceTimersByTime(leadIn + note.timeMs - elapsed))
      elapsed = leadIn + note.timeMs
      fireEvent.pointerDown(pad, { button: 0, pointerType: 'touch' })
      if (note === targets[2]) expect(screen.getByText('れんぞく！')).toBeInTheDocument()
    }
    act(() => vi.advanceTimersByTime(leadIn + chart.durationMs + 1500 - elapsed))

    const dialog = screen.getByRole('dialog', { name: 'さいこうの えんそう！' })
    expect(within(dialog).getByRole('img', { name: 'ほし 3こ' })).toBeInTheDocument()
    expect(within(dialog).getByText('すごい').nextSibling).toHaveTextContent(String(targets.length))
    expect(JSON.parse(localStorage.getItem('rhythm-pon-progress') ?? '{}')).toEqual({ 'easy:twinkle-twinkle-little-star': 3 })

    fireEvent.click(within(dialog).getByRole('button', { name: 'ほかの きょく' }))
    expect(screen.getByRole('heading', { name: 'どの きょくで あそぶ？' })).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: /きらきらぼし/ })).getByRole('img', { name: 'クリアずみ ほし 3こ' })).toBeInTheDocument()
  })

  test('たたかなくても さいごまで すすみ、★1で ほめる。もういちど で やりなおせる', () => {
    const { chart, leadIn } = chartFor('ode-to-joy', 'normal')
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /みっつ たいこ/ }))
    fireEvent.click(screen.getByRole('button', { name: /よろこびのうた/ }))
    expect(screen.getAllByRole('button', { name: /の たいこ$/ })).toHaveLength(3)

    act(() => vi.advanceTimersByTime(leadIn + chart.durationMs + 1500))
    const dialog = screen.getByRole('dialog', { name: 'さいごまで できたね！' })
    expect(within(dialog).getByText('おしい').nextSibling).toHaveTextContent(String(chart.targetCount))

    fireEvent.click(within(dialog).getByRole('button', { name: /もういちど/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('よーい')).toBeInTheDocument()
  })

  test('キーボードの矢印でも、ちがう いろの たいこを たたける', () => {
    const { chart, leadIn } = chartFor('twinkle-twinkle-little-star', 'normal')
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /みっつ たいこ/ }))
    fireEvent.click(screen.getByRole('button', { name: /きらきらぼし/ }))
    const keys = ['ArrowLeft', 'ArrowDown', 'ArrowRight']
    let elapsed = 0
    for (const note of chart.notes.filter((item) => item.target).slice(0, 4)) {
      act(() => vi.advanceTimersByTime(leadIn + note.timeMs - elapsed))
      elapsed = leadIn + note.timeMs
      fireEvent.keyDown(window, { key: keys[note.lane] })
    }
    expect(screen.getByText(/れんぞく！/).textContent).toMatch(/^4\s*れんぞく！/)
  })

  test('画面が かくれたら ひとやすみ し、つづける で もどる', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /きらきらぼし/ }))
    act(() => vi.advanceTimersByTime(1000))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    const dialog = screen.getByRole('dialog', { name: 'おやすみちゅう' })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    fireEvent.click(within(dialog).getByRole('button', { name: /つづける/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('プレイ中の もどる で選曲画面へ戻る', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /はる（ヴィヴァルディ）/ }))
    expect(screen.getByRole('heading', { name: /はる/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'どの きょくで あそぶ？' })).toHaveFocus()
  })
})
