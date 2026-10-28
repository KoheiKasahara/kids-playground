/**
 * ステージ制ゲームの「クリア済み＋いちばん よい ★(1〜3)」を保存する共通ストア（Issue #784 A6）。
 * ゲームごとに localStorage のキーだけを変えて使う。保存できない環境（プライベートモード等）でも
 * 例外を外へ出さず、そのまま遊べるようにする。
 *
 * 値は { [ステージID]: ★の数(1〜3) } の形。★1以上が入っていれば「クリア済み」とみなす。
 */
export type StageProgress = Record<string, number>

export type StageProgressWriteResult = { progress: StageProgress; persisted: boolean }

export type StageProgressStore = {
  /** 保存済みの記録を読む。壊れた値や範囲外の★は取りのぞく。 */
  read(): StageProgress
  /** 前より よい ときだけ上書きし、新しい記録を返す。 */
  record(stageId: string | number, stars: number): StageProgress
  /** 永続保存できたかも返す。falseでも記録はこのセッション中保持する。 */
  recordWithStatus(stageId: string | number, stars: number): StageProgressWriteResult
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
  // 成功した読込を常時キャッシュするのでなく、未保存分だけを保存済みの値へ重ねる。
  // 別タブや利用者による保存値の削除も、未保存分がなければ次のreadへ反映される。
  let pending: StageProgress = {}
  let lastRead: StageProgress = {}
  function readWithStatus(): StageProgressWriteResult {
    let persisted = false
    try {
      const raw = localStorage.getItem(key)
      let value: unknown
      try { value = JSON.parse(raw ?? '{}') } catch { value = null }
      lastRead = value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).filter(([id, stars]) => isValidId(id) && isValidStars(stars)))
        : {}
      persisted = Object.keys(pending).length === 0
    } catch {
      // 途中から読込も拒否されたときは、最後に読み取れた記録を保つ。
    }
    const merged = new Map(Object.entries(lastRead))
    for (const [id, stars] of Object.entries(pending)) merged.set(id, Math.max(merged.get(id) ?? 0, stars))
    return { progress: Object.fromEntries(merged), persisted }
  }

  function read(): StageProgress { return readWithStatus().progress }

  function recordWithStatus(stageId: string | number, stars: number): StageProgressWriteResult {
    const current = readWithStatus()
    const id = String(stageId)
    if (!isValidId(id) || !Number.isFinite(stars)) return current
    const clamped = Math.max(1, Math.min(MAX_STAGE_STARS, Math.round(stars)))
    const best = Object.hasOwn(current.progress, id) ? current.progress[id]! : 0
    if (current.persisted && best >= clamped) return current
    const progress = { ...current.progress, [id]: Math.max(best, clamped) }
    try {
      // 同じ★でも、前回保存できなかった記録があれば再試行する。
      localStorage.setItem(key, JSON.stringify(progress))
      lastRead = { ...progress }
      pending = {}
      return { progress, persisted: true }
    } catch {
      pending = { ...progress }
      return { progress, persisted: false }
    }
  }

  function record(stageId: string | number, stars: number): StageProgress {
    return recordWithStatus(stageId, stars).progress
  }
  return { read, record, recordWithStatus }
}

/** 集めた★の合計。 */
export function totalStageStars(progress: StageProgress): number {
  return Object.values(progress).reduce((sum, stars) => sum + stars, 0)
}
