import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { countries } from './data/countries'
import { QUESTION_COUNT } from './types'
import type { Country } from './types'

/**
 * ルーティングを含めて実際のアプリ (src/app/routes.tsx) をレンダリングする。
 * 画面遷移まわり（けっか画面への遷移・リダイレクトなど）を実際のルート定義で検証するため、
 * MemoryRouter + App を使う。
 */
function renderApp(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  )
}

/**
 * 表示中の国旗 <img> の src (例: '/flags/jp.svg') から国コードを取り出し、
 * countries データから対応する Country を特定する。
 * ランダムに選ばれた正解の国を、実装の内部状態に依存せず特定できる。
 */
function getCorrectCountry(container: HTMLElement): Country {
  const img = container.querySelector('img')
  if (!img) throw new Error('flag image not found')
  const src = img.getAttribute('src') ?? ''
  const match = src.match(/flags\/([a-z]{2})\.svg/)
  if (!match) throw new Error(`unexpected flag src: ${src}`)
  const country = countries.find((c) => c.id === match[1])
  if (!country) throw new Error(`country not found for id: ${match[1]}`)
  return country
}

/**
 * 「やめる」「つぎへ」「けっかを みる」「もういちど」「べつの クイズ」「ホームへ」を除いた、
 * 選択肢（国名）ボタンの一覧を取得する。
 * 「つぎへ」ボタンは回答後に画面下部の固定フィードバックバー内へマウントされるため、
 * 回答後は role による絞り込みだけでは選択肢ボタンと区別できない。
 * ボタンのテキストで明示的に除外する。
 */
function getChoiceButtons(): HTMLElement[] {
  const excluded = new Set([
    'やめる',
    'つぎへ',
    'けっかを みる',
    'もういちど',
    'べつの クイズ',
    'ホームへ',
  ])
  return screen.getAllByRole('button').filter((btn) => !excluded.has(btn.textContent ?? ''))
}

/**
 * 現在の問題に回答し、「つぎへ」（最終問なら「けっかを みる」）まで進める。
 * correct が true なら正解の選択肢を、false なら不正解の選択肢をクリックする。
 */
async function answerCurrentQuestion(
  user: UserEvent,
  container: HTMLElement,
  correct: boolean,
): Promise<void> {
  const correctCountry = getCorrectCountry(container)
  const choiceButtons = getChoiceButtons()
  const target = correct
    ? choiceButtons.find((btn) => btn.textContent === correctCountry.nameJa)
    : choiceButtons.find((btn) => btn.textContent !== correctCountry.nameJa)
  if (!target) throw new Error('target choice button not found')
  await user.click(target)
  const nextButton = screen.getByRole('button', { name: /つぎへ|けっかを みる/ })
  await user.click(nextButton)
}

