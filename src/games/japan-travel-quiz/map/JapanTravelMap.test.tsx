import { render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import JapanTravelMap, { cameraForTargetPrefecture } from './JapanTravelMap'

const originalMatchMedia = window.matchMedia
afterEach(() => { window.matchMedia = originalMatchMedia })

describe('JapanTravelMap camera', () => {
  test('小さい都府県は大きい県より強く拡大し、倍率を安全な範囲に収める', () => {
    const hokkaido = cameraForTargetPrefecture('01')
    const iwate = cameraForTargetPrefecture('03')
    const nagano = cameraForTargetPrefecture('20')
    const smallPrefectures = ['13', '27', '37', '14', '11', '12'].map(cameraForTargetPrefecture)

    smallPrefectures.forEach((camera) => {
      expect(camera.scale).toBeGreaterThan(hokkaido.scale)
      expect(camera.scale).toBeGreaterThan(iwate.scale)
      expect(camera.scale).toBeGreaterThan(nagano.scale)
      expect(camera.scale).toBeLessThanOrEqual(11)
    })
  })

  test('沖縄は本州との距離ではなく、既存insetを読みやすい倍率で表示する', () => {
    const okinawa = cameraForTargetPrefecture('47')
    expect(okinawa.scale).toBeGreaterThan(1)
    expect(okinawa.scale).toBeLessThan(3)
  })

  test('出題県が変わると、同じ地図内のcamera transformも更新する', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    const course = { id: 'camera-test', name: 'camera test', prefectureIds: ['13', '01'] as const }
    const { container, rerender } = render(<JapanTravelMap course={course} questionIndex={0} phase="answering" onTravelComplete={() => {}} />)
    const camera = container.querySelector('svg > g')
    expect(camera?.getAttribute('transform')).toContain(`scale(${cameraForTargetPrefecture('13').scale.toFixed(3)})`)

    rerender(<JapanTravelMap course={course} questionIndex={1} phase="answering" onTravelComplete={() => {}} />)
    expect(camera?.getAttribute('transform')).toContain(`scale(${cameraForTargetPrefecture('01').scale.toFixed(3)})`)
  })
})
