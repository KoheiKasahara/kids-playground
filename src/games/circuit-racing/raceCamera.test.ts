import { Box3, PerspectiveCamera, Raycaster, Vector3 } from 'three'
import { CIRCUIT, CIRCUITS } from './circuit'
import { createCircuitScenery } from './scenery'
import { createMotionProfile, sampleMotion } from './motion'
import { RACE_CARS } from './raceConfig'
import { describe, expect, test } from 'vitest'
import { chaseCameraPose, tracksideCameraPose, overviewCameraPose, createTracksideAnchors, selectTracksideAnchor } from './raceCamera'

describe('サーキットレースの カメラ計算', () => {
  test('おいかけるカメラは車のうしろ、見る先は車のまえになる', () => {
    const pose = chaseCameraPose({ x: 10, y: 0, z: 20 }, { x: 0, z: 1 })
    expect(pose.position.x).toBeCloseTo(10)
    expect(pose.position.z).toBeCloseTo(11)
    expect(pose.position.y).toBeGreaterThan(0)
    expect(pose.target.z).toBeGreaterThan(20)
  })

  test('向きが変わっても追いかける位置は接線のうしろになる', () => {
    const pose = chaseCameraPose({ x: 0, y: 0, z: 0 }, { x: 1, z: 0 }, { distance: 6, lookAhead: 4 })
    expect(pose.position.x).toBeCloseTo(-6)
    expect(pose.position.z).toBeCloseTo(0)
    expect(pose.target.x).toBeCloseTo(4)
  })

  test('みちばたカメラは場所を固定し、対象だけを追う', () => {
    const first = tracksideCameraPose({ x: 12, y: 0, z: 8 }, { x: 0, y: 0, z: 0 })
    const second = tracksideCameraPose({ x: 12, y: 0, z: 8 }, { x: 30, y: 0, z: -20 })
    expect(first.position).toEqual({ x: 12, y: 4.6, z: 8 })
    expect(second.position).toEqual(first.position)
    expect(second.target).not.toEqual(first.target)
  })

  test('ゼロ長の接線でもNaNを返さない', () => {
    const pose = chaseCameraPose({ x: 0, y: 0, z: 0 }, { x: 0, z: 0 })
    expect(Object.values(pose.position).every(Number.isFinite)).toBe(true)
    expect(Object.values(pose.target).every(Number.isFinite)).toBe(true)
  })
})

describe('全体表示のフレーミング', () => {
  test.each([0.45, 0.8, 1, 2.2])('画面比率 %s で道路全体が余白つきで収まる', (aspect) => {
    const bounds = new Box3().setFromPoints(CIRCUIT.curve.getPoints(1024)).expandByScalar(CIRCUIT.width / 2 + 1)
    const pose = overviewCameraPose(bounds, aspect)
    const camera = new PerspectiveCamera(48, aspect, 2, 2000)
    camera.position.set(pose.position.x, pose.position.y, pose.position.z)
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z)
    camera.updateMatrixWorld()
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const projected = new Vector3(x, 0, z).project(camera)
        expect(Math.abs(projected.x)).toBeLessThan(0.95)
        expect(Math.abs(projected.y)).toBeLessThan(0.95)
        expect(Math.abs(projected.z)).toBeLessThan(1)
      }
    }
  })
})

