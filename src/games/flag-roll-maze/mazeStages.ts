import type { CellCoordinate, GimmickPlacement } from './mazeGimmicks'
import { createMazeStage, type MazeStage } from './mazeStage'

export type MazeStageDefinition = {
  /** 遷移stateやテストで使う安定したID。 */
  id: string
  /** 選択画面とプレイ画面に出す短い名前。 */
  nameJa: string
  /** 文字が読めない子でも見分けられるようにする絵文字。 */
  emoji: string
  /** 名前だけでは違いが伝わらないため、ひらがなの短い説明を1行そえる。 */
  hintJa: string
  rows: readonly string[]
  gimmicks: readonly GimmickPlacement[]
  checkpointCells: readonly CellCoordinate[]
}

/**
 * 右、下、左、下、右へ曲がる2マス幅のやさしい道。
 * 初めて傾ける子が壁際で止まらないよう、穴もギミックも置かない。
 */
const KANTAN_STAGE_ROWS = [
  '#########',
  '#S.....##',
  '#......##',
  '#####..##',
  '##.....##',
  '##.....##',
  '##..#####',
  '##.....G#',
  '#########',
] as const

/** 曲がり角を抜けた地点へ順に置き、迷っても近い所から再開できるようにする。 */
const KANTAN_STAGE_CHECKPOINT_CELLS: readonly CellCoordinate[] = [
  { column: 1, row: 1 },  // START
  { column: 6, row: 3 },  // 最初の右下がりを抜けた所
  { column: 2, row: 5 },  // 左へ曲がったあと
  { column: 4, row: 7 },  // GOALへ向かう最後の横道
]

/**
 * 中央の壁のかたまりを、左回りでも右回りでも回り込める3マス幅のリングコース。
 * 回転棒は外周側へ寄せ、内周側へボールがまっすぐ抜けられる逃げ道を残す。
 */
const KURUKURU_STAGE_ROWS = [
  '###########',
  '#....S....#',
  '#.........#',
  '#.........#',
  '#...###...#',
  '#...###...#',
  '#...###...#',
  '#.........#',
  '#.........#',
  '#....G....#',
  '###########',
] as const

/** 向かい合う辺の棒を逆向きに回し、左右どちらの回り道にも違う動きを作る。 */
const KURUKURU_STAGE_GIMMICKS: readonly GimmickPlacement[] = [
  // 左回りの上辺は外周側へ寄せ、内周側の行3を回避レーンとして残す。
  { kind: 'spinner', id: 'spinner-kurukuru-top', cell: { column: 2.5, row: 1.5 }, angularSpeed: 0.78, initialAngle: 0.2 },
  // 右回りの下辺も外周側へ寄せ、内周側の行7からGOALへ抜けられるようにする。
  { kind: 'spinner', id: 'spinner-kurukuru-bottom', cell: { column: 7.5, row: 8.5 }, angularSpeed: -1.02, initialAngle: Math.PI * 0.7 },
]

/** リングを右回りに進んだ地点を順に記録し、棒の掃引円から離れて復帰できるようにする。 */
const KURUKURU_STAGE_CHECKPOINT_CELLS: readonly CellCoordinate[] = [
  { column: 5, row: 1 },  // START
  { column: 8, row: 3 },  // 右上を回り込んだ所
  { column: 8, row: 6 },  // 右側を下りた所
  { column: 5, row: 7 },  // 下辺の内周レーン
]

/**
 * 左上の短い入口から大きな部屋へ出て、右下のGOALまで斜めに横切るコース。
 * バンパーは壁から離して散らし、跳ねても部屋の中で立て直せるようにする。
 */
const PONPON_STAGE_ROWS = [
  '#############',
  '#S..#########',
  '#...#########',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#..........G#',
  '#############',
] as const

