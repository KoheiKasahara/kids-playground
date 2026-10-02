import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import App from '../../app/App'
import { resetSpeechEnabledCache } from '../../speech'
import { installSpeechSynthesisMock, uninstallSpeechSynthesisMock } from '../../test/speechSynthesisMock'
import type { SpeechSynthesisMock } from '../../test/speechSynthesisMock'

/**
 * 国旗クイズ（こっき→なまえ）を代表として、よみあげトグル配線の実際の挙動を検証する。
 * SpeechToggle / useQuestionSpeech 自体のユニットテストは src/speech/ 側にあるため、
 * ここでは「クイズ画面に正しく配線されているか」（ON/OFF・次の問題・画面離脱で
 * 正しいタイミングで speak/cancel が呼ばれるか、読み上げテキストが妥当か）だけを見る。
 */
async function renderApp(path: string) {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { level: 1 }, { timeout: 10_000 })
  return view
}

function getToggle(): HTMLElement {
  return screen.getByRole('button', { name: /よみあげ/ })
}

/** 「やめる」「つぎのもんだい」「けっかを みる」「よみあげ」を除いた、国名の選択肢ボタン */
function getChoiceButtons(): HTMLElement[] {
  const excluded = new Set(['← もどる', 'つぎのもんだい', 'けっかを みる'])
  return screen
    .getAllByRole('button')
    .filter((btn) => !excluded.has(btn.textContent ?? '') && !(btn.textContent ?? '').includes('よみあげ'))
}

describe('国旗クイズ（こっき→なまえ）のよみあげ挙動', () => {
  let mock: SpeechSynthesisMock

  beforeEach(() => {
    localStorage.clear()
    resetSpeechEnabledCache()
    mock = installSpeechSynthesisMock()
  })

  afterEach(() => {
    uninstallSpeechSynthesisMock()
  })

  test('よみあげ OFF（初期状態）のままでは、1問目でも読み上げない', async () => {
    await renderApp('/games/flag-quiz/flag-to-name/hard/play')
    expect(mock.spoken).toEqual([])
  })

  test('トグルを押して ON にすると、いま表示中の問題文がその場で読み上げられる', async () => {
    const user = userEvent.setup()
    await renderApp('/games/flag-quiz/flag-to-name/hard/play')
    await user.click(getToggle())
    expect(mock.spoken).toEqual(['この くにの なまえは？'])
  })

  test('ON のまま選択肢をタップして正誤演出が出ても、問題文は読み直さない（不正解なら答えだけ読み上げる）', async () => {
    const user = userEvent.setup()
    await renderApp('/games/flag-quiz/flag-to-name/hard/play')
    await user.click(getToggle())
    expect(mock.spoken).toHaveLength(1)

    await user.click(getChoiceButtons()[0])
    expect(screen.getByRole('status')).toBeInTheDocument()
    // 正誤演出の表示・再レンダーだけでは questionKey (state.index) が変わらないため、
    // 問題文の読み上げは増えない。選択肢はランダムなので、不正解だったときだけ
    // 「こたえは ○○」の読み上げが1回だけ加わる（Issue #784 A9）。
    const wrong = screen.queryByText('ざんねん！') !== null
    expect(mock.spoken.filter((text) => !text.startsWith('こたえは '))).toEqual(['この くにの なまえは？'])
    if (wrong) {
      expect(mock.spoken).toHaveLength(2)
      expect(mock.spoken[1]).toMatch(/^こたえは \S/)
    } else {
      expect(mock.spoken).toHaveLength(1)
    }
  })

  test('不正解のときは「こたえは ○○」と正解を1回だけ読み上げる', async () => {
    const user = userEvent.setup()
    await renderApp('/games/flag-quiz/flag-to-name/hard/play')
    await user.click(getToggle())

    // どれが正解か分からないため、1つ選んで正解だった場合は次の問題でもう一度試す。
    for (let attempt = 0; attempt < 10; attempt++) {
      mock.reset()
      await user.click(getChoiceButtons()[0])
      if (screen.queryByText('ざんねん！') !== null) {
        const answer = screen.getByText(/^こたえ: /).textContent!.replace(/^こたえ: /, '')
        expect(mock.spoken).toEqual([`こたえは ${answer}`])
        return
      }
      await user.click(screen.getByRole('button', { name: /つぎのもんだい|けっかを みる/ }))
    }
    // 10問つづけて先頭の選択肢が正解になる確率はごくわずかなので、ここへは来ない想定。
    throw new Error('不正解の問題に当たりませんでした')
  })

  test('「つぎのもんだい」で次の問題に進むと、もう一度読み上げられ、その直前に cancel() が呼ばれている', async () => {
    const user = userEvent.setup()
    await renderApp('/games/flag-quiz/flag-to-name/hard/play')
    await user.click(getToggle())
    await user.click(getChoiceButtons()[0])
    mock.reset()

    const nextButton = screen.getByRole('button', { name: /つぎのもんだい|けっかを みる/ })
    await user.click(nextButton)

    expect(mock.cancelCount).toBeGreaterThanOrEqual(1)
    expect(mock.spoken).toEqual(['この くにの なまえは？'])
  })

  test('「やめる」で画面を離れると cancel() が呼ばれる（アンマウントで停止する）', async () => {
    const user = userEvent.setup()
    await renderApp('/games/flag-quiz/flag-to-name/hard/play')
    await user.click(getToggle())
    mock.reset()

    await user.click(screen.getByRole('button', { name: 'もどる' }))

    expect(mock.cancelCount).toBeGreaterThanOrEqual(1)
  })

  test('ON のあと OFF に戻すと cancel() が呼ばれる', async () => {
    const user = userEvent.setup()
    await renderApp('/games/flag-quiz/flag-to-name/hard/play')
    await user.click(getToggle())
    mock.reset()

    await user.click(getToggle())

    expect(mock.cancelCount).toBeGreaterThanOrEqual(1)
  })

  test('読み上げテキストに進捗表示や「やめる」が含まれない', async () => {
    const user = userEvent.setup()
    await renderApp('/games/flag-quiz/flag-to-name/hard/play')
    await user.click(getToggle())
    await user.click(getChoiceButtons()[0])
    await user.click(screen.getByRole('button', { name: /つぎのもんだい|けっかを みる/ }))

    expect(mock.spoken.length).toBeGreaterThan(0)
    for (const text of mock.spoken) {
      expect(text).not.toMatch(/\d+\s*\/\s*\d+/)
      expect(text).not.toContain('やめる')
      expect(text).not.toContain('せいかい')
      expect(text).not.toContain('◯')
      expect(text).not.toContain('✕')
    }
  })

  test('よみあげ設定は他のクイズのプレイ画面にも共有される（ON にしてから別画面へ遷移してもONのまま）', async () => {
    const user = userEvent.setup()
    const { unmount } = await renderApp('/games/flag-quiz/flag-to-name/hard/play')
    await user.click(getToggle())
    expect(mock.spoken).toEqual(['この くにの なまえは？'])
    unmount()
    mock.reset()

    await renderApp('/games/color-mix-quiz/play')
    // 別のクイズ画面でも、設定を ON にし直さなくてもその場で問題文が読み上げられる。
    await waitFor(() => expect(mock.spoken).toHaveLength(1))
    expect(mock.spoken[0]).toMatch(/この (2|3)しょくを まぜると？|この いろから ひくと？/)
  })
})
