import { describe, expect, it } from 'vitest'
import { findPreviousMetricValue, parseHistoryFile, toJstDateString, upsertHistoryEntry } from './history.mjs'

describe('toJstDateString', () => {
  it('UTC日付をJST（UTC+9）の日付文字列へ変換する', () => {
    // UTC 2026-09-05 18:00 = JST 2026-09-06 03:00（Nightly cronの時刻）
    expect(toJstDateString(new Date('2026-09-05T18:00:00Z'))).toBe('2026-09-06')
  })

  it('日付が変わらないUTC時刻はそのままの日付になる', () => {
    expect(toJstDateString(new Date('2026-09-05T00:00:00Z'))).toBe('2026-09-05')
  })
})

describe('parseHistoryFile', () => {
  it('履歴ファイルが存在しない場合は空履歴を返す（初回実行）', () => {
    expect(parseHistoryFile(undefined)).toEqual({ entries: [] })
    expect(parseHistoryFile('')).toEqual({ entries: [] })
  })

  it('壊れたJSONでもクラッシュせず空履歴を返す', () => {
    expect(() => parseHistoryFile('{invalid')).not.toThrow()
    expect(parseHistoryFile('{invalid')).toEqual({ entries: [] })
  })

  it('entriesが配列でない場合も空履歴として扱う', () => {
    expect(parseHistoryFile(JSON.stringify({ entries: 'not-an-array' }))).toEqual({ entries: [] })
  })

  it('正常なJSONはentriesをそのまま返す', () => {
    const raw = JSON.stringify({ entries: [{ date: '2026-09-05', bundleKb: 1800 }] })
    expect(parseHistoryFile(raw)).toEqual({ entries: [{ date: '2026-09-05', bundleKb: 1800 }] })
  })
})

describe('upsertHistoryEntry', () => {
  it('新しい日付なら追記する', () => {
    const entries = [{ date: '2026-09-04', bundleKb: 1800 }]
    const result = upsertHistoryEntry(entries, { date: '2026-09-05', bundleKb: 1843 })
    expect(result).toEqual([
      { date: '2026-09-04', bundleKb: 1800 },
      { date: '2026-09-05', bundleKb: 1843 },
    ])
  })

  it('同日に複数回実行された場合は同じdateのレコードを上書きする（重複させない）', () => {
    const entries = [
      { date: '2026-09-04', bundleKb: 1800 },
      { date: '2026-09-05', bundleKb: 1843, runId: '1' },
    ]
    const result = upsertHistoryEntry(entries, { date: '2026-09-05', bundleKb: 1850, runId: '2' })
    expect(result).toEqual([
      { date: '2026-09-04', bundleKb: 1800 },
      { date: '2026-09-05', bundleKb: 1850, runId: '2' },
    ])
  })

  it('日付昇順にソートされる', () => {
    const entries = [{ date: '2026-09-05', bundleKb: 1 }]
    const result = upsertHistoryEntry(entries, { date: '2026-09-03', bundleKb: 2 })
    expect(result.map((e) => e.date)).toEqual(['2026-09-03', '2026-09-05'])
  })

  it('maxEntriesを超えると古いものから削除する（履歴が増えても軽量に保つ）', () => {
    const entries = [
      { date: '2026-09-01' },
      { date: '2026-09-02' },
      { date: '2026-09-03' },
    ]
    const result = upsertHistoryEntry(entries, { date: '2026-09-04' }, { maxEntries: 3 })
    expect(result.map((e) => e.date)).toEqual(['2026-09-02', '2026-09-03', '2026-09-04'])
  })

  it('空の履歴に対しても正しく1件目を作成できる（初回実行）', () => {
    expect(upsertHistoryEntry([], { date: '2026-09-05', bundleKb: 1843 })).toEqual([
      { date: '2026-09-05', bundleKb: 1843 },
    ])
    expect(upsertHistoryEntry(undefined, { date: '2026-09-05' })).toEqual([{ date: '2026-09-05' }])
  })
})

describe('findPreviousMetricValue', () => {
  const entries = [
    { date: '2026-09-01', bundleKb: 1700, lighthousePerformance: null },
    { date: '2026-09-03', bundleKb: null, lighthousePerformance: 92 },
    { date: '2026-09-04', bundleKb: 1800, lighthousePerformance: 94 },
  ]

  it('指定した日付より前で、その指標が有効な最新の値を返す', () => {
    expect(findPreviousMetricValue(entries, '2026-09-05', 'bundleKb')).toBe(1800)
  })

  it('直前の日が欠損していても、さらに過去の有効な値まで遡る（欠損値への耐性）', () => {
    expect(findPreviousMetricValue(entries, '2026-09-04', 'bundleKb')).toBe(1700)
  })

  it('currentDateを省略すると日付で絞り込まず履歴内最新の有効な値を返す', () => {
    expect(findPreviousMetricValue(entries, undefined, 'bundleKb')).toBe(1800)
    expect(findPreviousMetricValue(entries, undefined, 'lighthousePerformance')).toBe(94)
  })

  it('有効な値が過去に無い場合はnull', () => {
    expect(findPreviousMetricValue(entries, '2026-09-01', 'bundleKb')).toBeNull()
  })

  it('履歴が空でもクラッシュせずnullを返す（初回実行）', () => {
    expect(findPreviousMetricValue([], '2026-09-05', 'bundleKb')).toBeNull()
    expect(findPreviousMetricValue(undefined, '2026-09-05', 'bundleKb')).toBeNull()
  })
})
