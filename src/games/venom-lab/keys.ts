// アニメーションの キーフレームを なめらかに つなぐ どうぐ。

import { clamp, ease } from './raster'

/** [じかん, あたい] の ならびを なめらかに つなぐ。じかんは 0〜1 で ちいさい じゅん。 */
export function key(t: number, frames: readonly (readonly [number, number])[]) {
  if (t <= frames[0][0]) return frames[0][1]
  for (let i = 1; i < frames.length; i++) {
    const [t1, v1] = frames[i]
    if (t <= t1) {
      const [t0, v0] = frames[i - 1]
      return v0 + (v1 - v0) * ease((t - t0) / (t1 - t0 || 1))
    }
  }
  return frames[frames.length - 1][1]
}

/** ループの なかの ゆれ（-1〜1）。 */
export const wave = (t: number, cycles = 1, offset = 0) => Math.sin((t * cycles + offset) * Math.PI * 2)

/** 0〜1 の じかんを、a〜b の あいだだけ 0→1 に のばす。 */
export const span = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
