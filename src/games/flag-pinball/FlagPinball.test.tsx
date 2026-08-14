import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { SCORE_ZONES, type ScoreZone } from './boardLayout'
import type { PinballEngineOptions } from './usePinballEngine'

// 物理エンジン(matter-js)はjsdomでは動かさず、ゲーム進行のロジック（選択→プレイ→結果）だけを
// 検証する。usePinballEngine を差し替え、テストからは engineMock.options 経由で
// onBallScored / onFinished を直接発火させる。
const engineMock = vi.hoisted(() => ({ options: undefined as PinballEngineOptions | undefined }))
vi.mock('./usePinballEngine', () => ({
  usePinballEngine: (options: PinballEngineOptions) => {
    engineMock.options = options
    return { registerBall: () => () => {} }
  },
}))

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

/**
 * こっきピンボールの各画面は matter-js を含むため lazy(import()) で読み込む（src/app/routes.tsx）。
 * ルート遷移直後はまだチャンクの読込中で何も描画されていないことがあるため、
 * 最初の要素取得には getByRole ではなく findByRole（内部でリトライ待機する）を使う。
 */
async function clickButton(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name }))
}

/**
 * 選択画面で「にほん・かんこく・ちゅうごく」の3球を選び、「あそぶ！」を押す。
 * プレイ画面（これも lazy）が実際にマウントされ、engineMock.options に
 * usePinballEngine の呼び出しオプションが入るまで待ってから返す。
 */
async function selectDefaultThreeAndPlay(user: ReturnType<typeof userEvent.setup>) {
  await clickButton(user, 'にほん')
  await clickButton(user, 'かんこく')
  await clickButton(user, 'ちゅうごく')
  await clickButton(user, 'あそぶ！')
  await screen.findByRole('button', { name: 'やめる' })
}

/**
 * 3球ぶんの得点を発火し、onFinished 後の700ms遷移をfake timersで進めて結果画面へ進む。
 * userEvent（@testing-library/user-event）はfake timers有効中の click 待機と相性が悪く
 * ハングするため、fake timersは「この関数の中だけ」有効にし、抜けるときは必ず real timers へ戻す
 * （呼び出し側は前後で普段どおり userEvent.click を使ってよい）。
 */
async function finishWithScores(zones: readonly [ScoreZone, ScoreZone, ScoreZone]) {
  vi.useFakeTimers()
  act(() => {
    zones.forEach((zone, ballIndex) => engineMock.options!.onBallScored(ballIndex, zone))
    engineMock.options!.onFinished()
  })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(700)
  })
  vi.useRealTimers()
  await screen.findByRole('heading', { name: 'けっか' })
}

/** 画面上の全 img の src から、最後の flags/*.svg のファイル名部分だけを重複なく集める */
function flagImageFilenames(): string[] {
  const srcs = Array.from(document.querySelectorAll('img')).map((img) => img.getAttribute('src') ?? '')
  const filenames = srcs.map((src) => src.split('/').pop() ?? '')
  return Array.from(new Set(filenames)).sort()
}

afterEach(() => {
  engineMock.options = undefined
  vi.useRealTimers()
})

