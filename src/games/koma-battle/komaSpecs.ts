/**
 * コマの定義。
 *
 * Phase 1では見分けがつく色と名前だけを持たせる。
 * アタック/スタミナ等の能力値はここへフィールドを足すだけで入る形にしてあるが、
 * Phase 1では能力システムそのものを実装しない（Issue #328 非目標）。
 */

export type KomaSpec = {
  id: string
  /** 画面に出す名前。 */
  name: string
  /** 円盤部の色。 */
  color: string
  /** 縁と軸の色。相手と取り違えないよう円盤と十分な差をつける。 */
  accentColor: string
  /**
   * 自転の向き。+1が上から見て反時計回り。
   * 2個を逆向きに回すと接触時に噛み合わず弾き合うため、
   * 「くっついたまま一緒に回り続ける」状態が起きにくい。
   */
  spinDirection: 1 | -1
}

export const KOMA_SPECS: readonly KomaSpec[] = [
  {
    id: 'red',
    name: 'あかコマ',
    color: '#e8462f',
    accentColor: '#ffd23f',
    spinDirection: 1,
  },
  {
    id: 'blue',
    name: 'あおコマ',
    color: '#2f6fe8',
    accentColor: '#7fe0ff',
    spinDirection: -1,
  },
] as const

export function findKomaSpec(id: string): KomaSpec | undefined {
  return KOMA_SPECS.find((spec) => spec.id === id)
}

/** 対戦に出すコマを人数ぶん取り出す。1個モードは先頭の1体だけを使う。 */
export function komaSpecsForCount(count: number): KomaSpec[] {
  const clamped = Math.min(Math.max(Math.trunc(count) || 0, 1), KOMA_SPECS.length)
  return KOMA_SPECS.slice(0, clamped)
}
