import type { FloaterKind, StageDefinition } from './types'

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
const duck = (startX = 20) => ({ id: 'duck', kind: 'duck' as const, radius: 5.5, startX, startY: 119 })
/** 足場(supportTop)の上で待つ仲間。 */
const friend = (id: string, kind: FloaterKind, radius: number, x: number, supportTop: number) =>
  ({ id, kind, radius, startX: x, startY: supportTop - radius })
const chick = (x: number, top: number) => friend('chick', 'chick', 4, x, top)
const bear = (x: number, top: number) => friend('ringBear', 'ringBear', 5, x, top)
const cat = (x: number, top: number) => friend('boat', 'boat', 5.5, x, top)
const frog = (x: number, top: number) => friend('frog', 'frog', 4.5, x, top)
const penguin = (x: number, top: number) => friend('penguin', 'penguin', 5, x, top)
const shelf = (id: string, x: number, y: number, width: number) => ({ id, kind: 'platform' as const, x, y, width, height: 126 - y })
const wall = (id: string, x: number, y: number, width: number, height: number) => ({ id, kind: 'wall' as const, x, y, width, height })
const gate = (y: number, height: number, x = 46) => ({ id: 'main-gate', x, y, width: 8, height, leftBodyId: 'left', rightBodyId: 'right' })
const dock = (floaterIds: string[], x = 66, y = 106, width = 20) =>
  ({ area: { x, y: y - 12, width, height: 12 }, floaterIds, requiresLanding: true })
const harbor = (floaterIds: string[], area: { x: number; y: number; width: number; height: number }) => ({ area, floaterIds })
const star = (index: number, x: number, y: number) => ({ id: `star-${index}`, x, y })

