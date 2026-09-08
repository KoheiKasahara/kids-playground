import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CIRCUIT, CIRCUITS } from './circuit'
import { RACE_CARS } from './raceConfig'
import { createMotionProfile, sampleMotion } from './motion'

const laneOffsets = [-3, 0, 3]

describe('circuit motion', () => {
  it('keeps every lane finite and equidistant around the lap', () => {
    for (const laneOffset of laneOffsets) {
      const profile = createMotionProfile(RACE_CARS[0], CIRCUIT.curve, laneOffset)
      const spacings = profile.samples.map((sample, index) => {
        const next = profile.samples[(index + 1) % profile.samples.length]
        return sample.position.distanceTo(next.position)
      })
      const average = spacings.reduce((sum, value) => sum + value, 0) / spacings.length
      expect(profile.length).toBeGreaterThan(500)
      expect(profile.length).toBeLessThan(800)
      expect(Math.max(...spacings) - Math.min(...spacings)).toBeLessThan(0.02)
      expect(average).toBeGreaterThan(0)
      for (const sample of profile.samples) {
        expect(sample.position.toArray().every(Number.isFinite)).toBe(true)
        expect(sample.tangent.length()).toBeCloseTo(1, 5)
        expect(Number.isFinite(sample.curvature)).toBe(true)
        expect(Number.isFinite(sample.speed)).toBe(true)
      }
    }
  })

  it('is periodic at the lap boundary', () => {
    const profile = createMotionProfile(RACE_CARS[1], CIRCUIT.curve, 0)
    const before = sampleMotion(profile, 3.25)
    const after = sampleMotion(profile, 3.25 + profile.duration)
    expect(after.distance).toBeCloseTo(before.distance, 9)
    expect(after.position.distanceTo(before.position)).toBeLessThan(1e-8)
    expect(after.tangent.distanceTo(before.tangent)).toBeLessThan(1e-8)
    expect(after.speed).toBeCloseTo(before.speed, 9)
  })

  it('obeys local top speed and acceleration/braking limits, including the seam', () => {
    const car = RACE_CARS[0]
    const profile = createMotionProfile(car, CIRCUIT.curve, 0)
    const spacing = profile.length / profile.samples.length
    for (let index = 0; index < profile.samples.length; index += 1) {
      const current = profile.samples[index]
      const next = profile.samples[(index + 1) % profile.samples.length]
      const cap = Math.min(car.maxSpeed, Math.sqrt(car.cornering / Math.max(current.curvature, 1e-8)))
      expect(current.speed).toBeLessThanOrEqual(cap + 1e-8)
      expect(next.speed ** 2 - current.speed ** 2).toBeLessThanOrEqual(2 * car.acceleration * spacing + 1e-6)
      expect(current.speed ** 2 - next.speed ** 2).toBeLessThanOrEqual(2 * car.braking * spacing + 1e-6)
    }
  })

  it('gives different cars different lap performance and anticipates bends', () => {
    const profiles = RACE_CARS.map((car) => createMotionProfile(car, CIRCUIT.curve, 0))
    expect(profiles[0].duration).toBeLessThan(profiles[2].duration)
    expect(Math.max(...profiles[0].samples.map((sample) => sample.speed))).toBeGreaterThan(
      Math.max(...profiles[2].samples.map((sample) => sample.speed)),
    )
    const sports = profiles[0]
    const slowest = sports.samples.reduce((slow, sample, index) =>
      sample.speed < slow.speed ? { speed: sample.speed, index } : slow,
    { speed: Number.POSITIVE_INFINITY, index: 0 })
    const hasAnticipatoryBraking = sports.samples.some((sample, index) => {
      const next = sports.samples[(index + 1) % sports.samples.length]
      const localCap = Math.min(sports.car.maxSpeed, Math.sqrt(sports.car.cornering / Math.max(sample.curvature, 1e-8)))
      return sample.speed < localCap - 0.01 && next.speed < sample.speed - 0.01
    })
    expect(hasAnticipatoryBraking).toBe(true)
    const before = sports.samples[(slowest.index + sports.samples.length - 20) % sports.samples.length]
    expect(before.speed).toBeGreaterThan(slowest.speed)
  })

  it('integrates distance from speed instead of depending on frame cadence', () => {
    const profile = createMotionProfile(RACE_CARS[0], CIRCUIT.curve, 3)
    const epsilon = 1e-4
    const elapsedTimes = [0, profile.duration * 0.37, profile.duration - epsilon]
    for (const elapsed of elapsedTimes) {
      const before = sampleMotion(profile, elapsed - epsilon)
      const at = sampleMotion(profile, elapsed)
      const after = sampleMotion(profile, elapsed + epsilon)
      let distanceDelta = after.distance - before.distance
      if (distanceDelta < -profile.length / 2) distanceDelta += profile.length
      if (distanceDelta > profile.length / 2) distanceDelta -= profile.length
      expect(distanceDelta / (2 * epsilon)).toBeCloseTo(at.speed, 3)
      expect(after.position.distanceTo(before.position) / (2 * epsilon)).toBeCloseTo(at.speed, 1)
      expect(at.position).toBeInstanceOf(THREE.Vector3)
    }
  })
})


describe('all selectable routes', () => {
  it.each(CIRCUITS)('$id supports every car and lane across a full lap', (course) => {
    for (const car of RACE_CARS) {
      for (const lane of laneOffsets) {
        const profile = createMotionProfile(car, course.curve, lane)
        expect(profile.duration).toBeGreaterThan(0)
        expect(Number.isFinite(profile.duration)).toBe(true)
        for (const sample of profile.samples) {
          expect(sample.position.toArray().every(Number.isFinite)).toBe(true)
          expect(sample.speed).toBeGreaterThan(0)
          expect(sample.speed).toBeLessThanOrEqual(car.maxSpeed + 1e-8)
        }
        const start = sampleMotion(profile, 0)
        expect(sampleMotion(profile, profile.duration).position.distanceTo(start.position)).toBeLessThan(1e-6)
      }
    }
  })

  it('makes the oval faster and the hairpin demand more braking', () => {
    const oval = createMotionProfile(RACE_CARS[0], CIRCUITS[1]!.curve, 0)
    const hairpin = createMotionProfile(RACE_CARS[0], CIRCUITS[3]!.curve, 0)
    expect(oval.length / oval.duration).toBeGreaterThan(hairpin.length / hairpin.duration)
    expect(Math.min(...oval.samples.map((s) => s.speed))).toBeGreaterThan(Math.min(...hairpin.samples.map((s) => s.speed)))
  })
})
