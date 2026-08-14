import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import App from '../../app/App'
import { resetSpeechEnabledCache } from '../../speech'
import { installSpeechSynthesisMock, uninstallSpeechSynthesisMock } from '../../test/speechSynthesisMock'
import type { SpeechSynthesisMock } from '../../test/speechSynthesisMock'

/**
 * さんすうクイズは画面表示が「3 ＋ 4 = ?」のような記号混じりの式のため、
 * よみあげテキストは記号ではなく読み上げ用の単語（OPERATION_SPEECH_WORD）に
 * 置き換えて渡す必要がある。ここではその置き換えだけを確認する。
 */
describe('さんすうクイズのよみあげテキスト', () => {
  let mock: SpeechSynthesisMock

  beforeEach(() => {
    localStorage.clear()
    resetSpeechEnabledCache()
    mock = installSpeechSynthesisMock()
  })

  afterEach(() => {
    uninstallSpeechSynthesisMock()
  })

  test('たしざんの読み上げテキストは「たす」を含み、記号「＋」「=」は含まない', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/games/math-quiz/add/easy/play']}>
        <App />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /よみあげ/ }))

    expect(mock.spoken).toHaveLength(1)
    expect(mock.spoken[0]).toContain('たす')
    expect(mock.spoken[0]).not.toContain('＋')
    expect(mock.spoken[0]).not.toContain('=')
    expect(mock.spoken[0]).toMatch(/^\d+ たす \d+ は？$/)
  })
})
