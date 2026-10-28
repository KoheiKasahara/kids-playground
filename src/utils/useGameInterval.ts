import { useEffect, useLayoutEffect, useRef } from 'react'
import { observeGameActivity } from './gameActivity'

/** 非表示中の時間を加算しないゲーム用タイマー。nullで停止する。 */
export function useGameInterval(tick: () => void, intervalMs: number | null): void {
  const callback = useRef(tick)
  useLayoutEffect(() => { callback.current = tick })
  useEffect(() => {
    if (intervalMs === null) return
    let timer: ReturnType<typeof setInterval> | undefined
    const stop = () => { clearInterval(timer); timer = undefined }
    const unsubscribe = observeGameActivity((active) => {
      stop()
      if (active) timer = setInterval(() => callback.current(), intervalMs)
    })
    return () => { unsubscribe(); stop() }
  }, [intervalMs])
}
