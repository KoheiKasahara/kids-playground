import type { StageDefinition } from './types'

// ステージ座標。スマホ縦画面に合わせて 100 x 150（2:3）の縦長にする。
export const STAGE_WIDTH = 100
export const STAGE_HEIGHT = 150

/**
 * Phase 1の唯一のステージ「はじめの おふろ」。
 *
 * 遊びの流れ（幼児が見ただけで因果が分かることを最優先にした構成）:
 *   1. じゃぐちを おす → 水が出て水面が上がる → アヒルが浮いて上がる（#515）
 *   2. 水面が しきりのかべ より高くなる → アヒルが ゆっくり右へ流れて壁を越える
 *   3. みずをへらす → 水面が下がる → アヒルが ゴールの台（浮き輪）へ降りてクリア
 *
 * 「じゃぐち」だけでも「へらす」だけでもクリアできず、両方の因果を1回ずつ体験できる。
 * ゴール領域は台の上に十分な高さを取ってあり、降ろす途中で必ず通過するため
 * 水位をぴったり合わせる精度は要求しない。
 */
export const PUKUPUKA_STAGE: StageDefinition = {
  id: 'ofuro',
  name: 'はじめの おふろ',
  width: STAGE_WIDTH,
  height: STAGE_HEIGHT,
  solids: [
    { id: 'floor', kind: 'floor', x: 6, y: 126, width: 88, height: 14 },
    { id: 'wall-left', kind: 'wall', x: 6, y: 22, width: 8, height: 104 },
    { id: 'wall-right', kind: 'wall', x: 86, y: 22, width: 8, height: 104 },
    // 中央のしきり。水面がこの上端(y=66)を越えるとアヒルが右へ渡れる。
    { id: 'divider', kind: 'divider', x: 46, y: 66, width: 8, height: 60 },
    // ゴールの台。水を減らすとアヒルがこの上に降りる。
    { id: 'goal-platform', kind: 'platform', x: 54, y: 96, width: 32, height: 30 },
  ],
  waterBodies: [
    {
      id: 'main',
      label: 'おふろ',
      left: 14,
      right: 86,
      floorY: 126,
      ceilingY: 30,
      initialLevel: 14,
    },
  ],
  floaters: [{ id: 'duck', kind: 'duck', radius: 8, startX: 27, startY: 118 }],
  goal: {
    // 台の上（y=96）へ降りたアヒルの中心は y=88。浮いたまま近づいた場合も含めて拾えるよう、
    // 台のすぐ上を少し高めに取ってある。水を減らし切れば必ずこの範囲に入るので、
    // 水位をぴったり合わせる操作は要らない。
    area: { x: 56, y: 86, width: 28, height: 10 },
    floaterId: 'duck',
  },
  // アヒルの近く・雲と重ならない位置に取り付ける（#515）。押している間だけ main へ注水する。
  faucet: { id: 'main-faucet', targetBodyId: 'main', x: 38, y: 10 },
  hint: 'じゃぐちを おして アヒルを ゴールへ はこぼう',
}

export const PUKUPUKA_STAGES: readonly StageDefinition[] = [PUKUPUKA_STAGE]

export function findPukupukaStage(stageId: string): StageDefinition | undefined {
  return PUKUPUKA_STAGES.find((stage) => stage.id === stageId)
}
