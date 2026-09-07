import type { StageDefinition } from './types'

// ステージ座標。スマホ縦画面に合わせて 100 x 150（2:3）の縦長にする。
export const STAGE_WIDTH = 100
export const STAGE_HEIGHT = 150

function tankWalls(width = STAGE_WIDTH) {
  return [
    { id: 'floor', kind: 'floor' as const, x: 6, y: 126, width: width - 12, height: 14 },
    { id: 'wall-left', kind: 'wall' as const, x: 6, y: 22, width: 8, height: 104 },
    { id: 'wall-right', kind: 'wall' as const, x: width - 14, y: 22, width: 8, height: 104 },
  ]
}

function water(initialLevel: number, ceilingY = 30, right = 86) {
  return {
    id: 'main',
    label: 'おふろ',
    left: 14,
    right,
    floorY: 126,
    ceilingY,
    initialLevel,
  }
}

/** 排水を使うステージ用の見た目位置。水車は水槽の外（床下）だがstage viewBox内に置く。 */
const faucet = { id: 'main-faucet', targetBodyId: 'main', x: 24, y: 10 }
const drain = { id: 'main-drain', sourceBodyId: 'main', x: 24, y: 126 }
const wheel = {
  id: 'main-water-wheel',
  x: 24,
  y: 143,
  radius: 5.5,
  linkedGate: { x: 32, y: 140.5, width: 4.5, height: 8 },
}

/**
 * ぷかぷかレスキューのステージ一覧。
 *
 * 各ステージは「何を試すか」が1つに見えるように、使わないギミックを定義しない。
 * 物理の処理は共通で、ここには配置と初期状態だけを置くデータ駆動の構成にしている。
 */
export const PUKUPUKA_STAGES: readonly StageDefinition[] = [
  {
    id: 'water-rise',
    name: 'みずで ぷかぷか',
    icon: '💧',
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    solids: [
      ...tankWalls(),
      // 右の高い台。水を増やして上から台の上へ運ぶ。
      { id: 'goal-platform', kind: 'platform', x: 64, y: 80, width: 22, height: 46 },
    ],
    waterBodies: [water(12)],
    floaters: [{ id: 'duck', kind: 'duck', radius: 8, startX: 24, startY: 116 }],
    // 水面が上がる途中（およそ3秒）に、右寄りの高い位置で拾える幅を持たせる。
    goal: { area: { x: 52, y: 34, width: 30, height: 20 }, floaterIds: ['duck'] },
    faucet,
    hint: 'じゃぐちを おして、あひるを うえへ はこぼう',
  },
  {
    id: 'land-on-platform',
    name: 'うえから ちゃくち',
    icon: '🛟',
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    solids: [
      ...tankWalls(),
      // まず高い障害を越え、最後に右の広い台へ下ろす。
      { id: 'high-block', kind: 'wall', x: 44, y: 52, width: 12, height: 74 },
      { id: 'goal-platform', kind: 'platform', x: 62, y: 88, width: 24, height: 38 },
    ],
    waterBodies: [water(10)],
    floaters: [
      { id: 'duck', kind: 'duck', radius: 8, startX: 22, startY: 116 },
      { id: 'boat', kind: 'boat', radius: 9, startX: 31, startY: 115 },
    ],
    goal: { area: { x: 64, y: 68, width: 18, height: 20 }, floaterIds: ['duck', 'boat'] },
    faucet,
    drain,
    waterWheel: wheel,
    hint: 'みずを いっぱいにして こえてから、せんで おろそう',
  },
  {
    id: 'open-the-gate',
    name: 'ゲートを あけよう',
    icon: '🚪',
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    solids: [
      ...tankWalls(),
      { id: 'goal-platform', kind: 'platform', x: 62, y: 88, width: 24, height: 38 },
    ],
    waterBodies: [water(10)],
    floaters: [
      { id: 'duck', kind: 'duck', radius: 8, startX: 22, startY: 116 },
      { id: 'boat', kind: 'boat', radius: 9, startX: 31, startY: 115 },
    ],
    goal: { area: { x: 64, y: 68, width: 18, height: 20 }, floaterIds: ['duck', 'boat'] },
    faucet,
    drain,
    gate: { id: 'main-gate', x: 46, y: 22, width: 8, height: 104 },
    waterWheel: wheel,
    hint: 'ゲートを あけて、みずを ためよう',
  },
  {
    id: 'change-the-flow',
    name: 'ながれを かえよう',
    icon: '↔️',
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    solids: [
      ...tankWalls(),
      { id: 'goal-platform', kind: 'platform', x: 68, y: 88, width: 18, height: 38 },
    ],
    // ceilingYを板の高さより下にして、板を逆向きのまま満水にしても越せないようにする。
    waterBodies: [water(10, 48)],
    floaters: [
      { id: 'duck', kind: 'duck', radius: 8, startX: 21, startY: 116 },
      { id: 'boat', kind: 'boat', radius: 9, startX: 30, startY: 115 },
      { id: 'ringBear', kind: 'ringBear', radius: 7, startX: 38, startY: 116 },
    ],
    goal: { area: { x: 68, y: 68, width: 12, height: 20 }, floaterIds: ['duck', 'boat', 'ringBear'] },
    faucet,
    drain,
    gate: { id: 'main-gate', x: 64, y: 22, width: 8, height: 104 },
    board: { id: 'main-board', x: 34, y: 44, width: 26, height: 10, initialFlowDirection: 'back' },
    waterWheel: wheel,
    hint: 'いたを ゴールむきにして、ゲートを あけよう',
  },
  {
    id: 'water-wheel-gate',
    name: 'すいしゃの すいもん',
    icon: '⚙️',
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    solids: [...tankWalls()],
    waterBodies: [water(54)],
    floaters: [
      { id: 'duck', kind: 'duck', radius: 8, startX: 22, startY: 68 },
      { id: 'ringBear', kind: 'ringBear', radius: 7, startX: 32, startY: 69 },
    ],
    goal: { area: { x: 50, y: 108, width: 18, height: 16 }, floaterIds: ['duck', 'ringBear'] },
    faucet,
    drain: { id: 'wheel-drain', sourceBodyId: 'main', x: 50, y: 126 },
    waterWheel: {
      id: 'passage-water-wheel',
      x: 50,
      y: 143,
      radius: 5.5,
      linkedGate: { x: 48, y: 22, width: 6, height: 104 },
      linkedGateBlocksPassage: true,
    },
    hint: 'みずを ためてから、せんで すいしゃの すいもんを ひらこう',
  },
  {
    id: 'long-waterway',
    name: 'ながい すいろ',
    icon: '🚣',
    width: 240,
    height: STAGE_HEIGHT,
    viewportWidth: STAGE_WIDTH,
    solids: [
      ...tankWalls(240),
      { id: 'first-wall', kind: 'wall', x: 66, y: 58, width: 10, height: 68 },
    ],
    waterBodies: [water(10, 30, 226)],
    floaters: [
      { id: 'duck', kind: 'duck', radius: 8, startX: 22, startY: 116 },
      { id: 'boat', kind: 'boat', radius: 9, startX: 32, startY: 115 },
      { id: 'ringBear', kind: 'ringBear', radius: 7, startX: 41, startY: 116 },
    ],
    goal: { area: { x: 198, y: 22, width: 24, height: 22 }, floaterIds: ['duck', 'boat', 'ringBear'] },
    faucet,
    gate: { id: 'journey-gate', x: 112, y: 22, width: 8, height: 104 },
    board: { id: 'journey-board', x: 142, y: 22, width: 34, height: 12, initialFlowDirection: 'back' },
    hint: 'たかい かべ、ゲート、いたを じゅんばんに こえよう',
  },
]

