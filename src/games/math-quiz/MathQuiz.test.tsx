import { render, screen } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import App from '../../app/App'
import { LEVEL_LABEL, QUESTION_COUNT } from '../quiz-core/types'
import { MODE_LABEL, MODE_PATH, OPERATION_SIGN } from './types'
import type { MathOperation } from './types'

const MODES: MathOperation[] = ['add', 'sub', 'mul', 'div']

const SIGN_TO_OPERATION: Record<string, MathOperation> = Object.fromEntries(
  Object.entries(OPERATION_SIGN).map(([operation, sign]) => [sign, operation as MathOperation]),
)

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

/** プレイ画面の見出し「{left} {sign} {right} = ?」を読み取り、正解の数値を計算する。 */
function computeAnswerFromHeading(): number {
  const heading = screen.getByRole('heading')
  const text = (heading.textContent ?? '').trim()
  const parts = text.split(/\s+/)
  const [leftStr, sign, rightStr] = parts
  const left = Number(leftStr)
  const right = Number(rightStr)
  const operation = SIGN_TO_OPERATION[sign]
  if (!operation || Number.isNaN(left) || Number.isNaN(right)) {
    throw new Error(`unexpected question heading: ${text}`)
  }
  switch (operation) {
    case 'add':
      return left + right
    case 'sub':
      return left - right
    case 'mul':
      return left * right
    case 'div':
      return left / right
    default:
      throw new Error(`unhandled operation: ${operation as string}`)
  }
}

/** 選択肢ボタン（未回答時は数値だけの表示になる）を取得する。 */
function choiceButtons(): HTMLElement[] {
  return screen
    .getAllByRole('button')
    .filter((button) => /^\d+$/.test((button.textContent ?? '').trim()))
}

async function answerQuestion(user: UserEvent, correct: boolean) {
  const answer = computeAnswerFromHeading()
  const buttons = choiceButtons()
  const target = correct
    ? buttons.find((button) => button.textContent?.trim() === String(answer))
    : buttons.find((button) => button.textContent?.trim() !== String(answer))
  if (!target) throw new Error('answer button not found')
  await user.click(target)
  await user.click(screen.getByRole('button', { name: /つぎへ|けっかを みる/ }))
}

describe('さんすうクイズ', () => {
  test('開始画面に4モードのボタンが表示され、押すとむずかしさ選択画面へ遷移する', async () => {
    const user = userEvent.setup()
    renderApp('/games/math-quiz')
    expect(screen.getByRole('heading', { name: 'さんすうクイズ' })).toBeInTheDocument()
    for (const mode of MODES) {
      expect(
        screen.getByRole('button', { name: new RegExp(MODE_LABEL[mode]) }),
      ).toBeInTheDocument()
    }
    await user.click(screen.getByRole('button', { name: new RegExp(MODE_LABEL.add) }))
    expect(screen.getByRole('heading', { name: 'むずかしさを えらんでね' })).toBeInTheDocument()
    expect(screen.getByText(MODE_LABEL.add)).toBeInTheDocument()
  })

  for (const mode of MODES) {
    test(`${MODE_LABEL[mode]}: むずかしさ選択からプレイ画面で式と4択を表示する`, async () => {
      const user = userEvent.setup()
      renderApp('/games/math-quiz')
      await user.click(screen.getByRole('button', { name: new RegExp(MODE_LABEL[mode]) }))
      expect(screen.getByText(MODE_LABEL[mode])).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: new RegExp(LEVEL_LABEL.easy) }))

      expect(screen.getByRole('heading', { name: /=\s*\?/ })).toBeInTheDocument()
      expect(choiceButtons()).toHaveLength(4)
      expect(screen.getByRole('progressbar', { name: '1 / 10 もん' })).toBeInTheDocument()
      expect(screen.getByText(LEVEL_LABEL.easy)).toBeInTheDocument()
    })
  }

  for (const mode of MODES) {
    test(`${MODE_LABEL[mode]}を10問すべて正解すると結果画面へ遷移する`, async () => {
      const user = userEvent.setup()
      renderApp(`/games/math-quiz/${MODE_PATH[mode]}/normal/play`)
      for (let index = 0; index < QUESTION_COUNT; index += 1) {
        await answerQuestion(user, true)
      }
      expect(screen.getByRole('heading', { name: 'けっか' })).toBeInTheDocument()
      expect(screen.getByText(/10\s*\/\s*10もん せいかい/)).toBeInTheDocument()
      expect(screen.getByText(`${MODE_LABEL[mode]} ・ ${LEVEL_LABEL.normal}`)).toBeInTheDocument()
    }, 20000)
  }

  test('一部を不正解にすると正解数がその件数どおりに表示される', async () => {
    const user = userEvent.setup()
    renderApp('/games/math-quiz/sub/hard/play')
    const CORRECT_COUNT = 6
    for (let index = 0; index < QUESTION_COUNT; index += 1) {
      await answerQuestion(user, index < CORRECT_COUNT)
    }
    expect(
      screen.getByText(new RegExp(`${CORRECT_COUNT}\\s*/\\s*10もん せいかい`)),
    ).toBeInTheDocument()
  }, 20000)

  test('不正解のときは正解の数値が「こたえ:」として表示される', async () => {
    const user = userEvent.setup()
    renderApp('/games/math-quiz/add/easy/play')
    const answer = computeAnswerFromHeading()
    const buttons = choiceButtons()
    const wrong = buttons.find((button) => button.textContent?.trim() !== String(answer))
    if (!wrong) throw new Error('wrong choice button not found')
    await user.click(wrong)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('ざんねん！')
    expect(status).toHaveTextContent(`こたえ: ${answer}`)
  })

  test('結果画面の「もういちど」で1問目に戻る', async () => {
    const user = userEvent.setup()
    renderApp('/games/math-quiz/mul/hard/play')
    for (let index = 0; index < QUESTION_COUNT; index += 1) {
      await answerQuestion(user, true)
    }
    await user.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(screen.getByRole('progressbar', { name: '1 / 10 もん' })).toBeInTheDocument()
    expect(choiceButtons()).toHaveLength(4)
  }, 20000)

  test('不正なlevel URLはむずかしさ選択画面へ安全に戻す', () => {
    renderApp('/games/math-quiz/add/foo/play')
    expect(screen.getByRole('heading', { name: 'むずかしさを えらんでね' })).toBeInTheDocument()
    expect(screen.getByText(MODE_LABEL.add)).toBeInTheDocument()
  })

  test('stateなしで結果URLへ直接アクセスすると開始画面へ戻る', () => {
    renderApp('/games/math-quiz/div/easy/result')
    expect(screen.getByRole('heading', { name: 'さんすうクイズ' })).toBeInTheDocument()
  })
})
