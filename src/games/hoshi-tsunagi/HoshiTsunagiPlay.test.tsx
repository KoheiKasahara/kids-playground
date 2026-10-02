import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import HoshiTsunagiPlay from './HoshiTsunagiPlay'
import { courseConstellations } from './hoshiGame'

function renderPlay() {
  return render(
    <MemoryRouter>
      <HoshiTsunagiPlay />
    </MemoryRouter>,
  )
}

function selectEasy() {
  fireEvent.click(screen.getByRole('button', { name: 'かんたん ほしが すくない' }))
}

function star(container: HTMLElement, index: number) {
  const element = container.querySelector(`[data-star-index="${index}"]`)
  if (!element) throw new Error(`data-star-index="${index}" が見つかりません`)
  return element
}

/** 表示中の星座を、1ばんめから順にタップしてつなぎおえる。 */
function connectCurrent(container: HTMLElement, count: number) {
  for (let index = 0; index < count; index += 1) {
    fireEvent.pointerDown(star(container, index))
    fireEvent.pointerUp(container.querySelector('svg[data-connected]')!)
  }
}

describe('HoshiTsunagiPlay', () => {
  test('初期表示: タイトル・もどる・コース選択が出る', () => {
    renderPlay()
    expect(screen.getByRole('heading', { name: 'よぞらの ほしつなぎ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'かんたん ほしが すくない' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ふつう ほしが ちょっと おおい' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'むずかしい ほしが たくさん' })).toBeInTheDocument()
  })

  test('コースを選ぶと、番号つきの星が出て「1の ほしから つなごう」とさそう', () => {
    renderPlay()
    selectEasy()
    const first = courseConstellations('easy')[0]!
    expect(screen.getByRole('status')).toHaveTextContent('1の ほしから つなごう')
    first.points.forEach((_, index) => {
      expect(screen.getByRole('button', { name: `${index + 1}の ほし` })).toBeInTheDocument()
    })
  })

  test('順番どおりにつなぐと、つぎの番号を教え、ちがう星ではヒントが出る', () => {
    const { container } = renderPlay()
    selectEasy()
    fireEvent.pointerDown(star(container, 0))
    expect(screen.getByRole('status')).toHaveTextContent('つぎは 2の ほし')
    expect(screen.getByRole('button', { name: '1の ほし つないだ' })).toBeInTheDocument()

    fireEvent.pointerDown(star(container, 3))
    expect(screen.getByRole('status')).toHaveTextContent('つぎは 2の ほし')
    expect(star(container, 1).querySelector('circle[r="5"]')).not.toBeNull()
  })

  test('キーボードでも星をつなげる', () => {
    renderPlay()
    selectEasy()
    fireEvent.keyDown(screen.getByRole('button', { name: '1の ほし' }), { key: 'Enter' })
    expect(screen.getByRole('status')).toHaveTextContent('つぎは 2の ほし')
  })

  test('さいごまでつなぐと星座ができ、つぎへ進んで、全部できると結果が出る', () => {
    const { container } = renderPlay()
    selectEasy()
    const course = courseConstellations('easy')

    course.forEach((constellation, stage) => {
      connectCurrent(container, constellation.points.length)
      expect(screen.getByRole('status')).toHaveTextContent(`${constellation.name}の せいざが できた！`)
      expect(screen.getByRole('group', { name: `${constellation.name}の せいざ` })).toBeInTheDocument()
      const isLast = stage === course.length - 1
      fireEvent.click(screen.getByRole('button', { name: isLast ? 'おしまい' : 'つぎの せいざ' }))
    })

    expect(screen.getByRole('status')).toHaveTextContent('ぜんぶの せいざが できたね！')
    fireEvent.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(screen.getByRole('status')).toHaveTextContent('1の ほしから つなごう')
  })

  test('むずかしい コースは星がたくさんある形から始まり、さいごまでつなぐとできあがる', () => {
    const { container } = renderPlay()
    fireEvent.click(screen.getByRole('button', { name: 'むずかしい ほしが たくさん' }))
    const first = courseConstellations('hard')[0]!
    expect(container.querySelectorAll('[data-star-index]')).toHaveLength(first.points.length)
    connectCurrent(container, first.points.length)
    expect(screen.getByRole('status')).toHaveTextContent(`${first.name}の せいざが できた！`)
  })

  test('まえ／つぎのボタンで、つながなくても星座を行き来できる', () => {
    const { container } = renderPlay()
    selectEasy()
    const course = courseConstellations('easy')
    const previous = screen.getByRole('button', { name: 'まえの せいざ' })
    const next = screen.getByRole('button', { name: 'つぎの せいざへ すすむ' })
    expect(previous).toBeDisabled()

    fireEvent.pointerDown(star(container, 0))
    fireEvent.click(next)
    expect(screen.getByRole('list', { name: `2こめ / ${course.length}こ` })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-star-index]')).toHaveLength(course[1]!.points.length)
    expect(screen.getByRole('status')).toHaveTextContent('1の ほしから つなごう')
    expect(previous).toBeEnabled()

    fireEvent.click(previous)
    expect(screen.getByRole('list', { name: `1こめ / ${course.length}こ` })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1の ほしから つなごう')

    for (let index = 1; index < course.length; index += 1) fireEvent.click(next)
    expect(screen.getByRole('list', { name: `${course.length}こめ / ${course.length}こ` })).toBeInTheDocument()
    expect(next).toBeDisabled()
  })

  test('やめる でコース選択にもどれる', () => {
    renderPlay()
    selectEasy()
    fireEvent.click(screen.getByRole('button', { name: 'やめる' }))
    expect(screen.getByRole('button', { name: 'かんたん ほしが すくない' })).toBeInTheDocument()
  })

  test('おとのボタンで ON/OFF を切り替えられる', () => {
    renderPlay()
    fireEvent.click(screen.getByRole('button', { name: 'おとを けす' }))
    expect(screen.getByRole('button', { name: 'おとを だす' })).toBeInTheDocument()
  })
})
