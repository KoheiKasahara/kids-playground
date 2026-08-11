/**
 * 数字ボタンの列数を、行数・列数がなるべく偏らない（正方形に近い）形で決める。
 * 1〜4件は1行に並べ、5件以上は「余りマス（columns*rows-count）が最小、
 * 同じ余りなら行数が少ない」組み合わせを総当たりで選ぶ。
 * 例: 9件なら3×3（余り0・3行）。5×2（余り1・2行）より行数は多いが余りがない形を優先する。
 */
export function columnsForCount(count: number): number {
  if (count <= 4) return Math.max(count, 1)
  let bestColumns = count - 1
  let bestRows = Math.ceil(count / bestColumns)
  let bestWaste = bestColumns * bestRows - count
  for (let columns = 2; columns < count; columns += 1) {
    const rows = Math.ceil(count / columns)
    const waste = columns * rows - count
    if (waste < bestWaste || (waste === bestWaste && rows < bestRows)) {
      bestColumns = columns
      bestRows = rows
      bestWaste = waste
    }
  }
  return bestColumns
}

/**
 * 縦に余裕がない小さい画面向けに、行数を最大2行に抑える列数。
 * 4件以下は1行のままcount列、5件以上はceil(count/2)列で2行に収める。
 */
export function tightColumnsForCount(count: number): number {
  if (count <= 4) return Math.max(count, 1)
  return Math.ceil(count / 2)
}
