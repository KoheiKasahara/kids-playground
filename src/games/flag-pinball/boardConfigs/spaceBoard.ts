import { cloneBoardConfig } from './cloneBoardConfig'
import { normalBoard } from './normalBoard'
import type { BoardConfig } from './types'

/**
 * 宇宙テーマの盤面配置。Phase A時点では専用レイアウトを持たず、通常盤面と同じ配置で始める
 * （見た目だけがテーマで変わる）。Phase Bで宇宙専用の配置・おもちゃを作るときは、
 * このファイルの中身を通常盤面から切り離して直接書き換えればよく、他テーマには影響しない。
 */
export const spaceBoard: BoardConfig = cloneBoardConfig(normalBoard)