/** 大部屋の対角線へ少しずつ散らし、同じ場所で続けて跳ねないようにする。 */
const PONPON_STAGE_GIMMICKS: readonly GimmickPlacement[] = [
  { kind: 'bumper', id: 'bumper-ponpon-a', cell: { column: 4.0, row: 4.0 } },
  { kind: 'bumper', id: 'bumper-ponpon-b', cell: { column: 7.0, row: 4.4 } },
  { kind: 'bumper', id: 'bumper-ponpon-c', cell: { column: 9.5, row: 6.0 } },
  { kind: 'bumper', id: 'bumper-ponpon-d', cell: { column: 4.5, row: 6.0 } },
]

/** 入口・部屋の真ん中・GOAL手前へ置き、跳ねても進んだ所から遊び直せるようにする。 */
const PONPON_STAGE_CHECKPOINT_CELLS: readonly CellCoordinate[] = [
  { column: 1, row: 1 },  // START
  { column: 3, row: 3 },  // 大部屋へ入った直後
  { column: 6, row: 5 },  // 斜めに横切る途中
  { column: 9, row: 7 },  // GOAL手前
]

/**
 * 上から下へ降り、中央だけ2マス幅にした橋を通ってGOALへ向かうコース。
 * 穴は道の両側へまとめ、細い1マス道へ追い込まれないようにする。
 */
const ANAANA_STAGE_ROWS = [
  '#########',
  '#S......#',
  '#.......#',
  '#.O...O.#',
  '#.O...O.#',
  '####..###',
  '###O..O##',
  '###O..O##',
  '####..###',
  '#.O...O.#',
  '#.O...O.#',
  '#......G#',
  '#########',
] as const

/** 危ない区間の直前直後を続けて記録し、穴へ落ちてもすぐ近くから戻れるようにする。 */
const ANAANA_STAGE_CHECKPOINT_CELLS: readonly CellCoordinate[] = [
  { column: 1, row: 1 },  // START
  { column: 4, row: 2 },  // 最初の両側の穴へ入る前
  { column: 4, row: 5 },  // 最初の穴を抜け、橋へ入る前
  { column: 4, row: 8 },  // 2マス幅の橋を抜けた直後
  { column: 5, row: 11 }, // 最後の両側の穴を抜けた所
]

/**
 * 上下を3マス幅の部屋にし、中央の2マス幅の縦通路でつないだ11×11のステージ。
 * 壁の下にも床を置く一方、Oのマスだけは床を抜いて落下を分かりやすくする。
 */
const ADVENTURE_STAGE_ROWS = [
  '###########',
  '#S........#',
  '#.........#',
  '#.........#',
  '######O.###',
  '######O.###',
  '######O.###',
  '#.........#',
  '#G........#',
  '#.........#',
  '###########',
] as const

/** 既定ステージのギミックはセル座標で管理し、グリッドの大きさに合わせて解決する。 */
const ADVENTURE_STAGE_GIMMICKS: readonly GimmickPlacement[] = [
  // 下の縦通路(列7)へ降りる導線の真上に置き、普通に進むと必ず棒に出会うようにする。
  // 南側には1.9の退避レーンが残るので、避けたい子は部屋の下側を回れば通れる。
  { kind: 'spinner', id: 'spinner-top', cell: { column: 7.0, row: 1.85 }, angularSpeed: 1.0, initialAngle: 0 },
  // ゴール手前の最後の関門。少し遅くして、終盤でも落ち着いて抜けられるようにする。
  { kind: 'spinner', id: 'spinner-goal', cell: { column: 2.5, row: 8.0 }, angularSpeed: -0.85, initialAngle: Math.PI / 2 },
  // 下の部屋。ボールは列6付近から入って左のゴールへ向かうので、その道すじへ散らして置く。
  { kind: 'bumper', id: 'bumper-a', cell: { column: 7.5, row: 8.0 } },
  { kind: 'bumper', id: 'bumper-b', cell: { column: 5.6, row: 7.6 } },
  { kind: 'bumper', id: 'bumper-c', cell: { column: 4.2, row: 8.4 } },
]

