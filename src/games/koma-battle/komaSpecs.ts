/**
 * コマの「種類」とプレイヤー枠を分けて定義する。
 *
 * プレイヤー枠は赤/青と回転方向を担当し、タイプは能力と造形を担当する。
 * そのため、同じタイプ同士でも「1P/2P」が見た目と物理の両方で区別できる。
 */

export type KomaTypeId = 'balance' | 'attack' | 'stamina' | 'defense'

export type KomaVisualConfig = {
  /** 円盤の半径。幅の違いが上から見ても分かるようにする。 */
  diskRadiusScale: number
  /** 円盤の厚み。横から見たシルエットの違いを作る。 */
  diskThicknessScale: number
  /** 上段の上面/下面の半径比。値が大きいほど平たい形になる。 */
  upperTopScale: number
  upperBottomScale: number
  /** 中心キャップとつまみの大きさ。 */
  capScale: number
  knobScale: number
  /** 外周リングの太さ。 */
  ringScale: number
}

export type KomaTypeConfig = {
  id: KomaTypeId
  /** 幼児向けの短い表示名。 */
  name: string
  /** 小さな画面でも特徴が伝わる短い説明。 */
  description: string
  /** 文字を読まなくても選びやすくする補助アイコン。 */
  icon: string
  /** タイプの造形とUIに共通して使うアクセント色。 */
  accentColor: string
  /** タイプの造形バリエーション。色だけに依存しない。 */
  visual: KomaVisualConfig
  /** Colliderへ適用する密度倍率。全パーツへ同じ倍率を使う。 */
  densityScale: number
  /** 円盤同士の接触の滑りやすさ/跳ねやすさ。 */
  diskFrictionScale: number
  diskRestitutionScale: number
  /** 剛体へ設定する角速度減衰倍率。小さいほど長く回る。 */
  angularDampingScale: number
  /** 発射時の自転と周回の倍率。 */
  initialSpinScale: number
  orbitSpeedScale: number
  /** 低速時の姿勢安定トルク倍率。軽いゲーム的補正として限定的に使う。 */
  stabilizationScale: number
  /** 衝突時の反発補正。勝敗を直接操作せず、円盤の反発係数に反映する。 */
  collisionImpulseScale: number
}

/**
 * タイプ固有値はここへ追加する。
 * 値はすべて基準値からの控えめな倍率にし、物理の安全域を越えないようにする。
 */
export const KOMA_TYPE_CONFIGS: readonly KomaTypeConfig[] = [
  {
    id: 'balance',
    name: 'バランス',
    description: 'なんでも そつなく',
    icon: '⚖️',
    accentColor: '#ffd23f',
    visual: {
      diskRadiusScale: 1,
      diskThicknessScale: 1,
      upperTopScale: 1,
      upperBottomScale: 0.9,
      capScale: 1,
      knobScale: 1,
      ringScale: 1,
    },
    densityScale: 1,
    diskFrictionScale: 1,
    diskRestitutionScale: 1,
    angularDampingScale: 1,
    initialSpinScale: 1,
    orbitSpeedScale: 1,
    stabilizationScale: 1,
    collisionImpulseScale: 1,
  },
  {
    id: 'attack',
    name: 'アタック',
    description: 'はやくて どん！',
    icon: '💥',
    accentColor: '#ff8b3d',
    visual: {
      diskRadiusScale: 1.04,
      diskThicknessScale: 0.88,
      upperTopScale: 0.82,
      upperBottomScale: 0.96,
      capScale: 0.84,
      knobScale: 1.1,
      ringScale: 1.05,
    },
    // 速度と反発は少し上げる一方、軽くして弾かれやすさも残し、常勝を避ける。
    densityScale: 0.92,
    diskFrictionScale: 1.03,
    diskRestitutionScale: 1.08,
    angularDampingScale: 0.98,
    initialSpinScale: 1.06,
    orbitSpeedScale: 1.08,
    stabilizationScale: 0.96,
    collisionImpulseScale: 1.08,
  },
  {
    id: 'stamina',
    name: 'スタミナ',
    description: 'ながく くるくる',
    icon: '⏱️',
    accentColor: '#4fd1c5',
    visual: {
      diskRadiusScale: 0.98,
      diskThicknessScale: 1.12,
      upperTopScale: 0.96,
      upperBottomScale: 0.88,
      capScale: 1.08,
      knobScale: 0.92,
      ringScale: 0.94,
    },
    // 減衰を下げて長持ちさせる。初速と周回速度は控え、固定勝利と外周逃走を避ける。
    densityScale: 0.98,
    diskFrictionScale: 0.96,
    diskRestitutionScale: 0.92,
    angularDampingScale: 0.92,
    initialSpinScale: 0.94,
    orbitSpeedScale: 0.96,
    stabilizationScale: 1.02,
    collisionImpulseScale: 0.92,
  },
  {
    id: 'defense',
    name: 'ディフェンス',
    description: 'どっしり まけない',
    icon: '🛡️',
    accentColor: '#a98bff',
    visual: {
      diskRadiusScale: 1.07,
      diskThicknessScale: 1.16,
      upperTopScale: 1.02,
      upperBottomScale: 0.98,
      capScale: 0.72,
      knobScale: 0.86,
      ringScale: 1.12,
    },
    // 少し重く、少し遅くするが、谷へ動ける範囲に留める。
    densityScale: 1.12,
    diskFrictionScale: 1.02,
    diskRestitutionScale: 0.88,
    angularDampingScale: 0.95,
    initialSpinScale: 0.96,
    orbitSpeedScale: 0.92,
    stabilizationScale: 1.08,
    collisionImpulseScale: 0.86,
  },
] as const

