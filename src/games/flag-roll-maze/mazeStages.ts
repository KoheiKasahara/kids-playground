import type { CellCoordinate, GimmickPlacement } from './mazeGimmicks'
import { createMazeStage, type MazeStage } from './mazeStage'
import type { TerrainPlacement } from './mazeTerrain'

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
  /** 高低差ステージだけ、STARTが乗る地形の上面を指定する。 */
  startY?: number
  /** 文字グリッドでは表せない高台・坂・丸棒をセル座標で重ねる。 */
  terrain?: readonly TerrainPlacement[]
  gimmicks: readonly GimmickPlacement[]
  checkpointCells: readonly (CellCoordinate & { y?: number; radius?: number })[]
  starCells: readonly (CellCoordinate & { y?: number })[]
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

/** 星はメインルート上と少し先の寄り道に分け、集めなくてもGOALへ進める位置に置く。 */
const KANTAN_STAGE_STAR_CELLS: readonly CellCoordinate[] = [
  { column: 4, row: 2 }, // 最初の横道のメインルート上
  { column: 2, row: 4 }, // 左へ曲がった先の少し寄り道
  { column: 3, row: 7 }, // GOALへ向かう最後の道の途中
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

/** 星はリングの主な通り道と左右の回り道へ分け、取ると少しだけ遠回りになる。 */
const KURUKURU_STAGE_STAR_CELLS: readonly CellCoordinate[] = [
  { column: 8, row: 2 }, // 右上のメインルート上
  { column: 2, row: 6 }, // 左回りへ寄る小さな寄り道
  { column: 9, row: 7 }, // GOALへ向かう右下の道
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

/** 星は大部屋へ入る道と対角線の途中に置き、集めると少しだけ進路を外れる。 */
const PONPON_STAGE_STAR_CELLS: readonly CellCoordinate[] = [
  { column: 2, row: 2 }, // 入口から大部屋へ出るメインルート上
  { column: 1, row: 5 }, // 左端へ寄る寄り道
  { column: 11, row: 3 }, // 大部屋右上の少し寄り道
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

/** 星は穴を避ける主通路と上下の寄り道へ置き、星を取らなくても橋を渡れるようにする。 */
const ANAANA_STAGE_STAR_CELLS: readonly CellCoordinate[] = [
  { column: 6, row: 1 }, // START近くのメインルート上
  { column: 5, row: 5 }, // 橋へ向かう途中の少し寄り道
  { column: 3, row: 11 }, // GOAL手前の左側へ寄る道
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

/** 星は上下の部屋の主通路と端の寄り道へ分け、全部集めなくてもGOALへ行けるようにする。 */
const ADVENTURE_STAGE_STAR_CELLS: readonly CellCoordinate[] = [
  { column: 2, row: 3 }, // 上の部屋のメインルート上
  { column: 9, row: 2 }, // 右上へ寄る寄り道
  { column: 8, row: 9 }, // 下の部屋のGOAL前の道
]

/** 高台から段差・漏斗・すべり台へ一直線に進む、アスレチックの骨格。 */
const ATHLETIC_STAGE_ROWS = [
  '#############',
  '##.........##',
  '##....S....##',
  '##.........##',
  '##.........##',
  '##.........##',
  '##.........##',
  '##.........##',
  '#####...#####',
  '#####...#####',
  '#####...#####',
  '#####...#####',
  '##.........##',
  '##.........##',
  '##.........##',
  '##.........##',
  '#####...#####',
  '#####...#####',
  '#####...#####',
  '#####...#####',
  '#####...#####',
  '#####...#####',
  '##.........##',
  '##.........##',
  '#####...#####',
  '#####...#####',
  '#####...#####',
  '#####.G.#####',
  '#############',
] as const

/** 高台からすべり台までを地面から生やし、既存の文字グリッドを通路の外壁として使う。 */
const ATHLETIC_STAGE_TERRAIN: readonly TerrainPlacement[] = [
  {
    kind: 'slab',
    id: 'athletic-mesa',
    cell: { column: 6, row: 1.75 },
    widthCells: 9,
    depthCells: 3.5,
    top: 6.0,
    rails: ['left', 'right', 'back'],
    style: 'platform',
  },
  {
    kind: 'slab',
    id: 'athletic-step-1',
    cell: { column: 6, row: 4.0 },
    widthCells: 9,
    depthCells: 1.0,
    top: 5.0,
    rails: ['left', 'right'],
    style: 'step',
  },
  {
    kind: 'slab',
    id: 'athletic-step-2',
    cell: { column: 6, row: 5.0 },
    widthCells: 9,
    depthCells: 1.0,
    top: 4.0,
    rails: ['left', 'right'],
    style: 'step',
  },
  {
    kind: 'slab',
    id: 'athletic-terrace',
    cell: { column: 6, row: 6.7 },
    widthCells: 9,
    depthCells: 2.4,
    top: 3.0,
    rails: ['left', 'right'],
    style: 'platform',
  },
  // 段の角を丸め、落ちた直後に垂直な角へ引っかからないようにする。
  {
    kind: 'roundedBar',
    id: 'athletic-step-nose-mesa',
    cell: { column: 6, row: 3.5 },
    widthCells: 9,
    y: 5.94,
    radius: 0.14,
  },
  {
    kind: 'roundedBar',
    id: 'athletic-step-nose-1',
    cell: { column: 6, row: 4.5 },
    widthCells: 9,
    y: 4.94,
    radius: 0.14,
  },
  {
    kind: 'roundedBar',
    id: 'athletic-step-nose-2',
    cell: { column: 6, row: 5.5 },
    widthCells: 9,
    y: 3.94,
    radius: 0.14,
  },
  {
    kind: 'slab',
    id: 'athletic-funnel-left',
    cell: { column: 3.25, row: 7.3 },
    widthCells: 2.5,
    depthCells: 1.6,
    top: 3.9,
    style: 'guard',
  },
  {
    kind: 'slab',
    id: 'athletic-funnel-right',
    cell: { column: 8.75, row: 7.3 },
    widthCells: 2.5,
    depthCells: 1.6,
    top: 3.9,
    style: 'guard',
  },
  // 漏斗へ入る側の上端を丸め、テラスから狭い通路へ寄せるときの引っかかりを減らす。
  {
    kind: 'roundedBar',
    id: 'athletic-funnel-lip-left',
    cell: { column: 3.25, row: 6.5 },
    widthCells: 2.5,
    y: 3.9,
    radius: 0.2,
    style: 'guard',
  },
  {
    kind: 'roundedBar',
    id: 'athletic-funnel-lip-right',
    cell: { column: 8.75, row: 6.5 },
    widthCells: 2.5,
    y: 3.9,
    radius: 0.2,
    style: 'guard',
  },
  {
    kind: 'ramp',
    id: 'athletic-slide',
    cell: { column: 6, row: 9.5 },
    widthCells: 3,
    depthCells: 4.0,
    topStart: 3.0,
    topEnd: 0.0,
    rails: ['left', 'right'],
    railHeight: 0.7,
    style: 'slide',
  },
  {
    kind: 'roundedBar',
    id: 'athletic-slide-lip',
    cell: { column: 6, row: 7.9 },
    widthCells: 3,
    y: 3.0,
    radius: 0.18,
    style: 'guard',
  },
  // 道路は既存のグリッド床へ薄く重ね、車の区間だけを見た目で分かりやすくする。
  {
    kind: 'slab',
    id: 'athletic-road',
    cell: { column: 6, row: 13.7 },
    widthCells: 9,
    depthCells: 4,
    bottom: 0,
    top: 0.02,
    style: 'road',
  },
  // 破線は道路よりさらに薄くし、通行方向だけを伝えて当たり判定へ実質影響しないようにする。
  {
    kind: 'slab',
    id: 'athletic-road-mark-1',
    cell: { column: 6, row: 12.2 },
    widthCells: 0.18,
    depthCells: 0.45,
    bottom: 0.02,
    top: 0.024,
    style: 'roadMarking',
  },
  {
    kind: 'slab',
    id: 'athletic-road-mark-2',
    cell: { column: 6, row: 13.2 },
    widthCells: 0.18,
    depthCells: 0.45,
    bottom: 0.02,
    top: 0.024,
    style: 'roadMarking',
  },
  {
    kind: 'slab',
    id: 'athletic-road-mark-3',
    cell: { column: 6, row: 14.2 },
    widthCells: 0.18,
    depthCells: 0.45,
    bottom: 0.02,
    top: 0.024,
    style: 'roadMarking',
  },
  {
    kind: 'slab',
    id: 'athletic-road-mark-4',
    cell: { column: 6, row: 15.2 },
    widthCells: 0.18,
    depthCells: 0.45,
    bottom: 0.02,
    top: 0.024,
    style: 'roadMarking',
  },
  {
    kind: 'slab',
    id: 'athletic-hurdle',
    cell: { column: 6, row: 17.56 },
    widthCells: 3,
    depthCells: 0.22,
    top: 0.52,
    style: 'guard',
  },
  // 丸天面にして、ジャンプ後のボールが壁上で静止しないようcarToy.tsの屋根と同じ考え方を使う。
  {
    kind: 'roundedBar',
    id: 'athletic-hurdle-cap',
    cell: { column: 6, row: 17.56 },
    widthCells: 3,
    y: 0.52,
    radius: 0.18,
    style: 'guard',
  },
  {
    kind: 'slab',
    id: 'athletic-cannon-ridge',
    cell: { column: 6, row: 21.6 },
    widthCells: 3,
    depthCells: 0.3,
    top: 0.72,
    style: 'guard',
  },
  // 丸天面にして、発射後に尾根の上で止まらず着地エリアへ進めるようにする。
  {
    kind: 'roundedBar',
    id: 'athletic-cannon-ridge-cap',
    cell: { column: 6, row: 21.6 },
    widthCells: 3,
    y: 0.72,
    radius: 0.18,
    style: 'guard',
  },
  {
    kind: 'slab',
    id: 'athletic-cannon-guide-left',
    cell: { column: 4.9, row: 20.3 },
    widthCells: 0.9,
    depthCells: 1.6,
    top: 0.9,
    style: 'guard',
  },
  {
    kind: 'slab',
    id: 'athletic-cannon-guide-right',
    cell: { column: 7.1, row: 20.3 },
    widthCells: 0.9,
    depthCells: 1.6,
    top: 0.9,
    style: 'guard',
  },
  // 漏斗へ入る手前の角を丸め、前へ傾け続けたボールがガードに引っかからないようにする。
  {
    kind: 'roundedBar',
    id: 'athletic-cannon-guide-left-cap',
    cell: { column: 4.9, row: 19.5 },
    widthCells: 0.9,
    y: 0.9,
    radius: 0.18,
    style: 'guard',
  },
  {
    kind: 'roundedBar',
    id: 'athletic-cannon-guide-right-cap',
    cell: { column: 7.1, row: 19.5 },
    widthCells: 0.9,
    y: 0.9,
    radius: 0.18,
    style: 'guard',
  },
  {
    kind: 'slab',
    id: 'athletic-landing-funnel-left',
    cell: { column: 3.3, row: 23.6 },
    widthCells: 2.6,
    depthCells: 1.2,
    top: 0.9,
    style: 'guard',
  },
  {
    kind: 'slab',
    id: 'athletic-landing-funnel-right',
    cell: { column: 8.7, row: 23.6 },
    widthCells: 2.6,
    depthCells: 1.2,
    top: 0.9,
    style: 'guard',
  },
  // 着地後に広い部屋から中央通路へ入る角も丸め、失速して詰まるきっかけを減らす。
  {
    kind: 'roundedBar',
    id: 'athletic-landing-funnel-left-cap',
    cell: { column: 3.3, row: 23.0 },
    widthCells: 2.6,
    y: 0.9,
    radius: 0.18,
    style: 'guard',
  },
  {
    kind: 'roundedBar',
    id: 'athletic-landing-funnel-right-cap',
    cell: { column: 8.7, row: 23.0 },
    widthCells: 2.6,
    y: 0.9,
    radius: 0.18,
    style: 'guard',
  },
  // 回転棒に弾かれて左右へ寄ったボールを、GOAL手前でカップの正面へ戻す門。
  // 中央に1.89ぶんの通り道（ボール直径1.26＋余白0.63）を残すので、
  // 棒に振られたあと追加の操作をしなくても、前へ倒し続けるだけでカップへ入れる。
  {
    kind: 'slab',
    id: 'athletic-goal-guide-left',
    cell: { column: 5.05, row: 26.6 },
    widthCells: 0.9,
    depthCells: 1.0,
    top: 0.9,
    style: 'guard',
  },
  {
    kind: 'slab',
    id: 'athletic-goal-guide-right',
    cell: { column: 6.95, row: 26.6 },
    widthCells: 0.9,
    depthCells: 1.0,
    top: 0.9,
    style: 'guard',
  },
  // 門の入口側の角を丸め、斜めから来たボールが角へ引っかからないようにする。
  {
    kind: 'roundedBar',
    id: 'athletic-goal-guide-left-cap',
    cell: { column: 5.05, row: 26.1 },
    widthCells: 0.9,
    y: 0.9,
    radius: 0.18,
    style: 'guard',
  },
  {
    kind: 'roundedBar',
    id: 'athletic-goal-guide-right-cap',
    cell: { column: 6.95, row: 26.1 },
    widthCells: 0.9,
    y: 0.9,
    radius: 0.18,
    style: 'guard',
  },
]

/** 道路の全幅に余白を残し、位相をずらした2台がすれ違う交通に見えるようにする。 */
const ATHLETIC_STAGE_GIMMICKS: readonly GimmickPlacement[] = [
  {
    kind: 'car',
    id: 'car-athletic-near',
    cell: { column: 6, row: 12.8 },
    amplitude: 5.0,
    speed: 2.2,
    phaseOffsetSeconds: 0,
    initialDirection: 1,
  },
  {
    kind: 'car',
    id: 'car-athletic-far',
    cell: { column: 6, row: 14.6 },
    amplitude: 5.0,
    speed: 2.2,
    phaseOffsetSeconds: 2.3,
    initialDirection: -1,
  },
  {
    kind: 'jumpPad',
    id: 'jump-pad-athletic',
    cell: { column: 6, row: 17.0 },
    // 通路幅と同じにして、ハードル手前を通る限り必ず踏むようにする。
    widthCells: 3.0,
    depthCells: 0.5,
  },
  {
    kind: 'cannon',
    id: 'cannon-athletic',
    cell: { column: 6, row: 20.8 },
    elevationRad: (42 * Math.PI) / 180,
    headingRad: 0,
    speed: 7.6,
  },
  // 既存ステージと同じく棒を通路の中央から片側へ寄せる。
  // 真ん中に置くと両脇の逃げ道が1.63ずつしか残らず、直径1.26のボールが
  // どちらへ振られても壁ぎわで粘ってしまう。左へ0.95寄せると、掃引円は
  // 中央を通るボールに必ず当たる一方、右側に2.58の広い逃げ道が開くので、
  // 「当たって進路が変わるが、詰まりはしない」最後のアトラクションになる。
  {
    kind: 'spinner',
    id: 'spinner-athletic-final',
    cell: { column: 5.5, row: 25.6 },
    angularSpeed: -0.82,
    initialAngle: Math.PI * 0.35,
  },
]

/** 進行方向を取りこぼさないよう、幅の広い通路では半径も広げて順に記録する。 */
const ATHLETIC_STAGE_CHECKPOINT_CELLS: readonly (CellCoordinate & {
  y?: number
  radius?: number
})[] = [
  { column: 6, row: 2, y: 6.0 },
  { column: 6, row: 7.8, y: 3.0, radius: 2.8 },
  { column: 6, row: 11.5, y: 0, radius: 2.6 },
  { column: 6, row: 16.3, y: 0, radius: 2.6 },
  { column: 6, row: 19.2, y: 0, radius: 2.6 },
  { column: 6, row: 23.4, y: 0, radius: 3.2 },
  { column: 6, row: 25.2, y: 0, radius: 2.6 },
]

/** 高台と地面で真上に重ならない寄り道へ、3つの星を置く。 */
const ATHLETIC_STAGE_STAR_CELLS: readonly (CellCoordinate & { y?: number })[] = [
  // テラスの左寄り。漏斗(athletic-funnel-left)は行6.5から始まるので、
  // それより手前へ置かないと星がガードの内側へ埋まって見えなくなる。
  { column: 3.2, row: 6.0, y: 3.0 },
  { column: 3.0, row: 13.7, y: 0 },
  { column: 8.6, row: 22.7, y: 0 },
]

/**
 * 大砲を順番に乗り継ぐ、7マス幅の専用コース。
 * 大砲の発射を邪魔する内部壁は置かず、左右の壁だけで弾道を見失わない範囲に収める。
 */
const CANNON_STAGE_ROWS = [
  '#############',
  '###...S...###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###.......###',
  '###...G...###',
  '###.......###',
  '###.......###',
  '###.......###',
  '#############',
] as const

/** 発射後の弾道が次の砲口へ向くよう、既存大砲の +z 基準角を指定する。 */
const CANNON_STAGE_GIMMICKS: readonly GimmickPlacement[] = [
  {
    kind: 'cannon',
    id: 'cannon-intro-1',
    cell: { column: 6, row: 3.2 },
    elevationRad: (42 * Math.PI) / 180,
    headingRad: Math.atan2(0.945, 4.347),
    speed: 7.6,
  },
  {
    kind: 'cannon',
    id: 'cannon-intro-2',
    cell: { column: 6.5, row: 5.5 },
    elevationRad: (42 * Math.PI) / 180,
    headingRad: Math.atan2(-1.89, 5.67),
    speed: 7.6,
  },
  {
    kind: 'cannon',
    id: 'cannon-middle-1',
    cell: { column: 5.5, row: 8.5 },
    elevationRad: (42 * Math.PI) / 180,
    headingRad: Math.atan2(1.89, 4.347),
    speed: 7.6,
  },
  {
    kind: 'cannon',
    id: 'cannon-middle-2',
    cell: { column: 6.5, row: 10.8 },
    elevationRad: (42 * Math.PI) / 180,
    // 次の砲台までは一度だけ短く転がる区間にする。
    headingRad: Math.atan2(-0.945, 7.371),
    speed: 7.6,
  },
  {
    kind: 'cannon',
    id: 'cannon-final-1',
    cell: { column: 6, row: 14.7 },
    elevationRad: (42 * Math.PI) / 180,
    headingRad: Math.atan2(-0.945, 4.347),
    speed: 7.6,
  },
  {
    kind: 'cannon',
    id: 'cannon-final-2',
    cell: { column: 5.5, row: 17.0 },
    elevationRad: (42 * Math.PI) / 180,
    headingRad: Math.atan2(1.89, 4.347),
    speed: 7.6,
  },
  {
    kind: 'cannon',
    id: 'cannon-final-3',
    cell: { column: 6.5, row: 19.3 },
    elevationRad: (42 * Math.PI) / 180,
    headingRad: Math.atan2(-0.945, 4.347),
    speed: 7.6,
  },
  {
    kind: 'cannon',
    id: 'cannon-final-4',
    cell: { column: 6, row: 21.6 },
    elevationRad: (42 * Math.PI) / 180,
    headingRad: 0,
    speed: 7.6,
  },
]

/** 各砲台の後ろへ順に復帰地点を置き、失敗しても直前の乗り継ぎから再挑戦できるようにする。 */
const CANNON_STAGE_CHECKPOINT_CELLS: readonly CellCoordinate[] = [
  { column: 6, row: 1 },
  { column: 6.5, row: 5.5 },
  { column: 5.5, row: 8.5 },
  { column: 6.5, row: 10.8 },
  { column: 6, row: 14.7 },
  { column: 5.5, row: 17.0 },
  { column: 6.5, row: 19.3 },
  { column: 6, row: 21.6 },
]

/** 星は弾道の中心から外し、乗り継ぎを邪魔しない寄り道の収集要素にする。 */
const CANNON_STAGE_STAR_CELLS: readonly CellCoordinate[] = [
  { column: 8, row: 4 },
  { column: 4, row: 13 },
  { column: 8, row: 23 },
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
    starCells: KANTAN_STAGE_STAR_CELLS,
  },
  {
    id: 'kurukuru',
    nameJa: 'くるくる',
    emoji: '🌀',
    hintJa: 'まわる ぼうを よけて',
    rows: KURUKURU_STAGE_ROWS,
    gimmicks: KURUKURU_STAGE_GIMMICKS,
    checkpointCells: KURUKURU_STAGE_CHECKPOINT_CELLS,
    starCells: KURUKURU_STAGE_STAR_CELLS,
  },
  {
    id: 'ponpon',
    nameJa: 'ぽんぽん',
    emoji: '🔴',
    hintJa: 'ぽんぽん はずむ',
    rows: PONPON_STAGE_ROWS,
    gimmicks: PONPON_STAGE_GIMMICKS,
    checkpointCells: PONPON_STAGE_CHECKPOINT_CELLS,
    starCells: PONPON_STAGE_STAR_CELLS,
  },
  {
    id: 'anaana',
    nameJa: 'あなあな',
    emoji: '🕳️',
    hintJa: 'あなに おちないで',
    rows: ANAANA_STAGE_ROWS,
    gimmicks: [],
    checkpointCells: ANAANA_STAGE_CHECKPOINT_CELLS,
    starCells: ANAANA_STAGE_STAR_CELLS,
  },
  {
    id: 'adventure',
    nameJa: 'ぼうけん',
    emoji: '🏆',
    hintJa: 'ぜんぶ でてくる',
    rows: ADVENTURE_STAGE_ROWS,
    gimmicks: ADVENTURE_STAGE_GIMMICKS,
    checkpointCells: ADVENTURE_STAGE_CHECKPOINT_CELLS,
    starCells: ADVENTURE_STAGE_STAR_CELLS,
  },
  {
    id: 'athletic',
    nameJa: 'アスレチック',
    emoji: '🎢',
    hintJa: 'すべって とんで うちだす',
    rows: ATHLETIC_STAGE_ROWS,
    startY: 6.0,
    terrain: ATHLETIC_STAGE_TERRAIN,
    gimmicks: ATHLETIC_STAGE_GIMMICKS,
    checkpointCells: ATHLETIC_STAGE_CHECKPOINT_CELLS,
    starCells: ATHLETIC_STAGE_STAR_CELLS,
  },
  {
    id: 'cannon',
    nameJa: '大砲',
    emoji: '💥',
    hintJa: 'とんで つぎへ',
    rows: CANNON_STAGE_ROWS,
    gimmicks: CANNON_STAGE_GIMMICKS,
    checkpointCells: CANNON_STAGE_CHECKPOINT_CELLS,
    starCells: CANNON_STAGE_STAR_CELLS,
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
    startY: definition.startY,
    terrain: definition.terrain,
    gimmicks: definition.gimmicks,
    checkpointCells: definition.checkpointCells,
    starCells: definition.starCells,
  })
}

export function nextMazeStageId(id: string): string | null {
  const currentIndex = MAZE_STAGE_IDS.indexOf(id)
  return currentIndex >= 0 ? MAZE_STAGE_IDS[currentIndex + 1] ?? null : null
}

/** 既存テストが安定した名前で参照できるように残す、ぼうけんステージのグリッド。 */
export const MAZE_STAGE_ROWS = MAZE_STAGES.find((stage) => stage.id === 'adventure')!.rows