/** 復帰先はスタートから順に並べ、穴やギミックの直前で再開しないようにする。 */
const ADVENTURE_STAGE_CHECKPOINT_CELLS: readonly CellCoordinate[] = [
  { column: 1, row: 1 },      // START
  { column: 7, row: 3 },      // 穴のある縦通路へ入る直前
  { column: 6, row: 7 },      // 穴を抜けて下の部屋へ入った直後
  { column: 5.0, row: 8.6 },  // ゴール手前の回転棒へ挑む前
]

export const MAZE_STAGES: readonly MazeStageDefinition[] = [
  {
    id: 'kantan',
    nameJa: 'かんたん',
    emoji: '🟢',
    hintJa: 'まっすぐ すすむ',
    rows: KANTAN_STAGE_ROWS,
    gimmicks: [],
    checkpointCells: KANTAN_STAGE_CHECKPOINT_CELLS,
  },
  {
    id: 'kurukuru',
    nameJa: 'くるくる',
    emoji: '🌀',
    hintJa: 'まわる ぼうを よけて',
    rows: KURUKURU_STAGE_ROWS,
    gimmicks: KURUKURU_STAGE_GIMMICKS,
    checkpointCells: KURUKURU_STAGE_CHECKPOINT_CELLS,
  },
  {
    id: 'ponpon',
    nameJa: 'ぽんぽん',
    emoji: '🔴',
    hintJa: 'ぽんぽん はずむ',
    rows: PONPON_STAGE_ROWS,
    gimmicks: PONPON_STAGE_GIMMICKS,
    checkpointCells: PONPON_STAGE_CHECKPOINT_CELLS,
  },
  {
    id: 'anaana',
    nameJa: 'あなあな',
    emoji: '🕳️',
    hintJa: 'あなに おちないで',
    rows: ANAANA_STAGE_ROWS,
    gimmicks: [],
    checkpointCells: ANAANA_STAGE_CHECKPOINT_CELLS,
  },
  {
    id: 'adventure',
    nameJa: 'ぼうけん',
    emoji: '🏆',
    hintJa: 'ぜんぶ でてくる',
    rows: ADVENTURE_STAGE_ROWS,
    gimmicks: ADVENTURE_STAGE_GIMMICKS,
    checkpointCells: ADVENTURE_STAGE_CHECKPOINT_CELLS,
  },
]

export const MAZE_STAGE_IDS: readonly string[] = MAZE_STAGES.map((stage) => stage.id)

export const DEFAULT_MAZE_STAGE_ID = 'kantan'

const DEFAULT_MAZE_STAGE_DEFINITION: MazeStageDefinition = (() => {
  const definition = MAZE_STAGES.find(
    (stage) => stage.id === DEFAULT_MAZE_STAGE_ID,
  )
  if (definition === undefined) {
    throw new Error('既定ステージの定義がありません')
  }
  return definition
})()

export function isMazeStageId(value: unknown): value is string {
  return typeof value === 'string' && MAZE_STAGE_IDS.includes(value)
}

export function findMazeStageDefinition(id: string): MazeStageDefinition | null {
  return MAZE_STAGES.find((stage) => stage.id === id) ?? null
}

export function createMazeStageById(id: string): MazeStage {
  const definition = findMazeStageDefinition(id) ?? DEFAULT_MAZE_STAGE_DEFINITION
  return createMazeStage(definition.rows, {
    id: definition.id,
    nameJa: definition.nameJa,
    gimmicks: definition.gimmicks,
    checkpointCells: definition.checkpointCells,
  })
}

export function nextMazeStageId(id: string): string | null {
  const currentIndex = MAZE_STAGE_IDS.indexOf(id)
  return currentIndex >= 0 ? MAZE_STAGE_IDS[currentIndex + 1] ?? null : null
}

/** 既存テストが安定した名前で参照できるように残す、ぼうけんステージのグリッド。 */
export const MAZE_STAGE_ROWS = MAZE_STAGES.find((stage) => stage.id === 'adventure')!.rows
