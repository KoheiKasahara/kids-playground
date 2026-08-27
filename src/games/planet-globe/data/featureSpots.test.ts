import { describe, expect, it } from 'vitest'
import { celestialBodies, celestialBodyById } from './celestialBodies'
import { featureSpotsByBodyId, featureSpotsFor } from './featureSpots'
import type { CelestialBodyId, FeatureSpot } from '../types'

const allSpots: FeatureSpot[] = celestialBodies.flatMap((body) => [...featureSpotsFor(body.id)])

function spotById(id: string): FeatureSpot {
  const spot = allSpots.find((candidate) => candidate.id === id)
  if (spot === undefined) throw new Error(`spot not found: ${id}`)
  return spot
}

describe('featureSpotsByBodyId', () => {
  it('全天体に2個以上のスポットがある', () => {
    for (const body of celestialBodies) {
      expect(featureSpotsFor(body.id).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('featureSpotsFor は同じ天体に常に同じ配列インスタンスを返す', () => {
    for (const body of celestialBodies) {
      expect(featureSpotsFor(body.id)).toBe(featureSpotsFor(body.id))
    }
  })

  it('idが全天体を通じて一意', () => {
    const ids = allSpots.map((spot) => spot.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('displayName・description・accentColorが空でない', () => {
    for (const spot of allSpots) {
      expect(spot.displayName.length).toBeGreaterThan(0)
      expect(spot.description.length).toBeGreaterThan(0)
      expect(spot.accentColor.length).toBeGreaterThan(0)
    }
  })

  it('descriptionは40文字以下、句点「。」は2つ以下(幼児向けの短文を守る回帰テスト)', () => {
    for (const spot of allSpots) {
      expect(spot.description.length).toBeLessThanOrEqual(40)
      expect(spot.description.split('。').length - 1).toBeLessThanOrEqual(2)
    }
  })

  it('hitRadiusPxは30以上(幼児でも押せる大きさの下限)', () => {
    for (const spot of allSpots) {
      expect(spot.hitRadiusPx).toBeGreaterThanOrEqual(30)
    }
  })

  it('surfaceスポットのlatDeg/lonDegは有効な範囲に収まる', () => {
    for (const spot of allSpots) {
      if (spot.target.kind !== 'surface') continue
      expect(spot.target.latDeg).toBeGreaterThanOrEqual(-90)
      expect(spot.target.latDeg).toBeLessThanOrEqual(90)
      expect(spot.target.lonDeg).toBeGreaterThanOrEqual(-180)
      expect(spot.target.lonDeg).toBeLessThanOrEqual(180)
    }
  })

  it('ringスポットはbody.ringを持つ天体にしか無い', () => {
    for (const body of celestialBodies) {
      const hasRingSpot = featureSpotsFor(body.id).some((spot) => spot.target.kind === 'ring')
      if (hasRingSpot) expect(body.ring).not.toBeUndefined()
    }
  })

  it('ringスポットのhighlightSegmentIdsは実在するRingSegment.idを指す', () => {
    const saturn = celestialBodyById('saturn')
    const segmentIds = new Set((saturn.ring?.segments ?? []).map((segment) => segment.id))

    for (const spot of featureSpotsFor('saturn')) {
      if (spot.target.kind !== 'ring') continue
      for (const id of spot.target.highlightSegmentIds ?? []) {
        expect(segmentIds.has(id)).toBe(true)
      }
    }
  })

  it('代表スポットが存在する', () => {
    expect(spotById('jupiter-great-red-spot')).toBeDefined()
    expect(spotById('mars-olympus-mons')).toBeDefined()
    expect(spotById('saturn-rings')).toBeDefined()
  })

  describe('Phase 2の描画位置との一致(表示位置とタップ位置がずれたら落ちる回帰テスト)', () => {
    function surfaceTargetOf(spot: FeatureSpot): { lonDeg: number; latDeg: number } {
      if (spot.target.kind !== 'surface') throw new Error(`not a surface spot: ${spot.id}`)
      return spot.target
    }

    it('jupiter-great-red-spot は great-red-spot(GasSpot)と同じ経緯度', () => {
      const jupiter = celestialBodyById('jupiter')
      if (jupiter.surface.style !== 'gas') throw new Error('jupiter surface should be gas')
      const greatRedSpot = jupiter.surface.spots.find((spot) => spot.id === 'great-red-spot')
      if (greatRedSpot === undefined) throw new Error('great-red-spot not found')

      const target = surfaceTargetOf(spotById('jupiter-great-red-spot'))
      expect(target.lonDeg).toBe(greatRedSpot.lonDeg)
      expect(target.latDeg).toBe(greatRedSpot.latDeg)
    })

    it('mars-olympus-mons は olympus-mons(SurfacePatch)と同じ経緯度', () => {
      const mars = celestialBodyById('mars')
      if (mars.surface.style !== 'rocky') throw new Error('mars surface should be rocky')
      const olympusMons = mars.surface.patches.find((patch) => patch.id === 'olympus-mons')
      if (olympusMons === undefined) throw new Error('olympus-mons not found')

      const target = surfaceTargetOf(spotById('mars-olympus-mons'))
      expect(target.lonDeg).toBe(olympusMons.lonDeg)
      expect(target.latDeg).toBe(olympusMons.latDeg)
    })

    it('mars-valles-marineris は valles-marineris(SurfacePatch)と同じ経緯度', () => {
      const mars = celestialBodyById('mars')
      if (mars.surface.style !== 'rocky') throw new Error('mars surface should be rocky')
      const vallesMarineris = mars.surface.patches.find((patch) => patch.id === 'valles-marineris')
      if (vallesMarineris === undefined) throw new Error('valles-marineris not found')

      const target = surfaceTargetOf(spotById('mars-valles-marineris'))
      expect(target.lonDeg).toBe(vallesMarineris.lonDeg)
      expect(target.latDeg).toBe(vallesMarineris.latDeg)
    })

    it('moon-crater は tycho(SurfaceCrater)と同じ経緯度', () => {
      const moon = celestialBodyById('moon')
      if (moon.surface.style !== 'rocky') throw new Error('moon surface should be rocky')
      const tycho = moon.surface.craters.find((crater) => crater.id === 'tycho')
      if (tycho === undefined) throw new Error('tycho not found')

      const target = surfaceTargetOf(spotById('moon-crater'))
      expect(target.lonDeg).toBe(tycho.lonDeg)
      expect(target.latDeg).toBe(tycho.latDeg)
    })

    it('moon-mare は mare-tranquillitatis(SurfacePatch)と同じ経緯度', () => {
      const moon = celestialBodyById('moon')
      if (moon.surface.style !== 'rocky') throw new Error('moon surface should be rocky')
      const mare = moon.surface.patches.find((patch) => patch.id === 'mare-tranquillitatis')
      if (mare === undefined) throw new Error('mare-tranquillitatis not found')

      const target = surfaceTargetOf(spotById('moon-mare'))
      expect(target.lonDeg).toBe(mare.lonDeg)
      expect(target.latDeg).toBe(mare.latDeg)
    })
  })

  it('featureSpotsByBodyIdは11天体すべてのキーを持つ', () => {
    const ids: CelestialBodyId[] = [
      'sun',
      'mercury',
      'venus',
      'earth',
      'moon',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'pluto',
    ]
    for (const id of ids) {
      expect(featureSpotsByBodyId[id]).toBeDefined()
      expect(featureSpotsByBodyId[id].length).toBeGreaterThanOrEqual(2)
    }
  })

  it('地球だけは他天体より特徴スポットが多い(大陸・海・極・大気をあつかうため)', () => {
    const earthCount = featureSpotsFor('earth').length
    for (const body of celestialBodies) {
      if (body.id === 'earth') continue
      expect(earthCount).toBeGreaterThan(featureSpotsFor(body.id).length)
    }
  })

  it('地球の大陸・海のスポットは、幼児が一点を正確に押さなくても反応する大きめのhitRadiusPxを持つ', () => {
    for (const id of ['continent-asia', 'ocean-pacific', 'continent-africa'] as const) {
      expect(spotById(id).hitRadiusPx).toBeGreaterThanOrEqual(44)
    }
  })

  it('天王星のリングスポットはbody.ringのセグメントを指す', () => {
    const uranus = celestialBodyById('uranus')
    const segmentIds = new Set((uranus.ring?.segments ?? []).map((segment) => segment.id))
    for (const spot of featureSpotsFor('uranus')) {
      if (spot.target.kind !== 'ring') continue
      for (const id of spot.target.highlightSegmentIds ?? []) {
        expect(segmentIds.has(id)).toBe(true)
      }
    }
  })
})
