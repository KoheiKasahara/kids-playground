import { describe, expect, it } from 'vitest'
import { formatBytes, formatTrendCell, ratioIcon, statusIcon, thresholdWarningIcon } from './format.mjs'

describe('formatBytes', () => {
  it('1MB以上はMB単位で表示する', () => {
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.00 MB')
  })

  it('1MB未満はKB単位で表示する', () => {
    expect(formatBytes(500 * 1024)).toBe('500.0 KB')
  })

  it('値が無い場合はダッシュを返す', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(undefined)).toBe('—')
  })
})

describe('statusIcon', () => {
  it('successは✅', () => {
    expect(statusIcon('success')).toBe('✅')
  })

  it('failureは❌', () => {
    expect(statusIcon('failure')).toBe('❌')
  })

  it('skippedは⏭️', () => {
    expect(statusIcon('skipped')).toBe('⏭️')
  })

  it('不明な場合は❓', () => {
    expect(statusIcon(null)).toBe('❓')
    expect(statusIcon(undefined)).toBe('❓')
  })
})

describe('ratioIcon', () => {
  it('全件成功なら✅', () => {
    expect(ratioIcon(5, 5)).toBe('✅')
  })

  it('一部失敗なら❌', () => {
    expect(ratioIcon(4, 5)).toBe('❌')
  })

  it('値が無い場合は❓', () => {
    expect(ratioIcon(null, null)).toBe('❓')
    expect(ratioIcon(5, null)).toBe('❓')
  })
})

describe('thresholdWarningIcon', () => {
  it('閾値以上は✅', () => {
    expect(thresholdWarningIcon(94, 90)).toBe('✅')
    expect(thresholdWarningIcon(90, 90)).toBe('✅')
  })

  it('閾値未満は❌ではなく⚠️（Warning）', () => {
    expect(thresholdWarningIcon(85, 90)).toBe('⚠️')
  })

  it('計測できていない場合は❓', () => {
    expect(thresholdWarningIcon(null, 90)).toBe('❓')
    expect(thresholdWarningIcon(undefined, 90)).toBe('❓')
  })

  it('閾値が無い場合は判定しない', () => {
    expect(thresholdWarningIcon(94, null)).toBe('')
  })
})

describe('formatTrendCell', () => {
  it('増加は▲、単位付きで表示する', () => {
    expect(formatTrendCell({ delta: 32, trend: 'up', judgement: 'worsened' }, { unit: 'KB' })).toBe('▲ 32 KB')
  })

  it('減少は▼で表示する', () => {
    expect(formatTrendCell({ delta: -1, trend: 'down', judgement: 'worsened' })).toBe('▼ 1')
  })

  it('変化なしは→で表示する', () => {
    expect(formatTrendCell({ delta: 0, trend: 'flat', judgement: 'neutral' })).toBe('→')
  })

  it('trendが無い（前回の有効な履歴が無い）場合はダッシュを返す', () => {
    expect(formatTrendCell(null)).toBe('—')
  })

  it('formatMagnitudeで数値の整形をカスタマイズできる', () => {
    const trend = { delta: -2048, trend: 'down', judgement: 'improved' }
    expect(formatTrendCell(trend, { unit: 'KB', formatMagnitude: (n) => (n / 1024).toFixed(1) })).toBe('▼ 2.0 KB')
  })
})
