// 履歴の前回値と今回値から、増加/減少/変化なしと、指標ごとの改善/悪化を判定する。
// 指標によって「増えると良い」「減ると良い」が異なるため、大小比較だけでなく
// direction（higherIsBetter / lowerIsBetter / neutral）を明示的に渡す
// （Issue #525「改善/悪化判定」。Unit tests の増減はneutral、
// 　機械的に品質悪化とは判定しない）。
export function computeTrend(current, previous, direction = 'neutral') {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return null
  }
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return null
  }

  const delta = current - previous
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'

  let judgement = 'neutral'
  if (direction === 'higherIsBetter') {
    judgement = delta > 0 ? 'improved' : delta < 0 ? 'worsened' : 'neutral'
  } else if (direction === 'lowerIsBetter') {
    judgement = delta < 0 ? 'improved' : delta > 0 ? 'worsened' : 'neutral'
  }

  return { delta, trend, judgement }
}

// E2E smoke は passed/total の比率（%）で改善/悪化を判定する
// （対象ゲーム数が増えるだけでも passed の絶対数は増えるため、比率で比較する）。
export function coveragePercent(passed, total) {
  if (
    passed === null ||
    passed === undefined ||
    total === null ||
    total === undefined ||
    !Number.isFinite(passed) ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return null
  }
  return Math.round((passed / total) * 1000) / 10
}
