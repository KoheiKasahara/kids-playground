import { useState } from 'react'
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
