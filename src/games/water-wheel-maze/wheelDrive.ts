// すいしゃと かんらんしゃの うごき。
// とどいた 水つぶの かずだけで 角度が 決まる すなおな 歯車あつかいにして、
// 「みずを とどけた ぶんだけ まわる」という 因果を そのまま 数式にしている。

import { GEAR_RATIO, TOY } from './scene'

/** 目あて（need）まで とどけたとき、かんらんしゃが ちょうど 1しゅうする。 */
export function toyTurns(caught: number, need: number): number {
  return caught / Math.max(1, need)
}

/** かんらんしゃの 角度（ラジアン）。画面では みぎまわり。 */
export function toyAngle(caught: number, need: number): number {
  return toyTurns(caught, need) * Math.PI * 2
}

/** みずぐるまの 角度。かんらんしゃより GEAR_RATIO ばい はやく まわる。 */
export function wheelAngle(caught: number, need: number): number {
  return toyAngle(caught, need) * GEAR_RATIO
}

/**
 * てっぺんを こえた ゴンドラの かず。クリア条件は これが ぜんぶ そろうこと。
 * 数えられる かたちにして、ちいさい子でも のこりが わかるようにする。
 */
export function ridersDelivered(caught: number, need: number): number {
  const riders = Math.floor(toyTurns(caught, need) * TOY.gondolas)
  return Math.max(0, Math.min(TOY.gondolas, riders))
}

export const TOTAL_RIDERS = TOY.gondolas

/**
 * えがくときの なめらかな 角度。目あての角度へ 少しずつ 近づける。
 * 水が どっと 入った ときでも 歯車が とばずに 回って見える。
 */
export function easeAngle(current: number, target: number, ratio = 0.12): number {
  return current + (target - current) * ratio
}
