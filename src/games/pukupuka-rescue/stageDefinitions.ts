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

function dividedWater(boundaryX: number, leftInitialLevel: number, rightInitialLevel: number, right = 86) {
  return [
    {
      id: 'left',
      label: 'ひだりの すいそう',
      left: 14,
      right: boundaryX,
      floorY: 126,
      ceilingY: 30,
      initialLevel: leftInitialLevel,
    },
    {
      id: 'right',
      label: 'みぎの すいそう',
      left: boundaryX,
      right,
      floorY: 126,
      ceilingY: 30,
      initialLevel: rightInitialLevel,
    },
  ]
}

// 仕掛けはすべて画面内で直接操作できる。最後の面もカメラ追従を使わず全景を表示。
const faucet = { id: 'main-faucet', targetBodyId: 'main', x: 22, y: 32 }
const drain = { id: 'main-drain', sourceBodyId: 'main', x: 30, y: 126 }
const duck = { id: 'duck', kind: 'duck' as const, radius: 5.5, startX: 26, startY: 119 }
const bear = (x: number, shelfY: number) => ({ id: 'ringBear', kind: 'ringBear' as const, radius: 5, startX: x, startY: shelfY - 5 })
const shelf = (id: string, x: number, y: number, width: number) => ({ id, kind: 'platform' as const, x, y, width, height: 126 - y })
const gate = (y: number, height: number, x = 46) => ({ id: 'main-gate', x, y, width: 8, height, leftBodyId: 'left', rightBodyId: 'right' })
const dock = (x = 66, y = 106, width = 20) => ({ area: { x, y: y - 12, width, height: 12 }, floaterIds: ['duck', 'ringBear'], requiresLanding: true })
const stars = (x: number, y: number) => [{ id: 'star-1', x: 32, y: 87 }, { id: 'star-2', x, y }, { id: 'star-3', x: 76, y: 96 }]

