import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import BoardViewport from './BoardViewport'

function Board() {
  const [placed, setPlaced] = useState(0)
  return <button onClick={() => setPlaced(value => value + 1)}>おいた {placed}</button>
}

test('拡大と移動でゲームを再生成せず、全体表示へ戻れる', () => {
  render(<BoardViewport><Board /></BoardViewport>)
  fireEvent.click(screen.getByText('おいた 0'))
  const viewport = screen.getByLabelText('ばんめんの ひょうじ')
  const scrollBy = vi.fn()
  Object.defineProperties(viewport, {
    clientWidth: { value: 300 }, clientHeight: { value: 200 }, scrollBy: { value: scrollBy },
  })
  fireEvent.click(screen.getByRole('button', { name: 'ばんめんを おおきく' }))
  fireEvent.click(screen.getByRole('button', { name: 'ばんめんを したへ' }))
  expect(scrollBy).toHaveBeenCalledWith({ left: 0, top: 120, behavior: 'instant' })
  fireEvent.click(screen.getByRole('button', { name: 'ばんめんを ぜんたいひょうじ' }))
  expect(screen.getByText('おいた 1')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'ばんめんを したへ' })).not.toBeInTheDocument()
})
