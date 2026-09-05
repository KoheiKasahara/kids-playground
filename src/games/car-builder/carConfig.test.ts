import { describe, expect, test } from 'vitest'
import {
  CAR_CATEGORIES,
  CAR_CATEGORY_ORDER,
  DEFAULT_CAR_CONFIG,
  carCategoryOrder,
  currentCarOption,
  findCarOption,
  resolveCarColor,
  selectCarOption,
  type CarCategoryId,
} from './carConfig'
import { CAR_VEHICLE_ORDER } from './carVehicles'

describe('カテゴリのカタログ', () => {
  test('Issue #401 の8カテゴリが定義されている', () => {
    expect(CAR_CATEGORY_ORDER).toEqual([
      'body',
      'wheel',
      'color',
      'front',
      'roof',
      'decoration',
      'mark',
      'rideHeight',
    ])
  })

  test('表示順がCAR_CATEGORIESの全キーを重複なく含む（カテゴリを足したら並び順にも入る）', () => {
    const definedIds = Object.keys(CAR_CATEGORIES) as CarCategoryId[]
    expect([...CAR_CATEGORY_ORDER].sort()).toEqual([...definedIds].sort())
    expect(new Set(CAR_CATEGORY_ORDER).size).toBe(CAR_CATEGORY_ORDER.length)
  })

  test('各カテゴリはラベル・アイコン・読み上げ文と1件以上の選択肢を持つ', () => {
    for (const category of carCategoryOrder()) {
      expect(category.label.length, category.id).toBeGreaterThan(0)
      expect(category.emoji.length, category.id).toBeGreaterThan(0)
      expect(category.ariaLabel.length, category.id).toBeGreaterThan(0)
      expect(category.options.length, category.id).toBeGreaterThanOrEqual(1)
    }
  })

  test('ボディはPhase 1で採用した7車種を持ち、文字だけに依存しないプレビューがある', () => {
    expect(CAR_CATEGORIES.body.options.map((option) => option.id)).toEqual([...CAR_VEHICLE_ORDER])
    expect(CAR_CATEGORIES.body.options.map((option) => option.label)).toEqual([
      'ふつうのくるま',
      'スポーツカー',
      'SUV',
      'タクシー',
      'パトカー',
      'きゅうきゅうしゃ',
      'スクールバス',
    ])
    for (const option of CAR_CATEGORIES.body.options) {
      expect(option.preview.kind, option.id).toBe('emoji')
      if (option.preview.kind === 'emoji') expect(option.preview.emoji.length, option.id).toBeGreaterThan(0)
    }
  })

  test('タイヤは4種類を持ち、形状の違いを表すプレビューがある', () => {
    const options = CAR_CATEGORIES.wheel.options
    expect(options.map((option) => option.id)).toEqual(['small', 'big', 'offroad', 'racing'])
    expect(options.map((option) => option.label)).toEqual(['ちいさい', 'おおきい', 'オフロード', 'レーシング'])
    for (const option of options) {
      expect(option.preview).toEqual({ kind: 'wheel', variant: option.id })
    }
  })

  test('フロントは丸・四角・細目の3種類を、形状が分かるプレビュー付きで持つ', () => {
    const options = CAR_CATEGORIES.front.options
    expect(options.map((option) => option.id)).toEqual(['round', 'square', 'slim'])
    expect(options.map((option) => option.label)).toEqual(['丸ライト', '四角ライト', '細目ライト'])
    for (const option of options) {
      expect(option.preview).toEqual({ kind: 'front', variant: option.id })
    }
  })

  test('屋根は4種類を、形状が分かる専用プレビュー付きで持つ', () => {
    const options = CAR_CATEGORIES.roof.options
    expect(options.map((option) => option.id)).toEqual(['none', 'policeLight', 'luggage', 'spoiler'])
    expect(options.map((option) => option.label)).toEqual(['なし', 'パトランプ', '荷物', 'スポイラー'])
    for (const option of options) expect(option.preview).toEqual({ kind: 'roof', variant: option.id })
  })

  test('飾りは「なし」と4種類の模様を、形状が分かる専用プレビュー付きで持つ', () => {
    const options = CAR_CATEGORIES.decoration.options
    expect(options.map((option) => option.id)).toEqual(['none', 'star', 'flame', 'stripes', 'dots'])
    expect(options.map((option) => option.label)).toEqual(['なし', 'ほし', 'ほのお', 'しましま', 'みずたま'])
    for (const option of options) expect(option.preview).toEqual({ kind: 'decoration', variant: option.id })
  })

  test('ナンバー／マークは「なし」と9数字・5アイコンを持つ', () => {
    const options = CAR_CATEGORIES.mark.options
    expect(options.map((option) => option.id)).toEqual([
      'none',
      'number1',
      'number2',
      'number3',
      'number4',
      'number5',
      'number6',
      'number7',
      'number8',
      'number9',
      'star',
      'heart',
      'lightning',
      'crown',
      'animal',
    ])
    for (const option of options) expect(option.preview).toEqual({ kind: 'mark', variant: option.id })
  })

  test('選択肢IDはカテゴリ内で一意で、ラベルも空でない', () => {
    for (const category of carCategoryOrder()) {
      const ids = category.options.map((option) => option.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const option of category.options) {
        expect(option.label.length, category.id + '/' + option.id).toBeGreaterThan(0)
      }
    }
  })

  test('カラーはIssue #404の9色を、色付きプレビュー付きで持つ', () => {
    const colors = CAR_CATEGORIES.color.options
    expect(colors.map((option) => option.id)).toEqual([
      'red',
      'blue',
      'yellow',
      'green',
      'orange',
      'pink',
      'purple',
      'white',
      'black',
    ])
    expect(colors.map((option) => option.label)).toEqual([
      'あか',
      'あお',
      'きいろ',
      'みどり',
      'オレンジ',
      'ピンク',
      'むらさき',
      'しろ',
      'くろ',
    ])
    for (const option of colors) {
      expect(option.preview.kind, option.id).toBe('color')
      if (option.preview.kind === 'color') expect(option.preview.hex).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  test('車高はひくい・ふつう・たかいの3段階を高さが分かるプレビュー付きで持つ', () => {
    const options = CAR_CATEGORIES.rideHeight.options
    expect(options.map((option) => option.id)).toEqual(['low', 'normal', 'high'])
    expect(options.map((option) => option.label)).toEqual(['ひくい', 'ふつう', 'たかい'])
    for (const option of options) {
      expect(option.preview).toEqual({ kind: 'rideHeight', variant: option.id })
    }
  })

  test('リアルタイム反映を確かめられるよう、複数の選択肢を持つカテゴリがある', () => {
    const multi = carCategoryOrder().filter((category) => category.options.length >= 2)
    expect(multi.length).toBeGreaterThanOrEqual(3)
  })

  test('初期CarConfigの各値がカタログに実在する', () => {
    for (const categoryId of CAR_CATEGORY_ORDER) {
      expect(findCarOption(categoryId, DEFAULT_CAR_CONFIG[categoryId]), categoryId).toBeDefined()
    }
  })
})

describe('selectCarOption', () => {
  test('指定したカテゴリだけを更新し、他カテゴリの選択は保たれる', () => {
    const afterBody = selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'schoolBus')
    const afterColor = selectCarOption(afterBody, 'color', 'blue')
    const afterWheel = selectCarOption(afterColor, 'wheel', 'big')

    expect(afterWheel.body).toBe('schoolBus')
    expect(afterWheel.color).toBe('blue')
    expect(afterWheel.wheel).toBe('big')
    expect(afterWheel.rideHeight).toBe(DEFAULT_CAR_CONFIG.rideHeight)
  })

  test('元のCarConfigを書き換えない（新しいオブジェクトを返す）', () => {
    const next = selectCarOption(DEFAULT_CAR_CONFIG, 'color', 'yellow')
    expect(DEFAULT_CAR_CONFIG.color).toBe('red')
    expect(next).not.toBe(DEFAULT_CAR_CONFIG)
  })

  test('同じ値を選び直したときは同じ参照を返す（無駄な再描画・再生成をしない）', () => {
    expect(selectCarOption(DEFAULT_CAR_CONFIG, 'color', 'red')).toBe(DEFAULT_CAR_CONFIG)
  })

  test('カタログに無い選択肢IDは無視して現状を保つ', () => {
    expect(selectCarOption(DEFAULT_CAR_CONFIG, 'color', 'rainbow')).toBe(DEFAULT_CAR_CONFIG)
    expect(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'normal')).toBe(DEFAULT_CAR_CONFIG)
  })

  test('数字やマークを選ぶと、他カテゴリを保ったままmarkだけ更新する', () => {
    const config = selectCarOption(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'schoolBus'), 'color', 'blue')
    const next = selectCarOption(config, 'mark', 'heart')
    expect(next.mark).toBe('heart')
    expect(next.body).toBe('schoolBus')
    expect(next.color).toBe('blue')
  })
})

describe('表示用の値の解決', () => {
  test('currentCarOptionが現在の選択肢定義を返す', () => {
    const config = selectCarOption(DEFAULT_CAR_CONFIG, 'rideHeight', 'high')
    expect(currentCarOption(config, 'rideHeight').label).toBe('たかい')
  })

  test('resolveCarColorが色IDから実際の塗り色(hex)を返す', () => {
    expect(resolveCarColor(DEFAULT_CAR_CONFIG)).toMatch(/^#[0-9a-f]{6}$/i)
    expect(resolveCarColor(selectCarOption(DEFAULT_CAR_CONFIG, 'color', 'blue'))).not.toBe(
      resolveCarColor(DEFAULT_CAR_CONFIG),
    )
  })

  test('9色すべてが異なる3D用の色値へ解決される', () => {
    const colors = CAR_CATEGORIES.color.options.map((option) =>
      resolveCarColor(selectCarOption(DEFAULT_CAR_CONFIG, 'color', option.id)),
    )
    expect(new Set(colors).size).toBe(9)
  })
})
