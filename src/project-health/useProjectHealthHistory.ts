// public/project-health/history.json（Issue #525でNightlyが日次更新する履歴データ）を
// ブラウザから取得するだけのフック。取得・パース失敗時も例外を投げず、
// 空履歴として扱うことでDashboard全体が壊れないようにする。
import { useEffect, useState } from 'react'
import { parseHistoryFile, type ProjectHealthHistoryEntry } from '../../scripts/project-health/lib/history.mjs'

export type HistoryLoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; entries: ProjectHealthHistoryEntry[]; updatedAt: string | null }

const HISTORY_URL = import.meta.env.DEV
  ? `${import.meta.env.BASE_URL}project-health/history.json`
  : 'https://raw.githubusercontent.com/KoheiKasahara/kids-playground/project-health-history/public/project-health/history.json'

export function useProjectHealthHistory(): HistoryLoadState {
  const [state, setState] = useState<HistoryLoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15_000)

    async function load() {
      try {
        const response = await fetch(HISTORY_URL, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('History request failed')
        const raw = await response.text()
        const json = JSON.parse(raw)
        if (!Array.isArray(json?.entries)) throw new Error('Invalid history')
        const parsed = parseHistoryFile(raw)
        if (json.entries.length > 0 && parsed.entries.length === 0) throw new Error('Invalid history entries')
        const updatedAt = typeof json.updatedAt === 'string' ? json.updatedAt : null
        if (!cancelled) setState({ status: 'ready', entries: parsed.entries, updatedAt })
      } catch {
        if (!cancelled) setState({ status: 'error' })
      } finally {
        window.clearTimeout(timeout)
      }
    }

    load()

    return () => {
      cancelled = true
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [])

  return state
}
