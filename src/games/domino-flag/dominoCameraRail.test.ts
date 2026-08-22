import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CAMERA_FOV, cameraDistanceOf, computeCameraSetup } from './dominoCamera'
import { createBigCourse, createDominoCourse } from './dominoCourse'
import { FLAG_COLS, FLAG_PITCH_X, getLayoutBounds } from './dominoLayout'
import {
  advanceRailProgress,
  APPROACH_CAMERA_DISTANCE,
  APPROACH_MIN_HALF_WIDTH,
  approachCameraDistanceFor,
  buildBigCameraRail,
  buildLongCameraRail,
  CAMERA_BLEND_APPROACH_COUNT,
  CAMERA_PROGRESS_TILT_RAD,
  cameraPositionFor,
  dampFactor,
  sampleCameraRail,
  wideCameraPoseFor,
} from './dominoCameraRail'

const FRAME_MARGIN = 0.85
const RAIL_MOVEMENT_LIMIT = 70
const LONG_CAMERA_FAR = 150
// アンカー区間の内部のピークを取りこぼさないよう、進行度を4000分割して測る。
const RAIL_SAMPLE_COUNT = 4000

function createRail(aspect: number, reducedMotion = false) {
  const course = createDominoCourse('long', 'jp')
  const flagSetup = computeCameraSetup(course.flagCameraBounds, aspect)
  const wideCamera = wideCameraPoseFor(getLayoutBounds(course.placements), aspect)
  return {
    course,
    flagSetup,
    wideCamera,
    rail: buildLongCameraRail(
      course.cameraApproachPath,
      {
        target: flagSetup.target,
        distance: cameraDistanceOf(flagSetup),
      },
      {
        reducedMotion,
        approachDistance: approachCameraDistanceFor(aspect),
        cameraProgressCount: course.cameraProgressCount,
        wideCamera,
      },
    ),
  }
}

function projectWorldPoint(
  aspect: number,
  pose: { target: { x: number; y: number; z: number }; distance: number },
  point: { x: number; y: number; z: number },
): THREE.Vector3 {
  const camera = cameraForPose(aspect, pose)
  return new THREE.Vector3(point.x, point.y, point.z).project(camera)
}

function cameraForPose(
  aspect: number,
  pose: { target: { x: number; y: number; z: number }; distance: number },
): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 0.1, LONG_CAMERA_FAR)
  const position = cameraPositionFor(pose.target, pose.distance)
  camera.position.set(position.x, position.y, position.z)
  camera.lookAt(pose.target.x, pose.target.y, pose.target.z)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return camera
}

function groundPointForNdc(
  camera: THREE.PerspectiveCamera,
  x: number,
  y: number,
): THREE.Vector3 {
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const intersection = raycaster.ray.intersectPlane(ground, new THREE.Vector3())
  if (!intersection) throw new Error('画面レイが地面と交差しません')
  return intersection
}

function worstFrameNdc(aspect: number, reducedMotion: boolean, lag: number) {
  const { course, rail } = createRail(aspect, reducedMotion)
  const cameraProgressPoints = [
    ...course.cameraApproachPath.map((point) => ({ x: point.x, z: point.z })),
    ...course.placements
      .slice(course.approachCount, course.approachCount + 12)
      .map((placement) => ({ x: placement.x, z: placement.z })),
  ]
  let worst = {
    value: 0,
    index: 0,
    ndcX: 0,
    ndcY: 0,
  }
  for (let index = 0; index < course.cameraProgressCount; index += 1) {
    const progress = Math.max(0, index - lag) / course.cameraProgressCount
    const pose = sampleCameraRail(rail, progress)
    const placement = cameraProgressPoints[index]!
    const ndc = projectWorldPoint(aspect, pose, {
      x: placement.x,
      y: 0.5,
      z: placement.z,
    })
    const value = Math.max(Math.abs(ndc.x), Math.abs(ndc.y))
    if (value > worst.value) {
      worst = { value, index, ndcX: ndc.x, ndcY: ndc.y }
    }
  }
  return worst
}

