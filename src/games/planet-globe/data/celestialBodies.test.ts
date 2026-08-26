import { describe, expect, it } from 'vitest'
import { celestialBodies, celestialBodyById, DEFAULT_CELESTIAL_BODY_ID } from './celestialBodies'
import type { CelestialBodyId } from '../types'

/** '#rrggbb' のおおよその明るさ(0..255)。色の濃淡を比べるテストでだけ使う。 */
function relativeLuma(hexColor: string): number {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}


/** '#rrggbb' からおおまかな明るさ(0..255)を出す。縞のコントラスト比較に使う。 */
function luminanceOf(hexColor: string): number {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function averageAdjacentLuminanceDelta(stops: readonly { color: string }[]): number {
  let total = 0
  for (let i = 1; i < stops.length; i += 1) {
    total += Math.abs(luminanceOf(stops[i].color) - luminanceOf(stops[i - 1].color))
  }
  return total / (stops.length - 1)
}

describe('celestialBodies', () => {
  it('4天体が moon, mars, jupiter, saturn の順で存在する', () => {
    expect(celestialBodies.map((body) => body.id)).toEqual(['moon', 'mars', 'jupiter', 'saturn'])
  })

  it('id と displayName が重複しない', () => {
    const ids = celestialBodies.map((body) => body.id)
    const names = celestialBodies.map((body) => body.displayName)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(names).size).toBe(names.length)
  })

  it('celestialBodyById が対応する天体を返す', () => {
    for (const body of celestialBodies) {
      expect(celestialBodyById(body.id)).toBe(body)
    }
  })

  it('DEFAULT_CELESTIAL_BODY_ID は一覧に含まれる天体を指す', () => {
    expect(celestialBodies.some((body) => body.id === DEFAULT_CELESTIAL_BODY_ID)).toBe(true)
  })

  it('全天体で半径・ズーム倍率が妥当な範囲にある', () => {
    for (const body of celestialBodies) {
      expect(body.radius).toBeGreaterThan(0)
      expect(body.zoom.outMargin).toBeGreaterThanOrEqual(1.0)
      expect(body.zoom.inMargin).toBeGreaterThan(0)
      expect(body.zoom.inMargin).toBeLessThan(body.zoom.outMargin)
    }
  })

  it('全天体がlightingを持ち、主光がほかのどの光よりも強い', () => {
    for (const body of celestialBodies) {
      expect(body.lighting.keyIntensity).toBeGreaterThan(body.lighting.ambientIntensity)
      expect(body.lighting.keyIntensity).toBeGreaterThan(body.lighting.hemisphereIntensity)
      expect(body.lighting.keyIntensity).toBeGreaterThan(body.lighting.fillIntensity)
    }
  })

  it('全天体でzoom.outMarginがzoom.inMarginより大きい', () => {
    for (const body of celestialBodies) {
      expect(body.zoom.outMargin).toBeGreaterThan(body.zoom.inMargin)
    }
  })

  it('輪を持つのは土星だけ', () => {
    const ringBodyIds: CelestialBodyId[] = celestialBodies
      .filter((body) => body.ring !== undefined)
      .map((body) => body.id)
    expect(ringBodyIds).toEqual(['saturn'])
  })

  it('全patches/craters/spotsのidがゲーム内で一意である(Phase 3でキーに使えること)', () => {
    const ids: string[] = []
    for (const body of celestialBodies) {
      if (body.surface.style === 'rocky') {
        for (const patch of body.surface.patches) ids.push(patch.id)
        for (const crater of body.surface.craters) {
          if (crater.id !== undefined) ids.push(crater.id)
        }
      } else {
        for (const spot of body.surface.spots) ids.push(spot.id)
      }
    }
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('moon', () => {
  const moon = celestialBodyById('moon')

  it('surfaceはrockyスタイルである', () => {
    expect(moon.surface.style).toBe('rocky')
  })

  it('mare-で始まるpatchesが5件以上ある', () => {
    if (moon.surface.style !== 'rocky') throw new Error('unreachable')
    const mares = moon.surface.patches.filter((patch) => patch.id.startsWith('mare-'))
    expect(mares.length).toBeGreaterThanOrEqual(5)
  })

  it('cratersにtychoがあり、raysを持つ', () => {
    if (moon.surface.style !== 'rocky') throw new Error('unreachable')
    const tycho = moon.surface.craters.find((crater) => crater.id === 'tycho')
    expect(tycho).toBeDefined()
    expect(tycho?.rays).toBeDefined()
  })

  it('scatteredCraters.countが150以上である', () => {
    if (moon.surface.style !== 'rocky') throw new Error('unreachable')
    expect(moon.surface.scatteredCraters.count).toBeGreaterThanOrEqual(150)
  })
})

describe('mars', () => {
  const mars = celestialBodyById('mars')

  it('surfaceはrockyスタイルで、polarCapsを持つ', () => {
    expect(mars.surface.style).toBe('rocky')
    if (mars.surface.style !== 'rocky') throw new Error('unreachable')
    expect(mars.surface.polarCaps).toBeDefined()
  })

  it('北極冠・南極冠の緯度が正しい符号である', () => {
    if (mars.surface.style !== 'rocky') throw new Error('unreachable')
    const caps = mars.surface.polarCaps
    expect(caps).toBeDefined()
    if (caps === undefined) return
    expect(caps.northEdgeLatDeg).toBeGreaterThan(0)
    expect(caps.southEdgeLatDeg).toBeLessThan(0)
  })

  it('olympus-mons・valles-marineris・hellas-planitiaが存在し、経緯度が範囲内である', () => {
    if (mars.surface.style !== 'rocky') throw new Error('unreachable')
    for (const id of ['olympus-mons', 'valles-marineris', 'hellas-planitia']) {
      const patch = mars.surface.patches.find((p) => p.id === id)
      expect(patch, `${id} が存在しない`).toBeDefined()
      if (patch === undefined) continue
      expect(patch.lonDeg).toBeGreaterThanOrEqual(-180)
      expect(patch.lonDeg).toBeLessThanOrEqual(180)
      expect(patch.latDeg).toBeGreaterThanOrEqual(-90)
      expect(patch.latDeg).toBeLessThanOrEqual(90)
    }
  })

  it('地色より明確に暗いアルベド地形が4件以上ある(単色の赤い球にならない)', () => {
    if (mars.surface.style !== 'rocky') throw new Error('unreachable')
    const baseLuma = relativeLuma(mars.surface.baseColor)
    const darkPatches = mars.surface.patches.filter(
      (patch) => relativeLuma(patch.color) < baseLuma * 0.72 && patch.opacity >= 0.6,
    )
    expect(darkPatches.length).toBeGreaterThanOrEqual(4)
  })

  it('初期表示の正面(経度-85付近)の±60度に、暗いアルベド地形が2件以上ある', () => {
    // 初期姿勢が明るい高地ばかりの面だと「ただの赤い球」に見えてしまうため、
    // 最初から地表の模様が分かる面を向いていることを回帰テストで保証する。
    if (mars.surface.style !== 'rocky') throw new Error('unreachable')
    const baseLuma = relativeLuma(mars.surface.baseColor)
    const facingLonDeg = -85
    const visible = mars.surface.patches.filter((patch) => {
      const deltaDeg = Math.abs(((patch.lonDeg - facingLonDeg + 540) % 360) - 180)
      return deltaDeg <= 60 && relativeLuma(patch.color) < baseLuma * 0.72
    })
    expect(visible.length).toBeGreaterThanOrEqual(2)
  })
})

describe('jupiter', () => {
  const jupiter = celestialBodyById('jupiter')

  it('surfaceはgasスタイルである', () => {
    expect(jupiter.surface.style).toBe('gas')
  })

  it('beltsが18点以上ある', () => {
    if (jupiter.surface.style !== 'gas') throw new Error('unreachable')
    expect(jupiter.surface.belts.length).toBeGreaterThanOrEqual(18)
  })

  it('great-red-spotがあり、緯度が-30..-14の範囲、見かけの経度直径が24度以上ある', () => {
    if (jupiter.surface.style !== 'gas') throw new Error('unreachable')
    const spot = jupiter.surface.spots.find((s) => s.id === 'great-red-spot')
    expect(spot).toBeDefined()
    if (spot === undefined) return
    expect(spot.latDeg).toBeGreaterThanOrEqual(-30)
    expect(spot.latDeg).toBeLessThanOrEqual(-14)
    expect(spot.lonRadiusDeg * 2).toBeGreaterThanOrEqual(24)
  })

  it('material.bumpScaleが未設定である(岩石質感にしない)', () => {
    expect(jupiter.material.bumpScale).toBeUndefined()
  })
})

describe('saturn', () => {
  const saturn = celestialBodyById('saturn')

  it('ringを持ち、segmentsが3件以上ある', () => {
    expect(saturn.ring).toBeDefined()
    expect(saturn.ring?.segments.length).toBeGreaterThanOrEqual(3)
  })

  it('セグメントが内側から外側の順に並び、半径方向に重ならない', () => {
    const segments = saturn.ring?.segments
    expect(segments).toBeDefined()
    if (segments === undefined) return

    const sorted = [...segments].sort((a, b) => a.innerRadiusRatio - b.innerRadiusRatio)
    expect(segments.map((s) => s.id)).toEqual(sorted.map((s) => s.id))
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].innerRadiusRatio).toBeGreaterThanOrEqual(sorted[i - 1].outerRadiusRatio)
    }
  })

  it('隣接セグメント間に0.03以上のすき間が1箇所以上ある(カッシーニ間隙)', () => {
    const segments = saturn.ring?.segments
    expect(segments).toBeDefined()
    if (segments === undefined) return

    const sorted = [...segments].sort((a, b) => a.innerRadiusRatio - b.innerRadiusRatio)
    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i += 1) {
      gaps.push(sorted[i].innerRadiusRatio - sorted[i - 1].outerRadiusRatio)
    }
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(0.03)
  })

  it('beltsの隣接stopの明度差が木星より小さい(穏やかな縞)', () => {
    const jupiter = celestialBodyById('jupiter')
    if (jupiter.surface.style !== 'gas' || saturn.surface.style !== 'gas') {
      throw new Error('unreachable')
    }
    const jupiterDelta = averageAdjacentLuminanceDelta(jupiter.surface.belts)
    const saturnDelta = averageAdjacentLuminanceDelta(saturn.surface.belts)
    expect(saturnDelta).toBeLessThan(jupiterDelta)
  })
})