/**
 * 旧Phaseの外部参照を壊さないための互換定義。
 *
 * UIからは参照せず、過去の純粋ロジックテスト・利用者が保存していたサンプル用に残す。
 * 新しいゲーム画面は必ず PUKUPUKA_STAGES を使う。
 */
type LegacyStageDefinition = StageDefinition & {
  faucet: NonNullable<StageDefinition['faucet']>
  drain: NonNullable<StageDefinition['drain']>
  gate: NonNullable<StageDefinition['gate']>
  board: NonNullable<StageDefinition['board']>
  waterWheel: NonNullable<StageDefinition['waterWheel']>
}

export const PUKUPUKA_STAGE: LegacyStageDefinition = {
  id: 'ofuro',
  name: 'はじめの おふろ',
  icon: '🛟',
  width: STAGE_WIDTH,
  height: STAGE_HEIGHT,
  solids: [
    ...tankWalls(),
    { id: 'goal-platform', kind: 'platform', x: 54, y: 96, width: 32, height: 30 },
  ],
  waterBodies: [water(14)],
  floaters: [
    { id: 'duck', kind: 'duck', radius: 8, startX: 27, startY: 118 },
    { id: 'boat', kind: 'boat', radius: 9, startX: 36, startY: 116 },
    { id: 'ringBear', kind: 'ringBear', radius: 7, startX: 22, startY: 118 },
  ],
  goal: { area: { x: 56, y: 86, width: 28, height: 10 }, floaterIds: ['duck', 'boat', 'ringBear'] },
  faucet: { id: 'main-faucet', targetBodyId: 'main', x: 38, y: 10 },
  drain: { id: 'main-drain', sourceBodyId: 'main', x: 36, y: 126 },
  gate: { id: 'main-gate', x: 46, y: 22, width: 8, height: 104 },
  board: { id: 'main-board', x: 56, y: 54, width: 26, height: 10, initialFlowDirection: 'goal' },
  waterWheel: {
    id: 'main-water-wheel',
    x: 36,
    y: 143,
    radius: 5.5,
    linkedGate: { x: 44, y: 140.5, width: 4.5, height: 8 },
  },
  hint: 'じゃぐち・ゲートを つかって ゴールへ はこぼう',
}

export type PukupukaStageId = (typeof PUKUPUKA_STAGES)[number]['id']

export function findPukupukaStage(stageId: string): StageDefinition | undefined {
  return PUKUPUKA_STAGES.find((stage) => stage.id === stageId)
}
