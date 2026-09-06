import { describe, expect, it } from 'vitest'
import { parseProjectHealthConfig } from './projectHealthConfig.mjs'

describe('parseProjectHealthConfig', () => {
  it('設定ファイルの値をそのまま反映する', () => {
    const config = parseProjectHealthConfig(
      JSON.stringify({
        thresholds: { lighthousePerformance: 80, accessibility: 95 },
        lighthouse: { targets: [{ name: 'Top', path: '/' }, { name: 'Game', path: '/games/x' }] },
      }),
    )

    expect(config.thresholds).toEqual({ lighthousePerformance: 80, accessibility: 95 })
    expect(config.lighthouse.targets).toEqual([
      { name: 'Top', path: '/' },
      { name: 'Game', path: '/games/x' },
    ])
  })

  it('ファイルが無い/空でもデフォルト値を返す', () => {
    expect(parseProjectHealthConfig(undefined).thresholds).toEqual({
      lighthousePerformance: 90,
      accessibility: 90,
    })
    expect(parseProjectHealthConfig('').lighthouse.targets).toEqual([{ name: 'Top', path: '/' }])
  })

  it('壊れたJSONでもクラッシュせずデフォルト値を返す', () => {
    expect(() => parseProjectHealthConfig('{invalid')).not.toThrow()
    expect(parseProjectHealthConfig('{invalid').thresholds.accessibility).toBe(90)
  })

  it('一部の閾値だけ指定した場合は残りをデフォルトで補う', () => {
    const config = parseProjectHealthConfig(JSON.stringify({ thresholds: { accessibility: 95 } }))
    expect(config.thresholds).toEqual({ lighthousePerformance: 90, accessibility: 95 })
  })

  it('targetsが空配列の場合はデフォルトの対象ページへフォールバックする', () => {
    const config = parseProjectHealthConfig(JSON.stringify({ lighthouse: { targets: [] } }))
    expect(config.lighthouse.targets).toEqual([{ name: 'Top', path: '/' }])
  })
})
