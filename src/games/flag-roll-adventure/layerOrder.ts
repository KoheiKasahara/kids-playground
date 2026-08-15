/**
 * ワールド内の重なり順はここで一元管理する。
 * 背景3層 → コース → ボール → 前景の順にすることで、前景だけがボールより上に描かれる。
 */
export const ADVENTURE_LAYER_Z_INDEX = {
  backgroundBase: 0,
  backgroundFar: 1,
  backgroundDecor: 2,
  course: 10,
  ball: 20,
  foreground: 30,
} as const
