import { readFileSync } from 'node:fs'
import path from 'node:path'
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

// jsdomはCSS Modulesの内容もメディアクエリの適用も評価しないため、レンダリング結果からは
// 横画面レイアウトが効いているかを検証できない。そのためCSSモジュールのソースを直接読み込み、
// 横画面用メディアクエリの中身をテキストとして確認する(seo配下のindex.html検証と同じ手法)。
const CSS_PATH = path.join(__dirname, 'RailBuilderPlay.module.css')
const CSS_SOURCE = readFileSync(CSS_PATH, 'utf-8')

function extractLandscapeBlock(source: string): string {
  const marker = '@media (orientation: landscape) and (max-height: 560px)'
  const start = source.indexOf(marker)
  if (start === -1) throw new Error('横画面メディアクエリが見つかりません')
  // マーカー直後の最初の { から対応する } までを、ネストなしの単純なブレース対応で取り出す。
  const braceStart = source.indexOf('{', start)
  let depth = 0
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(braceStart + 1, i)
    }
  }
  throw new Error('横画面メディアクエリの閉じ括弧が見つかりません')
}

describe('RailBuilderPlay 横画面レイアウト', () => {
  const landscapeBlock = extractLandscapeBlock(CSS_SOURCE)

  test('横画面メディアクエリが存在し、.headerをflex-direction: rowにして1段化している', () => {
    expect(CSS_SOURCE).toContain('@media (orientation: landscape) and (max-height: 560px)')
    expect(landscapeBlock).toMatch(/\.header\s*\{[^}]*flex-direction:\s*row/)
  })

  test('.headerRowがdisplay: contentsになっている(1段化の要。子をheaderの直接のflex itemにする)', () => {
    expect(landscapeBlock).toMatch(/\.headerRow\s*\{[^}]*display:\s*contents/)
  })

  test('--rb-cellが44px以上に保たれている(幼児向けタップ領域を潰さないガード)', () => {
    const match = landscapeBlock.match(/--rb-cell:\s*(\d+)px/)
    expect(match).not.toBeNull()
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(44)
  })

  test('.toolButtonのmin-heightが44px以上に保たれている', () => {
    const toolButtonRule = landscapeBlock.match(/\.toolButton\s*\{[^}]*\}/)
    expect(toolButtonRule).not.toBeNull()
    const heightMatch = toolButtonRule?.[0].match(/min-height:\s*(\d+)px/)
    expect(heightMatch).not.toBeNull()
    expect(Number(heightMatch?.[1])).toBeGreaterThanOrEqual(44)
  })

  test('横画面ブロック内で.trayToolsのoverflow/touch-action(横スクロール)を打ち消していない', () => {
    const trayToolsRule = landscapeBlock.match(/\.trayTools\s*\{[^}]*\}/)
    expect(trayToolsRule).not.toBeNull()
    expect(trayToolsRule?.[0]).not.toMatch(/overflow(-x)?:\s*(hidden|visible)/)
    expect(trayToolsRule?.[0]).not.toMatch(/touch-action:\s*(auto|none)/)
    // 横スクロールの実体(overflow-x: auto / touch-action: pan-x)は
    // ブロック外側の共通ルールに残っているはずで、縦横どちらでも維持される。
    expect(CSS_SOURCE).toMatch(/\.trayTools\s*\{[^}]*overflow-x:\s*auto/)
    expect(CSS_SOURCE).toMatch(/touch-action:\s*pan-x/)
  })

  test('横画面メディアクエリは @media (min-width: 760px) より後ろに現れる(844x390などの幅広スマホ横画面は両方にマッチし、同一詳細度では後勝ちになるため)', () => {
    const minWidthIndex = CSS_SOURCE.indexOf('@media (min-width: 760px)')
    const landscapeIndex = CSS_SOURCE.indexOf('@media (orientation: landscape) and (max-height: 560px)')
    expect(minWidthIndex).toBeGreaterThan(-1)
    expect(landscapeIndex).toBeGreaterThan(-1)
    expect(landscapeIndex).toBeGreaterThan(minWidthIndex)
  })
})
