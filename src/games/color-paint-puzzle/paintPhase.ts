// うごくぬりえの画面フェーズ（ぬる／完成演出）を扱う純ロジック。DOM APIに触れない。
//
// フェーズを列挙型＋純粋な遷移関数に閉じ込めることで、「できた！」の連打や
// 「もういちどぬる」との往復で状態が壊れないことを、画面を描かずに検証できるようにする。

export type PaintPhase =
  /** いつも通り色を選んで塗れる状態。 */
  | 'coloring'
  /** 「できた！」を押したあとの完成演出中。塗り操作は受け付けない。 */
  | 'celebrating'

export type PaintPhaseAction =
  /** 「できた！」を押した。 */
  | 'finish'
  /** 「もういちどぬる」を押した。 */
  | 'backToColoring'

export const INITIAL_PAINT_PHASE: PaintPhase = 'coloring'

/**
 * フェーズ遷移。変化しない場合は引数と同じ値をそのまま返す
 * （Reactのstate更新が同じ値なら再レンダリングされないため、連打しても演出が
 * 途中から作り直されない＝多重起動しない）。
 */
export function reducePaintPhase(phase: PaintPhase, action: PaintPhaseAction): PaintPhase {
  if (action === 'finish') {
    // 演出中の「できた！」は無視する。ボタン自体も演出中は表示しないが、
    // 連打の2回目以降がボタン消滅前に届くケースをここでも確実に弾く。
    return phase === 'coloring' ? 'celebrating' : phase
  }
  return 'coloring'
}

/** そのフェーズで塗り操作（エリアのタップ）を受け付けるか。 */
export function canPaint(phase: PaintPhase): boolean {
  return phase === 'coloring'
}
