import { describe, expect, test } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { countries, countriesForLevel } from './data/countries'
import { PANEL_COUNT } from './PanelFlag'
import { QUESTION_COUNT } from './types'
import type { Country } from './types'

/**
 * ルーティングを含めて実際のアプリ (src/app/routes.tsx) をレンダリングする。
 * 画面遷移まわり（けっか画面への遷移・リダイレクトなど）を実際のルート定義で検証するため、
 * MemoryRouter + App を使う（既存の FlagQuizPlay.test.tsx / NameToFlagPlay.test.tsx と同じ方針）。
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
 * 「やめる」「もう1まい めくる！」「つぎのもんだい」「けっかを みる」
 * 「もういちど」「べつの むずかしさ」「べつの クイズ」「ホームへ」を除いた、
 * 選択肢（国名）ボタンの一覧を取得する。
 */
function getChoiceButtons(): HTMLElement[] {
  const excluded = new Set([
    'やめる',
    'つぎのもんだい',
    'けっかを みる',
    'もういちど',
    'べつの むずかしさ',
    'べつの クイズ',
    'ホームへ',
  ])
  return screen
    .getAllByRole('button')
    .filter((btn) => !excluded.has(btn.textContent ?? '') && !/めくる/.test(btn.textContent ?? ''))
}

function getRevealButton(): HTMLElement {
  return screen.getByRole('button', { name: /めくる/ })
}

function getOpenPanelCount(): number {
  return screen
    .getAllByTestId(/^panel-\d+$/)
    .filter((el) => el.getAttribute('data-open') === 'true').length
}

function getOpenPanelIndices(): string[] {
  return screen
    .getAllByTestId(/^panel-\d+$/)
    .filter((el) => el.getAttribute('data-open') === 'true')
    .map((el) => el.getAttribute('data-testid') ?? '')
}

