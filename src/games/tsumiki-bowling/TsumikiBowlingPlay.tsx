import { useLayoutEffect, useState } from 'react'
import TsumikiBowlingGame from './TsumikiBowlingGame'
import TsumikiBowlingStageSelect from './TsumikiBowlingStageSelect'

/**
 * ステージ選択とプレイ画面を切り替えるだけの、薄い親コンポーネント。
 *
 * ステージ選択へ戻ると TsumikiBowlingGame がアンマウントされ、
 * useTsumikiBowlingEngine の release() が走ってThree.jsの資源とRapierのworldが
 * 解放される。同じステージを選び直しても新しくマウントされるので、
 * 二重生成は構造的に起きない。key={stageId}により別ステージ選択でも
 * 確実に作り直される（stageIdをそのままkeyにできるので、別途カウンタは不要）。
 */
export default function TsumikiBowlingPlay() {
  const [stageId, setStageId] = useState<string | null>(null)

  // ステージ選択とプレイの切り替えはURL遷移ではないので、ScrollManager（app/ScrollManager.tsx）の
  // 「遷移したら先頭へ」が効かない。ステージ一覧を下までスクロールして選ぶと、
  // プレイ画面に切り替わってもスクロール位置が残り、画面の高さが低い端末では
  // ゲームではなくページ下部の説明文が表示されてしまう（320x568の実画面で確認）。
  // 切り替えのたびに先頭へ戻し、常にゲーム全体が見える状態から始める。
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo(0, 0)
  }, [stageId])

  if (stageId === null) {
    return <TsumikiBowlingStageSelect onSelect={setStageId} />
  }

  return (
    <TsumikiBowlingGame
      key={stageId}
      stageId={stageId}
      onBackToStages={() => setStageId(null)}
    />
  )
}
