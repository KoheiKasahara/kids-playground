import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import CarDrivePlay from './CarDrivePlay'
import { DEFAULT_CAR_CONFIG, selectCarOption } from './carConfig'
import { DRIVE_COURSE } from './driveCourse'
import type { CarDriveSceneOptions } from './useCarDriveScene'

// 3D描画(three.js/WebGL)はjsdomでは動かせないため、走行シーンのhookだけを差し替える。
// hookへ渡された走行状態を記録し、「UI操作 → 走行シーンへの指示」がつながっていることを検証する。
const scene = vi.hoisted(() => ({
  options: undefined as CarDriveSceneOptions | undefined,
  boost: vi.fn(),
  retry: vi.fn(),
}))

vi.mock('./useCarDriveScene', () => ({
  useCarDriveScene: (options: CarDriveSceneOptions) => {
    scene.options = options
    return { registerContainer: () => {}, boost: scene.boost, retry: scene.retry }
  },
}))

function renderDrive(config = DEFAULT_CAR_CONFIG, onBack = vi.fn()) {
  const result = render(
    <MemoryRouter initialEntries={['/games/car-builder']}>
      <CarDrivePlay config={config} onBack={onBack} />
    </MemoryRouter>,
  )
  return { ...result, onBack }
}

function makeReady() {
  act(() => scene.options?.onStatusChange?.('ready'))
}

beforeEach(() => {
  scene.options = undefined
  scene.boost.mockClear()
  scene.retry.mockClear()
})

describe('はしる画面の 表示', () => {
  test('3Dコースとコース名が出て、つくった車がそのまま渡される', () => {
    const config = selectCarOption(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'schoolBus'), 'color', 'mint')
    renderDrive(config)

    expect(screen.getByRole('heading', { name: /はしってるよ/ })).toBeInTheDocument()
    expect(screen.getByRole('application', { name: 'つくった くるまが はしる 3Dコース' })).toBeInTheDocument()
    expect(screen.getByText(DRIVE_COURSE.name, { exact: false })).toBeInTheDocument()
    expect(scene.options?.config).toBe(config)
  })

  test('よみこみ中は案内を出し、じゅんびできたら消えて はしりだす', () => {
    renderDrive()
    expect(screen.getByRole('status')).toHaveTextContent('コースを よういしているよ')
    expect(scene.options?.running).toBe(false)

    makeReady()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(scene.options?.running).toBe(true)
  })

  test('3Dを出せないときは やりなおせる', async () => {
    const user = userEvent.setup()
    renderDrive()
    act(() => scene.options?.onStatusChange?.('error'))

    expect(screen.getByRole('alert')).toHaveTextContent('3Dを ひょうじできないよ')
    expect(scene.options?.running).toBe(false)

    await user.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(scene.retry).toHaveBeenCalled()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  test('1周するたびに 周回数が増える', () => {
    renderDrive()
    makeReady()
    expect(screen.getByLabelText('0しゅう はしったよ')).toBeInTheDocument()

    act(() => scene.options?.onLapChange?.(3))
    expect(screen.getByLabelText('3しゅう はしったよ')).toBeInTheDocument()
  })
})

describe('はしる画面の そうさ', () => {
  test('カメラを えらぶと 走行シーンへ伝わる', async () => {
    const user = userEvent.setup()
    renderDrive()
    makeReady()
    expect(scene.options?.cameraMode).toBe('chase')

    await user.click(screen.getByRole('button', { name: /みちばた/ }))
    expect(scene.options?.cameraMode).toBe('trackside')

    await user.click(screen.getByRole('button', { name: /ぜんたい/ }))
    expect(scene.options?.cameraMode).toBe('overview')
  })

  test('動きを減らす設定では みちばた から始める', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    try {
      renderDrive()
      expect(scene.options?.cameraMode).toBe('trackside')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  test('「かそく！」で 走行シーンを加速させる', async () => {
    const user = userEvent.setup()
    renderDrive()
    makeReady()

    await user.click(screen.getByRole('button', { name: /かそく/ }))
    expect(scene.boost).toHaveBeenCalledTimes(1)
  })

  test('「とまる」で止まり、もう一度押すと また はしりだす', async () => {
    const user = userEvent.setup()
    renderDrive()
    makeReady()

    await user.click(screen.getByRole('button', { name: /とまる/ }))
    expect(scene.options?.running).toBe(false)
    // 止まっている間は かそく を押せない（押しても何も起きない状態を見せない）。
    expect(screen.getByRole('button', { name: /かそく/ })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /はしる/ }))
    expect(scene.options?.running).toBe(true)
  })

  test('「もどる」で つくりかえ画面へ戻す', async () => {
    const user = userEvent.setup()
    const { onBack } = renderDrive()

    await user.click(screen.getByRole('button', { name: 'クルマづくりへ もどる' }))
    expect(onBack).toHaveBeenCalled()
  })
})

// jsdomはCSS Modulesの適用もメディアクエリも評価しないため、画面の収まりはCSSソースを
// 直接読んで検証する（CarBuilderPlay.test.tsx と同じ手法）。
const CSS_SOURCE = readFileSync(path.join(__dirname, 'CarDrivePlay.module.css'), 'utf-8')

function ruleOf(source: string, selector: string): string {
  const match = source.match(new RegExp(selector.replace('.', '\\.') + '\\s*\\{[^}]*\\}'))
  if (match === null) throw new Error('ルールが見つかりません: ' + selector)
  return match[0]
}

/** その要素に指定された min-height のうち、いちばん大きい値（複数のルールに分かれていてもよい）。 */
function minHeightOf(source: string, selector: string): number {
  const rules = [...source.matchAll(new RegExp(selector.replace('.', '\\.') + '\\s*\\{[^}]*\\}', 'g'))]
  const heights = rules.flatMap((rule) =>
    [...rule[0].matchAll(/min-height:\s*(\d+)px/g)].map((height) => Number(height[1])),
  )
  if (heights.length === 0) throw new Error('min-heightがありません: ' + selector)
  return Math.max(...heights)
}

describe('はしる画面のレイアウト（CSS）', () => {
  test('1画面に収め、走行中にページがスクロールしない', () => {
    const page = ruleOf(CSS_SOURCE, '.page')
    expect(page).toMatch(/height:\s*100dvh/)
    expect(page).toMatch(/overflow:\s*hidden/)
    expect(ruleOf(CSS_SOURCE, '.scene')).toMatch(/touch-action:\s*none/)
  })

  test('主要なタップ領域が幼児向けに十分大きい', () => {
    // 低い横画面だけ小さくする指定があるので、縦画面ぶん（メディアクエリの手前）で見る。
    const portraitCss = CSS_SOURCE.slice(0, CSS_SOURCE.indexOf('@media'))
    for (const [selector, minimum] of [['.cameraButton', 48], ['.pauseButton', 56], ['.boostButton', 56]] as const) {
      expect(minHeightOf(portraitCss, selector), selector).toBeGreaterThanOrEqual(minimum)
    }
  })

  test('低い横画面では操作を1段にして景色の高さを残し、44px以上を保つ', () => {
    const marker = '@media (orientation: landscape) and (max-height: 560px)'
    const start = CSS_SOURCE.indexOf(marker)
    expect(start).toBeGreaterThan(-1)
    const block = CSS_SOURCE.slice(start)
    expect(block).toMatch(/flex-direction:\s*row/)
    for (const height of block.matchAll(/min-height:\s*(\d+)px/g)) {
      expect(Number(height[1])).toBeGreaterThanOrEqual(44)
    }
  })
})
