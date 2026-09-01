import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import CarBuilderPlay from './CarBuilderPlay'

// 3D描画(three.js/WebGL)はjsdomでは動かせないため、シーンhookだけを差し替える。
// 代わりにhookへ渡されたCarConfigを記録し、「UI操作 → CarConfig更新 → 3Dへ反映」の
// 経路が実際につながっていることを検証する。
const receivedConfigs = vi.hoisted(() => [] as Record<string, string>[])

vi.mock('./useCarBuilderScene', () => ({
  useCarBuilderScene: (options: { config: Record<string, string> }) => {
    receivedConfigs.push(options.config)
    return { registerContainer: () => {} }
  },
}))

function renderPlay() {
  return render(
    <MemoryRouter initialEntries={['/games/car-builder']}>
      <CarBuilderPlay />
    </MemoryRouter>,
  )
}

function latestConfig(): Record<string, string> {
  const config = receivedConfigs[receivedConfigs.length - 1]
  if (config === undefined) throw new Error('3Dシーンへ CarConfig が渡されていません')
  return config
}

function panel() {
  return screen.getByRole('region', { name: 'くるまの カスタマイズ' })
}

beforeEach(() => {
  receivedConfigs.length = 0
})

describe('初期表示', () => {
  test('タイトルと3D表示エリアが出る', () => {
    renderPlay()
    expect(screen.getByRole('heading', { name: '3Dクルマづくり' })).toBeInTheDocument()
    expect(screen.getByRole('application', { name: '3Dの くるま。ゆびで まわせるよ' })).toBeInTheDocument()
  })

  test('ホームへもどるボタンがある', () => {
    renderPlay()
    expect(screen.getByRole('button', { name: 'ホームへ もどる' })).toBeInTheDocument()
  })

  test('Issue #401 の8カテゴリが下部に並ぶ', () => {
    renderPlay()
    const buttons = within(panel()).getAllByRole('button')
    expect(buttons).toHaveLength(8)
    for (const label of ['ボディ', 'タイヤ', 'カラー', 'フロント', 'やね', 'かざり', 'ナンバー', 'たかさ']) {
      expect(within(panel()).getByText(label)).toBeInTheDocument()
    }
  })

  test('初期CarConfigが3Dシーンへ渡される', () => {
    renderPlay()
    expect(latestConfig()).toMatchObject({ body: 'sports', wheel: 'normal', color: 'red', rideHeight: 'normal' })
  })
})

describe('カテゴリ一覧と詳細選択の切り替え', () => {
  test('カテゴリをタップすると同じ下部エリアが詳細選択へ切り替わる（画面遷移しない）', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'カラーを えらぶ' }))

    expect(screen.getByRole('heading', { name: 'カラー' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'あか' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'あお' })).toBeInTheDocument()
    expect(screen.getByRole('application', { name: '3Dの くるま。ゆびで まわせるよ' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'タイヤを えらぶ' })).not.toBeInTheDocument()
  })

  test('「もどる」でカテゴリ一覧へ戻れる', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'タイヤを えらぶ' }))
    expect(screen.getByRole('button', { name: 'カテゴリ一覧へ もどる' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'カテゴリ一覧へ もどる' }))
    expect(within(panel()).getAllByRole('button')).toHaveLength(8)
    expect(screen.getByRole('button', { name: 'カラーを えらぶ' })).toBeInTheDocument()
  })

  test('詳細のもどるとホームへもどるは別々のボタン', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(screen.getByRole('button', { name: 'ボディを えらぶ' }))
    expect(screen.getByRole('button', { name: 'ホームへ もどる' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'カテゴリ一覧へ もどる' })).toBeInTheDocument()
  })
})

describe('ボディ5種類の選択', () => {
  test('5種類が視覚的なプレビュー付きで並び、選択直後にCarConfigへ反映される', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'ボディを えらぶ' }))

    for (const label of ['スポーツカー', 'SUV', 'バス', 'トラック', 'パトカー風']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }

    for (const [label, body] of [
      ['スポーツカー', 'sports'],
      ['SUV', 'suv'],
      ['バス', 'bus'],
      ['トラック', 'truck'],
      ['パトカー風', 'police'],
    ] as const) {
      await user.click(screen.getByRole('button', { name: label }))
      expect(latestConfig().body, label).toBe(body)
    }
  })

  test('ボディを切り替えても他カテゴリの選択状態は維持される', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'カラーを えらぶ' }))
    await user.click(screen.getByRole('button', { name: 'きいろ' }))
    await user.click(screen.getByRole('button', { name: 'カテゴリ一覧へ もどる' }))
    await user.click(screen.getByRole('button', { name: 'タイヤを えらぶ' }))
    await user.click(screen.getByRole('button', { name: 'おおきい' }))
    await user.click(screen.getByRole('button', { name: 'カテゴリ一覧へ もどる' }))
    await user.click(screen.getByRole('button', { name: 'ボディを えらぶ' }))
    await user.click(screen.getByRole('button', { name: 'バス' }))

    expect(latestConfig()).toMatchObject({ body: 'bus', wheel: 'big', color: 'yellow' })
    expect(screen.getByRole('button', { name: 'バス' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('選択の即時反映', () => {
  test('選んだ瞬間にCarConfigが更新され3Dシーンへ渡る（決定ボタンは無い）', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'カラーを えらぶ' }))
    await user.click(screen.getByRole('button', { name: 'あお' }))

    expect(latestConfig().color).toBe('blue')
    expect(screen.getByRole('button', { name: 'あお' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'あか' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: /けってい|決定|てきよう/ })).not.toBeInTheDocument()
  })

  test('車高やタイヤの変更もそのまま3Dシーンへ渡る', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'くるまの たかさを えらぶ' }))
    await user.click(screen.getByRole('button', { name: 'たかい' }))
    expect(latestConfig().rideHeight).toBe('high')

    await user.click(screen.getByRole('button', { name: 'カテゴリ一覧へ もどる' }))
    await user.click(screen.getByRole('button', { name: 'タイヤを えらぶ' }))
    await user.click(screen.getByRole('button', { name: 'おおきい' }))
    expect(latestConfig().wheel).toBe('big')
  })
})

