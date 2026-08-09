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
 * 画面遷移まわり（けっか画面への遷移など）を実際のルート定義で検証するため、
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
 * 設問見出し「「{nameJa}」の こっきは どれ？」から国名を取り出し、
 * countries データから対応する Country を特定する。
 * ランダムに選ばれた正解の国を、実装の内部状態に依存せず特定できる。
 */
function getQuestionCountry(): Country {
  const heading = screen.getByRole('heading')
  const text = heading.textContent ?? ''
  const match = text.match(/「(.+)」の\s*こっきは\s*どれ？/)
  if (!match) throw new Error(`unexpected heading text: ${text}`)
  const country = countries.find((c) => c.nameJa === match[1])
  if (!country) throw new Error(`country not found for nameJa: ${match[1]}`)
  return country
}

/** 国旗の選択肢ボタン（位置ベースの aria-label「Nばんめ の こっき」を持つ）を取得する */
function getFlagChoiceButtons(): HTMLElement[] {
  return screen.getAllByRole('button', { name: /ばんめ の こっき/ })
}

/** 選択肢ボタン内の <img> の src (例: '/flags/jp.svg') から国コードを取り出す */
function countryIdFromButton(button: HTMLElement): string {
  const img = button.querySelector('img')
  const src = img?.getAttribute('src') ?? ''
  const match = src.match(/flags\/([a-z]{2})\.svg/)
  if (!match) throw new Error(`unexpected flag src: ${src}`)
  return match[1]
}

function findButtonForCountry(buttons: HTMLElement[], country: Country): HTMLElement {
  const target = buttons.find((btn) => countryIdFromButton(btn) === country.id)
  if (!target) throw new Error(`button not found for country: ${country.id}`)
  return target
}

/**
 * 現在の問題に回答し、「つぎへ」（最終問なら「けっかを みる」）まで進める。
 * correct が true なら正解の国旗を、false なら不正解の国旗をクリックする。
 */
async function answerCurrentQuestion(user: UserEvent, correct: boolean): Promise<void> {
  const questionCountry = getQuestionCountry()
  const buttons = getFlagChoiceButtons()
  const target = correct
    ? findButtonForCountry(buttons, questionCountry)
    : buttons.find((btn) => countryIdFromButton(btn) !== questionCountry.id)
  if (!target) throw new Error('target choice button not found')
  await user.click(target)
  const nextButton = screen.getByRole('button', { name: /つぎへ|けっかを みる/ })
  await user.click(nextButton)
}

describe('NameToFlagPlay', () => {
  test('クイズを開始すると、国名の設問と4つの国旗選択肢ボタンが表示される', () => {
    renderApp(['/games/flag-quiz/name-to-flag/play'])
    const questionCountry = getQuestionCountry()
    expect(screen.getByRole('heading')).toHaveTextContent(
      `「${questionCountry.nameJa}」の こっきは どれ？`,
    )
    expect(getFlagChoiceButtons()).toHaveLength(4)
  })

  test('正解の国旗を押すと「せいかい」のフィードバックが表示される', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/name-to-flag/play'])
    const questionCountry = getQuestionCountry()
    const target = findButtonForCountry(getFlagChoiceButtons(), questionCountry)
    await user.click(target)
    expect(screen.getByText(/せいかい/)).toBeInTheDocument()
  })

  test('誤答の国旗を押すと「ざんねん！」と正しい国名が表示される', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/name-to-flag/play'])
    const questionCountry = getQuestionCountry()
    const buttons = getFlagChoiceButtons()
    const wrongButton = buttons.find((btn) => countryIdFromButton(btn) !== questionCountry.id)
    if (!wrongButton) throw new Error('wrong choice button not found')
    await user.click(wrongButton)
    expect(screen.getByText('ざんねん！')).toBeInTheDocument()
    expect(screen.getByText(`こたえ: ${questionCountry.nameJa}`)).toBeInTheDocument()
  })

  test('回答後は選択肢ボタンがすべて disabled になる', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/name-to-flag/play'])
    const buttons = getFlagChoiceButtons()
    await user.click(buttons[0])
    for (const btn of buttons) {
      expect(btn).toBeDisabled()
    }
  })

  test(
    '10問すべてに正解すると結果画面へ遷移し、正解数が表示される',
    async () => {
      const user = userEvent.setup()
      renderApp(['/games/flag-quiz/name-to-flag/play'])
      for (let i = 0; i < QUESTION_COUNT; i += 1) {
        await answerCurrentQuestion(user, true)
      }
      expect(screen.getByRole('heading', { name: 'けっか' })).toBeInTheDocument()
      expect(screen.getByText(/10\s*\/\s*10\s*もん/)).toBeInTheDocument()
    },
    20000,
  )

  test(
    '結果画面の「もういちど」でなまえ→こっきモードの1問目に戻る',
    async () => {
      const user = userEvent.setup()
      renderApp(['/games/flag-quiz/name-to-flag/play'])
      for (let i = 0; i < QUESTION_COUNT; i += 1) {
        await answerCurrentQuestion(user, true)
      }
      const retryButton = screen.getByRole('button', { name: 'もういちど' })
      await user.click(retryButton)
      expect(screen.getByRole('progressbar', { name: '1 / 10 もん' })).toBeInTheDocument()
      expect(getFlagChoiceButtons()).toHaveLength(4)
    },
    20000,
  )
})
