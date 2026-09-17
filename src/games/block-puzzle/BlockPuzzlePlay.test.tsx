import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import GameIntro from '../../components/GameIntro'
import GameIntroProvider from '../../components/GameIntroProvider'
import surfaceStyles from '../../components/GamePlaySurface.module.css'
import BlockPuzzlePlay from './BlockPuzzlePlay'

function renderGame() {
  return render(
    <MemoryRouter initialEntries={['/games/block-puzzle']}>
      <GameIntroProvider>
        <BlockPuzzlePlay />
        <GameIntro />
      </GameIntroProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  // jsdomのwindow.scrollToは未実装で警告を出すため、呼ばれたことだけを見るモックにする。
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

function modeButton(name: string) {
  return screen.getByRole('button', { name: `${name} を えらぶ` })
}

describe('ブロックパズル: モードえらび', () => {
  test('はじめにモードえらびが出て、2つのあそびかたを えらべる', () => {
    renderGame()
    expect(screen.getByRole('heading', { name: 'ブロックパズル' })).toBeInTheDocument()
    expect(screen.getByText('どっちで あそぶ？')).toBeInTheDocument()
    expect(modeButton('じゆうに ならべる')).toBeInTheDocument()
    expect(modeButton('おちてくる ブロック')).toBeInTheDocument()
  })

  test('じゆうに ならべる をえらぶと、すきな形を置く画面になる', () => {
    renderGame()
    fireEvent.click(modeButton('じゆうに ならべる'))

    expect(screen.getByRole('heading', { name: 'じゆうに ならべる' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'かたちを えらぶ' })).toBeInTheDocument()
  })

  test('おちてくる ブロック をえらぶと、落ちてくる画面になる', () => {
    renderGame()
    fireEvent.click(modeButton('おちてくる ブロック'))

    expect(screen.getByRole('heading', { name: /おちてくる ブロック/ })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'おきたい ばしょを えらぶ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'おとす' })).toBeInTheDocument()
  })

  test('あそんだあと もどる と、モードえらびへ戻ってもう片方をえらべる', () => {
    renderGame()
    fireEvent.click(modeButton('おちてくる ブロック'))
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))

    expect(screen.getByText('どっちで あそぶ？')).toBeInTheDocument()

    fireEvent.click(modeButton('じゆうに ならべる'))
    expect(screen.getByRole('heading', { name: 'じゆうに ならべる' })).toBeInTheDocument()
  })

  test('あそんでいる間は共通の説明を隠し、モードえらびへ戻すとまた読める', () => {
    renderGame()
    expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()

    fireEvent.click(modeButton('おちてくる ブロック'))
    expect(screen.queryByRole('heading', { name: 'このゲームについて' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
  })

  test('モードを切り替えるたびに画面の先頭へ戻す（説明まで読んでから選んでも遊べる）', () => {
    renderGame()
    const scrollTo = vi.mocked(window.scrollTo)
    scrollTo.mockClear()

    fireEvent.click(modeButton('じゆうに ならべる'))
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })

  test('モードえらびへ戻ってから同じモードを選ぶと、盤面は最初の状態に戻っている', () => {
    renderGame()
    fireEvent.click(modeButton('じゆうに ならべる'))
    fireEvent.click(screen.getByRole('button', { name: /^よこ2 たて2 / }))
    expect(screen.getByRole('button', { name: 'よこ2 たて2 1マス' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    fireEvent.click(modeButton('じゆうに ならべる'))

    expect(screen.getByRole('button', { name: 'よこ2 たて2 あき' })).toBeInTheDocument()
  })
})

// 長押しメニュー・文字選択の抑制(Issue #166)は、モードえらびでは不要（むしろ通常のボタン
// タップ操作を阻害しかねない）ため付けず、モードを選んだあとのプレイ画面だけに付ける。
describe('ブロックパズル: GamePlaySurfaceの適用範囲(Issue #166)', () => {
  test('モードえらびにはGamePlaySurfaceのclassが付かない', () => {
    renderGame()
    expect(document.querySelector(`.${surfaceStyles.surface}`)).not.toBeInTheDocument()
  })

  test('どちらのモードのプレイ画面にもGamePlaySurfaceのclassが付く', () => {
    renderGame()
    fireEvent.click(modeButton('じゆうに ならべる'))
    expect(document.querySelector(`.${surfaceStyles.surface}`)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    fireEvent.click(modeButton('おちてくる ブロック'))
    expect(document.querySelector(`.${surfaceStyles.surface}`)).toBeInTheDocument()
  })
})
