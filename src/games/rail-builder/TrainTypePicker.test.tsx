import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { TRAIN_TYPES } from './railFleetModel'
import TrainTypePicker from './TrainTypePicker'

const FORBIDDEN_NAME_TEXTS = ['E5', 'E6', 'N700S', 'E7', 'W7', 'E7/W7', 'ドクターイエロー', 'はやぶさ', 'こまち', 'のぞみ', 'basic']

describe('TrainTypePicker', () => {
  test('6種類の車両タイプすべてを選択できる', () => {
    render(
      <TrainTypePicker
        title="えらぼう"
        ariaLabel="でんしゃの みためを えらぶ"
        selectedType={null}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )

    const options = screen.getAllByRole('button', { name: /でんしゃの みため \d/ })
    expect(options).toHaveLength(TRAIN_TYPES.length)
    expect(options).toHaveLength(6)
  })

  test('車両名・形式名のテキストを一切表示しない', () => {
    render(
      <TrainTypePicker
        title="えらぼう"
        ariaLabel="でんしゃの みためを えらぶ"
        selectedType={null}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )

    const bodyText = document.body.textContent ?? ''
    for (const forbidden of FORBIDDEN_NAME_TEXTS) {
      expect(bodyText).not.toContain(forbidden)
    }
  })

  test('タップした見た目のtrainTypeでonSelectが呼ばれる', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <TrainTypePicker
        title="えらぼう"
        ariaLabel="でんしゃの みためを えらぶ"
        selectedType={null}
        onSelect={onSelect}
        onClose={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'でんしゃの みため 2' }))

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(TRAIN_TYPES[1])
  })

  test('N700系風のカードを選択できる', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <TrainTypePicker
        title="えらぼう"
        ariaLabel="でんしゃの みためを えらぶ"
        selectedType={null}
        onSelect={onSelect}
        onClose={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'でんしゃの みため 4' }))

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('n700s')
  })

  test('こまち風のカードを選択できる', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <TrainTypePicker
        title="えらぼう"
        ariaLabel="でんしゃの みためを えらぶ"
        selectedType={null}
        onSelect={onSelect}
        onClose={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'でんしゃの みため 3' }))

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('e6')
  })

  test('6番目のカードを選ぶとE7/W7のtrainTypeが渡される', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <TrainTypePicker
        title="えらぼう"
        ariaLabel="でんしゃの みためを えらぶ"
        selectedType={null}
        onSelect={onSelect}
        onClose={() => {}}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'でんしゃの みため 6' }))

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('e7w7')
  })

  test('選択中の車両タイプだけがaria-pressed=trueになる', () => {
    render(
      <TrainTypePicker
        title="かえよう"
        ariaLabel="でんしゃの みためを えらぶ"
        selectedType={TRAIN_TYPES[3]!}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )

    const options = screen.getAllByRole('button', { name: /でんしゃの みため \d/ })
    const pressedStates = options.map((option) => option.getAttribute('aria-pressed'))
    expect(pressedStates).toEqual(['false', 'false', 'false', 'true', 'false', 'false'])
  })

  test('追加モード相当(selectedType=null)ではどれも強調されない', () => {
    render(
      <TrainTypePicker
        title="えらぼう"
        ariaLabel="でんしゃの みためを えらぶ"
        selectedType={null}
        onSelect={() => {}}
        onClose={() => {}}
      />,
    )

    const options = screen.getAllByRole('button', { name: /でんしゃの みため \d/ })
    for (const option of options) {
      expect(option).toHaveAttribute('aria-pressed', 'false')
    }
  })

  test('とじるボタンでonCloseが呼ばれる', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <TrainTypePicker
        title="えらぼう"
        ariaLabel="でんしゃの みためを えらぶ"
        selectedType={null}
        onSelect={() => {}}
        onClose={onClose}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'でんしゃえらびを とじる' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})
