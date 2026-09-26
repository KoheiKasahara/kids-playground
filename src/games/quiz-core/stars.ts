/**
 * 正解数から ★1〜3 を決める（Issue #784 A9）。さいごまで あそんだら必ず★1つはもらえる。
 * 全問正解で★3、7割以上で★2。
 */
export function quizStarCount(correctCount: number, totalCount: number): 1 | 2 | 3 {
  if (totalCount > 0 && correctCount >= totalCount) return 3
  if (totalCount > 0 && correctCount * 10 >= totalCount * 7) return 2
  return 1
}
