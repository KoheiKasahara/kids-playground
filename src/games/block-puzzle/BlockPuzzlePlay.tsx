import { useLayoutEffect, useState } from 'react'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import BlockPuzzleModeSelect from './BlockPuzzleModeSelect'
import FallingBlockPuzzle from './FallingBlockPuzzle'
import FreeBlockPuzzle from './FreeBlockPuzzle'
import type { BlockPuzzleMode } from './blockPuzzleModes'

/**
 * ブロックパズルの入口。モードえらびと、選んだモードの画面を切り替えるだけの薄い親（#711）。
 *
 * URLは /games/block-puzzle のまま1つに保ち、モードは画面内の状態で切り替える。
 * モードを離れるとその画面はアンマウントされるので、盤面・落下タイマーなどの状態は
 * 持ち越されず、同じモードを選び直せば必ず最初から始まる。
 */
export default function BlockPuzzlePlay() {
  const [mode, setMode] = useState<BlockPuzzleMode | null>(null)
  // 遊んでいる間は共通の説明を隠し、モードえらびへ戻ると元に戻す。
  useGameIntroPlaying(mode !== null)

  // モードの切り替えはURL遷移ではないので、ScrollManagerの「遷移したら先頭へ」が効かない。
  // 説明文まで読んでから選んだ場合にスクロール位置が残らないよう、切り替えのたびに先頭へ戻す。
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo(0, 0)
  }, [mode])

  // 長押しメニュー・文字選択の抑制（Issue #166）は、ふつうのボタン操作を邪魔しかねないので
  // モードえらびには付けず、実際に盤面をさわるプレイ画面だけに付ける。
  if (mode === null) return <BlockPuzzleModeSelect onSelect={setMode} />
  return (
    <GamePlaySurface>
      {mode === 'falling' ? (
        <FallingBlockPuzzle onBack={() => setMode(null)} />
      ) : (
        <FreeBlockPuzzle onBack={() => setMode(null)} />
      )}
    </GamePlaySurface>
  )
}
