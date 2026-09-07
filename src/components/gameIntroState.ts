import { createContext, useContext, useLayoutEffect } from 'react'

export const GameIntroState = createContext({ playing: false, setPlaying: (_playing: boolean) => { void _playing } })

/** 単一路線ゲームはプレイ状態を明示する。説明は選択画面で読み、退出時に復元する。 */
export function useGameIntroPlaying(playing: boolean) {
  const { setPlaying } = useContext(GameIntroState)
  useLayoutEffect(() => {
    setPlaying(playing)
    return () => setPlaying(false)
  }, [playing, setPlaying])
}
