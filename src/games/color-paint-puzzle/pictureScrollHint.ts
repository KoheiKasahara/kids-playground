// 題材えらびの横スクロール領域について、「まだ続きがある向き」を求める純ロジック。DOM APIに触れない。
//
// スクロール位置から矢印・フェードの出し分けを決めるだけの計算をここに切り出すことで、
// レイアウトを持たない環境（jsdom）でも境界の振る舞いを検証できるようにしている。

export type PictureScrollHint = {
  /** 左にまだ題材が隠れている（左へスクロールできる）。 */
  left: boolean
  /** 右にまだ題材が隠れている（右へスクロールできる）。 */
  right: boolean
}

/**
 * 端とみなす許容差(px)。小数の丸めやスクロールの慣性で端ちょうどの値にならないことがあり、
 * 厳密に比べると端に着いても矢印が消えず、チカチカして見えるため。
 */
const EDGE_TOLERANCE_PX = 2

/**
 * 横スクロール領域の現在位置から、左右どちらに「まだ続きがある」かを求める。
 *
 * スクロールが不要な幅（＝中身が枠に収まっている）のときは両方 false を返す。
 * 広い画面で9件が2段に収まりきるときや、レイアウトを持たない jsdom で
 * すべてが 0 になるときに、意味のない矢印を出さないため。
 */
export function pictureScrollHint(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): PictureScrollHint {
  if (scrollWidth <= clientWidth + EDGE_TOLERANCE_PX) return { left: false, right: false }
  const maxScrollLeft = scrollWidth - clientWidth
  return {
    // iOSのバウンスで scrollLeft が負になることがあるので、「> 許容差」で判定する。
    left: scrollLeft > EDGE_TOLERANCE_PX,
    right: scrollLeft < maxScrollLeft - EDGE_TOLERANCE_PX,
  }
}
