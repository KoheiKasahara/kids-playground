import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { CELL_SIZE, GRID_TOP } from './boardLayout'
import type { PuzzleEngineOptions } from './usePuzzleEngine'

// 物理エンジン(matter-js)はjsdomでは動かさず、配置とゲーム進行の操作だけを検証する。
// usePuzzleEngine を差し替え、ゴール到達は engineMock.options.onGoal() で直接起こす。
const engineMock = vi.hoisted(() => ({ options: undefined as PuzzleEngineOptions | undefined }))
vi.mock('./usePuzzleEngine', () => ({
  usePuzzleEngine: (options: PuzzleEngineOptions) => {
    engineMock.options = options
    return { registerBall: () => {} }
  },
}))

/**
 * こっきコロコロパズルの画面は matter-js を含むため lazy(import()) で読み込む
 * （src/app/routes.tsx）。最初の要素取得は findBy* で読込完了を待つ。
 */
async function renderGame() {
  render(
    <MemoryRouter initialEntries={['/games/flag-roll-puzzle']}>
      <App />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'こっきコロコロパズル' })
}

/**
 * jsdom はレイアウトを持たず getBoundingClientRect が 0 を返すため、盤面の倍率は1、
 * 盤面の左上は画面の (0, 0) になる。つまり clientX/clientY がそのまま論理座標にあたる。
 */
function cellPoint(col: number, row: number) {
  return {
    clientX: col * CELL_SIZE + CELL_SIZE / 2,
    clientY: GRID_TOP + row * CELL_SIZE + CELL_SIZE / 2,
  }
}

const trayPart = (name: string) => screen.getByRole('button', { name })
const placedParts = () => screen.queryAllByTestId('puzzle-part')

describe('こっきコロコロパズル', () => {
  test('パーツ置き場に Phase 1の3種類が並び、「ボールをおとす」が押せる', async () => {
    await renderGame()
    expect(trayPart('よこいた')).toBeEnabled()
    expect(trayPart('ひだりへ')).toBeEnabled()
    expect(trayPart('みぎへ')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'ボールを おとす！' })).toBeEnabled()
  })

  test('パーツを選んで盤面をタップすると、そのマスへ置ける', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    expect(trayPart('よこいた')).toHaveAttribute('aria-pressed', 'true')

    fireEvent.pointerDown(screen.getByTestId('puzzle-board'), cellPoint(2, 3))
    expect(placedParts()).toHaveLength(1)
    expect(placedParts()[0]).toHaveAttribute('data-part-type', 'plank')
  })

  test('パーツ置き場からドラッグして盤面へ落とすと置ける', async () => {
    await renderGame()
    const part = trayPart('ひだりへ')
    fireEvent.pointerDown(part, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(part, { pointerId: 1, ...cellPoint(1, 2) })
    // ドラッグ中は、置ける場所に下書きが出る
    expect(screen.getByTestId('puzzle-ghost')).toBeInTheDocument()
    fireEvent.pointerUp(part, { pointerId: 1, ...cellPoint(1, 2) })

    expect(screen.queryByTestId('puzzle-ghost')).not.toBeInTheDocument()
    expect(placedParts()).toHaveLength(1)
    expect(placedParts()[0]).toHaveAttribute('data-part-type', 'slopeLeft')
  })

  test('同じマスへ重ねて置こうとしても増えず、置けないことを伝える', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    fireEvent.pointerDown(screen.getByTestId('puzzle-board'), cellPoint(2, 3))
    expect(placedParts()).toHaveLength(1)

    await user.click(trayPart('みぎへ'))
    fireEvent.pointerDown(screen.getByTestId('puzzle-board'), cellPoint(2, 3))
    expect(placedParts()).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('ここには おけないよ')
  })

  test('ボードの外（スタート帯・ゴール帯）へは置けない', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    // グリッドより上（スタート帯）
    fireEvent.pointerDown(screen.getByTestId('puzzle-board'), { clientX: 180, clientY: GRID_TOP - 10 })
    expect(placedParts()).toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent('ここには おけないよ')
  })

  test('「ボールをおとす」で実行に入り、実行中はパーツを触れない', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))

    expect(engineMock.options?.running).toBe(true)
    expect(engineMock.options?.runId).toBe(1)
    expect(trayPart('よこいた')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'ボールを もどす' })).toBeEnabled()
  })

  test('ゴールに入るとお祝いを出し、「ボールをもどす」で置いたパーツを残したまま編集へ戻る', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    fireEvent.pointerDown(screen.getByTestId('puzzle-board'), cellPoint(2, 3))
    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))

    act(() => engineMock.options?.onGoal())
    expect(screen.getByRole('status')).toHaveTextContent('ゴール！ すごい！')

    await user.click(screen.getByRole('button', { name: 'ボールを もどす' }))
    expect(engineMock.options?.running).toBe(false)
    expect(placedParts()).toHaveLength(1)
    expect(trayPart('よこいた')).toBeEnabled()
  })

  test('「ぜんぶ けす」でパーツを外して最初からやり直せる', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    fireEvent.pointerDown(screen.getByTestId('puzzle-board'), cellPoint(2, 3))
    fireEvent.pointerDown(screen.getByTestId('puzzle-board'), cellPoint(4, 5))
    expect(placedParts()).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'ぜんぶ けす' }))
    expect(placedParts()).toHaveLength(0)
  })

  test('「やめる」でホームへ戻る', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(screen.getByRole('button', { name: 'やめる' }))
    expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
  })
})
