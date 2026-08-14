import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { installSpeechSynthesisMock, uninstallSpeechSynthesisMock } from '../test/speechSynthesisMock'
import { SPEECH_ENABLED_STORAGE_KEY, resetSpeechEnabledCache } from './speechSettingsStore'
import SpeechToggle from './SpeechToggle'

describe('SpeechToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSpeechEnabledCache()
  })

  afterEach(() => {
    uninstallSpeechSynthesisMock()
  })

  test('非対応環境では disabled で、aria-label が「つかえません」になる', () => {
    render(<SpeechToggle />)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-label', 'よみあげは この きかいでは つかえません')
  })

  test('対応環境では初期表示が OFF', () => {
    installSpeechSynthesisMock()
    render(<SpeechToggle />)

    const button = screen.getByRole('button')
    expect(button).toBeEnabled()
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveTextContent('🔇')
  })

  test('クリックで ON になり aria-pressed="true" と 🔊 に変わる', async () => {
    installSpeechSynthesisMock()
    const user = userEvent.setup()
    render(<SpeechToggle />)

    await user.click(screen.getByRole('button'))

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveTextContent('🔊')
    expect(button).toHaveAttribute('aria-label', 'よみあげ ON。おすと よみあげを OFF にします')
  })

  test('ON にすると localStorage に保存される', async () => {
    installSpeechSynthesisMock()
    const user = userEvent.setup()
    render(<SpeechToggle />)

    await user.click(screen.getByRole('button'))

    expect(localStorage.getItem(SPEECH_ENABLED_STORAGE_KEY)).toBe('on')
  })

  test('もう一度クリックで OFF に戻る', async () => {
    installSpeechSynthesisMock()
    const user = userEvent.setup()
    render(<SpeechToggle />)

    const button = screen.getByRole('button')
    await user.click(button)
    await user.click(button)

    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveTextContent('🔇')
    expect(localStorage.getItem(SPEECH_ENABLED_STORAGE_KEY)).toBe('off')
  })

  test('className prop がボタンに反映される', () => {
    installSpeechSynthesisMock()
    render(<SpeechToggle className="my-extra-class" />)

    expect(screen.getByRole('button')).toHaveClass('my-extra-class')
  })

  test('compact では「よみあげ」テキストを表示しないが aria-label は変わらない', () => {
    installSpeechSynthesisMock()
    render(<SpeechToggle compact />)

    const button = screen.getByRole('button')
    expect(button).not.toHaveTextContent('よみあげ')
    expect(button).toHaveAttribute('aria-label', 'よみあげ OFF。おすと よみあげを ON にします')
  })

  test('compact でもクリックで ON/OFF が切り替わる', async () => {
    installSpeechSynthesisMock()
    const user = userEvent.setup()
    render(<SpeechToggle compact />)

    const button = screen.getByRole('button')
    await user.click(button)

    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveAttribute('aria-label', 'よみあげ ON。おすと よみあげを OFF にします')
  })
})
