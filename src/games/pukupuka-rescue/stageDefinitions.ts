import type { StageDefinition } from './types'

// ステージ座標。スマホ縦画面に合わせて 100 x 150（2:3）の縦長にする。
export const STAGE_WIDTH = 100
export const STAGE_HEIGHT = 150

/**
 * Phase 1の唯一のステージ「はじめの おふろ」。
 *
 * 遊びの流れ（幼児が見ただけで因果が分かることを最優先にした構成）:
 *   1. じゃぐちを おす → 水が出て水面が上がる → みんなが浮いて上がる（#515）
 *   2. ゲートを あける → まんなかの しきりが 開いて みんなが右へ流れて渡れる（#517）
 *   3. せんを あける → 水面が下がる → みんなが ゴールの台（浮き輪）へ降りてクリア（#516）
 *
 * ゲートは閉じている間、水位に関わらず（天井近くまで）通路をふさぐ完全な壁として働く。
 * 「じゃぐち」「ゲート」「せん」のどれか1つでも欠けるとクリアできず、3つの因果を
 * それぞれ1回ずつ体験できる。ゴール領域は台の上に十分な高さを取ってあり、降ろす途中で
 * 必ず通過するため水位をぴったり合わせる精度は要求しない。
 *
 * アヒルに加え、ボート・浮き輪に乗ったくまも同じ水域に浮かべ、同じゴールへ運ぶ（#518）。
 * 浮遊物ごとの水位判定・壁との衝突・ゴール判定はすべて共通処理（floatModel.ts /
 * pukupukaGame.ts）をそのまま使い、違いは半径（サイズ）だけにしてある。半径が大きいほど
 * 水面の変化に対してゆっくり動く（ボートは少し どっしり、浮き輪は少し 身軽に見える）。
 * ゲートを あけたまま じゃぐちで しばらく 満たしてから せんを あけると、3つとも
 * 台の手前を越えてからゴールへ降りられる（せんだけ先に あけると 台の手前で
 * 沈みかけて 出遅れることがあるため、ヒントでも「ゲートを あけてから」の順を示す）。
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
    // ゴールの台。水を減らすと浮遊物たちがこの上に降りる。
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
  floaters: [
    { id: 'duck', kind: 'duck', radius: 8, startX: 27, startY: 118 },
    // ボートは少し大きい半径にして、見た目どおり少しどっしり動く。
    { id: 'boat', kind: 'boat', radius: 9, startX: 36, startY: 116 },
    // 浮き輪+くまは少し小さい半径にして、見た目どおり少し身軽に動く。
    { id: 'ringBear', kind: 'ringBear', radius: 7, startX: 22, startY: 118 },
  ],
  goal: {
    // 台の上（y=96）へ降りた浮遊物の中心は y = 96 - 半径。浮いたまま近づいた場合も含めて
    // 拾えるよう、台のすぐ上を少し高めに取ってある。水を減らし切れば半径が違ってもこの
    // 範囲に入るので、水位をぴったり合わせる操作は要らない。
    area: { x: 56, y: 86, width: 28, height: 10 },
    floaterIds: ['duck', 'boat', 'ringBear'],
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
  // 流れ板（#519）。ゲートを渡った先、ゴールの台(y:96〜)より高い位置に置いてあり、
  // 水位を上げて浮遊物をこの高さまで持ち上げたときだけ効果を持つ（水位が低いあいだは
  // 素通りする）。初期状態はゴール方向を後押しする向きにしてあるため、何もしなくても
  // 今までどおり右へ流れて進める。タップすると向きが反転し、触れた浮遊物をゴールから
  // 遠ざける向きへ押し流すようになるため、進める・戻すの両方をこの1枚で体験できる。
  board: { id: 'main-board', x: 56, y: 54, width: 26, height: 10, initialFlowDirection: 'goal' },
  // 水車（#520）。せん(main-drain, x:36,y:126)の真下、水そう本体の外（床y:126〜140のさらに下）に
  // 取り付け、せんを あけて水が流れ出るあいだだけ回る。専用の操作は持たず、せんの開閉に
  // そのまま連動する（drainOpenから導出、#520）。水そうの外に置いてあるため、浮遊物の
  // 移動経路やゴール判定には関与せず、既存ステージの難易度・攻略手順は変わらない。
  // 隣の小さな水門(linkedGate)も同時に開閉し、「水車がまわる→門が開く」を見て分かるようにする。
  waterWheel: {
    id: 'main-water-wheel',
    x: 36,
    y: 143,
    radius: 5.5,
    linkedGate: { x: 44, y: 140.5, width: 4.5, height: 8 },
  },
  hint: 'じゃぐち・ゲートを つかって みんなを ゴールの てまえまで はこんでから、せんを あけよう（いたは タップで むきを かえられるよ）',
}

export const PUKUPUKA_STAGES: readonly StageDefinition[] = [PUKUPUKA_STAGE]

export function findPukupukaStage(stageId: string): StageDefinition | undefined {
  return PUKUPUKA_STAGES.find((stage) => stage.id === stageId)
}
