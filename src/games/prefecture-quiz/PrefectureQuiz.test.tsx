import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import App from '../../app/App'
import { prefecturesForRegion } from './data/regions'
import PrefectureMap from './map/PrefectureMap'

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

  test('名前→地図は地方だけを表示し、Enterで選び、回答後に全国locatorを出す', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/games/prefecture-quiz/name-to-map/play']}><App /></MemoryRouter>)
    const places = screen.getAllByRole('button').filter((button) => button.textContent !== 'やめる')
    // 地方のpathに加えて、狭い県の補助タップ枠と沖縄専用insetが存在しうる。
    expect(places.length).toBeGreaterThanOrEqual(1)
    expect(places[0]).toHaveAccessibleName('1ばんめ の ばしょを えらぶ')
    places[0].focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('status')).toHaveTextContent('にほんでは このへん！')
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

  test('関東の狭い県には境界と重ならない補助タップ枠がある', () => {
    render(<PrefectureMap items={prefecturesForRegion('kanto')} onSelect={() => undefined} />)
    const targets = screen.getAllByRole('button', { name: /小さい県の/ })
    expect(targets).toHaveLength(3)
    const ranges = targets.map((target) => ({ x: Number(target.getAttribute('x')), width: Number(target.getAttribute('width')) }))
    expect(ranges[0].x + ranges[0].width).toBeLessThanOrEqual(ranges[1].x)
    expect(ranges[1].x + ranges[1].width).toBeLessThanOrEqual(ranges[2].x)
  })

  test('回答後も補助タップ枠と沖縄insetを同位置に残し、県名を読めるようにする', () => {
    const kanto = prefecturesForRegion('kanto')
    const saitama = kanto.find((prefecture) => prefecture.id === '11')
    const kyushu = prefecturesForRegion('kyushuOkinawa')
    const okinawa = kyushu.find((prefecture) => prefecture.id === '47')
    if (!saitama || !okinawa) throw new Error('テスト用の都道府県がありません')
    const { rerender } = render(<PrefectureMap items={kanto} answer={saitama} selectedId="11" onSelect={() => undefined} disabled revealed />)
    const helper = screen.getByRole('button', { name: 'さいたまけん' })
    expect(helper).toHaveAttribute('aria-disabled', 'true')
    expect(helper).toHaveAttribute('x', '8')
    rerender(<PrefectureMap items={kyushu} answer={okinawa} selectedId="47" onSelect={() => undefined} disabled revealed />)
    const inset = screen.getByRole('button', { name: 'おきなわけん' })
    expect(inset).toHaveAttribute('aria-disabled', 'true')
    expect(inset).toHaveAttribute('x', '250')
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
