import type * as Matter from 'matter-js'
import { createJumppadToy } from './jumppadToy'
import { createLauncherToy } from './launcherToy'
import type { ToyPlacement } from './toyLayout'
import { createSpinnerToy } from './spinnerToy'

/** 物理更新のたびにおもちゃへ渡す、盤面上でまだ有効なボール */
export type ToyBall = { readonly ballIndex: number; readonly body: Matter.Body }

/**
 * おもちゃの見た目の状態。エンジンはこの値だけを読んでDOMへ書き込み、
 * 実際の絵（風車・UFOなど）はテーマ側のCSSがこの値を使って描く。
 */
export type ToyVisualState = {
  /** 回転角(rad)。回らないおもちゃは常に0 */
  spinRad: number
  /** 0〜1。発動直後に1へ跳ね、時間で0へ戻る「ポンッ」の強さ */
  pulse: number
  /** いま発動中か（テーマ側のアニメーション切り替え用） */
  active: boolean
  /** 見た目と物理の両方へ同じ値を適用する倍率。通常は1 */
  scale: number
}

export type ToyRuntime = {
  readonly placement: ToyPlacement
  /** 物理世界へ追加するBody（compound可）。物理を持たないおもちゃは空配列 */
  readonly bodies: readonly Matter.Body[]
  /** タップされた瞬間。now は performance.now() 相当のms */
  activate(now: number): void
  /** 毎フレームの更新。balls には削除済み・未射出の球を含めない */
  update(now: number, balls: readonly ToyBall[]): void
  /** 現在の見た目の状態。呼び出しごとに新しいオブジェクトを作らず、内部の同じオブジェクトを返してよい */
  readVisualState(): ToyVisualState
}

/** placement.kind に応じたランタイムを作る。ここが唯一の分岐点 */
export function createToyRuntime(placement: ToyPlacement): ToyRuntime {
  switch (placement.kind) {
    case 'spinner':
      return createSpinnerToy(placement)
    case 'launcher':
      return createLauncherToy(placement)
    case 'jumppad':
      return createJumppadToy(placement)
    default: {
      const unexpectedKind: never = placement.kind
      throw new Error(`flag-pinball: 未対応のおもちゃ種別です: ${unexpectedKind}`)
    }
  }
}