describe('dominoCameraRail', () => {
  it('進行度1のカメラがPhase 4の固定カメラへ完全に戻る', () => {
    const { course, flagSetup, rail } = createRail(0.46)
    const first = sampleCameraRail(rail, 0)
    const last = sampleCameraRail(rail, 1)

    expect(first).toEqual({ target: rail[0]!.target, distance: rail[0]!.distance })
    expect(last).toEqual({ target: flagSetup.target, distance: cameraDistanceOf(flagSetup) })
    const position = cameraPositionFor(last.target, last.distance)
    expect(position.x).toBeCloseTo(flagSetup.position.x, 10)
    expect(position.y).toBeCloseTo(flagSetup.position.y, 10)
    expect(position.z).toBeCloseTo(flagSetup.position.z, 10)
    expect(course.cameraApproachPath.length).toBeGreaterThan(0)
  })

  it('アンカー間を線形補間し、範囲外を端で丸める', () => {
    const anchors = [
      { progress: 0, target: { x: 0, y: 1, z: 2 }, distance: 10 },
      { progress: 0.5, target: { x: 10, y: 3, z: 6 }, distance: 20 },
      { progress: 1, target: { x: 20, y: 5, z: 10 }, distance: 30 },
    ] as const

    expect(sampleCameraRail(anchors, 0.25)).toEqual({
      target: { x: 5, y: 2, z: 4 },
      distance: 15,
    })
    expect(sampleCameraRail(anchors, -0.5)).toEqual({
      target: { x: 0, y: 1, z: 2 },
      distance: 10,
    })
    expect(sampleCameraRail(anchors, 1.5)).toEqual({
      target: { x: 20, y: 5, z: 10 },
      distance: 30,
    })
  })

  it('道中の密なアンカーと終盤からの引きを作る', () => {
    const { course, flagSetup, rail } = createRail(1.8)
    const blendStart = course.cameraApproachPath.length - CAMERA_BLEND_APPROACH_COUNT
    const transitionCount = course.cameraProgressCount - blendStart

    expect(rail).toHaveLength(course.cameraProgressCount + 1)
    expect(rail.slice(0, blendStart).map((anchor) => anchor.progress)).toEqual(
      course.cameraApproachPath
        .slice(0, blendStart)
        .map((_, index) => index / course.cameraProgressCount),
    )
    expect(rail[blendStart]!.progress).toBe(blendStart / course.cameraProgressCount)
    expect(rail[blendStart]!.distance).toBe(approachCameraDistanceFor(1.8))
    expect(rail[blendStart + transitionCount - 1]!.progress).toBe(
      (course.cameraProgressCount - 1) / course.cameraProgressCount,
    )
    expect(rail.at(-1)).toEqual({
      progress: 1,
      target: flagSetup.target,
      distance: cameraDistanceOf(flagSetup),
    })
    for (const anchor of rail) {
      expect(anchor.distance).toBeGreaterThanOrEqual(APPROACH_CAMERA_DISTANCE)
    }
    expect(CAMERA_PROGRESS_TILT_RAD).toBeCloseTo(0.35)
  })

  it('aspect比から道中カメラ距離を決める', () => {
    const expectedPortrait =
      APPROACH_MIN_HALF_WIDTH /
      (Math.tan((CAMERA_FOV * Math.PI) / 360) * 0.46)
    expect(approachCameraDistanceFor(0.46)).toBeCloseTo(expectedPortrait, 10)
    expect(approachCameraDistanceFor(1.8)).toBe(APPROACH_CAMERA_DISTANCE)
  })

  it('reduced-motionは全進行度で同じ広角俯瞰を使う', () => {
    const { wideCamera, rail } = createRail(0.46, true)
    const widePose = wideCamera

    expect(rail).toHaveLength(2)
    for (const aspect of [0.46, 1.8, 2.17]) {
      const { wideCamera: aspectWideCamera } = createRail(aspect, true)
      console.log(
        `[camera-reduced] aspect=${aspect} distance=${aspectWideCamera.distance.toFixed(6)}`,
      )
    }
    for (const progress of [0, 0.2, 0.5, 0.786, 0.95, 1]) {
      expect(sampleCameraRail(rail, progress)).toEqual(widePose)
    }
  })

  it('道中と共有直線のドミノを全画面内に15%の余白で収める', () => {
    for (const aspect of [0.4, 0.46, 0.62, 1.0, 1.33, 1.8, 2.17, 2.6]) {
      for (const reducedMotion of [false, true]) {
        const values = []
        for (const lag of [0, 1, 2, 3, 4, 5, 6]) {
          const worst = worstFrameNdc(aspect, reducedMotion, lag)
          values.push(worst.value)
          console.log(
            `[camera-frame] rail=${reducedMotion ? 'reduced' : 'normal'} aspect=${aspect} lag=${lag} worst=${worst.value.toFixed(6)} index=${worst.index} ndc=(${worst.ndcX.toFixed(6)},${worst.ndcY.toFixed(6)})`,
          )
          // 通常レールは画面端まで15%の余白を残す。reduced-motionは全体俯瞰を優先し、画面外に出ないことを固定する。
          const frameLimit = reducedMotion ? 1 : FRAME_MARGIN
          expect(worst.value).toBeLessThanOrEqual(frameLimit + 1e-9)
        }
        const frameLimit = reducedMotion ? 1 : FRAME_MARGIN
        expect(Math.max(...values)).toBeLessThanOrEqual(frameLimit + 1e-9)
      }
    }
  })

  it('注視点と距離のピーク速度を進行度1あたり70以下に抑える', () => {
    let maximumTargetRate = 0
    let maximumDistanceRate = 0
    for (const aspect of [0.46, 0.55, 0.62, 1.0, 1.8, 2.2]) {
      for (const reducedMotion of [false, true]) {
        const { rail } = createRail(aspect, reducedMotion)
        let targetRate = 0
        let distanceRate = 0
        let targetRateProgress = 0
        let distanceRateProgress = 0
        let previous = sampleCameraRail(rail, 0)
        for (let index = 1; index <= RAIL_SAMPLE_COUNT; index += 1) {
          const progress = index / RAIL_SAMPLE_COUNT
          const current = sampleCameraRail(rail, progress)
          const deltaProgress = 1 / RAIL_SAMPLE_COUNT
          const currentTargetRate = Math.hypot(
              current.target.x - previous.target.x,
              current.target.y - previous.target.y,
              current.target.z - previous.target.z,
            ) / deltaProgress
          if (currentTargetRate > targetRate) {
            targetRateProgress = progress
            targetRate = currentTargetRate
          }
          const currentDistanceRate =
            Math.abs(current.distance - previous.distance) / deltaProgress
          if (currentDistanceRate > distanceRate) {
            distanceRateProgress = progress
            distanceRate = currentDistanceRate
          }
          previous = current
        }
        maximumTargetRate = Math.max(maximumTargetRate, targetRate)
        maximumDistanceRate = Math.max(maximumDistanceRate, distanceRate)
        // 進行度1.0を約10.6秒で進むため、70/進行度は約6.6ユニット/秒に相当する。
        // 各サンプルの差分率を測り、全区間の移動量ではなく瞬間的な速さを制限する。
        console.log(
          `[camera-speed-peak] rail=${reducedMotion ? 'reduced' : 'normal'} aspect=${aspect} targetRate=${targetRate.toFixed(6)} at=${targetRateProgress.toFixed(6)} distanceRate=${distanceRate.toFixed(6)} at=${distanceRateProgress.toFixed(6)}`,
        )
        expect(targetRate).toBeLessThanOrEqual(RAIL_MOVEMENT_LIMIT)
        expect(distanceRate).toBeLessThanOrEqual(RAIL_MOVEMENT_LIMIT)
      }
    }
    console.log(
      `[camera-speed-peak] maxTargetRate=${maximumTargetRate.toFixed(6)} maxDistanceRate=${maximumDistanceRate.toFixed(6)}`,
    )
  })

  it('注視点と距離の総移動量をピーク速度とは別に確認する', () => {
    let maximumTargetTravel = 0
    let maximumDistanceTravel = 0
    for (const aspect of [0.46, 0.55, 0.62, 1.0, 1.8, 2.2]) {
      for (const reducedMotion of [false, true]) {
        const { rail } = createRail(aspect, reducedMotion)
        let targetTravel = 0
        let distanceTravel = 0
        let previous = sampleCameraRail(rail, 0)
        for (let index = 1; index <= RAIL_SAMPLE_COUNT; index += 1) {
          const current = sampleCameraRail(rail, index / RAIL_SAMPLE_COUNT)
          targetTravel += Math.hypot(
            current.target.x - previous.target.x,
            current.target.y - previous.target.y,
            current.target.z - previous.target.z,
          )
          distanceTravel += Math.abs(current.distance - previous.distance)
          previous = current
        }
        maximumTargetTravel = Math.max(maximumTargetTravel, targetTravel)
        maximumDistanceTravel = Math.max(maximumDistanceTravel, distanceTravel)
        console.log(
          `[camera-speed-total] rail=${reducedMotion ? 'reduced' : 'normal'} aspect=${aspect} targetTravel=${targetTravel.toFixed(6)} distanceTravel=${distanceTravel.toFixed(6)}`,
        )
      }
    }
    console.log(
      `[camera-speed-total] maxTargetTravel=${maximumTargetTravel.toFixed(6)} maxDistanceTravel=${maximumDistanceTravel.toFixed(6)}`,
    )
  })

  it('ロング地面の端が開始時の全構図で画面に入らない', () => {
    const course = createDominoCourse('long', 'jp')
    const halfGround = course.groundSize / 2
    for (const aspect of [0.46, 0.55, 0.62, 1.0, 1.8, 2.2]) {
      const normal = createRail(aspect).rail
      const reduced = createRail(aspect, true).rail
      let nearestEdgeNdc = Number.POSITIVE_INFINITY
      let farthestGroundDistance = 0
      for (const pose of [sampleCameraRail(normal, 0), sampleCameraRail(reduced, 0)]) {
        const cameraPosition = cameraPositionFor(pose.target, pose.distance)
        for (let edge = 0; edge < 4; edge += 1) {
          for (let step = 0; step <= 20; step += 1) {
            const t = step / 20
            const point =
              edge === 0
                ? { x: -halfGround, y: 0, z: -halfGround + 2 * halfGround * t }
                : edge === 1
                  ? { x: halfGround, y: 0, z: -halfGround + 2 * halfGround * t }
                  : edge === 2
                    ? { x: -halfGround + 2 * halfGround * t, y: 0, z: -halfGround }
                    : { x: -halfGround + 2 * halfGround * t, y: 0, z: halfGround }
            const ndc = projectWorldPoint(aspect, pose, point)
            const edgeNdc = Math.max(Math.abs(ndc.x), Math.abs(ndc.y))
            nearestEdgeNdc = Math.min(nearestEdgeNdc, edgeNdc)
            expect(edgeNdc).toBeGreaterThan(1)
          }
        }
        for (const x of [-halfGround, halfGround]) {
          for (const z of [-halfGround, halfGround]) {
            farthestGroundDistance = Math.max(
              farthestGroundDistance,
              Math.hypot(
                cameraPosition.x - x,
                cameraPosition.y,
                cameraPosition.z - z,
              ),
            )
          }
        }
      }
      console.log(
        `[camera-ground-edge] aspect=${aspect} nearestEdgeNdc=${nearestEdgeNdc.toFixed(6)} farthestCorner=${farthestGroundDistance.toFixed(6)}`,
      )
      expect(farthestGroundDistance).toBeLessThan(LONG_CAMERA_FAR)
    }
  })

  it('指数減衰で進行度は後退せず、刻み方に依存しない', () => {
    const oneStep = advanceRailProgress(0.1, 0.8, 0.1, 2.5)
    let tenSteps = 0.1
    for (let index = 0; index < 10; index += 1) {
      tenSteps = advanceRailProgress(tenSteps, 0.8, 0.01, 2.5)
    }

    expect(advanceRailProgress(0.7, 0.2, 0.1, 2.5)).toBe(0.7)
    expect(oneStep).toBeGreaterThan(0.1)
    expect(oneStep).toBeLessThan(0.8)
    expect(tenSteps).toBeCloseTo(oneStep, 10)
  })

  it('dampFactorは0秒で0、大きな時間で1に近づく', () => {
    expect(dampFactor(3, 0)).toBe(0)
    expect(dampFactor(3, 10)).toBeGreaterThan(0.999999)
  })

  it('空の道中ではロングレールを作らない', () => {
    const flagCamera = { target: { x: 0, y: 0.32, z: 0 }, distance: 20 }
    expect(() => buildLongCameraRail([], flagCamera)).toThrow()
    expect(() => sampleCameraRail([], 0)).toThrow()
  })

  it('実際のエンジン引数で全進行度の地面レイを内側に収める', () => {
    const course = createDominoCourse('long', 'jp')
    const ndcSamples = [-1, 0, 1]
    const progressSampleCount = 120
    let minimumMargin = Number.POSITIVE_INFINITY
    let minimumMarginCase = ''
    let maximumGroundCornerDistance = 0

    for (const aspect of [0.4, 0.46, 0.62, 1.0, 1.33, 1.8, 2.17, 2.6]) {
      const flagSetup = computeCameraSetup(course.flagCameraBounds, aspect)
      const wideCamera = wideCameraPoseFor(getLayoutBounds(course.placements), aspect)
      for (const reducedMotion of [false, true]) {
        const rail = buildLongCameraRail(
          course.cameraApproachPath,
          {
            target: flagSetup.target,
            distance: cameraDistanceOf(flagSetup),
          },
          {
            reducedMotion,
            approachDistance: approachCameraDistanceFor(aspect),
            cameraProgressCount: course.cameraProgressCount,
            wideCamera,
          },
        )

        for (let step = 0; step <= progressSampleCount; step += 1) {
          const progress = step / progressSampleCount
          const pose = sampleCameraRail(rail, progress)
          const camera = cameraForPose(aspect, pose)
          for (const groundX of [-course.groundSize / 2, course.groundSize / 2]) {
            for (const groundZ of [-course.groundSize / 2, course.groundSize / 2]) {
              maximumGroundCornerDistance = Math.max(
                maximumGroundCornerDistance,
                Math.hypot(
                  camera.position.x - groundX,
                  camera.position.y,
                  camera.position.z - groundZ,
                ),
              )
            }
          }
          for (const ndcX of ndcSamples) {
            for (const ndcY of ndcSamples) {
              const point = groundPointForNdc(camera, ndcX, ndcY)
              const margin =
                course.groundSize / 2 - Math.max(Math.abs(point.x), Math.abs(point.z))
              if (margin < minimumMargin) {
                minimumMargin = margin
                minimumMarginCase =
                  `aspect=${aspect} reduced=${reducedMotion} progress=${progress.toFixed(3)} ndc=(${ndcX},${ndcY})`
              }
              // 画面の端から地面の切れ目が見えないよう、交点を地面の内側に固定する。
              expect(margin).toBeGreaterThanOrEqual(-1e-8)
            }
          }
        }
      }
    }

    console.log(
      `[camera-ground-ray] minimumMargin=${minimumMargin.toFixed(6)} maximumGroundCornerDistance=${maximumGroundCornerDistance.toFixed(6)} ${minimumMarginCase}`,
    )
    expect(minimumMargin).toBeGreaterThanOrEqual(-1e-8)
    expect(maximumGroundCornerDistance).toBeLessThan(LONG_CAMERA_FAR)
  })

  it('bigのカメラレールは寄りから引きへ単調に遷移する', () => {
    const nearPose = { target: { x: 0, y: 0.32, z: -5 }, distance: 20 }
    const widePose = { target: { x: 0, y: 0.32, z: 0 }, distance: 80 }
    const rail = buildBigCameraRail(nearPose, widePose)

    expect(sampleCameraRail(rail, 0)).toEqual(nearPose)
    expect(sampleCameraRail(rail, 1)).toEqual(widePose)
    let previousDistance = nearPose.distance
    for (let index = 1; index <= 100; index += 1) {
      const pose = sampleCameraRail(rail, index / 100)
      expect(pose.distance).toBeGreaterThanOrEqual(previousDistance)
      previousDistance = pose.distance
    }
  })

  it('bigの実配置でも縦横画面の距離が寄りから単調に増える', () => {
    const course = createBigCourse('jp')
    const normalCourse = createDominoCourse('normal', 'jp')
    // ビッグ開始時にふつうと同じ導線の見え方にするため、寄り側のX幅をふつうの国旗半幅に合わせる。
    const nearHalfWidth = (FLAG_COLS / 2) * FLAG_PITCH_X
    for (const aspect of [390 / 780, 844 / 390]) {
      const nearBounds = getLayoutBounds(
        course.placements.filter(
          (placement) =>
            Math.abs(placement.x) <= nearHalfWidth &&
            (placement.kind !== 'flag' || (placement.row ?? 0) < 4),
        ),
      )
      const nearSetup = computeCameraSetup(nearBounds, aspect, 4)
      const wideSetup = computeCameraSetup(
        course.flagCameraBounds,
        aspect,
        course.flagLayout.rows,
      )
      const normalSetup = computeCameraSetup(
        normalCourse.flagCameraBounds,
        aspect,
        normalCourse.flagLayout.rows,
      )
      const nearDistance = cameraDistanceOf(nearSetup)
      const wideDistance = cameraDistanceOf(wideSetup)
      const normalDistance = cameraDistanceOf(normalSetup)
      console.log(
        `[big-camera-distance] aspect=${aspect.toFixed(6)} normal=${normalDistance.toFixed(6)} near=${nearDistance.toFixed(6)} wide=${wideDistance.toFixed(6)}`,
      )

      if (aspect < 1) {
        // 縦画面では開始時の寄りを明確にし、ふつうの構図から大きく外れないことを保証する。
        expect(nearDistance).toBeLessThanOrEqual(wideDistance * 0.6)
        expect(nearDistance).toBeLessThanOrEqual(normalDistance * 1.5)
      } else {
        expect(nearDistance).toBeLessThan(wideDistance)
      }

      const rail = buildBigCameraRail(
        {
          target: nearSetup.target,
          distance: nearDistance,
        },
        {
          target: wideSetup.target,
          distance: wideDistance,
        },
      )
      let previousDistance = sampleCameraRail(rail, 0).distance
      for (let index = 1; index <= 100; index += 1) {
        const distance = sampleCameraRail(rail, index / 100).distance
        expect(distance).toBeGreaterThanOrEqual(previousDistance)
        previousDistance = distance
      }
    }
  })
})
