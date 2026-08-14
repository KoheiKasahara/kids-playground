import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import App from '../../app/App'
import { fruits } from './data/fruits'

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function fruitForQuestionImage() {
  const src = screen.getByAltText('もんだいの イラスト').getAttribute('src') ?? ''
  const fileName = src.match(/images\/fruits\/([a-z-]+)\.png$/)?.[1]
  const fruit = fruits.find((item) => item.id === fileName)
  if (!fruit) throw new Error(`unexpected fruit image: ${src}`)
  return fruit
}

describe('くだものクイズ', () => {
  test('開始画面から2つの回答方式を選べ、難易度選択を表示しない', async () => {
    const user = userEvent.setup()
    renderApp('/games/fruit-quiz')

    expect(screen.getByRole('heading', { name: 'くだものクイズ' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /イラストを みて こたえる/ }))

    expect(screen.getByRole('heading', { name: 'これは なに？' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /むずかしさ/ })).not.toBeInTheDocument()
  })

  test('イラスト→名前は問題画像と4つの名前選択肢を表示し、正解を示す', async () => {
    const user = userEvent.setup()
    renderApp('/games/fruit-quiz/image-to-name/play')
    const answer = fruitForQuestionImage()

    const choices = fruits.filter((item) => screen.queryByRole('button', { name: item.name }))
    expect(choices).toHaveLength(4)

    await user.click(screen.getByRole('button', { name: answer.name }))
    expect(screen.getByRole('status')).toHaveTextContent(`こたえ: ${answer.name}`)
    expect(screen.getByRole('button', { name: `◯ ${answer.name}` })).toBeDisabled()
  })

  test('イラスト→名前は回答後に次の問題へ進める', async () => {
    const user = userEvent.setup()
    renderApp('/games/fruit-quiz/image-to-name/play')
    const firstAnswer = fruitForQuestionImage()

    await user.click(screen.getByRole('button', { name: firstAnswer.name }))
    await user.click(screen.getByRole('button', { name: 'つぎのもんだい' }))

    expect(screen.getByRole('heading', { name: 'これは なに？' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    // ヘッダの「やめる」「よみあげ」トグルを除いた、選択肢ボタンだけを数える。
    expect(screen.getAllByRole('button', { name: /^(?!やめる$)(?!よみあげ).+/ })).toHaveLength(4)
  })

  test('名前→イラストは4択画像を表示し、不正解でも正しい名前と画像を示す', async () => {
    const user = userEvent.setup()
    renderApp('/games/fruit-quiz/name-to-image/play')

    const choices = screen.getAllByRole('button', { name: /ばんめ の イラスト/ })
    expect(choices).toHaveLength(4)
    await user.click(choices[0])

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('こたえ:')
    expect(screen.getByAltText(/せいかいの/)).toBeInTheDocument()
  })

  test('名前→イラストは回答後に次の問題へ進める', async () => {
    const user = userEvent.setup()
    renderApp('/games/fruit-quiz/name-to-image/play')

    await user.click(screen.getAllByRole('button', { name: /ばんめ の イラスト/ })[0])
    await user.click(screen.getByRole('button', { name: 'つぎのもんだい' }))

    expect(screen.getAllByRole('button', { name: /ばんめ の イラスト/ })).toHaveLength(4)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
  })
})