describe('FlagQuizPlay', () => {
  test('クイズを開始すると、国旗と4つの選択肢ボタンが表示される', () => {
    const { container } = renderApp(['/games/flag-quiz/flag-to-name/play'])
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')).toMatch(/flags\/[a-z]{2}\.svg$/)
    expect(getChoiceButtons()).toHaveLength(4)
  })

  test('旧URL (/games/flag-quiz/play) にアクセスすると、こっき→なまえモードにリダイレクトされる', () => {
    const { container } = renderApp(['/games/flag-quiz/play'])
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')).toMatch(/flags\/[a-z]{2}\.svg$/)
    expect(screen.getByRole('heading', { name: 'この くにの なまえは？' })).toBeInTheDocument()
    expect(getChoiceButtons()).toHaveLength(4)
  })

  test('正解の選択肢を押すと「せいかい」のフィードバックが表示される', async () => {
    const user = userEvent.setup()
    const { container } = renderApp(['/games/flag-quiz/flag-to-name/play'])
    const correctCountry = getCorrectCountry(container)
    const button = screen.getByRole('button', { name: correctCountry.nameJa })
    await user.click(button)
    expect(screen.getByText(/せいかい/)).toBeInTheDocument()
  })

  test('不正解の選択肢を押すと不正解のフィードバックと正しい国名が表示される', async () => {
    const user = userEvent.setup()
    const { container } = renderApp(['/games/flag-quiz/flag-to-name/play'])
    const correctCountry = getCorrectCountry(container)
    const choiceButtons = getChoiceButtons()
    const wrongButton = choiceButtons.find((btn) => btn.textContent !== correctCountry.nameJa)
    if (!wrongButton) throw new Error('wrong choice button not found')
    await user.click(wrongButton)
    expect(screen.getByText('ざんねん！')).toBeInTheDocument()
    expect(screen.getByText(`こたえ: ${correctCountry.nameJa}`)).toBeInTheDocument()
  })

  test('回答前は「つぎへ」が表示されず、回答後に表示される', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/flag-to-name/play'])
    expect(screen.queryByRole('button', { name: /つぎへ|けっかを みる/ })).not.toBeInTheDocument()
    await user.click(getChoiceButtons()[0])
    expect(screen.getByRole('button', { name: /つぎへ|けっかを みる/ })).toBeEnabled()
  })

  test('回答後のフィードバックはスクリーンリーダーに通知される（role=status）', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/flag-to-name/play'])
    await user.click(getChoiceButtons()[0])
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/せいかい！|ざんねん！/)
    expect(status).toHaveTextContent(/こたえ:/)
    // 「つぎへ」は固定フィードバックバーの中に置かれている
    expect(status).toContainElement(screen.getByRole('button', { name: /つぎへ|けっかを みる/ }))
  })

  test('回答後は選択肢ボタンがすべて disabled になる', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/flag-to-name/play'])
    const choiceButtons = getChoiceButtons()
    await user.click(choiceButtons[0])
    for (const btn of choiceButtons) {
      expect(btn).toBeDisabled()
    }
  })

  test('「つぎへ」を押すと次の問題に進み、進捗表示が更新される', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/flag-to-name/play'])
    expect(screen.getByRole('progressbar', { name: '1 / 10 もん' })).toBeInTheDocument()
    const choiceButtons = getChoiceButtons()
    await user.click(choiceButtons[0])
    const nextButton = screen.getByRole('button', { name: /つぎへ|けっかを みる/ })
    await user.click(nextButton)
    expect(screen.getByRole('progressbar', { name: '2 / 10 もん' })).toBeInTheDocument()
  })

  test(
    '10問すべてに正解すると結果画面へ遷移し、正解数が表示される',
    async () => {
      const user = userEvent.setup()
      const { container } = renderApp(['/games/flag-quiz/flag-to-name/play'])
      for (let i = 0; i < QUESTION_COUNT; i += 1) {
        await answerCurrentQuestion(user, container, true)
      }
      expect(screen.getByRole('heading', { name: 'けっか' })).toBeInTheDocument()
      expect(screen.getByText(/10\s*\/\s*10\s*もん/)).toBeInTheDocument()
    },
    20000,
  )

  test(
    '一部を不正解にすると、正解数がその件数どおりに結果画面へ表示される',
    async () => {
      const user = userEvent.setup()
      const { container } = renderApp(['/games/flag-quiz/flag-to-name/play'])
      // 10問中 6問正解・4問不正解
      const pattern = [true, false, true, true, false, true, false, true, false, true]
      for (const correct of pattern) {
        await answerCurrentQuestion(user, container, correct)
      }
      expect(screen.getByText(/6\s*\/\s*10\s*もん/)).toBeInTheDocument()
    },
    20000,
  )

  test(
    '結果画面の「もういちど」でクイズが再開され、1問目に戻る',
    async () => {
      const user = userEvent.setup()
      const { container } = renderApp(['/games/flag-quiz/flag-to-name/play'])
      for (let i = 0; i < QUESTION_COUNT; i += 1) {
        await answerCurrentQuestion(user, container, true)
      }
      const retryButton = screen.getByRole('button', { name: 'もういちど' })
      await user.click(retryButton)
      expect(screen.getByRole('progressbar', { name: '1 / 10 もん' })).toBeInTheDocument()
    },
    20000,
  )

  test(
    '結果画面の「ホームへ」でホーム画面に戻る',
    async () => {
      const user = userEvent.setup()
      const { container } = renderApp(['/games/flag-quiz/flag-to-name/play'])
      for (let i = 0; i < QUESTION_COUNT; i += 1) {
        await answerCurrentQuestion(user, container, true)
      }
      const homeButton = screen.getByRole('button', { name: 'ホームへ' })
      await user.click(homeButton)
      expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
    },
    20000,
  )

  test('結果画面へ直接アクセス（stateなし）すると開始画面へリダイレクトされる', () => {
    renderApp(['/games/flag-quiz/flag-to-name/result'])
    expect(screen.getByRole('heading', { name: 'こっきクイズ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'こっきを みて こたえる' })).toBeInTheDocument()
  })

  test('旧結果URL (/games/flag-quiz/result) へ直接アクセスすると開始画面へリダイレクトされる', () => {
    renderApp(['/games/flag-quiz/result'])
    expect(screen.getByRole('heading', { name: 'こっきクイズ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'こっきを みて こたえる' })).toBeInTheDocument()
  })
})
