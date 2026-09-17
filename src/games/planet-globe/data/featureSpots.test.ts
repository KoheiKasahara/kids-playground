import { describe, expect, it } from 'vitest'
import { celestialBodies, celestialBodyById } from './celestialBodies'
import { featureSpotsByBodyId, featureSpotsFor } from './featureSpots'
import type { CelestialBody, CelestialBodyId, FeatureSpot } from '../types'

const allSpots: FeatureSpot[] = celestialBodies.flatMap((body) => [...featureSpotsFor(body.id)])

function spotById(id: string): FeatureSpot {
  const spot = allSpots.find((candidate) => candidate.id === id)
  if (spot === undefined) throw new Error(`spot not found: ${id}`)
  return spot
}

function surfaceTargetOf(spot: FeatureSpot): { lonDeg: number; latDeg: number } {
  if (spot.target.kind !== 'surface') throw new Error(`not a surface spot: ${spot.id}`)
  return spot.target
}

/**
 * 描画データ(模様・クレーター・ガス惑星の渦・雲レイヤー)の中から id で経緯度を引く。
 * 「テクスチャに描かれた位置」と「タップで反応する位置」が一致しているかの検証に使う。
 */
function visualPositionOf(body: CelestialBody, visualId: string): { lonDeg: number; latDeg: number } {
  const candidates =
    body.surface.style === 'gas'
      ? [...body.surface.spots]
      : [...body.surface.patches, ...body.surface.craters]
  const found = [...candidates, ...(body.visual?.clouds?.patches ?? [])].find(
    (candidate) => candidate.id === visualId,
  )
  if (found === undefined) throw new Error(`visual not found: ${body.id}/${visualId}`)
  return { lonDeg: found.lonDeg, latDeg: found.latDeg }
}

