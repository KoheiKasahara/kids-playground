/**
 * ブロックパズルの遊びかた（#711）。
 * 'free' はすきな形をすきな場所に置くモード、'falling' は上から来るブロックを積むモード。
 * どちらもURLは /games/block-puzzle のままで、画面内の切り替えだけで行き来する。
 */
export type BlockPuzzleMode = 'free' | 'falling'
