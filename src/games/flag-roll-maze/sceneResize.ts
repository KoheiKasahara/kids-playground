/**
 * 画面の向きが変わった直後は、まだ回転前のサイズを返すブラウザ（特にiOS Safari）がある。
 * その1回きりの測定を信じるとcanvasが古い大きさのまま残るので、
 * すぐ1回測ったあと、少し間を置いて測り直す。
 */
export const ORIENTATION_RESIZE_DELAYS_MS = [0, 120, 320]

export type ResizeScheduler = {
  /** その場で1回、さらに遅延ぶんだけ測り直しを予約する。 */
  schedule: () => void
  /** 予約済みの測り直しをすべて取り消す。 */
  cancel: () => void
}

export function createResizeScheduler(
  run: () => void,
  delays: readonly number[] = ORIENTATION_RESIZE_DELAYS_MS,
): ResizeScheduler {
  const timerIds = new Set<ReturnType<typeof setTimeout>>()

  const cancel = () => {
    for (const id of timerIds) clearTimeout(id)
    timerIds.clear()
  }

  const schedule = () => {
    run()
    for (const delay of delays) {
      const id = setTimeout(() => {
        timerIds.delete(id)
        run()
      }, delay)
      timerIds.add(id)
    }
  }

  return { schedule, cancel }
}
