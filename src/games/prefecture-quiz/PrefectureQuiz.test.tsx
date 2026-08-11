import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import App from '../../app/App'
import { prefectures } from './data/prefectures'
import { numberedPrefecturesForRegion, prefecturesForRegion, prefectureNumberInRegion, REGION_LABEL } from './data/regions'
import PrefectureMap from './map/PrefectureMap'
import mapStyles from './map/PrefectureMap.module.css'
import PrefectureNumberPad from './PrefectureNumberPad'
import padStyles from './PrefectureNumberPad.module.css'

/** 見出し「「◯◯」は どこ？」からその問題の正解県を読み取る。 */
function currentAnswerPrefecture() {
  const heading = screen.getByRole('heading', { level: 1 })
  const match = heading.textContent?.match(/「(.+)」/)
  if (!match) throw new Error('見出しから県名を読み取れません')
  const prefecture = prefectures.find((candidate) => candidate.nameHiragana === match[1])
  if (!prefecture) throw new Error(`${match[1]} に対応する都道府県がありません`)
  return prefecture
}

/**
 * 名前→地図のプレイ画面を描画する。最初の問題はランダムなため、まれに北海道
 * （同地方に他県がなく誤答の選択肢を作れない）が出た場合は描画をやり直す。
 */
function renderNameToMapWithAlternatives() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const view = render(<MemoryRouter initialEntries={['/games/prefecture-quiz/name-to-map/play']}><App /></MemoryRouter>)
    const answer = currentAnswerPrefecture()
    if (numberedPrefecturesForRegion(answer.region).length > 1) return { ...view, answer }
    view.unmount()
  }
  throw new Error('複数県を持つ地方の問題が見つかりませんでした')
}

