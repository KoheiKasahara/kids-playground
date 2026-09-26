/**
 * 3Dつみきの かたちと いろ。見た目（visuals.ts）と 物理（useTsumikiEngine.ts）の
 * どちらも この表の すんぽうを つかうので、ここを かえれば りょうほうが そろう。
 * 1 = たてよこ 1 の しかく つみき の ながさ。
 */

export type BlockShapeId = 'cube' | 'plank' | 'pillar' | 'roof' | 'arch' | 'cone'

export type BlockShape = {
  id: BlockShapeId
  label: string
  /** 物理・かげの けいさんに つかう ほぼ そとがわの はこ（まわす まえ）。 */
  size: { x: number; y: number; z: number }
  /** おまかせ の ときの いろ。おもちゃの つみきセット ふうに かたちごとに きめておく。 */
  defaultColor: BlockColorId
  /** ぶつかった ときの おとの たかさ（おおきい ほど ひくい）。 */
  pitch: number
}

export const BLOCK_SHAPES: readonly BlockShape[] = [
  { id: 'cube', label: 'しかく', size: { x: 1, y: 1, z: 1 }, defaultColor: 'red', pitch: 1 },
  { id: 'plank', label: 'ながい いた', size: { x: 2, y: 0.5, z: 1 }, defaultColor: 'yellow', pitch: 0.82 },
  { id: 'pillar', label: 'えんちゅう', size: { x: 0.9, y: 1.5, z: 0.9 }, defaultColor: 'green', pitch: 0.9 },
  { id: 'roof', label: 'さんかく', size: { x: 1.2, y: 0.9, z: 1 }, defaultColor: 'blue', pitch: 1.12 },
  { id: 'arch', label: 'アーチ', size: { x: 2, y: 1, z: 1 }, defaultColor: 'orange', pitch: 0.78 },
  { id: 'cone', label: 'とんがり', size: { x: 0.9, y: 1.1, z: 0.9 }, defaultColor: 'purple', pitch: 1.25 },
]

export type BlockColorId = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'wood'

export type BlockColor = { id: BlockColorId; label: string; hex: string }

export const BLOCK_COLORS: readonly BlockColor[] = [
  { id: 'red', label: 'あか', hex: '#e2483d' },
  { id: 'orange', label: 'オレンジ', hex: '#f3922c' },
  { id: 'yellow', label: 'きいろ', hex: '#f5c535' },
  { id: 'green', label: 'みどり', hex: '#43b36a' },
  { id: 'blue', label: 'あお', hex: '#3a7fd8' },
  { id: 'purple', label: 'むらさき', hex: '#8a5ccf' },
  { id: 'pink', label: 'ピンク', hex: '#f07fae' },
  { id: 'wood', label: 'きの いろ', hex: '#dcb27a' },
]

/** いろ えらびの 「おまかせ」。かたちごとの いろに なる。 */
export const AUTO_COLOR = 'auto' as const
export type ColorChoice = BlockColorId | typeof AUTO_COLOR

export function findShape(id: BlockShapeId): BlockShape {
  return BLOCK_SHAPES.find(shape => shape.id === id) ?? BLOCK_SHAPES[0]
}

export function findColor(id: BlockColorId): BlockColor {
  return BLOCK_COLORS.find(color => color.id === id) ?? BLOCK_COLORS[0]
}

export function resolveColor(shape: BlockShapeId, choice: ColorChoice): BlockColorId {
  return choice === AUTO_COLOR ? findShape(shape).defaultColor : choice
}

/** まわした あとの 床から 見た はば（90度 ずつ しか まわさない）。 */
export function footprint(shape: BlockShapeId, quarterTurns: number): { x: number; z: number } {
  const { size } = findShape(shape)
  return quarterTurns % 2 === 0 ? { x: size.x, z: size.z } : { x: size.z, z: size.x }
}
