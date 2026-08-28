import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import RailBuilderPlay from './RailBuilderPlay'
import type { RailBuilderEngineHandle } from './useRailBuilderEngine'

// 3D描画(three.js/WebGL)はjsdomでは動かせないため useRailBuilderEngine だけを差し替え、
// 縦画面UIの整理（家ボタン削除・「ぜんぶうごかす」のコンパクト化）を検証する。
// MIN_ZOOM/MAX_ZOOM/ZOOM_STEPもRailBuilderPlay.tsxが同じモジュールからimportしているため、
// 値が二重管理にならないよう実モジュールのものをそのまま再export する。
const startTrainMock = vi.fn()
const pauseTrainMock = vi.fn()

vi.mock('./useRailBuilderEngine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useRailBuilderEngine')>()),
  useRailBuilderEngine: (): RailBuilderEngineHandle => ({
    registerContainer: () => {},
    getCameraTarget: () => ({ x: 0, y: 0, z: 0 }),
    startTrain: startTrainMock,
    pauseTrain: pauseTrainMock,
    addTrain: () => {},
    removeTrain: () => {},
    focusTrain: () => {},
    focusDepot: () => {},
    setTrainType: () => {},
  }),
}))

function renderPlay() {
  return render(
    <MemoryRouter initialEntries={['/games/rail-builder']}>
      <RailBuilderPlay />
    </MemoryRouter>,
  )
}

afterEach(() => {
  startTrainMock.mockClear()
  pauseTrainMock.mockClear()
})

describe('RailBuilderPlay 縦画面の操作UI', () => {
  test('「もどる」ボタンが残っている（家ボタンを消してもナビゲーションは失われない）', () => {
    renderPlay()
    expect(screen.getByRole('button', { name: 'ホームへ もどる' })).toBeInTheDocument()
  })

  test('「しゃこを みる」ボタン（家ボタン）は削除されている', () => {
    renderPlay()
    expect(screen.queryByRole('button', { name: 'しゃこを みる' })).not.toBeInTheDocument()
  })

  test('「ぜんぶうごかす」はテキストを表示せず、aria-labelで意味を保ったアイコンボタンになっている', () => {
    renderPlay()
    // 画面上に文言としての「ぜんぶうごかす」は出ていない(アイコンのみのコンパクトボタン化)
    expect(screen.queryByText('ぜんぶうごかす')).not.toBeInTheDocument()
    // それでもボタンはaria-labelで存在し、意味(全部の電車を動かす)は保たれている
    expect(screen.getByRole('button', { name: 'ぜんぶの でんしゃを うごかす' })).toBeInTheDocument()
  })

  test('「ぜんぶの でんしゃを うごかす」ボタンを押すと startTrain が呼ばれる（走行開始の仕様は維持）', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(screen.getByRole('button', { name: 'ぜんぶの でんしゃを うごかす' }))
    expect(startTrainMock).toHaveBeenCalledWith('train-1')
  })

  test('でんしゃ台数操作(−/🚃1/＋)とぜんぶうごかす(▶)の4操作がそろっている', () => {
    renderPlay()
    expect(screen.getByRole('button', { name: 'でんしゃを へらす' })).toBeInTheDocument()
    expect(screen.getByText('🚃')).toBeInTheDocument()
    expect(screen.getByLabelText('でんしゃ 1りょうへんせい')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'でんしゃを ふやす' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ぜんぶの でんしゃを うごかす' })).toBeInTheDocument()
  })

  test('音ボタンを押すと aria-pressed が切り替わる', async () => {
    const user = userEvent.setup()
    renderPlay()
    const soundButton = screen.getByRole('button', { name: 'おとを けす' })
    expect(soundButton).toHaveAttribute('aria-pressed', 'true')

    await user.click(soundButton)
    expect(screen.getByRole('button', { name: 'おとを つける' })).toHaveAttribute('aria-pressed', 'false')
  })
})
