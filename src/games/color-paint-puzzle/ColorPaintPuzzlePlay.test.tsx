import { fireEvent, render, screen } from '@testing-library/react'
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

/**
 * 塗りレイヤーをareaIdで引く。完成演出中はエリアがボタンではなくなる（絵の一部になる）ため、
 * ロールに依存せずフェーズをまたいで同じ要素を見られるようにしている。
 */
function getAreaShape(container: HTMLElement, areaId: string) {
  const shape = container.querySelector(`[data-area-id="${areaId}"]`)
  if (!shape) throw new Error(`data-area-id="${areaId}" が見つかりません`)
  return shape
}

function getAreaFill(container: HTMLElement, areaId: string) {
  return getAreaShape(container, areaId).getAttribute('fill')
}

/** くるまを「あか(ボディ)＋あお(やね)」の一部塗り状態にする（一部エリアは未塗りのまま残す）。 */
async function paintCarPartially(user: ReturnType<typeof userEvent.setup>) {
  await user.click(getAreaButton('くるまの ボディ'))
  await user.click(screen.getByRole('button', { name: 'あお' }))
  await user.click(getAreaButton('やね'))
}

function finishButton() {
  return screen.getByRole('button', { name: 'できた！' })
}

describe('ColorPaintPuzzlePlay', () => {
  test('初期表示: タイトル・もどる・色パレット・やりなおし・6つの題材ボタンが出る', () => {
    renderPlay()
    expect(screen.getByRole('heading', { name: 'うごくぬりえ' })).toBeInTheDocument()
    expect(screen.getByText('いろを えらんで、えを タップしてね')).toBeInTheDocument()
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
    expect(screen.getByText('えらんだ いろ：').parentElement).toHaveTextContent('あお')
  })

  test('エリアをクリックすると選択色のhexで塗られる', async () => {
    const user = userEvent.setup()
    const { container } = renderPlay()
    await user.click(getAreaButton('くるまの ボディ'))
    expect(getAreaButton('くるまの ボディ')).toHaveAttribute('fill', '#e8453c')
    expect(getAreaShape(container, 'body')).toHaveAttribute('data-paint-feedback', '1')
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
      1 /* もどる */ + PAINT_PICTURES.length + PAINT_COLORS.length + 1 /* やりなおし */ + 1 /* できた！ */
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

describe('ColorPaintPuzzlePlay: 追加した題材（ロボット・ロケット・きょうりゅう）', () => {
  const ADDED_PICTURE_IDS = ['robot', 'rocket', 'dinosaur'] as const

  test('題材えらびに6件すべてが並び、選ぶと選択がその1件だけに移る', async () => {
    const user = userEvent.setup()
    renderPlay()
    expect(screen.getAllByRole('button', { pressed: true }).length).toBeGreaterThan(0)

    for (const id of ADDED_PICTURE_IDS) {
      const picture = findPaintPicture(id)!
      await user.click(screen.getByRole('button', { name: picture.label }))
      for (const option of PAINT_PICTURES) {
        expect(
          screen.getByRole('button', { name: option.label }),
          `${id}選択中の ${option.id}`,
        ).toHaveAttribute('aria-pressed', option.id === id ? 'true' : 'false')
      }
    }
  })

  test.each(ADDED_PICTURE_IDS)('%s: 全エリアがボタンとして出て、タップで塗れる', async (id) => {
    const user = userEvent.setup()
    const { container } = renderPlay()
    const picture = findPaintPicture(id)!

    await user.click(screen.getByRole('button', { name: picture.label }))
    expect(screen.getByRole('img', { name: `${picture.label}の ぬりえ` })).toBeInTheDocument()

    // エリア以外のボタン（もどる・題材6件・色・やりなおし・できた！）を除いた数が
    // ちょうどエリア数と一致する＝塗れないエリアも、余分なボタンもない。
    const nonAreaButtonCount = 1 + PAINT_PICTURES.length + PAINT_COLORS.length + 1 + 1
    expect(screen.getAllByRole('button').length - nonAreaButtonCount).toBe(picture.areas.length)

    for (const area of picture.areas) {
      await user.click(getAreaButton(area.label))
      expect(getAreaFill(container, area.id), `${id}.${area.id}`).toBe('#e8453c')
    }
  })

  test.each(ADDED_PICTURE_IDS)('%s: 塗ってから他の題材へ行き、戻ると色が残っている', async (id) => {
    const user = userEvent.setup()
    const { container } = renderPlay()
    const picture = findPaintPicture(id)!
    const firstPaintable = picture.areas[picture.areas.length - 1]

    await user.click(screen.getByRole('button', { name: picture.label }))
    await user.click(screen.getByRole('button', { name: 'あお' }))
    await user.click(getAreaButton(firstPaintable.label))
    expect(getAreaFill(container, firstPaintable.id)).toBe('#1c7ed6')

    await user.click(screen.getByRole('button', { name: 'くるま' }))
    expect(container.querySelectorAll('svg')).toHaveLength(1)
    // くるまの塗りは独立している（さっきの色が持ち込まれない）。
    expect(getAreaFill(container, 'body')).toBe(UNPAINTED_FILL)

    await user.click(screen.getByRole('button', { name: picture.label }))
    expect(getAreaFill(container, firstPaintable.id)).toBe('#1c7ed6')
  })

  test.each(ADDED_PICTURE_IDS)('%s: 「できた！」→「もういちどぬる」が成立し、色も残る', async (id) => {
    const user = userEvent.setup()
    const { container } = renderPlay()
    const picture = findPaintPicture(id)!
    const target = picture.areas[picture.areas.length - 1]

    await user.click(screen.getByRole('button', { name: picture.label }))
    await user.click(getAreaButton(target.label))
    await user.click(finishButton())

    expect(screen.getByRole('status')).toHaveTextContent('できた！')
    const canvas = screen.getByRole('img', { name: `${picture.label}の ぬりえ` })
    expect(canvas).toHaveAttribute('data-phase', 'celebrating')
    expect(getAreaFill(container, target.id)).toBe('#e8453c')

    await user.click(screen.getByRole('button', { name: 'もういちどぬる' }))
    expect(canvas).toHaveAttribute('data-phase', 'coloring')
    expect(getAreaFill(container, target.id)).toBe('#e8453c')
  })

  test('演出中、追加した3題材にも本体グループと動くパーツのgがある', async () => {
    const user = userEvent.setup()
    const { container } = renderPlay()
    const groupsAndParts: Record<string, readonly string[]> = {
      robot: ['robotArmLeft', 'robotArmRight', 'robotAntenna'],
      rocket: ['rocketFlame', 'rocketStars'],
      dinosaur: ['dinoTail', 'dinoHead'],
    }
    const motionGroupByPicture: Record<string, string> = {
      robot: 'robot',
      rocket: 'rocket',
      dinosaur: 'dino',
    }

    for (const id of ADDED_PICTURE_IDS) {
      const picture = findPaintPicture(id)!
      await user.click(screen.getByRole('button', { name: picture.label }))
      await user.click(finishButton())

      const group = container.querySelector(`[data-motion-group="${motionGroupByPicture[id]}"]`)
      expect(group, `${id}: 本体グループ`).not.toBeNull()
      // 背景は本体グループの外＝絵だけが動く。
      expect(group!.contains(getAreaShape(container, 'sky'))).toBe(false)
      for (const part of groupsAndParts[id]) {
        expect(container.querySelector(`[data-motion-part="${part}"]`), `${id}: ${part}`).not.toBeNull()
      }

      await user.click(screen.getByRole('button', { name: 'もういちどぬる' }))
    }
  })
})

// ===== Phase 2: 「できた！」と完成演出 =====================================

describe('ColorPaintPuzzlePlay: 「できた！」ボタン', () => {
  test('ぬりえ画面に「できた！」ボタンが出ている', () => {
    renderPlay()
    expect(finishButton()).toBeInTheDocument()
  })

  test('何も塗っていなくても押せて、完成演出へ移る（システムは完成判定しない）', async () => {
    const user = userEvent.setup()
    const { container } = renderPlay()
    for (const area of CAR_AREAS) {
      expect(getAreaFill(container, area.id)).toBe(UNPAINTED_FILL)
    }

    await user.click(finishButton())

    expect(screen.getByRole('status')).toHaveTextContent('できた！')
    expect(screen.getByRole('button', { name: 'もういちどぬる' })).toBeInTheDocument()
  })

  test('一部だけ塗った状態（複数色＋未塗りあり）でも押せる', async () => {
    const user = userEvent.setup()
    const { container } = renderPlay()
    await paintCarPartially(user)
    // 塗ったのはボディ(あか)とやね(あお)だけで、ライトやタイヤは未塗りのまま。
    expect(getAreaFill(container, 'light')).toBe(UNPAINTED_FILL)
    expect(getAreaFill(container, 'wheelFront')).toBe(UNPAINTED_FILL)

    await user.click(finishButton())

    expect(screen.getByRole('status')).toHaveTextContent('できた！')
    expect(screen.getByRole('button', { name: 'もういちどぬる' })).toBeInTheDocument()
  })

  test('多く塗った状態でも押せる', async () => {
    const user = userEvent.setup()
    renderPlay()
    for (const area of CAR_AREAS) {
      await user.click(getAreaButton(area.label))
    }
    await user.click(finishButton())
    expect(screen.getByRole('status')).toHaveTextContent('できた！')
  })

  test('やりなおし直後（全部未塗り）でも押せる', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(getAreaButton('くるまの ボディ'))
    await user.click(screen.getByRole('button', { name: 'やりなおし' }))
    await user.click(finishButton())
    expect(screen.getByRole('status')).toHaveTextContent('できた！')
  })
})

describe('ColorPaintPuzzlePlay: 完成演出中', () => {
  test('ユーザーが塗った色がそのまま保持される（未塗りは未塗りのまま）', async () => {
    const user = userEvent.setup()
    const { container } = renderPlay()
    await paintCarPartially(user)

    expect(getAreaFill(container, 'body')).toBe('#e8453c')
    expect(getAreaFill(container, 'roof')).toBe('#1c7ed6')
    expect(getAreaFill(container, 'light')).toBe(UNPAINTED_FILL)

    await user.click(finishButton())

    // 別の完成画像へ差し替えず、同じSVG・同じ塗り状態のまま動かすので色は変わらない。
    expect(getAreaFill(container, 'body')).toBe('#e8453c')
    expect(getAreaFill(container, 'roof')).toBe('#1c7ed6')
    expect(getAreaFill(container, 'light')).toBe(UNPAINTED_FILL)
  })

  test('絵は同じSVGのまま残り、data-phaseがcelebratingに切り替わる', async () => {
    const user = userEvent.setup()
    const { container } = renderPlay()
    const canvasBefore = screen.getByRole('img', { name: 'くるまの ぬりえ' })
    expect(canvasBefore).toHaveAttribute('data-phase', 'coloring')

    await user.click(finishButton())

    const canvasAfter = screen.getByRole('img', { name: 'くるまの ぬりえ' })
    expect(canvasAfter).toHaveAttribute('data-phase', 'celebrating')
    // 同じSVG要素が使い回されている（作り直されると塗りが一瞬消える）。
    expect(canvasAfter).toBe(canvasBefore)
    expect(container.querySelectorAll('svg')).toHaveLength(1)
  })

  test('アニメーション対象のグループがDOMにあり、塗ったエリアはその中にある', async () => {
    const user = userEvent.setup()
    const { container } = renderPlay()
    await user.click(getAreaButton('くるまの ボディ'))
    await user.click(finishButton())

    const carGroup = container.querySelector('[data-motion-group="car"]')
    expect(carGroup).not.toBeNull()
    // 塗ったボディは車のグループの中＝グループが動けばユーザーの色ごと動く。
    expect(carGroup!.contains(getAreaShape(container, 'body'))).toBe(true)
    // 背景（そら・じめん）は動かないので、グループの外に残っている。
    expect(carGroup!.contains(getAreaShape(container, 'sky'))).toBe(false)
    expect(carGroup!.contains(getAreaShape(container, 'ground'))).toBe(false)
    // 左右のタイヤはそれぞれ独立した<g>（自分の中心で回すため）。
    expect(container.querySelector('[data-motion-part="wheelBack"]')).not.toBeNull()
    expect(container.querySelector('[data-motion-part="wheelFront"]')).not.toBeNull()
  })

  test('題材ごとに本体グループが用意されている（さかな・ちょうちょ）', async () => {
    const user = userEvent.setup()
    const { container } = renderPlay()

    await user.click(screen.getByRole('button', { name: 'さかな' }))
    await user.click(finishButton())
    expect(container.querySelector('[data-motion-group="fish"]')).not.toBeNull()
    expect(container.querySelector('[data-motion-part="fishTail"]')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'もういちどぬる' }))
    await user.click(screen.getByRole('button', { name: 'ちょうちょ' }))
    await user.click(finishButton())
    expect(container.querySelector('[data-motion-group="butterfly"]')).not.toBeNull()
    expect(container.querySelector('[data-motion-part="wingLeft"]')).not.toBeNull()
    expect(container.querySelector('[data-motion-part="wingRight"]')).not.toBeNull()
  })

  test('通常の操作UI（パレット・題材えらび・やりなおし・できた！）は隠れる', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(finishButton())

    for (const color of PAINT_COLORS) {
      expect(screen.queryByRole('button', { name: color.label })).not.toBeInTheDocument()
    }
    for (const picture of PAINT_PICTURES) {
      expect(screen.queryByRole('button', { name: picture.label })).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'やりなおし' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'できた！' })).not.toBeInTheDocument()
    // ホームへ戻る導線は、いつでも抜けられるように残す。
    expect(screen.getByRole('button', { name: '← もどる' })).toBeInTheDocument()
  })

  test('演出中はエリアがボタンでなくなり、タップしても塗られない', async () => {
    const user = userEvent.setup()
    const { container } = renderPlay()
    await user.click(finishButton())

    for (const area of CAR_AREAS) {
      expect(screen.queryByRole('button', { name: area.label })).not.toBeInTheDocument()
    }

    fireEvent.click(getAreaShape(container, 'body'))
    fireEvent.keyDown(getAreaShape(container, 'body'), { key: 'Enter' })
    expect(getAreaFill(container, 'body')).toBe(UNPAINTED_FILL)
  })

  test('「できた！」を連打しても演出が多重起動せず、状態も壊れない', async () => {
    const user = userEvent.setup()
    const { container } = renderPlay()
    await paintCarPartially(user)

    const button = finishButton()
    // ボタンは1回目で消えるので、同じ要素参照に対して直接クリックを撃ち込む。
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)

    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'もういちどぬる' })).toHaveLength(1)
    expect(container.querySelectorAll('svg')).toHaveLength(1)
    expect(getAreaFill(container, 'body')).toBe('#e8453c')
    expect(getAreaFill(container, 'roof')).toBe('#1c7ed6')
  })
})