describe('Prefecture quiz screens', () => {
  test('開始画面に3モードを表示する', () => {
    render(<MemoryRouter initialEntries={['/games/prefecture-quiz']}><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: '都道府県クイズ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /かたちを みて/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /なまえを みて/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /にほんちず から/ })).toBeInTheDocument()
  })

  test('日本地図の47県はキーボード操作できるボタンになる', () => {
    render(<PrefectureMap onSelect={() => undefined} />)
    expect(screen.getAllByRole('button')).toHaveLength(47)
    expect(screen.getByRole('button', { name: '1ばんめ の ばしょを えらぶ' })).toHaveAttribute('tabindex', '0')
  })

  test('形→名前は回答前に県名を輪郭のアクセシブルネームへ出さず、回答後にひらがなの答えを出す', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/prefecture-quiz/shape-to-name/play']}><App /></MemoryRouter>)
    expect(screen.getByRole('img', { name: '都道府県の かたち' })).toBeInTheDocument()
    const choices = screen.getAllByRole('button').filter((button) => button.textContent !== 'やめる')
    await user.click(choices[0])
    expect(screen.getByRole('status')).toHaveTextContent('こたえ:')
    expect(screen.getByRole('status')).not.toHaveTextContent('都道府県の かたち')
  })

  test('名前→形は4択を一度選ぶとロックし、次問へ進める', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/prefecture-quiz/name-to-shape/play']}><App /></MemoryRouter>)
    const choices = screen.getAllByRole('button').filter((button) => button.textContent !== 'やめる')
    expect(choices).toHaveLength(4)
    expect(choices[0]).toHaveAccessibleName('1ばんめ の かたち')
    await user.click(choices[0])
    expect(choices.every((choice) => (choice as HTMLButtonElement).disabled)).toBe(true)
    await user.click(screen.getByRole('button', { name: 'つぎの もんだい' }))
    expect(screen.getByRole('button', { name: '1ばんめ の かたち' })).not.toBeDisabled()
  })

  test('名前→地図は地方だけを表示し、Enterで選び、回答後に答えを出す', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/prefecture-quiz/name-to-map/play']}><App /></MemoryRouter>)
    const map = screen.getByRole('group', { name: '都道府県をえらぶ ちず' })
    const places = within(map).getAllByRole('button')
    // 地方のpathに加え、九州・沖縄地方では沖縄専用insetが存在しうる。
    expect(places.length).toBeGreaterThanOrEqual(1)
    expect(places[0]).toHaveAccessibleName('1ばんめ の ばしょを えらぶ')
    places[0].focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('こたえ:')
    expect(screen.getByRole('status')).not.toHaveTextContent('にほんでは このへん！')
  })

  test('沖縄を含む九州・沖縄地方では沖縄の専用insetもキーボードで選べる', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<PrefectureMap items={prefecturesForRegion('kyushuOkinawa')} onSelect={onSelect} />)
    const okinawaInset = screen.getByRole('button', { name: '8ばんめ の ばしょを えらぶ' })
    okinawaInset.focus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('47')
  })

  test('地方地図のnumbered表示では全県に番号ボタンがある（中部9県で確認）', () => {
    const chubu = numberedPrefecturesForRegion('chubu')
    render(<PrefectureNumberPad items={chubu} answerId="never" selectedId={null} onSelect={() => undefined} />)
    const pad = screen.getByRole('group', { name: 'ばんごうで こたえる' })
    const buttons = within(pad).getAllByRole('button')
    expect(buttons).toHaveLength(9)
    for (let number = 1; number <= 9; number += 1) {
      expect(within(pad).getByRole('button', { name: `${number}ばん` })).toBeInTheDocument()
    }
  })

  test('中部地方の地図にnumberedを付けると9県ぶんの番号バッジが描画される', () => {
    const chubu = prefecturesForRegion('chubu')
    const { container } = render(<PrefectureMap items={chubu} onSelect={() => undefined} numbered />)
    expect(container.querySelectorAll('circle')).toHaveLength(chubu.length)
  })

  test('回答後も沖縄insetを同位置に残し、県名を読めるようにする', () => {
    const kyushu = prefecturesForRegion('kyushuOkinawa')
    const okinawa = kyushu.find((prefecture) => prefecture.id === '47')
    if (!okinawa) throw new Error('テスト用の都道府県がありません')
    render(<PrefectureMap items={kyushu} answer={okinawa} selectedId="47" onSelect={() => undefined} disabled revealed />)
    const inset = screen.getByRole('button', { name: 'おきなわけん' })
    expect(inset).toHaveAttribute('aria-disabled', 'true')
    expect(inset).toHaveAttribute('x', '250')
  })

  test('nameToMapプレイ画面の数字ボタン数はその地方の県数と一致する', () => {
    render(<MemoryRouter initialEntries={['/games/prefecture-quiz/name-to-map/play']}><App /></MemoryRouter>)
    const answer = currentAnswerPrefecture()
    const pad = screen.getByRole('group', { name: 'ばんごうで こたえる' })
    expect(within(pad).getAllByRole('button')).toHaveLength(numberedPrefecturesForRegion(answer.region).length)
  })

  test('nameToMapは数字ボタンで正解でき、地図上の該当県pathも正解表示になる', async () => {
    const user = userEvent.setup()
    const { answer, container } = renderNameToMapWithAlternatives()
    const number = prefectureNumberInRegion(answer)
    const pad = screen.getByRole('group', { name: 'ばんごうで こたえる' })
    await user.click(within(pad).getByRole('button', { name: `${number}ばん` }))
    expect(screen.getByRole('status')).toHaveTextContent('🎉 せいかい！')
    // 沖縄は専用insetのrectで表示されるため、path/rectどちらも対象にする
    const answerElement = container.querySelector(`[aria-label="${answer.nameHiragana}"]`)
    expect(answerElement).not.toBeNull()
    expect(answerElement).toHaveClass(mapStyles.correct)
  })

  test('nameToMapは数字ボタンで不正解を選べ、選んだ県pathが誤答表示になる', async () => {
    const user = userEvent.setup()
    const { answer, container } = renderNameToMapWithAlternatives()
    const numbered = numberedPrefecturesForRegion(answer.region)
    const wrong = numbered.find((entry) => entry.prefecture.id !== answer.id)
    if (!wrong) throw new Error('不正解の選択肢がありません')
    const pad = screen.getByRole('group', { name: 'ばんごうで こたえる' })
    await user.click(within(pad).getByRole('button', { name: `${wrong.number}ばん` }))
    expect(screen.getByRole('status')).toHaveTextContent('おしい！')
    expect(screen.getByRole('status')).toHaveTextContent(`こたえ: ${answer.nameHiragana}`)
    const wrongElement = container.querySelector(`[aria-label="${wrong.prefecture.nameHiragana}"]`)
    expect(wrongElement).not.toBeNull()
    expect(wrongElement).toHaveClass(mapStyles.wrong)
  })

  test('nameToMapは地図タップからも回答できる', async () => {
    const user = userEvent.setup()
    renderNameToMapWithAlternatives()
    const map = screen.getByRole('group', { name: '都道府県をえらぶ ちず' })
    const places = within(map).getAllByRole('button')
    await user.click(places[0])
    expect(screen.getByRole('status')).toHaveTextContent(/(🎉 せいかい！|おしい！)/)
  })

  test('nameToMapは地図で正解を選ぶと、対応する数字ボタンも正解状態になる', async () => {
    const user = userEvent.setup()
    const { answer } = renderNameToMapWithAlternatives()
    const number = prefectureNumberInRegion(answer)
    const map = screen.getByRole('group', { name: '都道府県をえらぶ ちず' })
    // 地図上の正解県pathを直接クリックする（地図タップ経路）。
    await user.click(within(map).getByRole('button', { name: `${number}ばんめ の ばしょを えらぶ` }))
    expect(screen.getByRole('status')).toHaveTextContent('🎉 せいかい！')
    // 対応する数字ボタンが正解表示（◯ + correctクラス）になる。
    const pad = screen.getByRole('group', { name: 'ばんごうで こたえる' })
    const padButton = within(pad).getByRole('button', { name: `${number}ばん ${answer.nameHiragana}` })
    expect(padButton).toHaveClass(padStyles.correct)
    expect(padButton).toHaveTextContent('◯')
  })

  test('nameToMapは地図と数字ボタンが同じ回答処理を使い、回答後は両方ロックされる', async () => {
    const user = userEvent.setup()
    const { answer } = renderNameToMapWithAlternatives()
    const number = prefectureNumberInRegion(answer)
    const pad = screen.getByRole('group', { name: 'ばんごうで こたえる' })
    await user.click(within(pad).getByRole('button', { name: `${number}ばん` }))
    // 数字ボタンは全てdisabledになる
    within(pad).getAllByRole('button').forEach((button) => expect(button).toBeDisabled())
    // 地図pathも同じ回答処理でロックされ、キーボード操作できるbuttonロールを失う
    // （沖縄地方のみ、専用insetがaria-disabled付きのbuttonとして残る）
    const map = screen.getByRole('group', { name: `${REGION_LABEL[answer.region]}の ちず` })
    const remaining = within(map).queryAllByRole('button')
    expect(remaining.length).toBeLessThanOrEqual(1)
    remaining.forEach((button) => expect(button).toHaveAttribute('aria-disabled', 'true'))
  })

  test('地図SVGは輪郭だけを低背時に縮めるCSSの対象外として識別される', () => {
    render(<PrefectureMap onSelect={() => undefined} />)
    expect(screen.getByRole('group')).toHaveAttribute('data-prefecture-map', 'true')
  })

  test('10問目の次へで結果画面に遷移する', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/prefecture-quiz/shape-to-name/play']}><App /></MemoryRouter>)
    for (let index = 0; index < 10; index += 1) {
      const choice = screen.getAllByRole('button').find((button) => button.textContent !== 'やめる')
      if (!choice) throw new Error('選択肢がありません')
      await user.click(choice)
      await user.click(screen.getByRole('button', { name: index === 9 ? 'けっかを みる' : 'つぎの もんだい' }))
    }
    expect(screen.getByRole('heading', { name: 'けっか' })).toBeInTheDocument()
  })
})