/** 2つの経緯度の球面角(度)。マーカーどうしが画面上で重ならないかの判定に使う。 */
function angularSeparationDeg(
  a: { lonDeg: number; latDeg: number },
  b: { lonDeg: number; latDeg: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const cosine =
    Math.sin(toRad(a.latDeg)) * Math.sin(toRad(b.latDeg)) +
    Math.cos(toRad(a.latDeg)) * Math.cos(toRad(b.latDeg)) * Math.cos(toRad(a.lonDeg - b.lonDeg))
  return (Math.acos(Math.min(1, Math.max(-1, cosine))) * 180) / Math.PI
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

  it('descriptionが displayName の言いかえだけで終わっていない(理由か数量を含める)', () => {
    for (const spot of allSpots) {
      expect(spot.description).not.toBe(`${spot.displayName}だよ。`)
      expect(spot.description.length).toBeGreaterThan(spot.displayName.length)
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

  /**
   * デフォルトズームでは天体が画面の短辺いっぱいに映るので、球面角30°はおよそ画面上85px。
   * `hitRadiusPx` は最大でも52なので、30°あけておけば当たり判定どうしが重ならない。
   * これを下回ると幼児がマーカーを狙って押し分けられなくなる。
   */
  it('同じ天体のsurfaceスポットどうしは球面角で30°以上はなれている', () => {
    for (const body of celestialBodies) {
      const targets = featureSpotsFor(body.id)
        .filter((spot) => spot.target.kind === 'surface')
        .map((spot) => ({ id: spot.id, ...surfaceTargetOf(spot) }))

      for (let i = 0; i < targets.length; i += 1) {
        for (let j = i + 1; j < targets.length; j += 1) {
          const separation = angularSeparationDeg(targets[i]!, targets[j]!)
          expect(
            separation,
            `${body.id}: ${targets[i]!.id} と ${targets[j]!.id} が ${separation.toFixed(1)}° しかはなれていない`,
          ).toBeGreaterThanOrEqual(30)
        }
      }
    }
  })

  it('同じ天体のringスポットどうしは輪の上で位置がかぶらない', () => {
    for (const body of celestialBodies) {
      const targets = featureSpotsFor(body.id).flatMap((spot) =>
        spot.target.kind === 'ring' ? [{ id: spot.id, ...spot.target }] : [],
      )

      for (let i = 0; i < targets.length; i += 1) {
        for (let j = i + 1; j < targets.length; j += 1) {
          const angleGap = Math.abs(targets[i]!.angleDeg - targets[j]!.angleDeg)
          expect(
            Math.min(angleGap, 360 - angleGap),
            `${body.id}: ${targets[i]!.id} と ${targets[j]!.id} が輪の上で近すぎる`,
          ).toBeGreaterThanOrEqual(45)
        }
      }
    }
  })

  it('ringスポットはbody.ringを持つ天体にしか無い', () => {
    for (const body of celestialBodies) {
      const hasRingSpot = featureSpotsFor(body.id).some((spot) => spot.target.kind === 'ring')
      if (hasRingSpot) expect(body.ring).not.toBeUndefined()
    }
  })

  it('ringスポットのradiusRatio・highlightSegmentIdsは実在するRingSegmentを指す', () => {
    for (const body of celestialBodies) {
      const segments = body.ring?.segments ?? []
      const segmentIds = new Set(segments.map((segment) => segment.id))

      for (const spot of featureSpotsFor(body.id)) {
        if (spot.target.kind !== 'ring') continue
        for (const id of spot.target.highlightSegmentIds ?? []) {
          expect(segmentIds.has(id)).toBe(true)
        }
        // マーカーはどこかの帯の上に乗せる(帯と帯の外側に浮かせない)。
        const onSegment = segments.some(
          (segment) =>
            spot.target.kind === 'ring' &&
            spot.target.radiusRatio >= segment.innerRadiusRatio &&
            spot.target.radiusRatio <= segment.outerRadiusRatio,
        )
        const inGap =
          spot.target.highlightRadiusBand !== undefined &&
          spot.target.radiusRatio >= spot.target.highlightRadiusBand.innerRatio &&
          spot.target.radiusRatio <= spot.target.highlightRadiusBand.outerRatio
        expect(onSegment || inGap, `${spot.id} が輪の外に浮いている`).toBe(true)
      }
    }
  })

  it('代表スポットが存在する', () => {
    expect(spotById('jupiter-great-red-spot')).toBeDefined()
    expect(spotById('mars-olympus-mons')).toBeDefined()
    expect(spotById('saturn-rings')).toBeDefined()
  })

  it('それぞれの天体で「いちばん大事な1つ」の説明が抜けていない', () => {
    // 幼児がまず覚える事実。データを整理するときに落としやすいので固定する。
    expect(spotById('jupiter-largest').description).toContain('いちばん おおきい')
    expect(spotById('neptune-farthest').description).toContain('いちばん とおい')
    expect(spotById('mercury-closest').description).toContain('いちばん ちかく')
    expect(spotById('pluto-dwarf').description).toContain('じゅんわくせい')
    expect(spotById('venus-hottest').description).toContain('あつく')
  })

  describe('Phase 2の描画位置との一致(表示位置とタップ位置がずれたら落ちる回帰テスト)', () => {
    /**
     * 「見えている模様」に紐づくスポットは、その模様と同じ経緯度を使う。
     * ここに無いスポット(太陽の大きさ・月の重力など)は指せる模様が存在しない
     * 天体ぜんたいの話で、模様から離れた無地の面へ置いている。
     */
    const anchoredSpots = [
      ['sun', 'sun-sunspot', 'sunspot-a'],
      ['sun', 'sun-sunspot-b', 'sunspot-b'],
      ['mercury', 'mercury-craters', 'mercury-crater-a'],
      ['mercury', 'mercury-caloris', 'caloris-basin'],
      ['mercury', 'mercury-no-air', 'mercury-crater-c'],
      ['mercury', 'mercury-hot-cold', 'mercury-crater-b'],
      ['venus', 'venus-clouds', 'venus-cloud-band'],
      ['earth', 'earth-clouds', 'earth-cloud-layer-a'],
      ['moon', 'moon-mare', 'mare-tranquillitatis'],
      ['moon', 'moon-procellarum', 'oceanus-procellarum'],
      ['moon', 'moon-crater', 'tycho'],
      ['moon', 'moon-far-side', 'far-side-crater-a'],
      ['moon', 'moon-no-air', 'plato'],
      ['mars', 'mars-red', 'arabia-terra'],
      ['mars', 'mars-olympus-mons', 'olympus-mons'],
      ['mars', 'mars-valles-marineris', 'valles-marineris'],
      ['mars', 'mars-syrtis', 'syrtis-major'],
      ['mars', 'mars-hellas', 'hellas-planitia'],
      ['jupiter', 'jupiter-great-red-spot', 'great-red-spot'],
      ['jupiter', 'jupiter-white-oval', 'white-oval-a'],
      ['jupiter', 'jupiter-fast-spin', 'brown-barge'],
      ['uranus', 'uranus-storm', 'uranus-storm'],
      ['neptune', 'neptune-storm', 'great-dark-spot'],
      ['neptune', 'neptune-winds', 'neptune-bright-cloud'],
      ['pluto', 'pluto-tombaugh', 'tombaugh-regio-west'],
      ['pluto', 'pluto-dark', 'dark-terrain'],
      ['pluto', 'pluto-dwarf', 'pluto-crater-a'],
    ] as const

    it.each(anchoredSpots)('%s: %s は %s と同じ経緯度', (bodyId, featureSpotId, visualId) => {
      const visual = visualPositionOf(celestialBodyById(bodyId), visualId)
      const target = surfaceTargetOf(spotById(featureSpotId))
      expect(target.lonDeg).toBe(visual.lonDeg)
      expect(target.latDeg).toBe(visual.latDeg)
    })

    it('地球の雲スポットは地表と同じ速さで回る雲レイヤーに乗っている', () => {
      const earth = celestialBodyById('earth')
      expect(earth.visual?.clouds?.spinSpeed).toBe(earth.spinSpeed)
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

  it('地球いがいの天体も5個以上のスポットを持つ(1天体3個では特徴を伝えきれないため)', () => {
    for (const body of celestialBodies) {
      if (body.id === 'earth') continue
      expect(featureSpotsFor(body.id).length).toBeGreaterThanOrEqual(5)
    }
  })

  it('地球の大陸・海のスポットは、幼児が一点を正確に押さなくても反応する大きめのhitRadiusPxを持つ', () => {
    for (const id of ['continent-asia', 'ocean-pacific', 'continent-africa'] as const) {
      expect(spotById(id).hitRadiusPx).toBeGreaterThanOrEqual(44)
    }
  })
})
