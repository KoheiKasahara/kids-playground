import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QuizResultOverlay from './QuizResultOverlay'

describe('QuizResultOverlay', () => {
  test('result="correct" では「🎉 せいかい！」が表示される', () => {
    render(<QuizResultOverlay result="correct" onNext={() => {}} />)
    expect(screen.getByText('🎉 せいかい！')).toBeInTheDocument()
  })

  test('result="wrong" では「ざんねん！」が表示される', () => {
    render(<QuizResultOverlay result="wrong" onNext={() => {}} />)
    expect(screen.getByText('ざんねん！')).toBeInTheDocument()
  })

  test('answer / detail / media を省略すると、それぞれの行が表示されない', () => {
    const { container } = render(<QuizResultOverlay result="correct" onNext={() => {}} />)
    expect(screen.queryByText(/こたえ:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/てん/)).not.toBeInTheDocument()
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })

  test('answer / detail / media を渡すとそれぞれ表示される', () => {
    const { container } = render(
      <QuizResultOverlay
        result="correct"
        answer="にほん"
        detail="100てん"
        media={<img src="/flags/jp.svg" alt="" />}
        onNext={() => {}}
      />,
    )
    expect(screen.getByText('こたえ: にほん')).toBeInTheDocument()
    expect(screen.getByText('100てん')).toBeInTheDocument()
    expect(container.querySelector('img[src="/flags/jp.svg"]')).toBeInTheDocument()
  })

  test('既定のボタン文言は「つぎのもんだい」で、押すと onNext が呼ばれる', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<QuizResultOverlay result="correct" onNext={onNext} />)
    const button = screen.getByRole('button', { name: 'つぎのもんだい' })
    await user.click(button)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  test('role="status" のオーバーレイの中に、nextLabel で指定したボタンが含まれる', () => {
    render(<QuizResultOverlay result="wrong" nextLabel="けっかを みる" onNext={() => {}} />)
    const status = screen.getByRole('status')
    expect(status).toContainElement(screen.getByRole('button', { name: 'けっかを みる' }))
  })
})
