import type { PinballThemeId } from '../themes/types'
import { candyBoard } from './candyBoard'
import { normalBoard } from './normalBoard'
import { oceanBoard } from './oceanBoard'
import { spaceBoard } from './spaceBoard'
import type { BoardConfig } from './types'

export type { BoardConfig, LaunchConfig } from './types'
export { normalBoard } from './normalBoard'
export { spaceBoard } from './spaceBoard'
export { oceanBoard } from './oceanBoard'
export { candyBoard } from './candyBoard'

function assertUniqueIds(items: readonly { readonly id: string }[], label: string): void {
  const ids = items.map((item) => item.id)
  if (new Set(ids).size !== ids.length) {
    throw new Error(`flag-pinball: ${label}のidが重複しています`)
  }
}

/** テーマ追加・編集時の事故（id重複など）を、モジュール読込時に早期発見するための検査。 */
function validateBoardConfig(themeId: PinballThemeId, config: BoardConfig): void {
  assertUniqueIds(config.obstacles, `${themeId}盤面のobstacles`)
  assertUniqueIds(config.walls, `${themeId}盤面のwalls`)
  assertUniqueIds(config.toys, `${themeId}盤面のtoys`)
}

/**
 * テーマIDから対応する盤面設定を取得できるようにする対応表。
 * 4テーマそれぞれの盤面配置を個別に管理し、あるテーマの配置を変更しても
 * 他テーマの配置（このオブジェクトの他のエントリ）には影響しない
 * （各 xxxBoard.ts が独立したオブジェクトを持つため）。
 */
export const BOARD_CONFIGS: Readonly<Record<PinballThemeId, BoardConfig>> = {
  normal: normalBoard,
  space: spaceBoard,
  ocean: oceanBoard,
  candy: candyBoard,
}

for (const [themeId, config] of Object.entries(BOARD_CONFIGS) as [PinballThemeId, BoardConfig][]) {
  validateBoardConfig(themeId, config)
}

/**
 * 現在選択されているテーマから盤面設定を取得する。
 * 未知のテーマIDを渡された場合は既定盤面へ握りつぶさず、呼び出し側の不具合として
 * 早期に気付けるようthrowする（テーマIDの解決自体は themes/index.ts の
 * resolvePinballTheme が担うため、ここに渡る時点でthemeIdは正当な値である前提）。
 */
export function getBoardConfig(themeId: PinballThemeId): BoardConfig {
  const config = BOARD_CONFIGS[themeId]
  if (!config) {
    throw new Error(`flag-pinball: 未対応のテーマの盤面設定です: ${themeId}`)
  }
  return config
}