/**
 * 現在の問題に回答し、「つぎのもんだい」（最終問なら「けっかを みる」）まで進める。
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
  const nextButton = screen.getByRole('button', { name: /つぎのもんだい|けっかを みる/ })
  await user.click(nextButton)
}

describe('PanelFlagQuizPlay', () => {
  test('クイズを開始すると、16枚のパネルのうち1枚だけが開いた状態で表示される', () => {
    renderApp(['/games/flag-quiz/panel-flag/hard/play'])
    expect(screen.getAllByTestId(/^panel-\d+$/)).toHaveLength(PANEL_COUNT)
    expect(getOpenPanelCount()).toBe(1)
  })

  test('4つの国名選択肢ボタンが表示される', () => {
    renderApp(['/games/flag-quiz/panel-flag/hard/play'])
    expect(getChoiceButtons()).toHaveLength(4)
  })

  test('むずかしさが表示される', () => {
    renderApp(['/games/flag-quiz/panel-flag/normal/play'])
    expect(screen.getByText('ふつう')).toBeInTheDocument()
  })

  test('かんたんでは、easyランクの国しか出題されない', () => {
    const easyIds = new Set(countriesForLevel('easy').map((c) => c.id))
    for (let seed = 0; seed < 10; seed += 1) {
      const { container, unmount } = renderApp(['/games/flag-quiz/panel-flag/easy/play'])
      const correctCountry = getCorrectCountry(container)
      expect(easyIds.has(correctCountry.id)).toBe(true)
      for (const btn of getChoiceButtons()) {
        const country = countries.find((c) => c.nameJa === btn.textContent)
        expect(country).toBeDefined()
        expect(easyIds.has(country!.id)).toBe(true)
      }
      unmount()
    }
  })

  test('不正な level でアクセスすると、パネルめくりモードのむずかしさ選択画面へリダイレクトされる', () => {
    renderApp(['/games/flag-quiz/panel-flag/super-hard/play'])
    expect(screen.getByRole('heading', { name: 'むずかしさを えらんでね' })).toBeInTheDocument()
    expect(screen.getByText('パネルめくり')).toBeInTheDocument()
  })

  test('開始画面の「パネルを めくって こたえる」から、むずかしさ選択を経てプレイ画面に入れる', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz'])
    await user.click(screen.getByRole('button', { name: /パネルを めくって こたえる/ }))
    expect(screen.getByRole('heading', { name: 'むずかしさを えらんでね' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /かんたん/ }))
    expect(screen.getAllByTestId(/^panel-\d+$/)).toHaveLength(PANEL_COUNT)
    expect(getOpenPanelCount()).toBe(1)
  })

  test('「もう1まい めくる！」を押すたびに開いたパネルが1枚ずつ増える', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/panel-flag/hard/play'])
    expect(getOpenPanelCount()).toBe(1)
    await user.click(getRevealButton())
    expect(getOpenPanelCount()).toBe(2)
    await user.click(getRevealButton())
    expect(getOpenPanelCount()).toBe(3)
  })

  test('開いたパネルの index は重複しない', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/panel-flag/hard/play'])
    for (let i = 0; i < 6; i += 1) {
      await user.click(getRevealButton())
    }
    const openIndices = getOpenPanelIndices()
    expect(openIndices).toHaveLength(7)
    expect(new Set(openIndices).size).toBe(openIndices.length)
  })

  test('16枚を超えて開かない。開ける枚数が上限に達するとボタンがdisabledになる', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/panel-flag/hard/play'])
    for (let i = 0; i < 20; i += 1) {
      const button = getRevealButton()
      if ((button as HTMLButtonElement).disabled) break
      await user.click(button)
    }
    expect(getOpenPanelCount()).toBe(PANEL_COUNT)
    expect(getRevealButton()).toBeDisabled()
  })

  test('正解の選択肢を押すと「せいかい」のフィードバックと得点(100てん)が表示される（1枚目で正解）', async () => {
    const user = userEvent.setup()
    const { container } = renderApp(['/games/flag-quiz/panel-flag/hard/play'])
    const correctCountry = getCorrectCountry(container)
    const button = screen.getByRole('button', { name: correctCountry.nameJa })
    await user.click(button)
    expect(screen.getByText(/せいかい/)).toBeInTheDocument()
    expect(screen.getByText(/1まいで わかった/)).toBeInTheDocument()
    expect(screen.getByText(/100てん/)).toBeInTheDocument()
  })

  test('2枚めくってから正解すると90点になる', async () => {
    const user = userEvent.setup()
    const { container } = renderApp(['/games/flag-quiz/panel-flag/hard/play'])
    await user.click(getRevealButton())
    const correctCountry = getCorrectCountry(container)
    const button = screen.getByRole('button', { name: correctCountry.nameJa })
    await user.click(button)
    expect(screen.getByText(/2まいで わかった/)).toBeInTheDocument()
    expect(screen.getByText(/90てん/)).toBeInTheDocument()
  })

  test('4枚めくってから正解すると70点になる', async () => {
    const user = userEvent.setup()
    const { container } = renderApp(['/games/flag-quiz/panel-flag/hard/play'])
    await user.click(getRevealButton())
    await user.click(getRevealButton())
    await user.click(getRevealButton())
    const correctCountry = getCorrectCountry(container)
    const button = screen.getByRole('button', { name: correctCountry.nameJa })
    await user.click(button)
    expect(screen.getByText(/4まいで わかった/)).toBeInTheDocument()
    expect(screen.getByText(/70てん/)).toBeInTheDocument()
  })

  test('不正解の選択肢を押すと「ざんねん！」と正しい国名、0てんが表示される', async () => {
    const user = userEvent.setup()
    const { container } = renderApp(['/games/flag-quiz/panel-flag/hard/play'])
    const correctCountry = getCorrectCountry(container)
    const choiceButtons = getChoiceButtons()
    const wrongButton = choiceButtons.find((btn) => btn.textContent !== correctCountry.nameJa)
    if (!wrongButton) throw new Error('wrong choice button not found')
    await user.click(wrongButton)
    expect(screen.getByText('ざんねん！')).toBeInTheDocument()
    expect(screen.getByText(`こたえ: ${correctCountry.nameJa}`)).toBeInTheDocument()
    expect(screen.getByText('0てん')).toBeInTheDocument()
  })

  test('回答後は自動めくりで16枚すべてのパネルが開き、国旗全体が見える', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/panel-flag/hard/play'])
    await user.click(getChoiceButtons()[0])
    // 自動めくりはランダム順の時間差（stagger）で開くため、即時ではなく waitFor で待つ
    await waitFor(() => expect(getOpenPanelCount()).toBe(PANEL_COUNT), { timeout: 2000 })
  })

  test('回答後の自動めくりで枚数は増えるが、得点表示の「〇まいで わかった！」は自分で開いた枚数のまま変わらない', async () => {
    const user = userEvent.setup()
    const { container } = renderApp(['/games/flag-quiz/panel-flag/hard/play'])
    await user.click(getRevealButton())
    expect(getOpenPanelCount()).toBe(2)
    const correctCountry = getCorrectCountry(container)
    const button = screen.getByRole('button', { name: correctCountry.nameJa })
    await user.click(button)
    expect(screen.getByText(/2まいで わかった/)).toBeInTheDocument()
    // 自動めくりが完了して16枚すべて開いた後も…
    await waitFor(() => expect(getOpenPanelCount()).toBe(PANEL_COUNT), { timeout: 2000 })
    // 得点・「〇まいで わかった！」の表示は増えず、自分で開いた2枚のままであること
    expect(screen.getByText(/2まいで わかった/)).toBeInTheDocument()
    expect(screen.getByText(/90てん/)).toBeInTheDocument()
  })

  test('回答直後に「つぎのもんだい」を押すと、前問の自動めくり timer が残らず、次の問題は1枚だけ開いた状態になる', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/panel-flag/hard/play'])
    await user.click(getChoiceButtons()[0])
    const nextButton = screen.getByRole('button', { name: /つぎのもんだい|けっかを みる/ })
    await user.click(nextButton)
    expect(getOpenPanelCount()).toBe(1)
    // 前問の stagger timer が cleanup されていれば、実時間で待っても burst は起きない
    // （1問目の自動めくりが最大でもかかりうる時間より長く待つ）。
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500))
    })
    expect(getOpenPanelCount()).toBe(1)
  })

  test('回答前後でページのルート要素の className が変化しない（レイアウトシフトしない）', async () => {
    const user = userEvent.setup()
    const { container } = renderApp(['/games/flag-quiz/panel-flag/hard/play'])
    const pageElement = container.firstElementChild
    const classNameBefore = pageElement?.className
    expect(classNameBefore).toBeTruthy()
    await user.click(getChoiceButtons()[0])
    expect(container.firstElementChild?.className).toBe(classNameBefore)
  })

  test('回答後は選択肢ボタンと「もう1まい めくる！」ボタンが disabled になる', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/panel-flag/hard/play'])
    const choiceButtons = getChoiceButtons()
    await user.click(choiceButtons[0])
    for (const btn of choiceButtons) {
      expect(btn).toBeDisabled()
    }
    expect(getRevealButton()).toBeDisabled()
  })

  test('回答後のフィードバックはスクリーンリーダーに通知される（role=status）', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/panel-flag/hard/play'])
    await user.click(getChoiceButtons()[0])
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/せいかい！|ざんねん！/)
    expect(status).toHaveTextContent(/こたえ:/)
    expect(status).toContainElement(screen.getByRole('button', { name: /つぎのもんだい|けっかを みる/ }))
  })

  test('「つぎのもんだい」で次の問題に進み、パネル状態がリセットされる（再び1枚だけ開いている）', async () => {
    const user = userEvent.setup()
    renderApp(['/games/flag-quiz/panel-flag/hard/play'])
    expect(screen.getByRole('progressbar', { name: '1 / 10 もん' })).toBeInTheDocument()
    await user.click(getRevealButton())
    await user.click(getRevealButton())
    expect(getOpenPanelCount()).toBe(3)
    await user.click(getChoiceButtons()[0])
    const nextButton = screen.getByRole('button', { name: /つぎのもんだい|けっかを みる/ })
    await user.click(nextButton)
    expect(screen.getByRole('progressbar', { name: '2 / 10 もん' })).toBeInTheDocument()
    expect(getOpenPanelCount()).toBe(1)
  })

  test(
    '10問すべてに1枚目で正解すると結果画面へ遷移し、正解数と満点(1000/1000てん)が表示される',
    async () => {
      const user = userEvent.setup()
      const { container } = renderApp(['/games/flag-quiz/panel-flag/hard/play'])
      for (let i = 0; i < QUESTION_COUNT; i += 1) {
        await answerCurrentQuestion(user, container, true)
      }
      expect(screen.getByRole('heading', { name: 'けっか' })).toBeInTheDocument()
      expect(screen.getByText(/10\s*\/\s*10\s*もん/)).toBeInTheDocument()
      expect(screen.getByText(/1000\s*\/\s*1000てん/)).toBeInTheDocument()
    },
    20000,
  )

  test(
    '一部を不正解にすると、正解数がその件数どおりに結果画面へ表示される',
    async () => {
      const user = userEvent.setup()
      const { container } = renderApp(['/games/flag-quiz/panel-flag/hard/play'])
      const pattern = [true, false, true, true, false, true, false, true, false, true]
      for (const correct of pattern) {
        await answerCurrentQuestion(user, container, correct)
      }
      expect(screen.getByText(/6\s*\/\s*10\s*もん/)).toBeInTheDocument()
    },
    20000,
  )

  test(
    '結果画面の「もういちど」でパネルクイズが再開され、1問目に戻る（1枚だけ開いた状態）',
    async () => {
      const user = userEvent.setup()
      const { container } = renderApp(['/games/flag-quiz/panel-flag/hard/play'])
      for (let i = 0; i < QUESTION_COUNT; i += 1) {
        await answerCurrentQuestion(user, container, true)
      }
      const retryButton = screen.getByRole('button', { name: 'もういちど' })
      await user.click(retryButton)
      expect(screen.getByRole('progressbar', { name: '1 / 10 もん' })).toBeInTheDocument()
      expect(getOpenPanelCount()).toBe(1)
    },
    20000,
  )

  test(
    '結果画面の「べつの むずかしさ」でパネルめくりモードのむずかしさ選択画面に戻る',
    async () => {
      const user = userEvent.setup()
      const { container } = renderApp(['/games/flag-quiz/panel-flag/hard/play'])
      for (let i = 0; i < QUESTION_COUNT; i += 1) {
        await answerCurrentQuestion(user, container, true)
      }
      const levelButton = screen.getByRole('button', { name: 'べつの むずかしさ' })
      await user.click(levelButton)
      expect(screen.getByRole('heading', { name: 'むずかしさを えらんでね' })).toBeInTheDocument()
      expect(screen.getByText('パネルめくり')).toBeInTheDocument()
    },
    20000,
  )

  test('結果画面へ直接アクセス（stateなし）すると開始画面へリダイレクトされる', () => {
    renderApp(['/games/flag-quiz/panel-flag/hard/result'])
    expect(screen.getByRole('heading', { name: 'こっきクイズ' })).toBeInTheDocument()
  })
})
