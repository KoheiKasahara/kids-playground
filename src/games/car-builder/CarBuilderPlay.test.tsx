import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import CarBuilderPlay from './CarBuilderPlay'
import { CAR_VEHICLES, CAR_VEHICLE_ORDER } from './carVehicles'

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

// 走行シーンも同じ理由で差し替え、「はしる」で渡されたCarConfigだけを記録する。
const driveConfigs = vi.hoisted(() => [] as Record<string, string>[])

vi.mock('./useCarDriveScene', () => ({
  useCarDriveScene: (options: { config: Record<string, string> }) => {
    driveConfigs.push(options.config)
    return { registerContainer: () => {}, boost: () => {}, retry: () => {} }
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

/** 下部エリアに並ぶカテゴリボタン（「◯◯を えらぶ」）だけを数える。 */
function categoryButtons() {
  return within(panel()).getAllByRole('button', { name: /を えらぶ$/ })
}

beforeEach(() => {
  receivedConfigs.length = 0
  driveConfigs.length = 0
})

function latestDriveConfig(): Record<string, string> {
  const config = driveConfigs[driveConfigs.length - 1]
  if (config === undefined) throw new Error('走行シーンへ CarConfig が渡されていません')
  return config
}

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
    expect(categoryButtons()).toHaveLength(8)
    for (const label of ['ボディ', 'タイヤ', 'カラー', 'フロント', 'やね', 'かざり', 'ナンバー', 'たかさ']) {
      expect(within(panel()).getByText(label)).toBeInTheDocument()
    }
  })

  test('初期CarConfigが3Dシーンへ渡される', () => {
    renderPlay()
    expect(latestConfig()).toMatchObject({ body: 'car', wheel: 'small', color: 'red', rideHeight: 'normal' })
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
    expect(screen.getByRole('button', { name: 'きいろ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'みどり' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'オレンジ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ピンク' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'むらさき' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'しろ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'くろ' })).toBeInTheDocument()
    expect(screen.getByRole('application', { name: '3Dの くるま。ゆびで まわせるよ' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'タイヤを えらぶ' })).not.toBeInTheDocument()
  })

  test('分類名のとなりの「もどる」でカテゴリ一覧へ戻れる', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'タイヤを えらぶ' }))
    const back = within(panel()).getByRole('button', { name: 'カテゴリ一覧へ もどる' })
    // 「タイヤ」などの分類名と同じ見出し行にあり、下部エリアの中で完結して戻れる。
    expect(back.parentElement).toBe(screen.getByRole('heading', { name: 'タイヤ' }).parentElement)

    await user.click(back)
    expect(categoryButtons()).toHaveLength(8)
    expect(screen.getByRole('button', { name: 'カラーを えらぶ' })).toBeInTheDocument()
  })

  test('詳細を開いても左上のもどるはホーム（メニュー）行きのまま変わらない', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(screen.getByRole('button', { name: 'ボディを えらぶ' }))

    const home = screen.getByRole('button', { name: 'ホームへ もどる' })
    expect(home).toBeInTheDocument()
    // 左上はヘッダー側だけにあり、下部エリアの「もどる」とは別のボタンとして並ぶ。
    expect(within(panel()).queryByRole('button', { name: 'ホームへ もどる' })).not.toBeInTheDocument()
    expect(within(panel()).getByRole('button', { name: 'カテゴリ一覧へ もどる' })).toBeInTheDocument()
  })

  test('タイトルと重ならないよう、左上のもどるはヘッダーの中に席を持つ', () => {
    renderPlay()
    const heading = screen.getByRole('heading', { name: '3Dクルマづくり' })
    const header = heading.parentElement
    expect(header?.tagName).toBe('HEADER')
    // 固定表示のボタン本体と、通常レイアウト側の席（slot）がどちらもヘッダーの直下にある。
    expect(header?.querySelector('[data-game-back-button]')).not.toBeNull()
    expect(header?.querySelector('[data-game-back-layout-slot]')).not.toBeNull()
  })
})

