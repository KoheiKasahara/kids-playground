import * as THREE from 'three'
import type { GlobeFeature } from '../types'

type Position = readonly [longitude: number, latitude: number]
type Ring = readonly Position[]
type Polygon = readonly Ring[]

// three-globe の地球半径は100。通常の国ポリゴン上面は altitude=0.008 なので
// 半径100.8となる。線はそのすぐ上だけを通し、外周で地表から浮いて見えないようにする。
export const BASE_BORDER_RADIUS = 100.81
// 選択中の国だけは altitude=0.024（半径102.4）まで持ち上がるため、専用線を重ねる。
export const SELECTED_BORDER_RADIUS = 102.41
// 元のデータは0.5°以下まで密度化済み。描画線だけはさらに細かくして球面上の折れを目立たせない。
export const MAX_BORDER_SEGMENT_DEGREES = 0.25

function normalizedLongitude(longitude: number): number {
  return ((longitude + 180) % 360 + 360) % 360 - 180
}

function shortestLongitudeDelta(start: number, end: number): number {
  return ((end - start + 540) % 360) - 180
}

function positionAt(longitude: number, latitude: number, radius: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - latitude)
  const theta = THREE.MathUtils.degToRad(90 - longitude)
  const sinPhi = Math.sin(phi)

  return new THREE.Vector3(
    radius * sinPhi * Math.cos(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.sin(theta),
  )
}

function segmentCount(start: Position, end: Position): number {
  const longitudeDistance = shortestLongitudeDelta(start[0], end[0])
  const latitudeDistance = end[1] - start[1]
  return Math.max(
    1,
    Math.ceil(Math.hypot(longitudeDistance, latitudeDistance) / MAX_BORDER_SEGMENT_DEGREES),
  )
}

function polygonsOf(feature: GlobeFeature): readonly Polygon[] {
  return feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates as Polygon]
    : feature.geometry.coordinates as readonly Polygon[]
}

/**
 * 国の当たり判定・面ポリゴンとは別に、滑らかな見た目用の国境線だけを生成する。
 * 1つのLineSegmentsにまとめ、countryごとのObject3D増加を避ける。
 */
export function createGlobeBorderLines(
  features: readonly GlobeFeature[],
  radius = BASE_BORDER_RADIUS,
): THREE.LineSegments {
  const points: number[] = []

  for (const feature of features) {
    for (const polygon of polygonsOf(feature)) {
      for (const ring of polygon) {
        for (let index = 1; index < ring.length; index += 1) {
          const start = ring[index - 1]
          const end = ring[index]
          const segments = segmentCount(start, end)
          const longitudeDelta = shortestLongitudeDelta(start[0], end[0])
          const latitudeDelta = end[1] - start[1]

          for (let segment = 0; segment < segments; segment += 1) {
            const startRatio = segment / segments
            const endRatio = (segment + 1) / segments
            const startPosition = positionAt(
              normalizedLongitude(start[0] + longitudeDelta * startRatio),
              start[1] + latitudeDelta * startRatio,
              radius,
            )
            const endPosition = positionAt(
              normalizedLongitude(start[0] + longitudeDelta * endRatio),
              start[1] + latitudeDelta * endRatio,
              radius,
            )
            points.push(
              startPosition.x, startPosition.y, startPosition.z,
              endPosition.x, endPosition.y, endPosition.z,
            )
          }
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  const material = new THREE.LineBasicMaterial({
    color: '#173b75',
    // 線同士が深度バッファを塞がないようにする。depthTestは維持するため背面は地球に隠れる。
    depthWrite: false,
  })
  return new THREE.LineSegments(geometry, material)
}

export function disposeGlobeBorderLines(borderLines: THREE.LineSegments): void {
  borderLines.geometry.dispose()
  const materials = borderLines.material instanceof Array
    ? borderLines.material
    : [borderLines.material]
  materials.forEach((material) => material.dispose())
}
