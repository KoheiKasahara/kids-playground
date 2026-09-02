import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ColorPaintPuzzlePlay from './ColorPaintPuzzlePlay'
import { PAINT_COLORS, UNPAINTED_FILL } from './paintColors'
import { PAINT_PICTURES, findPaintPicture } from './paintPictures'

function renderPlay() {
  return render(
    <MemoryRouter>
      <ColorPaintPuzzlePlay />
    </MemoryRouter>,
  )
}

const CAR_AREAS = findPaintPicture('car')!.areas

function getAreaButton(label: string) {
  return screen.getByRole('button', { name: label })
}

describe('ColorPaintPuzzlePlay', () => {
  test('初期表示: タイトル・もどる・7色パレット・やりなおし・3つの題材ボタンが出る', () => {
    renderPlay()
    expect(screen.getByRole('heading', { name: 'いろぬりパズル' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '← もどる' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'やりなおし' })).toBeInTheDocument()
    for (const color of PAINT_COLORS) {
      expect(screen.getByRole('button', { name: color.label })).toBeInTheDocument()
    }
    for (const picture of PAINT_PICTURES) {
      expect(screen.getByRole('button', { name: picture.label })).toBeInTheDocument()
    }
  })

  test('初期選択色は「あか」で、aria-pressedがあかだけtrue', () => {
    renderPlay()
    for (const color of PAINT_COLORS) {
      const button = screen.getByRole('button', { name: color.label })
      expect(button).toHaveAttribute('aria-pressed', color.id === 'red' ? 'true' : 'false')
    }
  })

  test('色を選ぶとaria-pressedの選択が移る', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(screen.getByRole('button', { name: 'あお' }))
    expect(screen.getByRole('button', { name: 'あお' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'あか' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('エリアをクリックすると選択色のhexで塗られる', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(getAreaButton('くるまの ボディ'))
    expect(getAreaButton('くるまの ボディ')).toHaveAttribute('fill', '#e8453c')
  })

  test('別の色を選んで同じエリアをクリックするとfillが変わる', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(getAreaButton('くるまの ボディ'))
    expect(getAreaButton('くるまの ボディ')).toHaveAttribute('fill', '#e8453c')

    await user.click(screen.getByRole('button', { name: 'みどり' }))
    await user.click(getAreaButton('くるまの ボディ'))
    expect(getAreaButton('くるまの ボディ')).toHaveAttribute('fill', '#37b24d')
  })

  test('2つの異なるエリアをそれぞれ別の色で塗ると独立に色が付く', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(getAreaButton('くるまの ボディ'))
    await user.click(screen.getByRole('button', { name: 'きいろ' }))
    await user.click(getAreaButton('やね'))

    expect(getAreaButton('くるまの ボディ')).toHaveAttribute('fill', '#e8453c')
    expect(getAreaButton('やね')).toHaveAttribute('fill', '#fcc419')
  })

  test('やりなおしを押すと全エリアのfillがUNPAINTED_FILLに戻る', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(getAreaButton('くるまの ボディ'))
    await user.click(getAreaButton('やね'))
    await user.click(screen.getByRole('button', { name: 'やりなおし' }))

    for (const area of CAR_AREAS) {
      expect(getAreaButton(area.label)).toHaveAttribute('fill', UNPAINTED_FILL)
    }
  })

  test('題材を切り替えても、戻ってきたときに塗った色が残っている', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(getAreaButton('くるまの ボディ'))
    expect(getAreaButton('くるまの ボディ')).toHaveAttribute('fill', '#e8453c')

    await user.click(screen.getByRole('button', { name: 'さかな' }))
    expect(screen.queryByRole('button', { name: 'くるまの ボディ' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'くるま' }))
    expect(getAreaButton('くるまの ボディ')).toHaveAttribute('fill', '#e8453c')
  })

  test('全塗りエリアがrole="button"かつアクセシブルネームを持つ', () => {
    renderPlay()
    const allButtons = screen.getAllByRole('button')
    const nonAreaButtonCount =
      1 /* もどる */ + PAINT_PICTURES.length + PAINT_COLORS.length + 1 /* やりなおし */
    expect(allButtons.length - nonAreaButtonCount).toBe(CAR_AREAS.length)
    for (const area of CAR_AREAS) {
      expect(getAreaButton(area.label)).toBeInTheDocument()
    }
  })

  test('キーボード(Enter)でもエリアを塗れる', async () => {
    const user = userEvent.setup()
    renderPlay()
    const bodyArea = getAreaButton('くるまの ボディ')
    bodyArea.focus()
    await user.keyboard('{Enter}')
    expect(getAreaButton('くるまの ボディ')).toHaveAttribute('fill', '#e8453c')
  })
})
