// public/project-health/history.json（Issue #525でNightlyが日次更新する履歴データ）を
// ブラウザから取得するだけのフック。取得・パース失敗時も例外を投げず、
// 空履歴として扱うことでDashboard全体が壊れないようにする。
import { useEffect, useState } from 'react'
import { parseHistoryFile, type ProjectHealthHistoryEntry } from '../../scripts/project-health/lib/history.mjs'

export type HistoryLoadState =
  | { status: 'loading' }
  | { status: 'ready'; entries: ProjectHealthHistoryEntry[]; updatedAt: string | null }

const HISTORY_URL = import.meta.env.DEV
  ? `${import.meta.env.BASE_URL}project-health/history.json`
  : 'https://raw.githubusercontent.com/KoheiKasahara/kids-playground/project-health-history/public/project-health/history.json'

export function useProjectHealthHistory(): HistoryLoadState {
  const [state, setState] = useState<HistoryLoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function load() {
      let raw: unknown = null
      try {
        const response = await fetch(HISTORY_URL, { cache: 'no-store' })
        if (response.ok) {
          raw = await response.text()
        }
      } catch {
        // ネットワーク不通/オフライン等。履歴なし扱いにフォールバックする。
        raw = null
      }

      if (cancelled) {
        return
      }

      const parsed = parseHistoryFile(raw)
      let updatedAt: string | null = null
      if (typeof raw === 'string') {
        try {
          const json = JSON.parse(raw) as { updatedAt?: unknown }
          updatedAt = typeof json.updatedAt === 'string' ? json.updatedAt : null
        } catch {
          updatedAt = null
        }
      }

      setState({ status: 'ready', entries: parsed.entries, updatedAt })
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return state
}
