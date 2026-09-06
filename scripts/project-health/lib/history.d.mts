// history.mjs の型定義。Phase 4 の Web Dashboard（src/project-health/）が
// このファイルの純粋関数（parseHistoryFile / findPreviousMetricValue 等）を
// Node側と全く同じロジックでブラウザ側からも再利用するために用意する。
// 計測・収集ロジックは追加せず、既存の履歴データを読むためだけの型。
export interface ProjectHealthHistoryEntry {
  date: string
  games: number | null
  unitTests: number | null
  e2eSmokePassed: number | null
  e2eSmokeTotal: number | null
  bundleKb: number | null
  lighthousePerformance: number | null
  accessibility: number | null
  vulnerabilities: number | null
  nightly: string | null
  deploy: string | null
  recordedAt: string
  runId: string | null
}

export interface ProjectHealthHistoryFile {
  entries: ProjectHealthHistoryEntry[]
}

export function toJstDateString(date?: Date): string

export function parseHistoryFile(raw: unknown): ProjectHealthHistoryFile

export function upsertHistoryEntry(
  entries: ProjectHealthHistoryEntry[],
  entry: ProjectHealthHistoryEntry,
  options?: { maxEntries?: number },
): ProjectHealthHistoryEntry[]

export function findPreviousMetricValue<K extends keyof ProjectHealthHistoryEntry>(
  entries: ProjectHealthHistoryEntry[],
  currentDate: string | null | undefined,
  key: K,
): ProjectHealthHistoryEntry[K] | null
