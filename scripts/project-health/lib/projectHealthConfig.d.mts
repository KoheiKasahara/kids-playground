// projectHealthConfig.mjs の型定義。`.project-health.json` の閾値を
// Web Dashboard からも同じパース関数で読み、CI と表示基準を二重管理しない。
export interface ProjectHealthThresholds {
  lighthousePerformance: number
  accessibility: number
}

export interface ProjectHealthLighthouseTarget {
  name: string
  path: string
}

export interface ProjectHealthConfig {
  thresholds: ProjectHealthThresholds
  lighthouse: { targets: ProjectHealthLighthouseTarget[] }
  history: { maxEntries: number }
}

export function parseProjectHealthConfig(raw: string | undefined): ProjectHealthConfig
