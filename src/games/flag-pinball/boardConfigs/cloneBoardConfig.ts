import type { BoardConfig } from './types'

/**
 * BoardConfig の独立したコピーを作る。BoardConfig はプリミティブ値だけを持つ
 * 宣言的データ（関数やDOM参照を含まない）なので structuredClone がそのまま使える。
 *
 * Phase A時点では宇宙・海・おかしの各テーマは通常盤面と同じ配置だが、
 * `export const spaceBoard = normalBoard` のように参照をそのまま使い回すと、
 * 将来 `spaceBoard.toys.push(...)` のような変更が normalBoard 側の配列まで
 * 書き換えてしまう。テーマ間で内部配列を共有しないよう、必ずこの関数を通して独立させる。
 */
export function cloneBoardConfig(config: BoardConfig): BoardConfig {
  return structuredClone(config)
}
