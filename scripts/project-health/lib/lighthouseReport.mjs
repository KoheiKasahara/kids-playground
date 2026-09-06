// Lighthouse計測結果（run-lighthouse.mjs が生成するサマリJSON）を解釈する純粋関数。
// Chrome起動やネットワークアクセスを一切行わないため、計測失敗時の表示（—, ❓）を
// 外部依存なしにテストできる。

// Lighthouseのスコアは0〜1のfloatなので、Summary表示用に0〜100の整数へ丸める。
export function roundScore(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return null
  }
  return Math.round(score * 100)
}

// 複数ターゲットのうち、Summaryに表示する代表値は先頭（.project-health.json の
// 一番目）のターゲットとする。将来ターゲットを増やす場合も、表示行を増やさず
// まず代表ページ1件のみを表示する方針（Issue #524: 対象を絞る）に合わせる。
export function parseLighthouseSummary(summary) {
  const target = summary?.targets?.[0]
  if (!target) {
    return { name: null, performance: null, accessibility: null }
  }

  const performance = typeof target.performance === 'number' && Number.isFinite(target.performance)
    ? target.performance
    : null
  const accessibility = typeof target.accessibility === 'number' && Number.isFinite(target.accessibility)
    ? target.accessibility
    : null

  return { name: target.name ?? null, performance, accessibility }
}
