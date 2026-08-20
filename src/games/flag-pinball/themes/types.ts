import type { ReactNode } from 'react'
import type { ToyKind } from '../toyLayout'

export type PinballThemeId = 'normal' | 'space' | 'ocean' | 'candy' | 'sky' | 'car'

export type PinballThemeDefinition = {
  readonly id: PinballThemeId
  /** 選択UIに出す短い名前。4〜5歳が読めるひらがな */
  readonly labelJa: string
  /** 選択UIのアイコン絵文字 */
  readonly emoji: string
  /** 盤面(.logical)へ付けるクラス名。CSS変数を上書きして配色を変える */
  readonly boardClassName: string
  /** おもちゃの見た目要素へ付けるクラス名 */
  readonly toyClassName: string
  /** 盤面の軽い背景装飾（星・泡など）。装飾がないテーマは undefined */
  readonly renderBackdrop?: () => ReactNode
  /** おもちゃの中身の絵。物理は共通なので、ここは見た目だけを返す */
  readonly renderToy: (kind: ToyKind) => ReactNode
}
