// えらべる どうぶつ。みため（いろ・みみ・もよう）だけが ちがい、はやさや ジャンプは みんな おなじ。
// 絵は art.ts が この いろを つかって canvas に かく。

export type AnimalId =
  | 'dog' | 'cat' | 'rabbit' | 'panda' | 'penguin' | 'lion'
  | 'koala' | 'hamster' | 'giraffe' | 'elephant' | 'bear' | 'fox'

export type Animal = {
  id: AnimalId
  /** えらぶ がめんと けっかに だす なまえ。 */
  name: string
  /** からだの いろ。 */
  body: string
  /** おなか・くちもとの いろ。 */
  belly: string
  /** みみの なか・ほっぺ などの いろ。 */
  accent: string
  /** めじるしの いろ（スコアの いろ・あいての やじるし）。 */
  color: string
}

export const ANIMALS: readonly Animal[] = [
  { id: 'dog', name: 'いぬ', body: '#e9a55c', belly: '#fff6e8', accent: '#c97a35', color: '#e8590c' },
  { id: 'cat', name: 'ねこ', body: '#f4f1ea', belly: '#ffffff', accent: '#f6a6b2', color: '#f08c00' },
  { id: 'rabbit', name: 'うさぎ', body: '#fdfbf6', belly: '#ffffff', accent: '#ffb3c6', color: '#e64980' },
  { id: 'panda', name: 'パンダ', body: '#fbfbf8', belly: '#ffffff', accent: '#2b2b33', color: '#495057' },
  { id: 'penguin', name: 'ペンギン', body: '#2f4a72', belly: '#ffffff', accent: '#ffa62b', color: '#1c7ed6' },
  { id: 'lion', name: 'ライオン', body: '#f7c64f', belly: '#fff3c4', accent: '#c8742a', color: '#f59f00' },
  { id: 'koala', name: 'コアラ', body: '#a9b0bd', belly: '#eef0f4', accent: '#f2f3f7', color: '#5c7cfa' },
  { id: 'hamster', name: 'ハムスター', body: '#f3b874', belly: '#fffaf1', accent: '#ffb3a7', color: '#d9480f' },
  { id: 'giraffe', name: 'キリン', body: '#f6c85a', belly: '#fff2c9', accent: '#b8743a', color: '#e67700' },
  { id: 'elephant', name: 'ぞう', body: '#a3b8d4', belly: '#c7d5e8', accent: '#f6b6c8', color: '#4263eb' },
  { id: 'bear', name: 'くま', body: '#9b6a45', belly: '#e8c49c', accent: '#7a4f30', color: '#a0522d' },
  { id: 'fox', name: 'きつね', body: '#f28a3a', belly: '#fff8ee', accent: '#3b2a22', color: '#f76707' },
]

export function findAnimal(id: string): Animal | undefined {
  return ANIMALS.find(animal => animal.id === id)
}

/** じぶん いがいの どうぶつから あいてを えらぶ。 */
export function pickRival(player: AnimalId, random: () => number = Math.random): AnimalId {
  const others = ANIMALS.filter(animal => animal.id !== player)
  return others[Math.min(others.length - 1, Math.floor(random() * others.length))].id
}
