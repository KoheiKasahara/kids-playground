// わっか状の かべの かたちを、角度の ならび（360こ）として持つ。
// 円盤を まわす＝この ならびを ずらして 読む、という形にすることで、
// 1ますの かべ判定が たし算と 配列参照だけで すむようにしている。

/** 円を 何こに 分けて 角度を あつかうか。1こ＝1度。 */
export const SECTORS = 360

/** かべの すきま。角度は 画面の むきで、0=みぎ / 90=した / 180=ひだり / 270=うえ。 */
export type Gap = { center: number; width: number }

/** かべを置く わっか。slot は scene.ts の RING_SLOTS の番号。 */
export type Ring = { slot: number; gaps: readonly Gap[] }

export function normalizeSector(sector: number): number {
  return ((sector % SECTORS) + SECTORS) % SECTORS
}

/**
 * 1つの わっかの かべを 1=かべ / 0=すきま の ならびにする。
 * すきまは 中心角から 左右へ ひろがる。
 */
export function buildRingMask(gaps: readonly Gap[]): Uint8Array {
  const mask = new Uint8Array(SECTORS).fill(1)
  for (const gap of gaps) {
    const half = gap.width / 2
    const from = Math.ceil(gap.center - half)
    const to = Math.floor(gap.center + half)
    for (let sector = from; sector <= to; sector++) mask[normalizeSector(sector)] = 0
  }
  return mask
}

/** ステージの わっか一覧から、slot番号で引ける かべの ならびを作る。 */
export function buildRingMasks(rings: readonly Ring[], slotCount: number): (Uint8Array | null)[] {
  const masks: (Uint8Array | null)[] = new Array<Uint8Array | null>(slotCount).fill(null)
  for (const ring of rings) {
    if (ring.slot < 0 || ring.slot >= slotCount) continue
    masks[ring.slot] = buildRingMask(ring.gaps)
  }
  return masks
}

/** そのステージで 水が 通りぬける すきまの ごうけい角度。ステージの むずかしさの目安になる。 */
export function totalGapWidth(ring: Ring): number {
  return ring.gaps.reduce((sum, gap) => sum + gap.width, 0)
}

/**
 * かべの ならびを、えがくための 円弧の ひとまとまりに まとめる。
 * シミュレーションと おなじ ならびから 作るので、見た目と あたり判定が ずれない。
 * from は 角度（度）、length は その かべが つづく 角度。
 */
export function wallRuns(mask: Uint8Array): { from: number; length: number }[] {
  const runs: { from: number; length: number }[] = []
  let walls = 0
  for (const cell of mask) walls += cell
  if (walls === 0) return runs
  if (walls === mask.length) return [{ from: 0, length: mask.length }]
  // すきまの ところから 数えはじめると、0度を またぐ かべも ひとまとまりになる。
  let start = 0
  while (mask[start] === 1) start++
  for (let offset = 0; offset < mask.length;) {
    const from = (start + offset) % mask.length
    if (mask[from] === 0) { offset++; continue }
    let length = 0
    while (length < mask.length && mask[(start + offset + length) % mask.length] === 1) length++
    runs.push({ from, length })
    offset += length
  }
  return runs
}

/** ステージの わっかを、えがくための かたちに 直しておく。 */
export function buildRingShapes(rings: readonly Ring[]): { slot: number; runs: { from: number; length: number }[] }[] {
  return rings.map((ring) => ({ slot: ring.slot, runs: wallRuns(buildRingMask(ring.gaps)) }))
}
