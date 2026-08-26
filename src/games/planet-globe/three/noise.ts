/**
 * 天体表面テクスチャ用の、決定的でX方向にタイル可能な値ノイズ。
 *
 * 経度は0度と360度で同じ点（テクスチャの左右の継ぎ目）を指すため、ノイズも
 * 継ぎ目で模様が途切れないよう periodX でX方向だけを必ずwrapさせる。Y方向（緯度）は
 * 北極と南極で終わりがある座標なのでタイルさせない。
 */

/** 格子点(ix, iy)とseedから0..1の擬似乱数を作る。整数演算(Math.imul)だけで済ませて高速に評価する。 */
function hashLattice(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393)
  h = Math.imul(h ^ Math.imul(iy, 668265263), 2246822519)
  h = Math.imul(h ^ Math.imul(seed, 3266489917), 2654435761)
  h ^= h >>> 15
  h = Math.imul(h, 2246822519)
  h ^= h >>> 13
  h = Math.imul(h, 3266489917)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** quintic smoothstep。線形補間よりも格子の継ぎ目が目立ちにくい。 */
function quintic(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/**
 * 格子点の値をバイリニア補間する値ノイズ関数を作る。
 * `periodX` は呼び出しごとに指定できる(fbm2Dがオクターブごとに周期を倍にするため)。
 * `ix` は必ず `periodX` でwrapしてから使うため、`n(0, y, P) === n(P, y, P)` が成り立つ。
 */
export function createNoise2D(seed: number): (x: number, y: number, periodX: number) => number {
  return (x: number, y: number, periodX: number): number => {
    const period = Math.max(1, Math.round(periodX))
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const tx = quintic(x - x0)
    const ty = quintic(y - y0)

    const wrapX = (ix: number) => ((ix % period) + period) % period

    const v00 = hashLattice(wrapX(x0), y0, seed)
    const v10 = hashLattice(wrapX(x0 + 1), y0, seed)
    const v01 = hashLattice(wrapX(x0), y0 + 1, seed)
    const v11 = hashLattice(wrapX(x0 + 1), y0 + 1, seed)

    const vx0 = v00 + (v10 - v00) * tx
    const vx1 = v01 + (v11 - v01) * tx
    return vx0 + (vx1 - vx0) * ty
  }
}

/**
 * フラクタルブラウン運動。lacunarity(周波数の増え方)は2固定。
 * オクターブiでは周波数2^i・周期(periodX)も2^i倍にする(periodXは整数のまま2倍していくため常に整数)。
 * 各オクターブの値は0..1なので、重み(amplitude)の合計で割って0..1に正規化して返す。
 */
export function fbm2D(
  noise: (x: number, y: number, periodX: number) => number,
  x: number,
  y: number,
  periodX: number,
  octaves: number,
  gain = 0.5,
): number {
  let amplitude = 1
  let frequency = 1
  let period = Math.max(1, Math.round(periodX))
  let sum = 0
  let amplitudeSum = 0

  for (let i = 0; i < octaves; i += 1) {
    sum += noise(x * frequency, y * frequency, period) * amplitude
    amplitudeSum += amplitude
    amplitude *= gain
    frequency *= 2
    period *= 2
  }

  return amplitudeSum === 0 ? 0 : sum / amplitudeSum
}