/** Issueや将来の呼び出し側で読みやすい短い別名。 */
export const KOMA_TYPES = KOMA_TYPE_CONFIGS

export function findKomaType(id: string): KomaTypeConfig | undefined {
  return KOMA_TYPE_CONFIGS.find((type) => type.id === id)
}

export type KomaPlayerSlotId = 'player1' | 'player2'

type KomaPlayerSlot = {
  id: KomaPlayerSlotId
  name: string
  color: string
  /** タイプの形状を見せるアクセント色とは別の、プレイヤーを識別する主色。 */
  colorDark: string
  spinDirection: 1 | -1
}

const KOMA_PLAYER_SLOTS: readonly KomaPlayerSlot[] = [
  {
    id: 'player1',
    name: 'あかコマ',
    color: '#e8462f',
    colorDark: '#a92822',
    spinDirection: 1,
  },
  {
    id: 'player2',
    name: 'あおコマ',
    color: '#2f6fe8',
    colorDark: '#21499c',
    spinDirection: -1,
  },
]

export type KomaSpec = {
  /** プレイヤー枠とタイプの組み合わせで一意になるID。 */
  id: string
  slotId: KomaPlayerSlotId
  /** 結果表示や既存の表示との互換性を保つプレイヤー名。 */
  name: string
  playerColorDark: string
  /** 選んだタイプ。物理・見た目の参照は必ずここから行う。 */
  typeId: KomaTypeId
  type: KomaTypeConfig
  /** タイプ名を含む補助表示。 */
  displayName: string
  /** 円盤部のプレイヤー識別色。 */
  color: string
  /** タイプの形状/特徴を示すアクセント色。 */
  accentColor: string
  spinDirection: 1 | -1
}

function createKomaSpec(slot: KomaPlayerSlot, type: KomaTypeConfig): KomaSpec {
  return {
    id: `${slot.id}-${type.id}`,
    slotId: slot.id,
    name: slot.name,
    playerColorDark: slot.colorDark,
    typeId: type.id,
    type,
    displayName: `${slot.name}・${type.name}`,
    color: slot.color,
    accentColor: type.accentColor,
    spinDirection: slot.spinDirection,
  }
}

const BALANCE_TYPE = KOMA_TYPE_CONFIGS[0]

/** Phase 1〜2 の既定表示。既存コードからの import 互換性も保つ。 */
export const KOMA_SPECS: readonly KomaSpec[] = KOMA_PLAYER_SLOTS.map((slot) =>
  createKomaSpec(slot, BALANCE_TYPE),
)

export function findKomaSpec(id: string): KomaSpec | undefined {
  return KOMA_SPECS.find((spec) => spec.id === id)
}

/** 指定したプレイヤー枠へタイプを割り当てる。未知のIDは基準タイプへ戻す。 */
export function createKomaSpecForSlot(
  slotIndex: number,
  typeId: KomaTypeId | string = 'balance',
): KomaSpec {
  const slot =
    KOMA_PLAYER_SLOTS[
      Math.min(Math.max(Math.trunc(slotIndex), 0), KOMA_PLAYER_SLOTS.length - 1)
    ]!
  const type = findKomaType(typeId) ?? BALANCE_TYPE
  return createKomaSpec(slot, type)
}

/**
 * 選択UIで決めたタイプを人数ぶんコマへ変換する。
 * タイプ配列が短い場合はバランス型で補い、常に1〜2体の有効な仕様を返す。
 */
export function komaSpecsForSelection(
  typeIds: readonly (KomaTypeId | string)[],
  count: number,
): KomaSpec[] {
  const clamped = Math.min(Math.max(Math.trunc(count) || 0, 1), KOMA_PLAYER_SLOTS.length)
  return Array.from({ length: clamped }, (_, index) =>
    createKomaSpecForSlot(index, typeIds[index] ?? 'balance'),
  )
}

/** 既存の呼び出し側向け。未選択時は両プレイヤーともバランス型。 */
export function komaSpecsForCount(count: number): KomaSpec[] {
  return komaSpecsForSelection([], count)
}