describe('ColorPaintPuzzlePlay: 演出後の導線', () => {
  test('「もういちどぬる」でぬりえ画面へ戻り、塗った色は残っている', async () => {
    const user = userEvent.setup()
    const { container } = renderPlay()
    await paintCarPartially(user)
    await user.click(finishButton())
    await user.click(screen.getByRole('button', { name: 'もういちどぬる' }))

    expect(screen.getByRole('img', { name: 'くるまの ぬりえ' })).toHaveAttribute('data-phase', 'coloring')
    expect(getAreaFill(container, 'body')).toBe('#e8453c')
    expect(getAreaFill(container, 'roof')).toBe('#1c7ed6')
    expect(getAreaFill(container, 'light')).toBe(UNPAINTED_FILL)

    // 操作UIがすべて戻っている。
    expect(finishButton()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'やりなおし' })).toBeInTheDocument()
    for (const color of PAINT_COLORS) {
      expect(screen.getByRole('button', { name: color.label })).toBeInTheDocument()
    }
  })

  test('戻ったあとに色を変えて塗り直し、もう一度「できた！」で演出を起動できる', async () => {
    const user = userEvent.setup()
    const { container } = renderPlay()
    await paintCarPartially(user)
    await user.click(finishButton())
    await user.click(screen.getByRole('button', { name: 'もういちどぬる' }))

    await user.click(screen.getByRole('button', { name: 'みどり' }))
    await user.click(getAreaButton('くるまの ボディ'))
    expect(getAreaFill(container, 'body')).toBe('#37b24d')

    await user.click(finishButton())
    expect(screen.getByRole('status')).toHaveTextContent('できた！')
    expect(getAreaFill(container, 'body')).toBe('#37b24d')
    expect(getAreaFill(container, 'roof')).toBe('#1c7ed6')
  })

  test('完成→もどる を3回繰り返しても状態が壊れない', async () => {
    const user = userEvent.setup()
    const { container } = renderPlay()
    await user.click(getAreaButton('くるまの ボディ'))

    for (let i = 0; i < 3; i += 1) {
      await user.click(finishButton())
      expect(screen.getByRole('status')).toHaveTextContent('できた！')
      await user.click(screen.getByRole('button', { name: 'もういちどぬる' }))
      expect(getAreaFill(container, 'body')).toBe('#e8453c')
    }

    expect(container.querySelectorAll('svg')).toHaveLength(1)
    expect(finishButton()).toBeInTheDocument()
  })

  test('演出から戻ったあと、やりなおしで初期状態に戻せる', async () => {
    const user = userEvent.setup()
    const { container } = renderPlay()
    await paintCarPartially(user)
    await user.click(finishButton())
    await user.click(screen.getByRole('button', { name: 'もういちどぬる' }))
    await user.click(screen.getByRole('button', { name: 'やりなおし' }))

    for (const area of CAR_AREAS) {
      expect(getAreaFill(container, area.id)).toBe(UNPAINTED_FILL)
    }
  })
})