export const PUKUPUKA_STAGES: readonly StageDefinition[] = [
  {
    // じゃぐちだけ。しまの上のひよこにふれると、うしろについてくる。
    id: 'water-rise', name: 'みずで ぷかぷか', icon: '💧', width: STAGE_WIDTH, height: STAGE_HEIGHT,
    solids: [...tankWalls(), shelf('island', 44, 90, 14), shelf('dock', 68, 58, 18)],
    waterBodies: [water(8)], floaters: [duck(26), chick(51, 90)],
    goal: harbor(['duck', 'chick'], { x: 66, y: 30, width: 18, height: 24 }),
    faucet, drain,
    stars: [star(1, 32, 96), star(2, 60, 80), star(3, 22, 40)],
    hint: 'じゃぐちを おして、ひよこを むかえに いこう',
  },
  {
    // 高いしまのくまをむかえてから、せんで水をぬいて桟橋へおりる。
    id: 'land-on-platform', name: 'くまを おむかえ', icon: '🐻', width: STAGE_WIDTH, height: STAGE_HEIGHT,
    solids: [...tankWalls(), shelf('bear-island', 43, 64, 16), shelf('dock', 66, 106, 20)],
    waterBodies: [water(8)], floaters: [duck(26), bear(51, 64)], goal: dock(['duck', 'ringBear']),
    faucet, drain: { ...drain, x: 14, y: 120, orientation: 'left-wall' },
    stars: [star(1, 36, 80), star(2, 80, 36), star(3, 76, 96)],
    hint: 'みずで くまを むかえて、せんで さんばしへ おりよう',
  },
  {
    // 高いところのベルを鳴らすと、下のさくが開く。「ためて→ならして→ぬいて くぐる」。
    id: 'ring-the-bell', name: 'カランと ベル', icon: '🔔', width: STAGE_WIDTH, height: STAGE_HEIGHT,
    solids: [...tankWalls(), shelf('cat-rock', 28, 76, 12), wall('divider', 52, 22, 8, 62), shelf('chick-rock', 62, 120, 8)],
    doors: [{ id: 'fence', x: 52, y: 84, width: 8, height: 42 }],
    bells: [{ id: 'bell', x: 46, y: 31, doorId: 'fence' }],
    waterBodies: [water(8)], floaters: [duck(20), cat(34, 76), chick(66, 120)],
    goal: harbor(['duck', 'boat', 'chick'], { x: 72, y: 90, width: 14, height: 34 }),
    faucet, drain: { ...drain, x: 14, y: 116, orientation: 'left-wall' },
    stars: [star(1, 22, 100), star(2, 40, 58), star(3, 64, 100)],
    hint: 'たかい ベルを カラン！ さくが あいたら みずを ぬこう',
  },
  {
    id: 'open-the-gate', name: 'しまの すいもん', icon: '🚪', width: STAGE_WIDTH, height: STAGE_HEIGHT,
    solids: [...tankWalls(), shelf('frog-rock', 30, 100, 8), shelf('gate-base', 46, 90, 8), shelf('bear-island', 59, 65, 10), shelf('dock', 70, 108, 16)],
    waterBodies: dividedWater(50, 8, 0), floaters: [duck(20), frog(34, 100), bear(64, 65)],
    goal: dock(['duck', 'frog', 'ringBear'], 70, 108, 16),
    faucet: { ...faucet, targetBodyId: 'left' },
    drain: { ...drain, x: 54, y: 116, sourceBodyId: 'right', orientation: 'left-wall' },
    gate: gate(22, 68), ambientDriftScale: 0.8,
    stars: [star(1, 24, 90), star(2, 64, 50), star(3, 78, 96)],
    hint: 'すいもんを あけて、みぎの しまの くまも むかえよう',
  },
  {
    // くじらのしおで、高いかべの上のペンギンのところまでジャンプする。
    id: 'whale-jump', name: 'くじらで ジャンプ', icon: '🐳', width: STAGE_WIDTH, height: STAGE_HEIGHT,
    solids: [...tankWalls(), shelf('chick-rock', 26, 98, 6), wall('tall-wall', 44, 22, 6, 104)],
    waterBodies: [
      { id: 'left', label: 'くじらの いけ', left: 14, right: 44, floorY: 126, ceilingY: 30, initialLevel: 8 },
      { id: 'right', label: 'ゴールの いけ', left: 50, right: 86, floorY: 126, ceilingY: 30, initialLevel: 32 },
    ],
    floaters: [duck(19), chick(29, 98), penguin(47, 22)],
    goal: harbor(['duck', 'chick', 'penguin'], { x: 64, y: 86, width: 22, height: 38 }),
    faucet: { ...faucet, targetBodyId: 'left' },
    drain: { ...drain, x: 14, y: 118, sourceBodyId: 'left', orientation: 'left-wall' },
    whale: { id: 'whale', x: 36, y: 117, halfWidth: 6.5, launchVy: -100, carryVx: 34 },
    stars: [star(1, 21, 104), star(2, 38, 60), star(3, 56, 8)],
    hint: 'みずを いっぱいに して、くじらを タップ！',
  },
  {
    // 水の中のプロペラで流れの向きを変え、左右の仲間をじゅんばんにむかえる。
    id: 'change-the-flow', name: 'くるっと ながれ', icon: '↔️', width: STAGE_WIDTH, height: STAGE_HEIGHT,
    solids: [...tankWalls(), shelf('frog-rock', 14, 80, 10), shelf('cat-rock', 40, 88, 10), shelf('dock', 68, 100, 18)],
    // 水は目もりの高さまで。流れで運ぶ高さを、じゃぐちやプロペラにかぶらない位置へそろえる。
    waterBodies: [water(8, 58)], floaters: [duck(32), frog(19, 80), cat(45, 88)],
    goal: harbor(['duck', 'frog', 'boat'], { x: 68, y: 56, width: 18, height: 40 }),
    faucet, drain: { ...drain, x: 30, y: 126 },
    board: { id: 'main-board', x: 51, y: 104, width: 16, height: 10, initialFlowDirection: 'goal', targetBodyId: 'main', circulation: true },
    ambientDriftScale: 0,
    stars: [star(1, 58, 76), star(2, 28, 70), star(3, 76, 60)],
    hint: 'プロペラを くるっ！ ながれで ひだりの かえるも むかえよう',
  },
  {
    // 水をためて入口に届くと、チューブのすべりだいで右のいけへ。仲間もじゅんばんにすべる。
    id: 'twisty-slide', name: 'ぐるぐる すべりだい', icon: '🌀', width: STAGE_WIDTH, height: STAGE_HEIGHT,
    solids: [...tankWalls(), shelf('penguin-rock', 26, 96, 6), wall('divider', 44, 22, 6, 104), shelf('bear-rock', 60, 112, 8)],
    waterBodies: [
      { id: 'left', label: 'すべりだいの いけ', left: 14, right: 44, floorY: 126, ceilingY: 30, initialLevel: 8 },
      { id: 'right', label: 'ゴールの いけ', left: 50, right: 86, floorY: 126, ceilingY: 30, initialLevel: 22 },
    ],
    floaters: [duck(19), penguin(29, 96), bear(64, 112)],
    goal: harbor(['duck', 'penguin', 'ringBear'], { x: 76, y: 84, width: 10, height: 40 }),
    faucet: { ...faucet, targetBodyId: 'left' },
    drain: { ...drain, x: 14, y: 118, sourceBodyId: 'left', orientation: 'left-wall' },
    slide: {
      id: 'slide',
      entry: { x: 36, y: 24, width: 12, height: 16 },
      path: [
        { x: 42, y: 33 }, { x: 48, y: 33 }, { x: 55, y: 34 }, { x: 63, y: 36 }, { x: 70, y: 40 },
        { x: 75, y: 47 }, { x: 76, y: 56 }, { x: 72, y: 64 }, { x: 64, y: 67 }, { x: 57, y: 64 },
        { x: 54, y: 56 }, { x: 56, y: 48 }, { x: 63, y: 45 }, { x: 69, y: 49 }, { x: 71, y: 57 },
        { x: 69, y: 68 }, { x: 66, y: 80 },
      ],
      exitVx: 8,
      exitVy: 40,
    },
    stars: [star(1, 21, 104), star(2, 64, 56), star(3, 22, 40)],
    hint: 'みずを ためて、すべりだいの いりぐちへ！',
  },
  {
    // さいごは全部の仕掛けを順番に。4人の仲間を連れて桟橋へ帰る。
    id: 'long-waterway', name: 'みんなで レスキュー', icon: '🚣', width: 140, height: STAGE_HEIGHT,
    solids: [...tankWalls(140), shelf('chick-rock', 28, 100, 8), shelf('cat-rock', 44, 72, 12),
      wall('gate-roof', 74, 22, 8, 36), shelf('gate-base', 74, 102, 8),
      shelf('penguin-rock', 86, 76, 8), shelf('frog-rock', 98, 118, 6),
      wall('fence-roof', 106, 22, 6, 32), shelf('dock', 112, 110, 14)],
    doors: [{ id: 'fence', x: 106, y: 54, width: 6, height: 72 }],
    bells: [{ id: 'bell', x: 102, y: 33, doorId: 'fence' }],
    waterBodies: dividedWater(78, 8, 0, 126),
    floaters: [duck(20), chick(32, 100), cat(50, 72), penguin(90, 76), frog(101, 118)],
    goal: dock(['duck', 'chick', 'boat', 'penguin', 'frog'], 112, 110, 14),
    faucet: { ...faucet, targetBodyId: 'left' },
    drain: { ...drain, x: 82, y: 119, sourceBodyId: 'right', orientation: 'left-wall' },
    gate: gate(58, 44, 74),
    ambientDriftScale: 0.9,
    stars: [star(1, 22, 96), star(2, 60, 40), star(3, 99, 52)],
    hint: 'なかまを みんな つれて、さんばしへ かえろう',
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
