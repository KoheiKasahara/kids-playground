/**
 * ステージ制ゲームの「クリア済み＋いちばん よい ★(1〜3)」を保存する共通ストア（Issue #784 A6）。
 * ゲームごとに localStorage のキーだけを変えて使う。保存できない環境（プライベートモード等）でも
 * 例外を外へ出さず、そのまま遊べるようにする。
 *
 * 値は { [ステージID]: ★の数(1〜3) } の形。★1以上が入っていれば「クリア済み」とみなす。
 */
export type StageProgress = Record<string, number>

export type StageProgressStore = {
  /** 保存済みの記録を読む。壊れた値や範囲外の★は取りのぞく。 */
  read(): StageProgress
  /** 前より よい ときだけ上書きし、新しい記録を返す。 */
  record(stageId: string | number, stars: number): StageProgress
}

export const MAX_STAGE_STARS = 3

function isValidStars(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_STAGE_STARS
}

/**
 * @param key localStorage のキー。既存ゲームの保存データを引き継げるよう、キー名はゲーム側で決める。
 * @param isValidId 保存済みデータのうち、今のステージ構成に存在するIDだけを残すための判定（任意）。
 */
export function createStageProgressStore(
  key: string,
  isValidId: (stageId: string) => boolean = () => true,
): StageProgressStore {
  function read(): StageProgress {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? '{}')
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
      return Object.fromEntries(
        Object.entries(value).filter(([stageId, stars]) => isValidId(stageId) && isValidStars(stars)),
      )
    } catch {
      return {}
    }
  }

  function record(stageId: string | number, stars: number): StageProgress {
    const progress = read()
    const id = String(stageId)
    const clamped = Math.max(1, Math.min(MAX_STAGE_STARS, Math.round(stars)))
    if (isValidId(id) && (progress[id] ?? 0) < clamped) {
      progress[id] = clamped
      try {
        localStorage.setItem(key, JSON.stringify(progress))
      } catch {
        // 保存できなくても つづけて あそべる。
      }
    }
    return progress
  }

  return { read, record }
}

/** 集めた★の合計。 */
export function totalStageStars(progress: StageProgress): number {
  return Object.values(progress).reduce((sum, stars) => sum + stars, 0)
}