describe('FlagPinball 選択画面', () => {
  test('ホームの「こっきピンボール」から選択画面へ行ける', async () => {
    const user = userEvent.setup()
    renderApp('/')
    await user.click(screen.getByRole('button', { name: 'こっきピンボール' }))
    expect(await screen.findByRole('heading', { name: 'こっきピンボール' })).toBeInTheDocument()
    expect(screen.getByText('ボールを 3こ えらんでね！')).toBeInTheDocument()
  })

  test('40個の国旗ボールのボタンが並ぶ', async () => {
    renderApp('/games/flag-pinball')
    await screen.findByRole('heading', { name: 'こっきピンボール' })
    const flagButtons = screen.getAllByRole('button').filter((btn) => btn.hasAttribute('aria-pressed'))
    expect(flagButtons).toHaveLength(40)
  })

  test('国旗を最大3個まで選択できる（4個目を押しても3個のまま）', async () => {
    const user = userEvent.setup()
    renderApp('/games/flag-pinball')
    await clickButton(user, 'にほん')
    await clickButton(user, 'かんこく')
    await clickButton(user, 'ちゅうごく')
    await clickButton(user, 'バングラデシュ')

    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'バングラデシュ' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('3個選ばないと「あそぶ！」が押せない', async () => {
    const user = userEvent.setup()
    renderApp('/games/flag-pinball')
    const playButton = await screen.findByRole('button', { name: 'あそぶ！' })
    expect(playButton).toBeDisabled()

    await clickButton(user, 'にほん')
    await clickButton(user, 'かんこく')
    expect(playButton).toBeDisabled()

    await clickButton(user, 'ちゅうごく')
    expect(playButton).toBeEnabled()
  })

  test('選択を解除できる（選択済みをもう一度押すと外れ、aria-pressedが戻る）', async () => {
    const user = userEvent.setup()
    renderApp('/games/flag-pinball')
    const jp = await screen.findByRole('button', { name: 'にほん' })
    await user.click(jp)
    expect(jp).toHaveAttribute('aria-pressed', 'true')

    await user.click(jp)
    expect(jp).toHaveAttribute('aria-pressed', 'false')
    // queryAllByRole を使う: getAllByRole は0件のとき例外を投げるため
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
  })

  test('state無しで /play や /result を直接開くと選択画面へ戻る', async () => {
    const playResult = renderApp('/games/flag-pinball/play')
    expect(await playResult.findByRole('heading', { name: 'こっきピンボール' })).toBeInTheDocument()

    const resultResult = renderApp('/games/flag-pinball/result')
    expect(await resultResult.findByRole('heading', { name: 'こっきピンボール' })).toBeInTheDocument()
  })
})

describe('FlagPinball プレイ画面', () => {
  test('3個選んで「あそぶ！」→ プレイ画面へ進み、選んだ3球ぶんのボールが表示される', async () => {
    const user = userEvent.setup()
    renderApp('/games/flag-pinball')
    await selectDefaultThreeAndPlay(user)

    expect(screen.getByRole('button', { name: 'やめる' })).toBeInTheDocument()
    expect(screen.getAllByText('・・・')).toHaveLength(3)
    expect(flagImageFilenames()).toEqual(expect.arrayContaining(['cn.svg', 'jp.svg', 'kr.svg']))
    expect(engineMock.options).toBeDefined()
  })

  test('各球の得点は一度だけ加算される（同じballIndexへの2回目の発火は無視される）', async () => {
    const user = userEvent.setup()
    renderApp('/games/flag-pinball')
    await selectDefaultThreeAndPlay(user)

    vi.useFakeTimers()
    act(() => {
      engineMock.options!.onBallScored(0, SCORE_ZONES[2]) // 1000点
      engineMock.options!.onBallScored(0, SCORE_ZONES[0]) // 同じballIndexへの2回目。無視される想定
      engineMock.options!.onBallScored(1, SCORE_ZONES[0]) // 100点
      engineMock.options!.onBallScored(2, SCORE_ZONES[1]) // 300点
      engineMock.options!.onFinished()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700)
    })
    vi.useRealTimers()

    // 二重加算されていれば 1000+100+100+300 = 1500 になってしまうところ、
    // 一度だけの加算なら 1000+100+300 = 1400 になる。
    // 合計は「ごうけい」と点数を別の要素に分けて表示している（狭い画面で読みにくい
    // 折り返しが起きないようにするため）ので、点数側の要素で確認する。
    expect(await screen.findByText('1400てん！')).toBeInTheDocument()
  })

  test('3球ぶん発火＋onFinishedの後、結果画面に各球の得点と正しい合計が表示される', async () => {
    const user = userEvent.setup()
    renderApp('/games/flag-pinball')
    await selectDefaultThreeAndPlay(user)

    vi.useFakeTimers()
    act(() => {
      engineMock.options!.onBallScored(0, SCORE_ZONES[0]) // 100
      engineMock.options!.onBallScored(1, SCORE_ZONES[2]) // 1000
      engineMock.options!.onBallScored(2, SCORE_ZONES[4]) // 100
      engineMock.options!.onFinished()
    })

    // 700ms 経過するまではまだ結果画面へ遷移しない（最後の得点ポップを見せる猶予）
    await act(async () => {
      await vi.advanceTimersByTimeAsync(650)
    })
    expect(screen.queryByRole('heading', { name: 'けっか' })).not.toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
    vi.useRealTimers()

    expect(await screen.findByRole('heading', { name: 'けっか' })).toBeInTheDocument()
    expect(screen.getAllByText('100てん')).toHaveLength(2)
    expect(screen.getByText('1000てん')).toBeInTheDocument()
    expect(screen.getByText('ごうけい')).toBeInTheDocument()
    expect(screen.getByText('1200てん！')).toBeInTheDocument()
  })
})

describe('FlagPinball 結果画面', () => {
  async function playToResult(user: ReturnType<typeof userEvent.setup>) {
    renderApp('/games/flag-pinball')
    await selectDefaultThreeAndPlay(user)
    await finishWithScores([SCORE_ZONES[0], SCORE_ZONES[1], SCORE_ZONES[2]])
  }

  test('「もういちど」で同じ3球のままプレイ画面へ戻り、前回の得点は残らない', async () => {
    const user = userEvent.setup()
    await playToResult(user)

    await clickButton(user, 'もういちど')
    await screen.findByRole('button', { name: 'やめる' })

    // 再プレイ時に前回の得点が残らない（ヘッダは3球とも未確定「・・・」に戻る）
    expect(screen.getAllByText('・・・')).toHaveLength(3)
    // 同じ3球のまま（にほん・かんこく・ちゅうごくの国旗のみが表示される）
    const filenames = flagImageFilenames()
    expect(filenames).toEqual(expect.arrayContaining(['cn.svg', 'jp.svg', 'kr.svg']))
    const otherFlags = filenames.filter((name) => !['cn.svg', 'jp.svg', 'kr.svg'].includes(name))
    expect(otherFlags).toHaveLength(0)
  })

  test('「ボールをかえる」で選択画面へ戻る（選択がリセットされている）', async () => {
    const user = userEvent.setup()
    await playToResult(user)

    await clickButton(user, 'ボールをかえる')

    expect(await screen.findByRole('heading', { name: 'こっきピンボール' })).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'あそぶ！' })).toBeDisabled()
  })

  test('得点にかかわらずポジティブなメッセージだけを表示する', async () => {
    const user = userEvent.setup()
    renderApp('/games/flag-pinball')
    await selectDefaultThreeAndPlay(user)
    await finishWithScores([SCORE_ZONES[0], SCORE_ZONES[0], SCORE_ZONES[0]])

    const body = document.body.textContent ?? ''
    expect(body).not.toMatch(/ざんねん|しっぱい|まけ/)
  })

  test('ホームへ、で戻れる', async () => {
    const user = userEvent.setup()
    await playToResult(user)

    await clickButton(user, 'ホームへ')
    expect(await screen.findByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
  })
})
