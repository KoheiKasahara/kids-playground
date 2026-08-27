import { describe, expect, it } from 'vitest'
import {
  createCloudTexture,
  createSurfaceMaps,
  layoutScatteredCraters,
  polarCapEdgeLatDeg,
  sampleLatitudeColor,
  withAlpha,
} from './planetSurface'
import type { GasSurfaceSpec, LatitudeStop, RockySurfaceSpec, ScatteredCraters } from '../types'

describe('withAlpha', () => {
  it('16進カラーとアルファから rgba() 文字列を作る', () => {
    expect(withAlpha('#ff8800', 0.5)).toBe('rgba(255, 136, 0, 0.5)')
  })

  it('黒・白でも正しく変換する', () => {
    expect(withAlpha('#000000', 1)).toBe('rgba(0, 0, 0, 1)')
    expect(withAlpha('#ffffff', 0)).toBe('rgba(255, 255, 255, 0)')
  })
})

describe('sampleLatitudeColor', () => {
  const stops: readonly LatitudeStop[] = [
    { latDeg: 90, color: '#ffffff' },
    { latDeg: 0, color: '#808080' },
    { latDeg: -90, color: '#000000' },
  ]

  it('両端のstopと一致する緯度ではその色を返す', () => {
    expect(sampleLatitudeColor(stops, 90)).toEqual([255, 255, 255])
    expect(sampleLatitudeColor(stops, -90)).toEqual([0, 0, 0])
  })

  it('中間の緯度では線形補間した色を返す', () => {
    const [r, g, b] = sampleLatitudeColor(stops, 45)
    expect(r).toBeCloseTo((255 + 128) / 2, 0)
    expect(g).toBeCloseTo((255 + 128) / 2, 0)
    expect(b).toBeCloseTo((255 + 128) / 2, 0)
  })

  it('範囲外の緯度は最寄りのstopへクランプする', () => {
    expect(sampleLatitudeColor(stops, 120)).toEqual([255, 255, 255])
    expect(sampleLatitudeColor(stops, -120)).toEqual([0, 0, 0])
  })
})

describe('layoutScatteredCraters', () => {
  const spec: ScatteredCraters = {
    count: 200,
    minRadiusDeg: 0.5,
    maxRadiusDeg: 3,
    latLimitDeg: 70,
    depth: 0.6,
    seed: 91,
  }

  it('同じseedからは同じ配置を返す(決定性)', () => {
    expect(layoutScatteredCraters(spec)).toEqual(layoutScatteredCraters(spec))
  })

  it('緯度はlatLimitDeg以内に収まる', () => {
    for (const crater of layoutScatteredCraters(spec)) {
      expect(Math.abs(crater.latDeg)).toBeLessThanOrEqual(spec.latLimitDeg)
    }
  })

  it('半径はminRadiusDeg..maxRadiusDegに収まる', () => {
    for (const crater of layoutScatteredCraters(spec)) {
      expect(crater.radiusDeg).toBeGreaterThanOrEqual(spec.minRadiusDeg)
      expect(crater.radiusDeg).toBeLessThanOrEqual(spec.maxRadiusDeg)
    }
  })

  it('件数はcount以上になる(継ぎ目の複製ぶん増える)', () => {
    expect(layoutScatteredCraters(spec).length).toBeGreaterThanOrEqual(spec.count)
  })

  it('半径を広げると経度の継ぎ目で実際に複製が発生する', () => {
    const wideSpec: ScatteredCraters = { ...spec, count: 400, maxRadiusDeg: 20 }
    expect(layoutScatteredCraters(wideSpec).length).toBeGreaterThan(wideSpec.count)
  })
})