describe('ボディ9車種の選択', () => {
  test('採用9車種が視覚的なプレビュー付きで並び、選択直後にCarConfigへ反映される', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'ボディを えらぶ' }))

    for (const id of CAR_VEHICLE_ORDER) {
      expect(screen.getByRole('button', { name: CAR_VEHICLES[id].label })).toBeInTheDocument()
    }

    for (const id of CAR_VEHICLE_ORDER) {
      const label = CAR_VEHICLES[id].label
      await user.click(screen.getByRole('button', { name: label }))
      expect(latestConfig().body, label).toBe(id)
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
    await user.click(screen.getByRole('button', { name: 'スクールバス' }))

    expect(latestConfig()).toMatchObject({ body: 'schoolBus', wheel: 'big', color: 'yellow' })
    expect(screen.getByRole('button', { name: 'スクールバス' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('選択の即時反映', () => {
  test('フロント5種類が視覚的なプレビュー付きで並び、選択直後に反映される', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'フロントを えらぶ' }))

    for (const [label, front] of [
      ['丸ライト', 'round'],
      ['四角ライト', 'square'],
      ['細目ライト', 'slim'],
      ['よつめライト', 'twin'],
      ['にこにこ', 'smile'],
    ] as const) {
      const option = screen.getByRole('button', { name: label })
      expect(option.querySelector('[class*="frontPreview"]'), label).not.toBeNull()
      await user.click(option)
      expect(latestConfig().front, label).toBe(front)
      expect(option).toHaveAttribute('aria-pressed', 'true')
    }
    expect(screen.queryByRole('button', { name: /けってい|決定|てきよう/ })).not.toBeInTheDocument()
  })

  test('フロントを選んでからボディを切り替えても選択状態が保たれる', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'フロントを えらぶ' }))
    await user.click(screen.getByRole('button', { name: '細目ライト' }))
    await user.click(screen.getByRole('button', { name: 'カテゴリ一覧へ もどる' }))
    await user.click(screen.getByRole('button', { name: 'ボディを えらぶ' }))
    await user.click(screen.getByRole('button', { name: 'スクールバス' }))

    expect(latestConfig()).toMatchObject({ body: 'schoolBus', front: 'slim' })
    expect(screen.getByRole('button', { name: 'スクールバス' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('12色すべてをタップすると、選んだ色が即時にCarConfigへ反映される', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(screen.getByRole('button', { name: 'カラーを えらぶ' }))

    for (const [label, color] of [
      ['あか', 'red'],
      ['あお', 'blue'],
      ['きいろ', 'yellow'],
      ['みどり', 'green'],
      ['オレンジ', 'orange'],
      ['ピンク', 'pink'],
      ['むらさき', 'purple'],
      ['しろ', 'white'],
      ['くろ', 'black'],
      ['みずいろ', 'sky'],
      ['ミント', 'mint'],
      ['ちゃいろ', 'brown'],
    ] as const) {
      await user.click(screen.getByRole('button', { name: label }))
      expect(latestConfig().color, label).toBe(color)
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true')
    }
  })

  test('タイヤ8種類が視覚的なプレビュー付きで並び、選択直後に反映される', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'タイヤを えらぶ' }))

    for (const [label, wheel] of [
      ['ちいさい', 'small'],
      ['おおきい', 'big'],
      ['オフロード', 'offroad'],
      ['レーシング', 'racing'],
      ['しろリボン', 'whitewall'],
      ['おはな', 'flower'],
      ['ほし', 'star'],
      ['にじいろ', 'rainbow'],
    ] as const) {
      const option = screen.getByRole('button', { name: label })
      expect(option.querySelector('[class*="wheelPreview"]'), label).not.toBeNull()
      await user.click(option)
      expect(latestConfig().wheel, label).toBe(wheel)
      expect(option).toHaveAttribute('aria-pressed', 'true')
    }
    expect(screen.queryByRole('button', { name: /けってい|決定|てきよう/ })).not.toBeInTheDocument()
  })

  test('屋根8種類が視覚的なプレビュー付きで並び、選択直後に反映される', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'やねを えらぶ' }))

    for (const [label, roof] of [
      ['なし', 'none'],
      ['パトランプ', 'policeLight'],
      ['荷物', 'luggage'],
      ['スポイラー', 'spoiler'],
      ['うさぎみみ', 'rabbit'],
      ['サーフボード', 'surfboard'],
      ['おうかん', 'crown'],
      ['ソフトクリーム', 'iceCream'],
    ] as const) {
      const option = screen.getByRole('button', { name: label })
      expect(option.querySelector('[class*="roofPreview"]'), label).not.toBeNull()
      await user.click(option)
      expect(latestConfig().roof, label).toBe(roof)
      expect(option).toHaveAttribute('aria-pressed', 'true')
    }
    expect(screen.queryByRole('button', { name: /けってい|決定|てきよう/ })).not.toBeInTheDocument()
  })

  test('飾り9種類が視覚的なプレビュー付きで並び、選択直後に反映される', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'かざりを えらぶ' }))

    for (const [label, decoration] of [
      ['なし', 'none'],
      ['ほし', 'star'],
      ['ほのお', 'flame'],
      ['しましま', 'stripes'],
      ['みずたま', 'dots'],
      ['ハート', 'hearts'],
      ['チェック', 'checker'],
      ['にじ', 'rainbow'],
      ['にくきゅう', 'paw'],
    ] as const) {
      const option = screen.getByRole('button', { name: label })
      expect(option.querySelector('[class*="decorationPreview"]'), label).not.toBeNull()
      await user.click(option)
      expect(latestConfig().decoration, label).toBe(decoration)
      expect(option).toHaveAttribute('aria-pressed', 'true')
    }
    expect(screen.queryByRole('button', { name: /けってい|決定|てきよう/ })).not.toBeInTheDocument()
  })

  test('ナンバー／マークを視覚的に選べ、選択直後に反映される', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'ナンバーや マークを えらぶ' }))

    for (const [label, mark] of [
      ['なし', 'none'],
      ['1', 'number1'],
      ['2', 'number2'],
      ['3', 'number3'],
      ['4', 'number4'],
      ['5', 'number5'],
      ['6', 'number6'],
      ['7', 'number7'],
      ['8', 'number8'],
      ['9', 'number9'],
      ['ほし', 'star'],
      ['ハート', 'heart'],
      ['いなずま', 'lightning'],
      ['おうかん', 'crown'],
      ['どうぶつ', 'animal'],
      ['おはな', 'flower'],
      ['おつきさま', 'moon'],
      ['ロケット', 'rocket'],
      ['きょうりゅう', 'dinosaur'],
    ] as const) {
      const option = screen.getByRole('button', { name: label })
      expect(option.querySelector('[class*="markPreview"]'), label).not.toBeNull()
      await user.click(option)
      expect(latestConfig().mark, label).toBe(mark)
      expect(option).toHaveAttribute('aria-pressed', 'true')
    }
    expect(screen.queryByRole('button', { name: /けってい|決定|てきよう/ })).not.toBeInTheDocument()
  })

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

  test('車高3種類が高さの分かるサムネイル付きで並び、選択直後に反映される', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'くるまの たかさを えらぶ' }))

    for (const [label, height] of [
      ['ひくい', 'low'],
      ['ふつう', 'normal'],
      ['たかい', 'high'],
    ] as const) {
      const option = screen.getByRole('button', { name: label })
      expect(option.querySelector('[class*="rideHeightPreview"]'), label).not.toBeNull()
      await user.click(option)
      expect(latestConfig().rideHeight, label).toBe(height)
      expect(option).toHaveAttribute('aria-pressed', 'true')
      expect(option.querySelector(`[data-height="${height}"]`), label).not.toBeNull()
    }
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
    await user.click(screen.getByRole('button', { name: '荷物' }))
    await user.click(screen.getByRole('button', { name: 'カテゴリ一覧へ もどる' }))

    expect(screen.getByRole('button', { name: 'やねを えらぶ' }).querySelector('[class*="roofPreview"]')).not.toBeNull()
  })
})