export const PUKUPUKA_STAGES: readonly StageDefinition[] = [
  {
    id: 'water-rise', name: 'みずで ぷかぷか', icon: '💧', width: STAGE_WIDTH, height: STAGE_HEIGHT,
    solids: [...tankWalls(), shelf('island', 48, 82, 15), shelf('dock', 68, 58, 18)],
    waterBodies: [water(8)], floaters: [duck],
    goal: { area: { x: 66, y: 30, width: 18, height: 22 }, floaterIds: ['duck'] },
    faucet, drain, stars: [{ id: 'star-1', x: 32, y: 87 }, { id: 'star-2', x: 55, y: 63 }, { id: 'star-3', x: 75, y: 38 }],
    hint: 'じゃぐちを おして、しまを こえよう',
  },
  {
    id: 'land-on-platform', name: 'くまを おむかえ', icon: '🐻', width: STAGE_WIDTH, height: STAGE_HEIGHT,
    solids: [...tankWalls(), shelf('bear-island', 43, 64, 16), shelf('dock', 66, 106, 20)],
    waterBodies: [water(8)], floaters: [duck, bear(51, 64)], goal: dock(),
    faucet, drain: { ...drain, x: 14, y: 120, orientation: 'left-wall' }, stars: stars(51, 51),
    hint: 'みずで くまを うかせて、せんで ふたりを おろそう',
  },
  {
    id: 'open-the-gate', name: 'しまの すいもん', icon: '🚪', width: STAGE_WIDTH, height: STAGE_HEIGHT,
    solids: [...tankWalls(), shelf('gate-base', 46, 90, 8), shelf('bear-island', 59, 65, 10), shelf('dock', 70, 108, 16)],
    waterBodies: dividedWater(50, 8, 0), floaters: [duck, bear(64, 65)], goal: dock(70, 108, 16),
    faucet: { ...faucet, targetBodyId: 'left' },
    drain: { ...drain, x: 54, y: 116, sourceBodyId: 'right', orientation: 'left-wall' },
    gate: gate(22, 68), ambientDriftScale: 0.8, stars: stars(64, 54),
    hint: 'すいもんで みずを とどけて、かべの せんで おろそう',
  },
  {
    id: 'change-the-flow', name: 'くるっと ながれ', icon: '↔️', width: STAGE_WIDTH, height: STAGE_HEIGHT,
    solids: [...tankWalls(), shelf('gate-base', 46, 90, 8), shelf('bear-island', 59, 65, 10), shelf('dock', 70, 108, 16)],
    waterBodies: dividedWater(50, 8, 0), floaters: [duck, bear(64, 65)], goal: dock(70, 108, 16),
    faucet: { ...faucet, targetBodyId: 'left' },
    drain: { ...drain, x: 54, y: 116, sourceBodyId: 'right', orientation: 'left-wall' },
    gate: gate(22, 68),
    board: { id: 'main-board', x: 64, y: 80, width: 16, height: 10, initialFlowDirection: 'back', targetBodyId: 'right', circulation: true },
    ambientDriftScale: 0.8, stars: stars(64, 54),
    hint: 'やじるしを くるっ！ ながれを ゴールへ むけよう',
  },
  {
    id: 'water-wheel-gate', name: 'ひくい トンネル', icon: '🕳️', width: STAGE_WIDTH, height: STAGE_HEIGHT,
    solids: [...tankWalls(),
      { id: 'gate-roof', kind: 'wall', x: 46, y: 22, width: 8, height: 46 },
      shelf('gate-base', 46, 100, 8), { id: 'bear-island', kind: 'platform', x: 24, y: 60, width: 10, height: 4 }, shelf('dock', 66, 108, 20)],
    waterBodies: dividedWater(50, 8, 0), floaters: [duck, bear(29, 60)], goal: dock(66, 108),
    faucet: { ...faucet, targetBodyId: 'left' },
    drain: { ...drain, x: 54, y: 118, sourceBodyId: 'right', orientation: 'left-wall' },
    gate: gate(68, 32), levelMarkerY: 84, ambientDriftScale: 0.9, stars: stars(35, 48),
    hint: 'くまを うかせて、みどりの たかさで せんを とめよう',
  },
  {
    id: 'long-waterway', name: 'みんなで レスキュー', icon: '🚣', width: 140, height: STAGE_HEIGHT,
    solids: [...tankWalls(140), shelf('boat-island', 42, 76, 16),
      { id: 'gate-roof', kind: 'wall', x: 74, y: 22, width: 8, height: 36 },
      shelf('gate-base', 74, 102, 8), { id: 'bear-island', kind: 'platform', x: 93, y: 72, width: 12, height: 4 }, shelf('dock', 110, 110, 16)],
    waterBodies: dividedWater(78, 8, 0, 126),
    floaters: [duck, { id: 'boat', kind: 'boat', radius: 5.5, startX: 50, startY: 70.5 }, bear(99, 72)],
    goal: { ...dock(110, 110, 16), floaterIds: ['duck', 'boat', 'ringBear'] },
    faucet: { ...faucet, targetBodyId: 'left' },
    drain: { ...drain, x: 82, y: 119, sourceBodyId: 'right', orientation: 'left-wall' },
    gate: gate(58, 44, 74),
    board: { id: 'journey-board', x: 104, y: 86, width: 16, height: 10, initialFlowDirection: 'back', targetBodyId: 'right', circulation: true },
    ambientDriftScale: 0.9,
    stars: [{ id: 'star-1', x: 50, y: 63 }, { id: 'star-2', x: 99, y: 59 }, { id: 'star-3', x: 117, y: 98 }],
    hint: 'なかまを おむかえ！ みずの たかさと ながれを かえよう',
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
  gate: { id: 'main-gate', x: 46, y: 22, width: 8, height: 104, leftBodyId: 'main', rightBodyId: 'main' },
  board: { id: 'main-board', x: 56, y: 54, width: 26, height: 10, initialFlowDirection: 'goal', targetBodyId: 'main' },
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