describe('みちばたの自動切り替え', () => {
  test('半周の境界と周回でだけ切り替え、車やモードの選び直しでも同じ区間を使う', () => {
    for (const [progress, expected] of [[0, 0], [0.4999, 0], [0.5, 1], [0.9999, 1], [1, 0], [1.5, 1], [-0.1, 1], [NaN, 0]]) {
      expect(selectTracksideAnchor(progress)).toBe(expected)
    }
  })

  test.each(CIRCUITS)('$id は周回をまたいで2か所だけを半周ごとに使う', (circuit) => {
    const anchors = createTracksideAnchors(circuit.curve, circuit.width)
    let selected = -1
    let cuts = 0
    const used = new Set<number>()
    for (let step = 0; step <= 2048; step++) {
      const point = circuit.curve.getPointAt((step % 1024) / 1024)
      const next = selectTracksideAnchor((step % 1024) / 1024)
      if (selected !== -1 && next !== selected) cuts++
      selected = next
      used.add(selected)
      const pose = tracksideCameraPose(anchors[selected], point)
      expect(Math.hypot(pose.position.x - point.x, pose.position.z - point.z)).toBeLessThan(320)
      expect(pose.position.y).toBeGreaterThan(20)
    }
    expect(anchors).toHaveLength(2)
    expect(used.size).toBe(2)
    expect(cuts).toBe(4)
  })

  test.each(CIRCUITS)('$id は実際の走行ラインでも各半周を同じ位置から見続ける', (circuit) => {
    for (const lane of [-3, 0, 3]) {
      const profile = createMotionProfile(RACE_CARS[0], circuit.curve, lane)
      const anchors = createTracksideAnchors(circuit.curve, circuit.width)
      let previous = 0
      const cuts: number[] = []
      for (let step = 0; step <= 2048; step++) {
        const elapsed = profile.duration * step / 1024
        const sample = sampleMotion(profile, elapsed)
        const index = selectTracksideAnchor(sample.distance / profile.length)
        if (index !== previous) cuts.push(elapsed)
        previous = index
        // Avoid a near-vertical view that spins as the car passes underneath.
        expect(Math.hypot(anchors[index].x - sample.position.x, anchors[index].z - sample.position.z)).toBeGreaterThan(25)
        expect(tracksideCameraPose(anchors[index], sample.position).position).toEqual({
          x: anchors[index].x, y: anchors[index].y! + 4.6, z: anchors[index].z,
        })
      }
      expect(cuts).toHaveLength(4)
      for (let index = 1; index < cuts.length; index++) {
        expect(cuts[index] - cuts[index - 1]).toBeGreaterThan(5)
      }
    }
  })

  test.each(CIRCUITS)('$id は構造物の多い区間でも周回の大部分で見通しを確保する', (circuit) => {
    const scenery = createCircuitScenery(circuit)
    scenery.group.updateMatrixWorld(true)
    const anchors = createTracksideAnchors(circuit.curve, circuit.width)
    const t = Math.floor(192 * 0.28) / 192
    const oldPoint = circuit.curve.getPointAt(t)
    const oldTangent = circuit.curve.getPointAt((Math.floor(192 * 0.28) + 1) / 192)
      .sub(circuit.curve.getPointAt((Math.floor(192 * 0.28) - 1) / 192)).normalize()
    const oldAnchor = { x: oldPoint.x - oldTangent.z * (circuit.width / 2 + 8), y: 8,
      z: oldPoint.z + oldTangent.x * (circuit.width / 2 + 8) }
    const ray = new Raycaster()
    let blocked = 0
    let oldBlocked = 0
    try {
      for (let step = 0; step < 96; step++) {
        const point = circuit.curve.getPointAt(step / 96)
        const selected = selectTracksideAnchor(step / 96)
        for (const [index, anchor] of [anchors[selected], oldAnchor].entries()) {
          const pose = tracksideCameraPose(anchor, point)
          const origin = new Vector3(pose.position.x, pose.position.y, pose.position.z)
          const direction = new Vector3(pose.target.x, pose.target.y, pose.target.z).sub(origin)
          ray.far = direction.length() - 0.5
          ray.set(origin, direction.normalize())
          if (ray.intersectObject(scenery.group, true).length > 0) {
            if (index === 0) blocked++
            else oldBlocked++
          }
        }
      }
      // Open ovals already have few obstructions; other courses must improve.
      expect(blocked).toBeLessThanOrEqual(oldBlocked)
      if (circuit.scenery !== 'stadium') expect(blocked).toBeLessThan(oldBlocked)
      expect(blocked).toBeLessThanOrEqual(10)
    } finally {
      scenery.dispose()
    }
  })
})
