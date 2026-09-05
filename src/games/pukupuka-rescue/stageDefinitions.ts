import type { StageDefinition } from './types'

// ステージ座標。スマホ縦画面に合わせて 100 x 150（2:3）の縦長にする。
export const STAGE_WIDTH = 100
export const STAGE_HEIGHT = 150

/**
 * Phase 1の唯一のステージ「はじめの おふろ」。
 *
 * 遊びの流れ（幼児が見ただけで因果が分かることを最優先にした構成）:
 *   1. じゃぐちを おす → 水が出て水面が上がる → アヒルが浮いて上がる（#515）
 *   2. ゲートを あける → まんなかの しきりが 開いて アヒルが右へ流れて渡れる（#517）
 *   3. せんを あける → 水面が下がる → アヒルが ゴールの台（浮き輪）へ降りてクリア（#516）
 *
 * ゲートは閉じている間、水位に関わらず（天井近くまで）通路をふさぐ完全な壁として働く。
 * 「じゃぐち」「ゲート」「せん」のどれか1つでも欠けるとクリアできず、3つの因果を
 * それぞれ1回ずつ体験できる。ゴール領域は台の上に十分な高さを取ってあり、降ろす途中で
 * 必ず通過するため水位をぴったり合わせる精度は要求しない。
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
  // 水そうの底、ゲートより手前（左側）に置く（#516）。タップで開閉し、開いている間 main から水を抜く。
  // 底(floorY=126)ちょうどに置くことで「ここから水が抜ける」と見ただけで分かるようにする。
  drain: { id: 'main-drain', sourceBodyId: 'main', x: 36, y: 126 },
  // 中央のゲート（#517）。左右の壁と同じ高さ(y:22〜126)にしてあり、閉じている間は
  // 水位をどれだけ上げても越えられない完全な壁として働く。開くと当たり判定ごと消え、
  // アヒルが右側へ渡れるようになる。
  gate: { id: 'main-gate', x: 46, y: 22, width: 8, height: 104 },
  hint: 'じゃぐち・ゲート・せんを つかって アヒルを ゴールへ はこぼう',
}

export const PUKUPUKA_STAGES: readonly StageDefinition[] = [PUKUPUKA_STAGE]

export function findPukupukaStage(stageId: string): StageDefinition | undefined {
  return PUKUPUKA_STAGES.find((stage) => stage.id === stageId)
}
