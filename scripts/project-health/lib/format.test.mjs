import { describe, expect, it } from 'vitest'
import { formatBytes, ratioIcon, statusIcon } from './format.mjs'

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