describe('カテゴリを移動しても選択状態が残る', () => {
  test('カラー→タイヤ→カラーと移動しても、カラーの選択が保たれる', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'カラーを えらぶ' }))
    await user.click(screen.getByRole('button', { name: 'きいろ' }))
    await user.click(screen.getByRole('button', { name: 'カテゴリ一覧へ もどる' }))

    await user.click(screen.getByRole('button', { name: 'タイヤを えらぶ' }))
    await user.click(screen.getByRole('button', { name: 'おおきい' }))
    await user.click(screen.getByRole('button', { name: 'カテゴリ一覧へ もどる' }))

    await user.click(screen.getByRole('button', { name: 'カラーを えらぶ' }))
    expect(screen.getByRole('button', { name: 'きいろ' })).toHaveAttribute('aria-pressed', 'true')
    expect(latestConfig()).toMatchObject({ color: 'yellow', wheel: 'big' })
  })

  test('カテゴリ一覧のボタンに、いま選ばれている中身が表示される', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'やねを えらぶ' }))
    await user.click(screen.getByRole('button', { name: 'キャリア' }))
    await user.click(screen.getByRole('button', { name: 'カテゴリ一覧へ もどる' }))

    expect(within(screen.getByRole('button', { name: 'やねを えらぶ' })).getByText('🧳')).toBeInTheDocument()
  })
})

// jsdomはCSS Modulesの適用もメディアクエリも評価しないため、スマホ縦画面のレイアウト条件は
// CSSソースを直接読んで検証する（rail-builderのテストと同じ手法）。
const CSS_SOURCE = readFileSync(path.join(__dirname, 'CarBuilderPlay.module.css'), 'utf-8')

function ruleOf(source: string, selector: string): string {
  const escapedSelector = selector.replace('.', '\\.')
  const pattern = new RegExp(escapedSelector + '\\s*\\{[^}]*\\}')
  const match = source.match(pattern)
  if (match === null) throw new Error('ルールが見つかりません: ' + selector)
  return match[0]
}

describe('スマホ縦画面のレイアウト（CSS）', () => {
  test('ページは100dvhに収め、横スクロールを出さない', () => {
    const page = ruleOf(CSS_SOURCE, '.page')
    expect(page).toMatch(/height:\s*100dvh/)
    expect(page).toMatch(/overflow:\s*hidden/)
  })

  test('8カテゴリは4列グリッドで、1列に押し込んで横スクロールさせない', () => {
    expect(ruleOf(CSS_SOURCE, '.categoryGrid')).toMatch(/grid-template-columns:\s*repeat\(4,/)
    expect(CSS_SOURCE).not.toMatch(/\.categoryGrid\s*\{[^}]*overflow-x:\s*auto/)
  })

  test('3D表示エリアが残り高さをすべて使い、ドラッグ操作がページスクロールと競合しない', () => {
    const scene = ruleOf(CSS_SOURCE, '.scene')
    expect(scene).toMatch(/flex:\s*1 1 auto/)
    expect(scene).toMatch(/touch-action:\s*none/)
  })

  test('下部エリアの高さは一覧・詳細で共通の固定値（詳細へ入ってもレイアウトが跳ねない）', () => {
    expect(ruleOf(CSS_SOURCE, '.page')).toMatch(/--cb-panel-height:/)
    expect(ruleOf(CSS_SOURCE, '.panel')).toMatch(/height:\s*var\(--cb-panel-height\)/)
    expect(ruleOf(CSS_SOURCE, '.optionList')).toMatch(/overflow-y:\s*auto/)
  })

  test('ボディ5選択肢はスマホ幅でも横スクロールせず1行で比較できる', () => {
    expect(CSS_SOURCE).toMatch(/\.optionList\[data-category='body'\]\s*\{[^}]*grid-template-columns:\s*repeat\(5,/)
    expect(ruleOf(CSS_SOURCE, '.optionButton')).toMatch(/min-height:\s*64px/)
    expect(ruleOf(CSS_SOURCE, '.optionLabel')).toMatch(/white-space:\s*normal/)
  })

  test('主要なタップ領域が小さすぎない（幼児向けに44px以上・カテゴリと選択肢は64px以上）', () => {
    for (const selector of ['.categoryButton', '.optionButton', '.backButton']) {
      const rule = ruleOf(CSS_SOURCE, selector)
      const match = rule.match(/min-height:\s*(\d+)px/)
      expect(match, selector).not.toBeNull()
      expect(Number(match?.[1]), selector).toBeGreaterThanOrEqual(64)
    }
  })

  test('低い横画面でもタップ領域を44px以上に保つ', () => {
    const marker = '@media (orientation: landscape) and (max-height: 560px)'
    const start = CSS_SOURCE.indexOf(marker)
    expect(start).toBeGreaterThan(-1)
    expect(start).toBeGreaterThan(CSS_SOURCE.indexOf('@media (min-width: 760px)'))
    const block = CSS_SOURCE.slice(start)
    for (const height of block.matchAll(/min-height:\s*(\d+)px/g)) {
      expect(Number(height[1])).toBeGreaterThanOrEqual(44)
    }
  })
})
