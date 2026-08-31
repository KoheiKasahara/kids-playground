// GamePlaySurface(Issue #166)が実際のDOM描画でも狙った範囲だけに現れることを、
// routing.test.tsxと同じ「MemoryRouter + App」のレンダリング流儀で検証する。
// 全ルートの網羅は routes.gamePlaySurface.test.tsx（route構造の機械チェック）に任せ、
// ここでは代表的なURLについてだけ実DOMで確認する。
import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'
import surfaceStyles from '../components/GamePlaySurface.module.css'

function hasGamePlaySurface(container: HTMLElement): boolean {
  return container.querySelector(`.${surfaceStyles.surface}`) !== null
}

describe('実プレイURLでのGamePlaySurface適用(Issue #166、DOM検証)', () => {
  test('/games/flag-quiz/flag-to-name/hard/play (静的import) にはclassが付く', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/games/flag-quiz/flag-to-name/hard/play']}>
        <App />
      </MemoryRouter>,
    )
    expect(hasGamePlaySurface(container)).toBe(true)
  })

  test('/games/color-mix-quiz/play (静的import) にはclassが付く', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/games/color-mix-quiz/play']}>
        <App />
      </MemoryRouter>,
    )
    expect(hasGamePlaySurface(container)).toBe(true)
  })

  test('/games/piano-play (lazyルート、単一routeでプレイまで完結) にはclassが付く', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/games/piano-play']}>
        <App />
      </MemoryRouter>,
    )
    expect(await screen.findByRole('heading', { name: 'ピアノであそぼう' })).toBeInTheDocument()
    expect(hasGamePlaySurface(container)).toBe(true)
  })
})

describe('プレイ以外の画面にはGamePlaySurfaceが付かない(Issue #166、DOM検証)', () => {
  test('ホーム(/) には付かない', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    expect(hasGamePlaySurface(container)).toBe(false)
  })

  test('ゲーム開始画面(/games/flag-quiz) には付かない', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/games/flag-quiz']}>
        <App />
      </MemoryRouter>,
    )
    expect(hasGamePlaySurface(container)).toBe(false)
  })

  test('むずかしさ選択画面(/games/flag-quiz/flag-to-name) には付かない', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/games/flag-quiz/flag-to-name']}>
        <App />
      </MemoryRouter>,
    )
    expect(hasGamePlaySurface(container)).toBe(false)
  })

  test('結果画面(/games/flag-quiz/flag-to-name/hard/result) には付かない', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/games/flag-quiz/flag-to-name/hard/result']}>
        <App />
      </MemoryRouter>,
    )
    expect(hasGamePlaySurface(container)).toBe(false)
  })

  test('旧URLからのリダイレクト(/games/flag-quiz/play) には付かない(遷移先のむずかしいプレイには付くべきだが、Navigate自体はGamePlaySurfaceを持たない)', () => {
    // 旧URLはNavigateでプレイ画面へリダイレクトされる。最終的に着地する先は実プレイ画面なので
    // GamePlaySurfaceは付いた状態になる（付かないことを検証したいのではなく、
    // リダイレクトを挟んでも最終的な実プレイ画面には正しく適用され続けることを確認する）。
    const { container } = render(
      <MemoryRouter initialEntries={['/games/flag-quiz/play']}>
        <App />
      </MemoryRouter>,
    )
    expect(hasGamePlaySurface(container)).toBe(true)
  })
})