describe('createSurfaceMaps', () => {
  const rockySurface: RockySurfaceSpec = {
    style: 'rocky',
    baseColor: '#9e9c95',
    latitudeStops: [
      { latDeg: 90, color: '#a8a69f' },
      { latDeg: -90, color: '#918f88' },
    ],
    noise: {
      seed: 7,
      octaves: 3,
      periodX: 8,
      frequencyY: 4,
      amount: 0.3,
      lightColor: '#c6c4bc',
      darkColor: '#6f6d67',
    },
    patches: [
      {
        id: 'mare-test',
        lonDeg: -170,
        latDeg: 10,
        lonRadiusDeg: 20,
        latRadiusDeg: 10,
        color: '#5f5f63',
        opacity: 0.8,
        softness: 0.4,
        relief: -0.3,
      },
    ],
    craters: [
      {
        id: 'tycho-test',
        lonDeg: -11,
        latDeg: -43,
        radiusDeg: 4.2,
        depth: 0.95,
        rays: { count: 16, lengthDeg: 58, color: '#e8e6de', opacity: 0.3 },
      },
    ],
    scatteredCraters: { count: 30, minRadiusDeg: 0.5, maxRadiusDeg: 3, latLimitDeg: 76, depth: 0.62, seed: 91 },
    polarCaps: { northEdgeLatDeg: 79, southEdgeLatDeg: -76, color: '#f2efe6', raggednessDeg: 4.5, seed: 12 },
  }

  const gasSurface: GasSurfaceSpec = {
    style: 'gas',
    baseColor: '#d8bb92',
    belts: [
      { latDeg: 90, color: '#b9a48d' },
      { latDeg: 0, color: '#efe2c6' },
      { latDeg: -90, color: '#b9a48d' },
    ],
    turbulence: { seed: 5, octaves: 3, periodX: 8, frequencyY: 34, amplitudeDeg: 3.4 },
    mottle: { seed: 19, octaves: 3, periodX: 10, frequencyY: 26, amount: 0.16 },
    spots: [
      {
        id: 'great-red-spot-test',
        lonDeg: 0,
        latDeg: -22,
        lonRadiusDeg: 15,
        latRadiusDeg: 6.5,
        stops: [
          { at: 0, color: '#b3452a', opacity: 1 },
          { at: 1, color: '#e0c39a', opacity: 0 },
        ],
        swirl: { turns: 2.2, color: '#8e3520', opacity: 0.35, width: 1.6 },
      },
    ],
  }

  it('jsdom(2Dコンテキストが無い環境)では例外を投げずnullを返す(rocky)', () => {
    expect(() => createSurfaceMaps(rockySurface)).not.toThrow()
    expect(createSurfaceMaps(rockySurface)).toEqual({ map: null, bumpMap: null })
  })

  it('jsdom(2Dコンテキストが無い環境)では例外を投げずnullを返す(gas)', () => {
    expect(() => createSurfaceMaps(gasSurface)).not.toThrow()
    expect(createSurfaceMaps(gasSurface)).toEqual({ map: null, bumpMap: null })
  })
})

describe('createCloudTexture', () => {
  it('jsdom(2Dコンテキストが無い環境)でも例外を投げない', () => {
    expect(() => createCloudTexture([])).not.toThrow()
    expect(createCloudTexture([])).toBeNull()
  })
})

describe('polarCapEdgeLatDeg', () => {
  const phases = [0.4, 1.9, 3.3]
  const edgeLatDeg = 79
  const raggednessDeg = 4.5

  it('経度-180と180は同じ縁の緯度になる(テクスチャの継ぎ目で段差ができない)', () => {
    expect(polarCapEdgeLatDeg(edgeLatDeg, raggednessDeg, phases, -180)).toBeCloseTo(
      polarCapEdgeLatDeg(edgeLatDeg, raggednessDeg, phases, 180),
      6,
    )
  })

  it('縁の揺らぎは raggednessDeg の範囲に収まる', () => {
    for (let lonDeg = -180; lonDeg <= 180; lonDeg += 1) {
      const latDeg = polarCapEdgeLatDeg(edgeLatDeg, raggednessDeg, phases, lonDeg)
      expect(Math.abs(latDeg - edgeLatDeg)).toBeLessThanOrEqual(raggednessDeg + 1e-9)
    }
  })

  it('隣り合う経度どうしの変化がなだらかで、放射状のトゲにならない', () => {
    // 経度1度あたりの縁の動きが大きいと、極付近で太陽のフレアのようなトゲに見えてしまう。
    // 低い周波数の正弦波の和で作っているため、変化量は必ず小さく収まる。
    let maxStepDeg = 0
    for (let lonDeg = -180; lonDeg < 180; lonDeg += 1) {
      const a = polarCapEdgeLatDeg(edgeLatDeg, raggednessDeg, phases, lonDeg)
      const b = polarCapEdgeLatDeg(edgeLatDeg, raggednessDeg, phases, lonDeg + 1)
      maxStepDeg = Math.max(maxStepDeg, Math.abs(a - b))
    }
    expect(maxStepDeg).toBeLessThan(raggednessDeg * 0.2)
  })

  it('raggednessDeg が0なら縁は完全な緯線になる', () => {
    expect(polarCapEdgeLatDeg(edgeLatDeg, 0, phases, 37)).toBeCloseTo(edgeLatDeg, 10)
  })
})