describe('つくった くるまを はしらせる', () => {
  test('カテゴリ一覧に「はしる！」があり、パーツを選んでいる間は出さない', async () => {
    const user = userEvent.setup()
    renderPlay()
    expect(within(panel()).getByRole('button', { name: 'つくった くるまを はしらせる' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'カラーを えらぶ' }))
    expect(screen.queryByRole('button', { name: 'つくった くるまを はしらせる' })).not.toBeInTheDocument()
  })

  test('「はしる！」で走行画面へ切り替わり、つくった車がそのまま走る', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'カラーを えらぶ' }))
    await user.click(screen.getByRole('button', { name: 'みどり' }))
    await user.click(screen.getByRole('button', { name: 'カテゴリ一覧へ もどる' }))
    await user.click(screen.getByRole('button', { name: 'つくった くるまを はしらせる' }))

    expect(screen.getByRole('application', { name: 'つくった くるまが はしる 3Dコース' })).toBeInTheDocument()
    expect(latestDriveConfig()).toMatchObject({ color: 'green' })
    // つくりかえ画面の3Dは外れる（WebGLのシーンが2つ同時に生きない）。
    expect(screen.queryByRole('application', { name: '3Dの くるま。ゆびで まわせるよ' })).not.toBeInTheDocument()
  })

  test('走行画面の「もどる」で、つくったままの車のつくりかえ画面へ帰れる', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'タイヤを えらぶ' }))
    await user.click(screen.getByRole('button', { name: 'レーシング' }))
    await user.click(screen.getByRole('button', { name: 'カテゴリ一覧へ もどる' }))
    await user.click(screen.getByRole('button', { name: 'つくった くるまを はしらせる' }))
    await user.click(screen.getByRole('button', { name: 'クルマづくりへ もどる' }))

    expect(screen.getByRole('application', { name: '3Dの くるま。ゆびで まわせるよ' })).toBeInTheDocument()
    expect(latestConfig()).toMatchObject({ wheel: 'racing' })
    expect(categoryButtons()).toHaveLength(8)
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

  test('タイトルは狭い端末でも字を詰めて収め、固定表示の「もどる」と重ねない', () => {
    expect(ruleOf(CSS_SOURCE, '.title')).toMatch(/font-size:\s*clamp\(/)
  })

  test('下部エリアの高さは一覧・詳細で共通の固定値（詳細へ入ってもレイアウトが跳ねない）', () => {
    expect(ruleOf(CSS_SOURCE, '.page')).toMatch(/--cb-panel-height:/)
    expect(ruleOf(CSS_SOURCE, '.panel')).toMatch(/height:\s*var\(--cb-panel-height\)/)
    expect(ruleOf(CSS_SOURCE, '.optionList')).toMatch(/overflow-y:\s*auto/)
  })

  test('ボディ9選択肢はスマホ幅でも3列で押しやすい幅を保つ', () => {
    expect(CSS_SOURCE).toMatch(/\.optionList\[data-category='body'\]\s*\{[^}]*grid-template-columns:\s*repeat\(3,/)
    expect(ruleOf(CSS_SOURCE, '.optionButton')).toMatch(/min-height:\s*64px/)
    expect(ruleOf(CSS_SOURCE, '.optionLabel')).toMatch(/white-space:\s*normal/)
  })

  test('タイヤ6選択肢はスマホ幅でも3列で見比べられる', () => {
    expect(CSS_SOURCE).toMatch(/\.optionList\[data-category='wheel'\]\s*\{[^}]*grid-template-columns:\s*repeat\(3,/)
    expect(ruleOf(CSS_SOURCE, '.wheelPreview')).toMatch(/border-radius:\s*50%/)
  })

  test('フロント4選択肢はスマホ幅でも1行で見比べられる', () => {
    expect(CSS_SOURCE).toMatch(/\.optionList\[data-category='front'\]\s*\{[^}]*grid-template-columns:\s*repeat\(4,/)
    expect(ruleOf(CSS_SOURCE, '.frontPreview')).toMatch(/width:\s*42px/)
  })

  test('屋根6選択肢はスマホ幅でも3列で見比べられる', () => {
    expect(CSS_SOURCE).toMatch(/\.optionList\[data-category='roof'\]\s*\{[^}]*grid-template-columns:\s*repeat\(3,/)
    expect(ruleOf(CSS_SOURCE, '.roofPreview')).toMatch(/width:\s*44px/)
  })

  test('車高3種類は高さの違いが分かる専用サムネイルを持つ', () => {
    expect(ruleOf(CSS_SOURCE, '.rideHeightPreview')).toMatch(/width:\s*52px/)
    expect(CSS_SOURCE).toMatch(/\.rideHeightPreview-low\s+\.rideHeightPreviewBody/)
    expect(CSS_SOURCE).toMatch(/\.rideHeightPreview-normal\s+\.rideHeightPreviewBody/)
    expect(CSS_SOURCE).toMatch(/\.rideHeightPreview-high\s+\.rideHeightPreviewBody/)
  })

  test('「はしる！」はカテゴリボタンより大きく、下部エリアに収まる', () => {
    const driveButton = ruleOf(CSS_SOURCE, '.driveButton')
    const driveHeight = Number(driveButton.match(/min-height:\s*(\d+)px/)?.[1])
    const categoryHeight = Number(ruleOf(CSS_SOURCE, '.categoryButton').match(/min-height:\s*(\d+)px/)?.[1])
    expect(driveHeight).toBeGreaterThanOrEqual(categoryHeight)
    expect(driveButton).toMatch(/width:\s*100%/)
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
