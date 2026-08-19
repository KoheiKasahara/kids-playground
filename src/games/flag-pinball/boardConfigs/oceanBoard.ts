import { cloneBoardConfig } from './cloneBoardConfig'
import { normalBoard } from './normalBoard'
import type { BoardConfig } from './types'

/**
 * 海テーマの盤面配置。Phase A時点では専用レイアウトを持たず、通常盤面と同じ配置で始める
 * （見た目だけがテーマで変わる）。Phase Cで海専用の配置・おもちゃ（シーソー等）を作るときは、
 * このファイルの中身を通常盤面から切り離して直接書き換えればよく、他テーマには影響しない。
 */
export const oceanBoard: BoardConfig = cloneBoardConfig(normalBoard)
