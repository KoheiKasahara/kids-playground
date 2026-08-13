import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import App from '../../app/App'
import { vegetables } from './data/vegetables'

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

function vegetableForQuestionImage() {
  const src = screen.getByAltText('もんだいの イラスト').getAttribute('src') ?? ''
  const fileName = src.match(/images\/vegetables\/([a-z-]+)\.png$/)?.[1]
  const vegetable = vegetables.find((item) => item.id === fileName)
  if (!vegetable) throw new Error(`unexpected vegetable image: ${src}`)
  return vegetable
}

describe('おやさいクイズ', () => {
  test('開始画面から2つの回答方式を選べ、難易度選択を表示しない', async () => {
    const user = userEvent.setup()
    renderApp('/games/vegetable-quiz')

    expect(screen.getByRole('heading', { name: 'おやさいクイズ' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /イラストを みて こたえる/ }))

    expect(screen.getByRole('heading', { name: 'これは なに？' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /むずかしさ/ })).not.toBeInTheDocument()
  })

  test('イラスト→名前は問題画像と4つの名前選択肢を表示し、正解を示す', async () => {
    const user = userEvent.setup()
    renderApp('/games/vegetable-quiz/image-to-name/play')
    const answer = vegetableForQuestionImage()

    const choices = vegetables.filter((item) => screen.queryByRole('button', { name: item.name }))
    expect(choices).toHaveLength(4)

    await user.click(screen.getByRole('button', { name: answer.name }))
    expect(screen.getByRole('status')).toHaveTextContent(`こたえ: ${answer.name}`)
    expect(screen.getByRole('button', { name: `◯ ${answer.name}` })).toBeDisabled()
  })

  test('名前→イラストは4択画像を表示し、不正解でも正しい名前と画像を示す', async () => {
    const user = userEvent.setup()
    renderApp('/games/vegetable-quiz/name-to-image/play')

    const choices = screen.getAllByRole('button', { name: /ばんめ の イラスト/ })
    expect(choices).toHaveLength(4)
    await user.click(choices[0])

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('こたえ:')
    expect(screen.getByAltText(/せいかいの/)).toBeInTheDocument()
  })
})
